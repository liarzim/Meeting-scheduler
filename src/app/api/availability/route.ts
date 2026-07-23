import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // 1. Rate Limiting Check
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimit = checkRateLimit(ip, 5, 60000); // 5 requests per 60 seconds

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please wait ${rateLimit.resetSeconds} seconds before submitting again.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimit.resetSeconds.toString(),
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetSeconds.toString(),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { participant_id, slots } = body;

    if (!participant_id || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: 'Invalid Payload', message: 'participant_id and slots array are required.' },
        { status: 400 }
      );
    }

    // 2. Check related meeting status before inserting
    const { data: participantData } = await (supabase.from('meeting_participants') as any)
      .select('id, meeting_id, meetings(status)')
      .eq('id', participant_id)
      .single();

    if (participantData && participantData.meetings && participantData.meetings.status === 'SCHEDULED') {
      return NextResponse.json(
        {
          error: 'Meeting Scheduled',
          message: 'Cannot add or modify availability slots for a meeting that is already SCHEDULED.',
        },
        { status: 403 }
      );
    }

    // 3. Insert slots into availability_slots table
    const { data, error } = await (supabase.from('availability_slots') as any)
      .insert(slots);

    if (error) {
      // Check if error is trigger exception from block_scheduled_updates
      if (error.message && error.message.includes('SCHEDULED')) {
        return NextResponse.json(
          {
            error: 'Trigger Blocked Action',
            message: 'Cannot add or modify availability slots for a meeting that is already SCHEDULED.',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Database Insert Warning', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, count: slots.length, data },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Server Error', message: errorMessage },
      { status: 500 }
    );
  }
}
