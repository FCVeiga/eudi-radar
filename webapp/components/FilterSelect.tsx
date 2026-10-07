'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

/** An inline dropdown filter that updates one URL search param. */
export default function FilterSelect({ name, label, options }: {
  name: string; label: string; options: { value: string; label: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="filter-select">
      <span>{t(label)}</span>
      <select
        value={params.get(name) ?? ''}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(name, e.target.value); else next.delete(name);
          const q = next.toString();
          router.push(`${pathname}${q ? `?${q}` : ''}`);
        }}
      >
        <option value="">{t('All')}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
      </select>
    </label>
  );
}
