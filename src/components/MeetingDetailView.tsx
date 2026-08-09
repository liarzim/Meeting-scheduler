'use client';

import React, { useState, useEffect } from 'react';
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
  const [shareableUrl, setShareableUrl] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    setShareableUrl(`${window.location.origin}/${meeting.slug}`);
  }, [meeting.slug]);

  // Load client-stored meeting title and details
  useEffect(() => {
    const storedMeeting = getStoredMeetingBySlug(initialMeeting.slug) || getStoredMeetingBySlug(initialMeeting.id);
    if (storedMeeting && storedMeeting.title) {
      setMeeting(storedMeeting);
    }
  }, [initialMeeting.slug, initialMeeting.id]);

  const loadData = async () => {
    let finalParticipants: ParticipantWithDetails[] = [];

    // 1. Fetch from local meetingStore first
    const stored =
      getStoredMeetingData(meeting.id) ||
      getStoredMeetingData(meeting.slug) ||
      getStoredMeetingData(decodeURIComponent(meeting.slug)) ||
      [];

    if (stored && stored.length > 0) {
      finalParticipants = stored;
    }

    // 2. Fetch live data from Supabase DB and merge
    try {
      const normSlug = normalizeKey(meeting.slug);
      const normId = normalizeKey(meeting.id);

      const { data: dbData, error: dbErr } = await (supabase.from('meetings') as any)
        .select('*, meeting_participants(*, profiles(*), availability_slots(*))')
        .or(`id.eq.${normId},slug.eq.${normSlug}`)
        .single();

      if (!dbErr && dbData && dbData.meeting_participants && dbData.meeting_participants.length > 0) {
        let dbParticipants: ParticipantWithDetails[] = dbData.meeting_participants.map((mp: any) => ({
          id: mp.id,
          meeting_id: mp.meeting_id,
          profile_id: mp.profile_id,
          is_required: mp.is_required !== false,
          profile: mp.profiles,
          availability: mp.availability_slots || [],
        }));

        // Merge local availability into dbParticipants if DB slots are empty
        if (finalParticipants.length > 0) {
          dbParticipants = dbParticipants.map((dbP) => {
            const localP = finalParticipants.find(
              (lp) =>
                lp.id === dbP.id ||
                (lp.profile?.email && dbP.profile?.email && lp.profile.email.toLowerCase() === dbP.profile.email.toLowerCase())
            );
            if (localP && localP.availability && localP.availability.length > 0) {
              if (!dbP.availability || dbP.availability.length === 0) {
                return { ...dbP, availability: localP.availability };
              }
            }
            return dbP;
          });

          // Include local participants that DB doesn't have yet
          finalParticipants.forEach((lp) => {
            if (!dbParticipants.some((dp) => dp.id === lp.id || (dp.profile?.email && lp.profile?.email && dp.profile.email.toLowerCase() === lp.profile.email.toLowerCase()))) {
              dbParticipants.push(lp);
            }
          });
        }

        finalParticipants = dbParticipants;
      }
    } catch (err) {
      console.warn('Supabase DB fetch fallback:', err);
    }

    // Clean up legacy dummy fallback host if an actual host exists
    if (finalParticipants.length > 1 && finalParticipants.some((p) => p.profile?.email !== 'host@company.com')) {
      finalParticipants = finalParticipants.filter((p) => p.profile?.email !== 'host@company.com');
    }

    if (finalParticipants.length > 0) {
      setParticipants(finalParticipants);
      saveStoredMeetingData(meeting.id, finalParticipants);
      saveStoredMeetingData(meeting.slug, finalParticipants);
    }
  };

  // Load participants on mount and when meeting changes
  useEffect(() => {
    loadData();
  }, [meeting.id, meeting.slug]);

  // Listen for real-time live availability submissions across all tabs & Supabase Realtime
  useEffect(() => {
    const handleAvailabilityUpdate = () => {
      loadData();
    };

    window.addEventListener('meeting_availability_updated', handleAvailabilityUpdate);
    window.addEventListener('storage', handleAvailabilityUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
      bc.onmessage = () => {
        handleAvailabilityUpdate();
      };
    }

    // Supabase Realtime subscription
    const channel = supabase
      .channel(`meeting_realtime_${normalizeKey(meeting.slug)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, () => {
        handleAvailabilityUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, () => {
        handleAvailabilityUpdate();
      })
      .subscribe();

    return () => {
      window.removeEventListener('meeting_availability_updated', handleAvailabilityUpdate);
      window.removeEventListener('storage', handleAvailabilityUpdate);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [meeting.id, meeting.slug]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const confirmDeleteMeeting = async () => {
    try {
      await (supabase.from('meetings') as any).delete().or(`id.eq.${meeting.id},slug.eq.${meeting.slug}`);
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }

    deleteStoredMeeting(meeting.id);
    deleteStoredMeeting(meeting.slug);
    setIsDeleteModalOpen(false);
    router.push('/organizer');
  };

  const toggleRequired = (participantId: string) => {
    setParticipants((prev) => {
      const updated = prev.map((p) =>
        p.id === participantId ? { ...p, is_required: !p.is_required } : p
      );
      saveStoredMeetingData(meeting.id, updated);
      saveStoredMeetingData(meeting.slug, updated);
      return updated;
    });
  };

  const handleAddParticipant = (name: string, email: string) => {
    const newId = `part-${Date.now()}`;
    const newParticipant: ParticipantWithDetails = {
      id: newId,
      meeting_id: meeting.id,
      profile_id: `prof-${Date.now()}`,
      is_required: true,
      profile: {
        id: `prof-${Date.now()}`,
        email: email,
        full_name: name,
        company: null,
        phone_number: null,
        is_organizer: false,
      },
      availability: [],
    };

    setParticipants((prev) => {
      const updated = [...prev, newParticipant];
      saveStoredMeetingData(meeting.id, updated);
      saveStoredMeetingData(meeting.slug, updated);
      return updated;
    });
  };

  const toggleMeetingStatus = () => {
    setMeeting((prev) => ({
      ...prev,
      status: prev.status === 'OPEN' ? 'SCHEDULED' : 'OPEN',
    }));
  };

  const hostParticipant = participants.find((p) => p.profile?.is_organizer) || participants[0];

  const hostInfo: GuestInfo = {
    full_name: hostParticipant?.profile?.full_name || 'Organizer (Host)',
    email: hostParticipant?.profile?.email || 'organizer@company.com',
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
                </div>

                {/* Shareable Link Box */}
                <div className="w-full md:w-auto bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div suppressHydrationWarning className="flex-1 font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-md px-2">
                    {shareableUrl}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                  >
                    {copied ? t('detail.linkCopied') : t('detail.copyLinkBtn')}
                  </button>
                </div>
              </header>

              {/* Full Width Weekly Calendar Heatmap */}
              <MeetingHeatmap participants={participants} selectedDate={selectedDate} />
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
