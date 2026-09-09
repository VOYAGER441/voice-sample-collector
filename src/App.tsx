import React, { useState, useEffect } from 'react';
import {
  Mic,
  Send,
  Loader2,
  CheckCircle2,
  FolderArchive,
  Info,
  Sparkles,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { RespondentForm, AudioRecording, SubmissionRecord, ToastMessage } from './types';
import { RespondentFormComponent } from './components/RespondentForm';
import { AudioRecorder } from './components/AudioRecorder';
import { ReferenceVideoGuide } from './components/ReferenceVideoGuide';
import { SubmissionSuccess } from './components/SubmissionSuccess';
import { ToastContainer } from './components/ToastContainer';
import { SubmissionsListModal } from './components/SubmissionsListModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { formatTime } from './utils/audioHelpers';
import { initAuth, signInWithGoogle, signOut } from './utils/auth';
import { DEFAULT_DRIVE_FOLDER_NAME } from './utils/drive';

export default function App() {
  const [form, setForm] = useState<RespondentForm>({ name: '', email: '' });
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<SubmissionRecord | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [totalSubmissionsCount, setTotalSubmissionsCount] = useState<number>(0);

  // Admin Google Auth state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Fetch count of submissions for badge
  const refreshSubmissionCount = async () => {
    try {
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const data = await res.json();
        setTotalSubmissionsCount(data.submissions?.length || 0);
      }
    } catch {
      // Non-critical
    }
  };

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth((currentUser, token) => {
      setUser(currentUser);
      setAccessToken(token);
    });
    refreshSubmissionCount();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Toast Notification helper
  const addToast = (type: 'error' | 'success' | 'warning' | 'info', title: string, message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast: ToastMessage = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Google Sign-In & Sign-Out handlers for Admin
  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const result = await signInWithGoogle();
      setUser(result.user);
      setAccessToken(result.accessToken);
      addToast(
        'success',
        'Google Drive Connected',
        `Admin connected: ${result.user.displayName || result.user.email}. Samples will sync to "${DEFAULT_DRIVE_FOLDER_NAME}".`
      );
    } catch (err: any) {
      console.error('Sign-in error:', err);
      addToast('error', 'Google Sign-In Error', err.message || 'Failed to sign in with Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setAccessToken(null);
      addToast('info', 'Signed Out', 'Admin disconnected from Google Drive.');
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  // Validation rules
  const isNameValid = form.name.trim().length >= 2;
  const isDurationValid = Boolean(recording && recording.duration >= 5.0);
  const isReadyToSubmit = isNameValid && isDurationValid && !isSubmitting;

  // Handle Form Submission (No respondent login required)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReadyToSubmit || !recording) {
      if (!isNameValid) {
        addToast('error', 'Name Required', 'Please provide your Full Name.');
      } else if (!recording) {
        addToast('error', 'No Audio Recorded', 'Please record your 1-minute voice sample before submitting.');
      } else if (!isDurationValid) {
        addToast('error', 'Sample Too Short', 'Voice sample must be at least 5 seconds long.');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('duration', recording.duration.toString());
      formData.append('mimeType', recording.mimeType);
      formData.append('audio', recording.blob, recording.fileName);

      const headers: Record<string, string> = {};
      if (
        accessToken &&
        typeof accessToken === 'string' &&
        accessToken.length > 10 &&
        accessToken !== 'null' &&
        accessToken !== 'undefined'
      ) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      let responseText = '';
      try {
        responseText = await response.text();
      } catch (readErr) {
        console.warn('Could not read response stream as text:', readErr);
      }

      let data: any = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          console.warn('Response was not valid JSON:', responseText.substring(0, 150), jsonErr);
        }
      }

      if (!response.ok) {
        const serverErrorMsg =
          data?.error ||
          (responseText && !responseText.startsWith('<') ? responseText.slice(0, 150) : null);
        throw new Error(
          serverErrorMsg ||
            `Upload failed (Status ${response.status}: ${response.statusText || 'Server Error'}). Please try again.`
        );
      }

      const submissionRecord = data?.submission || (data?.id && data?.fileName ? data : null);

      if (!submissionRecord) {
        console.error('Unexpected server response format:', {
          status: response.status,
          contentType: response.headers.get('content-type'),
          body: responseText.slice(0, 300),
        });
        const customMsg =
          data?.error ||
          data?.message ||
          (responseText && !responseText.startsWith('<') ? responseText.slice(0, 100) : null);
        throw new Error(
          customMsg || 'Upload completed, but the server returned an incomplete submission record.'
        );
      }

      setSubmissionSuccess(submissionRecord);
      setTotalSubmissionsCount((prev) => prev + 1);

      addToast(
        'success',
        'Voice Sample Submitted!',
        'Thank you! Your recording has been securely saved.'
      );
    } catch (err: any) {
      console.error('Submission failed:', err);
      addToast('error', 'Submission Failed', err.message || 'An error occurred while uploading. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset entire form for next respondent
  const handleResetForAnother = () => {
    if (recording?.url) {
      URL.revokeObjectURL(recording.url);
    }
    setForm({ name: '', email: '' });
    setRecording(null);
    setSubmissionSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight flex items-center gap-2">
                Voice Sample Collector
                <span className="hidden sm:inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  1-Minute Max
                </span>
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                High-fidelity voice data collection for research & training
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Google Drive Connection Pill (if admin is signed in) */}
            {user && (
              <GoogleSignInButton
                user={user}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                isLoading={isAuthLoading}
              />
            )}

            {/* Submissions Log / Admin Panel Button */}
            <button
              type="button"
              id="view-submissions-nav-btn"
              onClick={() => setIsSubmissionsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-2xs transition cursor-pointer"
              title="Admin Panel & Submissions Log"
            >
              <FolderArchive className="w-4 h-4 text-blue-600" />
              <span>Submissions Log</span>
              {totalSubmissionsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-700 font-bold">
                  {totalSubmissionsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-10 flex flex-col justify-center">
        {submissionSuccess ? (
          <SubmissionSuccess
            submission={submissionSuccess}
            onReset={handleResetForAnother}
          />
        ) : (
          <>
            {/* Reference Video & Audio Cadence Instructions */}
            <ReferenceVideoGuide />

            {/* Main Survey Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Survey Guidance Bar */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>VOICE SAMPLE TASK: "SHEILD ACTIVATE"</span>
                </div>
                <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                  The voice sample is <strong className="font-mono text-blue-900 bg-blue-100/60 px-1 rounded">"sheild activate"</strong> with a <strong>1-second time window</strong> and <strong>0.5-second pause</strong>, then again say <strong className="font-mono text-blue-900 bg-blue-100/60 px-1 rounded">"sheild activate"</strong>.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
                {/* Section 1: Respondent Context */}
                <section className="space-y-4">
                  <RespondentFormComponent
                    form={form}
                    onChange={setForm}
                    disabled={isSubmitting}
                  />
                </section>

                <hr className="border-slate-100" />

                {/* Section 2: Audio Recording Interface */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 tracking-wide">
                      Voice Sample Recording
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: exactly 01:00
                    </span>
                  </div>

                  <AudioRecorder
                    respondentName={form.name}
                    onRecordingComplete={setRecording}
                    onShowToast={addToast}
                    disabled={isSubmitting}
                  />
                </section>

                <hr className="border-slate-100" />

                {/* Section 3: Validation Checklist & Submit */}
                <section className="space-y-4 pt-1">
                  {/* Visual Checklist */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      Submission Requirements
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        {isNameValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                        )}
                        <span className={isNameValid ? 'text-slate-900 font-medium' : ''}>
                          Full Name Provided
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isDurationValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                        )}
                        <span className={isDurationValid ? 'text-slate-900 font-medium' : ''}>
                          {recording
                            ? `Audio Sample (>= 5s): ${formatTime(recording.duration)}`
                            : 'Audio Sample (>= 5s)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button (Direct & Frictionless) */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      id="submit-voice-sample-btn"
                      disabled={!isReadyToSubmit}
                      className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-semibold shadow-md transition-all ${
                        isReadyToSubmit
                          ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/60'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Submitting Voice Sample...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Voice Sample</span>
                        </>
                      )}
                    </button>

                    {!isReadyToSubmit && (
                      <p className="text-[11px] text-center text-slate-400 mt-2">
                        {!isNameValid
                          ? 'Please enter your full name above to enable submission.'
                          : !recording
                          ? 'Record your voice sample above to enable submission.'
                          : !isDurationValid
                          ? 'Your voice sample is under 5 seconds. Please record at least 5 seconds.'
                          : ''}
                      </p>
                    )}
                  </div>
                </section>
              </form>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Voice Sample Survey • 1-Minute Audio Collector</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span>Dataset: <strong>{DEFAULT_DRIVE_FOLDER_NAME}</strong></span>
          </div>
        </div>
      </footer>

      {/* Submissions Modal (Admin & Review) */}
      <SubmissionsListModal
        isOpen={isSubmissionsModalOpen}
        onClose={() => {
          setIsSubmissionsModalOpen(false);
          refreshSubmissionCount();
        }}
        user={user}
        accessToken={accessToken}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isAuthLoading={isAuthLoading}
        onShowToast={addToast}
      />
    </div>
  );
}
