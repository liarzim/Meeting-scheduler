'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { fetchPastParticipants, type PastParticipantProfile } from '@/lib/pastParticipants';
import type { ParticipantWithDetails } from './MeetingHeatmap';

interface AddPastParticipantsModalProps {
  isOpen: boolean;
  existingParticipants: ParticipantWithDetails[];
  onClose: () => void;
  onAddParticipants: (selectedList: { name: string; email: string; company?: string; role?: string; isRequired: boolean }[]) => void;
}

export function AddPastParticipantsModal({
  isOpen,
  existingParticipants,
  onClose,
  onAddParticipants,
}: AddPastParticipantsModalProps) {
  const { dir, language } = useLanguage();
  const [pastParticipants, setPastParticipants] = useState<PastParticipantProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMap, setSelectedMap] = useState<Map<string, { profile: PastParticipantProfile; isRequired: boolean }>>(new Map());

  // Existing emails lowercased
  const existingEmails = useMemo(() => {
    return new Set(
      (existingParticipants || [])
        .map((p) => p.profile?.email?.trim().toLowerCase())
        .filter(Boolean) as string[]
    );
  }, [existingParticipants]);

  const loadPastData = async () => {
    setIsLoading(true);
    try {
      const list = await fetchPastParticipants();
      setPastParticipants(list);
    } catch (err) {
      console.warn('Notice loading past participants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedCompany('ALL');
      setSearchQuery('');
      setSelectedMap(new Map());
      loadPastData();
    }
  }, [isOpen]);

  // Extract unique companies list
  const companiesList = useMemo(() => {
    const set = new Set<string>();
    pastParticipants.forEach((p) => {
      const c = p.company?.trim() || 'Unassigned';
      set.add(c);
    });
    return Array.from(set).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [pastParticipants]);

  // Filtered past participants list (excluding participants already in the meeting)
  const filteredPastParticipants = useMemo(() => {
    return pastParticipants.filter((p) => {
      // Filter out if already in the current meeting
      if (existingEmails.has(p.email.toLowerCase())) {
        return false;
      }

      // Company Filter
      if (selectedCompany !== 'ALL') {
        const comp = p.company?.trim() || 'Unassigned';
        if (comp.toLowerCase() !== selectedCompany.toLowerCase()) {
          return false;
        }
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (p.full_name || '').toLowerCase().includes(q);
        const matchEmail = (p.email || '').toLowerCase().includes(q);
        const matchCompany = (p.company || '').toLowerCase().includes(q);
        const matchRole = (p.role || '').toLowerCase().includes(q);
        return matchName || matchEmail || matchCompany || matchRole;
      }

      return true;
    });
  }, [pastParticipants, selectedCompany, searchQuery, existingEmails]);

  if (!isOpen) return null;

  const toggleSelection = (profile: PastParticipantProfile) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(profile.email)) {
        next.delete(profile.email);
      } else {
        next.set(profile.email, { profile, isRequired: true });
      }
      return next;
    });
  };

  const toggleRequired = (email: string) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const item = next.get(email);
      if (item) {
        next.set(email, { ...item, isRequired: !item.isRequired });
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      filteredPastParticipants.forEach((p) => {
        if (!next.has(p.email)) {
          next.set(p.email, { profile: p, isRequired: true });
        }
      });
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedMap(new Map());
  };

  const handleConfirmAdd = () => {
    const listToAdd = Array.from(selectedMap.values()).map(({ profile, isRequired }) => ({
      name: profile.full_name,
      email: profile.email,
      company: profile.company,
      role: profile.role || '',
      isRequired,
    }));
    onAddParticipants(listToAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
              👥
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {language === 'he' ? 'הוספת משתתפים קודמים לפגישה זו' : 'Add Past Participants to this Meeting'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'he' ? 'סינון לפי חברה וחיפוש מהיר של משתתפי עבר' : 'Filter by company and add existing participants'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 text-sm font-bold flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {language === 'he' ? 'סינון לפי חברה:' : 'Filter Company:'}
            </span>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
            >
              <option value="ALL">
                {language === 'he' ? `🏢 כל החברות (${pastParticipants.length})` : `🏢 All Companies (${pastParticipants.length})`}
              </option>
              {companiesList.map((company) => {
                const count = pastParticipants.filter((p) => (p.company?.trim() || 'Unassigned').toLowerCase() === company.toLowerCase()).length;
                const label = company === 'Unassigned'
                  ? (language === 'he' ? `ללא שיוך חברה (${count})` : `Unassigned / General (${count})`)
                  : `${company} (${count})`;
                return (
                  <option key={company} value={company}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Search Box */}
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'he' ? '🔍 חפש לפי שם, דוא"ל או תפקיד...' : '🔍 Search name, email or role...'}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick Selection Actions */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span>
            {language === 'he'
              ? `זמינים לצירוף: ${filteredPastParticipants.length}`
              : `Available to add: ${filteredPastParticipants.length}`}
          </span>
          <div className="flex items-center gap-2 font-semibold">
            <button type="button" onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:underline">
              {language === 'he' ? 'בחר הכל' : 'Select All'}
            </button>
            <span>•</span>
            <button type="button" onClick={deselectAll} className="text-slate-500 hover:underline">
              {language === 'he' ? 'בטל בחירה' : 'Deselect All'}
            </button>
            <span>•</span>
            <button type="button" onClick={loadPastData} className="text-slate-500 hover:text-blue-600 transition-colors">
              🔄 {language === 'he' ? 'רענן' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Participants Cards Grid */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            ⌛ {language === 'he' ? 'טוען משתתפים קודמים מסדרת הפגישות...' : 'Loading past participants...'}
          </div>
        ) : filteredPastParticipants.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            💬 {language === 'he' ? 'כל המשתתפים של סינון זה כבר שויכו לפגישה זו' : 'All participants matching this filter are already added to this meeting.'}
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {filteredPastParticipants.map((participant) => {
              const isSelected = selectedMap.has(participant.email);
              const selectedData = selectedMap.get(participant.email);
              const isRequired = selectedData ? selectedData.isRequired : true;

              return (
                <div
                  key={participant.email}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/60 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => toggleSelection(participant)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(participant)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {participant.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {participant.full_name}
                        </span>
                        {participant.company && participant.company !== 'Unassigned' ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            🏢 {participant.company}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                            ⚠️ {language === 'he' ? 'ללא שיוך חברה' : 'Unassigned'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        {participant.email} {participant.role ? `• ${participant.role}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Required vs Optional status */}
                  {isSelected && (
                    <button
                      type="button"
                      onClick={() => toggleRequired(participant.email)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-colors shrink-0 ${
                        isRequired
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isRequired ? (language === 'he' ? '★ חובה' : '★ Required') : (language === 'he' ? 'רשות' : 'Optional')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            {language === 'he' ? 'ביטול' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleConfirmAdd}
            disabled={selectedMap.size === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
              selectedMap.size > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>+</span>
            <span>
              {language === 'he'
                ? `הוסף ${selectedMap.size} משתתפים לפגישה זו`
                : `Add ${selectedMap.size} Selected Participants`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
