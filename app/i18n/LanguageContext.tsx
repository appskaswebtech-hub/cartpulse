import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, type Dictionary, type Locale } from "./types";
import { getDictionary, isSupportedLocale } from "./index";
import { translateUI } from "./ui";

export const LANGUAGE_STORAGE_KEY = "cartpulse_locale";
interface LanguageContextValue {
  locale: Locale;
  t: Dictionary;
  tr: <T>(text: T, values?: unknown[]) => T;
  setLocale: (locale: Locale) => void;
}
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  detectedLocale,
  children,
}: {
  detectedLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(detectedLocale);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLocale(saved)) setLocaleState(saved);
    } catch {
      /* Cookie and in-memory state remain available in restricted iframes. */
    }
    const syncLanguage = (event: StorageEvent) => {
      if (
        event.key === LANGUAGE_STORAGE_KEY &&
        isSupportedLocale(event.newValue)
      )
        setLocaleState(event.newValue);
    };
    window.addEventListener("storage", syncLanguage);
    return () => window.removeEventListener("storage", syncLanguage);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    } catch {
      /* Storage can be blocked in embedded apps. */
    }
    try {
      const cookiePolicy =
        window.location.protocol === "https:"
          ? "; SameSite=None; Secure"
          : "; SameSite=Lax";
      document.cookie = `${LANGUAGE_STORAGE_KEY}=${locale}; Path=/; Max-Age=31536000${cookiePolicy}`;
    } catch {
      /* The selected language still works for this app session. */
    }
  }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    if (isSupportedLocale(next)) setLocaleState(next);
  }, []);
  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      t: getDictionary(locale),
      tr: <T,>(text: T, values?: unknown[]) =>
        translateUI(locale, text, values),
      setLocale,
    }),
    [locale, setLocale],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  return (
    context ?? {
      locale: DEFAULT_LOCALE,
      t: getDictionary(DEFAULT_LOCALE),
      tr: <T,>(text: T, values?: unknown[]) =>
        translateUI(DEFAULT_LOCALE, text, values),
      setLocale: () => {},
    }
  );
}
