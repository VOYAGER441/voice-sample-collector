import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, CheckCircle2, ExternalLink, HardDrive } from 'lucide-react';
import { DEFAULT_DRIVE_FOLDER_ID, DEFAULT_DRIVE_FOLDER_NAME } from '../utils/drive';

interface GoogleSignInButtonProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isLoading?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  user,
  onSignIn,
  onSignOut,
  isLoading = false,
}) => {
  const folderUrl = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;

  if (user) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 text-xs text-emerald-900 shadow-2xs">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Google user'}
            className="w-6 h-6 rounded-full border border-emerald-300 shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}

        <div className="flex flex-col text-left leading-tight pr-1">
          <div className="flex items-center gap-1 font-semibold text-emerald-950">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[160px]">{user.displayName || user.email}</span>
          </div>
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-0.5"
            title={`Connected to ${DEFAULT_DRIVE_FOLDER_NAME}`}
          >
            <span>Drive: {DEFAULT_DRIVE_FOLDER_NAME}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-emerald-100/60 rounded-md transition ml-1"
          title="Sign out of Google"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      id="gsi-google-signin-btn"
      onClick={onSignIn}
      disabled={isLoading}
      className="relative inline-flex items-center justify-center gap-2.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl shadow-xs transition hover:border-slate-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      title="Connect Google Drive to upload recordings directly to your sheild_dataset folder"
    >
      {/* Official Google 'G' Icon */}
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
      <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
    </button>
  );
};
