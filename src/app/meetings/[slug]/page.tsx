import React from 'react';
import type { Meeting } from '@/types';
import { MeetingDetailView } from '@/components/MeetingDetailView';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams.slug;
  const slug = decodeURIComponent(rawSlug);

  const formattedTitle = slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const meeting: Meeting = {
    id: `m-${slug}`,
    organizer_id: 'prof-1',
    title: formattedTitle || 'Meeting',
    slug: slug,
    status: 'OPEN',
  };

  return <MeetingDetailView initialMeeting={meeting} />;
}
