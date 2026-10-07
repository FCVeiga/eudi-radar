import { getCountryOptions, getSources, getViewSourceIds } from '@/lib/sources';
import SourcesPanel from './SourcesPanel';

/** "Following": the sources the viewer's active scopes follow, grouped — and the place to configure them. */
export default async function SourcesSidebar() {
  const [sources, countries, followed] = await Promise.all([getSources(), getCountryOptions(), getViewSourceIds()]);
  return <SourcesPanel sources={sources.filter((s) => followed.has(s.source_id))} countries={countries} />;
}
