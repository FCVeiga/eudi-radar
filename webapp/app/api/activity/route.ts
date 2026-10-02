import { NextResponse } from 'next/server';
import { getActivity, refreshDueFeeds } from '@/lib/sources';

export const dynamic = 'force-dynamic';

// Polled by the Live activity panel: re-read feeds that are due, then return
// the latest activity across followed sources.
export async function GET() {
  await refreshDueFeeds();
  return NextResponse.json({ activity: await getActivity(30) });
}
