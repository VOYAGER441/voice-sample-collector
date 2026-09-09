import React from 'react';
import {
  CheckCircle,
  Download,
  RotateCcw,
  ShieldCheck,
  Clock,
  FileAudio,
  User,
  Database,
} from 'lucide-react';
import { SubmissionRecord } from '../types';
import { formatBytes, formatTime } from '../utils/audioHelpers';

interface SubmissionSuccessProps {
  submission: SubmissionRecord;
  onReset: () => void;
}

export const SubmissionSuccess: React.FC<SubmissionSuccessProps> = ({
  submission,
  onReset,
}) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-6 animate-fadeIn">
      {/* Success Badge */}
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-inner ring-8 ring-emerald-50">
          <CheckCircle className="w-9 h-9 stroke-[2.5]" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Voice Sample Submitted!
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-md">
          Thank you for participating. Your voice recording has been verified, processed, and securely stored in the research dataset.
        </p>
      </div>

      {/* Confirmation Summary Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-1">
          <div>
            <span className="text-xs text-slate-500 font-mono">SUBMISSION ID</span>
            <div className="text-sm font-mono font-semibold text-slate-900">{submission.id}</div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start sm:self-auto">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>sheild_dataset • Stored</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Respondent Name
            </span>
            <p className="font-semibold text-slate-800 text-sm">{submission.name}</p>
            {submission.email && <p className="text-slate-600 font-mono">{submission.email}</p>}
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Recording Metrics
            </span>
            <p className="font-semibold text-slate-800 text-sm">
              Duration: {formatTime(submission.duration)} ({submission.duration}s)
            </p>
            <p className="text-slate-600 font-mono">
              Size: {formatBytes(submission.fileSize)} • {submission.mimeType.split(';')[0]}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
          <div className="font-mono truncate max-w-[280px]" title={submission.fileName}>
            <span className="text-slate-500">File:</span> {submission.fileName}
          </div>
          <span className="text-slate-400 font-mono">
            {new Date(submission.submittedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Audio Player for submitted clip */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-blue-600" />
            Playback Submitted Recording
          </label>
          <audio
            controls
            src={submission.fileUrl}
            className="w-full h-10 rounded-lg outline-none"
            preload="metadata"
          />
        </div>
      </div>

      {/* Trust & Verification note */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Audio stream verified for quality and recorded with timestamped metadata.</span>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <a
          href={submission.fileUrl}
          download={submission.fileName}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download Audio Copy
        </a>

        <button
          type="button"
          id="submit-another-btn"
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow transition hover:scale-105 active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Submit Another Response
        </button>
      </div>
    </div>
  );
};
