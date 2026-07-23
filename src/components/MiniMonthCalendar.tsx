'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface MiniMonthCalendarProps {
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
}

export function MiniMonthCalendar({
  selectedDate = new Date(),
  onSelectDate,
}: MiniMonthCalendarProps) {
  const { language } = useLanguage();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    year: 'numeric',
  }).format(viewDate);

  const dayLabels = language === 'he'
    ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();

  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => {
    const d = new Date(year, month, -firstDayOfMonth + i + 1);
    return { date: d, isCurrentMonth: false };
  });

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return { date: d, isCurrentMonth: true };
  });

  const totalCellsSoFar = prevMonthDays.length + currentMonthDays.length;
  const remainingCells = (42 - totalCellsSoFar) % 7 === 0 && totalCellsSoFar >= 35 ? 42 - totalCellsSoFar : 35 - totalCellsSoFar;

  const nextMonthDays = Array.from({ length: Math.max(0, remainingCells) }, (_, i) => {
    const d = new Date(year, month + 1, i + 1);
    return { date: d, isCurrentMonth: false };
  });

  const allCells = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  const changeMonth = (delta: number) => {
    setViewDate(new Date(year, month + delta, 1));
  };

  const isToday = (d: Date) => {
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  return (
    <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 select-none transition-colors">
      {/* Month Header & Arrows */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 capitalize">
          {monthName}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMonth(-1)}
            className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Days Labels Row */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
        {dayLabels.map((lbl, idx) => (
          <div key={idx} className="py-1">
            {lbl}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono">
        {allCells.map((cell, idx) => {
          const itIsToday = isToday(cell.date);
          const itIsSelected = isSelected(cell.date);

          return (
            <button
              key={idx}
              onClick={() => onSelectDate && onSelectDate(cell.date)}
              className={`h-7 w-7 mx-auto rounded-full flex items-center justify-center text-xs transition-all ${
                itIsToday
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/40 ring-2 ring-blue-400'
                  : itIsSelected
                  ? 'bg-blue-100 dark:bg-indigo-900/80 border border-blue-400 dark:border-indigo-500 text-blue-900 dark:text-indigo-200 font-bold'
                  : cell.isCurrentMonth
                  ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
