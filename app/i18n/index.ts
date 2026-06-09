import { en } from "./locales/en";
import { es } from "./locales/es";
import { nl } from "./locales/nl";
import { fr } from "./locales/fr";
import { it } from "./locales/it";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Dictionary, type Locale } from "./types";

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { Locale, Dictionary };

export const dictionaries: Record<Locale, Dictionary> = { en, es, nl, fr, it };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the best supported locale from a browser `Accept-Language` header,
 * which Shopify Admin/App Bridge populates with the merchant's admin language.
 */
export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: qPart ? parseFloat(qPart) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}
