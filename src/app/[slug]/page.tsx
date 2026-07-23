'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import { GuestIdentificationForm } from '@/components/GuestIdentificationForm';
import { InviteeCalendar } from '@/components/InviteeCalendar';
import type { GuestInfo } from '@/lib/cookies';
import { useLanguage } from '@/context/LanguageContext';

interface PublicMeetingPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function PublicMeetingPage({ params }: PublicMeetingPageProps) {
  const { t, dir } = useLanguage();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [step, setStep] = useState<'REGISTER' | 'CALENDAR' | 'CONFIRMATION'>('REGISTER');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantId, setParticipantId] = useState<string>('');
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);

  useEffect(() => {
    async function loadMeeting() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!error && data) {
          setMeeting(data as Meeting);
        } else {
          const formattedTitle = slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());

          setMeeting({
            id: `m-${slug}`,
            organizer_id: 'prof-1',
            title: formattedTitle || 'Architecture Sync & Planning',
            slug: slug,
            status: 'OPEN',
          });
        }
      } catch (err) {
        console.warn('Meeting load fallback:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMeeting();
  }, [slug]);

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

  if (!meeting) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir={dir}>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-bold text-rose-400">Meeting Not Found</h2>
          <p className="text-sm text-slate-400">
            The meeting link <code className="text-indigo-300 font-mono">/{slug}</code> does not exist or has expired.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            {t('nav.home')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-10 flex flex-col items-center" dir={dir}>
      <div className="w-full max-w-5xl space-y-8">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
              step === 'REGISTER'
                ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>1. {t('invitee.regBadge')}</span>
          </div>
          <span className="text-slate-600">→</span>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
              step === 'CALENDAR'
                ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>2. {t('cal.title')}</span>
          </div>
          <span className="text-slate-600">→</span>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
              step === 'CONFIRMATION'
                ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>3. {t('conf.title')}</span>
          </div>
        </div>

        {/* Step 1: Guest Identification */}
        {step === 'REGISTER' && (
          <GuestIdentificationForm
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            onComplete={handleGuestComplete}
          />
        )}

        {/* Step 2: Drag-to-Select Calendar */}
        {step === 'CALENDAR' && guestInfo && (
          <InviteeCalendar
            participantId={participantId}
            guestInfo={guestInfo}
            meetingTitle={meeting.title}
            onSubmitted={handleCalendarSubmitted}
            onBack={() => setStep('REGISTER')}
          />
        )}

        {/* Step 3: Confirmation */}
        {step === 'CONFIRMATION' && guestInfo && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-12 text-center space-y-6 max-w-lg mx-auto shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-white">{t('conf.title')}</h2>
              <p className="text-sm text-slate-400">
                {t('conf.subtitle')}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs font-mono space-y-2 text-slate-300">
              <p><span className="text-slate-500">Email:</span> {guestInfo.email}</p>
              <p><span className="text-slate-500">Company:</span> {guestInfo.company || 'N/A'}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setStep('CALENDAR')}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                {t('conf.editBtn')}
              </button>
              <a
                href={`/meetings/${meeting.slug}`}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors text-center"
              >
                {t('conf.viewHeatmapBtn')}
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
