import { supabase } from './supabase';
import { getStoredMeetings, getStoredMeetingData } from './meetingStore';
import type { Profile } from '@/types';

export interface PastParticipantProfile extends Profile {
  company: string;
  role?: string | null;
}

export async function fetchPastParticipants(): Promise<PastParticipantProfile[]> {
  const profileMap = new Map<string, PastParticipantProfile>();

  // Helper to add profile
  const addProfile = (prof: {
    id?: string;
    email?: string;
    full_name?: string;
    company?: string | null;
    role?: string | null;
    phone_number?: string | null;
    is_organizer?: boolean;
  }) => {
    if (!prof || !prof.email) return;
    const em = prof.email.trim().toLowerCase();
    if (!em || em === 'organizer@company.com' || em === 'host@company.com') return;

    const existing = profileMap.get(em);
    const cleanName = prof.full_name?.replace(' (Host)', '').trim() || existing?.full_name || em.split('@')[0];
    const rawCompany = prof.company?.trim() || existing?.company?.trim() || '';
    const cleanCompany = rawCompany && rawCompany !== 'Unassigned' ? rawCompany : 'Unassigned';

    profileMap.set(em, {
      id: prof.id || existing?.id || `prof-${Date.now()}`,
      email: em,
      full_name: cleanName,
      company: cleanCompany,
      role: prof.role?.trim() || existing?.role || '',
      phone_number: prof.phone_number || existing?.phone_number || null,
      is_organizer: typeof prof.is_organizer === 'boolean' ? prof.is_organizer : existing?.is_organizer || false,
    });
  };

  // 1. Fetch from Supabase meetings with nested meeting_participants & profiles
  try {
    const { data: dbMeetings, error: mErr } = await (supabase.from('meetings') as any)
      .select('id, title, slug, meeting_participants(*, profiles(*))');

    if (!mErr && Array.isArray(dbMeetings)) {
      dbMeetings.forEach((m: any) => {
        if (Array.isArray(m.meeting_participants)) {
          m.meeting_participants.forEach((mp: any) => {
            if (mp.profiles) {
              addProfile(mp.profiles);
            }
          });
        }
      });
    }
  } catch (err) {
    console.warn('Notice querying Supabase meetings with nested profiles:', err);
  }

  // 2. Fetch directly from Supabase profiles table
  try {
    const { data: dbProfiles, error: pErr } = await (supabase.from('profiles') as any)
      .select('id, full_name, email, company, role, phone_number, is_organizer');

    if (!pErr && Array.isArray(dbProfiles)) {
      dbProfiles.forEach((p) => addProfile(p));
    }
  } catch (err) {
    console.warn('Notice querying Supabase profiles:', err);
  }

  // 3. Query Supabase meeting_participants by profile_id
  try {
    const { data: dbParticipants, error: mpErr } = await (supabase.from('meeting_participants') as any)
      .select('id, profile_id');

    if (!mpErr && Array.isArray(dbParticipants)) {
      const pIds = dbParticipants.map((mp: any) => mp.profile_id).filter(Boolean);
      if (pIds.length > 0) {
        const { data: matchedProfiles } = await (supabase.from('profiles') as any)
          .select('id, full_name, email, company, role, phone_number, is_organizer')
          .in('id', pIds);

        if (Array.isArray(matchedProfiles)) {
          matchedProfiles.forEach((p) => addProfile(p));
        }
      }
    }
  } catch (err) {
    console.warn('Notice querying Supabase meeting_participants:', err);
  }

  // 4. Scan local meetingStore for any locally saved participant profiles
  try {
    const storedMeetings = getStoredMeetings();
    storedMeetings.forEach((m) => {
      const parts = getStoredMeetingData(m.id) || getStoredMeetingData(m.slug) || [];
      parts.forEach((part) => {
        if (part?.profile) {
          addProfile(part.profile);
        }
      });
    });
  } catch (err) {
    console.warn('Notice scanning local meetingStore profiles:', err);
  }

  return Array.from(profileMap.values());
}
