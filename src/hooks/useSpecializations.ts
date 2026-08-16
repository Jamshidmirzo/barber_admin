"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import api from "@/lib/api";

export interface Specialization {
  id: string;
  category: string;
  name_en: string;
  name_ru: string;
  name_uz: string;
  name_ko: string;
  image_url: string | null;
}

/**
 * Shared specialization catalog (id, localized name, reference photo) —
 * served by the backend so `barber_admin` and the Flutter "pro" app read the
 * same taxonomy instead of each keeping its own hardcoded list. Static
 * reference data, so a long staleTime is fine.
 */
export function useSpecializationsQuery(): UseQueryResult<Specialization[]> {
  return useQuery<Specialization[]>({
    queryKey: ["specializations"],
    queryFn: () => api.get("/specializations").then((r) => r.data),
    staleTime: 60 * 60_000,
  });
}

type SpecializationLocale = "en" | "ru" | "uz" | "ko";

function isSpecializationLocale(locale: string): locale is SpecializationLocale {
  return locale === "en" || locale === "ru" || locale === "uz" || locale === "ko";
}

/** Localized label for a specialization, falling back to English/raw id. */
export function useSpecializationLabel() {
  const locale = useLocale();
  return (spec: Specialization | undefined, fallbackId: string) => {
    if (!spec) return fallbackId;
    const key = isSpecializationLocale(locale) ? locale : "en";
    return spec[`name_${key}`] || spec.name_en || fallbackId;
  };
}
