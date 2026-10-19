// The languages of the messages and reports, and the choice of one from a language tag.

export const SUPPORTED_LANGUAGES = ['en', 'es'];

/** Pick the catalog for a language tag such as "es" or "es-MX"; unknown languages use English. */
export function pickLanguage(language) {
  const base = String(language ?? 'en').split('-')[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
}
