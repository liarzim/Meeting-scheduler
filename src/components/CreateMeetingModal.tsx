'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import { setGuestCookie, getGuestCookie } from '@/lib/cookies';
import { saveStoredMeeting, saveStoredMeetingData } from '@/lib/meetingStore';
import { useLanguage } from '@/context/LanguageContext';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meeting: Meeting) => void;
}

export function CreateMeetingModal({ isOpen, onClose, onSuccess }: CreateMeetingModalProps) {
  const { t, dir } = useLanguage();
  const [title, setTitle] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill organizer info if cookie exists
  useEffect(() => {
    const saved = getGuestCookie();
    if (saved) {
      if (saved.full_name) setOrganizerName(saved.full_name);
      if (saved.email) setOrganizerEmail(saved.email);
    }
  }, []);

  // Auto-generate clean, unique UUID slug when title changes
  useEffect(() => {
    if (!title.trim()) {
      setSlug('');
      return;
    }
    const uuidSlug = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`;
    setSlug(uuidSlug);
  }, [title]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a valid meeting title.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const hostName = organizerName.trim() || 'Meeting Organizer';
    const hostEmail = organizerEmail.trim() || 'organizer@company.com';

    // Save cookies
    setGuestCookie({
      full_name: hostName,
      email: hostEmail,
    });

    const meetingTitleClean = title.trim();
    const meetingUuid = slug.trim() || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`);

    const newMeetingData = {
      id: meetingUuid,
      title: meetingTitleClean,
      slug: meetingUuid,
      status: 'OPEN' as const,
    };

    try {
      // Insert into Supabase meetings table
      await (supabase.from('meetings') as any)
        .upsert([newMeetingData], { onConflict: 'id' });
    } catch (err) {
      console.warn('Supabase meeting upsert notice:', err);
    }

    // Initialize Host participant with user's actual name
    const hostParticipant = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}`,
      meeting_id: meetingUuid,
      profile_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prof-${Date.now()}`,
      is_required: true,
      profile: {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prof-${Date.now()}`,
        email: hostEmail,
        full_name: `${hostName} (Host)`,
        company: null,
        phone_number: null,
        is_organizer: true,
      },
      availability: [],
    };

    const createdMeeting: Meeting = {
      id: meetingUuid,
      organizer_id: hostParticipant.profile_id,
      title: meetingTitleClean,
      slug: meetingUuid,
      status: 'OPEN',
    };

    // Save to local meetingStore under both ID and Slug
    saveStoredMeeting(createdMeeting);
    saveStoredMeetingData(createdMeeting.id, [hostParticipant]);
    saveStoredMeetingData(createdMeeting.slug, [hostParticipant]);

    setIsSubmitting(false);
    setTitle('');
    setSlug('');
    onClose();
    onSuccess(createdMeeting);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t('modal.createTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('modal.createSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {t('modal.titleLabel')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Product Architecture & Scaling Review"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Your Name (Host)
              </label>
              <input
                type="text"
                required
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Your Email
              </label>
              <input
                type="email"
                required
                value={organizerEmail}
                onChange={(e) => setOrganizerEmail(e.target.value)}
                placeholder="alex@company.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Generated Shareable Link (Clean UUID)
            </label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-blue-600 dark:text-blue-400">
              <span className="opacity-50">/</span>
              <input
                type="text"
                readOnly
                value={slug}
                className="bg-transparent w-full focus:outline-none font-bold select-all"
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              🔒 Standard 36-character UUID link generated automatically.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('modal.cancelBtn')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : `${t('modal.submitBtn')} ✨`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
