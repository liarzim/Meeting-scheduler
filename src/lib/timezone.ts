export interface TimezoneOption {
  value: string;
  label: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem (Israel - GMT+3)' },
  { value: 'America/New_York', label: 'America/New_York (US Eastern - GMT-4)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (US Pacific - GMT-7)' },
  { value: 'Europe/London', label: 'Europe/London (UK - GMT+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (Central Europe - GMT+2)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan - GMT+9)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

export function getUserTimezone(): string {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) return detected;
    } catch {
      // Fallback
    }
  }
  return 'Asia/Jerusalem';
}

/**
 * Returns formatted date headers for a given week offset.
 * Base date: Sunday of current week + (weekOffset * 7) days.
 */
export function getWeekDates(weekOffset: number = 0) {
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
  
  // Calculate Sunday of the target week
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDayOfWeek + weekOffset * 7);
  sunday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = new Date(sunday);
    dayDate.setDate(sunday.getDate() + i);
    return dayDate;
  });
}

/**
 * Formats a Date object to short string: e.g. "Jul 26" or "26 ביולי"
 */
export function formatDateShort(date: Date, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
