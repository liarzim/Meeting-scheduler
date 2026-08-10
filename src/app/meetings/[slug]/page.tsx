import React from 'react';
import type { Meeting } from '@/types';
import { supabase } from '@/lib/supabase';
import { MeetingDetailView } from '@/components/MeetingDetailView';
import type { ParticipantWithDetails } from '@/components/MeetingHeatmap';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams.slug;
  const slug = decodeURIComponent(rawSlug);
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  let meeting: Meeting = {
    id: slug,
    organizer_id: 'prof-1',
    title: slug.replace(/-/g, ' '),
    slug: slug,
    status: 'OPEN',
  };

  let initialParticipants: ParticipantWithDetails[] = [];

  try {
    let query = (supabase.from('meetings') as any)
      .select('*, meeting_participants(*, profiles(*), availability_slots(*))');

    if (isUUID(slug)) {
      query = query.or(`id.eq.${slug},slug.eq.${slug}`);
    } else {
      query = query.eq('slug', slug);
    }

    const { data: dbData, error } = await query.single();

    if (!error && dbData) {
      let cleanTitle = dbData.title || '';
      let cleanDesc = dbData.description || '';
      if (cleanTitle.includes(':::')) {
        const parts = cleanTitle.split(':::');
        cleanTitle = parts[0];
        cleanDesc = parts.slice(1).join(':::');
      }

      meeting = {
        id: dbData.id,
        organizer_id: dbData.organizer_id,
        title: cleanTitle,
        description: cleanDesc,
        slug: dbData.slug,
        status: dbData.status || 'OPEN',
      };

      if (dbData.meeting_participants && dbData.meeting_participants.length > 0) {
        const dbParticipants = dbData.meeting_participants
          .filter((mp: any) => {
            const em = (mp.profiles?.email || '').toLowerCase();
            return em !== 'organizer@company.com' && em !== 'host@company.com';
          })
          .map((mp: any) => ({
            id: mp.id,
            meeting_id: mp.meeting_id,
            profile_id: mp.profile_id,
            is_required: mp.is_required !== false,
            profile: mp.profiles,
            availability: (mp.availability_slots || []).map((s: any) => {
              let slotKey = s.slot_key;
              if (!slotKey && s.start_time) {
                const d = new Date(s.start_time);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                slotKey = `${y}-${m}-${day}_${timeStr}`;
              }
              return { ...s, slot_key: slotKey };
            }),
          }));

        // Deduplicate by email strictly
        const uniqueMap = new Map<string, ParticipantWithDetails>();
        dbParticipants.forEach((p: ParticipantWithDetails) => {
          const em = (p.profile?.email || '').trim().toLowerCase();
          const key = em || p.id;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, p);
          } else {
            const prev = uniqueMap.get(key)!;
            const slotMap = new Map();
            (prev.availability || []).forEach((s) => slotMap.set(s.slot_key || s.start_time, s));
            (p.availability || []).forEach((s) => slotMap.set(s.slot_key || s.start_time, s));
            uniqueMap.set(key, { ...prev, ...p, availability: Array.from(slotMap.values()) });
          }
        });

        initialParticipants = Array.from(uniqueMap.values());
      }
    }
  } catch (err) {
    console.warn('Server fetch notice in meetings/[slug]:', err);
  }

  return (
    <MeetingDetailView
      initialMeeting={meeting}
      initialParticipants={initialParticipants}
    />
  );
}
