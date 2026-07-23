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

// 7:00 AM to 10:00 PM (30 slots of 30 minutes each)
const TIME_SLOTS = Array.from({ length: 30 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayString = `${displayHours}:${minutes === 0 ? '00' : minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
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
  const now = new Date();

  const isPastSlot = (dayDate: Date, totalMinutes: number) => {
    const slotDate = new Date(dayDate);
    slotDate.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return slotDate.getTime() < now.getTime();
  };

  const daysConfig = useMemo(() => [
    { key: 0, label: t('days.sun'), short: t('days.shortSun'), date: weekDates[0], isDisabled: false },
    { key: 1, label: t('days.mon'), short: t('days.shortMon'), date: weekDates[1], isDisabled: false },
    { key: 2, label: t('days.tue'), short: t('days.shortTue'), date: weekDates[2], isDisabled: false },
    { key: 3, label: t('days.wed'), short: t('days.shortWed'), date: weekDates[3], isDisabled: false },
    { key: 4, label: t('days.thu'), short: t('days.shortThu'), date: weekDates[4], isDisabled: false },
    { key: 5, label: t('days.fri'), short: t('days.shortFri'), date: weekDates[5], isDisabled: false },
    { key: 6, label: t('days.sat'), short: t('days.shortSat'), date: weekDates[6], isDisabled: false },
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
  }, [daysConfig, requiredParticipants]);

  const getHeatmapColor = (matchPct: number) => {
    if (matchPct === 0) return 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400';
    if (matchPct < 50) return 'bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-300 font-semibold';
    if (matchPct < 100) return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold';
    return 'bg-emerald-500 border-emerald-400 text-white font-bold shadow-md shadow-emerald-500/30';
  };

  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl dark:shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 transition-colors" dir={dir}>
      {/* Top Bar Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('heatmap.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('heatmap.subtitle')} ({requiredParticipants.length} {t('heatmap.requiredCount')})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <TimezoneSelector value={timezone} onChange={setTimezone} />

          {/* Week Navigation Controls */}
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

      {/* Legend & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
            {t('heatmap.legendLabel')}:
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-slate-700 dark:text-slate-300">{t('heatmap.legend100')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40" />
            <span className="text-slate-700 dark:text-slate-300">{t('heatmap.legendPartial')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-500/10 border border-rose-500/30" />
            <span className="text-slate-700 dark:text-slate-300">{t('heatmap.legendNone')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 opacity-50" />
            <span className="text-slate-400 dark:text-slate-500">Past</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Days Header */}
          <div className="grid grid-cols-8 gap-2 mb-2">
            <div className="text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center">
              {t('heatmap.timeCol')}
            </div>
            {daysConfig.map((day) => {
              const isSelected = isSelectedDate(day.date);
              const isToday =
                day.date.getDate() === now.getDate() &&
                day.date.getMonth() === now.getMonth() &&
                day.date.getFullYear() === now.getFullYear();
              const dayNumber = day.date.getDate();

              return (
                <div
                  key={day.key}
                  className={`py-2 px-3 rounded-xl text-center font-mono transition-all flex flex-col items-center justify-center border ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-400 dark:border-blue-500/60 shadow-md ring-2 ring-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
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
                  const isPast = isPastSlot(day.date, slot.totalMinutes);

                  if (day.isDisabled || isPast) {
                    return (
                      <div
                        key={`${day.key}-${slot.timeString}`}
                        className={`h-9 mx-1 rounded bg-slate-100 dark:bg-slate-950/80 border opacity-40 select-none flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-600 font-mono cursor-not-allowed ${
                          isSelectedDay ? 'border-blue-400 dark:border-blue-500/40' : 'border-slate-200 dark:border-slate-900'
                        }`}
                        title="Past time slot"
                      >
                        —
                      </div>
                    );
                  }

                  const slotKey = `${day.key}-${slot.timeString}`;
                  const data = slotDataMap[slotKey] || { matchPct: 0, availableCount: 0, totalRequired: 0 };
                  const colorClasses = getHeatmapColor(data.matchPct);

                  return (
                    <div
                      key={slotKey}
                      className={`h-9 mx-1 rounded border transition-all flex flex-col items-center justify-center font-mono text-[10px] cursor-pointer ${colorClasses} ${
                        isSelectedDay ? 'ring-1 ring-blue-500/50 shadow-sm' : ''
                      }`}
                      title={`${data.availableCount}/${data.totalRequired} required participants available (${Math.round(data.matchPct)}%)`}
                    >
                      <span>{Math.round(data.matchPct)}%</span>
                      <span className="text-[8px] opacity-80">{data.availableCount}/{data.totalRequired}</span>
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
