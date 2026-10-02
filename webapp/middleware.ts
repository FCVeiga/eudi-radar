import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Keeps sign-in sessions fresh: when the access token is near expiry, the
 * refresh happens here (the only place, besides actions, that may set cookies).
 * Requests without a session cookie skip it entirely.
 */
export async function middleware(request: NextRequest) {
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)'],
};
