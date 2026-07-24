'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  meetingTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  meetingTitle,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  const { t, dir, language } = useLanguage();

  if (!isOpen) return null;

  const isHebrew = language === 'he';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-2xl mx-auto">
          🗑
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {isHebrew ? 'האם אתה בטוח שברצונך למחוק פגישה זו?' : 'Are you sure you want to delete this appointment?'}
          </h3>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 truncate">
            &quot;{meetingTitle}&quot;
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isHebrew ? 'פעולה זו אינה ניתנת לבטול. כל המידע והזמינויות יימחקו.' : 'This action cannot be undone. All participant availability will be removed.'}
          </p>
        </div>

        {/* Action Buttons: Yes (Green) and No (Red) */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          {/* Yes Button (Green) */}
          <button
            onClick={onConfirm}
            className="py-3 px-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            ✓ {isHebrew ? 'כן' : 'Yes'}
          </button>

          {/* No Button (Red) */}
          <button
            onClick={onCancel}
            className="py-3 px-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 transition-all active:scale-95"
          >
            ✕ {isHebrew ? 'לא' : 'No'}
          </button>
        </div>
      </div>
    </div>
  );
}
