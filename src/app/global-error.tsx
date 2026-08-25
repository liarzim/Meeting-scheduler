'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-2xl w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-2xl font-bold border border-rose-500/30">
              🚨
            </div>
            <div>
              <h1 className="text-xl font-bold text-rose-400">Global Application Exception</h1>
              <p className="text-xs text-slate-400">An unexpected system error occurred at root level.</p>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-rose-300 overflow-x-auto space-y-2">
            <p className="font-bold text-rose-400">{error.name || 'Error'}: {error.message || 'Unknown runtime error'}</p>
            {error.digest && <p className="text-[11px] text-slate-500">Digest Code: {error.digest}</p>}
            {error.stack && (
              <pre className="text-[10px] text-slate-400 whitespace-pre-wrap max-h-48 overflow-y-auto mt-2 pt-2 border-t border-slate-900">
                {error.stack}
              </pre>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-md"
            >
              🔄 Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
