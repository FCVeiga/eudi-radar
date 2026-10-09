'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GUEST_TZ_COOKIE } from '@/lib/guestScope';

/** One try: remember the browser timezone so the server can rank preset scopes. */
export default function GuestScopeHint() {
  const router = useRouter();
  useEffect(() => {
    const has = (name: string) => document.cookie.split(';').some((part) => part.trim().startsWith(`${name}=`));
    if (has(GUEST_TZ_COOKIE) || sessionStorage.getItem('guest_tz_tried')) return;
    sessionStorage.setItem('guest_tz_tried', '1');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    document.cookie = `${GUEST_TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
