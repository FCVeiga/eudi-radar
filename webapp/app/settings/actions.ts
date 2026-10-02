'use server';

import { revalidatePath } from 'next/cache';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { AGENTS, agentByKey } from '@/lib/agents';
import { DOC_KINDS } from '@/lib/settings';
import { fileText } from '@/lib/fileText';
import {
  friendlyError, parseSearchScope, tuneJson, tunePrompt, validateDocumentsConfig, validatePrompt, validateSearchConfig,
} from '@/lib/configAgent';

export type FormState = { ok: boolean; message: string } | null;
const BUCKET = 'company-files';
const MAX_BYTES = 50 * 1024 * 1024;
const FILE_TYPES = /\.(pdf|docx|pptx|xlsx|txt|md|csv)$/i;

async function saveSetting(key: string, value: Record<string, any>) {
  const { error } = await getSupabaseServerClient().from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function saveCompany(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { ok: false, message: 'Log in to change settings.' };
  const name = String(form.get('name') || '').trim().slice(0, 120);
  const context = String(form.get('context') || '').trim().slice(0, 30_000);
  if (!name) return { ok: false, message: 'Add the company name.' };
  try { await saveSetting('company', { name, context }); } catch (e: any) { return { ok: false, message: e.message }; }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved — the agents use it from their next run.' };
}

/** Step 1 of an upload: a one-time URL the browser sends the file to, straight to storage. */
export async function createCompanyUpload(kind: string, filename: string, size: number) {
  if (!(await getCurrentUser())) return { error: 'log in first' };
  if (!DOC_KINDS.some((k) => k.kind === kind)) return { error: 'unknown document type' };
  if (!FILE_TYPES.test(filename)) return { error: 'use PDF, Word, PowerPoint, Excel or text files' };
  if (size > MAX_BYTES) return { error: 'files up to 50 MB' };
  const safe = filename.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-120);
  const storagePath = `${kind}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await getSupabaseServerClient().storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) return { error: error?.message || 'could not start the upload' };
  return { path: storagePath, url: data.signedUrl };
}

/** Step 2: read the uploaded file's text for the agents and list it. */
export async function registerCompanyDocument(kind: string, storagePath: string, name: string, size: number) {
  if (!(await getCurrentUser())) return { error: 'log in first' };
  if (!DOC_KINDS.some((k) => k.kind === kind) || !storagePath.startsWith(`${kind}/`)) return { error: 'unknown upload' };
  const db = getSupabaseServerClient();
  const { data: blob, error } = await db.storage.from(BUCKET).download(storagePath);
  if (error || !blob) return { error: error?.message || 'upload not found' };
  let text = '';
  try { text = (await fileText(name, Buffer.from(await blob.arrayBuffer()))).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
  catch { /* stored anyway; listed as unreadable */ }
  const { error: insertError } = await db.from('company_documents').insert({
    kind, name: name.slice(0, 300), storage_path: storagePath, size_bytes: size,
    text_content: text.slice(0, 400_000) || null, chars: text.length,
  });
  if (insertError) return { error: insertError.message };
  revalidatePath('/settings');
  return { ok: true, chars: text.length };
}

export async function deleteCompanyDocument(id: string) {
  if (!(await getCurrentUser())) return;
  const db = getSupabaseServerClient();
  const { data } = await db.from('company_documents').select('storage_path').eq('id', id).maybeSingle();
  if (!data) return;
  await db.storage.from(BUCKET).remove([data.storage_path]);
  await db.from('company_documents').delete().eq('id', id);
  revalidatePath('/settings');
}

/** The search scope: saved as written, then parsed by the Config Agent into the search configuration. */
export async function saveSearchScope(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { ok: false, message: 'Log in to change settings.' };
  const scope = String(form.get('scope') || '').trim().slice(0, 8000);
  const db = getSupabaseServerClient();
  const { data: current } = await db.from('app_settings').select('value').eq('key', 'search').maybeSingle();
  const previous = current?.value || {};
  if (!scope) {
    await saveSetting('search', {});
    revalidatePath('/settings');
    return { ok: true, message: 'Cleared — the radar is back on its built-in EUDI Wallet scope.' };
  }
  try {
    const { data: triage } = await db.from('agent_settings').select('default_prompt').eq('agent_key', 'triage').maybeSingle();
    const config = await parseSearchScope(scope, triage?.default_prompt || '');
    await saveSetting('search', { scope, config, status: 'applied', error: null, parsed_at: new Date().toISOString() });
    revalidatePath('/settings');
    return { ok: true, message: `Applied — ${config.ted_phrases.length} TED phrases, ${config.web_queries.length} web and ${config.news_queries.length} news queries, from the next run.` };
  } catch (e) {
    // Keep the text and whatever configuration was running before.
    const message = friendlyError(e);
    await saveSetting('search', { ...previous, scope, status: 'error', error: message });
    revalidatePath('/settings');
    return { ok: false, message: `Saved your text, but the Config Agent couldn’t apply it: ${message}. The previous scope stays in use.` };
  }
}

export async function setAgentEnabled(key: string, enabled: boolean) {
  if (!(await getCurrentUser())) return;
  if (!AGENTS.some((a) => a.key === key)) return;
  await getSupabaseServerClient().from('agent_settings')
    .upsert({ agent_key: key, enabled, updated_at: new Date().toISOString() });
  revalidatePath('/', 'layout');
}

async function defaultPrompt(key: string) {
  const { data } = await getSupabaseServerClient().from('agent_settings').select('default_prompt').eq('agent_key', key).maybeSingle();
  if (data?.default_prompt) return data.default_prompt as string;
  const file = agentByKey(key).prompt;  // webapp agents can read their own file
  return file?.startsWith('webapp/') ? readFile(path.join(process.cwd(), file.slice(7)), 'utf8') : null;
}

/** Fine-tuning in plain language → the Config Agent rewrites the agent's prompt. */
export async function saveAgentTuning(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { ok: false, message: 'Log in to change settings.' };
  const key = String(form.get('agent') || '');
  const agent = AGENTS.find((a) => a.key === key && a.fineTune);
  if (!agent) return { ok: false, message: 'Unknown agent.' };
  const instructions = String(form.get('instructions') || '').trim().slice(0, 6000);
  const db = getSupabaseServerClient();
  const now = new Date().toISOString();
  if (!instructions) {
    await db.from('agent_settings').upsert({ agent_key: key, instructions: null, prompt_override: null, status: null, error: null, updated_at: now });
    revalidatePath('/settings');
    return { ok: true, message: 'Back to the default configuration.' };
  }
  const base = await defaultPrompt(key);
  if (!base) return { ok: false, message: 'This agent’s default configuration hasn’t been synced yet — it is after the next pipeline run.' };
  const { data: row } = await db.from('agent_settings').select('prompt_override').eq('agent_key', key).maybeSingle();
  try {
    // From the agent's current configuration, so hand edits made in "Open config" are kept.
    const current = row?.prompt_override || base;
    const { prompt, note } = key === 'tender_documents'
      ? await tuneJson(agent.name, agent.role, current, instructions).then((r) => ({ prompt: JSON.stringify(r.config, null, 2), note: r.note }))
      : await tunePrompt(agent.name, agent.role, base, current, instructions);
    await db.from('agent_settings').upsert({ agent_key: key, instructions, prompt_override: prompt, status: 'applied', error: null, updated_at: now });
    revalidatePath('/settings');
    return { ok: true, message: note ? `Applied. ${note}` : 'Applied — the agent uses its new configuration from its next run.' };
  } catch (e) {
    const message = friendlyError(e);
    await db.from('agent_settings').upsert({ agent_key: key, instructions, status: 'error', error: message, updated_at: now });
    revalidatePath('/settings');
    return { ok: false, message: `Saved your text, but the Config Agent couldn’t apply it: ${message}. The agent keeps its current configuration.` };
  }
}

/** "Open config" → Save: the configuration as edited by hand becomes the one the agent runs on. */
export async function saveAgentConfig(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { ok: false, message: 'Log in to change settings.' };
  const key = String(form.get('agent') || '');
  // Browsers submit textareas with CRLF line breaks; the prompts use LF.
  const config = String(form.get('config') || '').replace(/\r\n?/g, '\n');
  if (!AGENTS.some((a) => a.key === key && (a.fineTune || a.key === 'search'))) return { ok: false, message: 'This agent has no editable configuration.' };
  const db = getSupabaseServerClient();
  const now = new Date().toISOString();
  if (key === 'search') {
    let parsed;
    try { parsed = validateSearchConfig(JSON.parse(config)); }
    catch (e: any) { return { ok: false, message: `Not saved: ${e instanceof SyntaxError ? 'that isn’t valid JSON' : e.message}.` }; }
    const { data: current } = await db.from('app_settings').select('value').eq('key', 'search').maybeSingle();
    await saveSetting('search', { ...(current?.value || {}), config: parsed, status: 'applied', error: null, parsed_at: now, edited: true });
    revalidatePath('/settings');
    return { ok: true, message: 'Saved — the Search and Triage Agents use it from the next run.' };
  }
  const base = await defaultPrompt(key);
  if (!base) return { ok: false, message: 'This agent’s default configuration hasn’t been synced yet.' };
  let value = config;
  try {
    if (key === 'tender_documents') value = JSON.stringify(validateDocumentsConfig(JSON.parse(config)), null, 2);
    else validatePrompt(base, config);
  } catch (e: any) { return { ok: false, message: `Not saved: ${e instanceof SyntaxError ? 'that isn’t valid JSON' : e.message}.` }; }
  const same = key === 'tender_documents' ? JSON.stringify(JSON.parse(value)) === JSON.stringify(JSON.parse(base)) : value.trim() === base.trim();
  await db.from('agent_settings').upsert({ agent_key: key, prompt_override: same ? null : value, status: same ? null : 'applied', error: null, updated_at: now });
  revalidatePath('/settings');
  return { ok: true, message: same ? 'Matches the default — the agent runs on its default configuration.' : 'Saved — the agent uses this configuration from its next run.' };
}

/** Back to the built-in configuration (and no fine-tuning). */
export async function resetAgentConfig(key: string) {
  if (!(await getCurrentUser())) return;
  if (!AGENTS.some((a) => a.key === key)) return;
  const db = getSupabaseServerClient();
  if (key === 'search') await saveSetting('search', {});
  else await db.from('agent_settings').upsert({ agent_key: key, instructions: null, prompt_override: null, status: null, error: null, updated_at: new Date().toISOString() });
  revalidatePath('/settings');
}
