'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMeeting: Meeting) => void;
}

export function CreateMeetingModal({ isOpen, onClose, onSuccess }: CreateMeetingModalProps) {
  const { t, dir } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug when title changes
  useEffect(() => {
    if (!title) {
      setSlug('');
      return;
    }
    const cleanTitle = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    setSlug(`${cleanTitle}-${randomSuffix}`);
  }, [title]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      setError('Please provide a valid meeting title.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const newMeetingData = {
      title: title.trim(),
      slug: slug.trim(),
      status: 'OPEN' as const,
    };

    try {
      // Insert into Supabase meetings table
      const { data, error: supabaseError } = await (supabase.from('meetings') as any)
        .insert([newMeetingData])
        .select()
        .single();

      if (supabaseError) {
        console.warn('Supabase insert warning, falling back to local object:', supabaseError.message);
        const fallbackMeeting: Meeting = {
          id: crypto.randomUUID(),
          organizer_id: null,
          title: newMeetingData.title,
          slug: newMeetingData.slug,
          status: 'OPEN',
        };
        onSuccess(fallbackMeeting);
      } else if (data) {
        onSuccess(data as Meeting);
      }

      // Reset form
      setTitle('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create meeting:', err);
      const fallbackMeeting: Meeting = {
        id: crypto.randomUUID(),
        organizer_id: null,
        title: title.trim(),
        slug: slug.trim(),
        status: 'OPEN',
      };
      onSuccess(fallbackMeeting);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir={dir}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {t('modal.createTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('modal.titleLabel')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('modal.titlePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('modal.descLabel')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('modal.descPlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('modal.slugLabel')}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-blue-600 dark:text-indigo-400">
              <span className="text-slate-400 dark:text-slate-500 select-none">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="bg-transparent text-blue-600 dark:text-indigo-400 focus:outline-none w-full font-mono font-semibold"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('modal.slugHelp')}
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? t('modal.submitting') : t('modal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
