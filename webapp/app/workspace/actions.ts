'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { AGENTS, agentByKey } from '@/lib/agents';
import { DOC_KINDS } from '@/lib/settings';
import { PLATFORM_AGENT_KEYS, SCOPE_AGENT_KEYS, getEditableScope } from '@/lib/scopes';
import { getContext, isPlatformAdmin } from '@/lib/accounts';
import { fileText } from '@/lib/fileText';
import {
  friendlyError, parseSearchScope, tuneJson, tunePrompt, validateDocumentsConfig, validatePrompt, validateSearchConfig,
} from '@/lib/configAgent';

export type FormState = { ok: boolean; message: string } | null;
const BUCKET = 'company-files';
const MAX_BYTES = 50 * 1024 * 1024;
const FILE_TYPES = /\.(pdf|docx|pptx|xlsx|txt|md|csv)$/i;
const db = () => getSupabaseServerClient();
const NOT_YOURS = { ok: false, message: 'Only this workspace’s admins can change it (on a plan that allows customizing).' };

/** The signed-in user and a scope they may configure (null otherwise). */
async function own(scopeId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const scope = await getEditableScope(scopeId);
  return scope ? { user, scope } : null;
}

const refresh = (scopeId?: string) => {
  revalidatePath('/workspace');
  if (scopeId) revalidatePath(`/workspace/scopes/${scopeId}`);
};

/* ---------------- Scopes ---------------- */

/** New scope in the current workspace — admins, within the plan's number of scopes. */
export async function createScope() {
  const ctx = await getContext();
  if (!ctx) redirect('/login?next=/workspace');
  if (!ctx.canCustomize) redirect('/settings#billing');
  const { count } = await db().from('scopes').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspace.id);
  if (ctx.account.kind !== 'platform' && (count ?? 0) >= ctx.account.plan.scopes) redirect('/settings#billing');
  const { data, error } = await db().from('scopes').insert({ owner_id: (await getCurrentUser())!.id, workspace_id: ctx.workspace.id, name: 'New scope', active: true })
    .select('id').single();
  if (error || !data) throw new Error(error?.message || 'Could not create the scope.');
  revalidatePath('/', 'layout');
  redirect(`/workspace/scopes/${data.id}`);
}

export async function setScopeActive(scopeId: string, active: boolean): Promise<{ error?: string }> {
  const o = await own(scopeId);
  if (!o) return { error: NOT_YOURS.message };
  await db().from('scopes').update({ active, updated_at: new Date().toISOString() }).eq('id', scopeId);
  revalidatePath('/', 'layout');
  return {};
}

export async function saveScope(_prev: FormState, form: FormData): Promise<FormState> {
  const scopeId = String(form.get('scope') || '');
  const o = await own(scopeId);
  if (!o) return NOT_YOURS;
  const name = String(form.get('name') || '').trim().slice(0, 120);
  const instructions = String(form.get('instructions') || '').trim().slice(0, 30_000);
  if (!name) return { ok: false, message: 'Give the scope a name.' };
  await db().from('scopes').update({ name, instructions: instructions || null, updated_at: new Date().toISOString() }).eq('id', scopeId);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved — the scope’s agents use it from their next run.' };
}

export async function deleteScope(_prev: FormState, form: FormData): Promise<FormState> {
  const scopeId = String(form.get('scope') || '');
  const o = await own(scopeId);
  if (!o) return NOT_YOURS;
  if (o.scope.isDefault) return { ok: false, message: 'This is the platform’s default scope (what visitors see) — it can’t be deleted.' };
  if (String(form.get('confirm') || '').trim() !== o.scope.name) return { ok: false, message: `Type ${o.scope.name} to confirm.` };
  const { data: docs } = await db().from('company_documents').select('storage_path').eq('scope_id', scopeId);
  if (docs?.length) await db().storage.from(BUCKET).remove(docs.map((d: any) => d.storage_path));
  await db().from('scopes').delete().eq('id', scopeId);
  revalidatePath('/', 'layout');
  redirect('/workspace');
}

/* ---------------- Scope context (documents) ---------------- */

/** Step 1 of an upload: a one-time URL the browser sends the file to, straight to storage. */
export async function createCompanyUpload(scopeId: string, kind: string, filename: string, size: number) {
  if (!(await own(scopeId))) return { error: 'not your scope' };
  if (!DOC_KINDS.some((k) => k.kind === kind)) return { error: 'unknown document type' };
  if (!FILE_TYPES.test(filename)) return { error: 'use PDF, Word, PowerPoint, Excel or text files' };
  if (size > MAX_BYTES) return { error: 'files up to 50 MB' };
  const safe = filename.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-120);
  const storagePath = `${scopeId}/${kind}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) return { error: error?.message || 'could not start the upload' };
  return { path: storagePath, url: data.signedUrl };
}

/** Step 2: read the uploaded file's text for the agents and list it. */
export async function registerCompanyDocument(scopeId: string, kind: string, storagePath: string, name: string, size: number) {
  if (!(await own(scopeId))) return { error: 'not your scope' };
  if (!DOC_KINDS.some((k) => k.kind === kind) || !storagePath.startsWith(`${scopeId}/${kind}/`)) return { error: 'unknown upload' };
  const { data: blob, error } = await db().storage.from(BUCKET).download(storagePath);
  if (error || !blob) return { error: error?.message || 'upload not found' };
  let text = '';
  try { text = (await fileText(name, Buffer.from(await blob.arrayBuffer()))).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
  catch { /* stored anyway; listed as unreadable */ }
  const { error: insertError } = await db().from('company_documents').insert({
    scope_id: scopeId, kind, name: name.slice(0, 300), storage_path: storagePath, size_bytes: size,
    text_content: text.slice(0, 400_000) || null, chars: text.length,
  });
  if (insertError) return { error: insertError.message };
  refresh(scopeId);
  return { ok: true, chars: text.length };
}

export async function deleteCompanyDocument(id: string) {
  const { data } = await db().from('company_documents').select('storage_path, scope_id').eq('id', id).maybeSingle();
  if (!data?.scope_id || !(await own(data.scope_id))) return;
  await db().storage.from(BUCKET).remove([data.storage_path]);
  await db().from('company_documents').delete().eq('id', id);
  refresh(data.scope_id);
}

/* ---------------- Search Agent (per scope) ---------------- */

/** The scope's search scope: saved as written, then parsed by the Config Agent into its search configuration. */
export async function saveSearchScope(_prev: FormState, form: FormData): Promise<FormState> {
  const scopeId = String(form.get('scopeId') || '');
  const o = await own(scopeId);
  if (!o) return NOT_YOURS;
  const text = String(form.get('scope') || '').trim().slice(0, 8000);
  const now = new Date().toISOString();
  if (!text) {
    await db().from('scopes').update({ search_scope: null, search_config: null, search_status: null, search_error: null, updated_at: now }).eq('id', scopeId);
    refresh(scopeId);
    return { ok: true, message: 'Cleared — this scope searches with the built-in EUDI Wallet configuration.' };
  }
  try {
    const { data: triage } = await db().from('agent_settings').select('default_prompt').eq('agent_key', 'triage').maybeSingle();
    const config = await parseSearchScope(text, triage?.default_prompt || '');
    await db().from('scopes').update({ search_scope: text, search_config: config, search_status: 'applied', search_error: null, search_parsed_at: now, updated_at: now }).eq('id', scopeId);
    refresh(scopeId);
    return { ok: true, message: `Applied — ${config.ted_phrases.length} TED phrases, ${config.web_queries.length} web and ${config.news_queries.length} news queries, from the next run.` };
  } catch (e) {
    const message = friendlyError(e);
    await db().from('scopes').update({ search_scope: text, search_status: 'error', search_error: message, updated_at: now }).eq('id', scopeId);
    refresh(scopeId);
    return { ok: false, message: `Saved your text, but the Config Agent couldn’t apply it: ${message}. The previous configuration stays in use.` };
  }
}

/* ---------------- Agents: scope agents and platform agents ---------------- */

async function defaultPrompt(key: string) {
  const { data } = await db().from('agent_settings').select('default_prompt').eq('agent_key', key).maybeSingle();
  if (data?.default_prompt) return data.default_prompt as string;
  const file = agentByKey(key).prompt;  // webapp agents can read their own file
  return file?.startsWith('webapp/') ? readFile(path.join(process.cwd(), file.slice(7)), 'utf8') : null;
}

/** Where an agent's settings live: the scope's row, or the workspace agents' (platform admins only). Null when not allowed. */
async function target(key: string, scopeId: string | null) {
  const user = await getCurrentUser();
  if (!user || !AGENTS.some((a) => a.key === key)) return null;
  if (SCOPE_AGENT_KEYS.includes(key)) {
    if (!scopeId || !(await getEditableScope(scopeId))) return null;
    return {
      read: () => db().from('scope_agent_settings').select('*').eq('scope_id', scopeId).eq('agent_key', key).maybeSingle(),
      write: (v: Record<string, any>) => db().from('scope_agent_settings').upsert({ scope_id: scopeId, agent_key: key, ...v, updated_at: new Date().toISOString() }),
    };
  }
  if (!PLATFORM_AGENT_KEYS.includes(key) || !(await isPlatformAdmin())) return null;
  return {
    read: () => db().from('agent_settings').select('*').eq('agent_key', key).maybeSingle(),
    write: (v: Record<string, any>) => db().from('agent_settings').upsert({ agent_key: key, ...v, updated_at: new Date().toISOString() }),
  };
}

export async function setAgentEnabled(key: string, enabled: boolean, scopeId: string | null = null) {
  const t = await target(key, scopeId);
  if (!t) return;
  await t.write({ enabled });
  revalidatePath('/', 'layout');
}

/** Fine-tuning in plain language → the Config Agent rewrites the agent's prompt (for that scope, or the platform). */
export async function saveAgentTuning(_prev: FormState, form: FormData): Promise<FormState> {
  const key = String(form.get('agent') || '');
  const scopeId = String(form.get('scopeId') || '') || null;
  const agent = AGENTS.find((a) => a.key === key && a.fineTune);
  const t = agent && await target(key, scopeId);
  if (!agent || !t) return NOT_YOURS;
  const instructions = String(form.get('instructions') || '').trim().slice(0, 6000);
  if (!instructions) {
    await t.write({ instructions: null, prompt_override: null, status: null, error: null });
    refresh(scopeId ?? undefined);
    return { ok: true, message: 'Back to the default configuration.' };
  }
  const base = await defaultPrompt(key);
  if (!base) return { ok: false, message: 'This agent’s default configuration hasn’t been synced yet — it is after the next pipeline run.' };
  const { data: row } = await t.read();
  try {
    // From the agent's current configuration, so hand edits made in "Open config" are kept.
    const current = row?.prompt_override || base;
    const { prompt, note } = key === 'tender_documents'
      ? await tuneJson(agent.name, agent.role, current, instructions).then((r) => ({ prompt: JSON.stringify(r.config, null, 2), note: r.note }))
      : await tunePrompt(agent.name, agent.role, base, current, instructions);
    await t.write({ instructions, prompt_override: prompt, status: 'applied', error: null });
    refresh(scopeId ?? undefined);
    return { ok: true, message: note ? `Applied. ${note}` : 'Applied — the agent uses its new configuration from its next run.' };
  } catch (e) {
    const message = friendlyError(e);
    await t.write({ instructions, status: 'error', error: message });
    refresh(scopeId ?? undefined);
    return { ok: false, message: `Saved your text, but the Config Agent couldn’t apply it: ${message}. The agent keeps its current configuration.` };
  }
}

/** "Open config" → Save: the configuration as edited by hand becomes the one the agent runs on. */
export async function saveAgentConfig(_prev: FormState, form: FormData): Promise<FormState> {
  const key = String(form.get('agent') || '');
  const scopeId = String(form.get('scopeId') || '') || null;
  // Browsers submit textareas with CRLF line breaks; the prompts use LF.
  const config = String(form.get('config') || '').replace(/\r\n?/g, '\n');
  if (!AGENTS.some((a) => a.key === key && (a.fineTune || a.key === 'search'))) return { ok: false, message: 'This agent has no editable configuration.' };
  const now = new Date().toISOString();
  if (key === 'search') {
    if (!scopeId || !(await own(scopeId))) return NOT_YOURS;
    let parsed;
    try { parsed = validateSearchConfig(JSON.parse(config)); }
    catch (e: any) { return { ok: false, message: `Not saved: ${e instanceof SyntaxError ? 'that isn’t valid JSON' : e.message}.` }; }
    await db().from('scopes').update({ search_config: parsed, search_status: 'applied', search_error: null, search_parsed_at: now, updated_at: now }).eq('id', scopeId);
    refresh(scopeId);
    return { ok: true, message: 'Saved — this scope’s Search and Triage Agents use it from the next run.' };
  }
  const t = await target(key, scopeId);
  if (!t) return NOT_YOURS;
  const base = await defaultPrompt(key);
  if (!base) return { ok: false, message: 'This agent’s default configuration hasn’t been synced yet.' };
  let value = config;
  try {
    if (key === 'tender_documents') value = JSON.stringify(validateDocumentsConfig(JSON.parse(config)), null, 2);
    else validatePrompt(base, config);
  } catch (e: any) { return { ok: false, message: `Not saved: ${e instanceof SyntaxError ? 'that isn’t valid JSON' : e.message}.` }; }
  const same = key === 'tender_documents' ? JSON.stringify(JSON.parse(value)) === JSON.stringify(JSON.parse(base)) : value.trim() === base.trim();
  await t.write({ prompt_override: same ? null : value, status: same ? null : 'applied', error: null });
  refresh(scopeId ?? undefined);
  return { ok: true, message: same ? 'Matches the default — the agent runs on its default configuration.' : 'Saved — the agent uses this configuration from its next run.' };
}

/** Back to the built-in configuration (and no fine-tuning). */
export async function resetAgentConfig(key: string, scopeId: string | null = null) {
  if (key === 'search') {
    if (!scopeId || !(await own(scopeId))) return;
    await db().from('scopes').update({ search_scope: null, search_config: null, search_status: null, search_error: null }).eq('id', scopeId);
  } else {
    const t = await target(key, scopeId);
    if (!t) return;
    await t.write({ instructions: null, prompt_override: null, status: null, error: null });
  }
  refresh(scopeId ?? undefined);
}
