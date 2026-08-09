'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { language, dir } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isHebrew = language === 'he';

  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'system', label: isHebrew ? 'מערכת (ברירת מחדל)' : 'System (Default)', icon: '💻' },
    { value: 'dark', label: isHebrew ? 'כהה' : 'Dark', icon: '🌙' },
    { value: 'light', label: isHebrew ? 'בהיר' : 'Light', icon: '☀️' },
  ];

  const currentOption = options.find((opt) => opt.value === theme) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} dir={dir}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <span className="text-sm">{currentOption.icon}</span>
        <span className="font-medium text-[11px]">{currentOption.label.split(' ')[0]}</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100`}>
          {options.map((opt) => {
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{opt.icon}</span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
