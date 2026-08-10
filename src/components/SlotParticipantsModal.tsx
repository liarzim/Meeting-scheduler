'use client';

import React, { useState } from 'react';
import type { ParticipantWithDetails } from './MeetingHeatmap';
import { useLanguage } from '@/context/LanguageContext';

export interface SlotDetails {
  date: Date;
  timeString: string;
  displayString: string;
  endDisplayString: string;
  matchPct: number;
  availableCount: number;
  totalRequired: number;
  availableParticipants: ParticipantWithDetails[];
  unavailableParticipants: ParticipantWithDetails[];
}

interface SlotParticipantsModalProps {
  isOpen: boolean;
  meetingTitle?: string;
  slotDetails: SlotDetails | null;
  onClose: () => void;
}

export function SlotParticipantsModal({
  isOpen,
  meetingTitle = '',
  slotDetails,
  onClose,
}: SlotParticipantsModalProps) {
  const { t, dir, language } = useLanguage();
  const [copiedAvailable, setCopiedAvailable] = useState(false);
  const [copiedUnavailable, setCopiedUnavailable] = useState(false);
  const [copiedSingleEmail, setCopiedSingleEmail] = useState<string | null>(null);

  if (!isOpen || !slotDetails) return null;

  const {
    date,
    displayString,
    endDisplayString,
    matchPct,
    availableCount,
    totalRequired,
    availableParticipants,
    unavailableParticipants,
  } = slotDetails;

  const dateFormattedHe = date.toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dateFormattedEn = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dateStr = language === 'he' ? dateFormattedHe : dateFormattedEn;
  const timeRange = `${displayString} - ${endDisplayString}`;

  const cleanMeetingTitle = meetingTitle ? meetingTitle.split(':::')[0] : '';

  const handleCopyAvailableEmails = () => {
    const emails = availableParticipants
      .map((p) => p.profile?.email)
      .filter(Boolean)
      .join(', ');

    if (emails) {
      navigator.clipboard.writeText(emails);
      setCopiedAvailable(true);
      setTimeout(() => setCopiedAvailable(false), 2000);
    }
  };

  const handleCopyUnavailableEmails = () => {
    const emails = unavailableParticipants
      .map((p) => p.profile?.email)
      .filter(Boolean)
      .join(', ');

    if (emails) {
      navigator.clipboard.writeText(emails);
      setCopiedUnavailable(true);
      setTimeout(() => setCopiedUnavailable(false), 2000);
    }
  };

  const handleCopySingle = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedSingleEmail(email);
    setTimeout(() => setCopiedSingleEmail(null), 2000);
  };

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^0-9+]/g, '');
  };

  const getWhatsAppUrl = (phone?: string | null, participantName?: string) => {
    if (!phone) return null;
    let clean = phone.trim().replace(/[^0-9]/g, '');
    if (!clean) return null;

    // Normalize Israeli local mobile starting with 05... (e.g. 0522888491 -> 972522888491)
    if (clean.startsWith('05') && clean.length === 10) {
      clean = `972${clean.substring(1)}`;
    } else if (clean.startsWith('0') && clean.length === 9) {
      clean = `972${clean.substring(1)}`;
    } else if (clean.length === 9 && clean.startsWith('5')) {
      clean = `972${clean}`;
    }

    const greeting = language === 'he'
      ? `היי ${participantName || ''}, אני פונה אליך בנוגע לפגישה "${cleanMeetingTitle}" בתאריך ${dateStr} בשעה ${timeRange}.`
      : `Hi ${participantName || ''}, reaching out regarding our meeting "${cleanMeetingTitle}" on ${dateStr} at ${timeRange}.`;

    return `https://wa.me/${clean}?text=${encodeURIComponent(greeting)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto transform transition-all animate-scaleUp text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="space-y-2">
            {/* Meeting Name Header */}
            {cleanMeetingTitle && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-sm">
                <span>📌</span>
                <span className="truncate max-w-md">{cleanMeetingTitle}</span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold font-mono">
                ⏰ {timeRange}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold font-mono border ${
                  matchPct === 100
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                    : matchPct >= 70
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : matchPct >= 40
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                {matchPct === 100 ? '⭐ 100%' : `${Math.round(matchPct)}%`}{' '}
                {language === 'he' ? 'התאמה' : 'Match'} ({availableCount}/{totalRequired})
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white capitalize pt-0.5">
              📅 {dateStr}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Available Participants (זמינים) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>
                {language === 'he'
                  ? `משתתפים שסימנו זמינות (${availableParticipants.length})`
                  : `Available Participants (${availableParticipants.length})`}
              </span>
            </h3>

            {availableParticipants.length > 0 && (
              <button
                onClick={handleCopyAvailableEmails}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 shadow-sm"
              >
                <span>📋</span>
                <span>{copiedAvailable ? (language === 'he' ? 'הועתק!' : 'Copied!') : (language === 'he' ? 'העתק מיילים של הזמינים' : 'Copy Available Emails')}</span>
              </button>
            )}
          </div>

          {availableParticipants.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 text-center">
              {language === 'he'
                ? 'אף משתתף לא סימן זמינות בחלון זמן זה.'
                : 'No participants marked availability for this time slot.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableParticipants.map((p) => {
                const profile = p.profile;
                const name = profile?.full_name || profile?.email || 'Participant';
                const email = profile?.email || '';
                const phone = profile?.phone_number || '';
                const cleanPhone = getCleanPhone(phone);
                const waUrl = getWhatsAppUrl(phone, name);
                const company = profile?.company;
                const role = (profile as any)?.role;
                const isHost = profile?.is_organizer;

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5 hover:shadow-md transition-shadow text-start"
                  >
                    {/* Name & Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-emerald-100 flex items-center gap-1.5 flex-wrap">
                          <span>{name}</span>
                          {isHost && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                              🌟 {language === 'he' ? 'מארח (Host)' : 'Host'}
                            </span>
                          )}
                        </div>
                        {role && (
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            💼 {role}
                          </div>
                        )}
                        {company && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            🏢 {company}
                          </div>
                        )}
                      </div>

                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                        ✓ {language === 'he' ? 'זמין' : 'Available'}
                      </span>
                    </div>

                    {/* Contact Details (Email, Phone, WhatsApp) */}
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 space-y-1.5 text-xs">
                      {email && (
                        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                          <a
                            href={`mailto:${email}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                            title="Send email"
                          >
                            ✉️ {email}
                          </a>
                          <button
                            onClick={() => handleCopySingle(email)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 text-[10px]"
                            title="Copy email"
                          >
                            {copiedSingleEmail === email ? '✓' : '📋'}
                          </button>
                        </div>
                      )}

                      {phone && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <a
                            href={`tel:${cleanPhone}`}
                            className="font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                          >
                            <span>📞</span> {phone}
                          </a>

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                            >
                              <span>💬 WhatsApp</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Unavailable / Not Responded Participants (לא זמינים / טרם השיבו) */}
        {unavailableParticipants.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                <span>
                  {language === 'he'
                    ? `משתתפים שלא סימנו זמינות בחלון זה (${unavailableParticipants.length})`
                    : `Unavailable / No Response (${unavailableParticipants.length})`}
                </span>
              </h3>

              <button
                onClick={handleCopyUnavailableEmails}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <span>📋</span>
                <span>{copiedUnavailable ? (language === 'he' ? 'הועתק!' : 'Copied!') : (language === 'he' ? 'העתק מיילים של הלא זמינים' : 'Copy Unavailable Emails')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unavailableParticipants.map((p) => {
                const profile = p.profile;
                const name = profile?.full_name || profile?.email || 'Participant';
                const email = profile?.email || '';
                const phone = profile?.phone_number || '';
                const cleanPhone = getCleanPhone(phone);
                const waUrl = getWhatsAppUrl(phone, name);
                const company = profile?.company;
                const role = (profile as any)?.role;
                const hasAnySlots = (p.availability?.length || 0) > 0;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2 opacity-90 hover:opacity-100 transition-opacity text-start"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-200">
                          {name}
                        </div>
                        {company && (
                          <div className="text-[10px] text-slate-500">
                            🏢 {company} {role ? `• ${role}` : ''}
                          </div>
                        )}
                      </div>

                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                        {hasAnySlots
                          ? language === 'he'
                            ? 'לא פנוי'
                            : 'Not free'
                          : language === 'he'
                          ? 'טרם השיב'
                          : 'Pending'}
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/60 space-y-1 text-[11px] font-mono">
                      {email && (
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={`mailto:${email}`}
                            className="text-slate-600 dark:text-slate-400 hover:text-blue-500 truncate"
                          >
                            ✉️ {email}
                          </a>
                          <button
                            onClick={() => handleCopySingle(email)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 text-[10px]"
                            title="Copy email"
                          >
                            {copiedSingleEmail === email ? '✓' : '📋'}
                          </button>
                        </div>
                      )}
                      {phone && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <a
                            href={`tel:${cleanPhone}`}
                            className="text-slate-600 dark:text-slate-400 hover:text-blue-500"
                          >
                            📞 {phone}
                          </a>

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold transition-colors flex items-center gap-1"
                            >
                              <span>💬 WhatsApp</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
          >
            {language === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
