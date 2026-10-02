'use client';

import { useSearchParams, usePathname } from 'next/navigation';

/** Navbar search: a plain GET form to /search, prefilled while on the results page. */
export default function SearchBox() {
  const params = useSearchParams();
  const onSearch = usePathname() === '/search';
  return (
    <form action="/search" role="search" className="search-box">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14" /></svg>
      <input
        type="search" name="q" placeholder="Search tenders and news — e.g. EUDI wallet tender Germany"
        defaultValue={onSearch ? params.get('q') ?? '' : ''} key={onSearch ? params.get('q') : 'idle'}
        aria-label="Search tenders and news" autoComplete="off"
      />
    </form>
  );
}
