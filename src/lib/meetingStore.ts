import type { AvailabilitySlot, Meeting } from '@/types';
import type { ParticipantWithDetails } from '@/components/MeetingHeatmap';
import { generateUUID } from './uuid';

const STORAGE_KEY = 'meeting_scheduler_store_v1';
const MEETINGS_LIST_KEY = 'meeting_scheduler_meetings_list_v1';
const DELETED_MEETINGS_KEY = 'meeting_scheduler_deleted_ids_v1';
const LIVE_SYNC_CHANNEL_NAME = 'meeting_scheduler_live_sync_v1';

export interface TopTimeSlot {
  slotKey: string;
  dateStrEn: string;
  dateStrHe: string;
  timeRangeEn: string;
  timeRangeHe: string;
  pct: number;
  availableCount: number;
  totalCount: number;
}

export function normalizeKey(key: string): string {
  if (!key) return '';
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function getDeletedMeetingIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_MEETINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isMeetingDeleted(idOrSlug: string): boolean {
  if (!idOrSlug) return false;
  const deleted = getDeletedMeetingIds();
  const norm = normalizeKey(idOrSlug);
  return deleted.some((d) => normalizeKey(d) === norm);
}

export function markMeetingDeleted(idOrSlug: string) {
  if (typeof window === 'undefined' || !idOrSlug) return;
  try {
    const deleted = getDeletedMeetingIds();
    const norm = normalizeKey(idOrSlug);
    if (!deleted.includes(norm)) {
      deleted.push(norm);
      localStorage.setItem(DELETED_MEETINGS_KEY, JSON.stringify(deleted));
    }
  } catch (err) {
    console.warn('Failed to mark meeting deleted:', err);
  }
}

export function getStoredMeetings(): Meeting[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MEETINGS_LIST_KEY);
    if (raw) {
      const parsed: Meeting[] = JSON.parse(raw);
      return parsed.filter((m) => !isMeetingDeleted(m.id) && !isMeetingDeleted(m.slug));
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
    markMeetingDeleted(norm);

    const existing = getStoredMeetings();
    const matched = existing.find((m) => normalizeKey(m.id) === norm || normalizeKey(m.slug) === norm);
    const updated = existing.filter((m) => normalizeKey(m.id) !== norm && normalizeKey(m.slug) !== norm);
    localStorage.setItem(MEETINGS_LIST_KEY, JSON.stringify(updated));

    // Remove stored participant data for this meeting key
    localStorage.removeItem(`${STORAGE_KEY}_${norm}`);
    if (matched) {
      markMeetingDeleted(matched.id);
      markMeetingDeleted(matched.slug);
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
  if (isMeetingDeleted(norm)) return null;
  const meetings = getStoredMeetings();
  return meetings.find((m) => normalizeKey(m.slug) === norm || normalizeKey(m.id) === norm) || null;
}

export function getStoredMeetingData(key: string): ParticipantWithDetails[] | null {
  if (typeof window === 'undefined' || !key) return null;
  const norm = normalizeKey(key);
  if (isMeetingDeleted(norm)) return null;
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

export function saveStoredMeetingData(key: string, data: ParticipantWithDetails[], skipBroadcast: boolean = false) {
  if (typeof window === 'undefined' || !key) return;
  const norm = normalizeKey(key);
  try {
    // Deep map-based participant merging
    const existing = getStoredMeetingData(norm) || [];
    const participantMap = new Map<string, ParticipantWithDetails>();

    existing.forEach((p) => {
      const pKey = p.id || p.profile?.email || p.profile?.full_name || '';
      if (pKey) participantMap.set(pKey, p);
    });

    data.forEach((p) => {
      const pKey = p.id || p.profile?.email || p.profile?.full_name || '';
      if (pKey) {
        if (participantMap.has(pKey)) {
          const prev = participantMap.get(pKey)!;
          const slotMap = new Map<string, AvailabilitySlot>();
          (prev.availability || []).forEach((s) => {
            const sKey = s.id || s.slot_key || `${s.start_time}_${s.end_time}`;
            slotMap.set(sKey, s);
          });
          (p.availability || []).forEach((s) => {
            const sKey = s.id || s.slot_key || `${s.start_time}_${s.end_time}`;
            slotMap.set(sKey, s);
          });

          participantMap.set(pKey, {
            ...prev,
            ...p,
            availability: Array.from(slotMap.values()),
          });
        } else {
          participantMap.set(pKey, p);
        }
      }
    });

    let merged = Array.from(participantMap.values());
    if (merged.length > 1 && merged.some((p) => p.profile?.email !== 'host@company.com')) {
      merged = merged.filter((p) => p.profile?.email !== 'host@company.com');
    }

    localStorage.setItem(`${STORAGE_KEY}_${norm}`, JSON.stringify(merged));

    if (!skipBroadcast) {
      // Dispatch local custom event
      window.dispatchEvent(new CustomEvent('meeting_availability_updated', { detail: { key: norm } }));

      // Broadcast across tabs
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
        bc.postMessage({ type: 'AVAILABILITY_UPDATED', key: norm });
        bc.close();
      }
    }
  } catch (err) {
    console.warn('Failed to save participant data to localStorage:', err);
  }
}

export function updateParticipantSlots(
  meetingKey: string,
  participantId: string,
  guestInfo: { full_name: string; email: string; company?: string; phone_number?: string; role?: string },
  newSlots: AvailabilitySlot[]
) {
  const normKey = normalizeKey(meetingKey);
  const current = getStoredMeetingData(normKey) || [];

  const existingIdx = current.findIndex(
    (p) =>
      p.id === participantId ||
      (p.profile?.email && guestInfo.email && p.profile.email.toLowerCase() === guestInfo.email.toLowerCase())
  );

  if (existingIdx >= 0) {
    current[existingIdx] = {
      ...current[existingIdx],
      id: participantId,
      profile: {
        ...current[existingIdx].profile,
        full_name: guestInfo.full_name,
        email: guestInfo.email,
        company: guestInfo.company || null,
        phone_number: guestInfo.phone_number || null,
        is_organizer: guestInfo.role === 'Organizer',
      },
      availability: newSlots,
    };
  } else {
    current.push({
      id: participantId,
      meeting_id: normKey,
      profile_id: `prof-${participantId}`,
      is_required: true,
      profile: {
        id: `prof-${participantId}`,
        full_name: guestInfo.full_name,
        email: guestInfo.email,
        company: guestInfo.company || null,
        phone_number: guestInfo.phone_number || null,
        is_organizer: guestInfo.role === 'Organizer',
      },
      availability: newSlots,
    });
  }

  saveStoredMeetingData(normKey, current);
}

// Compute top 3 available time slots (90%+)
export function computeMeetingStats(participants: ParticipantWithDetails[]): {
  totalParticipants: number;
  submittedParticipants: number;
  bestMatchPct: number;
  bestMatchSlot: string;
  topTimeSlots: TopTimeSlot[];
} {
  const cleanParticipants = participants.filter((p) => p.profile?.email !== 'host@company.com');
  const requiredParticipants = cleanParticipants.filter((p) => p.is_required !== false);
  const totalCountForMatch = requiredParticipants.length || cleanParticipants.length || 1;
  const totalParticipants = cleanParticipants.length || 1;
  const submittedParticipants = cleanParticipants.filter(
    (p) => p.availability && p.availability.length > 0
  ).length;

  const slotMap: Record<string, { available: Set<string>; date: Date; hours: number; minutes: number }> = {};

  const activeParticipants = requiredParticipants.length > 0 ? requiredParticipants : cleanParticipants;

  activeParticipants.forEach((p) => {
    if (p.availability && p.availability.length > 0) {
      p.availability.forEach((av) => {
        let slotKey = av.slot_key;
        let d: Date;

        if (!slotKey && av.start_time) {
          d = new Date(av.start_time);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          slotKey = `${y}-${m}-${day}_${timeStr}`;
        } else if (slotKey) {
          const [datePart, timePart] = slotKey.split('_');
          const [yearStr, monthStr, dayStr] = datePart.split('-');
          const [hoursStr, minutesStr] = timePart.split(':');
          d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10), parseInt(hoursStr, 10), parseInt(minutesStr, 10));
        } else {
          return;
        }

        if (!slotMap[slotKey]) {
          slotMap[slotKey] = {
            available: new Set(),
            date: d,
            hours: d.getHours(),
            minutes: d.getMinutes(),
          };
        }
        slotMap[slotKey].available.add(p.id);
      });
    }
  });

  const slotsList = Object.entries(slotMap).map(([slotKey, data]) => {
    const count = data.available.size;
    const pct = Math.round((count / totalCountForMatch) * 100);

    const endMinutes = data.minutes + 30;
    const endHour = data.hours + Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;

    const formatTimeEn = (h: number, m: number) => {
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${displayH}:${m === 0 ? '00' : String(m).padStart(2, '0')} ${ampm}`;
    };

    const formatTimeHe = (h: number, m: number) => {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const dateStrEn = data.date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const dateStrHe = data.date.toLocaleDateString('he-IL', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    });

    const timeRangeEn = `${formatTimeEn(data.hours, data.minutes)} - ${formatTimeEn(endHour, endMin)}`;
    const timeRangeHe = `${formatTimeHe(data.hours, data.minutes)} - ${formatTimeHe(endHour, endMin)}`;

    return {
      slotKey,
      dateStrEn,
      dateStrHe,
      timeRangeEn,
      timeRangeHe,
      pct,
      availableCount: count,
      totalCount: totalCountForMatch,
    };
  });

  // Filter 50%+ matching slots and sort descending by % then count
  const topTimeSlots = slotsList
    .filter((s) => s.pct >= 50)
    .sort((a, b) => b.pct - a.pct || b.availableCount - a.availableCount)
    .slice(0, 3);

  let bestMatchPct = 0;
  let bestMatchSlot = 'Pending Responses';

  if (slotsList.length > 0) {
    const best = slotsList.sort((a, b) => b.pct - a.pct)[0];
    bestMatchPct = best.pct;
    bestMatchSlot = `${best.dateStrEn}, ${best.timeRangeEn}`;
  }

  return {
    totalParticipants,
    submittedParticipants,
    bestMatchPct,
    bestMatchSlot,
    topTimeSlots,
  };
}

export async function syncLocalMeetingsToCloud(supabaseClient: any) {
  if (typeof window === 'undefined' || !supabaseClient) return;
  try {
    const localMeetings = getStoredMeetings();
    if (localMeetings.length === 0) return;

    for (const m of localMeetings) {
      if (isMeetingDeleted(m.id) || isMeetingDeleted(m.slug)) continue;

      const { data: existing } = await supabaseClient
        .from('meetings')
        .select('id')
        .or(`id.eq.${m.id},slug.eq.${m.slug}`)
        .maybeSingle();

      const storedSlots =
        getStoredMeetingData(m.id) ||
        getStoredMeetingData(m.slug) ||
        getStoredMeetingData(decodeURIComponent(m.slug)) ||
        [];

      let realMeetingId = m.id;

      if (!existing) {
        const hostPart = storedSlots.find((p) => p.profile?.is_organizer);
        const hostEmail = hostPart?.profile?.email || 'organizer@company.com';
        const hostName = hostPart?.profile?.full_name || 'Organizer (Host)';

        let profId = generateUUID();
        const { data: profData } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('email', hostEmail)
          .maybeSingle();

        if (profData?.id) {
          profId = profData.id;
        } else {
          const { data: insertedProf } = await supabaseClient
            .from('profiles')
            .upsert([{ id: profId, email: hostEmail, full_name: hostName, is_organizer: true }], { onConflict: 'email' })
            .select('id')
            .maybeSingle();
          if (insertedProf?.id) profId = insertedProf.id;
        }

        const dbCombinedTitle = m.description ? `${m.title}:::${m.description}` : m.title;

        const { data: insertedM } = await supabaseClient.from('meetings').upsert(
          [
            {
              id: m.id,
              organizer_id: profId,
              title: dbCombinedTitle,
              slug: m.slug,
              status: m.status || 'OPEN',
            },
          ],
          { onConflict: 'id' }
        ).select('id').maybeSingle();

        if (insertedM?.id) realMeetingId = insertedM.id;
      } else {
        realMeetingId = existing.id;
      }

      // Sync stored local participants for this meeting into Supabase DB
      if (storedSlots && storedSlots.length > 0) {
        for (const sp of storedSlots) {
          if (!sp?.profile?.email) continue;
          const em = sp.profile.email.trim().toLowerCase();
          if (em === 'organizer@company.com' || em === 'host@company.com') continue;

          let profId = sp.profile_id || sp.profile.id;
          if (!profId || profId.startsWith('prof-') || profId.length !== 36) {
            profId = generateUUID();
          }

          const { data: profRes } = await supabaseClient
            .from('profiles')
            .upsert(
              [
                {
                  id: profId,
                  email: em,
                  full_name: sp.profile.full_name || em.split('@')[0],
                  company: sp.profile.company || null,
                  phone_number: sp.profile.phone_number || null,
                  is_organizer: !!sp.profile.is_organizer,
                },
              ],
              { onConflict: 'email' }
            )
            .select('id')
            .maybeSingle();

          const finalProfId = profRes?.id || profId;

          let partId = sp.id;
          if (!partId || partId.startsWith('part-') || partId.length !== 36) {
            partId = generateUUID();
          }

          const { data: existingPart } = await supabaseClient
            .from('meeting_participants')
            .select('id')
            .eq('meeting_id', realMeetingId)
            .eq('profile_id', finalProfId)
            .maybeSingle();

          if (!existingPart) {
            await supabaseClient
              .from('meeting_participants')
              .upsert(
                [
                  {
                    id: partId,
                    meeting_id: realMeetingId,
                    profile_id: finalProfId,
                    is_required: sp.is_required !== false,
                  },
                ],
                { onConflict: 'id' }
              );
          }
        }
      }
    }
  } catch (err) {
    console.warn('Sync local meetings to cloud notice:', err);
  }
}
