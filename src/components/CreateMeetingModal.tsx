'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import { setGuestCookie, getGuestCookie } from '@/lib/cookies';
import { saveStoredMeeting, saveStoredMeetingData } from '@/lib/meetingStore';
import { useLanguage } from '@/context/LanguageContext';
import { fetchPastParticipants, type PastParticipantProfile } from '@/lib/pastParticipants';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meeting: Meeting) => void;
}

interface SelectedParticipant {
  profile: PastParticipantProfile;
  isRequired: boolean;
}

export function CreateMeetingModal({ isOpen, onClose, onSuccess }: CreateMeetingModalProps) {
  const { t, dir, language } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Past Participants Filter State
  const [pastParticipants, setPastParticipants] = useState<PastParticipantProfile[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedParticipantsMap, setSelectedParticipantsMap] = useState<Map<string, SelectedParticipant>>(new Map());
  const [isLoadingPast, setIsLoadingPast] = useState<boolean>(false);
  const [isPastSectionOpen, setIsPastSectionOpen] = useState<boolean>(true);

  // Pre-fill organizer info if cookie exists
  useEffect(() => {
    const saved = getGuestCookie();
    if (saved) {
      if (saved.full_name) setOrganizerName(saved.full_name);
      if (saved.email) setOrganizerEmail(saved.email);
    }
  }, []);

  const loadPastParticipantsData = async () => {
    setIsLoadingPast(true);
    try {
      const profiles = await fetchPastParticipants();
      setPastParticipants(profiles);
    } catch (err) {
      console.warn('Error loading past participants:', err);
    } finally {
      setIsLoadingPast(false);
    }
  };

  // Fetch past participants immediately on mount
  useEffect(() => {
    loadPastParticipantsData();
  }, []);

  // Fetch past participants when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCompany('ALL');
      setSearchQuery('');
      loadPastParticipantsData();
    }
  }, [isOpen]);

  // Auto-generate clean, unique UUID slug when title changes
  useEffect(() => {
    if (!title.trim()) {
      setSlug('');
      return;
    }
    const uuidSlug = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`;
    setSlug(uuidSlug);
  }, [title]);

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

  // Filtered past participants list
  const filteredPastParticipants = useMemo(() => {
    return pastParticipants.filter((p) => {
      // Exclude host's email if currently entered
      if (organizerEmail && p.email.toLowerCase() === organizerEmail.trim().toLowerCase()) {
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
  }, [pastParticipants, selectedCompany, searchQuery, organizerEmail]);

  // Toggle selection for a past participant
  const toggleParticipantSelection = (profile: PastParticipantProfile) => {
    setSelectedParticipantsMap((prev) => {
      const next = new Map(prev);
      if (next.has(profile.email)) {
        next.delete(profile.email);
      } else {
        next.set(profile.email, { profile, isRequired: true });
      }
      return next;
    });
  };

  // Toggle Required vs Optional status for a selected participant
  const toggleParticipantRequired = (email: string) => {
    setSelectedParticipantsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(email);
      if (existing) {
        next.set(email, { ...existing, isRequired: !existing.isRequired });
      }
      return next;
    });
  };

  // Select all visible filtered participants
  const selectAllFiltered = () => {
    setSelectedParticipantsMap((prev) => {
      const next = new Map(prev);
      filteredPastParticipants.forEach((p) => {
        if (!next.has(p.email)) {
          next.set(p.email, { profile: p, isRequired: true });
        }
      });
      return next;
    });
  };

  // Deselect all visible filtered participants
  const deselectAllFiltered = () => {
    setSelectedParticipantsMap((prev) => {
      const next = new Map(prev);
      filteredPastParticipants.forEach((p) => {
        next.delete(p.email);
      });
      return next;
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanName = organizerName.trim();
    const cleanEmail = organizerEmail.trim().toLowerCase();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      setError(language === 'he' ? 'אנא הזן כותרת פגישה' : 'Please provide a valid meeting title.');
      return;
    }

    if (!cleanName) {
      setError(language === 'he' ? 'שם המארח הינו שדה חובה' : 'Host name is required.');
      return;
    }

    if (!cleanEmail) {
      setError(language === 'he' ? 'דוא"ל המארח הינו שדה חובה' : 'Host email is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Save host cookies
    setGuestCookie({
      full_name: cleanName,
      email: cleanEmail,
    });

    const meetingUuid = slug.trim() || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`);
    const dbCombinedTitle = cleanDesc ? `${cleanTitle}:::${cleanDesc}` : cleanTitle;

    const hostProfId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prof-${Date.now()}`;
    const hostPartId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}`;

    // Build array of participants to create (Host + Selected Past Participants)
    const initialParticipantsList: any[] = [];

    // Host participant profile
    const hostParticipant = {
      id: hostPartId,
      meeting_id: meetingUuid,
      profile_id: hostProfId,
      is_required: true,
      profile: {
        id: hostProfId,
        email: cleanEmail,
        full_name: `${cleanName} (Host)`,
        company: null,
        phone_number: null,
        is_organizer: true,
      },
      availability: [],
    };
    initialParticipantsList.push(hostParticipant);

    // Add selected past participants
    const selectedEntries = Array.from(selectedParticipantsMap.values());
    selectedEntries.forEach((entry, idx) => {
      const pProfId = entry.profile.id || `prof-${Date.now()}-${idx}`;
      const pPartId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}-${idx}`;

      initialParticipantsList.push({
        id: pPartId,
        meeting_id: meetingUuid,
        profile_id: pProfId,
        is_required: entry.isRequired,
        profile: {
          id: pProfId,
          email: entry.profile.email,
          full_name: entry.profile.full_name,
          company: entry.profile.company,
          role: entry.profile.role,
          phone_number: entry.profile.phone_number,
          is_organizer: false,
        },
        availability: [],
      });
    });

    try {
      // 1. Check or Upsert Host Profile in Supabase
      let finalHostProfId = hostProfId;
      const { data: existingProf } = await (supabase.from('profiles') as any)
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProf?.id) {
        finalHostProfId = existingProf.id;
        await (supabase.from('profiles') as any)
          .update({
            full_name: `${cleanName} (Host)`,
            is_organizer: true,
          })
          .eq('id', finalHostProfId);
      } else {
        const { data: insertedProf } = await (supabase.from('profiles') as any)
          .upsert(
            [
              {
                id: hostProfId,
                email: cleanEmail,
                full_name: `${cleanName} (Host)`,
                is_organizer: true,
              },
            ],
            { onConflict: 'email' }
          )
          .select('id')
          .maybeSingle();

        if (insertedProf?.id) {
          finalHostProfId = insertedProf.id;
        }
      }

      // 2. Insert into Supabase meetings table
      await (supabase.from('meetings') as any)
        .upsert(
          [
            {
              id: meetingUuid,
              organizer_id: finalHostProfId,
              title: dbCombinedTitle,
              slug: meetingUuid,
              status: 'OPEN',
            },
          ],
          { onConflict: 'id' }
        );

      // 3. Upsert participants in Supabase
      for (const item of initialParticipantsList) {
        let pProfId = item.profile.id;

        // Upsert profile if needed
        const { data: existingPProf } = await (supabase.from('profiles') as any)
          .select('id')
          .eq('email', item.profile.email)
          .maybeSingle();

        if (existingPProf?.id) {
          pProfId = existingPProf.id;
        } else {
          const { data: insertedPProf } = await (supabase.from('profiles') as any)
            .upsert(
              [
                {
                  id: item.profile.id,
                  email: item.profile.email,
                  full_name: item.profile.full_name,
                  company: item.profile.company,
                  phone_number: item.profile.phone_number,
                  is_organizer: item.profile.is_organizer || false,
                },
              ],
              { onConflict: 'email' }
            )
            .select('id')
            .maybeSingle();

          if (insertedPProf?.id) {
            pProfId = insertedPProf.id;
          }
        }

        // Upsert meeting_participant
        await (supabase.from('meeting_participants') as any)
          .upsert(
            [
              {
                id: item.id,
                meeting_id: meetingUuid,
                profile_id: pProfId,
                is_required: item.is_required,
              },
            ],
            { onConflict: 'id' }
          );
      }
    } catch (err) {
      console.warn('Supabase meeting creation notice:', err);
    }

    const createdMeeting: Meeting = {
      id: meetingUuid,
      organizer_id: hostProfId,
      title: cleanTitle,
      description: cleanDesc,
      slug: meetingUuid,
      status: 'OPEN',
    };

    // Save to local meetingStore under both ID and Slug
    saveStoredMeeting(createdMeeting);
    saveStoredMeetingData(createdMeeting.id, initialParticipantsList);
    saveStoredMeetingData(createdMeeting.slug, initialParticipantsList);

    setIsSubmitting(false);
    setTitle('');
    setDescription('');
    setSlug('');
    setSelectedParticipantsMap(new Map());
    onClose();
    onSuccess(createdMeeting);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 transition-colors max-h-[90vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📅</span>
              <span>{t('modal.createTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('modal.createSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder={language === 'he' ? 'לדוגמה: ישיבת צוות שבועית / תכנון פרויקט' : 'e.g. Q3 Product Architecture & Scaling Review'}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Meeting Purpose / Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מטרת הפגישה / תיאור (יוצג למשתתפים)' : 'Meeting Purpose / Description (shown to invitees)'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'he' ? 'פרט את מטרת הפגישה, נושאים לדיון, או הנחיות למשתתפים בעת הגשת הזמינות...' : 'Detail the meeting purpose, agenda topics, or guidelines for invitees when submitting availability...'}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs leading-relaxed"
            />
          </div>

          {/* Organizer Name & Email (Mandatory) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'שם המארח (Host) *' : 'Your Name (Host) *'}
              </label>
              <input
                type="text"
                required
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder={language === 'he' ? 'לדוגמה: מיכאל' : 'e.g. Alex Morgan'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'דוא"ל המארח *' : 'Your Email *'}
              </label>
              <input
                type="email"
                required
                value={organizerEmail}
                onChange={(e) => setOrganizerEmail(e.target.value)}
                placeholder="michael.liarzi@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* NEW FEATURE: Add Past Participants Filtered by Company */}
          <div className="border border-slate-200 dark:border-slate-800/80 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 p-4 space-y-4">
            <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsPastSectionOpen(!isPastSectionOpen)}>
              <div className="flex items-center gap-2">
                <span className="text-base">👥</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {language === 'he' ? 'הוספת משתתפים מפגישות קודמות (מתוסננים לפי חברה)' : 'Add Past Participants (Filtered by Company)'}
                </span>
                {selectedParticipantsMap.size > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold">
                    {selectedParticipantsMap.size} {language === 'he' ? 'נבחרו' : 'selected'}
                  </span>
                )}
              </div>
              <span className="text-slate-400 text-xs font-mono">{isPastSectionOpen ? '▲' : '▼'}</span>
            </div>

            {isPastSectionOpen && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
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
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
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
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quick Selection Actions */}
                {filteredPastParticipants.length > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span>
                      {language === 'he'
                        ? `מציג ${filteredPastParticipants.length} משתתפים קודמים`
                        : `Showing ${filteredPastParticipants.length} past participants`}
                    </span>
                    <div className="flex items-center gap-2 font-semibold">
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {language === 'he' ? 'בחר הכל' : 'Select All'}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={deselectAllFiltered}
                        className="text-slate-500 hover:underline"
                      >
                        {language === 'he' ? 'בטל בחירה' : 'Deselect All'}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={loadPastParticipantsData}
                        className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 font-mono"
                        title={language === 'he' ? 'רענן רשימת משתתפים מהענן' : 'Refresh participants list'}
                      >
                        🔄 {language === 'he' ? 'רענן' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Participants Cards Grid */}
                {isLoadingPast ? (
                  <div className="p-4 text-center text-xs text-slate-400 animate-pulse">
                    ⌛ {language === 'he' ? 'טוען משתתפים קודמים...' : 'Loading past participants...'}
                  </div>
                ) : filteredPastParticipants.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    💬 {language === 'he' ? 'לא נמצאו משתתפים קודמים לפי הסינון' : 'No past participants found matching this filter.'}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 select-none">
                    {filteredPastParticipants.map((participant) => {
                      const isSelected = selectedParticipantsMap.has(participant.email);
                      const selectedData = selectedParticipantsMap.get(participant.email);
                      const isRequired = selectedData ? selectedData.isRequired : true;

                      return (
                        <div
                          key={participant.email}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/60 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => toggleParticipantSelection(participant)}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleParticipantSelection(participant)}
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
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0" title="Click participant card to edit company details">
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
                              onClick={() => toggleParticipantRequired(participant.email)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-colors shrink-0 ${
                                isRequired
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              }`}
                              title="Click to toggle Required vs Optional"
                            >
                              {isRequired
                                ? (language === 'he' ? 'חובה' : 'Required')
                                : (language === 'he' ? 'רשות' : 'Optional')}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generated Shareable Link */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'קישור לשיתוף (UUID נקי)' : 'Generated Shareable Link (Clean UUID)'}
            </label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-blue-600 dark:text-blue-400">
              <span className="opacity-50">/</span>
              <input
                type="text"
                readOnly
                value={slug}
                className="bg-transparent w-full focus:outline-none font-bold select-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {selectedParticipantsMap.size > 0
                ? (language === 'he' ? `סך הכל ${selectedParticipantsMap.size + 1} משתתפים בפגישה` : `Total ${selectedParticipantsMap.size + 1} participants in meeting`)
                : (language === 'he' ? 'משתתף 1 (מארח בלבד)' : '1 participant (Host only)')}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t('modal.cancelBtn')}
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !organizerName.trim() || !organizerEmail.trim()}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (language === 'he' ? 'יוצר פגישה...' : 'Creating...') : `${t('modal.submitBtn')} ✨`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
