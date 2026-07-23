'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
      title="Switch Language / החלף שפה"
    >
      <span className="text-slate-400 font-mono text-[10px]">🌐</span>
      <span>{language === 'en' ? 'עברית 🇮🇱' : 'English 🇺🇸'}</span>
    </button>
  );
}
