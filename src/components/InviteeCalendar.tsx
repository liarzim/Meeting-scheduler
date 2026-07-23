'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { GuestInfo } from '@/lib/cookies';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { TimezoneSelector } from './TimezoneSelector';
import { getWeekDates, formatDateShort } from '@/lib/timezone';
import { updateParticipantSlots } from '@/lib/meetingStore';

interface InviteeCalendarProps {
  participantId: string;
  guestInfo: GuestInfo;
  meetingTitle: string;
  onSubmitted: () => void;
  onBack: () => void;
}

const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const displayString = `${hours > 12 ? hours - 12 : hours}:${minutes === 0 ? '00' : minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
  return { timeString, displayString, totalMinutes, hours, minutes };
});

export function InviteeCalendar({
  participantId,
  guestInfo,
  meetingTitle,
  onSubmitted,
  onBack,
}: InviteeCalendarProps) {
  const { t, dir, language } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);
  const [timezone, setTimezone] = useState('');

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
    { key: 5, label: t('days.fri'), short: t('days.shortFri'), date: weekDates[5], isDisabled: true },
    { key: 6, label: t('days.sat'), short: t('days.shortSat'), date: weekDates[6], isDisabled: true },
  ], [t, weekDates]);

  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const updateSlotSelection = useCallback(
    (slotKey: string, mode: 'select' | 'deselect') => {
      setSelectedSlots((prev) => {
        const next = new Set(prev);
        if (mode === 'select') {
          next.add(slotKey);
        } else {
          next.delete(slotKey);
        }
        return next;
      });
    },
    []
  );

  const handleMouseDown = (slotKey: string, isDisabled: boolean) => {
    if (isDisabled) return;
    setIsDragging(true);
    const mode = selectedSlots.has(slotKey) ? 'deselect' : 'select';
    setDragMode(mode);
    updateSlotSelection(slotKey, mode);
  };

  const handleMouseEnter = (slotKey: string, isDisabled: boolean) => {
    if (!isDragging || isDisabled) return;
    updateSlotSelection(slotKey, dragMode);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (slotKey: string, isDisabled: boolean) => {
    if (isDisabled) return;
    setIsDragging(true);
    const mode = selectedSlots.has(slotKey) ? 'deselect' : 'select';
    setDragMode(mode);
    updateSlotSelection(slotKey, mode);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    const slotKey = target.getAttribute('data-slot-key');
    const isDisabled = target.getAttribute('data-disabled') === 'true';
    if (slotKey && !isDisabled) {
      updateSlotSelection(slotKey, dragMode);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const clearSelections = () => {
    setSelectedSlots(new Set());
  };

  const handleSubmitAvailability = async () => {
    if (selectedSlots.size === 0) return;
    setIsSubmitting(true);

    try {
      const sundayDate = weekDates[0];

      const slotsToInsert = Array.from(selectedSlots).map((slotKey) => {
        const [dayKeyStr, timeStr] = slotKey.split('-');
        const dayKey = parseInt(dayKeyStr, 10);
        const [hoursStr, minutesStr] = timeStr.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        const startTime = new Date(sundayDate);
        startTime.setUTCDate(sundayDate.getUTCDate() + dayKey);
        startTime.setUTCHours(hours, minutes, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCMinutes(startTime.getUTCMinutes() + 30);

        return {
          participant_id: participantId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        };
      });

      // Save to meetingStore & broadcast real-time availability event
      updateParticipantSlots('m-1', participantId, guestInfo, slotsToInsert);
      updateParticipantSlots('q3-product-architecture-scaling-review', participantId, guestInfo, slotsToInsert);

      // Attempt Supabase DB Insert
      const { error } = await (supabase.from('availability_slots') as any).insert(slotsToInsert);
      if (error) {
        console.warn('Supabase insert warning for availability slots:', error.message);
      }
    } catch (err) {
      console.warn('Failed to submit availability slots to DB:', err);
    } finally {
      setIsSubmitting(false);
      onSubmitted();
    }
  };

  return (
    <div
      ref={calendarRef}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      dir={dir}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl dark:shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 max-w-5xl mx-auto select-none transition-colors"
    >
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold mb-1 block"
          >
            {t('cal.editProfile')} ({guestInfo.full_name})
          </button>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t('cal.title')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('cal.subtitle')} &quot;{meetingTitle}&quot;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <TimezoneSelector value={timezone} onChange={setTimezone} />
          <LanguageToggle />

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

      {/* Selected Slot Summary Bar */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs">
        <div className="font-mono text-blue-600 dark:text-blue-400">
          {t('cal.selectedLabel')}: <span className="font-bold text-slate-900 dark:text-white">{selectedSlots.size}</span> {t('cal.slotsText')} ({(selectedSlots.size * 0.5).toFixed(1)} {t('cal.hrsText')})
        </div>
        {selectedSlots.size > 0 && (
          <button
            onClick={clearSelections}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline font-medium"
          >
            {t('cal.clearBtn')}
          </button>
        )}
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Days Header */}
          <div className="grid grid-cols-8 gap-2 mb-2">
            <div className="text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center">
              {t('heatmap.timeCol')}
            </div>
            {daysConfig.map((day) => (
              <div
                key={day.key}
                className={`py-2 px-3 rounded-lg text-center font-mono text-xs transition-colors ${
                  day.isDisabled
                    ? 'bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-600 line-through'
                    : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="font-bold text-sm">{day.short}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-400 font-normal mt-0.5">
                  {formatDateShort(day.date, language)}
                </div>
                {day.isDisabled && <span className="block text-[9px] text-slate-400 dark:text-slate-600 no-underline">Disabled</span>}
              </div>
            ))}
          </div>

          {/* Time Slot Rows */}
          <div className="space-y-1.5">
            {TIME_SLOTS.map((slot) => (
              <div key={slot.timeString} className="grid grid-cols-8 gap-2 items-center">
                {/* Time Label */}
                <div className={`text-xs font-mono text-slate-400 dark:text-slate-400 ${dir === 'rtl' ? 'text-left pl-2' : 'text-right pr-2'}`}>
                  {slot.displayString}
                </div>

                {/* Day Columns */}
                {daysConfig.map((day) => {
                  const isPast = isPastSlot(day.date, slot.totalMinutes);
                  const isDisabled = day.isDisabled || isPast;

                  if (isDisabled) {
                    return (
                      <div
                        key={`${day.key}-${slot.timeString}`}
                        data-disabled="true"
                        className="h-8 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-900/80 opacity-40 cursor-not-allowed select-none flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-700 font-mono"
                        title={isPast ? "Past time slot" : "Disabled day"}
                      >
                        —
                      </div>
                    );
                  }

                  const slotKey = `${day.key}-${slot.timeString}`;
                  const isSelected = selectedSlots.has(slotKey);

                  return (
                    <div
                      key={slotKey}
                      data-slot-key={slotKey}
                      data-disabled="false"
                      onMouseDown={() => handleMouseDown(slotKey, false)}
                      onMouseEnter={() => handleMouseEnter(slotKey, false)}
                      onTouchStart={() => handleTouchStart(slotKey, false)}
                      onTouchMove={handleTouchMove}
                      className={`h-8 rounded-lg border transition-all flex items-center justify-center cursor-pointer font-mono text-[10px] font-bold ${
                        isSelected
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-indigo-400 text-white shadow-md shadow-blue-500/30 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 hover:border-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {isSelected ? t('cal.freeTag') : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Submit Bar */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('cal.tip')}
        </p>

        <button
          onClick={handleSubmitAvailability}
          disabled={isSubmitting || selectedSlots.size === 0}
          className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('cal.saving') : `${t('cal.submitBtn')} (${selectedSlots.size}) ✓`}
        </button>
      </div>
    </div>
  );
}
