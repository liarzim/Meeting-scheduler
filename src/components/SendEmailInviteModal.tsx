'use client';

import React, { useState, useEffect } from 'react';
import type { Meeting } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

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

אשמח לתאם פגישה בהקדם בנושא ${meeting.title} .
מטרת הפגישה היא ${descText}.
לצורך התיאום, יש להיכנס לקישור הבא ולעדכן אילו מועדים זמינים לקיום הפגישה :${shareableUrl}

תודה מראש ,
${cleanHostName}`;
  } else {
    bodyStr = `Hello,

I would like to schedule a meeting soon regarding ${meeting.title}.
The purpose of the meeting is ${descText}.

To help coordinate, please access the link below and update your available times for the meeting: ${shareableUrl}

Thanks in advance,
${cleanHostName}`;
  }

  const handleOpenEmailApp = () => {
    if (emails.length === 0) {
      setError(language === 'he' ? 'אנא הוסף לפחות כתובת דוא"ל אחת של משתתף' : 'Please add at least one participant email address.');
      return;
    }

    const toStr = emails.join(',');
    const ccStr = hostEmail ? hostEmail.trim() : '';

    const mailtoUrl = `mailto:${encodeURIComponent(toStr)}?cc=${encodeURIComponent(ccStr)}&subject=${encodeURIComponent(subjectStr)}&body=${encodeURIComponent(bodyStr)}`;

    // Open default desktop/mobile mail app (Outlook, Apple Mail, Gmail handler, etc.)
    window.location.href = mailtoUrl;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn text-start"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 transition-colors max-h-[90vh] overflow-y-auto transform transition-all animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-1">
              <span>📧</span>
              <span>{language === 'he' ? 'שליחת זימונים במייל' : 'Send Email Invitations'}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
              {language === 'he' ? 'זימון משתתפים במייל' : 'Invite Participants via Email'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Step 1: Add Participant Emails */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {language === 'he' ? '1. הוסף כתובות דוא"ל של המשתתפים (TO):' : '1. Add Participant Emails (TO):'}
          </label>

          <form onSubmit={handleAddEmail} className="flex items-center gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={language === 'he' ? 'לדוגמה: colleague@company.com' : 'e.g. colleague@company.com'}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shrink-0"
            >
              {language === 'he' ? '+ הוסף' : '+ Add'}
            </button>
          </form>

          {/* List of Added Emails */}
          {emails.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
              {emails.map((em) => (
                <span
                  key={em}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-medium shadow-xs"
                >
                  <span>{em}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(em)}
                    className="text-blue-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold ml-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
              {language === 'he' ? 'טרם הוזנו כתובות מייל. הוסף כתובת מייל למעלה.' : 'No participant emails added yet. Add an email address above.'}
            </p>
          )}
        </div>

        {/* Step 2: Email Rules Preview */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {language === 'he' ? '2. תצוגה מקדימה של הודעת המייל שתשלח:' : '2. Preview of the Email Message:'}
          </label>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-2.5 font-sans leading-relaxed">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              <span>
                <strong className="text-slate-800 dark:text-slate-200">TO:</strong>{' '}
                <span className="font-mono text-blue-600 dark:text-blue-400">{emails.length > 0 ? emails.join(', ') : '(יש להוסיף מיילים)'}</span>
              </span>
            </div>

            {hostEmail && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
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
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {language === 'he' ? 'ביטול' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleOpenEmailApp}
            disabled={emails.length === 0}
            className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <span>📧</span>
            <span>
              {language === 'he' ? 'פתח אפליקציית מייל וששלח הזמנה' : 'Open Mail App & Send Invitations'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
