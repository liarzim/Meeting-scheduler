import React from 'react';
import { PublicMeetingClientView } from '@/components/PublicMeetingClientView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PublicMeetingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicMeetingPage({ params }: PublicMeetingPageProps) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug || '';

  return <PublicMeetingClientView slug={rawSlug} />;
}
