import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  Play,
  Pause,
  Trash2,
  Download,
  RefreshCw,
  HardDrive,
  Cloud,
  FileAudio,
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { SubmissionRecord } from '../types';
import { formatBytes, formatTime } from '../utils/audioHelpers';
import { DEFAULT_DRIVE_FOLDER_ID, DEFAULT_DRIVE_FOLDER_NAME } from '../utils/drive';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SubmissionsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  accessToken: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isAuthLoading?: boolean;
  onShowToast: (type: 'error' | 'success' | 'warning' | 'info', title: string, message: string) => void;
}

export const SubmissionsListModal: React.FC<SubmissionsListModalProps> = ({
  isOpen,
  onClose,
  user,
  accessToken,
  onSignIn,
  onSignOut,
  isAuthLoading = false,
  onShowToast,
}) => {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const folderUrl = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this submission record?')) return;
    try {
      const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        if (currentlyPlayingId === id && audioElement) {
          audioElement.pause();
          setCurrentlyPlayingId(null);
        }
        onShowToast('info', 'Deleted', 'Submission record removed.');
      }
    } catch (e) {
      onShowToast('error', 'Delete Failed', 'Failed to remove submission.');
    }
  };

  const handleSyncToDrive = async (submission: SubmissionRecord) => {
    if (!accessToken) {
      onShowToast('info', 'Admin Sign-In Required', 'Please sign in with your Google account above to sync samples into Drive.');
      onSignIn();
      return;
    }

    setSyncingId(submission.id);
    try {
      const res = await fetch(`/api/drive/sync/${submission.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload to Google Drive.');
      }

      setSubmissions((prev) =>
        prev.map((s) => (s.id === submission.id ? { ...s, ...data.submission } : s))
      );
      onShowToast(
        'success',
        'Synced to Drive',
        `"${submission.fileName}" uploaded to your sheild_dataset folder.`
      );
    } catch (err: any) {
      console.error('Sync error:', err);
      onShowToast('error', 'Sync Failed', err.message || 'Google Drive sync failed.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!accessToken) {
      onShowToast('info', 'Admin Sign-In Required', 'Please sign in with Google to sync all recordings.');
      onSignIn();
      return;
    }

    setIsSyncingAll(true);
    try {
      const res = await fetch('/api/drive/sync-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync to Google Drive.');
      }

      if (data.submissions) {
        setSubmissions(data.submissions);
      }
      onShowToast(
        'success',
        'Batch Sync Complete',
        `Successfully transferred ${data.syncedCount} audio file(s) into your sheild_dataset Google Drive folder!`
      );
    } catch (err: any) {
      console.error('Sync-all error:', err);
      onShowToast('error', 'Sync Error', err.message || 'Failed to sync all recordings.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (!isOpen) return null;

  const pendingCount = submissions.filter((s) => !s.driveFileId && s.driveStatus !== 'uploaded').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-blue-600" />
              Submissions & Dataset Manager
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review respondent audio recordings and sync into Google Drive (<strong>{DEFAULT_DRIVE_FOLDER_NAME}</strong>).
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

        {/* Admin Google Drive Sync Panel */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/70 border-b border-slate-200 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Admin Drive Sync:</span>
                <span className="font-mono text-blue-800 bg-blue-100/70 px-1.5 py-0.5 rounded">
                  {DEFAULT_DRIVE_FOLDER_NAME}
                </span>
                <a
                  href={folderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  title="Open folder in Google Drive"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-slate-600 text-[11px]">
                {user
                  ? `Signed in as admin (${user.displayName || user.email}). You can sync respondent files with one click.`
                  : 'Respondents submit without login. Sign in with your Google account here to sync files into your Drive.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {!user ? (
                <GoogleSignInButton
                  user={user}
                  onSignIn={onSignIn}
                  onSignOut={onSignOut}
                  isLoading={isAuthLoading}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <GoogleSignInButton
                    user={user}
                    onSignIn={onSignIn}
                    onSignOut={onSignOut}
                    isLoading={isAuthLoading}
                  />
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncAll}
                      disabled={isSyncingAll}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition disabled:opacity-60 cursor-pointer"
                      title="Sync all unsynced recordings to Google Drive"
                    >
                      {isSyncingAll ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>Sync All to Drive ({pendingCount})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats counter bar */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>{submissions.length} Total Submissions Collected</span>
          <div className="flex items-center gap-3">
            <span className="text-emerald-700 font-semibold">
              ● {submissions.length - pendingCount} in Google Drive
            </span>
            <span className="text-amber-700 font-semibold">
              ● {pendingCount} Pending Sync
            </span>
          </div>
        </div>

        {/* Content list */}
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
              <p className="text-xs text-slate-400">Respondent recordings will appear here automatically when submitted.</p>
            </div>
          ) : (
            submissions.map((sub) => {
              const isPlaying = currentlyPlayingId === sub.id;
              const isSynced = sub.driveStatus === 'uploaded' || Boolean(sub.driveFileId);
              const driveFileUrl = sub.driveWebViewLink || (sub.driveFileId ? `https://drive.google.com/file/d/${sub.driveFileId}/view` : folderUrl);

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
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Google Drive: sheild_dataset
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Stored on Server (Pending Sync)
                          </span>
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

                      {/* Download Button */}
                      <a
                        href={sub.fileUrl}
                        download={sub.fileName}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                        title="Download audio file"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      {/* Google Drive Link or Sync Button */}
                      {isSynced ? (
                        <a
                          href={driveFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition flex items-center gap-1 text-xs font-medium"
                          title="Open file in Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSyncToDrive(sub)}
                          disabled={syncingId === sub.id}
                          className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                          title="Sync to Google Drive sheild_dataset"
                        >
                          {syncingId === sub.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                          ) : (
                            <UploadCloud className="w-4 h-4 text-amber-700" />
                          )}
                        </button>
                      )}

                      {/* Delete record */}
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete record"
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Target Folder: <strong>{DEFAULT_DRIVE_FOLDER_NAME}</strong> ({DEFAULT_DRIVE_FOLDER_ID})</span>
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
