'use client';

import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import type { ParticipantWithDetails } from './MeetingHeatmap';

interface SearchParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantWithDetails[];
  onSelectParticipant: (participant: ParticipantWithDetails) => void;
}

export function SearchParticipantModal({
  isOpen,
  onClose,
  participants,
  onSelectParticipant,
}: SearchParticipantModalProps) {
  const { language, dir } = useLanguage();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return participants;
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      const name = (p.profile?.full_name || '').toLowerCase();
      const email = (p.profile?.email || '').toLowerCase();
      const company = (p.profile?.company || '').toLowerCase();
      return name.includes(q) || email.includes(q) || company.includes(q);
    });
  }, [participants, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn text-start"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shadow-inner">
              🔍
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {language === 'he' ? 'חיפוש ועריכת משתתף בפגישה' : 'Search & Edit Meeting Participant'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'he'
                  ? 'חפש לפי שם, כתובת דוא"ל או שם חברה ולחץ לעריכת פרטים'
                  : 'Search by name, email, or company and click to edit details'}
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

        {/* Search Input Box */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              language === 'he'
                ? '🔍 הקלד שם משתתף, מייל או חברה (למשל: אמיתי / gmail / משרד החקלאות)...'
                : '🔍 Type name, email, or company (e.g. Michael / gmail / SAP)...'
            }
            autoFocus
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute left-3 top-3 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            {language === 'he'
              ? `נמצאו ${filtered.length} משתתפים מתאימים מתוך ${participants.length}`
              : `Found ${filtered.length} matching participants out of ${participants.length}`}
          </span>
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            {language === 'he' ? 'לחץ על משתתף לעריכה' : 'Click participant to edit'}
          </span>
        </div>

        {/* Results List */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
              💬 {language === 'he' ? 'לא נמצאו משתתפים תואמים לחיפוש זה' : 'No participants match this search'}
            </div>
          ) : (
            filtered.map((p) => {
              const slotCount = p.availability?.length || 0;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectParticipant(p);
                    onClose();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {p.profile?.full_name || p.profile?.email}
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

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span>✉️ {p.profile?.email}</span>
                      {p.profile?.phone_number && <span>📞 {p.profile.phone_number}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        slotCount > 0
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      }`}
                    >
                      {slotCount > 0 ? `✓ ${slotCount} slots` : '⏳ 0 slots'}
                    </span>
                    <span className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                      ✏️
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
