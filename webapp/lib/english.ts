/**
 * English-only guard for everything the site renders.
 *
 * The pipeline translates titles, names and notes (agents/translator.py), but
 * if a translation is missing — e.g. the LLM was unavailable — the site must
 * not fall back to the original-language text. These helpers pick the first
 * candidate that is English, judged by the stored language when known, else
 * by script and common-word patterns.
 */

// Non-Latin scripts: Greek, Cyrillic, Hebrew/Arabic, Thai, CJK.
const NON_LATIN = /[Ͱ-ϿЀ-ӿ֐-ۿ฀-๿぀-ヿ一-鿿]/;

// Frequent function words that are distinctive for EU languages (not English).
const FOREIGN = new Set((
  'der die das und für mit von des den dem ist wird zur zum auf im bei eine einer durch über ' +
  'le la les des pour avec du une est dans par sur aux et au ' +
  'el los las para con una por del que se y ' +
  'il gli della delle dei per con che nel alla ' +
  'os das dos com uma pelo pela não ao ' +
  'het een van voor met zijn naar ' +
  'dla oraz się jest przez ' +
  'și pentru cu din ' +
  'och för att av till med som ' +
  'og til af ' +
  'ja tai sekä ' +
  'pro jako ' +
  'és az hogy ' +
  'ir un ar'
).split(/\s+/));
const ENGLISH = new Set('the and for of to with on an by from is are new this that be at as'.split(' '));
const DIACRITICS = /[äöüßéèêàâçñõãąęłńśźżőűčřšžůýíáóúåøæ]/gi;

export function looksEnglish(text: string | null | undefined, language?: string | null): boolean {
  if (!text) return false;
  if (language) return language.toLowerCase() === 'en';
  if (NON_LATIN.test(text)) return false;
  const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
  let foreign = 0, english = 0;
  for (const w of words) {
    if (ENGLISH.has(w)) english++;
    else if (FOREIGN.has(w)) foreign++;
  }
  if (foreign >= 2 && foreign > english) return false;
  const letters = text.replace(/[^\p{L}]/gu, '').length || 1;
  return (text.match(DIACRITICS)?.length ?? 0) / letters < 0.04;
}

/** First candidate that is English (undefined/null skipped). */
export function firstEnglish(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) if (c && looksEnglish(c)) return c;
  return null;
}

/**
 * Organisation names come as "Official name (English rendering)" when the
 * official name isn't English: show the English part.
 */
export function englishName(...names: (string | null | undefined)[]): string | null {
  for (const n of names) {
    if (!n) continue;
    if (looksEnglish(n)) return n;
    const inner = n.match(/\(([^()]+)\)\s*$/)?.[1];
    if (inner && looksEnglish(inner)) return inner;
  }
  return null;
}

export const TRANSLATION_PENDING = 'Untitled notice — English translation pending';
