import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-3 pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          error: <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
          success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />,
        };

        const bgStyles = {
          error: 'bg-red-50 border-red-200 text-red-900',
          warning: 'bg-amber-50 border-amber-200 text-amber-900',
          success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          info: 'bg-blue-50 border-blue-200 text-blue-900',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all animate-slideUp ${bgStyles[toast.type]}`}
            role="alert"
          >
            {icons[toast.type]}
            <div className="flex-1 text-xs">
              <p className="font-semibold text-sm mb-0.5">{toast.title}</p>
              <p className="leading-relaxed opacity-90">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-md opacity-60 hover:opacity-100 transition shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
