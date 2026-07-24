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
  const { t, dir } = useLanguage();
  const resolvedParams = use(params);
  const rawSlug = resolvedParams.slug;
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

        // 1. Check local meetingStore
        const stored = getStoredMeetings();
        const localMeeting = stored.find(
          (m) =>
            normalizeKey(m.slug) === normalizeKey(rawSlug) ||
            normalizeKey(m.id) === normalizeKey(rawSlug) ||
            normalizeKey(m.slug) === normalizeKey(decodedSlug)
        );

        if (localMeeting) {
          setMeeting(localMeeting);
          setNotFound(false);
          return;
        }

        // 2. Check Supabase DB
        const { data, error } = await (supabase.from('meetings') as any)
          .select('*')
          .or(`slug.eq.${normalizeKey(rawSlug)},id.eq.${normalizeKey(rawSlug)},slug.eq.${normalizeKey(decodedSlug)}`)
          .single();

        if (!error && data) {
          setMeeting(data as Meeting);
          setNotFound(false);
        } else {
          // If not in DB and not in local storage -> Meeting was deleted or does not exist!
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
            🚫
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t('deleted.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('deleted.message')}
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-xs text-rose-500 border border-slate-200 dark:border-slate-800 truncate mt-3">
              /{decodedSlug}
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/"
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
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <Link href="/" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            ← {t('nav.home')}
          </Link>
          <div className="text-xs font-mono text-slate-400 dark:text-slate-500">
            ID: {meeting.id.substring(0, 8)}
          </div>
        </header>

        {/* Stepper Progress Bar */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold">
          <span className={`px-3 py-1 rounded-full ${step === 'IDENTIFY' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
            1. {t('invitee.regBadge')}
          </span>
          <span className="text-slate-400">→</span>
          <span className={`px-3 py-1 rounded-full ${step === 'CALENDAR' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
            2. {t('cal.title')}
          </span>
          <span className="text-slate-400">→</span>
          <span className={`px-3 py-1 rounded-full ${step === 'CONFIRMATION' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
            3. {t('conf.title')}
          </span>
        </div>

        {/* Step 1: Identification */}
        {step === 'IDENTIFY' && (
          <GuestIdentificationForm
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            onComplete={handleGuestComplete}
          />
        )}

        {/* Step 2: Calendar Selection */}
        {step === 'CALENDAR' && (
          <InviteeCalendar
            meetingId={meeting.id}
            meetingSlug={meeting.slug}
            participantId={participantId}
            guestInfo={guestInfo}
            meetingTitle={meeting.title}
            onSubmitted={handleCalendarSubmitted}
            onBack={() => setStep('IDENTIFY')}
          />
        )}

        {/* Step 3: Confirmation */}
        {step === 'CONFIRMATION' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-lg mx-auto text-center space-y-6 shadow-xl dark:shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-3xl flex items-center justify-center mx-auto">
              ✓
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">{t('conf.title')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('conf.subtitle')}
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setStep('CALENDAR')}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                {t('conf.editBtn')}
              </button>
              <Link
                href={`/meetings/${meeting.slug}`}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-600/20"
              >
                {t('conf.viewHeatmapBtn')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
