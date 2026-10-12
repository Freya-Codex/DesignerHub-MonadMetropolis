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
  /** 当前语言 / current language */
  lang: Lang;
  /** 设置语言 / set language */
  setLang: (lang: Lang) => void;
  /** 中英互换 / toggle zh <-> en */
  toggle: () => void;
  /**
   * 取词：
   *  - t("中文")            → 有字典时查字典，否则原样返回（英文模式下若缺翻译仍回退中文）
   *  - t("中文", "English") → 显式双语对，按当前语言选择
   *  - t(zh, en, { id })    → 支持 {name} 占位符插值
   */
  t: (zh: string, en?: string, vars?: Record<string, string | number>) => string;
  /** 根据当前语言挑选（用于数据数组里的中英字段） */
  pick: <T>(zh: T, en: T | undefined) => T;
  /** 供 toLocaleString / 日期格式化使用的 locale */
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
 * 轻量级站内中英双语 Provider（不改路由、不引入 next-intl）。
 * 语言状态保存在 localStorage，并同步到 <html lang>。
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 初始为 zh，挂载后再读取本地存储，避免 SSR/CSR 水合不一致。
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

/** 便捷 hook：只取 t */
export function useT(): I18nValue["t"] {
  return useI18n().t;
}

/**
 * 非 React 环境下读取当前语言（如 global-error 这类没有 Provider 的根兜底）。
 */
export function storedLang(): Lang {
  return readStoredLang();
}

/** 供 lib 层纯函数读取当前语言。 */
export { getLang, L } from "./langStore";
