'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { getGuestCookie, setGuestCookie } from '@/lib/cookies';
import { saveStoredMeeting, saveStoredMeetingData } from '@/lib/meetingStore';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMeeting: Meeting) => void;
}

export function CreateMeetingModal({ isOpen, onClose, onSuccess }: CreateMeetingModalProps) {
  const { t, dir } = useLanguage();
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill organizer name/email from cookies on mount
  useEffect(() => {
    const saved = getGuestCookie();
    if (saved) {
      if (saved.full_name) setOrganizerName(saved.full_name);
      if (saved.email) setOrganizerEmail(saved.email);
    }
  }, []);

  // Auto-generate clean, unique read-only slug when title changes
  useEffect(() => {
    if (!title.trim()) {
      setSlug('');
      return;
    }

    try {
      let clean = title
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-');

      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const finalSlug = clean && clean.replace(/-/g, '').length > 0 ? `${clean}-${uniqueSuffix}` : `meeting-${uniqueSuffix}`;
      setSlug(finalSlug);
    } catch {
      const fallbackSuffix = Math.random().toString(36).substring(2, 7);
      setSlug(`meeting-${fallbackSuffix}`);
    }
  }, [title]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
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
    const meetingSlugClean = slug.trim();

    const newMeetingData = {
      title: meetingTitleClean,
      slug: meetingSlugClean,
      status: 'OPEN' as const,
    };

    let meetingId = crypto.randomUUID();

    try {
      // Insert into Supabase meetings table
      const { data, error: supabaseError } = await (supabase.from('meetings') as any)
        .insert([newMeetingData])
        .select()
        .single();

      if (!supabaseError && data) {
        meetingId = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert notice:', err);
    }

    // Initialize Host participant with user's actual name
    const hostParticipant = {
      id: `part-${Date.now()}`,
      meeting_id: meetingId,
      profile_id: `prof-${Date.now()}`,
      is_required: true,
      profile: {
        id: `prof-${Date.now()}`,
        email: hostEmail,
        full_name: `${hostName} (Host)`,
        company: null,
        phone_number: null,
        is_organizer: true,
      },
      availability: [],
    };

    const createdMeeting: Meeting = {
      id: meetingId,
      organizer_id: hostParticipant.profile_id,
      title: meetingTitleClean,
      slug: meetingSlugClean,
      status: 'OPEN',
    };

    // Save full meeting object & Host participant in meetingStore
    saveStoredMeeting(createdMeeting);
    saveStoredMeetingData(meetingId, [hostParticipant]);
    saveStoredMeetingData(meetingSlugClean, [hostParticipant]);

    setIsSubmitting(false);
    onSuccess(createdMeeting);
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {t('modal.createTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Organizer Info Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {t('invitee.nameLabel')} (Host)
              </label>
              <input
                type="text"
                required
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder="Your Name"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {t('invitee.emailLabel')}
              </label>
              <input
                type="email"
                required
                value={organizerEmail}
                onChange={(e) => setOrganizerEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('modal.titleLabel')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('modal.titlePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('modal.descLabel')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('modal.descPlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          {/* Unique Read-Only Auto-Generated URL Slug */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('modal.slugLabel')}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-blue-600 dark:text-indigo-400 cursor-not-allowed">
              <span className="text-slate-400 dark:text-slate-500 select-none">/</span>
              <input
                type="text"
                readOnly
                value={slug}
                className="bg-transparent text-blue-600 dark:text-indigo-400 focus:outline-none w-full font-mono font-semibold cursor-not-allowed select-all"
                title="Unique auto-generated URL"
              />
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 font-sans font-bold">Unique</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('modal.slugHelp')}
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !organizerName.trim() || !organizerEmail.trim()}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? t('modal.submitting') : t('modal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
