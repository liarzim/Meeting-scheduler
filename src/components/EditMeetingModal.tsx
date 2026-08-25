'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import { saveStoredMeeting, saveStoredMeetingData, getStoredMeetingData } from '@/lib/meetingStore';
import { useLanguage } from '@/context/LanguageContext';

interface EditMeetingModalProps {
  isOpen: boolean;
  meeting: Meeting | null;
  hostName?: string;
  hostEmail?: string;
  onClose: () => void;
  onSuccess: (updatedMeeting: Meeting, updatedHostName?: string, updatedHostEmail?: string) => void;
}

export function EditMeetingModal({
  isOpen,
  meeting,
  hostName = '',
  hostEmail = '',
  onClose,
  onSuccess,
}: EditMeetingModalProps) {
  const { t, dir, language } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'SCHEDULED'>('OPEN');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title || '');
      setDescription(meeting.description || '');
      setStatus(meeting.status || 'OPEN');
      setOrganizerName(hostName || '');
      setOrganizerEmail(hostEmail || '');
      setError(null);
    }
  }, [meeting, hostName, hostEmail]);

  if (!isOpen || !meeting) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    const cleanName = organizerName.trim();
    const cleanEmail = organizerEmail.trim().toLowerCase();

    if (!cleanTitle) {
      setError(language === 'he' ? 'אנא הזן כותרת פגישה' : 'Please provide a valid meeting title.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const dbCombinedTitle = cleanDesc ? `${cleanTitle}:::${cleanDesc}` : cleanTitle;

    const updatedMeeting: Meeting = {
      ...meeting,
      title: cleanTitle,
      description: cleanDesc,
      status: status,
    };

    try {
      // 1. Update Supabase meetings table
      const { error: meetingErr } = await (supabase.from('meetings') as any)
        .update({
          title: dbCombinedTitle,
          status: status,
        })
        .or(`id.eq.${meeting.id},slug.eq.${meeting.slug}`);

      if (meetingErr) {
        console.warn('Supabase meeting update notice:', meetingErr);
      }

      // 2. If host profile details were provided, update host profile
      if (meeting.organizer_id && (cleanName || cleanEmail)) {
        await (supabase.from('profiles') as any)
          .update({
            full_name: cleanName ? `${cleanName} (Host)` : undefined,
            email: cleanEmail || undefined,
          })
          .eq('id', meeting.organizer_id);
      }
    } catch (err) {
      console.warn('Supabase update exception:', err);
    }

    // 3. Update local meetingStore
    saveStoredMeeting(updatedMeeting);

    // Update existing cached participant host name if available
    const existingParticipants = getStoredMeetingData(meeting.id) || getStoredMeetingData(meeting.slug) || [];
    if (existingParticipants.length > 0) {
      const updatedParticipants = existingParticipants.map((p) => {
        if (p.profile?.is_organizer) {
          return {
            ...p,
            profile: {
              ...p.profile,
              full_name: cleanName ? `${cleanName} (Host)` : p.profile.full_name,
              email: cleanEmail || p.profile.email,
            },
          };
        }
        return p;
      });
      saveStoredMeetingData(meeting.id, updatedParticipants);
      saveStoredMeetingData(meeting.slug, updatedParticipants);
    }

    // 4. Trigger real-time broadcast and storage events for live UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('meetings_list_updated'));
      window.dispatchEvent(new Event('meeting_availability_updated'));

      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
        bc.postMessage({ type: 'MEETING_UPDATED', meetingId: meeting.id });
        bc.close();
      }
    }

    setIsSubmitting(false);
    onClose();
    onSuccess(updatedMeeting, cleanName, cleanEmail);
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
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-xs mb-1">
              <span>✏️</span>
              <span>{language === 'he' ? 'עריכת פרטי פגישה' : 'Edit Meeting Details'}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
              {language === 'he' ? 'עדכון פרטי הפגישה' : 'Update Meeting Details'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Meeting Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'כותרת הפגישה *' : 'Meeting Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'he' ? 'לדוגמה: ישיבת צוות שבועית' : 'e.g. Weekly Strategy Sync'}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
            />
          </div>

          {/* Meeting Purpose / Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מטרת הפגישה / תיאור (יוצג למשתתפים)' : 'Meeting Purpose / Description (shown to invitees)'}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'he' ? 'פרט את מטרת הפגישה, נושאים לדיון, או הנחיות למשתתפים...' : 'Detail the meeting purpose, agenda topics, or guidelines for invitees...'}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              💡 {language === 'he' ? 'תיאור זה מוצג בראש עמוד הרישום עבור המשתתפים.' : 'This description is shown at the top of the invitee registration page.'}
            </p>
          </div>

          {/* Meeting Status Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {language === 'he' ? 'סטטוס הפגישה' : 'Meeting Status'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('OPEN')}
                className={`py-2.5 px-4 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                  status === 'OPEN'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>{language === 'he' ? 'פתוחה לתיאום (OPEN)' : 'Open for Submissions'}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('SCHEDULED')}
                className={`py-2.5 px-4 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                  status === 'SCHEDULED'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/30'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                <span>{language === 'he' ? 'מתוזמנת (SCHEDULED)' : 'Scheduled / Finalized'}</span>
              </button>
            </div>
          </div>

          {/* Host Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'שם המארח (Host)' : 'Host Name'}
              </label>
              <input
                type="text"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder={language === 'he' ? 'שם המארח' : 'Host Full Name'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'דוא"ל המארח' : 'Host Email'}
              </label>
              <input
                type="email"
                value={organizerEmail}
                onChange={(e) => setOrganizerEmail(e.target.value)}
                placeholder="michael.liarzi@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Readonly Slug */}
          <div className="pt-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'מזהה הפגישה (UUID)' : 'Meeting Slug (ID)'}
            </label>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-500 dark:text-slate-400">
              {meeting.slug}
            </div>
          </div>

          {/* Submit Actions */}
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
              {isSubmitting
                ? (language === 'he' ? 'שומר שינויים...' : 'Saving Changes...')
                : (language === 'he' ? 'שמור שינויים ✓' : 'Save Changes ✓')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
