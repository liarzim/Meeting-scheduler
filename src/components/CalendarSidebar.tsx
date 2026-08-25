'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { MiniMonthCalendar } from './MiniMonthCalendar';
import type { ParticipantWithDetails } from './MeetingHeatmap';

interface CalendarSidebarProps {
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
  onCreateClick?: () => void;
  participants?: ParticipantWithDetails[];
  onToggleRequired?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
  onAddParticipant?: (name: string, email: string) => void;
  onOpenEmailModal?: () => void;
  onOpenPastParticipantsModal?: () => void;
  onEditParticipant?: (participant: ParticipantWithDetails) => void;
}

export function CalendarSidebar({
  selectedDate,
  onSelectDate,
  onCreateClick,
  participants,
  onToggleRequired,
  onRemoveParticipant,
  onAddParticipant,
  onOpenEmailModal,
  onOpenPastParticipantsModal,
  onEditParticipant,
}: CalendarSidebarProps) {
  const { t, dir, language } = useLanguage();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    if (onAddParticipant) {
      onAddParticipant(newName, newEmail);
      setNewName('');
      setNewEmail('');
    }
  };

  return (
    <aside
      dir={dir}
      className="w-72 shrink-0 bg-white dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800/80 p-4 space-y-6 flex flex-col hidden lg:block select-none overflow-y-auto max-h-screen transition-colors"
    >
      {/* Create Button */}
      {onCreateClick && (
        <button
          onClick={onCreateClick}
          className="w-full py-3 px-5 rounded-full bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-white font-bold text-sm flex items-center justify-center gap-3 shadow-sm dark:shadow-lg dark:shadow-blue-500/10 transition-all transform hover:-translate-y-0.5 group"
        >
          <span className="text-xl bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
            +
          </span>
          <span>{t('modal.createTitle')}</span>
        </button>
      )}

      {/* Mini Month Calendar */}
      <MiniMonthCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />

      {/* Participants List Panel */}
      {participants && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('detail.participantsTitle')}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('detail.participantsHelp')}
              </p>
            </div>
            <span suppressHydrationWarning className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold">
              {participants.length}
            </span>
          </div>

          {/* Participant Cards */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {participants.filter(Boolean).map((p) => {
              const slotCount = p?.availability?.length || 0;
              return (
                <div
                  key={p.id || Math.random().toString()}
                  onClick={() => onEditParticipant && onEditParticipant(p)}
                  className={`p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-all flex items-center justify-between gap-2 ${
                    onEditParticipant ? 'cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-900' : ''
                  }`}
                  title={language === 'he' ? 'לחץ לצפייה ועריכת פרטי המשתתף' : 'Click to view & edit participant details'}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-200 text-xs truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {p.profile?.full_name || p.profile?.email || 'Anonymous Guest'}
                      </span>
                      {p.profile?.is_organizer && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold">
                          {t('detail.hostTag')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-[10px] text-slate-500 truncate font-mono">{p.profile?.email}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        slotCount > 0
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                          : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                      }`}>
                        {slotCount > 0 ? `✓ ${slotCount} slots` : '⏳ 0 slots'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onEditParticipant && (
                      <button
                        type="button"
                        onClick={() => onEditParticipant(p)}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors text-xs"
                        title={language === 'he' ? 'ערוך פרטי משתתף' : 'Edit participant details'}
                      >
                        ✏️
                      </button>
                    )}

                    {onToggleRequired && (
                      <button
                        type="button"
                        onClick={() => onToggleRequired(p.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                          p.is_required
                            ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {p.is_required ? t('detail.requiredBtn') : t('detail.optionalBtn')}
                      </button>
                    )}

                    {!p.profile?.is_organizer && onRemoveParticipant && (
                      <button
                        type="button"
                        onClick={() => onRemoveParticipant(p.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-xs"
                        title={language === 'he' ? 'הסר משתתף' : 'Remove participant'}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Participant Form */}
          {onAddParticipant && (
            <form onSubmit={handleAddSubmit} className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('detail.inviteTitle')}
              </h4>
              <input
                type="text"
                placeholder={t('detail.namePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder={t('detail.emailPlaceholder')}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors border border-slate-300 dark:border-slate-700"
              >
                {t('detail.addPartBtn')}
              </button>
            </form>
          )}

          {onOpenPastParticipantsModal && (
            <button
              onClick={onOpenPastParticipantsModal}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 shadow-xs"
            >
              <span>👥</span>
              <span>{language === 'he' ? 'הוסף משתתפים קודמים (לפי חברה)' : 'Add Past Participants (By Company)'}</span>
            </button>
          )}

          {onOpenEmailModal && (
            <button
              onClick={onOpenEmailModal}
              className="w-full py-2.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-purple-200 dark:border-purple-800 shadow-xs"
            >
              <span>📧</span>
              <span>{language === 'he' ? 'שלח זימון במייל' : 'Send Email Invites'}</span>
            </button>
          )}
        </div>
      )}

      {/* Calendars & Layers List */}
      {!participants && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {language === 'he' ? 'שכבות תצוגה' : 'My Calendars'}
          </h4>

          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex items-center gap-2.5">
              <input type="checkbox" defaultChecked className="rounded accent-blue-600 cursor-pointer" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              <span>{language === 'he' ? 'פגישות שלי (מארח)' : 'My Meetings (Host)'}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <input type="checkbox" defaultChecked className="rounded accent-emerald-500 cursor-pointer" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>{language === 'he' ? 'משתתפי חובה (≥90%)' : 'Required Participants (≥90%)'}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <input type="checkbox" defaultChecked className="rounded accent-amber-500 cursor-pointer" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span>{language === 'he' ? 'זמינות חלקית (≥80%)' : 'Partial Availability (≥80%)'}</span>
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
}
