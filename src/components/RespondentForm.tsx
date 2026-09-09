import React from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import { RespondentForm } from '../types';

interface RespondentFormProps {
  form: RespondentForm;
  onChange: (form: RespondentForm) => void;
  disabled?: boolean;
}

export const RespondentFormComponent: React.FC<RespondentFormProps> = ({
  form,
  onChange,
  disabled = false,
}) => {
  const isNameValid = form.name.trim().length >= 2;

  const handleChange = (field: keyof RespondentForm, value: string) => {
    onChange({
      ...form,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-sm font-semibold text-slate-900 tracking-wide">
          Respondent Information
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          Required *
        </span>
      </div>

      <div>
        {/* Name Field */}
        <div className="space-y-1.5">
          <label htmlFor="respondent-name" className="block text-xs font-semibold text-slate-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="respondent-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={disabled}
              placeholder="Enter your full name (e.g. Jane Doe)"
              required
              className={`block w-full pl-10 pr-9 py-2.5 text-sm bg-white rounded-xl border transition shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                isNameValid
                  ? 'border-emerald-300 focus:border-emerald-500'
                  : form.name.length > 0
                  ? 'border-amber-300 focus:border-amber-500'
                  : 'border-slate-300 focus:border-blue-500'
              } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-75' : ''}`}
            />
            {isNameValid && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Used to label and uniquely identify your voice sample.</p>
        </div>
      </div>
    </div>
  );
};

