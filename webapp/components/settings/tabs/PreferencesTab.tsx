'use client';

import { useT } from '@/lib/i18n/client';
import { UI_LANGUAGES } from '@/lib/i18n/languages';
import { Choices, Row, Section } from '../SettingsUI';
import { setTheme, setUiLanguage } from '@/app/settings/actions';

const MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto', hint: 'Follows your device' },
];

export default function PreferencesTab({ lang, theme }: { lang: string; theme: string }) {
  const t = useT();
  return (
    <>
      <Section title="Language">
        <Row label="Display language" hint="The site’s menus, buttons and messages. Tenders and news stay in the language the agents write in."
          value={UI_LANGUAGES.find((l) => l.code === lang)?.name ?? 'English'}>
          {(close) => <Choices options={UI_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} value={lang} onPick={setUiLanguage} close={close} />}
        </Row>
      </Section>
      <Section title="Experience">
        <Row label="Display mode" value={t(MODES.find((m) => m.value === theme)?.label ?? 'Auto')}>
          {(close) => <Choices options={MODES} value={theme} onPick={setTheme} close={close} />}
        </Row>
      </Section>
    </>
  );
}
