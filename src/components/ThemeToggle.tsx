'use client';

import React from 'react';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();

  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: language === 'he' ? 'בהיר' : 'Light', icon: '☀️' },
    { value: 'dark', label: language === 'he' ? 'כהה' : 'Dark', icon: '🌙' },
    { value: 'system', label: language === 'he' ? 'מערכת' : 'System', icon: '💻' },
  ];

  return (
    <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 p-0.5 text-xs select-none transition-colors">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
            theme === opt.value
              ? 'bg-blue-600 text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/60'
          }`}
          title={opt.label}
        >
          <span>{opt.icon}</span>
          <span className="hidden sm:inline-block text-[11px]">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
