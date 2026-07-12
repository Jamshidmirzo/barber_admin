"use client";
import { useLocale } from "next-intl";

// Maps your app's next-intl locale codes to proper BCP-47 tags for Intl APIs
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  ko: "ko-KR",
  ru: "ru-RU",
  uz: "uz-UZ",
};

export function useIntlLocale(): string {
  const locale = useLocale();
  return LOCALE_MAP[locale] ?? "en-US";
}

export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions) {
  return n.toLocaleString(locale, opts);
}

export function formatDate(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString(locale, opts);
}

export function formatTime(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleTimeString(locale, opts ?? { hour: "2-digit", minute: "2-digit" });
}