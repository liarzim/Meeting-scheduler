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
  const toHeader = recipients.join('; ');
  const ccHeader = hostEmail ? hostEmail.trim() : '';

  // Convert plain text body to HTML for Outlook Compose Window (Screenshot 2)
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
${body
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color: #2563eb; text-decoration: underline; font-weight: bold;">$1</a>')
  .replace(/\n/g, '<br/>')}
</body>
</html>`;

  const headers = [
    'X-Unsent: 1',
    'X-MSO-Draft: Yes',
    `To: ${toHeader}`,
  ];

  if (ccHeader) {
    headers.push(`Cc: ${ccHeader}`);
  }

  headers.push(
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody
  );

  return headers.join('\r\n');
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
