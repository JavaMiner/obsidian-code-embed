import { getLanguage } from "obsidian";
import en from "./i18n/en.json";
import pl from "./i18n/pl.json";
import de from "./i18n/de.json";
import fr from "./i18n/fr.json";
import es from "./i18n/es.json";
import nl from "./i18n/nl.json";
import it from "./i18n/it.json";
export const CE_LOCALES = { en, pl, de, fr, es, nl, it };
export type Language = keyof typeof CE_LOCALES;

function activeLanguage(): Language {
  const locale =
    getLanguage?.() ||
    (globalThis as { moment?: { locale(): string } }).moment?.locale?.() ||
    globalThis.navigator?.language ||
    "en";
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(CE_LOCALES, language) ? (language as Language) : "en";
}

export function guideUrl() {
  const language = activeLanguage();
  const filename = language === "en" ? "README.md" : "README." + language + ".md";
  return "https://github.com/JavaMiner/obsidian-code-embed/blob/main/" + filename;
}

export function t(key: keyof typeof en, values: Record<string, string | number> = {}) {
  const message = CE_LOCALES[activeLanguage()][key] ?? CE_LOCALES.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token));
}
