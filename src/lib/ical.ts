/**
 * iCalendar (.ics) and Email (.eml) File Generator Utility
 */

export function generateICSContent(
  title: string,
  description: string,
  shareableUrl: string,
  hostName?: string
): string {
  const cleanTitle = (title || 'Meeting Invitation').replace(/[\r\n]+/g, ' ');
  const cleanDesc = (description || '').replace(/[\r\n]+/g, '\\n');
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meeting Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:meeting-${Date.now()}@meeting-scheduler`,
    `DTSTAMP:${nowStr}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDesc}\\n\\nTo select your preferred time slots, click the link below:\\n${shareableUrl}`,
    `URL:${shareableUrl}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function generateEMLContent(
  recipients: string[],
  subject: string,
  body: string,
  hostEmail?: string
): string {
  const toHeader = recipients.join(', ');
  const fromHeader = hostEmail || 'organizer@meeting-scheduler.com';

  return [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');
}

export function downloadBlobFile(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
