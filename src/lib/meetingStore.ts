import type { AvailabilitySlot, Meeting } from '@/types';
import type { ParticipantWithDetails } from '@/components/MeetingHeatmap';

const STORAGE_KEY = 'meeting_scheduler_store_v1';
const MEETINGS_LIST_KEY = 'meeting_scheduler_meetings_list_v1';
const LIVE_SYNC_CHANNEL_NAME = 'meeting_scheduler_live_sync_v1';

export function normalizeKey(key: string): string {
  if (!key) return '';
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function getStoredMeetings(): Meeting[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MEETINGS_LIST_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Fallback
  }
  return [];
}

export function saveStoredMeeting(meeting: Meeting) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredMeetings();
    const cleanMeeting: Meeting = {
      ...meeting,
      id: normalizeKey(meeting.id),
      slug: normalizeKey(meeting.slug),
    };
    const updated = [cleanMeeting, ...existing.filter((m) => m.id !== cleanMeeting.id && m.slug !== cleanMeeting.slug)];
    localStorage.setItem(MEETINGS_LIST_KEY, JSON.stringify(updated));
    
    // Dispatch local custom event
    window.dispatchEvent(new CustomEvent('meetings_list_updated'));

    // Broadcast cross-tab live sync
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
      bc.postMessage({ type: 'MEETINGS_LIST_UPDATED' });
      bc.close();
    }
  } catch (err) {
    console.warn('Failed to save meeting to list:', err);
  }
}

export function deleteStoredMeeting(key: string) {
  if (typeof window === 'undefined' || !key) return;
  const norm = normalizeKey(key);
  try {
    const existing = getStoredMeetings();
    const matched = existing.find((m) => normalizeKey(m.id) === norm || normalizeKey(m.slug) === norm);
    const updated = existing.filter((m) => normalizeKey(m.id) !== norm && normalizeKey(m.slug) !== norm);
    localStorage.setItem(MEETINGS_LIST_KEY, JSON.stringify(updated));

    // Remove stored participant data for this meeting key
    localStorage.removeItem(`${STORAGE_KEY}_${norm}`);
    if (matched) {
      localStorage.removeItem(`${STORAGE_KEY}_${normalizeKey(matched.id)}`);
      localStorage.removeItem(`${STORAGE_KEY}_${normalizeKey(matched.slug)}`);
    }

    // Dispatch events
    window.dispatchEvent(new CustomEvent('meetings_list_updated'));
    window.dispatchEvent(new CustomEvent('meeting_availability_updated', { detail: { key: norm } }));

    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
      bc.postMessage({ type: 'MEETINGS_LIST_UPDATED' });
      bc.close();
    }
  } catch (err) {
    console.warn('Failed to delete meeting from localStorage:', err);
  }
}

export function getStoredMeetingBySlug(slug: string): Meeting | null {
  const norm = normalizeKey(slug);
  const meetings = getStoredMeetings();
  return meetings.find((m) => normalizeKey(m.slug) === norm || normalizeKey(m.id) === norm) || null;
}

export function getStoredMeetingData(key: string): ParticipantWithDetails[] | null {
  if (typeof window === 'undefined' || !key) return null;
  const norm = normalizeKey(key);
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${norm}`);
    if (raw) {
      let parsed: ParticipantWithDetails[] = JSON.parse(raw);
      // Clean up legacy dummy fallback host if an actual host exists
      if (parsed.length > 1 && parsed.some((p) => p.profile?.email !== 'host@company.com')) {
        parsed = parsed.filter((p) => p.profile?.email !== 'host@company.com');
      }
      return parsed;
    }
  } catch {
    // Fallback
  }
  return null;
}

export function saveStoredMeetingData(key: string, participants: ParticipantWithDetails[]) {
  if (typeof window === 'undefined' || !key) return;
  const norm = normalizeKey(key);
  try {
    // Clean up legacy dummy fallback host before saving
    let cleanParticipants = participants;
    if (cleanParticipants.length > 1 && cleanParticipants.some((p) => p.profile?.email !== 'host@company.com')) {
      cleanParticipants = cleanParticipants.filter((p) => p.profile?.email !== 'host@company.com');
    }

    localStorage.setItem(`${STORAGE_KEY}_${norm}`, JSON.stringify(cleanParticipants));

    // Dispatch local custom event
    window.dispatchEvent(new CustomEvent('meeting_availability_updated', { detail: { key: norm } }));

    // Broadcast cross-tab live sync message
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
      bc.postMessage({ type: 'AVAILABILITY_UPDATED', key: norm });
      bc.close();
    }
  } catch (err) {
    console.warn('Failed to save meeting data to localStorage:', err);
  }
}

/**
 * Updates availability slots for a specific participant in a meeting
 */
export function updateParticipantSlots(
  meetingKey: string,
  participantId: string,
  guestProfile: { full_name: string; email: string; company?: string; phone_number?: string; role?: string },
  slots: { start_time: string; end_time: string; slot_key?: string }[]
) {
  if (!meetingKey) return [];
  const normKey = normalizeKey(meetingKey);

  let existing = getStoredMeetingData(normKey) || [];

  // Filter out legacy dummy fallback participant "host@company.com" if actual organizer exists
  if (existing.some((p) => p.profile?.email !== 'host@company.com')) {
    existing = existing.filter((p) => p.profile?.email !== 'host@company.com');
  }

  // Find or create participant by ID or Email
  let pIndex = existing.findIndex((p) => p.id === participantId || (p.profile?.email && p.profile.email.toLowerCase() === guestProfile.email.toLowerCase()));

  const formattedSlots: AvailabilitySlot[] = slots.map((s, idx) => ({
    id: `av-${Date.now()}-${idx}`,
    participant_id: participantId,
    slot_key: s.slot_key,
    start_time: s.start_time,
    end_time: s.end_time,
  }));

  if (pIndex >= 0) {
    existing[pIndex].availability = formattedSlots;
    if (guestProfile.full_name) {
      existing[pIndex].profile = {
        ...existing[pIndex].profile,
        id: existing[pIndex].profile_id || `prof-${Date.now()}`,
        email: guestProfile.email,
        full_name: guestProfile.full_name,
        company: guestProfile.company || null,
        phone_number: guestProfile.phone_number || null,
        is_organizer: existing[pIndex].profile?.is_organizer || false,
      };
    }
  } else {
    const newParticipant: ParticipantWithDetails = {
      id: participantId,
      meeting_id: normKey,
      profile_id: `prof-${Date.now()}`,
      is_required: true,
      profile: {
        id: `prof-${Date.now()}`,
        email: guestProfile.email,
        full_name: guestProfile.full_name,
        company: guestProfile.company || null,
        phone_number: guestProfile.phone_number || null,
        is_organizer: false,
      },
      availability: formattedSlots,
    };
    existing.push(newParticipant);
  }

  saveStoredMeetingData(normKey, existing);
  return existing;
}

export function computeMeetingStats(participants: ParticipantWithDetails[]) {
  // Filter out legacy dummy fallback host if actual organizer exists
  let clean = participants;
  if (clean.length > 1 && clean.some((p) => p.profile?.email !== 'host@company.com')) {
    clean = clean.filter((p) => p.profile?.email !== 'host@company.com');
  }

  const total = clean.length;
  const submitted = clean.filter((p) => p.availability && p.availability.length > 0).length;
  
  const matchPct = total > 0 ? Math.round((submitted / total) * 100) : 0;

  // Compute actual best matching slot text (e.g. "Sun 3:30 PM")
  let bestSlotText = 'Pending Responses';
  let bestCount = 0;

  if (clean.length > 0) {
    const slotCounts: Record<string, number> = {};
    clean.forEach((p) => {
      if (p.availability) {
        p.availability.forEach((av) => {
          const key = av.slot_key || av.start_time;
          slotCounts[key] = (slotCounts[key] || 0) + 1;
        });
      }
    });

    let topKey = '';
    Object.entries(slotCounts).forEach(([key, count]) => {
      if (count > bestCount) {
        bestCount = count;
        topKey = key;
      }
    });

    if (topKey) {
      if (topKey.includes('_')) {
        const [datePart, timePart] = topKey.split('_');
        const [yearStr, monthStr, dayStr] = datePart.split('-');
        const [hoursStr, minutesStr] = timePart.split(':');
        const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const h = parseInt(hoursStr, 10);
        const m = parseInt(minutesStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const displayM = m === 0 ? '00' : String(m).padStart(2, '0');
        bestSlotText = `${dayName} ${displayH}:${displayM} ${ampm}`;
      } else {
        const d = new Date(topKey);
        bestSlotText = d.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      }
    }
  }

  return {
    totalParticipants: total,
    submittedParticipants: submitted,
    bestMatchPct: matchPct > 0 ? matchPct : 100,
    bestMatchSlot: bestSlotText,
  };
}
