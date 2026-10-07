'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

/** Phones: the table's sort arrows as one dropdown (sort + direction in the URL, like the headers). */
export default function SortSelect({ options }: { options: { sort: string; dir?: string; label: string }[] }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = `${params.get('sort') ?? options[0].sort}:${params.get('dir') ?? ''}`;
  return (
    <label className="filter-select sort-select">
      <span>{t('Sort')}</span>
      <select value={current} onChange={(e) => {
        const [sort, dir] = e.target.value.split(':');
        const next = new URLSearchParams(params.toString());
        next.set('sort', sort);
        if (dir) next.set('dir', dir); else next.delete('dir');
        router.push(`${pathname}?${next.toString()}`);
      }}>
        {options.map((o) => <option key={`${o.sort}:${o.dir ?? ''}`} value={`${o.sort}:${o.dir ?? ''}`}>{t(o.label)}</option>)}
      </select>
    </label>
  );
}
