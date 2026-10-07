'use client';

import { createContext, useCallback, useContext } from 'react';
import { LOCALES, translate, type Messages, type UiLang, type Vars } from './languages';

const Ctx = createContext<{ lang: UiLang; messages: Messages }>({ lang: 'en', messages: {} });

export function I18nProvider({ lang, messages, children }: { lang: UiLang; messages: Messages; children: React.ReactNode }) {
  return <Ctx.Provider value={{ lang, messages }}>{children}</Ctx.Provider>;
}

/** t('English text', { vars }) in the viewer's language — for client components. */
export function useT() {
  const { messages } = useContext(Ctx);
  return useCallback((key: string, vars?: Vars) => translate(messages, key, vars), [messages]);
}
export const useLang = () => useContext(Ctx).lang;
export const useLocale = () => LOCALES[useContext(Ctx).lang];
