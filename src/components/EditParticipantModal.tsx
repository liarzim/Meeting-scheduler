'use client';

import React, { useState, useEffect } from 'react';
import type { ParticipantWithDetails } from './MeetingHeatmap';
import { supabase } from '@/lib/supabase';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';
import { saveStoredMeetingData, getStoredMeetingData } from '@/lib/meetingStore';
import { useLanguage } from '@/context/LanguageContext';

interface EditParticipantModalProps {
  isOpen: boolean;
  participant: ParticipantWithDetails | null;
  meetingId: string;
  meetingSlug: string;
  meetingTitle?: string;
  meetingDescription?: string;
  shareableUrl?: string;
  hostName?: string;
  hostEmail?: string;
  onClose: () => void;
  onSuccess: (updatedParticipant: ParticipantWithDetails) => void;
}

export function EditParticipantModal({
  isOpen,
  participant,
  meetingId,
  meetingSlug,
  meetingTitle = '',
  meetingDescription = '',
  shareableUrl = '',
  hostName = '',
  hostEmail = '',
  onClose,
  onSuccess,
}: EditParticipantModalProps) {
  const { dir, language } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [isMakeHost, setIsMakeHost] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (participant) {
      setFullName(participant.profile?.full_name || '');
      setEmail(participant.profile?.email || '');
      setPhone(participant.profile?.phone_number || '');
      setCompany(participant.profile?.company || '');
      setRole((participant.profile as any)?.role || '');
      setIsRequired(participant.is_required !== false);
      setIsMakeHost(!!participant.profile?.is_organizer);
      setError(null);
    }
  }, [participant]);

  if (!isOpen || !participant) return null;

  const slotCount = participant.availability?.length || 0;
  const isOrganizer = participant.profile?.is_organizer || false;

  // WhatsApp formatted link
  const rawPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const whatsappUrl = rawPhone ? `https://wa.me/${rawPhone}` : null;

  const handleCopyEmail = () => {
    if (email) {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleSendEmailReminder = () => {
    if (!email) return;

    const toStr = email.trim();
    const ccStr = hostEmail ? hostEmail.trim() : '';

    const titleStr = meetingTitle || 'פגישה';
    const descText = meetingDescription ? meetingDescription : (language === 'he' ? 'תיאום זמינות שבועית' : 'Weekly availability coordination');
    const ownerName = hostName ? hostName.replace(' (Host)', '').trim() : (language === 'he' ? 'מארח הפגישה' : 'Meeting Owner');
    const targetName = fullName ? fullName.trim() : (language === 'he' ? 'משתתף/ת' : 'Participant');

    const subjectStr =
      language === 'he'
        ? `תזכורת: תיאום פגישה בנושא - ${titleStr}`
        : `Reminder: Scheduling a meeting regarding - ${titleStr}`;

    let bodyStr = '';
    if (language === 'he') {
      bodyStr = `שלום ${targetName},

תזכורת נעימה לגבי תיאום הפגישה בנושא ${titleStr} .
מטרת הפגישה היא ${descText}.
לצורך התיאום, יש להיכנס לקישור הבא ולעדכן אילו מועדים זמינים לקיום הפגישה :${shareableUrl || ''}

תודה מראש ,
${ownerName}`;
    } else {
      bodyStr = `Hello ${targetName},

Friendly reminder regarding scheduling the meeting for ${titleStr}.
The purpose of the meeting is ${descText}.

To help coordinate, please access the link below and update your available times for the meeting: ${shareableUrl || ''}

Thanks in advance,
${ownerName}`;
    }

    const mailtoUrl = `mailto:${encodeURIComponent(toStr)}?cc=${encodeURIComponent(ccStr)}&subject=${encodeURIComponent(subjectStr)}&body=${encodeURIComponent(bodyStr)}`;

    window.open(mailtoUrl, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanCompany = company.trim();
    const cleanRole = role.trim();

    if (!cleanEmail) {
      setError(language === 'he' ? 'אנא הזן כתובת דוא"ל תקינה' : 'Please enter a valid email.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let finalFullName = cleanName || cleanEmail;
    if (isMakeHost && !finalFullName.includes('(Host)')) {
      finalFullName = `${finalFullName} (Host)`;
    }

    const updatedParticipant: ParticipantWithDetails = {
      ...participant,
      is_required: isRequired,
      profile: {
        ...participant.profile,
        id: participant.profile_id || participant.profile?.id || `prof-${Date.now()}`,
        email: cleanEmail,
        full_name: finalFullName,
        company: cleanCompany || null,
        phone_number: cleanPhone || null,
        is_organizer: isMakeHost,
        role: cleanRole || null,
      } as any,
    };

    try {
      // 1. Update Supabase profiles table
      if (participant.profile_id) {
        await (supabase.from('profiles') as any)
          .update({
            full_name: finalFullName,
            email: cleanEmail,
            phone_number: cleanPhone || null,
            company: cleanCompany || null,
            is_organizer: isMakeHost,
          })
          .eq('id', participant.profile_id);
      }

      // 2. If designated as Host, transfer meeting ownership in meetings table
      if (isMakeHost && participant.profile_id) {
        await (supabase.from('meetings') as any)
          .update({ organizer_id: participant.profile_id })
          .or(`id.eq.${meetingId},slug.eq.${meetingSlug}`);
      }

      // 3. Update Supabase meeting_participants table is_required status
      if (participant.id) {
        await (supabase.from('meeting_participants') as any)
          .update({
            is_required: isRequired,
          })
          .eq('id', participant.id);
      }
    } catch (err) {
      console.warn('Supabase participant update notice:', err);
    }

    // 3. Update local meetingStore
    const existing = getStoredMeetingData(meetingId) || getStoredMeetingData(meetingSlug) || [];
    const updatedList = existing.map((p) => {
      if (p.id === participant.id || (p.profile?.email && p.profile.email.toLowerCase() === cleanEmail)) {
        return updatedParticipant;
      }
      return p;
    });

    saveStoredMeetingData(meetingId, updatedList);
    saveStoredMeetingData(meetingSlug, updatedList);

    // 4. Dispatch real-time live sync events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('meeting_availability_updated'));
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
        bc.postMessage({ type: 'AVAILABILITY_UPDATED', key: meetingId });
        bc.close();
      }
    }

    setIsSubmitting(false);
    onClose();
    onSuccess(updatedParticipant);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn text-start"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 transition-colors max-h-[90vh] overflow-y-auto transform transition-all animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-1">
              <span>👤</span>
              <span>{language === 'he' ? 'פרטי משתתף' : 'Participant Details'}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{fullName || email || 'משתתף'}</span>
              {isOrganizer && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                  {language === 'he' ? 'מארח (Host)' : 'Host'}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Quick Contact Actions Bar */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full font-bold ${
              slotCount > 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {slotCount > 0
                ? (language === 'he' ? `✓ ${slotCount} חלונות זמינות הוגשו` : `✓ ${slotCount} slots submitted`)
                : (language === 'he' ? '⏳ טרם הוגשה זמינות' : '⏳ Pending response')}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </a>
            )}

            {email && (
              <>
                <button
                  type="button"
                  onClick={handleSendEmailReminder}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title={language === 'he' ? 'פתח אפליקציית מייל בחלון חדש לשליחת תזכורת' : 'Open mail app in new window to send reminder'}
                >
                  <span>📧</span>
                  <span>{language === 'he' ? 'שלח תזכורת במייל' : 'Send Reminder'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
                >
                  {copiedEmail ? '✓ העתקת!' : '📋 העתק מייל'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שם מלא *' : 'Full Name *'}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={language === 'he' ? 'שם המשתתף' : 'Full Name'}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'כתובת דוא"ל *' : 'Email Address *'}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'מספר טלפון (כולל קידומת מדינה)' : 'Phone Number'}
              </label>
              <PhoneInputWithCountry
                value={phone}
                onChange={setPhone}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'חברה / ארגון' : 'Company / Organization'}
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={language === 'he' ? 'שם החברה' : 'Company Name'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תפקיד / הגדרת תפקיד' : 'Role / Title'}
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={language === 'he' ? 'לדוגמה: מנהל פרויקטים' : 'e.g. Project Manager'}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Required vs Optional Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {language === 'he' ? 'סטטוס השתתפות במפת החום' : 'Participation Impact on Heatmap'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsRequired(true)}
                className={`py-2.5 px-4 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                  isRequired
                    ? 'bg-blue-600 border-blue-500 text-white ring-2 ring-blue-500/30 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span>★</span>
                <span>{language === 'he' ? 'משתתף חובה (Required)' : 'Required Participant'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRequired(false)}
                className={`py-2.5 px-4 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                  !isRequired
                    ? 'bg-slate-700 border-slate-600 text-white ring-2 ring-slate-500/30 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span>☆</span>
                <span>{language === 'he' ? 'משתתף רשות (Optional)' : 'Optional Participant'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              💡 {language === 'he' ? 'משתתפי חובה נלקחים בחשבון בחישוב אחוזי מפת החום הקבוצתית.' : 'Required participants are included in the 100% group heatmap matching calculations.'}
            </p>
          </div>

          {/* Make Meeting Owner / Host Toggle */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">👑</span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {language === 'he' ? 'מארח / מנהל הפגישה (Host)' : 'Meeting Owner (Host)'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {language === 'he' ? 'הגדר משתתף זה כבעלים ומארח הפגישה' : 'Designate this participant as the meeting owner'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMakeHost(!isMakeHost)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  isMakeHost
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {isMakeHost
                  ? (language === 'he' ? '✓ מוגדר כמארח' : '✓ Is Meeting Host')
                  : (language === 'he' ? 'הגדר כמארח' : 'Make Host')}
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              {isSubmitting
                ? (language === 'he' ? 'שומר שינויים...' : 'Saving...')
                : (language === 'he' ? 'שמור שינויים ✓' : 'Save Changes ✓')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
