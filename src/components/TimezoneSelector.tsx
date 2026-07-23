'use client';

import React, { useEffect } from 'react';
import { COMMON_TIMEZONES, getUserTimezone } from '@/lib/timezone';

interface TimezoneSelectorProps {
  value: string;
  onChange: (tz: string) => void;
}

export function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  useEffect(() => {
    if (!value) {
      onChange(getUserTimezone());
    }
  }, [value, onChange]);

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className="text-slate-400 font-mono">🕒 Timezone:</span>
      <select
        value={value || getUserTimezone()}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
      >
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </div>
  );
}
