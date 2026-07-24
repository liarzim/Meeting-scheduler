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
  meetingId?: string;
  meetingSlug?: string;
  participantId: string;
  guestInfo: GuestInfo;
  meetingTitle: string;
  onSubmitted: () => void;
  onBack: () => void;
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

export function InviteeCalendar({
  meetingId,
  meetingSlug,
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

  const isPastSlot = useCallback((dayDate: Date, totalMinutes: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDay = new Date(dayDate);
    targetDay.setHours(0, 0, 0, 0);

    // Target day is before today -> Past
    if (targetDay.getTime() < today.getTime()) {
      return true;
    }

    // Target day is after today (future date / next week) -> NEVER past!
    if (targetDay.getTime() > today.getTime()) {
      return false;
    }

    // Target day is today -> compare current minute of day
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
      const slotsToInsert = Array.from(selectedSlots).map((slotKey) => {
        // slotKey format: YYYY-MM-DD_HH:MM
        const [datePart, timePart] = slotKey.split('_');
        const [yearStr, monthStr, dayStr] = datePart.split('-');
        const [hoursStr, minutesStr] = timePart.split(':');

        const startTime = new Date(
          parseInt(yearStr, 10),
          parseInt(monthStr, 10) - 1,
          parseInt(dayStr, 10),
          parseInt(hoursStr, 10),
          parseInt(minutesStr, 10)
        );

        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

        return {
          participant_id: participantId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        };
      });

      // Save to meetingStore for specific meeting ID & meeting slug
      if (meetingId) {
        updateParticipantSlots(meetingId, participantId, guestInfo, slotsToInsert);
      }
      if (meetingSlug) {
        updateParticipantSlots(meetingSlug, participantId, guestInfo, slotsToInsert);
      }
      // Fallbacks
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

      {/* Week Notice Banner */}
      {weekOffset === 0 ? (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
          <span className="font-medium">
            💡 <strong>Note:</strong> Past hours today are grayed out (`—`). Click any upcoming slot or <strong>Next Week →</strong> to mark your availability in <strong>Vibrant Green (✓ פנוי)</strong>!
          </span>
          <button
            onClick={() => setWeekOffset(1)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0 shadow-sm"
          >
            Go to Next Week →
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between gap-3">
          <span className="font-medium">
            📅 <strong>Next Week View:</strong> All time slots are open! Click or drag across any 30-minute block to select your available times in <strong>Green (✓ פנוי)</strong>.
          </span>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shrink-0 shadow-sm"
          >
            ← Current Week
          </button>
        </div>
      )}

      {/* Selected Slot Summary Bar */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs">
        <div className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <span>{t('cal.selectedLabel')}:</span>
          <span className="font-bold text-slate-900 dark:text-white bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
            {selectedSlots.size} {t('cal.slotsText')} ({(selectedSlots.size * 0.5).toFixed(1)} {t('cal.hrsText')})
          </span>
        </div>
        {selectedSlots.size > 0 && (
          <button
            onClick={clearSelections}
            className="text-slate-500 dark:text-slate-400 hover:text-rose-500 underline font-medium"
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
                className="py-2 px-3 rounded-lg text-center font-mono text-xs transition-colors bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200"
              >
                <div className="font-bold text-sm">{day.short}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-400 font-normal mt-0.5">
                  {formatDateShort(day.date, language)}
                </div>
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
                        key={`${getDateKey(day.date)}_${slot.timeString}`}
                        data-disabled="true"
                        className="h-8 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-900/80 opacity-40 cursor-not-allowed select-none flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-700 font-mono"
                        title="Past time slot"
                      >
                        —
                      </div>
                    );
                  }

                  const slotKey = `${getDateKey(day.date)}_${slot.timeString}`;
                  const isSelected = selectedSlots.has(slotKey);

                  return (
                    <div
                      key={slotKey}
                      data-slot-key={slotKey}
                      data-disabled="false"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isDisabled) return;
                        updateSlotSelection(slotKey, isSelected ? 'deselect' : 'select');
                      }}
                      onMouseDown={() => handleMouseDown(slotKey, false)}
                      onMouseEnter={() => handleMouseEnter(slotKey, false)}
                      onTouchStart={() => handleTouchStart(slotKey, false)}
                      onTouchMove={handleTouchMove}
                      className={`h-8 rounded-lg border transition-all flex items-center justify-center cursor-pointer font-mono text-[10px] font-bold ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white shadow-md shadow-emerald-500/40 scale-[1.03] ring-2 ring-emerald-400/50'
                          : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'
                      }`}
                    >
                      {isSelected ? `✓ ${t('cal.freeTag')}` : ''}
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
