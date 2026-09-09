import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Download } from 'lucide-react';
import { formatTime, formatBytes } from '../utils/audioHelpers';

interface AudioPreviewPlayerProps {
  audioUrl: string;
  duration: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  onRerecord: () => void;
}

export const AudioPreviewPlayer: React.FC<AudioPreviewPlayerProps> = ({
  audioUrl,
  duration,
  fileName,
  fileSize,
  mimeType,
  onRerecord,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error('Audio playback failed:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 0.75];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const maxDuration = Math.max(duration, audioRef.current?.duration || 0);

  return (
    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 text-xs text-slate-600">
        <div className="font-mono truncate max-w-[280px] sm:max-w-[360px]" title={fileName}>
          <span className="font-semibold text-slate-700">File:</span> {fileName}
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <span>{formatBytes(fileSize)}</span>
          <span>•</span>
          <span className="uppercase">{mimeType.split(';')[0].replace('audio/', '')}</span>
          <span>•</span>
          <span className="font-medium text-slate-700">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Player Controls & Scrubber */}
      <div className="pt-3.5 space-y-3">
        {/* Scrubber slider */}
        <div className="space-y-1">
          <input
            type="range"
            id="audio-scrubber"
            min={0}
            max={maxDuration || 60}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
          />
          <div className="flex justify-between text-xs font-mono text-slate-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(maxDuration)}</span>
          </div>
        </div>

        {/* Buttons bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="audio-play-pause-btn"
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow transition"
              aria-label={isPlaying ? 'Pause sample' : 'Play sample'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-200 transition"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-1 text-xs font-semibold rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
              title="Playback speed"
            >
              {playbackRate}x
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={audioUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition"
              title="Save a backup copy to your device"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>

            <button
              type="button"
              id="rerecord-btn"
              onClick={onRerecord}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rerecord
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
