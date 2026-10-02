/**
 * Settings page data: the company, its material for the agents, the search
 * scope and the agents' switches and fine-tuning (migration 015).
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getPlatformLanguage } from '@/lib/language';

export const DEFAULT_COMPANY = 'WalliD';
export const DOC_KINDS = [
  { kind: 'presentation', label: 'Commercial presentations', hint: 'Company and product decks, one-pagers, brochures' },
  { kind: 'reference', label: 'Contracts & project references', hint: 'Signed contracts, reference letters, case studies — with client, value, dates and scope' },
  { kind: 'cv', label: 'Team CVs', hint: 'CVs of the people you would put on a bid team' },
] as const;
export type DocKind = (typeof DOC_KINDS)[number]['kind'];

export type Company = { name: string; context: string };
export type SearchSettings = {
  scope: string; config: Record<string, any> | null; status: 'applied' | 'error' | null;
  error: string | null; parsed_at: string | null;
};
export type AgentSetting = {
  agent_key: string; enabled: boolean; instructions: string | null; prompt_override: string | null;
  default_prompt: string | null; status: string | null; error: string | null; updated_at: string | null;
};
export type CompanyDoc = { id: string; kind: string; name: string; size_bytes: number | null; chars: number | null; uploaded_at: string };

export async function getSettings() {
  const db = getSupabaseServerClient();
  const [{ data: rows }, { data: agents }, { data: docs }] = await Promise.all([
    db.from('app_settings').select('key, value'),
    db.from('agent_settings').select('*'),
    db.from('company_documents').select('id, kind, name, size_bytes, chars, uploaded_at').order('uploaded_at', { ascending: false }),
  ]);
  const value = (k: string) => (rows || []).find((r: any) => r.key === k)?.value ?? {};
  const company = value('company');
  const search = value('search');
  return {
    company: { name: company.name || '', context: company.context || '' } as Company,
    search: { scope: search.scope || '', config: search.config || null, status: search.status || null,
              error: search.error || null, parsed_at: search.parsed_at || null } as SearchSettings,
    agents: new Map(((agents || []) as AgentSetting[]).map((a) => [a.agent_key, a])),
    docs: (docs || []) as CompanyDoc[],
  };
}

/** Agents switched off on Settings (no row = on). */
export async function disabledAgents(): Promise<Set<string>> {
  const { data } = await getSupabaseServerClient().from('agent_settings').select('agent_key, enabled');
  return new Set((data || []).filter((r: any) => !r.enabled).map((r: any) => r.agent_key));
}

export async function isAgentEnabled(key: string) {
  const { data } = await getSupabaseServerClient().from('agent_settings').select('enabled').eq('agent_key', key).maybeSingle();
  return data?.enabled ?? true;
}

export async function companyName() {
  const { data } = await getSupabaseServerClient().from('app_settings').select('value').eq('key', 'company').maybeSingle();
  return (data?.value?.name || '').trim() || DEFAULT_COMPANY;
}

/**
 * The agent's system prompt: its fine-tuned version from Settings when there
 * is one, else the file in agents/; with the company name filled in.
 */
export async function agentPrompt(key: string, file: string) {
  const db = getSupabaseServerClient();
  const [{ data }, name, fallback] = await Promise.all([
    db.from('agent_settings').select('prompt_override').eq('agent_key', key).maybeSingle(),
    companyName(),
    readFile(path.join(process.cwd(), 'agents', file), 'utf8'),
  ]);
  const language = await getPlatformLanguage();
  return (data?.prompt_override || fallback).replaceAll('{company_name}', name).replaceAll('{language}', language.name);
}

const BRIEF_CHARS = { context: 30_000, docs: 160_000 };

/**
 * What the agents know about the company: the Settings description (or the
 * built-in brief in agents/company_brief.md if none is set), plus — for the
 * Tender Evaluation Agent — the text of every uploaded presentation,
 * reference and CV.
 */
export async function companyBrief({ withDocuments }: { withDocuments: boolean }) {
  const db = getSupabaseServerClient();
  const { company } = await getSettings();
  const name = company.name.trim() || DEFAULT_COMPANY;
  const context = company.context.trim()
    || await readFile(path.join(process.cwd(), 'agents', 'company_brief.md'), 'utf8');
  const parts = [`# Company: ${name}`, context.slice(0, BRIEF_CHARS.context)];
  if (withDocuments) {
    const { data: docs } = await db.from('company_documents').select('kind, name, text_content').order('kind');
    let budget = BRIEF_CHARS.docs;
    for (const k of DOC_KINDS) {
      const items = (docs || []).filter((d: any) => d.kind === k.kind && d.text_content);
      if (!items.length) continue;
      parts.push(`\n## ${k.label} (${items.length})`);
      // Share the budget evenly so one long deck can't crowd out the CVs.
      const share = Math.floor(budget / Math.max(1, items.length));
      for (const d of items) {
        const body = String(d.text_content).slice(0, Math.min(share, 40_000));
        parts.push(`\n### ${d.name}\n${body}`);
        budget -= body.length;
      }
    }
  }
  return parts.join('\n');
}
