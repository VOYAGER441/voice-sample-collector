import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Video,
  Clock,
  Volume2,
  VolumeX,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

export const ReferenceVideoGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [metronomeState, setMetronomeState] = useState<'speak' | 'pause'>('speak');
  const [metronomeCount, setMetronomeCount] = useState(0);
  const [audioCueEnabled, setAudioCueEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Soft tone generator for practice metronome
  const playTone = (frequency: number, duration: number) => {
    if (!audioCueEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Tone play error:', e);
    }
  };

  // Practice Metronome Cycle: 1.0s Speak, 0.5s Pause
  useEffect(() => {
    if (!isMetronomeActive) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMetronomeState('speak');
      setMetronomeCount(0);
      return;
    }

    let isSubscribed = true;

    const runCycle = () => {
      if (!isSubscribed) return;

      // 1.0s Speak window
      setMetronomeState('speak');
      setMetronomeCount((prev) => prev + 1);
      playTone(587.33, 0.15); // D5 chime for speak

      timerRef.current = window.setTimeout(() => {
        if (!isSubscribed) return;

        // 0.5s Pause window
        setMetronomeState('pause');
        playTone(392.00, 0.1); // G4 low chime for pause

        timerRef.current = window.setTimeout(() => {
          if (!isSubscribed) return;
          runCycle();
        }, 500); // 0.5s pause
      }, 1000); // 1.0s speak
    };

    runCycle();

    return () => {
      isSubscribed = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isMetronomeActive, audioCueEnabled]);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700/80 mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Reference Video & Recording Instructions
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Cadence Protocol
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Watch how to time your speech window and pauses for accurate sample collection.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition flex items-center gap-1 text-xs"
          aria-label={isExpanded ? 'Collapse instructions' : 'Expand instructions'}
        >
          <span className="hidden sm:inline font-medium">{isExpanded ? 'Hide Video' : 'Show Video'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Instructions Summary Banner */}
      <div className="mt-4 p-4 rounded-xl bg-blue-950/60 border border-blue-500/30 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-300 tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Mandatory Voice Sample Instructions
        </div>

        <div className="text-sm sm:text-base leading-relaxed text-slate-200">
          The required voice sample is{' '}
          <strong className="text-emerald-400 font-mono text-base sm:text-lg bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
            "sheild activate"
          </strong>. Say it within a{' '}
          <strong className="text-amber-300 underline decoration-amber-400/60 underline-offset-4">
            1-second time window
          </strong>
          , pause for{' '}
          <strong className="text-amber-300 underline decoration-amber-400/60 underline-offset-4">
            0.5 seconds of silence
          </strong>
          , then again say{' '}
          <strong className="text-emerald-400 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded">
            "sheild activate"
          </strong>
          .
        </div>

        {/* Cadence Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <p className="font-semibold text-white">1.0s Speaking Window</p>
              <p className="text-slate-400 text-[11px]">Say "sheild activate" clearly</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <p className="font-semibold text-white">0.5s Pause / Silence</p>
              <p className="text-slate-400 text-[11px]">Hold quiet between phrases</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <p className="font-semibold text-white">Repeat Continually</p>
              <p className="text-slate-400 text-[11px]">Repeat phrase every 1.5 seconds</p>
            </div>
          </div>
        </div>
      </div>

      {/* Video & Interactive Cadence Guide Section (Collapsible) */}
      {isExpanded && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Video Player */}
          <div className="lg:col-span-7 space-y-2">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-700 shadow-inner group">
              <video
                ref={videoRef}
                src="/reference_guide.mp4"
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                title="Reference Video: How to record the 1-minute voice sample"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>▶ Watch reference demonstration of the 1.0s speak + 0.5s pause rhythm</span>
              <span className="font-mono">Duration: 00:12 (Loop)</span>
            </div>
          </div>

          {/* Interactive Cadence Practice Tool / Metronome */}
          <div className="lg:col-span-5 bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Cadence Practice Tool
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {isMetronomeActive ? `Repetition #${metronomeCount}` : 'Standby'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Practice the exact 1.0s utterance and 0.5s pause timing before recording.
              </p>
            </div>

            {/* Visual Beat Indicator */}
            <div
              className={`p-4 rounded-xl border text-center transition-all duration-200 ${
                !isMetronomeActive
                  ? 'bg-slate-900/60 border-slate-700 text-slate-400'
                  : metronomeState === 'speak'
                  ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-amber-950/80 border-amber-500/70 text-amber-300 shadow-md ring-2 ring-amber-500/20'
              }`}
            >
              {!isMetronomeActive ? (
                <div className="py-2 space-y-1">
                  <p className="font-medium text-sm text-slate-300">Rhythm Trainer Inactive</p>
                  <p className="text-[11px] text-slate-400">Click "Start Rhythm Trainer" below to practice the beat.</p>
                </div>
              ) : metronomeState === 'speak' ? (
                <div className="space-y-1 animate-pulse">
                  <div className="inline-flex items-center gap-1.5 text-xs uppercase font-bold tracking-wider text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    SPEAK NOW (1.0s window)
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
                    "SHEILD ACTIVATE"
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs uppercase font-bold tracking-wider text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    PAUSE / SILENCE (0.5s pause)
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono text-amber-200">
                    ... ( Be Quiet ) ...
                  </div>
                </div>
              )}
            </div>

            {/* Metronome Controls */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsMetronomeActive(!isMetronomeActive)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  isMetronomeActive
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isMetronomeActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Stop Practice
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Rhythm Trainer
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setAudioCueEnabled(!audioCueEnabled)}
                className={`p-2 rounded-lg text-xs border transition ${
                  audioCueEnabled
                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white'
                }`}
                title={audioCueEnabled ? 'Mute audio tone' : 'Enable audio tone'}
                aria-label="Toggle audio cue"
              >
                {audioCueEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
