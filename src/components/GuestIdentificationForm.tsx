'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getGuestCookie, setGuestCookie, type GuestInfo } from '@/lib/cookies';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';

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

  // Auto-fill form from browser cookies on mount
  useEffect(() => {
    const saved = getGuestCookie();
    if (saved) {
      if (saved.full_name) setFullName(saved.full_name);
      if (saved.email) setEmail(saved.email);
      if (saved.company) setCompany(saved.company);
      if (saved.phone_number) setPhone(saved.phone_number);
      if (saved.role) setRole(saved.role);
      setAutoFilled(true);
    }
  }, []);

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

    setGuestCookie(guestInfo);

    let profileId = `prof-${Date.now()}`;
    let participantId = `part-${Date.now()}`;

    try {
      const profileData = {
        email: guestInfo.email,
        full_name: guestInfo.full_name,
        company: guestInfo.company,
        phone_number: guestInfo.phone_number,
        is_organizer: false,
      };

      const { data: profileResult, error: profileErr } = await (supabase.from('profiles') as any)
        .upsert([profileData], { onConflict: 'email' })
        .select()
        .single();

      if (!profileErr && profileResult) {
        profileId = profileResult.id;
      }

      const participantData = {
        meeting_id: meetingId,
        profile_id: profileId,
        is_required: true,
      };

      const { data: partResult, error: partErr } = await (supabase.from('meeting_participants') as any)
        .insert([participantData])
        .select()
        .single();

      if (!partErr && partResult) {
        participantId = partResult.id;
      }
    } catch (err) {
      console.warn('Using local shadow profile fallback:', err);
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
          {t('invitee.joinTitle')} &quot;{meetingTitle}&quot;
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('invitee.regSubtitle')}
        </p>

        {autoFilled && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-2">
            {t('invitee.autofillNotice')}
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
            placeholder="e.g. Sarah Jenkins"
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
            placeholder="sarah@company.com"
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
              placeholder="e.g. Acme Corp"
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
              placeholder="+1 (555) 019-2831"
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
            placeholder="e.g. Senior Software Engineer / Lead Designer"
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
