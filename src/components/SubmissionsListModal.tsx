import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Trash2,
  Download,
  RefreshCw,
  FileAudio,
  Loader2,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { SubmissionRecord } from '../types';
import { formatBytes, formatTime } from '../utils/audioHelpers';
import { AdminLogin } from './AdminLogin';

interface SubmissionsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminId: string | null;
  isAdminAuthLoading: boolean;
  onAdminLogin: (adminId: string) => void;
  onAdminLogout: () => void;
  onShowToast: (type: 'error' | 'success' | 'warning' | 'info', title: string, message: string) => void;
}

export const SubmissionsListModal: React.FC<SubmissionsListModalProps> = ({
  isOpen,
  onClose,
  adminId,
  isAdminAuthLoading,
  onAdminLogin,
  onAdminLogout,
  onShowToast,
}) => {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/submissions');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
      onShowToast('error', 'Load Error', 'Could not retrieve collected recordings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSubmissions();
    } else {
      if (audioElement) {
        audioElement.pause();
        setCurrentlyPlayingId(null);
      }
    }
  }, [isOpen]);

  const handleTogglePlay = (submission: SubmissionRecord) => {
    if (currentlyPlayingId === submission.id) {
      if (audioElement) {
        audioElement.pause();
      }
      setCurrentlyPlayingId(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(submission.fileUrl);
      audio.onended = () => setCurrentlyPlayingId(null);
      audio
        .play()
        .then(() => {
          setAudioElement(audio);
          setCurrentlyPlayingId(submission.id);
        })
        .catch((e) => {
          console.error('Play error:', e);
          onShowToast('error', 'Playback Error', 'Failed to play audio sample.');
        });
    }
  };

  const handleDownload = async (submission: SubmissionRecord) => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      onShowToast('warning', 'Admin Login Required', 'Please sign in as admin to download files.');
      return;
    }

    try {
      const res = await fetch(`/api/submissions/${submission.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = submission.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      onShowToast('error', 'Download Failed', err.message || 'Could not download file.');
    }
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      onShowToast('warning', 'Admin Login Required', 'Please sign in as admin to delete submissions.');
      return;
    }

    if (!confirm('Are you sure you want to remove this submission record?')) return;

    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        if (currentlyPlayingId === id && audioElement) {
          audioElement.pause();
          setCurrentlyPlayingId(null);
        }
        onShowToast('info', 'Deleted', 'Submission record removed.');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed.');
      }
    } catch (e: any) {
      onShowToast('error', 'Delete Failed', e.message || 'Failed to remove submission.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-blue-600" />
              Submissions Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and manage respondent audio recordings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSubmissions}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin Login / Status Panel */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/70 border-b border-slate-200 text-xs">
          {isAdminAuthLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking admin session...</span>
            </div>
          ) : adminId ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-900">
                  Admin: <span className="font-mono">{adminId}</span>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-700">Download & delete access enabled</span>
              </div>
              <button
                onClick={onAdminLogout}
                className="px-3 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition font-semibold cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-slate-600">
                <Lock className="w-4 h-4 text-slate-500" />
                <span>Sign in as admin to download and delete submissions.</span>
              </div>
            </div>
          )}
        </div>

        {/* Admin Login Form (if not logged in) */}
        {!adminId && !isAdminAuthLoading && (
          <AdminLogin onLogin={onAdminLogin} onShowToast={onShowToast} />
        )}

        {/* Stats counter bar */}
        {adminId && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>{submissions.length} Total Submissions</span>
          </div>
        )}

        {/* Content list */}
        {adminId && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {isLoading && submissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                Loading voice recordings...
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm space-y-1">
                <FileAudio className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <p className="font-medium text-slate-600">No voice samples yet</p>
                <p className="text-xs text-slate-400">Respondent recordings will appear here when submitted.</p>
              </div>
            ) : (
              submissions.map((sub) => {
                const isPlaying = currentlyPlayingId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-xs transition space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{sub.name}</span>
                          {sub.email && (
                            <>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs font-mono text-slate-600">{sub.email}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 truncate max-w-sm sm:max-w-md">
                          {sub.fileName}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Playback Button */}
                        <button
                          onClick={() => handleTogglePlay(sub)}
                          className={`p-2 rounded-lg transition cursor-pointer ${
                            isPlaying
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title={isPlaying ? 'Pause sample' : 'Play sample'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>

                        {/* Download Button (admin only) */}
                        <button
                          onClick={() => handleDownload(sub)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                          title="Download audio file (admin)"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Delete record (admin only) */}
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete record (admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2 font-mono">
                        <span>Duration: {formatTime(sub.duration)}</span>
                        <span>•</span>
                        <span>Size: {formatBytes(sub.fileSize)}</span>
                      </div>
                      <span>
                        {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-slate-400" />
            <span>Voice Sample Dataset</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
