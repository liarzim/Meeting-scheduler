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
  const slug = resolvedParams.slug;

  // Construct initial meeting structure from slug
  const formattedTitle = slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const meeting: Meeting = {
    id: `m-${slug}`,
    organizer_id: 'prof-1',
    title: formattedTitle || 'Q3 Product Architecture & Scaling Review',
    slug: slug,
    status: 'OPEN',
  };

  return <MeetingDetailView initialMeeting={meeting} />;
}
