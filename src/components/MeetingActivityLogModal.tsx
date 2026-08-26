'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { getMeetingActivityLogs, type MeetingActivityLog } from '@/lib/meetingStore';
import type { ParticipantWithDetails } from './MeetingHeatmap';

interface MeetingActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingSlug?: string;
  participants: ParticipantWithDetails[];
}

export function MeetingActivityLogModal({
  isOpen,
  onClose,
  meetingId,
  meetingSlug,
  participants,
}: MeetingActivityLogModalProps) {
  const { language, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'EMAILS' | 'AVAILABILITY'>('EMAILS');
  const [logs, setLogs] = useState<MeetingActivityLog[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadLogs = () => {
      const idLogs = getMeetingActivityLogs(meetingId);
      const slugLogs = meetingSlug ? getMeetingActivityLogs(meetingSlug) : [];
      
      const mergedMap = new Map<string, MeetingActivityLog>();
      [...idLogs, ...slugLogs].forEach((l) => {
        if (!mergedMap.has(l.id)) {
          mergedMap.set(l.id, l);
        }
      });

      const sorted = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLogs(sorted);
    };

    loadLogs();

    const handleUpdate = () => loadLogs();
    window.addEventListener('meeting_activity_log_updated', handleUpdate);
    return () => {
      window.removeEventListener('meeting_activity_log_updated', handleUpdate);
    };
  }, [isOpen, meetingId, meetingSlug]);

  const emailLogs = useMemo(() => {
    return logs.filter((l) => l.type === 'EMAIL_INVITE' || l.type === 'EMAIL_REMINDER');
  }, [logs]);

  const availabilityLogs = useMemo(() => {
    return logs.filter((l) => l.type === 'AVAILABILITY_ADDED' || l.type === 'AVAILABILITY_UPDATED');
  }, [logs]);

  if (!isOpen) return null;

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn text-start"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden transition-all max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shadow-inner">
              📜
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {language === 'he' ? 'יומן פגישה – מיילים ודיווחי זמינות' : 'Meeting Activity & Email Audit Log'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'he'
                  ? 'תיעוד מפורט של שליחת זימונים, תזכורות ומועדי הזנת זמינות של משתתפים'
                  : 'Track email invites, reminders, and participant availability submission timestamps'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 shrink-0">
          <button
            onClick={() => setActiveTab('EMAILS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'EMAILS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>✉️</span>
            <span>
              {language === 'he' ? 'זימונים ותזכורות' : 'Emails & Reminders'} ({emailLogs.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('AVAILABILITY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'AVAILABILITY'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>📅</span>
            <span>
              {language === 'he' ? 'דיווחי זמינות משתתפים' : 'Participant Submissions'} ({participants.length})
            </span>
          </button>
        </div>

        {/* Tab 1: Emails & Reminders */}
        {activeTab === 'EMAILS' && (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {emailLogs.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
                💬 {language === 'he' ? 'טרם נרשמה היסטוריית שליחת מיילים או תזכורות בפגישה זו' : 'No email invitation or reminder logs recorded yet for this meeting.'}
              </div>
            ) : (
              emailLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        log.type === 'EMAIL_INVITE'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {log.type === 'EMAIL_INVITE'
                        ? (language === 'he' ? '✉️ זימון במייל' : '✉️ Invitation Email')
                        : (language === 'he' ? '⏰ תזכורת במייל' : '⏰ Reminder Email')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      🕒 {formatDate(log.created_at)}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {log.details}
                  </p>

                  {log.recipient_email && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 break-all">
                      <strong className="text-slate-700 dark:text-slate-300">
                        {language === 'he' ? 'נמענים:' : 'Recipients:'}
                      </strong>{' '}
                      {log.recipient_email}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Participant Submissions Timestamps */}
        {activeTab === 'AVAILABILITY' && (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {participants.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
                💬 {language === 'he' ? 'אין משתתפים בפגישה זו' : 'No participants in this meeting yet.'}
              </div>
            ) : (
              participants.map((p) => {
                const pEmail = (p.profile?.email || '').trim().toLowerCase();
                const pName = p.profile?.full_name || pEmail;
                const slotCount = p.availability?.length || 0;

                // Find first submission and last update logs for this participant
                const pLogs = availabilityLogs.filter(
                  (l) => (l.recipient_email || '').trim().toLowerCase() === pEmail
                );
                const firstLog = pLogs.find((l) => l.type === 'AVAILABILITY_ADDED') || pLogs[pLogs.length - 1];
                const lastLog = pLogs[0];

                // Extract earliest and latest slot timestamps from Supabase DB
                let firstSlotTime: string | null = null;
                let lastSlotTime: string | null = null;
                if (p.availability && p.availability.length > 0) {
                  const sorted = [...p.availability].sort((a, b) => {
                    const tA = new Date(a.start_time || (a as any).created_at || 0).getTime();
                    const tB = new Date(b.start_time || (b as any).created_at || 0).getTime();
                    return tA - tB;
                  });
                  firstSlotTime = sorted[0]?.start_time || (sorted[0] as any)?.created_at || null;
                  lastSlotTime = sorted[sorted.length - 1]?.start_time || (sorted[sorted.length - 1] as any)?.created_at || null;
                }

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {pName}
                        </span>
                        {p.profile?.is_organizer && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                            {language === 'he' ? 'מארח' : 'Host'}
                          </span>
                        )}
                        {p.profile?.company && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium">
                            🏢 {p.profile.company}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          slotCount > 0
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        }`}
                      >
                        {slotCount > 0 ? `✓ ${slotCount} משבצות (slots)` : '⏳ 0 slots'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      ✉️ {pEmail}
                    </p>

                    {/* Submission Timestamps */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          🕒 {language === 'he' ? 'זמן דיווח ראשון / מוקדם:' : 'First / Earliest Submission:'}
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                          {firstLog ? formatDate(firstLog.created_at) : (firstSlotTime ? formatDate(firstSlotTime) : '-')}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          🔄 {language === 'he' ? 'עדכון אחרון / מאוחר:' : 'Latest Update:'}
                        </span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                          {lastLog ? formatDate(lastLog.created_at) : (lastSlotTime ? formatDate(lastSlotTime) : '-')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
