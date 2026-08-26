'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/types';
import { supabase } from '@/lib/supabase';
import { GuestIdentificationForm } from '@/components/GuestIdentificationForm';
import { InviteeCalendar } from '@/components/InviteeCalendar';
import { getGuestCookie, type GuestInfo } from '@/lib/cookies';
import { useLanguage } from '@/context/LanguageContext';
import { getStoredMeetings, normalizeKey } from '@/lib/meetingStore';

interface PublicMeetingClientViewProps {
  slug: string;
}

export function PublicMeetingClientView({ slug }: PublicMeetingClientViewProps) {
  const { t, dir, language } = useLanguage();
  const rawSlug = slug;
  const decodedSlug = decodeURIComponent(rawSlug);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Stepper State: IDENTIFY -> CALENDAR -> CONFIRMATION
  const [step, setStep] = useState<'IDENTIFY' | 'CALENDAR' | 'CONFIRMATION'>('IDENTIFY');
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({ full_name: '', email: '' });
  const [participantId, setParticipantId] = useState<string>('');

  // Check URL query parameters or saved guest info
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const pid = searchParams.get('pid');
      const name = searchParams.get('name');
      const email = searchParams.get('email');
      const company = searchParams.get('company');
      const phone = searchParams.get('phone');
      const role = searchParams.get('role');

      if (pid || email || name) {
        if (pid) setParticipantId(pid);
        setGuestInfo({
          full_name: name || '',
          email: email || '',
          company: company || '',
          phone_number: phone || '',
          role: role || '',
        });
        setStep('CALENDAR');
        return;
      }
    }

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
            id: data.id,
            organizer_id: data.organizer_id,
            title: cleanTitle,
            description: cleanDesc,
            slug: data.slug,
            status: data.status || 'OPEN',
          });
          setNotFound(false);
        } else {
          // Construct fallback meeting if valid slug string
          setMeeting({
            id: normSlug,
            organizer_id: 'prof-1',
            title: decodedSlug.replace(/-/g, ' '),
            slug: normSlug,
            status: 'OPEN',
          });
          setNotFound(false);
        }
      } catch (err) {
        console.error('Error loading public meeting:', err);
        setMeeting({
          id: rawSlug,
          organizer_id: 'prof-1',
          title: decodedSlug.replace(/-/g, ' '),
          slug: rawSlug,
          status: 'OPEN',
        });
        setNotFound(false);
      } finally {
        setLoading(false);
      }
    }

    if (rawSlug) {
      loadMeeting();
    }
  }, [rawSlug, decodedSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-600 flex items-center justify-center text-2xl animate-spin mb-4">
          ⌛
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('public.loading')}...
        </p>
      </div>
    );
  }

  if (notFound || !meeting) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center" dir={dir}>
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center text-3xl mb-4">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {t('public.notFoundTitle')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
          {t('public.notFoundDesc')}
        </p>
        <Link
          href="/organizer"
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20"
        >
          {t('common.dashboard')}
        </Link>
      </div>
    );
  }

  const isClosed = meeting.status === 'CLOSED';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors py-8 px-4 sm:px-6 lg:px-8" dir={dir}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Branding */}
        <header className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
              📅
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {meeting.title}
              </h1>
              {meeting.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {meeting.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isClosed
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isClosed ? `● ${t('status.closed')}` : `● ${t('status.open')}`}
            </span>
          </div>
        </header>

        {/* Closed Banner Warning */}
        {isClosed && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-3">
            <span className="text-lg">🔒</span>
            <span>
              {language === 'he'
                ? 'פגישה זו סגורה כעת להגשת זמנים חדשים. באפשרותך לצפות בפרטים.'
                : 'This meeting is closed for new availability submissions.'}
            </span>
          </div>
        )}

        {/* Stepper Content */}
        {step === 'IDENTIFY' && (
          <GuestIdentificationForm
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            meetingDescription={meeting.description}
            initialInfo={guestInfo}
            onComplete={({ participantId: pid, guestInfo: info }) => {
              setParticipantId(pid);
              setGuestInfo(info);
              setStep('CALENDAR');
            }}
          />
        )}

        {step === 'CALENDAR' && (
          <InviteeCalendar
            meetingId={meeting.id}
            participantId={participantId}
            guestInfo={guestInfo}
            onSuccess={() => setStep('CONFIRMATION')}
          />
        )}

        {step === 'CONFIRMATION' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mx-auto border border-emerald-500/20">
              ✓
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t('public.successTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t('public.successDesc')} {guestInfo.full_name} ({guestInfo.email}).
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={() => setStep('CALENDAR')}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              >
                {t('public.editAvailability')}
              </button>
              <Link
                href={`/meetings/${meeting.slug}`}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20"
              >
                {t('public.viewHeatmap')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
