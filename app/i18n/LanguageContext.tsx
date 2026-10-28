import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Dictionary, type Locale } from "./types";
import { getDictionary, isSupportedLocale } from "./index";

const STORAGE_KEY = "cartpulse_locale";

interface LanguageContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  /** Locale auto-detected on the server from the request's Accept-Language header. */
  detectedLocale: Locale;
  children: ReactNode;
}

export function LanguageProvider({ detectedLocale, children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(detectedLocale);

  // On mount, a manually chosen language (saved in this browser) takes priority
  // over the auto-detected one.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isSupportedLocale(saved) && saved !== locale) {
        setLocaleState(saved);
      }
    } catch {
      // localStorage may be unavailable (e.g. blocked in iframe) — fall back to detected locale
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  };

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, t: getDictionary(locale), setLocale }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, t: getDictionary(DEFAULT_LOCALE), setLocale: () => {} };
  }
  return ctx;
}
