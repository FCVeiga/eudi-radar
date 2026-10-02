/**
 * Platform-language guard for everything the site renders.
 *
 * The site shows only text in the platform language — the Translator Agent's
 * "Target language", English by default (lib/language.ts sets it here). The
 * pipeline writes and translates into that language; when a translation is
 * missing the site must not fall back to the original-language text. These
 * helpers pick the first candidate in the platform language, judged by the
 * stored language when known, else by script and distinctive common words.
 */

let display = 'en';
/** Set by getPlatformLanguage() (lib/language.ts) on each request that loads data. */
export function setDisplayLanguage(code: string) { display = code || 'en'; }
export function displayLanguage() { return display; }

// Scripts that identify a language family on their own.
const SCRIPTS: [RegExp, string[]][] = [
  [/[Ͱ-Ͽ]/, ['el']],
  [/[Ѐ-ӿ]/, ['bg', 'ru', 'uk', 'sr', 'mk']],
  [/[֐-׿]/, ['he']],
  [/[؀-ۿ]/, ['ar', 'fa']],
  [/[฀-๿]/, ['th']],
  [/[぀-ヿ一-鿿]/, ['ja', 'zh']],
];

// Frequent function words, distinctive per language (mostly not shared).
const WORDS: Record<string, string> = {
  en: 'the and for of to with on by from is are new this that be at as its will has into about after',
  de: 'der die das und für mit von des den dem ist wird zur zum auf im bei eine einer durch über nicht',
  fr: 'le la les des pour avec du une est dans par sur aux et au ce qui',
  es: 'el los las para con una por del que se y su al es',
  it: 'il gli della delle dei per con che nel alla di è una',
  pt: 'os das dos com uma pelo pela não ao da do em para que de no na',
  nl: 'het een van voor met zijn naar de en is op',
  pl: 'dla oraz się jest przez na w i z do',
  ro: 'și pentru cu din la de în pe',
  sv: 'och för att av till med som är på',
  da: 'og til af med for er på det',
  fi: 'ja tai sekä on ei se',
  cs: 'pro jako se na je a v',
  hu: 'és az hogy a egy is',
  lv: 'ir un ar par no',
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
// Letters and endings that point to one language (each match counts double).
const HINTS: Record<string, RegExp> = {
  pt: /[ãõ]|ção\b|ções\b|ç[aã]o/gi,
  es: /ñ|ción\b|ciones\b/gi,
  fr: /[èêëîûù]|\beau|\bl'|\bd'/gi,
  de: /ß|[äöü]|sch|ung\b/gi,
  it: /zione\b|zioni\b|\bè\b/gi,
  pl: /[łąęśźż]/gi,
  ro: /[șțăî]/gi,
  cs: /[ěřů]/gi,
  hu: /[őű]/gi,
  sv: /[å]/gi,
  da: /[øæ]/gi,
};
// The English rule's word list (unchanged from before languages were configurable).
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

/** Best guess of a text's language, or null when there isn't enough to tell. */
export function detectLanguage(text: string): string | null {
  for (const [re, langs] of SCRIPTS) if (re.test(text)) return langs[0];
  const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
  let best: string | null = null, bestScore = 0, second = 0;
  for (const [lang, set] of Object.entries(SETS)) {
    const score = words.filter((w) => set.has(w)).length + 2 * (text.match(HINTS[lang] ?? /$^/g)?.length ?? 0);
    if (score > bestScore) { second = bestScore; bestScore = score; best = lang; }
    else if (score > second) second = score;
  }
  return bestScore >= 1 && bestScore > second ? best : null;
}

/** Is the text in the platform language? */
export function inPlatformLanguage(text: string | null | undefined, language?: string | null): boolean {
  if (!text) return false;
  if (language) return language.toLowerCase() === display;
  const script = SCRIPTS.find(([re]) => re.test(text));
  if (script) return script[1].includes(display);
  if (SCRIPTS.some(([, langs]) => langs.includes(display))) return false;  // platform language needs another script
  if (display === 'en') {
    // English keeps its original, lenient rule: mixed titles (an English notice
    // naming a German programme) still show; only clearly foreign text doesn't.
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
  const guess = detectLanguage(text);
  if (guess && guess !== display) return false;
  return true;
}

/** First candidate in the platform language (undefined/null skipped). */
export function firstInLanguage(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) if (c && inPlatformLanguage(c)) return c;
  return null;
}

/**
 * Organisation names come as "Official name (rendering)" when the official
 * name isn't in the platform language: show the rendering.
 */
export function nameInLanguage(...names: (string | null | undefined)[]): string | null {
  for (const n of names) {
    if (!n) continue;
    if (inPlatformLanguage(n)) return n;
    const inner = n.match(/\(([^()]+)\)\s*$/)?.[1];
    if (inner && inPlatformLanguage(inner)) return inner;
  }
  return null;
}

export const TRANSLATION_PENDING = 'Untitled notice — translation pending';
