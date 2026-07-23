'use client';

import Link from 'next/link';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';

export default function Home() {
  const { t, dir } = useLanguage();

  const schemaTables = [
    {
      name: 'profiles',
      columns: ['id (UUID, PK)', 'email (TEXT, Unique)', 'full_name (TEXT)', 'company (TEXT)', 'phone_number (TEXT)', 'is_organizer (BOOLEAN)'],
    },
    {
      name: 'meetings',
      columns: ['id (UUID, PK)', 'organizer_id (UUID, FK)', 'title (TEXT)', 'slug (TEXT, Unique Index)', 'status (ENUM)'],
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 md:p-16 flex flex-col items-center" dir={dir}>
      <div className="max-w-5xl w-full space-y-12">
        {/* Header */}
        <header className="border-b border-slate-800 pb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Hebrew &amp; RTL Support Ready
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent sm:text-5xl">
              Meeting Scheduler
            </h1>
            <p className="mt-2 text-slate-400 text-lg">
              Multi-tenant Meeting Coordination Platform
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/organizer"
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
            >
              🚀 {t('nav.dashboard')}
            </Link>
          </div>
        </header>

        {/* Quick Demo Routes */}
        <section className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>📅</span> Organizer Flow Quick Access
          </h2>
          <p className="text-sm text-slate-400">
            Jump directly to the Organizer Dashboard or test the Meeting Detail &amp; Weekly Heatmap view:
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/organizer"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
            >
              1. {t('nav.dashboard')} (/organizer)
            </Link>
            <Link
              href="/meetings/q3-product-architecture-scaling-review"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
            >
              2. Meeting Detail &amp; Heatmap (/meetings/q3-product-architecture...)
            </Link>
          </div>
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
