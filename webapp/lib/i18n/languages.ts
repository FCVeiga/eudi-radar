/** Interface languages (the site's buttons, labels and messages — not the agents' content). */
export const UI_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
] as const;
export type UiLang = (typeof UI_LANGUAGES)[number]['code'];
export const isUiLang = (v: unknown): v is UiLang => UI_LANGUAGES.some((l) => l.code === v);

/** Locale for dates and numbers in each interface language. */
export const LOCALES: Record<UiLang, string> = { en: 'en-GB', pt: 'pt-PT', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };

export const THEMES = ['light', 'dark', 'auto'] as const;
export type Theme = (typeof THEMES)[number];
export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);

export type Messages = Record<string, string>;
export type Vars = Record<string, string | number>;

/** The message in the dictionary (English text is the key and the fallback), with {placeholders} filled. */
export function translate(messages: Messages, key: string, vars?: Vars) {
  let s = messages[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
