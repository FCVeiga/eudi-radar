import { NextResponse } from 'next/server';
import { getActivity, refreshStaleAccounts } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

// Polled by the Live activity panel: refresh feeds that are due, then return
// the latest activity across followed accounts.
export async function GET() {
  await refreshStaleAccounts();
  return NextResponse.json({ activity: await getActivity(30) });
}
