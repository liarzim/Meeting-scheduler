'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/types';
import { supabase } from '@/lib/supabase';
import { GuestIdentificationForm } from '@/components/GuestIdentificationForm';
import { InviteeCalendar } from '@/components/InviteeCalendar';
import { getGuestCookie, type GuestInfo } from '@/lib/cookies';
import { useLanguage } from '@/context/LanguageContext';
import { getStoredMeetings, normalizeKey } from '@/lib/meetingStore';

interface PublicMeetingPageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicMeetingPage({ params }: PublicMeetingPageProps) {
  const { t, dir, language } = useLanguage();
  const resolvedParams = use(params);
  const rawSlug = resolvedParams?.slug || '';
  const decodedSlug = decodeURIComponent(rawSlug);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Stepper State: IDENTIFY -> CALENDAR -> CONFIRMATION
  const [step, setStep] = useState<'IDENTIFY' | 'CALENDAR' | 'CONFIRMATION'>('IDENTIFY');
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({ full_name: '', email: '' });
  const [participantId, setParticipantId] = useState<string>('');

  // Check saved guest info
  useEffect(() => {
    const saved = getGuestCookie();
    if (saved && saved.full_name) {
      setGuestInfo(saved);
    }
  }, []);

  // Fetch meeting details from local meetingStore or Supabase DB
  useEffect(() => {
    async function loadMeeting() {
      try {
        setLoading(true);

        const normSlug = normalizeKey(rawSlug);
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        // 1. Check local meetingStore
        const stored = getStoredMeetings();
        const localMeeting = stored.find(
          (m) =>
            normalizeKey(m.slug) === normSlug ||
            normalizeKey(m.id) === normSlug ||
            normalizeKey(m.slug) === normalizeKey(decodedSlug)
        );

        if (localMeeting) {
          setMeeting(localMeeting);
          setNotFound(false);
          return;
        }

        // 2. Check Supabase DB
        let query = (supabase.from('meetings') as any).select('*');
        if (isUUID(normSlug)) {
          query = query.or(`slug.eq.${normSlug},id.eq.${normSlug}`);
        } else {
          query = query.eq('slug', normSlug);
        }

        const { data, error } = await query.single();

        if (!error && data) {
          let cleanTitle = data.title || '';
          let cleanDesc = data.description || '';
          if (cleanTitle.includes(':::')) {
            const parts = cleanTitle.split(':::');
            cleanTitle = parts[0];
            cleanDesc = parts.slice(1).join(':::');
          }

          setMeeting({
            ...data,
            title: cleanTitle,
            description: cleanDesc,
          } as Meeting);
          setNotFound(false);
        } else {
          setMeeting(null);
          setNotFound(true);
        }
      } catch (err) {
        console.warn('Meeting load notice:', err);
        setMeeting(null);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadMeeting();
  }, [rawSlug, decodedSlug]);

  const handleGuestComplete = (partId: string, _profId: string, info: GuestInfo) => {
    setParticipantId(partId);
    setGuestInfo(info);
    setStep('CALENDAR');
  };

  const handleCalendarSubmitted = () => {
    setStep('CONFIRMATION');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir={dir}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-400 font-mono">Loading meeting details...</p>
        </div>
      </main>
    );
  }

  // Friendly Deleted Meeting Screen if link does not exist or was deleted by organizer
  if (notFound || !meeting) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6" dir={dir}>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl transition-colors">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-3xl mx-auto">
            🗑️
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t('deleted.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('deleted.subtitle')}
            </p>
            <div className="font-mono text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 truncate mt-3">
              /{decodedSlug}
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/organizer"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all"
            >
              {t('deleted.homeBtn')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 transition-colors" dir={dir}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header with Navigation & Direct Group Heatmap Link */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-3">
          <div className="flex items-center gap-4">
            <Link href="/organizer" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              ← {t('nav.home')}
            </Link>
            <div className="text-xs font-mono text-slate-400 dark:text-slate-500">
              ID: {meeting.id.substring(0, 8)}
            </div>
          </div>

          <Link
            href={`/meetings/${meeting.slug}`}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-800 text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
          >
            <span>📊</span>
            <span>{language === 'he' ? 'צפה במפת חום קבוצתית של כל המשתתפים' : 'View Group Heatmap of all participants'}</span>
          </Link>
        </header>

        {/* Stepper Progress Bar */}
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <span className={`px-3 py-1 rounded-full ${step === 'IDENTIFY' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
            1. {t('invitee.step1')}
          </span>
          <span>→</span>
          <span className={`px-3 py-1 rounded-full ${step === 'CALENDAR' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
            2. {t('invitee.step2')}
          </span>
          <span>→</span>
          <span className={`px-3 py-1 rounded-full ${step === 'CONFIRMATION' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
            3. {t('invitee.step3')}
          </span>
        </div>

        {/* Step 1: Guest Identification Form */}
        {step === 'IDENTIFY' && (
          <GuestIdentificationForm
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            meetingDescription={meeting.description || undefined}
            onComplete={handleGuestComplete}
          />
        )}

        {/* Step 2: Interactive Grid Calendar */}
        {step === 'CALENDAR' && (
          <InviteeCalendar
            meetingId={meeting.id}
            meetingSlug={meeting.slug}
            participantId={participantId}
            guestInfo={guestInfo}
            meetingTitle={meeting.title}
            meetingDescription={meeting.description || undefined}
            onSubmitted={handleCalendarSubmitted}
            onBack={() => setStep('IDENTIFY')}
          />
        )}

        {/* Step 3: Success Confirmation Screen */}
        {step === 'CONFIRMATION' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-lg mx-auto text-center space-y-6 shadow-xl dark:shadow-2xl transition-colors">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-3xl mx-auto">
              ✓
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {t('confirm.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('confirm.subtitle')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                href={`/meetings/${meeting.slug}`}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>📊</span> {t('confirm.viewHeatmapBtn')}
              </Link>
              <button
                onClick={() => setStep('CALENDAR')}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                {t('confirm.editBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
