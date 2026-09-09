import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording || !stream) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Generates 32 frequency bins
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const numBars = 24;
        const barWidth = Math.max(3, Math.floor((width / numBars) - 2));
        const gap = 2;

        let x = (width - (numBars * (barWidth + gap))) / 2;

        for (let i = 0; i < numBars; i++) {
          // sample across the frequency data
          const dataIndex = Math.floor((i / numBars) * bufferLength);
          const value = dataArray[dataIndex] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * height * 0.9);

          // Dynamic gradient based on voice pitch/volume
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, '#3b82f6'); // blue-500
          gradient.addColorStop(0.7, '#6366f1'); // indigo-500
          gradient.addColorStop(1, '#ef4444'); // red-500 for peak

          ctx.fillStyle = gradient;

          // Draw rounded bar
          const y = height / 2 - barHeight / 2;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 2);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();

          x += barWidth + gap;
        }
      };

      draw();
    } catch (err) {
      console.warn('Audio visualizer failed to initialize:', err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isRecording, stream]);

  return (
    <div className="w-full flex flex-col items-center justify-center py-2">
      <canvas
        ref={canvasRef}
        width={340}
        height={60}
        className="w-full max-w-[340px] h-[60px] rounded-lg bg-slate-900/5 dark:bg-white/5 border border-slate-200/50 dark:border-slate-800"
      />
      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-mono">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Microphone Audio Frequency Active
      </div>
    </div>
  );
};
