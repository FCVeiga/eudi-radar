/**
 * The platform language: every text the site shows is in it. It is set in
 * the Translator Agent's configuration — the line "Target language: English
 * (en)" in its prompt (default prompts/translation.md, or its fine-tuned
 * version on Settings).
 */
import { getSupabaseServerClient } from '@/lib/supabase';
import { setDisplayLanguage } from '@/lib/english';

export type Language = { name: string; code: string };
export const DEFAULT_LANGUAGE: Language = { name: 'English', code: 'en' };
export const TARGET_LINE = /^Target language:\s*(.+?)\s*\(([a-z]{2,3})\)\s*$/im;

export function parseTargetLanguage(prompt: string | null | undefined): Language | null {
  const m = prompt?.match(TARGET_LINE);
  return m ? { name: m[1].trim(), code: m[2].toLowerCase() } : null;
}

let cached: { at: number; lang: Language } | null = null;

/** The platform language (cached briefly: it changes rarely). Also sets the display filter's language. */
export async function getPlatformLanguage(): Promise<Language> {
  if (cached && Date.now() - cached.at < 30_000) return cached.lang;
  let lang = DEFAULT_LANGUAGE;
  try {
    const { data } = await getSupabaseServerClient().from('agent_settings')
      .select('prompt_override, default_prompt').eq('agent_key', 'translator').maybeSingle();
    lang = parseTargetLanguage(data?.prompt_override) ?? parseTargetLanguage(data?.default_prompt) ?? DEFAULT_LANGUAGE;
  } catch { /* settings unavailable: English */ }
  cached = { at: Date.now(), lang };
  setDisplayLanguage(lang.code);
  return lang;
}
