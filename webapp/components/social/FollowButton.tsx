'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFollow } from '@/app/social/actions';

/** Follow a member: their posts rank higher in your Community Feed. */
export default function FollowButton({ username, following: initial }: { username: string; following: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" className={`btn ${following ? '' : 'primary'} follow-btn`} disabled={pending} aria-pressed={following}
      onClick={() => {
        setFollowing(!following);
        start(async () => {
          const r = await toggleFollow(username);
          if ('error' in r) { setFollowing(following); if (r.error === 'login') router.push(`/login?next=/u/${username}`); }
          else { setFollowing(r.following); router.refresh(); }
        });
      }}>
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
