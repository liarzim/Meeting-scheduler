'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { GuestInfo } from '@/lib/cookies';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { TimezoneSelector } from './TimezoneSelector';
import { getWeekDates, formatDateShort } from '@/lib/timezone';
import {
  updateParticipantSlots,
  getStoredMeetingData,
  normalizeKey,
  isParticipantDeleted,
  addMeetingActivityLog,
  syncParticipantSlotsAcrossAllLocalMeetings,
} from '@/lib/meetingStore';
import { MeetingHeatmap, type ParticipantWithDetails } from './MeetingHeatmap';
import { UserGuideModal } from './UserGuideModal';
import { generateUUID } from '@/lib/uuid';

interface InviteeCalendarProps {
  meetingId?: string;
  meetingSlug?: string;
  participantId: string;
  guestInfo: GuestInfo;
  meetingTitle: string;
  meetingDescription?: string;
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
  meetingDescription,
  onSubmitted,
  onBack,
}: InviteeCalendarProps) {
  const { t, dir, language } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);
  const [timezone, setTimezone] = useState('');
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'HEATMAP'>('CALENDAR');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const isLoadingRef = useRef(false);

  // All group participants state
  const [groupParticipants, setGroupParticipants] = useState<ParticipantWithDetails[]>([]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Load existing group participants & availability
  const loadGroupAvailability = useCallback(async () => {
    const key = meetingId || meetingSlug || '';
    if (!key || isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      let loaded: ParticipantWithDetails[] = [];

      // 1. Fetch from Supabase DB (Cloud Source of Truth)
      try {
        const normKey = normalizeKey(key);
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        let query = (supabase.from('meetings') as any)
          .select('*, meeting_participants(*, profiles(*), availability_slots(*))');

        if (isUUID(normKey)) {
          query = query.or(`id.eq.${normKey},slug.eq.${normKey}`);
        } else {
          query = query.eq('slug', normKey);
        }

        const { data: dbData, error: dbErr } = await query.single();

        if (!dbErr && dbData && dbData.meeting_participants && dbData.meeting_participants.length > 0) {
          loaded = dbData.meeting_participants
            .filter((mp: any) => {
              const em = (mp.profiles?.email || '').trim().toLowerCase();
              if (em === 'organizer@company.com' || em === 'host@company.com') return false;
              if (em && (isParticipantDeleted(key, em) || isParticipantDeleted(meetingId || '', em) || isParticipantDeleted(meetingSlug || '', em))) {
                return false;
              }
              if (mp.id && (isParticipantDeleted(key, mp.id) || isParticipantDeleted(meetingId || '', mp.id) || isParticipantDeleted(meetingSlug || '', mp.id))) {
                return false;
              }
              return true;
            })
            .map((mp: any) => ({
              id: mp.id,
              meeting_id: mp.meeting_id,
              profile_id: mp.profile_id,
              is_required: mp.is_required !== false,
              profile: mp.profiles,
              availability: (mp.availability_slots || []).map((s: any) => {
                let slotKey = s.slot_key;
                if (!slotKey && s.start_time) {
                  const d = new Date(s.start_time);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  slotKey = `${getDateKey(d)}_${timeStr}`;
                }
                return { ...s, slot_key: slotKey };
              }),
            }));
        }
      } catch (err) {
        console.warn('Group availability fetch fallback:', err);
      }

      // 2. Fallback to local meetingStore if DB was empty
      if (loaded.length === 0) {
        const stored = getStoredMeetingData(key) || getStoredMeetingData(normalizeKey(key)) || [];
        loaded = stored.filter((p) => {
          const em = (p.profile?.email || '').trim().toLowerCase();
          if (em === 'organizer@company.com' || em === 'host@company.com') return false;
          if (em && (isParticipantDeleted(key, em) || isParticipantDeleted(meetingId || '', em) || isParticipantDeleted(meetingSlug || '', em))) {
            return false;
          }
          if (p.id && (isParticipantDeleted(key, p.id) || isParticipantDeleted(meetingId || '', p.id) || isParticipantDeleted(meetingSlug || '', p.id))) {
            return false;
          }
          return true;
        });
      }

      // 3. Strictly deduplicate loaded participants by Email
      const uniqueMap = new Map<string, ParticipantWithDetails>();
      loaded.forEach((p) => {
        const email = (p.profile?.email || '').trim().toLowerCase();
        const k = email || p.id;
        if (!uniqueMap.has(k)) {
          uniqueMap.set(k, p);
        } else {
          const prev = uniqueMap.get(k)!;
          const slotMap = new Map();
          (prev.availability || []).forEach((s) => slotMap.set(s.slot_key || s.start_time, s));
          (p.availability || []).forEach((s) => slotMap.set(s.slot_key || s.start_time, s));
          uniqueMap.set(k, { ...prev, ...p, availability: Array.from(slotMap.values()) });
        }
      });

      const cleanLoaded = Array.from(uniqueMap.values());
      setGroupParticipants(cleanLoaded);

      // Populate user's own existing slots if present
      const selfParticipant = cleanLoaded.find(
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
    } finally {
      isLoadingRef.current = false;
    }
  }, [meetingId, meetingSlug, participantId, guestInfo.email]);

  useEffect(() => {
    loadGroupAvailability();
  }, [loadGroupAvailability]);

  // Real-time live sync across tabs and Supabase subscriptions with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    const debouncedSync = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadGroupAvailability();
      }, 300);
    };

    window.addEventListener('meeting_availability_updated', debouncedSync);
    window.addEventListener('storage', debouncedSync);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
      bc.onmessage = () => {
        debouncedSync();
      };
    }

    const normKey = normalizeKey(meetingId || meetingSlug || '');
    const channel = supabase
      .channel(`live_inv_${normKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, () => {
        debouncedSync();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, () => {
        debouncedSync();
      })
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('meeting_availability_updated', debouncedSync);
      window.removeEventListener('storage', debouncedSync);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [loadGroupAvailability, meetingId, meetingSlug]);

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

  // List of unique other participants who have submitted availability
  const otherParticipantsWithSlots = useMemo(() => {
    const uniqueOtherMap = new Map<string, { id: string; name: string; email: string; isHost: boolean; slotsCount: number }>();
    const currentEmail = (guestInfo.email || '').trim().toLowerCase();

    groupParticipants.forEach((p) => {
      const pEmail = (p.profile?.email || '').trim().toLowerCase();
      const isSelf =
        p.id === participantId ||
        (pEmail && currentEmail && pEmail === currentEmail);

      if (isSelf || pEmail === 'organizer@company.com' || pEmail === 'host@company.com') {
        return;
      }

      const key = pEmail || p.id;
      const slotsCount = p.availability?.length || 0;

      if (!uniqueOtherMap.has(key)) {
        uniqueOtherMap.set(key, {
          id: p.id,
          name: p.profile?.full_name || p.profile?.email || 'Participant',
          email: pEmail,
          isHost: p.profile?.is_organizer || false,
          slotsCount: slotsCount,
        });
      } else {
        const prev = uniqueOtherMap.get(key)!;
        uniqueOtherMap.set(key, {
          ...prev,
          slotsCount: Math.max(prev.slotsCount, slotsCount),
        });
      }
    });

    return Array.from(uniqueOtherMap.values());
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
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `av-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          participant_id: participantId,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          slot_key: slotKey,
        };
      });

      // 1. Update local meetingStore with deep participant availability merging
      updateParticipantSlots(finalMeetingId, participantId, guestInfo, slotsToInsert);

      // 2. Persist to Supabase DB
      try {
        const normKey = normalizeKey(finalMeetingId);
        const { data: dbData } = await (supabase.from('meetings') as any)
          .select('id')
          .or(`id.eq.${normKey},slug.eq.${normKey}`)
          .single();

        const activeMeetingId = dbData?.id || normKey;

        // Upsert Profile in Supabase
        const { data: profResult } = await (supabase.from('profiles') as any)
          .upsert(
            [
              {
                email: guestInfo.email,
                full_name: guestInfo.full_name,
                company: guestInfo.company || null,
                phone_number: guestInfo.phone_number || null,
                is_organizer: guestInfo.role === 'Organizer',
              },
            ],
            { onConflict: 'email' }
          )
          .select()
          .single();

        const profileId = profResult?.id;

        if (profileId) {
          // Fetch ALL meeting_participants records associated with this profileId in Supabase Cloud DB
          const { data: allUserParticipants } = await (supabase.from('meeting_participants') as any)
            .select('id, meeting_id')
            .eq('profile_id', profileId);

          const allParts: Array<{ id: string; meeting_id: string }> = allUserParticipants ? [...allUserParticipants] : [];

          // Ensure current meeting participant record exists
          let currentTargetId = allParts.find((p) => p.meeting_id === activeMeetingId)?.id;

          if (!currentTargetId) {
            const validPartUUID =
              participantId && participantId.length === 36 && !participantId.startsWith('part-')
                ? participantId
                : generateUUID();

            const { data: newPart } = await (supabase.from('meeting_participants') as any)
              .upsert(
                [
                  {
                    id: validPartUUID,
                    meeting_id: activeMeetingId,
                    profile_id: profileId,
                    is_required: true,
                  },
                ],
                { onConflict: 'id' }
              )
              .select()
              .single();

            currentTargetId = newPart?.id || validPartUUID;
            if (currentTargetId && !allParts.some((p) => p.id === currentTargetId)) {
              allParts.push({ id: currentTargetId, meeting_id: activeMeetingId });
            }
          }

          // Cross-Meeting Sync: Delete and insert new slots across ALL active meeting enrollments of this participant!
          for (const part of allParts) {
            if (!part.id) continue;

            // Delete previous slots to avoid duplicates
            await (supabase.from('availability_slots') as any)
              .delete()
              .eq('participant_id', part.id);

            // Insert newly selected slots
            if (slotsToInsert.length > 0) {
              const dbPayload = slotsToInsert.map((s) => ({
                id: generateUUID(),
                participant_id: part.id,
                start_time: s.start_time,
                end_time: s.end_time,
              }));

              await (supabase.from('availability_slots') as any).insert(dbPayload);
            }

            // Log activity log entry for each meeting updated
            if (part.meeting_id) {
              addMeetingActivityLog(part.meeting_id, {
                type: 'AVAILABILITY_UPDATED',
                recipient_email: guestInfo.email,
                recipient_name: guestInfo.name,
                details: `סנכרון זמינות אוטומטי (${slotsToInsert.length} משבצות) לכל הפגישות הפעילות של המשתתף`,
              });
            }
          }
        }
      } catch (dbErr) {
        console.warn('Supabase DB availability insert fallback:', dbErr);
      }

      // Also sync across local storage caches for all active meetings
      if (guestInfo.email) {
        syncParticipantSlotsAcrossAllLocalMeetings(guestInfo.email, slotsToInsert, guestInfo);
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
          {meetingDescription && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-blue-50/60 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-200/80 dark:border-blue-800/50 max-w-xl leading-relaxed">
              📌 <strong className="text-blue-700 dark:text-blue-300">{language === 'he' ? 'מטרת הפגישה:' : 'Purpose:'}</strong> {meetingDescription}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* User Guide Button */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all border border-blue-200 dark:border-blue-800 shadow-sm hover:scale-105 active:scale-95"
            title={language === 'he' ? 'מדריך למשתמש' : 'User Guide'}
          >
            <span>📖</span>
            <span className="hidden sm:inline">{language === 'he' ? 'מדריך למשתמש' : 'User Guide'}</span>
          </button>

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
          <MeetingHeatmap
            participants={groupParticipants}
            meetingTitle={meetingTitle}
          />
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

          {/* Group Participants Who Already Submitted Availability */}
          {otherParticipantsWithSlots.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <div className="flex items-center gap-2">
                  <span>👥</span>
                  <span>
                    {language === 'he'
                      ? `משתתפים שכבר הגישו זמינות (${otherParticipantsWithSlots.length}):`
                      : `Teammates Who Submitted Availability (${otherParticipantsWithSlots.length}):`}
                  </span>
                </div>
                <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400">
                  {language === 'he' ? 'זמינותם מודגשת ביומן להלן' : 'Their slots are highlighted below'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {otherParticipantsWithSlots.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 shadow-sm text-xs font-medium text-slate-800 dark:text-slate-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span className="font-bold">{p.name}</span>
                    {p.isHost && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {t('detail.hostTag')}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      ({p.slotsCount} {language === 'he' ? 'משבצות' : 'slots'})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group Availability Indicator Legend */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span>💡</span>
                <span>{language === 'he' ? 'זמינות משתתפים קיימת ביומן:' : 'Live Group Availability on Grid:'}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {language === 'he'
                  ? 'משבצות עם סמל 👥 מציגות משתתפים שכבר פנויים בשעה זו. לחץ עליהן כדי לסמן שגם אתה פנוי!'
                  : 'Slots marked with 👥 show teammates available at this time. Click them to match your availability!'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                👥 {language === 'he' ? 'אחרים פנויים' : 'Others Available'}
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-mono font-bold">
                ✓ {language === 'he' ? 'הבחירה שלי' : 'My Selection'}
              </span>
            </div>
          </div>

          {/* Mobile & Touch Instructions Guide */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/80 text-xs space-y-2 shadow-sm text-start">
            <div className="font-extrabold flex items-center justify-between text-blue-900 dark:text-blue-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">📱</span>
                <span>{language === 'he' ? 'כיצד לסמן זמנים בנייד ובמחשב?' : 'How to pick your availability on mobile & desktop?'}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-mono">
                {language === 'he' ? 'מדריך מהיר' : 'Quick Guide'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-sm">👆</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">{language === 'he' ? '1. לחיצה (Tap):' : '1. Tap to Select:'}</strong>
                  <span>{language === 'he' ? 'לחצו על כל שעה כדי לסמן זמינות (✓ בירוק). לחיצה נוספת מבטלת.' : 'Tap any slot to mark availability (green ✓). Tap again to unselect.'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-sm">🖐️</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">{language === 'he' ? '2. גרירה ברצף (Drag):' : '2. Drag across Hours:'}</strong>
                  <span>{language === 'he' ? 'לחצו וגררו את האצבע ברצף על פני כמה שעות כדי לסמן טווח שלם במהירות.' : 'Press & drag finger across multiple slots to select a whole block at once.'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-sm">💾</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">{language === 'he' ? '3. שמירה (חובה!):' : '3. Save & Submit:'}</strong>
                  <span>{language === 'he' ? 'בסיום הסימון, לחצו על הכפתור הירוק "שמור והגש זמינות" לשמירת בחירתכם.' : 'When finished, click the green "Submit Availability" button to save!'}</span>
                </div>
              </div>
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
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white shadow-md shadow-emerald-500/40 scale-[1.02] ring-2 ring-emerald-400/50'
                              : othersCount > 0
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/30 font-extrabold shadow-sm ring-1 ring-emerald-500/30'
                              : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'
                          }`}
                        >
                          {isSelected && othersCount > 0 ? (
                            <span className="flex items-center gap-1">
                              <span>✓</span>
                              <span className="text-[9px] opacity-90">(👥{othersCount})</span>
                            </span>
                          ) : isSelected ? (
                            <span>✓</span>
                          ) : othersCount > 0 ? (
                            <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-200 font-extrabold">
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

      {/* Mobile Sticky Floating Save Bar */}
      {viewMode === 'CALENDAR' && (
        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-between gap-3 animate-fadeIn">
          <div className="text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
              {language === 'he' ? 'נבחרו:' : 'Selected:'}
            </span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {selectedSlots.size} {t('cal.slotsText')} ({(selectedSlots.size * 0.5).toFixed(1)} {t('cal.hrsText')})
            </span>
          </div>

          <button
            onClick={handleSubmitAvailability}
            disabled={isSubmitting || selectedSlots.size === 0}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>💾</span>
            <span>{isSubmitting ? t('cal.savingBtn') : language === 'he' ? 'שמור והגש זמינות' : 'Submit Availability'}</span>
          </button>
        </div>
      )}

      {/* Interactive User Guide Modal */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
