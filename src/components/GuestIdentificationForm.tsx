'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { setGuestCookie, type GuestInfo } from '@/lib/cookies';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';
import { updateParticipantSlots, normalizeKey } from '@/lib/meetingStore';

interface GuestIdentificationFormProps {
  meetingId: string;
  meetingTitle: string;
  onComplete: (participantId: string, profileId: string, guestInfo: GuestInfo) => void;
}

export function GuestIdentificationForm({ meetingId, meetingTitle, onComplete }: GuestIdentificationFormProps) {
  const { t, dir } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Clean title for display
  const cleanTitle = useMemo(() => {
    try {
      const decoded = decodeURIComponent(meetingTitle);
      return decoded.replace(/-[a-z0-9]{5}$/i, '').replace(/-/g, ' ');
    } catch {
      return meetingTitle;
    }
  }, [meetingTitle]);

  // Check if participant previously entered for THIS meeting before
  useEffect(() => {
    const meetingStorageKey = `guest_submitted_${normalizeKey(meetingId)}`;
    const savedForMeeting = typeof window !== 'undefined' ? localStorage.getItem(meetingStorageKey) : null;

    if (savedForMeeting) {
      try {
        const parsed = JSON.parse(savedForMeeting) as GuestInfo;
        if (parsed.full_name) setFullName(parsed.full_name);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.company) setCompany(parsed.company);
        if (parsed.phone_number) setPhone(parsed.phone_number);
        if (parsed.role) setRole(parsed.role);
        setAutoFilled(true);
        return;
      } catch {
        // Fallthrough if parse fails
      }
    }

    // First time visitor for this meeting: Keep form COMPLETELY BLANK
    setFullName('');
    setEmail('');
    setCompany('');
    setPhone('');
    setRole('');
    setAutoFilled(false);
  }, [meetingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    setIsSubmitting(true);

    const guestInfo: GuestInfo = {
      full_name: fullName.trim(),
      email: email.trim(),
      company: company.trim(),
      phone_number: phone.trim(),
      role: role.trim(),
    };

    // Save locally under per-meeting key so returning visitors are recognized
    if (typeof window !== 'undefined') {
      localStorage.setItem(`guest_submitted_${normalizeKey(meetingId)}`, JSON.stringify(guestInfo));
    }
    setGuestCookie(guestInfo);

    // Generate standard 36-char UUIDs compatible with Supabase Postgres UUID columns
    let profileId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prof-${Date.now()}`;
    let participantId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}`;

    // Instantly register participant in meetingStore so organizer sees them in sidebar
    updateParticipantSlots(meetingId, participantId, guestInfo, []);

    try {
      // 1. Upsert Profile in Supabase DB
      const profileData = {
        id: profileId,
        email: guestInfo.email,
        full_name: guestInfo.full_name,
        company: guestInfo.company,
        phone_number: guestInfo.phone_number,
        is_organizer: false,
      };

      const { data: profileResult } = await (supabase.from('profiles') as any)
        .upsert([profileData], { onConflict: 'email' })
        .select()
        .single();

      if (profileResult && profileResult.id) {
        profileId = profileResult.id;
      }

      // 2. Upsert Meeting in Supabase DB
      const meetingData = {
        id: meetingId.length > 30 ? meetingId : crypto.randomUUID ? crypto.randomUUID() : meetingId,
        title: cleanTitle,
        slug: normalizeKey(meetingId),
        status: 'OPEN',
      };

      const { data: meetingResult } = await (supabase.from('meetings') as any)
        .upsert([meetingData], { onConflict: 'slug' })
        .select()
        .single();

      const finalMeetingId = meetingResult?.id || meetingId;

      // 3. Upsert Participant in Supabase DB
      const participantData = {
        id: participantId,
        meeting_id: finalMeetingId,
        profile_id: profileId,
        is_required: true,
      };

      const { data: partResult } = await (supabase.from('meeting_participants') as any)
        .upsert([participantData], { onConflict: 'id' })
        .select()
        .single();

      if (partResult && partResult.id) {
        participantId = partResult.id;
      }
    } catch (err) {
      console.warn('Supabase DB profile/participant upsert fallback:', err);
    } finally {
      setIsSubmitting(false);
      onComplete(participantId, profileId, guestInfo);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl dark:shadow-2xl max-w-xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 transition-colors" dir={dir}>
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
          {t('invitee.regBadge')}
        </div>
        <LanguageToggle />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {t('invitee.joinTitle')} &quot;{cleanTitle}&quot;
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('invitee.regSubtitle')}
        </p>

        {autoFilled ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-2">
            {t('invitee.restoredSaved')}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-medium mt-2">
            {t('invitee.firstTime')}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            {t('invitee.nameLabel')}
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('invitee.namePlaceholder')}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            {t('invitee.emailLabel')}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('invitee.emailPlaceholder')}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {t('invitee.companyLabel')}
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t('invitee.companyPlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {t('invitee.phoneLabel')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('invitee.phonePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            {t('invitee.roleLabel')}
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('invitee.rolePlaceholder')}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !fullName.trim() || !email.trim()}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 mt-4"
        >
          {isSubmitting ? '...' : t('invitee.continueBtn')}
        </button>
      </form>
    </div>
  );
}
