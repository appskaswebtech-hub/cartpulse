import { dictionaries } from "./index";
import { additionalMessages } from "./ui-messages";
import type { Locale } from "./types";

const decode = (text: string) =>
  text.replace(
    /&(amp|rarr|larr|middot|times|nbsp);/g,
    (_, key: string) =>
      ({ amp: "&", rarr: "→", larr: "←", middot: "·", times: "×", nbsp: " " })[
        key
      ] ?? key,
  );
const normalize = (text: string) =>
  decode(text)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!…]+$/, "")
    .toLocaleLowerCase("en");
const catalogs: Record<Locale, Map<string, string>> = {
  en: new Map(),
  es: new Map(),
  nl: new Map(),
  fr: new Map(),
  it: new Map(),
};
function collect(english: unknown, localized: unknown, locale: Locale) {
  if (typeof english === "string" && typeof localized === "string")
    catalogs[locale].set(normalize(english), localized);
  else if (
    english &&
    localized &&
    typeof english === "object" &&
    typeof localized === "object"
  ) {
    for (const key of Object.keys(english))
      collect(
        (english as Record<string, unknown>)[key],
        (localized as Record<string, unknown>)[key],
        locale,
      );
  }
}
for (const locale of Object.keys(catalogs) as Locale[]) {
  collect(dictionaries.en, dictionaries[locale], locale);
  for (const [english, translations] of Object.entries(additionalMessages))
    catalogs[locale].set(
      normalize(english),
      locale === "en" ? english : translations[locale],
    );
}
const patterns = Object.keys(additionalMessages)
  .filter((key) => /\{\d+\}/.test(key))
  .map((key) => {
    const slots: string[] = [];
    const expression = normalize(key)
      .split(/(\{\d+\})/)
      .map((part) => {
        if (/^\{\d+\}$/.test(part)) {
          slots.push(part);
          return "(.+?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { key, slots, regex: new RegExp("^" + expression + "$", "i") };
  });
export function translateUI<T>(
  locale: Locale,
  value: T,
  values?: unknown[],
): T {
  if (typeof value !== "string") return value;
  const text = decode(value);
  if (!text.trim() || locale === "en") {
    let result = text;
    if (values)
      values.forEach((item, index) => {
        result = result.split("{" + index + "}").join(String(item ?? ""));
      });
    return result as T;
  }
  let translation = catalogs[locale].get(normalize(text));
  if (!translation) {
    for (const pattern of patterns) {
      const match = pattern.regex.exec(text.trim().replace(/[.!…]+$/, ""));
      if (!match) continue;
      translation = catalogs[locale].get(normalize(pattern.key)) ?? pattern.key;
      pattern.slots.forEach((slot, index) => {
        translation = translation!.split(slot).join(match[index + 1]);
      });
      break;
    }
  }
  let result = translation ?? text;
  if (values)
    values.forEach((item, index) => {
      result = result.split("{" + index + "}").join(String(item ?? ""));
    });
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  return (leading + result.trim() + trailing) as T;
}
