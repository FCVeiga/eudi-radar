import { NextResponse } from 'next/server';
import { authClient, safeNext } from '@/lib/auth';
import { ensureProfile } from '@/lib/profiles';
import { applyProfilePrefs } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** Where Google sign-in and password-reset links land: swap the code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  if (code) {
    const { data, error } = await authClient().auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureProfile(data.user.id, data.user.email || '', data.user.user_metadata);
      await applyProfilePrefs(data.user.id);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
