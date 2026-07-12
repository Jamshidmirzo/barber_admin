"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type AdminCountry = "uz" | "kr" | null;

/** Admin's registered country (from /profile) — drives currency and phone format across the dashboard. */
export function useAdminCountry(): AdminCountry {
  const { data } = useQuery<{ country: AdminCountry }>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  return data?.country ?? null;
}

export function currencyForCountry(country: AdminCountry): string {
  return country === "kr" ? "₩" : "so'm";
}

export function phoneCodeForCountry(country: AdminCountry): "+82" | "+998" {
  return country === "kr" ? "+82" : "+998";
}

export function formatPhoneForCountry(raw: string, country: AdminCountry): string {
  const cc = country === "kr" ? "82" : "998";
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  let out = "+" + cc;

  if (country === "kr") {
    // Korean mobile: always starts with "10", then 8 digits => 10 XXXX XXXX
    let normalized = local;
    if (normalized.length > 0 && !normalized.startsWith("1")) normalized = "1" + normalized;
    if (normalized.length > 1 && normalized[1] !== "0") normalized = normalized[0] + "0" + normalized.slice(1);
    if (normalized.length > 0) out += " " + normalized.slice(0, 2);
    if (normalized.length > 2) out += " " + normalized.slice(2, 6);
    if (normalized.length > 6) out += " " + normalized.slice(6, 10);
  } else {
    // Uzbek: XX XXX XX XX
    if (local.length > 0) out += " " + local.slice(0, 2);
    if (local.length > 2) out += " " + local.slice(2, 5);
    if (local.length > 5) out += " " + local.slice(5, 7);
    if (local.length > 7) out += " " + local.slice(7, 9);
  }
  return out;
}
