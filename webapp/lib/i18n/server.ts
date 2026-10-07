import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { LOCALES, isTheme, isUiLang, translate, type Theme, type UiLang, type Vars } from './languages';
import { messagesFor } from './messages';

export const LANG_COOKIE = 'ui_lang';
export const THEME_COOKIE = 'theme';

/** The viewer's interface language (cookie, set from their profile), English by default. */
export const getLang = cache((): UiLang => {
  const v = cookies().get(LANG_COOKIE)?.value;
  return isUiLang(v) ? v : 'en';
});

export const getTheme = cache((): Theme => {
  const v = cookies().get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : 'auto';
});

/** t('English text', { vars }) in the viewer's language — for server components and actions. */
export async function getT() {
  const messages = messagesFor(getLang());
  return (key: string, vars?: Vars) => translate(messages, key, vars);
}

export const getLocale = () => LOCALES[getLang()];
export { messagesFor };

const YEAR = 60 * 60 * 24 * 365;
/** Remember the interface language / display mode in cookies (actions and route handlers only). */
export function setPrefCookies(p: { lang?: string | null; theme?: string | null }) {
  const store = cookies();
  if (isUiLang(p.lang)) store.set(LANG_COOKIE, p.lang, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  if (isTheme(p.theme)) store.set(THEME_COOKIE, p.theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });
}

/** After logging in: apply the profile's saved language and display mode. */
export async function applyProfilePrefs(userId: string) {
  const { getSupabaseServerClient } = await import('@/lib/supabase');
  const { data } = await getSupabaseServerClient().from('profiles').select('ui_language, theme').eq('id', userId).maybeSingle();
  if (data) setPrefCookies({ lang: data.ui_language, theme: data.theme });
}

/** Same as getT(), for synchronous server components. */
export function getTSync() {
  const messages = messagesFor(getLang());
  return (key: string, vars?: Vars) => translate(messages, key, vars);
}
