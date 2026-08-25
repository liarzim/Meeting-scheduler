import { supabase } from './supabase';
import { getStoredMeetings, getStoredMeetingData } from './meetingStore';
import type { Profile } from '@/types';

export interface PastParticipantProfile extends Profile {
  company: string;
  role?: string | null;
}

export async function fetchPastParticipants(): Promise<PastParticipantProfile[]> {
  const profileMap = new Map<string, PastParticipantProfile>();

  // 1. Fetch from Supabase meeting_participants joined with profiles
  try {
    const { data: dbParticipants, error: mpErr } = await (supabase.from('meeting_participants') as any)
      .select('id, is_required, profiles(id, full_name, email, company, role, phone_number, is_organizer)');

    if (!mpErr && dbParticipants) {
      dbParticipants.forEach((mp: any) => {
        const p = mp.profiles;
        if (p) {
          const em = (p.email || '').trim().toLowerCase();
          if (em && em !== 'organizer@company.com' && em !== 'host@company.com') {
            profileMap.set(em, {
              id: p.id || mp.id,
              email: em,
              full_name: p.full_name?.replace(' (Host)', '').trim() || em.split('@')[0],
              company: p.company?.trim() || 'Unassigned',
              role: p.role?.trim() || '',
              phone_number: p.phone_number || null,
              is_organizer: !!p.is_organizer,
            });
          }
        }
      });
    }
  } catch (err) {
    console.warn('Notice fetching Supabase meeting_participants:', err);
  }

  // 2. Fetch from Supabase profiles table as backup
  try {
    const { data: dbProfiles, error } = await (supabase.from('profiles') as any)
      .select('id, full_name, email, company, role, phone_number, is_organizer');

    if (!error && dbProfiles) {
      dbProfiles.forEach((p: any) => {
        const em = (p.email || '').trim().toLowerCase();
        if (em && em !== 'organizer@company.com' && em !== 'host@company.com') {
          const existing = profileMap.get(em);
          profileMap.set(em, {
            id: p.id || existing?.id || `prof-${Date.now()}`,
            email: em,
            full_name: p.full_name?.replace(' (Host)', '').trim() || existing?.full_name || em.split('@')[0],
            company: p.company?.trim() || existing?.company || 'Unassigned',
            role: p.role?.trim() || existing?.role || '',
            phone_number: p.phone_number || existing?.phone_number || null,
            is_organizer: !!p.is_organizer || existing?.is_organizer || false,
          });
        }
      });
    }
  } catch (err) {
    console.warn('Notice fetching Supabase past profiles:', err);
  }

  // 3. Scan local meetingStore for any locally saved participant profiles
  try {
    const storedMeetings = getStoredMeetings();
    storedMeetings.forEach((m) => {
      const parts = getStoredMeetingData(m.id) || getStoredMeetingData(m.slug) || [];
      parts.forEach((part) => {
        if (part?.profile) {
          const em = (part.profile.email || '').trim().toLowerCase();
          if (em && em !== 'organizer@company.com' && em !== 'host@company.com') {
            const existing = profileMap.get(em);
            profileMap.set(em, {
              id: part.profile.id || existing?.id || `prof-${Date.now()}`,
              email: em,
              full_name: part.profile.full_name?.replace(' (Host)', '').trim() || existing?.full_name || em.split('@')[0],
              company: part.profile.company?.trim() || existing?.company || 'Unassigned',
              role: part.profile.role?.trim() || existing?.role || '',
              phone_number: part.profile.phone_number || existing?.phone_number || null,
              is_organizer: part.profile.is_organizer || existing?.is_organizer || false,
            });
          }
        }
      });
    });
  } catch (err) {
    console.warn('Notice scanning local meetingStore profiles:', err);
  }

  return Array.from(profileMap.values());
}
