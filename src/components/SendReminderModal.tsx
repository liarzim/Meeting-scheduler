'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Meeting } from '@/types';
import type { ParticipantWithDetails } from './MeetingHeatmap';
import { useLanguage } from '@/context/LanguageContext';
import { addMeetingActivityLog } from '@/lib/meetingStore';
import { generateICSContent, generateEMLContent, downloadBlobFile } from '@/lib/ical';

interface SendReminderModalProps {
  isOpen: boolean;
  meeting: Meeting | null;
  participants: ParticipantWithDetails[];
  shareableUrl: string;
  hostName: string;
  hostEmail: string;
  initialSelectedEmail?: string | null;
  onClose: () => void;
}

export function SendReminderModal({
  isOpen,
  meeting,
  participants,
  shareableUrl,
  hostName,
  hostEmail,
  initialSelectedEmail,
  onClose,
}: SendReminderModalProps) {
  const { dir, language } = useLanguage();
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'ALL' | 'PENDING' | 'CUSTOM'>('ALL');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out host from recipient list
  const recipientParticipants = useMemo(() => {
    return (participants || []).filter((p) => {
      const em = (p.profile?.email || '').trim().toLowerCase();
      if (!em) return false;
      if (em === 'organizer@company.com' || em === 'host@company.com') return false;
      if (p.profile?.is_organizer) return false;
      if (hostEmail && em === hostEmail.trim().toLowerCase()) return false;
      return true;
    });
  }, [participants, hostEmail]);

  // Clean host name
  const cleanHostName = hostName ? hostName.replace(' (Host)', '').trim() : (language === 'he' ? 'מארח הפגישה' : 'Meeting Owner');
  const meetingTitle = meeting?.title || '';
  const descText = meeting?.description ? meeting.description : (language === 'he' ? 'תיאום זמינות שבועית' : 'Weekly availability coordination');

  // Set default subject and body text when modal opens
  useEffect(() => {
    if (isOpen && meetingTitle) {
      const subj =
        language === 'he'
          ? `⏰ תזכורת: תיאום מועד לפגישה בנושא - ${meetingTitle}`
          : `⏰ Reminder: Schedule meeting for - ${meetingTitle}`;

      let body = '';
      if (language === 'he') {
        body = `שלום,

תזכורת ידידותית לגבי הפגישה בנושא: ${meetingTitle}.
מטרת הפגישה: ${descText}.

אנו ממתינים לעדכון זמני הזמינות שלך במפת החום.
לחץ/י על הקישור הבא כדי לסמן את המועדים הנוחים לך:
${shareableUrl}

תודה רבה,
${cleanHostName}`;
      } else {
        body = `Hello,

Friendly reminder regarding the meeting: ${meetingTitle}.
Purpose: ${descText}.

Please update your availability blocks on the group heatmap.
Click the link below to select your preferred time slots:
${shareableUrl}

Best regards,
${cleanHostName}`;
      }

      setCustomSubject(subj);
      setCustomBody(body);
      setError(null);
      setCopied(false);

      // Pre-select based on initialSelectedEmail or filter mode
      if (initialSelectedEmail) {
        setFilterMode('CUSTOM');
        setSelectedEmails(new Set([initialSelectedEmail.toLowerCase()]));
      } else {
        setFilterMode('ALL');
        const allEm = new Set(recipientParticipants.map((p) => (p.profile?.email || '').toLowerCase()).filter(Boolean));
        setSelectedEmails(allEm);
      }
    }
  }, [isOpen, meetingTitle, shareableUrl, cleanHostName, descText, language, initialSelectedEmail, recipientParticipants]);

  if (!isOpen || !meeting) return null;

  const handleModeChange = (mode: 'ALL' | 'PENDING' | 'CUSTOM') => {
    setFilterMode(mode);
    if (mode === 'ALL') {
      const allEm = new Set(recipientParticipants.map((p) => (p.profile?.email || '').toLowerCase()).filter(Boolean));
      setSelectedEmails(allEm);
    } else if (mode === 'PENDING') {
      const pendingEm = new Set(
        recipientParticipants
          .filter((p) => (p.availability?.length || 0) === 0)
          .map((p) => (p.profile?.email || '').toLowerCase())
          .filter(Boolean)
      );
      setSelectedEmails(pendingEm);
    }
  };

  const toggleEmail = (email: string) => {
    const em = email.toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(em)) {
        next.delete(em);
      } else {
        next.add(em);
      }
      return next;
    });
    setFilterMode('CUSTOM');
  };

  const selectAll = () => {
    const allEm = new Set(recipientParticipants.map((p) => (p.profile?.email || '').toLowerCase()).filter(Boolean));
    setSelectedEmails(allEm);
    setFilterMode('ALL');
  };

  const deselectAll = () => {
    setSelectedEmails(new Set());
    setFilterMode('CUSTOM');
  };

  const selectedList = Array.from(selectedEmails);

  const handleOpenEmailClient = () => {
    if (selectedList.length === 0) {
      setError(language === 'he' ? 'אנא בחר לפחות משתתף אחד למשלוח תזכורת' : 'Please select at least one participant to send reminder.');
      return;
    }

    const bccList = selectedList.join(';');

    if (meeting?.id) {
      addMeetingActivityLog(meeting.id, {
        type: 'EMAIL_REMINDER',
        recipient_email: bccList,
        details: `שליחת תזכורת במייל ל-${selectedList.length} משתתפים`,
      });
    }

    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleCopyReminder = () => {
    if (selectedList.length === 0) {
      setError(language === 'he' ? 'אנא בחר לפחות משתתף אחד למשלוח תזכורת' : 'Please select at least one participant.');
      return;
    }

    const bccList = selectedList.join(';');
    if (meeting?.id) {
      addMeetingActivityLog(meeting.id, {
        type: 'EMAIL_REMINDER',
        recipient_email: bccList,
        details: `העתקת טקסט תזכורת ל-${selectedList.length} משתתפים`,
      });
    }

    const textToCopy = `נמענים: ${selectedList.join('; ')}\n\nנושא: ${customSubject}\n\n${customBody}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl">
              ⏰
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {language === 'he' ? 'שליחת תזכורת למשתתפים' : 'Send Reminder to Participants'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'he'
                  ? 'בחר למי לשלוח תזכורת (כולם, משתתפים שטרם הגיבו, או משתתפים נבחרים)'
                  : 'Choose recipients (All, Pending response, or Specific participants)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Target Selection Modes */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {language === 'he' ? 'בחר נמענים למשלוח תזכורת:' : 'Select Recipients:'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleModeChange('ALL')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                filterMode === 'ALL'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md ring-2 ring-blue-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>👥</span>
              <span>{language === 'he' ? `כל המשתתפים (${recipientParticipants.length})` : `All (${recipientParticipants.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('PENDING')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                filterMode === 'PENDING'
                  ? 'bg-amber-600 border-amber-500 text-white shadow-md ring-2 ring-amber-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>⏳</span>
              <span>
                {language === 'he'
                  ? `טרם הגיבו (${recipientParticipants.filter((p) => (p.availability?.length || 0) === 0).length})`
                  : `Pending (${recipientParticipants.filter((p) => (p.availability?.length || 0) === 0).length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('CUSTOM')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                filterMode === 'CUSTOM'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md ring-2 ring-purple-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>☑️</span>
              <span>{language === 'he' ? `בחירה אישית (${selectedList.length})` : `Custom (${selectedList.length})`}</span>
            </button>
          </div>
        </div>

        {/* Participants Checkbox List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">
              {language === 'he' ? `משתתפים נבחרים (${selectedList.length} מתוך ${recipientParticipants.length}):` : `Selected Recipients (${selectedList.length}/${recipientParticipants.length}):`}
            </span>
            <div className="flex items-center gap-2 font-semibold text-[11px]">
              <button type="button" onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:underline">
                {language === 'he' ? 'בחר הכל' : 'Select All'}
              </button>
              <span>•</span>
              <button type="button" onClick={deselectAll} className="text-slate-500 hover:underline">
                {language === 'he' ? 'בטל בחירה' : 'Deselect All'}
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
            {recipientParticipants.length === 0 ? (
              <div className="text-xs text-center py-4 text-slate-400">
                {language === 'he' ? 'אין משתתפים נוספים בפגישה זו' : 'No participants in this meeting yet'}
              </div>
            ) : (
              recipientParticipants.map((p) => {
                const em = (p.profile?.email || '').toLowerCase();
                const isSelected = selectedEmails.has(em);
                const slotCount = p.availability?.length || 0;

                return (
                  <label
                    key={p.id || em}
                    onClick={() => toggleEmail(em)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{p.profile?.full_name || em.split('@')[0]}</span>
                          {p.profile?.company && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                              {p.profile.company}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {em}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        slotCount > 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {slotCount > 0 ? (language === 'he' ? `✓ הגיש/ה ${slotCount} מועדים` : `✓ ${slotCount} slots`) : (language === 'he' ? '⏳ טרם הגיב/ה' : '⏳ Pending')}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Email Subject & Body Customization */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'נושא הודעת התזכורת:' : 'Reminder Email Subject:'}
            </label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תוכן הודעת התזכורת:' : 'Reminder Email Message Body:'}
            </label>
            <textarea
              rows={5}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadICS}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5"
              title={language === 'he' ? 'הורד קובץ זימון (.ics) להפצה מכל חשבון מייל' : 'Download .ics calendar invite file'}
            >
              <span>📥</span>
              <span>{language === 'he' ? 'הורד קובץ (.ics)' : 'Download (.ics)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadEML}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5"
              title={language === 'he' ? 'הורד קובץ מייל (.eml) מוכן למשלוח מכל תוכנה' : 'Download ready-made email (.eml) file'}
            >
              <span>✉️</span>
              <span>{language === 'he' ? 'הורד מייל (.eml)' : 'Download (.eml)'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleCopyReminder}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            >
              <span>📋</span>
              <span>{copied ? (language === 'he' ? 'הועתק!' : 'Copied!') : (language === 'he' ? 'העתק טקסט' : 'Copy Text')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEmailClient}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold transition-all shadow-md shadow-amber-600/20 flex items-center gap-2 active:scale-95"
            >
              <span>📧</span>
              <span>{language === 'he' ? `שלח תזכורת (${selectedList.length})` : `Send Reminder (${selectedList.length})`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
