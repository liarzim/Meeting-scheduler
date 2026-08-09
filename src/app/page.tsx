'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import type { Meeting, MeetingStatus } from '@/types';
import {
  getStoredMeetings,
  getStoredMeetingData,
  computeMeetingStats,
  updateMeetingStatus,
  normalizeKey,
} from '@/lib/meetingStore';

export interface ExtendedMeeting extends Meeting {
  totalParticipants?: number;
  submittedParticipants?: number;
  bestMatchPct?: number;
  bestMatchSlot?: string;
}

export default function Home() {
  const { t, dir, language } = useLanguage();
  const [meetings, setMeetings] = useState<ExtendedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isHebrew = language === 'he';

  const schemaTables = [
    {
      name: 'profiles',
      columns: ['id (UUID, PK)', 'email (TEXT, Unique)', 'full_name (TEXT)', 'company (TEXT)', 'phone_number (TEXT)', 'is_organizer (BOOLEAN)'],
    },
    {
      name: 'meetings',
      columns: ['id (UUID, PK)', 'organizer_id (UUID, FK)', 'title (TEXT)', 'slug (TEXT, Unique Index)', 'status (ENUM: OPEN, SCHEDULED, COMPLETED, CANCELLED)'],
    },
    {
      name: 'meeting_participants',
      columns: ['id (UUID, PK)', 'meeting_id (UUID, FK)', 'profile_id (UUID, FK)', 'is_required (BOOLEAN)'],
    },
    {
      name: 'availability_slots',
      columns: ['id (UUID, PK)', 'participant_id (UUID, FK)', 'start_time (TIMESTAMPTZ)', 'end_time (TIMESTAMPTZ)'],
    },
  ];

  const loadMeetings = async () => {
    try {
      const stored = getStoredMeetings();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('id', { ascending: false });

      const map = new Map<string, ExtendedMeeting>();

      if (!error && data && data.length > 0) {
        (data as Meeting[]).forEach((m) => {
          const storedSlots =
            getStoredMeetingData(m.id) ||
            getStoredMeetingData(m.slug) ||
            getStoredMeetingData(decodeURIComponent(m.slug)) ||
            [];
          map.set(m.id, { ...m, ...computeMeetingStats(storedSlots) });
        });
      }

      // Merge local meetingStore meetings
      stored.forEach((m) => {
        if (!map.has(m.id)) {
          const storedSlots =
            getStoredMeetingData(m.id) ||
            getStoredMeetingData(m.slug) ||
            getStoredMeetingData(decodeURIComponent(m.slug)) ||
            [];
          map.set(m.id, { ...m, ...computeMeetingStats(storedSlots) });
        }
      });

      setMeetings(Array.from(map.values()));
    } catch {
      const stored = getStoredMeetings();
      setMeetings(
        stored.map((m) => ({
          ...m,
          ...computeMeetingStats(
            getStoredMeetingData(m.id) ||
              getStoredMeetingData(m.slug) ||
              getStoredMeetingData(decodeURIComponent(m.slug)) ||
              []
          ),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  // Listen for real-time live updates
  useEffect(() => {
    const handleUpdate = () => {
      loadMeetings();
    };

    window.addEventListener('meetings_list_updated', handleUpdate);
    window.addEventListener('meeting_availability_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
      bc.onmessage = () => {
        handleUpdate();
      };
    }

    return () => {
      window.removeEventListener('meetings_list_updated', handleUpdate);
      window.removeEventListener('meeting_availability_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (bc) bc.close();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStatusChange = async (meetingId: string, newStatus: MeetingStatus) => {
    // 1. Update in local meetingStore
    updateMeetingStatus(meetingId, newStatus);

    // 2. Update in Supabase DB
    try {
      const norm = normalizeKey(meetingId);
      await (supabase.from('meetings') as any)
        .update({ status: newStatus })
        .or(`id.eq.${norm},slug.eq.${norm}`);
    } catch (err) {
      console.warn('Supabase status update warning:', err);
    }

    // 3. Update local state
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId || m.slug === meetingId ? { ...m, status: newStatus } : m))
    );

    const statusLabels: Record<MeetingStatus, string> = {
      OPEN: isHebrew ? 'פתוח (Open)' : 'Open',
      SCHEDULED: isHebrew ? 'מתוזמן (Scheduled)' : 'Scheduled',
      COMPLETED: isHebrew ? 'הושלם (Completed)' : 'Completed',
      CANCELLED: isHebrew ? 'בוטל (Cancelled)' : 'Cancelled',
    };

    showToast(
      isHebrew
        ? `סטטוס הפגישה עודכן ל: ${statusLabels[newStatus]}`
        : `Meeting status updated to: ${statusLabels[newStatus]}`
    );
  };

  const getStatusBadgeClass = (status: MeetingStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'SCHEDULED':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'COMPLETED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'CANCELLED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center" dir={dir}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 ${dir === 'rtl' ? 'left-6' : 'right-6'} z-50 px-4 py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm shadow-xl shadow-emerald-500/20 animate-bounce`}>
          ✓ {toastMessage}
        </div>
      )}

      <div className="max-w-6xl w-full space-y-10">
        {/* Header */}
        <header className="border-b border-slate-800 pb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {isHebrew ? 'מערכת תיאום פגישות רב-משתתפים' : 'Multi-tenant Meeting Coordination Platform'}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {isHebrew ? 'מתאם הפגישות החכם' : 'Meeting Scheduler'}
            </h1>
            <p className="mt-2 text-slate-400 text-sm md:text-base">
              {isHebrew
                ? 'ניהול תזמוני פגישות, מפות חום קבוצתיות ועדכון סטטוסים בזמן אמת'
                : 'Meeting coordination, group availability heatmaps, and real-time status management'}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <LanguageToggle />
            <Link
              href="/organizer"
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
            >
              🚀 {t('nav.dashboard')}
            </Link>
          </div>
        </header>

        {/* Live Meetings & Status Management Table */}
        <section className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                <span>📋</span>
                <span>{isHebrew ? 'טבלת פגישות ועדכון סטטוס חי' : 'Live Meetings & Status Management Table'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isHebrew
                  ? 'צפה בכל הפגישות במערכת ושנה את הסטטוס שלהן ישירות מהטבלה'
                  : 'View all meetings and update their statuses directly from this table'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                {meetings.length} {isHebrew ? 'פגישות' : 'Meetings'}
              </span>
              <Link
                href="/organizer"
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                + {isHebrew ? 'צור פגישה חדשה' : 'Create Meeting'}
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              Loading meetings data...
            </div>
          ) : meetings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-3">
              <div className="text-3xl">📅</div>
              <p className="text-sm">{isHebrew ? 'אין פגישות פעילות כרגע' : 'No meetings created yet'}</p>
              <Link
                href="/organizer"
                className="inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                {isHebrew ? 'פתח את לוח הבקרה ליצירת פגישה' : 'Open Dashboard to Create One'}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" dir={dir}>
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 px-3">{isHebrew ? 'שם הפגישה' : 'Meeting Title'}</th>
                    <th className="pb-3 px-3">{isHebrew ? 'קישור / מזהה' : 'Link / ID'}</th>
                    <th className="pb-3 px-3">{isHebrew ? 'תגובות' : 'Responses'}</th>
                    <th className="pb-3 px-3">{isHebrew ? 'סטטוס נוכחי ועדכון' : 'Status & Update'}</th>
                    <th className="pb-3 px-3 text-right">{isHebrew ? 'פעולות' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {meetings.map((m) => {
                    const total = m.totalParticipants || 1;
                    const submitted = m.submittedParticipants || 0;
                    const responsePct = Math.round((submitted / total) * 100);

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Title */}
                        <td className="py-4 px-3 font-bold text-slate-100 max-w-[200px] truncate">
                          {m.title}
                        </td>

                        {/* Slug Link */}
                        <td className="py-4 px-3 font-mono text-xs text-blue-400 max-w-[180px] truncate">
                          <Link href={`/${m.slug}`} className="hover:underline" title="Open invitee link">
                            /{m.slug.substring(0, 14)}...
                          </Link>
                        </td>

                        {/* Responses */}
                        <td className="py-4 px-3">
                          <span className="font-mono font-bold text-slate-300">
                            {submitted} / {total} ({responsePct}%)
                          </span>
                        </td>

                        {/* Status Dropdown & Badge */}
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={m.status || 'OPEN'}
                              onChange={(e) => handleStatusChange(m.id, e.target.value as MeetingStatus)}
                              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer outline-none bg-slate-950 ${getStatusBadgeClass(
                                m.status || 'OPEN'
                              )}`}
                            >
                              <option value="OPEN">🟢 {isHebrew ? 'OPEN (פתוח)' : 'OPEN'}</option>
                              <option value="SCHEDULED">🔵 {isHebrew ? 'SCHEDULED (מתוזמן)' : 'SCHEDULED'}</option>
                              <option value="COMPLETED">🟣 {isHebrew ? 'COMPLETED (הושלם)' : 'COMPLETED'}</option>
                              <option value="CANCELLED">🔴 {isHebrew ? 'CANCELLED (בוטל)' : 'CANCELLED'}</option>
                            </select>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/meetings/${m.slug}`}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                            >
                              {isHebrew ? 'צפה במפת חום' : 'View Heatmap'}
                            </Link>
                            <Link
                              href={`/${m.slug}`}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors"
                            >
                              {isHebrew ? 'הזמנה' : 'Invite Link'}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Database Canonical Model Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-200">Canonical Data Schema</h2>
            <span className="text-xs text-slate-500 font-mono">init.sql &amp; types.ts</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schemaTables.map((table) => (
              <div
                key={table.name}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-mono font-bold text-indigo-400">
                    {table.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/50 text-indigo-300 font-mono">
                    Table
                  </span>
                </div>
                <ul className="space-y-2">
                  {table.columns.map((col) => (
                    <li
                      key={col}
                      className="text-sm font-mono text-slate-300 flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded border border-slate-800/60"
                    >
                      <span className="text-slate-500">›</span>
                      {col}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
