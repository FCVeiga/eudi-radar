'use client';

import { useState } from 'react';

/** A publisher's share image; disappears if the publisher won't serve it. */
export default function NewsImage({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="feed-image" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setOk(false)} />
  );
}
