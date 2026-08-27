'use client';

import React, { useState, useEffect } from 'react';
import type { Meeting } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { addMeetingActivityLog } from '@/lib/meetingStore';
import { generateICSContent, generateEMLContent, downloadBlobFile } from '@/lib/ical';

interface SendEmailInviteModalProps {
  isOpen: boolean;
  meeting: Meeting | null;
  shareableUrl: string;
  hostName: string;
  hostEmail: string;
  existingInvitedEmails?: string[];
  onClose: () => void;
}

export function SendEmailInviteModal({
  isOpen,
  meeting,
  shareableUrl,
  hostName,
  hostEmail,
  existingInvitedEmails = [],
  onClose,
}: SendEmailInviteModalProps) {
  const { dir, language } = useLanguage();
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingInvitedEmails && existingInvitedEmails.length > 0) {
      setEmails(existingInvitedEmails.filter((e) => e && e.includes('@')));
    } else {
      setEmails([]);
    }
  }, [existingInvitedEmails, isOpen]);

  if (!isOpen || !meeting) return null;

  const handleAddEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean) return;

    if (!clean.includes('@') || !clean.includes('.')) {
      setError(language === 'he' ? 'אנא הזן כתובת דוא"ל תקינה' : 'Please enter a valid email address.');
      return;
    }

    if (emails.includes(clean)) {
      setError(language === 'he' ? 'כתובת דוא"ל זו כבר קיימת ברשימה' : 'This email address is already added.');
      return;
    }

    setEmails((prev) => [...prev, clean]);
    setEmailInput('');
    setError(null);
  };

  const handleRemoveEmail = (targetEmail: string) => {
    setEmails((prev) => prev.filter((e) => e !== targetEmail));
  };

  const cleanHostName = hostName ? hostName.replace(' (Host)', '').trim() : (language === 'he' ? 'מארח הפגישה' : 'Meeting Owner');
  const descText = meeting.description ? meeting.description : (language === 'he' ? 'תיאום זמינות שבועית' : 'Weekly availability coordination');

  const subjectStr =
    language === 'he'
      ? `תיאום פגישה בנושא - ${meeting.title}`
      : `Scheduling a meeting regarding - ${meeting.title}`;

  let bodyStr = '';
  if (language === 'he') {
    bodyStr = `שלום,

אשמח לתאם פגישה בהקדם בנושא ${meeting.title}.
מטרת הפגישה: ${descText}.

לצורך התיאום, יש להיכנס לקישור הבא ולעדכן אילו מועדים זמינים לקיום הפגישה:

${shareableUrl}

תודה מראש,
${cleanHostName}`;
  } else {
    bodyStr = `Hello,

I would like to schedule a meeting soon regarding ${meeting.title}.
Meeting purpose: ${descText}.

To help coordinate, please click the link below to update your available times:

${shareableUrl}

Thanks in advance,
${cleanHostName}`;
  }

  const handleOpenEmailApp = () => {
    if (emails.length === 0) {
      setError(language === 'he' ? 'אנא הוסף לפחות כתובת דוא"ל אחת של משתתף' : 'Please add at least one participant email address.');
      return;
    }

    const toStr = emails.join(';');
    const ccStr = hostEmail ? hostEmail.trim() : '';

    if (meeting?.id) {
      addMeetingActivityLog(meeting.id, {
        type: 'EMAIL_INVITE',
        recipient_email: toStr,
        details: `שליחת זימון במייל ל-${emails.length} נמענים`,
      });
    }

    const mailtoUrl = `mailto:${encodeURIComponent(toStr)}?cc=${encodeURIComponent(ccStr)}&subject=${encodeURIComponent(subjectStr)}&body=${encodeURIComponent(bodyStr)}`;

    window.open(mailtoUrl, '_blank');
    onClose();
  };

  const handleDownloadICS = () => {
    const icsContent = generateICSContent(meeting.title, descText, shareableUrl, cleanHostName);
    downloadBlobFile(`meeting-invite-${meeting.slug || 'event'}.ics`, icsContent, 'text/calendar');
    if (meeting?.id) {
      addMeetingActivityLog(meeting.id, {
        type: 'EMAIL_INVITE',
        recipient_email: emails.join(';'),
        details: 'הורדת קובץ זימון ליומן (.ics) להפצה מחשבון מייל אחר',
      });
    }
  };

  const handleDownloadEML = () => {
    const emlContent = generateEMLContent(emails, subjectStr, bodyStr, hostEmail);
    downloadBlobFile(`meeting-invite-${meeting.slug || 'email'}.eml`, emlContent, 'message/rfc822');
    if (meeting?.id) {
      addMeetingActivityLog(meeting.id, {
        type: 'EMAIL_INVITE',
        recipient_email: emails.join(';'),
        details: 'הורדת קובץ מייל מוכן (.eml) להפצה מחשבון מייל אחר',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn text-start"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shadow-inner">
              ✉️
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {language === 'he' ? 'שליחת זימון במייל למשתתפים' : 'Send Invitation via Email'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'he'
                  ? 'פתח באפליקציית מייל או הורד קובץ זימון (.ics/.eml) למשלוח מכתובת מייל אחרת'
                  : 'Open mail app or download (.ics/.eml) to send from a different email account'}
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

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Input for Emails */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {language === 'he' ? 'כתובות דוא"ל נמענים (מופרדות בנקודה-פסיק ; או פסיק):' : 'Recipient Emails (separated by semicolon ; or comma):'}
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ';' || e.key === ',') {
                  e.preventDefault();
                  handleAddEmail();
                }
              }}
              placeholder="example@company.com"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddEmail}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
            >
              {language === 'he' ? 'הוסף' : 'Add'}
            </button>
          </div>
        </div>

        {/* Invited Emails Badges */}
        {emails.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {language === 'he' ? `נרשמו ${emails.length} נמענים:` : `${emails.length} recipients added:`}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              {emails.map((em) => (
                <span
                  key={em}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-medium"
                >
                  <span>{em}</span>
                  <button
                    onClick={() => handleRemoveEmail(em)}
                    className="hover:text-rose-500 font-bold ml-1"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Email Preview */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {language === 'he' ? 'תצוגה מקדימה של הזימון במייל:' : 'Email Invitation Preview:'}
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 max-h-48 overflow-y-auto font-mono text-slate-800 dark:text-slate-200">
            {hostEmail && (
              <div className="text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">CC:</strong>{' '}
                  <span className="font-mono text-slate-500">{hostEmail}</span>
                </span>
                <span className="text-[10px] text-slate-400">({language === 'he' ? 'מארח הפגישה' : 'Meeting Owner'})</span>
              </div>
            )}
            <div className="text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              <strong className="text-slate-800 dark:text-slate-200">{language === 'he' ? 'נושא:' : 'Subject:'}</strong>{' '}
              <span className="font-bold text-slate-900 dark:text-slate-100">{subjectStr}</span>
            </div>
            <div className="whitespace-pre-line text-slate-700 dark:text-slate-300 font-sans pt-1">
              {bodyStr}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadICS}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5"
              title={language === 'he' ? 'הורד קובץ זימון ליומן (.ics) שניתן לצרף לכל מייל מחשבון אחר' : 'Download .ics Calendar Invite to attach from any email account'}
            >
              <span>📥</span>
              <span>{language === 'he' ? 'הורד קובץ זימון (.ics)' : 'Download Invite (.ics)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadEML}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5"
              title={language === 'he' ? 'הורד קובץ מייל (.eml) מוכן למשלוח מכל תוכנת דואר' : 'Download ready-made email (.eml) file'}
            >
              <span>✉️</span>
              <span>{language === 'he' ? 'הורד קובץ מייל (.eml)' : 'Download Email (.eml)'}</span>
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
              onClick={handleOpenEmailApp}
              disabled={emails.length === 0}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span>📧</span>
              <span>
                {language === 'he' ? 'פתח אפליקציית מייל' : 'Open Mail App'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
