'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Meeting } from '@/types';
import { supabase } from '@/lib/supabase';
import { MeetingHeatmap, type ParticipantWithDetails } from './MeetingHeatmap';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { InviteeCalendar } from './InviteeCalendar';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { useLanguage } from '@/context/LanguageContext';
import { getStoredMeetingData, saveStoredMeetingData, getStoredMeetingBySlug, normalizeKey, deleteStoredMeeting } from '@/lib/meetingStore';
import type { GuestInfo } from '@/lib/cookies';

interface MeetingDetailViewProps {
  initialMeeting: Meeting;
  initialParticipants?: ParticipantWithDetails[];
}

export function MeetingDetailView({
  initialMeeting,
  initialParticipants = [],
}: MeetingDetailViewProps) {
  const router = useRouter();
  const { t, dir, language } = useLanguage();
  const [meeting, setMeeting] = useState<Meeting>(initialMeeting);
  const [participants, setParticipants] = useState<ParticipantWithDetails[]>(initialParticipants);
  const [isEditingHostAvailability, setIsEditingHostAvailability] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareableUrl, setShareableUrl] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isLoadingRef = useRef(false);

  useEffect(() => {
    setShareableUrl(`${window.location.origin}/${meeting.slug}`);
  }, [meeting.slug]);

  // Sync state from server-side fetched initialMeeting and initialParticipants immediately
  useEffect(() => {
    if (initialMeeting) {
      setMeeting((prev) => ({
        ...prev,
        ...initialMeeting,
      }));
    }
  }, [initialMeeting]);

  useEffect(() => {
    if (initialParticipants && initialParticipants.length > 0) {
      setParticipants(initialParticipants);
    }
  }, [initialParticipants]);

  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const normSlug = normalizeKey(meeting.slug);
      const normId = normalizeKey(meeting.id);
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      // 1. Fetch live data from Supabase DB
      try {
        let query = (supabase.from('meetings') as any)
          .select('*, meeting_participants(*, profiles(*), availability_slots(*))');

        if (isUUID(normId) && isUUID(normSlug) && normId === normSlug) {
          query = query.or(`id.eq.${normId},slug.eq.${normSlug}`);
        } else if (isUUID(normId)) {
          query = query.or(`id.eq.${normId},slug.eq.${normSlug}`);
        } else {
          query = query.eq('slug', normSlug);
        }

        const { data: dbData, error: dbErr } = await query.single();

        if (!dbErr && dbData) {
          let cleanTitle = dbData.title || '';
          let cleanDesc = dbData.description || '';
          if (cleanTitle.includes(':::')) {
            const parts = cleanTitle.split(':::');
            cleanTitle = parts[0];
            cleanDesc = parts.slice(1).join(':::');
          }

          setMeeting((prev) => ({
            ...prev,
            title: cleanTitle,
            description: cleanDesc || prev.description,
            status: dbData.status || prev.status,
          }));

          if (dbData.meeting_participants && dbData.meeting_participants.length > 0) {
            const dbParticipants: ParticipantWithDetails[] = dbData.meeting_participants
              .filter((mp: any) => {
                const em = (mp.profiles?.email || '').toLowerCase();
                return em !== 'organizer@company.com' && em !== 'host@company.com';
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
                    slotKey = `${y}-${m}-${day}_${timeStr}`;
                  }
                  return { ...s, slot_key: slotKey };
                }),
              }));

            // Deduplicate by email strictly
            const uniqueMap = new Map<string, ParticipantWithDetails>();
            dbParticipants.forEach((p) => {
              const em = (p.profile?.email || '').trim().toLowerCase();
              const key = em || p.id;
              if (!uniqueMap.has(key)) {
                uniqueMap.set(key, p);
              } else {
                const prev = uniqueMap.get(key)!;
                const slotMap = new Map();
                (prev.availability || []).forEach((s) => slotMap.set(s.slot_key || s.start_time, s));
                (p.availability || []).forEach((s) => slotMap.set(s.slot_key || s.start_time, s));
                uniqueMap.set(key, { ...prev, ...p, availability: Array.from(slotMap.values()) });
              }
            });

            const cleanList = Array.from(uniqueMap.values());
            if (cleanList.length > 0) {
              setParticipants(cleanList);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase DB fetch notice:', err);
      }

      // 2. Fallback to local meetingStore if DB returned nothing
      const stored =
        getStoredMeetingData(meeting.id) ||
        getStoredMeetingData(meeting.slug) ||
        getStoredMeetingData(decodeURIComponent(meeting.slug)) ||
        [];

      if (stored && stored.length > 0) {
        const cleanStored = stored.filter((p) => {
          const em = (p.profile?.email || '').toLowerCase();
          return em !== 'organizer@company.com' && em !== 'host@company.com';
        });
        if (cleanStored.length > 0) {
          setParticipants(cleanStored);
        }
      }
    } finally {
      isLoadingRef.current = false;
    }
  }, [meeting.id, meeting.slug]);

  // Load participants on mount and when meeting changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time live sync listeners + 3-second background polling fallback
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData();
      }, 300);
    };

    window.addEventListener('meeting_availability_updated', debouncedUpdate);
    window.addEventListener('storage', debouncedUpdate);
    window.addEventListener('focus', debouncedUpdate);

    // 2-second background polling to guarantee cross-device updates without page refresh
    const pollInterval = setInterval(() => {
      loadData();
    }, 2000);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
      bc.onmessage = () => {
        debouncedUpdate();
      };
    }

    // Supabase Realtime subscription
    const normSlug = normalizeKey(meeting.slug);
    const channel = supabase
      .channel(`meeting_rt_${normSlug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, () => {
        debouncedUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, () => {
        debouncedUpdate();
      })
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(pollInterval);
      window.removeEventListener('meeting_availability_updated', debouncedUpdate);
      window.removeEventListener('storage', debouncedUpdate);
      window.removeEventListener('focus', debouncedUpdate);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [loadData, meeting.slug]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const confirmDeleteMeeting = async () => {
    try {
      await (supabase.from('meeting_participants') as any).delete().eq('meeting_id', meeting.id);
      await (supabase.from('meetings') as any).delete().or(`id.eq.${meeting.id},slug.eq.${meeting.slug}`);
    } catch (err) {
      console.warn('Supabase delete warning:', err);
    }

    deleteStoredMeeting(meeting.id);
    deleteStoredMeeting(meeting.slug);
    setIsDeleteModalOpen(false);
    router.push('/organizer');
  };

  const toggleRequired = async (participantId: string) => {
    const target = participants.find(
      (p) => p.id === participantId || (p.profile?.email && p.profile.email.toLowerCase() === participantId.toLowerCase())
    );
    if (!target) return;

    const nextValue = !target.is_required;
    const targetEmail = target.profile?.email?.toLowerCase();
    const targetId = target.id;
    const targetProfId = target.profile_id;

    // 1. Optimistic UI update
    setParticipants((prev) => {
      const updated = prev.map((p) => {
        if (p.id === targetId || (p.profile?.email && p.profile.email.toLowerCase() === targetEmail)) {
          return { ...p, is_required: nextValue };
        }
        return p;
      });
      // Save locally quietly without triggering broadcast reload race condition
      saveStoredMeetingData(meeting.id, updated, true);
      saveStoredMeetingData(meeting.slug, updated, true);
      return updated;
    });

    // 2. Persist to Supabase DB with exact calculated nextValue
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (isUUID(targetId)) {
        await (supabase.from('meeting_participants') as any)
          .update({ is_required: nextValue })
          .eq('id', targetId);
      } else if (targetProfId && isUUID(targetProfId)) {
        await (supabase.from('meeting_participants') as any)
          .update({ is_required: nextValue })
          .eq('profile_id', targetProfId);
      } else if (targetEmail) {
        const { data: prof } = await (supabase.from('profiles') as any)
          .select('id')
          .eq('email', targetEmail)
          .maybeSingle();

        if (prof?.id) {
          await (supabase.from('meeting_participants') as any)
            .update({ is_required: nextValue })
            .eq('profile_id', prof.id);
        }
      }
    } catch (err) {
      console.warn('Failed to update participant is_required in DB:', err);
    }
  };

  const handleAddParticipant = async (name: string, email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail) return;

    // Check if participant already in list
    if (participants.some((p) => (p.profile?.email || '').toLowerCase() === cleanEmail)) {
      return;
    }

    const newProfId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prof-${Date.now()}`;
    const newPartId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}`;

    const newParticipant: ParticipantWithDetails = {
      id: newPartId,
      meeting_id: meeting.id,
      profile_id: newProfId,
      is_required: true,
      profile: {
        id: newProfId,
        email: cleanEmail,
        full_name: cleanName,
        company: null,
        phone_number: null,
        is_organizer: false,
      },
      availability: [],
    };

    setParticipants((prev) => [...prev, newParticipant]);

    // Upsert into Supabase so participant is already in DB when invitee arrives
    try {
      const { data: profResult } = await (supabase.from('profiles') as any)
        .upsert([{ id: newProfId, email: cleanEmail, full_name: cleanName, is_organizer: false }], { onConflict: 'email' })
        .select()
        .single();

      const finalProfId = profResult?.id || newProfId;

      await (supabase.from('meeting_participants') as any)
        .upsert([{ id: newPartId, meeting_id: meeting.id, profile_id: finalProfId, is_required: true }], { onConflict: 'id' });
    } catch (err) {
      console.warn('Supabase DB add participant notice:', err);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    const target = participants.find(
      (p) => p.id === participantId || (p.profile?.email && p.profile.email.toLowerCase() === participantId.toLowerCase())
    );
    if (!target || target.profile?.is_organizer) return;

    const targetEmail = target.profile?.email?.toLowerCase();
    const targetId = target.id;

    // 1. Optimistic UI update
    setParticipants((prev) => {
      const updated = prev.filter(
        (p) => p.id !== targetId && (!targetEmail || (p.profile?.email || '').toLowerCase() !== targetEmail)
      );
      saveStoredMeetingData(meeting.id, updated, true);
      saveStoredMeetingData(meeting.slug, updated, true);
      return updated;
    });

    // 2. Persist delete to Supabase DB
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      if (isUUID(targetId)) {
        await (supabase.from('meeting_participants') as any).delete().eq('id', targetId);
      } else if (targetEmail) {
        const { data: prof } = await (supabase.from('profiles') as any).select('id').eq('email', targetEmail).maybeSingle();
        if (prof?.id) {
          await (supabase.from('meeting_participants') as any).delete().eq('profile_id', prof.id);
        }
      }
    } catch (err) {
      console.warn('Supabase DB remove participant notice:', err);
    }
  };

  const toggleMeetingStatus = () => {
    setMeeting((prev) => ({
      ...prev,
      status: prev.status === 'OPEN' ? 'SCHEDULED' : 'OPEN',
    }));
  };

  const hostParticipant = participants.find((p) => p.profile?.is_organizer) || participants[0];

  const hostInfo: GuestInfo = {
    full_name: hostParticipant?.profile?.full_name || 'מיכאל (Host)',
    email: hostParticipant?.profile?.email || 'michael.liarzi@gmail.com',
    role: 'Organizer',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors" dir={dir}>
      {/* Calendar Header Bar */}
      <CalendarHeader
        currentDate={selectedDate}
        onToday={() => setSelectedDate(new Date())}
      />

      {/* Main Layout with Sidebar & Heatmap */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Sidebar */}
        <CalendarSidebar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          participants={participants}
          onToggleRequired={toggleRequired}
          onRemoveParticipant={handleRemoveParticipant}
          onAddParticipant={handleAddParticipant}
        />

        <main className="flex-1 p-6 md:p-10 overflow-y-auto space-y-8">
          {/* Back Nav Link & Delete Button */}
          <div className="flex items-center justify-between">
            <Link
              href="/organizer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
            >
              <span>{dir === 'rtl' ? '→' : '←'}</span> {t('nav.backToDashboard')}
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 transition-colors flex items-center gap-1.5"
              >
                <span>🗑</span>
                <span>{language === 'he' ? 'מחק פגישה' : 'Delete Meeting'}</span>
              </button>

              {/* Organizer Edit Availability Button */}
              <button
                onClick={() => setIsEditingHostAvailability((prev) => !prev)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                <span>📅</span>
                {isEditingHostAvailability ? 'View Heatmap' : 'Enter / Edit My Availability (Host)'}
              </button>
            </div>
          </div>

          {/* Organizer Interactive Availability Calendar */}
          {isEditingHostAvailability ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                👋 <strong>Organizer Mode:</strong> Select your available time slots below. Your availability will be merged onto the meeting heatmap instantly!
              </div>

              <InviteeCalendar
                meetingId={meeting.id}
                meetingSlug={meeting.slug}
                participantId={hostParticipant?.id || 'part-1'}
                guestInfo={hostInfo}
                meetingTitle={meeting.title}
                meetingDescription={meeting.description || undefined}
                onSubmitted={() => {
                  setIsEditingHostAvailability(false);
                  loadData();
                }}
                onBack={() => setIsEditingHostAvailability(false)}
              />
            </div>
          ) : (
            <>
              {/* Meeting Top Header */}
              <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-md dark:shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      onClick={toggleMeetingStatus}
                      className={`cursor-pointer px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                        meeting.status === 'OPEN'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
                      }`}
                      title="Click to toggle status"
                    >
                      ● {t('detail.statusLabel')}: {meeting.status === 'OPEN' ? t('dashboard.statusOpen') : t('dashboard.statusScheduled')}
                    </span>
                    <span className="text-xs font-mono text-slate-500">{t('detail.slugLabel')}: {meeting.slug}</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {meeting.title}
                  </h1>

                  {/* Meeting Purpose / Description Header Display */}
                  {meeting.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                      📌 <strong className="text-slate-800 dark:text-slate-200">{language === 'he' ? 'מטרת הפגישה:' : 'Purpose:'}</strong> {meeting.description}
                    </p>
                  )}
                </div>

                {/* Shareable Link Box & Manual Refresh */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex-1 md:flex-initial bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div suppressHydrationWarning className="font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-xs sm:max-w-sm px-2">
                      {shareableUrl}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                    >
                      {copied ? t('detail.linkCopied') : t('detail.copyLinkBtn')}
                    </button>
                  </div>

                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                    title="Refresh data from cloud"
                  >
                    <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                    <span>{language === 'he' ? 'רענן' : 'Refresh'}</span>
                  </button>
                </div>
              </header>

              {/* Full Width Weekly Calendar Heatmap */}
              <MeetingHeatmap
                participants={participants}
                selectedDate={selectedDate}
                meetingTitle={meeting.title}
              />
            </>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal (Green Yes, Red No) */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        meetingTitle={meeting.title}
        onConfirm={confirmDeleteMeeting}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
