'use client';

import { useEffect, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '@/lib/i18n/client';
import { createAccessToken, revokeAccessToken, type McpTokenState } from '@/app/settings/actions';
import { Row } from './SettingsUI';

export type TokenInfo = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? t('Saving…') : t('Create token')}</button>;
}

function Create() {
  const t = useT();
  const router = useRouter();
  const [state, action] = useFormState<McpTokenState, FormData>(createAccessToken, null);
  useEffect(() => { if (state?.token) router.refresh(); }, [state?.token, router]);
  return (
    <form action={action} className="settings-form">
      <label className="field">
        <span>{t('Token name')}</span>
        <input name="name" required minLength={2} maxLength={60} autoFocus placeholder={t('e.g. Claude')} />
      </label>
      {state?.token && (
        <label className="field">
          <span>{t('Access tokens')}</span>
          <input readOnly value={state.token} aria-label={t('Access tokens')} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
      {state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>}
      {!state?.token && (
        <div className="settings-actions">
          <Submit />
        </div>
      )}
    </form>
  );
}

function TokenRow({ token }: { token: TokenInfo }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const when = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="doc-item">
      <span>{token.name}<em className="field-hint"> · {token.lastUsedAt ? t('Last used {date}', { date: when(token.lastUsedAt) }) : t('Created {date}', { date: when(token.createdAt) })}</em></span>
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => { await revokeAccessToken(token.id); router.refresh(); })}>{t('Revoke')}</button>
    </div>
  );
}

export default function McpTokens({ tokens, endpoint }: { tokens: TokenInfo[]; endpoint: string }) {
  const t = useT();
  return (
    <Row label="Access tokens" hint={endpoint} value={tokens.length ? String(tokens.length) : t('None')} title="Access tokens">
      {() => (
        <div className="settings-form">
          <p className="field-hint">{t('An external agent connects at {url} and acts as you, inside your plan.', { url: endpoint })}</p>
          {tokens.map((token) => <TokenRow key={token.id} token={token} />)}
          <Create />
        </div>
      )}
    </Row>
  );
}
