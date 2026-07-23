'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { AvailabilitySlot, MeetingParticipant, Profile } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { getWeekDates } from '@/lib/timezone';
import { TimezoneSelector } from './TimezoneSelector';

export interface ParticipantWithDetails extends MeetingParticipant {
  profile?: Profile;
  availability?: AvailabilitySlot[];
}

interface MeetingHeatmapProps {
  participants: ParticipantWithDetails[];
  selectedDate?: Date;
}

const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const displayString = `${hours > 12 ? hours - 12 : hours}:${minutes === 0 ? '00' : minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
  return { timeString, displayString, totalMinutes, hours, minutes };
});

export function MeetingHeatmap({ participants, selectedDate = new Date() }: MeetingHeatmapProps) {
  const { t, dir } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);
  const [timezone, setTimezone] = useState('');

  useEffect(() => {
    if (!selectedDate) return;
    const now = new Date();
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay());
    currentSunday.setHours(0, 0, 0, 0);

    const selectedSunday = new Date(selectedDate);
    selectedSunday.setDate(selectedDate.getDate() - selectedDate.getDay());
    selectedSunday.setHours(0, 0, 0, 0);

    const diffDays = Math.round((selectedSunday.getTime() - currentSunday.getTime()) / (1000 * 60 * 60 * 24));
    const calculatedOffset = Math.round(diffDays / 7);

    setWeekOffset(calculatedOffset);
  }, [selectedDate]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const today = new Date();

  const daysConfig = useMemo(() => [
    { key: 0, label: t('days.sun'), short: t('days.shortSun'), date: weekDates[0], isDisabled: false },
    { key: 1, label: t('days.mon'), short: t('days.shortMon'), date: weekDates[1], isDisabled: false },
    { key: 2, label: t('days.tue'), short: t('days.shortTue'), date: weekDates[2], isDisabled: false },
    { key: 3, label: t('days.wed'), short: t('days.shortWed'), date: weekDates[3], isDisabled: false },
    { key: 4, label: t('days.thu'), short: t('days.shortThu'), date: weekDates[4], isDisabled: false },
    { key: 5, label: t('days.fri'), short: t('days.shortFri'), date: weekDates[5], isDisabled: true },
    { key: 6, label: t('days.sat'), short: t('days.shortSat'), date: weekDates[6], isDisabled: true },
  ], [t, weekDates]);

  const requiredParticipants = useMemo(() => {
    return participants.filter((p) => p.is_required);
  }, [participants]);

  const slotDataMap = useMemo(() => {
    const map: Record<string, { matchPct: number; availableCount: number; totalRequired: number }> = {};
    const totalRequired = requiredParticipants.length;

    daysConfig.forEach((day) => {
      if (day.isDisabled) return;

      TIME_SLOTS.forEach((slot) => {
        const slotKey = `${day.key}-${slot.timeString}`;

        if (totalRequired === 0) {
          map[slotKey] = { matchPct: 0, availableCount: 0, totalRequired: 0 };
          return;
        }

        const availableCount = requiredParticipants.filter((participant) => {
          if (!participant.availability || participant.availability.length === 0) return false;
          return participant.availability.some((av) => {
            const start = new Date(av.start_time);
            const end = new Date(av.end_time);

            if (start.getDay() !== day.key) return false;

            const startMinutes = start.getHours() * 60 + start.getMinutes();
            const endMinutes = end.getHours() * 60 + end.getMinutes();

            return slot.totalMinutes >= startMinutes && slot.totalMinutes + 30 <= endMinutes;
          });
        }).length;

        const matchPct = (availableCount / totalRequired) * 100;
        map[slotKey] = { matchPct, availableCount, totalRequired };
      });
    });

    return map;
  }, [requiredParticipants, daysConfig]);

  const isTodayDate = (d: Date) => {
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelectedDate = (d: Date) => {
    if (!selectedDate) return false;
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  const getSlotColorClass = (matchPct: number, totalRequired: number) => {
    if (totalRequired === 0) return 'bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-600';
    if (matchPct >= 90) return 'bg-emerald-500 dark:bg-emerald-600/90 border-emerald-400 text-white font-bold shadow-md shadow-emerald-500/20';
    if (matchPct >= 80) return 'bg-amber-500 dark:bg-amber-600/90 border-amber-400 text-white font-bold shadow-md shadow-amber-500/20';
    return 'bg-rose-100 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400/60 hover:bg-rose-200 dark:hover:bg-rose-900/40';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl dark:shadow-2xl space-y-5 transition-colors" dir={dir}>
      {/* Top Controls & Timezone Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-0.5">
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('heatmap.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('heatmap.subtitle')} ({requiredParticipants.length})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TimezoneSelector value={timezone} onChange={setTimezone} />

          {/* Week Navigation Pills */}
          <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 text-xs">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {t('week.prev')}
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                weekOffset === 0 ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('week.current')}
            </button>
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {t('week.next')}
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-end gap-4 text-xs bg-slate-50 dark:bg-slate-950/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">{t('heatmap.match90')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">{t('heatmap.match80')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-200 dark:bg-rose-950 border border-rose-400 dark:border-rose-800 inline-block"></span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">{t('heatmap.matchLess80')}</span>
        </div>
      </div>

      {/* Google Calendar Style Weekly Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Header Row: Days & Date Number */}
          <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 pb-3 mb-2">
            {/* Left Timezone Label Column */}
            <div className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center">
              GMT+03
            </div>

            {/* 7 Day Columns */}
            {daysConfig.map((day) => {
              const isToday = isTodayDate(day.date);
              const isSelected = isSelectedDate(day.date);
              const dayNumber = day.date.getDate();

              return (
                <div
                  key={day.key}
                  className={`flex flex-col items-center justify-center text-center p-1.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-600/20 border border-blue-300 dark:border-blue-500/50 shadow-md ring-2 ring-blue-500'
                      : ''
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'text-blue-700 dark:text-blue-300'
                        : isToday
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {day.short}
                  </span>

                  <div
                    className={`mt-1 text-base font-extrabold font-mono transition-all ${
                      isToday
                        ? 'w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 ring-2 ring-blue-400'
                        : isSelected
                        ? 'w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/30 text-blue-900 dark:text-blue-200 flex items-center justify-center border border-blue-400 font-bold'
                        : day.isDisabled
                        ? 'text-slate-300 dark:text-slate-600 line-through'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {dayNumber}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Slot Grid Rows */}
          <div className="space-y-1">
            {TIME_SLOTS.map((slot) => (
              <div key={slot.timeString} className="grid grid-cols-8 items-center border-b border-slate-100 dark:border-slate-800/40 py-0.5">
                {/* Time Label Column */}
                <div className={`text-xs font-mono text-slate-400 dark:text-slate-400 ${dir === 'rtl' ? 'text-left pl-2' : 'text-right pr-2'} select-none`}>
                  {slot.minutes === 0 ? slot.displayString : ''}
                </div>

                {/* Day Slot Cells */}
                {daysConfig.map((day) => {
                  const isSelectedDay = isSelectedDate(day.date);

                  if (day.isDisabled) {
                    return (
                      <div
                        key={`${day.key}-${slot.timeString}`}
                        className={`h-9 mx-1 rounded bg-slate-50 dark:bg-slate-950/60 border opacity-40 select-none flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-700 ${
                          isSelectedDay ? 'border-blue-400 dark:border-blue-500/40' : 'border-slate-200 dark:border-slate-900'
                        }`}
                      >
                        —
                      </div>
                    );
                  }

                  const slotKey = `${day.key}-${slot.timeString}`;
                  const data = slotDataMap[slotKey] || { matchPct: 0, availableCount: 0, totalRequired: 0 };
                  const colorClass = getSlotColorClass(data.matchPct, data.totalRequired);

                  return (
                    <div
                      key={slotKey}
                      className={`h-9 mx-1 rounded-lg border transition-all flex flex-col items-center justify-center p-0.5 cursor-pointer hover:scale-[1.03] ${colorClass} ${
                        isSelectedDay ? 'ring-1 ring-blue-500' : ''
                      }`}
                      title={`${day.label} ${slot.displayString}: ${data.availableCount}/${data.totalRequired} Available (${Math.round(data.matchPct)}%)`}
                    >
                      <span className="text-xs font-bold leading-tight">
                        {data.totalRequired > 0 ? `${Math.round(data.matchPct)}%` : '—'}
                      </span>
                      {data.totalRequired > 0 && (
                        <span className="text-[10px] opacity-80 leading-none">
                          {data.availableCount}/{data.totalRequired}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
