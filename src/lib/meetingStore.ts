import type { AvailabilitySlot, Meeting } from '@/types';
import type { ParticipantWithDetails } from '@/components/MeetingHeatmap';

const STORAGE_KEY = 'meeting_scheduler_store_v1';
const MEETINGS_LIST_KEY = 'meeting_scheduler_meetings_list_v1';

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
    window.dispatchEvent(new CustomEvent('meetings_list_updated'));
  } catch (err) {
    console.warn('Failed to save meeting to list:', err);
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
      return JSON.parse(raw);
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
    localStorage.setItem(`${STORAGE_KEY}_${norm}`, JSON.stringify(participants));
    window.dispatchEvent(new CustomEvent('meeting_availability_updated', { detail: { key: norm } }));
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

  const existing = getStoredMeetingData(normKey) || [
    {
      id: 'part-1',
      meeting_id: normKey,
      profile_id: 'prof-1',
      is_required: true,
      profile: {
        id: 'prof-1',
        email: 'host@company.com',
        full_name: 'Meeting Host',
        company: null,
        phone_number: null,
        is_organizer: true,
      },
      availability: [],
    },
  ];

  // Find or create participant by ID or Email
  let pIndex = existing.findIndex((p) => p.id === participantId || p.profile?.email === guestProfile.email);

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
  const total = participants.length;
  const submitted = participants.filter((p) => p.availability && p.availability.length > 0).length;
  const required = participants.filter((p) => p.is_required !== false);
  
  const matchPct = required.length > 0 ? Math.round((submitted / total) * 100) : 0;
  return {
    totalParticipants: total,
    submittedParticipants: submitted,
    bestMatchPct: Math.min(100, Math.max(50, matchPct > 0 ? matchPct : 100)),
    bestMatchSlot: 'Mon 10:00 AM',
  };
}
