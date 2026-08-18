'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { UserGuideModal } from './UserGuideModal';

interface CalendarHeaderProps {
  currentDate?: Date;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onToday?: () => void;
  onCreateClick?: () => void;
}

export function CalendarHeader({
  currentDate = new Date(),
  onPrevWeek,
  onNextWeek,
  onToday,
}: CalendarHeaderProps) {
  const { t, dir, language } = useLanguage();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const monthYearString = currentDate.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 md:px-6 flex items-center justify-between z-30 transition-colors" dir={dir}>
        {/* Left / Start Section: Brand & Nav */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/organizer" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              📅
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent leading-none">
                {t('brand.name')}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                {t('brand.subtitle')}
              </span>
            </div>
          </Link>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Date Navigation Controls */}
          <div className="flex items-center gap-1.5">
            {onToday && (
              <button
                onClick={onToday}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                {t('cal.today')}
              </button>
            )}

            {onPrevWeek && (
              <button
                onClick={onPrevWeek}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                title="Previous Week"
              >
                {dir === 'rtl' ? '▶' : '◀'}
              </button>
            )}

            {onNextWeek && (
              <button
                onClick={onNextWeek}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                title="Next Week"
              >
                {dir === 'rtl' ? '◀' : '▶'}
              </button>
            )}
          </div>

          {/* Current Month & Year Display */}
          <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
            {monthYearString}
          </h2>
        </div>

        {/* Right / End Section: Guide Button, Theme Toggle, View Switcher & Language */}
        <div className="flex items-center gap-2.5">
          {/* User Guide Button */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
            title={language === 'he' ? 'מדריך למשתמש' : 'User Guide'}
          >
            <span>📖</span>
            <span className="hidden sm:inline">{language === 'he' ? 'מדריך למשתמש' : 'User Guide'}</span>
          </button>

          <ThemeToggle />

          {/* View Mode Selector */}
          <div className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 gap-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors">
            <span>{language === 'he' ? 'שבוע' : 'Week'}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">▼</span>
          </div>

          <LanguageToggle />
        </div>
      </header>

      {/* Interactive In-App User Guide Modal */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </>
  );
}
