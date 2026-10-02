import { getCountryOptions, getSources } from '@/lib/sources';
import SourcesPanel from './SourcesPanel';

/** "Following": every source the radar tracks, grouped — and the place to configure them. */
export default async function SourcesSidebar() {
  const [sources, countries] = await Promise.all([getSources(), getCountryOptions()]);
  return <SourcesPanel sources={sources} countries={countries} />;
}
