/**
  * lib/langStore.ts -- global language singleton (React-independent).
 *
  * Why it exists: so lib-layer pure functions (error messages, generated copy, etc.) can also sense the current language
  * without threading a lang param through every call site.
  *  - on the React side, <I18nProvider> calls setCurrentLang() when the language changes;
  *  - in provider-less scenarios like Node scripts (run via tsx), the default is "zh".
 */
export type Lang = "zh" | "en";

let current: Lang = "zh";

export function setCurrentLang(lang: Lang): void {
  current = lang === "en" ? "en" : "zh";
}

export function getLang(): Lang {
  return current;
}

/** Choose one of two by the current language. */
export function L(zh: string, en: string): string {
  return current === "en" ? en : zh;
}
