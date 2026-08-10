'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AvailabilitySlot, MeetingParticipant, Profile } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { getWeekDates } from '@/lib/timezone';
import { TimezoneSelector } from './TimezoneSelector';
import { SlotParticipantsModal, type SlotDetails } from './SlotParticipantsModal';

export interface ParticipantWithDetails extends MeetingParticipant {
  profile?: Profile;
  availability?: AvailabilitySlot[];
}

interface MeetingHeatmapProps {
  participants: ParticipantWithDetails[];
  selectedDate?: Date;
  meetingTitle?: string;
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

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function MeetingHeatmap({
  participants,
  selectedDate = new Date(),
  meetingTitle = '',
}: MeetingHeatmapProps) {
  const { t, dir, language } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);
  const [timezone, setTimezone] = useState('');
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<SlotDetails | null>(null);

  // Auto-detect week offset if participants submitted availability for future weeks
  useEffect(() => {
    if (!participants || participants.length === 0) return;
    for (const p of participants) {
      if (p.availability && p.availability.length > 0) {
        for (const av of p.availability) {
          let slotDate: Date | null = null;
          if (av.slot_key && av.slot_key.includes('_')) {
            const [datePart] = av.slot_key.split('_');
            const [y, m, d] = datePart.split('-');
            slotDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
          } else if (av.start_time) {
            slotDate = new Date(av.start_time);
          }

          if (slotDate) {
            const now = new Date();
            const currentSunday = new Date(now);
            currentSunday.setDate(now.getDate() - now.getDay());
            currentSunday.setHours(0, 0, 0, 0);

            const targetSunday = new Date(slotDate);
            targetSunday.setDate(slotDate.getDate() - slotDate.getDay());
            targetSunday.setHours(0, 0, 0, 0);

            const diffDays = Math.round((targetSunday.getTime() - currentSunday.getTime()) / (1000 * 60 * 60 * 24));
            const calculatedOffset = Math.round(diffDays / 7);

            if (calculatedOffset > 0) {
              setWeekOffset(calculatedOffset);
              return;
            }
          }
        }
      }
    }
  }, [participants]);

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

  const isPastSlot = useCallback((dayDate: Date, totalMinutes: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDay = new Date(dayDate);
    targetDay.setHours(0, 0, 0, 0);

    if (targetDay.getTime() < today.getTime()) {
      return true;
    }

    if (targetDay.getTime() > today.getTime()) {
      return false;
    }

    const currentNow = new Date();
    const currentMinutes = currentNow.getHours() * 60 + currentNow.getMinutes();
    return totalMinutes < currentMinutes;
  }, []);

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
    return participants.filter((p) => p.is_required !== false);
  }, [participants]);

  const slotDataMap = useMemo(() => {
    const map: Record<string, { matchPct: number; availableCount: number; totalRequired: number; availableNames: string[] }> = {};
    const totalRequired = requiredParticipants.length;

    daysConfig.forEach((day) => {
      TIME_SLOTS.forEach((slot) => {
        const slotKey = `${day.key}-${slot.timeString}`;
        const targetSlotKey = `${getDateKey(day.date)}_${slot.timeString}`;

        if (totalRequired === 0) {
          map[slotKey] = { matchPct: 0, availableCount: 0, totalRequired: 0, availableNames: [] };
          return;
        }

        const availableNames: string[] = [];

        requiredParticipants.forEach((participant) => {
          if (!participant.availability || participant.availability.length === 0) return;

          const isMatch = participant.availability.some((av) => {
            // 1. Direct slot_key match
            if (av.slot_key && av.slot_key === targetSlotKey) {
              return true;
            }

            // 2. Local date & time match fallback
            const start = new Date(av.start_time);
            const isSameDay =
              start.getFullYear() === day.date.getFullYear() &&
              start.getMonth() === day.date.getMonth() &&
              start.getDate() === day.date.getDate();

            if (!isSameDay) return false;

            const startMinutes = start.getHours() * 60 + start.getMinutes();
            return slot.totalMinutes >= startMinutes && slot.totalMinutes < startMinutes + 30;
          });

          if (isMatch) {
            const name = participant.profile?.full_name || participant.profile?.email || 'Participant';
            availableNames.push(name);
          }
        });

        const availableCount = availableNames.length;
        const matchPct = (availableCount / totalRequired) * 100;
        map[slotKey] = { matchPct, availableCount, totalRequired, availableNames };
      });
    });

    return map;
  }, [daysConfig, requiredParticipants]);

  const getHeatmapColor = (matchPct: number) => {
    if (matchPct === 0) return 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20';
    if (matchPct < 40) return 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-500/25';
    if (matchPct < 70) return 'bg-amber-500/30 border-amber-500/50 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-500/40';
    if (matchPct < 100) return 'bg-emerald-500/35 border-emerald-500/60 text-emerald-800 dark:text-emerald-200 font-extrabold hover:bg-emerald-500/50';
    return 'bg-emerald-600 border-emerald-400 text-white font-extrabold shadow-md shadow-emerald-500/30 hover:bg-emerald-500';
  };

  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleSlotClick = (day: any, slot: any, data: any) => {
    const targetSlotKey = `${getDateKey(day.date)}_${slot.timeString}`;

    const availableParticipants: ParticipantWithDetails[] = [];
    const unavailableParticipants: ParticipantWithDetails[] = [];

    participants.forEach((p) => {
      if (!p.availability || p.availability.length === 0) {
        unavailableParticipants.push(p);
        return;
      }

      const isMatch = p.availability.some((av) => {
        if (av.slot_key && av.slot_key === targetSlotKey) return true;
        const start = new Date(av.start_time);
        const isSameDay =
          start.getFullYear() === day.date.getFullYear() &&
          start.getMonth() === day.date.getMonth() &&
          start.getDate() === day.date.getDate();
        if (!isSameDay) return false;
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        return slot.totalMinutes >= startMinutes && slot.totalMinutes < startMinutes + 30;
      });

      if (isMatch) {
        availableParticipants.push(p);
      } else {
        unavailableParticipants.push(p);
      }
    });

    const endMinutes = slot.totalMinutes + 30;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const displayEndHours = endHours > 12 ? endHours - 12 : endHours === 0 ? 12 : endHours;
    const endDisplayString = `${displayEndHours}:${endMins === 0 ? '00' : String(endMins).padStart(2, '0')} ${endHours >= 12 ? 'PM' : 'AM'}`;

    setSelectedSlotDetails({
      date: day.date,
      timeString: slot.timeString,
      displayString: slot.displayString,
      endDisplayString,
      matchPct: data.matchPct,
      availableCount: data.availableCount,
      totalRequired: data.totalRequired,
      availableParticipants,
      unavailableParticipants,
    });
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
              className="px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              {t('week.prev')}
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                weekOffset === 0 ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('week.current')}
            </button>
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              {t('week.next')}
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
            {t('heatmap.legendLabel')}:
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-600 border border-emerald-400"></div>
            <span className="text-slate-600 dark:text-slate-300">100% {t('heatmap.legend100')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500/60"></div>
            <span className="text-slate-600 dark:text-slate-300">75% {language === 'he' ? 'התאמה גבוהה' : 'High Match'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50"></div>
            <span className="text-slate-600 dark:text-slate-300">50% {t('heatmap.legendPartial')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-500/15 border border-rose-500/30"></div>
            <span className="text-slate-600 dark:text-slate-300">0% ({t('heatmap.legend0')})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800"></div>
            <span className="text-slate-600 dark:text-slate-300">{t('heatmap.legendPast')}</span>
          </div>
        </div>

        <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <span>💡</span>
          <span>{language === 'he' ? 'לחץ על כל משבצת זמן כדי לראות את רשימת המשתתפים המלאה' : 'Click any time box to see full participant details'}</span>
        </div>
      </div>

      {/* Heatmap Grid Calendar */}
      <div className="overflow-x-auto select-none">
        <div className="min-w-[650px]">
          {/* Day Header Row */}
          <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 pb-3 mb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-center font-mono text-[11px]">
              {t('cal.timeLabel')}
            </div>

            {daysConfig.map((day) => {
              const isToday =
                day.date.getDate() === now.getDate() &&
                day.date.getMonth() === now.getMonth() &&
                day.date.getFullYear() === now.getFullYear();

              const isSelected = isSelectedDate(day.date);
              const dayNumber = day.date.getDate();

              return (
                <div
                  key={day.key}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-colors ${
                    isSelected
                      ? 'bg-blue-500/10 border border-blue-500/40 text-blue-600 dark:text-blue-400 font-bold'
                      : isToday
                      ? 'bg-blue-50/50 dark:bg-blue-950/20'
                      : ''
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider">{day.short}</span>
                  <div
                    className={`text-base font-extrabold mt-0.5 ${
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
                  const data = slotDataMap[slotKey] || { matchPct: 0, availableCount: 0, totalRequired: 0, availableNames: [] };
                  const colorClasses = getHeatmapColor(data.matchPct);
                  const tooltip = data.availableNames.length > 0
                    ? `Available (${data.availableCount}/${data.totalRequired}): ${data.availableNames.join(', ')} (${Math.round(data.matchPct)}%) - Click for full details`
                    : `0/${data.totalRequired} participants available (0%) - Click for full details`;

                  return (
                    <div
                      key={slotKey}
                      onClick={() => handleSlotClick(day, slot, data)}
                      className={`h-9 mx-1 rounded border transition-all flex flex-col items-center justify-center font-mono text-[10px] cursor-pointer hover:scale-105 hover:z-10 hover:shadow-lg active:scale-95 ${colorClasses} ${
                        isSelectedDay ? 'ring-1 ring-blue-500/50 shadow-sm' : ''
                      }`}
                      title={tooltip}
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

      {/* Interactive Slot Participants Modal Popup */}
      <SlotParticipantsModal
        isOpen={!!selectedSlotDetails}
        meetingTitle={meetingTitle}
        slotDetails={selectedSlotDetails}
        onClose={() => setSelectedSlotDetails(null)}
      />
    </div>
  );
}
