"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { setCurrentLang, type Lang } from "./langStore";

export type { Lang } from "./langStore";

export interface I18nValue {
  /** Current language */
  lang: Lang;
  /** Set language */
  setLang: (lang: Lang) => void;
  /** Toggle zh <-> en */
  toggle: () => void;
  /**
    * Lookup:
    *  - t("zh text")                  -> use the dictionary when available, otherwise return as-is (in English mode, a missing translation falls back to Chinese)
    *  - t("zh text", "English text") -> explicit bilingual pair, selected by the current language
    *  - t(zh, en, { id })    -> supports {name} placeholder interpolation
   */
  t: (zh: string, en?: string, vars?: Record<string, string | number>) => string;
  /** Pick by the current language (for zh/en fields inside data arrays) */
  pick: <T>(zh: T, en: T | undefined) => T;
  /** Locale used for toLocaleString / date formatting */
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = "dh-lang";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "zh";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "zh") return raw;
  } catch {
    /* ignore */
  }
  return "zh";
}

function persistLang(lang: Lang) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/**
  * Lightweight in-site zh/en provider (no routing changes, no next-intl).
  * The language state is kept in localStorage and synced to <html lang>.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Initialize to zh and read local storage after mount, to avoid SSR/CSR hydration mismatch.
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const stored = readStoredLang();
    if (stored !== "zh") setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistLang(next);
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "en" ? "zh" : "en";
      persistLang(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    }
    setCurrentLang(lang);
  }, [lang]);

  const t = useCallback(
    (zh: string, en?: string, vars?: Record<string, string | number>) => {
      let out = lang === "en" && typeof en === "string" ? en : zh;
      if (vars) {
        for (const key of Object.keys(vars)) {
          out = out.split(`{${key}}`).join(String(vars[key]));
        }
      }
      return out;
    },
    [lang]
  );

  const pick = useCallback(
    <T,>(zh: T, en: T | undefined): T => (lang === "en" && en !== undefined ? en : zh),
    [lang]
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      toggle,
      t,
      pick,
      locale: lang === "en" ? "en-US" : "zh-CN"
    }),
    [lang, setLang, toggle, t, pick]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within <I18nProvider>");
  }
  return ctx;
}

/** Convenience hook: returns only t */
export function useT(): I18nValue["t"] {
  return useI18n().t;
}

/**
  * Read the current language outside React (e.g. the global-error root fallback that has no provider).
 */
export function storedLang(): Lang {
  return readStoredLang();
}

/** Lets lib-layer pure functions read the current language. */
export { getLang, L } from "./langStore";
