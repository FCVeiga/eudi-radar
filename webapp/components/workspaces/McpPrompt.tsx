'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

export default function McpLink({ tokens, error }: {
  tokens: { id: string; name: string; hint: string; prompt: string }[];
  error: string | null;
}) {
  const t = useT();
  const [id, setId] = useState(tokens[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const current = tokens.find((tk) => tk.id === id) ?? tokens[0];

  return (
    <>
      <div className="mcp-copy-row">
        <span className="mcp-token-box">
          {tokens.length > 1 ? (
            <select className="mcp-token-name" value={current?.id} aria-label={t('Access token')} onChange={(e) => setId(e.target.value)}>
              {tokens.map((tk) => <option key={tk.id} value={tk.id}>{tk.name}</option>)}
            </select>
          ) : (
            <span className="mcp-token-name">{current?.name ?? ''}</span>
          )}
          <span className="mcp-token-value">{current?.hint ?? ''}</span>
        </span>
        <button type="button" className="btn primary" disabled={!current} onClick={async () => {
          if (!current) return;
          await navigator.clipboard.writeText(current.prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>{copied ? t('Copied') : t('Copy MCP link')}</button>
      </div>
      {error && <p className="form-msg err">{error}</p>}
    </>
  );
}
