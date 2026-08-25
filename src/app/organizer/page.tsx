'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import type { ParticipantWithDetails } from '@/components/MeetingHeatmap';
import { CreateMeetingModal } from '@/components/CreateMeetingModal';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';
import { EditMeetingModal } from '@/components/EditMeetingModal';
import { CalendarHeader } from '@/components/CalendarHeader';
import { CalendarSidebar } from '@/components/CalendarSidebar';
import { useLanguage } from '@/context/LanguageContext';
import {
  getStoredMeetingData,
  computeMeetingStats,
  getStoredMeetings,
  deleteStoredMeeting,
  isMeetingDeleted,
  syncLocalMeetingsToCloud,
  type TopTimeSlot,
} from '@/lib/meetingStore';

export interface ExtendedMeeting extends Meeting {
  totalParticipants?: number;
  submittedParticipants?: number;
  bestMatchPct?: number;
  bestMatchSlot?: string;
  topTimeSlots?: TopTimeSlot[];
}

export default function OrganizerDashboard() {
  const { t, dir, language } = useLanguage();
  const [meetings, setMeetings] = useState<ExtendedMeeting[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Delete & Edit modal state
  const [meetingToDelete, setMeetingToDelete] = useState<{ id: string; title: string; slug?: string } | null>(null);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const isRefreshingRef = useRef(false);

  // Refresh & Selection state
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Set<string>>(new Set());
  const [isRefreshingAny, setIsRefreshingAny] = useState(false);
  const [refreshingCardId, setRefreshingCardId] = useState<string | null>(null);

  const refreshMeetings = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      // Auto-sync any local meetings to cloud so all invitees can see them
      await syncLocalMeetingsToCloud(supabase);
      const stored = getStoredMeetings();
      const { data, error } = await supabase
        .from('meetings')
        .select('*, meeting_participants(*, profiles(*), availability_slots(*))')
        .order('id', { ascending: false });

      const map = new Map<string, ExtendedMeeting>();

      if (!error && data && data.length > 0) {
        (data as any[])
          .filter((m) => !isMeetingDeleted(m.id) && !isMeetingDeleted(m.slug))
          .forEach((m) => {
            let participants: ParticipantWithDetails[] = [];
            if (m.meeting_participants && m.meeting_participants.length > 0) {
              participants = m.meeting_participants.map((mp: any) => ({
                id: mp.id,
                meeting_id: mp.meeting_id,
                profile_id: mp.profile_id,
                is_required: mp.is_required !== false,
                profile: mp.profiles,
                availability: (mp.availability_slots || []).map((s: any) => {
                  let slotKey = s.slot_key;
                  if (!slotKey && s.start_time) {
                    const d = new Date(s.start_time);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    slotKey = `${y}-${m}-${day}_${timeStr}`;
                  }
                  return { ...s, slot_key: slotKey };
                }),
              }));
            }

            // Fallback or merge with local store
            if (participants.length === 0) {
              participants =
                getStoredMeetingData(m.id) ||
                getStoredMeetingData(m.slug) ||
                getStoredMeetingData(decodeURIComponent(m.slug)) ||
                [];
            }

            map.set(m.id, { ...m, ...computeMeetingStats(participants) });
          });
      }

      // Merge local meetingStore meetings so user-created meetings never disappear
      stored
        .filter((m) => !isMeetingDeleted(m.id) && !isMeetingDeleted(m.slug))
        .forEach((m) => {
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
        stored
          .filter((m) => !isMeetingDeleted(m.id) && !isMeetingDeleted(m.slug))
          .map((m) => ({
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
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refreshMeetings();
  }, [refreshMeetings]);

  // Listen for real-time live availability submissions with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    const debouncedRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refreshMeetings();
      }, 300);
    };

    window.addEventListener('meeting_availability_updated', debouncedRefresh);
    window.addEventListener('meetings_list_updated', debouncedRefresh);
    window.addEventListener('storage', debouncedRefresh);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('meeting_scheduler_live_sync_v1');
      bc.onmessage = () => {
        debouncedRefresh();
      };
    }

    const channel = supabase
      .channel('rt_dashboard_slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, () => {
        debouncedRefresh();
      })
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('meeting_availability_updated', debouncedRefresh);
      window.removeEventListener('meetings_list_updated', debouncedRefresh);
      window.removeEventListener('storage', debouncedRefresh);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [refreshMeetings]);

  const handleCreateSuccess = (newMeeting: Meeting) => {
    const extendedNew: ExtendedMeeting = {
      ...newMeeting,
      totalParticipants: 1,
      submittedParticipants: 1,
      bestMatchPct: 100,
      bestMatchSlot: 'Pending Responses',
      topTimeSlots: [],
    };
    setMeetings((prev) => [extendedNew, ...prev.filter((m) => m.id !== newMeeting.id)]);
    showToast(`Meeting "${newMeeting.title}" created successfully!`);
  };

  const confirmDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    const { id: meetingId, title, slug } = meetingToDelete;

    // 1. Delete from local meetingStore & blacklist immediately
    deleteStoredMeeting(meetingId);
    if (slug) deleteStoredMeeting(slug);

    // 2. Attempt Supabase DB cascading delete
    try {
      await (supabase.from('meeting_participants') as any).delete().eq('meeting_id', meetingId);
      await (supabase.from('meetings') as any).delete().or(`id.eq.${meetingId},slug.eq.${meetingId}`);
    } catch (err) {
      console.warn('Supabase DB delete warning:', err);
    }

    // 3. UI state update
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId && m.slug !== meetingId && (!slug || m.slug !== slug)));
    setMeetingToDelete(null);
    showToast(language === 'he' ? `הפגישה "${title}" נמחקה בהצלחה` : `Meeting "${title}" deleted successfully`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyShareLink = (slug: string) => {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    showToast(t('detail.linkCopied'));
  };

  const openMeetings = meetings.filter((m) => m.status === 'OPEN');
  const openMeetingsCount = openMeetings.length;
  const allOpenSelected = openMeetingsCount > 0 && openMeetings.every((m) => selectedMeetingIds.has(m.id));

  const toggleSelectMeeting = (id: string) => {
    setSelectedMeetingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllOpen = () => {
    if (allOpenSelected) {
      setSelectedMeetingIds(new Set());
    } else {
      const next = new Set<string>();
      openMeetings.forEach((m) => next.add(m.id));
      setSelectedMeetingIds(next);
    }
  };

  const handleRefreshAllOpen = async () => {
    setIsRefreshingAny(true);
    await refreshMeetings();
    showToast(
      language === 'he'
        ? `רועננו בהצלחה ${openMeetingsCount} פגישות פתוחות`
        : `Successfully refreshed ${openMeetingsCount} open meetings`
    );
    setIsRefreshingAny(false);
  };

  const handleRefreshSelected = async () => {
    if (selectedMeetingIds.size === 0) return;
    setIsRefreshingAny(true);
    await refreshMeetings();
    const count = selectedMeetingIds.size;
    showToast(
      language === 'he'
        ? `רועננו בהצלחה ${count} פגישות נבחרות`
        : `Successfully refreshed ${count} selected meetings`
    );
    setIsRefreshingAny(false);
    setSelectedMeetingIds(new Set());
  };

  const handleRefreshSingle = async (m: ExtendedMeeting) => {
    setRefreshingCardId(m.id);
    await refreshMeetings();
    showToast(
      language === 'he'
        ? `רועננה בהצלחה הפגישה: "${m.title}"`
        : `Successfully refreshed meeting: "${m.title}"`
    );
    setRefreshingCardId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors" dir={dir}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 ${dir === 'rtl' ? 'left-6' : 'right-6'} z-50 px-4 py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm shadow-xl shadow-emerald-500/20 animate-bounce`}>
          ✓ {toastMessage}
        </div>
      )}

      {/* Calendar Header Bar */}
      <CalendarHeader
        currentDate={selectedDate}
        onToday={() => setSelectedDate(new Date())}
      />

      {/* Main Calendar Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Left Sidebar */}
        <CalendarSidebar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onCreateClick={() => setIsModalOpen(true)}
        />

        {/* Content Area: Meetings List & Dashboard */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto space-y-8">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
                {t('dashboard.title')}
              </h1>
              <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs md:text-sm">
                {t('dashboard.subtitle')}
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs md:text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>✨</span>
              <span>{language === 'he' ? '+ צור פגישה חדשה' : '+ Create New Meeting'}</span>
            </button>
          </div>

          {/* Real-Time Refresh Control Bar for Open Meetings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-colors">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{language === 'he' ? 'רענון פגישות פתוחות:' : 'Refresh Open Meetings:'}</span>
              </span>

              {/* Option 1: Refresh All Open Meetings */}
              <button
                onClick={handleRefreshAllOpen}
                disabled={isRefreshingAny || openMeetingsCount === 0}
                className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-blue-200 dark:border-blue-800 shadow-xs disabled:opacity-50"
                title={language === 'he' ? 'רענן נתונים של כל הפגישות הציבוריות הפתוחות' : 'Refresh data for all active open meetings'}
              >
                <span className={isRefreshingAny ? 'animate-spin' : ''}>🔄</span>
                <span>
                  {language === 'he'
                    ? `רענן את כל הפגישות הפתוחות (${openMeetingsCount})`
                    : `Refresh All Open Meetings (${openMeetingsCount})`}
                </span>
              </button>

              {/* Option 2: Refresh Selected Open Meetings */}
              {selectedMeetingIds.size > 0 && (
                <button
                  onClick={handleRefreshSelected}
                  disabled={isRefreshingAny}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 shadow-xs animate-fadeIn"
                >
                  <span className={isRefreshingAny ? 'animate-spin' : ''}>☑️</span>
                  <span>
                    {language === 'he'
                      ? `רענן ${selectedMeetingIds.size} פגישות נבחרות`
                      : `Refresh ${selectedMeetingIds.size} Selected Meetings`}
                  </span>
                </button>
              )}
            </div>

            {/* Select All Toggle */}
            {openMeetingsCount > 0 && (
              <button
                onClick={toggleSelectAllOpen}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold underline transition-colors"
              >
                {allOpenSelected
                  ? (language === 'he' ? 'בטל בחירה' : 'Deselect All')
                  : (language === 'he' ? `בחר את כל הפתוחות (${openMeetingsCount})` : `Select All Open (${openMeetingsCount})`)}
              </button>
            )}
          </div>

          {/* Meetings Cards Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {t('dashboard.yourMeetings')} ({meetings.length})
              </h2>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                {t('dashboard.liveSync')}
              </span>
            </div>

            {loading ? (
              <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
                Loading meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
                <div className="text-4xl">📅</div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No meetings created yet</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                  Your workspace is clean. Click below to create your first meeting, set up your schedule, and generate shareable invite links!
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                >
                  {t('dashboard.createBtn')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {meetings.map((m) => {
                  const total = m.totalParticipants || 1;
                  const submitted = m.submittedParticipants || 0;
                  const responsePct = Math.round((submitted / total) * 100);

                  return (
                    <div
                      key={m.id}
                      className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 transition-all shadow-sm hover:shadow-md dark:shadow-xl flex flex-col justify-between space-y-6 group relative overflow-hidden"
                    >
                      <div className="space-y-4">
                        {/* Status, ID & Action Icons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {m.status === 'OPEN' && (
                              <input
                                type="checkbox"
                                checked={selectedMeetingIds.has(m.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelectMeeting(m.id);
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                title={language === 'he' ? 'בחר פגישה זו לרענון' : 'Select this meeting for refresh'}
                              />
                            )}
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                m.status === 'OPEN'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                              }`}
                            >
                              ● {m.status === 'OPEN' ? t('dashboard.statusOpen') : t('dashboard.statusScheduled')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">ID: {m.id.substring(0, 8)}</span>
                            {m.status === 'OPEN' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRefreshSingle(m);
                                }}
                                disabled={refreshingCardId === m.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                title={language === 'he' ? 'רענן נתוני פגישה זו' : 'Refresh this meeting data'}
                              >
                                <span className={refreshingCardId === m.id ? 'animate-spin inline-block' : ''}>🔄</span>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMeetingToEdit(m);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                              title={language === 'he' ? 'ערוך פרטי פגישה' : 'Edit meeting details'}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMeetingToDelete({ id: m.id, title: m.title, slug: m.slug });
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete meeting"
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {/* Title & Slug */}
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                          {m.title}
                        </h3>

                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 font-mono text-xs text-blue-600 dark:text-blue-400 truncate">
                          /{m.slug}
                        </div>

                        {/* Response Rate Stats & Progress Bar */}
                        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.responses')}:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {submitted} / {total} ({responsePct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all"
                              style={{ width: `${responsePct}%` }}
                            />
                          </div>
                        </div>

                        {/* Top 3 Available Times (90%+) Section */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {language === 'he' ? '3 חלונות זמן מובילים (90%+):' : 'Top 3 Available Times (90%+):'}
                            </span>
                            {m.topTimeSlots && m.topTimeSlots.length > 0 && (
                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                {m.topTimeSlots.length} {language === 'he' ? 'חלונות' : 'found'}
                              </span>
                            )}
                          </div>

                          {!m.topTimeSlots || m.topTimeSlots.length === 0 ? (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-400 text-center">
                              {language === 'he' ? 'טרם נמצאו חלונות זמן של 90% ומעלה' : 'No slots with 90%+ availability yet'}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {m.topTimeSlots.map((slot, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs hover:border-emerald-500/40 transition-colors"
                                >
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                                      <span>📅</span> {language === 'he' ? slot.dateStrHe : slot.dateStrEn}
                                    </div>
                                    <div className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                      ⏰ {language === 'he' ? slot.timeRangeHe : slot.timeRangeEn}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm">
                                      🟢 {slot.pct}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                        <a
                          href={`/meetings/${m.slug}`}
                          className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold text-center transition-colors shadow-sm"
                        >
                          {t('dashboard.viewHeatmap')}
                        </a>
                        <button
                          onClick={() => copyShareLink(m.slug)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-colors"
                          title={t('dashboard.copyLink')}
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Create Meeting Modal */}
      <CreateMeetingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Delete Confirmation Modal (Green Yes, Red No) */}
      <DeleteConfirmationModal
        isOpen={!!meetingToDelete}
        meetingTitle={meetingToDelete?.title || ''}
        onConfirm={confirmDeleteMeeting}
        onCancel={() => setMeetingToDelete(null)}
      />

      {/* Edit Meeting Details Modal */}
      <EditMeetingModal
        isOpen={!!meetingToEdit}
        meeting={meetingToEdit}
        onClose={() => setMeetingToEdit(null)}
        onSuccess={(updatedMeeting) => {
          setMeetings((prev) =>
            prev.map((m) => {
              if (m.id === updatedMeeting.id || m.slug === updatedMeeting.slug) {
                return {
                  ...m,
                  ...updatedMeeting,
                };
              }
              return m;
            })
          );
          showToast(language === 'he' ? 'פרטי הפגישה עודכנו בהצלחה' : 'Meeting details updated successfully');
        }}
      />
    </div>
  );
}
