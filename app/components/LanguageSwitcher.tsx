import { SUPPORTED_LOCALES, type Locale } from "../i18n/types";
import { useTranslation } from "../i18n/LanguageContext";

export function LanguageSwitcher() {
  const { locale, t, setLocale } = useTranslation();

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        color: "#6b7280",
      }}
    >
      <span style={{ display: "none" }}>{t.common.language}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t.common.language}
        style={{
          fontSize: "13px",
          color: "#374151",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {t.common.languageNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
