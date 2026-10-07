'use client';

import { useT } from '@/lib/i18n/client';
import { Choices, Row, Section, ToggleRow } from '../SettingsUI';
import { setChatPermission, setSearchable } from '@/app/settings/actions';

const CHAT = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'workspace', label: 'People in my workspaces' },
  { value: 'nobody', label: 'Nobody', hint: 'Existing chats carry on' },
];

export default function PrivacyTab({ chat, searchable }: { chat: string; searchable: boolean }) {
  const t = useT();
  return (
    <>
      <Section title="Social interactions">
        <Row label="Who can send you chat requests" value={t(CHAT.find((c) => c.value === chat)?.label ?? 'Everyone')}>
          {(close) => <Choices options={CHAT} value={chat} onPick={setChatPermission} close={close} />}
        </Row>
      </Section>
      <Section title="Discoverability">
        <ToggleRow label="Show up in search results" hint="Others can find your profile in Tender Town search and search engines"
          on={searchable} onToggle={setSearchable} />
      </Section>
    </>
  );
}
