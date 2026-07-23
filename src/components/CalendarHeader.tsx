'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

interface CalendarHeaderProps {
  currentDate?: Date;
  onToday?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onCreateClick?: () => void;
}

export function CalendarHeader({
  currentDate = new Date(),
  onToday,
  onPrevWeek,
  onNextWeek,
  onCreateClick,
}: CalendarHeaderProps) {
  const { t, dir, language } = useLanguage();

  const monthYearString = new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate);

  const dayNumber = currentDate.getDate();

  return (
    <header
      dir={dir}
      className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 text-slate-900 dark:text-slate-100 shadow-sm select-none sticky top-0 z-40 transition-colors"
    >
      {/* Left / Start Section: Brand & Nav Controls */}
      <div className="flex items-center gap-4">
        {/* Menu & App Brand */}
        <Link href="/organizer" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-blue-500/20 border border-blue-400/40">
            {dayNumber}
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white hidden sm:inline-block">
            {t('nav.home') === 'Home' ? 'Calendar' : 'יומן פגישות'}
          </span>
        </Link>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

        {/* Today Button */}
        {onToday && (
          <button
            onClick={onToday}
            className="px-4 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          >
            {language === 'he' ? 'היום' : 'Today'}
          </button>
        )}

        {/* Navigation Arrows */}
        {(onPrevWeek || onNextWeek) && (
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevWeek}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-bold transition-colors"
              title={t('week.prev')}
            >
              {dir === 'rtl' ? '›' : '‹'}
            </button>
            <button
              onClick={onNextWeek}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-bold transition-colors"
              title={t('week.next')}
            >
              {dir === 'rtl' ? '‹' : '›'}
            </button>
          </div>
        )}

        {/* Month & Year Title */}
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
          {monthYearString}
        </h2>
      </div>

      {/* Right / End Section: Theme Toggle, View Switcher, Create & Language */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        {/* View Mode Selector */}
        <div className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 gap-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors">
          <span>{language === 'he' ? 'שבוע' : 'Week'}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">▼</span>
        </div>

        {/* Quick Create Action Button */}
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all transform hover:-translate-y-0.5"
          >
            <span>+</span>
            <span>{t('dashboard.createBtn')}</span>
          </button>
        )}

        <LanguageToggle />
      </div>
    </header>
  );
}
