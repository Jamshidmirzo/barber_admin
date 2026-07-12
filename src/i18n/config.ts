export const locales = ["ru", "en", "ko", "uz"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
export const localeCookieName = "barber_admin_locale";

export const localeLabels: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  ko: "한국어",
  uz: "O'zbekcha",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
