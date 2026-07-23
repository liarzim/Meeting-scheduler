'use client';

import React, { useState, useEffect } from 'react';
import type { Meeting } from '@/types';
import { MeetingHeatmap, type ParticipantWithDetails } from './MeetingHeatmap';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { getStoredMeetingData, saveStoredMeetingData } from '@/lib/meetingStore';

interface MeetingDetailViewProps {
  initialMeeting: Meeting;
  initialParticipants?: ParticipantWithDetails[];
}

const MOCK_PARTICIPANTS: ParticipantWithDetails[] = [
  {
    id: 'part-1',
    meeting_id: 'm-1',
    profile_id: 'prof-1',
    is_required: true,
    profile: {
      id: 'prof-1',
      email: 'alex.organizer@techcorp.com',
      full_name: 'Alex Rivera (Organizer)',
      company: 'TechCorp',
      phone_number: '+1 555 0192',
      is_organizer: true,
    },
    availability: [
      { id: 'av-1', participant_id: 'part-1', start_time: '2026-07-26T08:00:00Z', end_time: '2026-07-26T17:00:00Z' },
      { id: 'av-2', participant_id: 'part-1', start_time: '2026-07-27T08:00:00Z', end_time: '2026-07-27T17:00:00Z' },
      { id: 'av-3', participant_id: 'part-1', start_time: '2026-07-28T08:00:00Z', end_time: '2026-07-28T17:00:00Z' },
      { id: 'av-4', participant_id: 'part-1', start_time: '2026-07-29T08:00:00Z', end_time: '2026-07-29T17:00:00Z' },
    ],
  },
  {
    id: 'part-2',
    meeting_id: 'm-1',
    profile_id: 'prof-2',
    is_required: true,
    profile: {
      id: 'prof-2',
      email: 'sarah.lead@techcorp.com',
      full_name: 'Sarah Chen (Lead Architect)',
      company: 'TechCorp',
      phone_number: '+1 555 0193',
      is_organizer: false,
    },
    availability: [
      { id: 'av-5', participant_id: 'part-2', start_time: '2026-07-26T09:00:00Z', end_time: '2026-07-26T15:00:00Z' },
      { id: 'av-6', participant_id: 'part-2', start_time: '2026-07-27T10:00:00Z', end_time: '2026-07-27T16:00:00Z' },
    ],
  },
  {
    id: 'part-3',
    meeting_id: 'm-1',
    profile_id: 'prof-3',
    is_required: true,
    profile: {
      id: 'prof-3',
      email: 'david.cto@partner.io',
      full_name: 'David Kim (VP Eng)',
      company: 'Partner.io',
      phone_number: '+1 555 0194',
      is_organizer: false,
    },
    availability: [
      { id: 'av-7', participant_id: 'part-3', start_time: '2026-07-26T10:00:00Z', end_time: '2026-07-26T14:00:00Z' },
      { id: 'av-8', participant_id: 'part-3', start_time: '2026-07-27T10:00:00Z', end_time: '2026-07-27T12:00:00Z' },
    ],
  },
  {
    id: 'part-4',
    meeting_id: 'm-1',
    profile_id: 'prof-4',
    is_required: false,
    profile: {
      id: 'prof-4',
      email: 'elena.product@techcorp.com',
      full_name: 'Elena Rostova (Product Lead)',
      company: 'TechCorp',
      phone_number: '+1 555 0195',
      is_organizer: false,
    },
    availability: [],
  },
];

export function MeetingDetailView({
  initialMeeting,
  initialParticipants = MOCK_PARTICIPANTS,
}: MeetingDetailViewProps) {
  const { t, dir } = useLanguage();
  const [meeting, setMeeting] = useState<Meeting>(initialMeeting);
  // Match server-side initial render to avoid hydration mismatch
  const [participants, setParticipants] = useState<ParticipantWithDetails[]>(initialParticipants);

  const [copied, setCopied] = useState(false);
  const [shareableUrl, setShareableUrl] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    setShareableUrl(`${window.location.origin}/${meeting.slug}`);
  }, [meeting.slug]);

  // Load client-stored participants in useEffect after initial hydration
  useEffect(() => {
    const stored = getStoredMeetingData(meeting.id) || getStoredMeetingData(meeting.slug);
    if (stored && stored.length > 0) {
      setParticipants(stored);
    }
  }, [meeting.id, meeting.slug]);

  // Listen for real-time live availability submissions from invitees
  useEffect(() => {
    const handleAvailabilityUpdate = () => {
      const stored = getStoredMeetingData(meeting.id) || getStoredMeetingData(meeting.slug);
      if (stored) {
        setParticipants(stored);
      }
    };

    window.addEventListener('meeting_availability_updated', handleAvailabilityUpdate);
    return () => window.removeEventListener('meeting_availability_updated', handleAvailabilityUpdate);
  }, [meeting.id, meeting.slug]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors" dir={dir}>
      {/* Calendar Header Bar */}
      <CalendarHeader
        currentDate={selectedDate}
        onToday={() => setSelectedDate(new Date())}
      />

      {/* Main Layout with Sidebar & Full-Width Heatmap */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Sidebar containing Mini Month & Participants List */}
        <CalendarSidebar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          participants={participants}
          onToggleRequired={toggleRequired}
          onAddParticipant={handleAddParticipant}
        />

        <main className="flex-1 p-6 md:p-10 overflow-y-auto space-y-8">
          {/* Back Nav Link */}
          <div>
            <a
              href="/organizer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
            >
              <span>{dir === 'rtl' ? '→' : '←'}</span> {t('nav.backToDashboard')}
            </a>
          </div>

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
        </main>
      </div>
    </div>
  );
}
