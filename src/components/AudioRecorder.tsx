import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, AlertCircle, CheckCircle2, Radio, Info } from 'lucide-react';
import { AudioRecording } from '../types';
import {
  getSupportedMimeType,
  formatTime,
  generateVoiceSampleFilename,
} from '../utils/audioHelpers';
import { AudioVisualizer } from './AudioVisualizer';
import { AudioPreviewPlayer } from './AudioPreviewPlayer';

interface AudioRecorderProps {
  respondentName: string;
  onRecordingComplete: (recording: AudioRecording | null) => void;
  onShowToast: (type: 'error' | 'success' | 'warning' | 'info', title: string, message: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_SECONDS = 60; // Exactly 01:00
const MIN_RECORDING_SECONDS = 5;  // 5-second minimum constraint

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  respondentName,
  onRecordingComplete,
  onShowToast,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentRecording, setCurrentRecording] = useState<AudioRecording | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Stop tracks utility
  const cleanupStream = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      activeStreamRef.current = null;
    }
    setStream(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  // Stop recording handler
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.error('Error stopping MediaRecorder:', e);
    }

    setIsRecording(false);
    cleanupStream();
  }, [cleanupStream]);

  // Start recording handler
  const startRecording = async () => {
    setPermissionError(null);
    chunksRef.current = [];
    setElapsedSeconds(0);

    // Verify browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Your browser does not support audio recording via MediaDevices.';
      setPermissionError(err);
      onShowToast('error', 'Microphone Not Supported', err);
      return;
    }

    try {
      // Request microphone access
      const userStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      activeStreamRef.current = userStream;
      setStream(userStream);

      const mimeType = getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      const mediaRecorder = new MediaRecorder(userStream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const finalBlob = new Blob(chunksRef.current, { type: finalMimeType });
        const finalDuration = Math.min(
          MAX_RECORDING_SECONDS,
          (Date.now() - startTimeRef.current) / 1000
        );

        const fileName = generateVoiceSampleFilename(respondentName, finalMimeType);
        const url = URL.createObjectURL(finalBlob);

        const recordingData: AudioRecording = {
          blob: finalBlob,
          url,
          duration: Math.max(0.1, Math.round(finalDuration * 10) / 10),
          mimeType: finalMimeType,
          fileName,
          fileSize: finalBlob.size,
        };

        setCurrentRecording(recordingData);
        onRecordingComplete(recordingData);

        if (finalDuration < MIN_RECORDING_SECONDS) {
          onShowToast(
            'warning',
            'Sample Too Short',
            `Your recording was ${finalDuration.toFixed(1)}s. Please record at least 5 seconds before submitting.`
          );
        } else {
          onShowToast(
            'success',
            'Recording Captured',
            `Successfully recorded ${formatTime(finalDuration)} of audio. Review below before submitting.`
          );
        }
      };

      // Start recording
      mediaRecorder.start(250); // Emit data slices every 250ms
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // Start live elapsed timer
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setElapsedSeconds(elapsed);

        // Automatically halt recording when timer hits 01:00 (60s)
        if (elapsed >= MAX_RECORDING_SECONDS) {
          setElapsedSeconds(MAX_RECORDING_SECONDS);
          stopRecording();
          onShowToast(
            'info',
            'Time Limit Reached',
            'Recording automatically ended at exactly 01:00 (60 seconds).'
          );
        }
      }, 100);

    } catch (err: any) {
      console.error('Microphone access error:', err);
      cleanupStream();

      let friendlyTitle = 'Microphone Access Denied';
      let friendlyMessage = 'Please enable microphone access in your browser settings to record your voice sample.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyTitle = 'Permission Denied';
        friendlyMessage = 'Microphone permission was blocked. Click the lock/camera icon in your browser address bar to allow microphone access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyTitle = 'No Microphone Detected';
        friendlyMessage = 'No microphone device was detected on your computer or phone. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError') {
        friendlyTitle = 'Microphone In Use';
        friendlyMessage = 'Your microphone may be in use by another application. Please close other audio apps and retry.';
      }

      setPermissionError(friendlyMessage);
      onShowToast('error', friendlyTitle, friendlyMessage);
    }
  };

  // Discard and rerecord
  const handleRerecord = () => {
    if (currentRecording?.url) {
      URL.revokeObjectURL(currentRecording.url);
    }
    setCurrentRecording(null);
    setElapsedSeconds(0);
    onRecordingComplete(null);
  };

  // Progress calculations
  const progressPercent = Math.min(100, (elapsedSeconds / MAX_RECORDING_SECONDS) * 100);
  const minPercent = (MIN_RECORDING_SECONDS / MAX_RECORDING_SECONDS) * 100;
  const isMinimumMet = currentRecording ? currentRecording.duration >= MIN_RECORDING_SECONDS : elapsedSeconds >= MIN_RECORDING_SECONDS;

  // Live Cadence Prompter: 1.0s speech window, 0.5s pause = 1.5s total cycle
  const cadenceCycle = isRecording ? (elapsedSeconds % 1.5) : 0;
  const isSpeakingWindow = cadenceCycle < 1.0;
  const repetitionNumber = isRecording ? Math.floor(elapsedSeconds / 1.5) + 1 : 0;

  return (
    <div className="w-full space-y-4">
      {/* Permission error alert if any */}
      {permissionError && (
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-red-900">Microphone Access Error</p>
            <p className="text-xs text-red-700 leading-relaxed">{permissionError}</p>
          </div>
        </div>
      )}

      {/* Main Recording Interface Box */}
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
        
        {/* Subtle background pulse when recording */}
        {isRecording && (
          <div className="absolute inset-0 bg-red-50/40 pointer-events-none transition-opacity duration-300" />
        )}

        {/* Live Timer & Indicator */}
        <div className="flex items-center gap-2 mb-2 z-10">
          {isRecording ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              REC
            </span>
          ) : currentRecording ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Recorded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              <Radio className="w-3.5 h-3.5" />
              Ready
            </span>
          )}

          <span className="text-xs font-medium text-slate-400">|</span>
          <span className="text-xs text-slate-500">Limit: 01:00 (Min: 00:05)</span>
        </div>

        {/* Elapsed Timer Display (mm:ss) */}
        <div className="z-10 my-2">
          <div className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-slate-900">
            {formatTime(isRecording ? elapsedSeconds : currentRecording ? currentRecording.duration : 0)}
            <span className="text-xl sm:text-2xl text-slate-400 font-normal"> / 01:00</span>
          </div>
        </div>

        {/* Progress Bar with 5-second marker */}
        <div className="w-full max-w-sm mt-2 mb-4 z-10">
          <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-100 ${
                isRecording
                  ? progressPercent >= minPercent
                    ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                    : 'bg-blue-500'
                  : currentRecording && currentRecording.duration >= MIN_RECORDING_SECONDS
                  ? 'bg-emerald-500'
                  : 'bg-slate-300'
              }`}
              style={{
                width: isRecording
                  ? `${progressPercent}%`
                  : currentRecording
                  ? `${Math.min(100, (currentRecording.duration / MAX_RECORDING_SECONDS) * 100)}%`
                  : '0%',
              }}
            />
            {/* 5s tick marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400/70"
              style={{ left: `${minPercent}%` }}
              title="Minimum 5 seconds"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
            <span>00:00</span>
            <span className="text-slate-500 font-medium">00:05 (Min)</span>
            <span>01:00</span>
          </div>
        </div>

        {/* Live Audio Visualizer while recording */}
        {isRecording && (
          <div className="w-full z-10 my-2 space-y-2">
            {/* Live Cadence Prompter */}
            <div
              className={`w-full max-w-sm mx-auto p-2.5 rounded-xl border transition-all duration-200 ${
                isSpeakingWindow
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500 text-amber-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold">
                  {isSpeakingWindow ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="uppercase tracking-wide text-emerald-700">SPEAK NOW (1.0s)</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="uppercase tracking-wide text-amber-700">PAUSE / QUIET (0.5s)</span>
                    </>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Rep #{repetitionNumber}
                </span>
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-slate-900">
                {isSpeakingWindow ? '"sheild activate"' : '... (0.5s pause) ...'}
              </div>
            </div>

            <AudioVisualizer stream={stream} isRecording={isRecording} />
          </div>
        )}

        {/* Cadence reminder when ready to record */}
        {!isRecording && !currentRecording && (
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900 mt-1 mb-2 z-10 max-w-md">
            <span className="font-semibold text-blue-800">Target Voice Phrase:</span>
            <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded text-blue-700 shadow-2xs">
              "sheild activate"
            </span>
            <span className="text-blue-400">|</span>
            <span className="text-slate-600">1s speech window + 0.5s pause</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="z-10 mt-3 flex flex-wrap items-center justify-center gap-3">
          {!isRecording && !currentRecording && (
            <button
              type="button"
              id="start-recording-btn"
              onClick={startRecording}
              disabled={disabled}
              className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-base font-semibold shadow-md transition-all ${
                disabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'
              }`}
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              type="button"
              id="stop-recording-btn"
              onClick={stopRecording}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-base font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md hover:scale-105 active:scale-95 transition-all animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              Stop Recording
            </button>
          )}
        </div>

        {/* Hint text */}
        {!isRecording && !currentRecording && (
          <p className="text-xs text-slate-500 mt-4 max-w-xs leading-relaxed">
            Click to start recording your 1-minute voice sample. Speak naturally into your microphone.
          </p>
        )}

        {isRecording && (
          <p className="text-xs text-red-600 font-medium mt-3 animate-pulse">
            Recording in progress... recording will automatically halt at 01:00.
          </p>
        )}
      </div>

      {/* Audio Preview Player when a recording is captured */}
      {currentRecording && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Review Voice Sample
            </h4>
            {currentRecording.duration < MIN_RECORDING_SECONDS ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                <AlertCircle className="w-3.5 h-3.5" />
                Too short ({currentRecording.duration}s &lt; 5s min)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid Duration ({currentRecording.duration}s)
              </span>
            )}
          </div>

          <AudioPreviewPlayer
            audioUrl={currentRecording.url}
            duration={currentRecording.duration}
            fileName={currentRecording.fileName}
            fileSize={currentRecording.fileSize}
            mimeType={currentRecording.mimeType}
            onRerecord={handleRerecord}
          />
        </div>
      )}
    </div>
  );
};
