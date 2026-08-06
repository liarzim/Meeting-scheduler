'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { GuestInfo } from '@/lib/cookies';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { TimezoneSelector } from './TimezoneSelector';
import { getWeekDates, formatDateShort } from '@/lib/timezone';
import { updateParticipantSlots, getStoredMeetingData, normalizeKey } from '@/lib/meetingStore';
import { MeetingHeatmap, type ParticipantWithDetails } from './MeetingHeatmap';

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
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'HEATMAP'>('CALENDAR');

  // All group participants state
  const [groupParticipants, setGroupParticipants] = useState<ParticipantWithDetails[]>([]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Load existing group participants & availability
  const loadGroupAvailability = async () => {
    const key = meetingId || meetingSlug || '';
    if (!key) return;

    let loaded: ParticipantWithDetails[] = [];

    // 1. Fetch from local meetingStore
    const stored = getStoredMeetingData(key) || getStoredMeetingData(normalizeKey(key)) || [];
    if (stored.length > 0) {
      loaded = stored;
    }

    // 2. Fetch from Supabase DB
    try {
      const normKey = normalizeKey(key);
      const { data: dbData, error: dbErr } = await (supabase.from('meetings') as any)
        .select('*, meeting_participants(*, profiles(*), availability_slots(*))')
        .or(`id.eq.${normKey},slug.eq.${normKey}`)
        .single();

      if (!dbErr && dbData && dbData.meeting_participants && dbData.meeting_participants.length > 0) {
        const dbParticipants: ParticipantWithDetails[] = dbData.meeting_participants.map((mp: any) => ({
          id: mp.id,
          meeting_id: mp.meeting_id,
          profile_id: mp.profile_id,
          is_required: mp.is_required !== false,
          profile: mp.profiles,
          availability: mp.availability_slots || [],
        }));

        // Merge DB with local
        if (loaded.length > 0) {
          dbParticipants.forEach((dp) => {
            if (!loaded.some((lp) => lp.id === dp.id || (lp.profile?.email && dp.profile?.email && lp.profile.email.toLowerCase() === dp.profile.email.toLowerCase()))) {
              loaded.push(dp);
            }
          });
        } else {
          loaded = dbParticipants;
        }
      }
    } catch (err) {
      console.warn('Group availability fetch fallback:', err);
    }

    // Clean up legacy dummy host
    if (loaded.length > 1 && loaded.some((p) => p.profile?.email !== 'host@company.com')) {
      loaded = loaded.filter((p) => p.profile?.email !== 'host@company.com');
    }

    setGroupParticipants(loaded);

    // Populate user's own existing slots if present
    const selfParticipant = loaded.find(
      (p) =>
        p.id === participantId ||
        (p.profile?.email && guestInfo.email && p.profile.email.toLowerCase() === guestInfo.email.toLowerCase())
    );

    if (selfParticipant && selfParticipant.availability && selfParticipant.availability.length > 0) {
      const existingKeys = new Set<string>();
      selfParticipant.availability.forEach((av) => {
        if (av.slot_key) {
          existingKeys.add(av.slot_key);
        } else if (av.start_time) {
          const d = new Date(av.start_time);
          const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          existingKeys.add(`${getDateKey(d)}_${timeStr}`);
        }
      });
      if (existingKeys.size > 0) {
        setSelectedSlots(existingKeys);
      }
    }
  };

  useEffect(() => {
    loadGroupAvailability();
  }, [meetingId, meetingSlug, participantId, guestInfo.email]);

  // Index other participants' availability by slotKey
  const slotOccupancy = useMemo(() => {
    const map: Record<string, { count: number; names: string[] }> = {};

    groupParticipants.forEach((p) => {
      // Exclude current participant from "other participants" count
      const isSelf =
        p.id === participantId ||
        (p.profile?.email && guestInfo.email && p.profile.email.toLowerCase() === guestInfo.email.toLowerCase());

      if (!isSelf && p.availability) {
        p.availability.forEach((av) => {
          let sKey = av.slot_key;
          if (!sKey && av.start_time) {
            const d = new Date(av.start_time);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            sKey = `${getDateKey(d)}_${timeStr}`;
          }

          if (sKey) {
            if (!map[sKey]) {
              map[sKey] = { count: 0, names: [] };
            }
            const name = p.profile?.full_name || 'Participant';
            if (!map[sKey].names.includes(name)) {
              map[sKey].count += 1;
              map[sKey].names.push(name);
            }
          }
        });
      }
    });

    return map;
  }, [groupParticipants, participantId, guestInfo.email]);

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
    if (!isDragging || !calendarRef.current) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const slotKey = element.getAttribute('data-slot-key');
      const isDisabled = element.getAttribute('data-disabled') === 'true';
      if (slotKey && !isDisabled) {
        updateSlotSelection(slotKey, dragMode);
      }
    }
  };

  const clearSelections = () => {
    setSelectedSlots(new Set());
  };

  const handleSubmitAvailability = async () => {
    setIsSubmitting(true);
    const finalMeetingId = meetingId || meetingSlug || 'm-1';

    try {
      const slotsToInsert = Array.from(selectedSlots).map((slotKey) => {
        const [datePart, timePart] = slotKey.split('_');
        const [yearStr, monthStr, dayStr] = datePart.split('-');
        const [hoursStr, minutesStr] = timePart.split(':');

        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const day = parseInt(dayStr, 10);
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        const startDate = new Date(year, month, day, hours, minutes);
        const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

        return {
          id: `av-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          participant_id: participantId,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          slot_key: slotKey,
        };
      });

      // 1. Update local meetingStore with deep participant availability merging
      updateParticipantSlots(finalMeetingId, participantId, guestInfo, slotsToInsert);

      // 2. Persist to Supabase DB if accessible
      try {
        const normKey = normalizeKey(finalMeetingId);
        const { data: dbData } = await (supabase.from('meetings') as any)
          .select('id')
          .or(`id.eq.${normKey},slug.eq.${normKey}`)
          .single();

        const activeMeetingId = dbData?.id || normKey;

        // Upsert Profile
        const profileData = {
          id: participantId.startsWith('part-') ? undefined : participantId,
          email: guestInfo.email,
          full_name: guestInfo.full_name,
          company: guestInfo.company || null,
          phone_number: guestInfo.phone_number || null,
          is_organizer: guestInfo.role === 'Organizer',
        };

        const { data: profResult } = await (supabase.from('profiles') as any)
          .upsert([profileData], { onConflict: 'email' })
          .select()
          .single();

        const profileId = profResult?.id || profileData.id;

        // Upsert Participant
        if (profileId) {
          const participantData = {
            id: participantId,
            meeting_id: activeMeetingId,
            profile_id: profileId,
            is_required: true,
          };

          await (supabase.from('meeting_participants') as any)
            .upsert([participantData], { onConflict: 'id' });

          // Insert Availability Slots
          if (slotsToInsert.length > 0) {
            const dbPayload = slotsToInsert.map((s) => ({
              id: s.id,
              participant_id: participantId,
              start_time: s.start_time,
              end_time: s.end_time,
            }));

            await (supabase.from('availability_slots') as any).insert(dbPayload);
          }
        }
      } catch (dbErr) {
        console.warn('Supabase DB availability insert fallback:', dbErr);
      }

      onSubmitted();
    } catch (err) {
      console.warn('Error submitting availability:', err);
      onSubmitted();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={calendarRef}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl space-y-6 select-none transition-colors"
      dir={dir}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1 inline-block"
          >
            ← {t('invitee.regBadge')}
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{meetingTitle}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('cal.participantLabel')}: <span className="font-semibold text-slate-800 dark:text-slate-200">{guestInfo.full_name}</span> ({guestInfo.email})
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <LanguageToggle />

          <button
            onClick={handleSubmitAvailability}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
          >
            {isSubmitting ? t('cal.savingBtn') : `✓ ${t('cal.submitBtn')} (${selectedSlots.size})`}
          </button>
        </div>
      </div>

      {/* Mode Switcher: Select My Slots VS View Group Heatmap */}
      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={() => setViewMode('CALENDAR')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              viewMode === 'CALENDAR'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>✏️</span>
            <span>{language === 'he' ? 'בחר זמנים שלי' : 'Select My Available Slots'}</span>
          </button>

          <button
            onClick={() => setViewMode('HEATMAP')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              viewMode === 'HEATMAP'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📊</span>
            <span>
              {language === 'he'
                ? `מפת חום קבוצתית (${groupParticipants.length} משתתפים)`
                : `Group Heatmap (${groupParticipants.length} Participants)`}
            </span>
          </button>
        </div>
      </div>

      {/* Render Group Heatmap Inline if HEATMAP View Mode is active */}
      {viewMode === 'HEATMAP' ? (
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 font-medium">
            👥 <strong>Group Availability View:</strong> Below is the live overlap map showing all participants&apos; availability for this meeting.
          </div>
          <MeetingHeatmap participants={groupParticipants} />
        </div>
      ) : (
        <>
          {/* Controls: Timezone & Week Nav */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80">
            <TimezoneSelector value={timezone} onChange={setTimezone} />

            {/* Week Navigation */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium text-xs"
              >
                {t('week.prev')}
              </button>
              <div className="flex items-center gap-1 font-mono text-xs">
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

          {/* Group Availability Indicator Legend */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span>💡</span>
                <span>{language === 'he' ? 'זמינות משתתפים קיימת בקבוצה:' : 'Live Group Availability Preview:'}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {language === 'he'
                  ? 'משבצות עם סמל 👥 מציגות משתתפים נוספים שסימנו זמינות. לחץ על משבצת כדי לבחור אותה עבורך!'
                  : 'Slots marked with 👥 show other participants available. Click any slot to add your availability!'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                👥 {language === 'he' ? 'זמינים נוספים' : 'Others Available'}
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-mono font-bold">
                ✓ {language === 'he' ? 'בחירה שלי' : 'My Selection'}
              </span>
            </div>
          </div>

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

                      // Check if other participants selected this slot
                      const occupancy = slotOccupancy[slotKey];
                      const othersCount = occupancy ? occupancy.count : 0;
                      const tooltipText = occupancy
                        ? `Available: ${occupancy.names.join(', ')} (${othersCount} participant${othersCount > 1 ? 's' : ''})`
                        : '';

                      return (
                        <div
                          key={slotKey}
                          data-slot-key={slotKey}
                          data-disabled="false"
                          onMouseDown={() => handleMouseDown(slotKey, false)}
                          onMouseEnter={() => handleMouseEnter(slotKey, false)}
                          onTouchStart={() => handleTouchStart(slotKey, false)}
                          onTouchMove={handleTouchMove}
                          title={tooltipText}
                          className={`h-8 rounded-lg border transition-all flex items-center justify-center cursor-pointer font-mono text-[10px] font-bold ${
                            isSelected
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white shadow-md shadow-emerald-500/40 scale-[1.03] ring-2 ring-emerald-400/50'
                              : othersCount > 0
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 font-bold shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'
                          }`}
                        >
                          {isSelected ? (
                            <span>✓</span>
                          ) : othersCount > 0 ? (
                            <span className="flex items-center gap-1">
                              <span>👥</span>
                              <span>{othersCount}</span>
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
