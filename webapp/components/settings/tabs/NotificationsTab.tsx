'use client';

import { Section, ToggleRow } from '../SettingsUI';
import { setNotificationPref } from '@/app/social/actions';

const GROUPS: { title: string; prefs: [string, string, string?][] }[] = [
  { title: 'Activity', prefs: [['likes', 'Likes', 'On your posts and comments'], ['comments', 'Comments', 'On your posts'],
    ['replies', 'Replies', 'To your comments'], ['follows', 'New followers']] },
  { title: 'Tenders', prefs: [['new_tender', 'New tenders', 'Matching your scopes'], ['tender_update', 'Tender updates', 'On tenders you follow']] },
];

export default function NotificationsTab({ prefs }: { prefs: Record<string, boolean> }) {
  return (
    <>
      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.prefs.map(([key, label, hint]) => (
            <ToggleRow key={key} label={label} hint={hint} on={prefs[key] !== false}
              onToggle={async (on) => { await setNotificationPref(key, on); return {}; }} />
          ))}
        </Section>
      ))}
    </>
  );
}
