/**
 * lib/langStore.ts —— 全局语言单例（不依赖 React）。
 *
 * 存在的意义：让 lib 层的纯函数（错误信息、生成文案等）也能感知当前语言，
 * 而无需把 lang 参数一路穿进所有调用点。
 *  - React 侧由 <I18nProvider> 负责在语言切换时调用 setCurrentLang()；
 *  - Node 脚本（tsx 运行）等无 Provider 的场景，默认 "zh"。
 */
export type Lang = "zh" | "en";

let current: Lang = "zh";

export function setCurrentLang(lang: Lang): void {
  current = lang === "en" ? "en" : "zh";
}

export function getLang(): Lang {
  return current;
}

/** 按当前语言二选一。 */
export function L(zh: string, en: string): string {
  return current === "en" ? en : zh;
}
