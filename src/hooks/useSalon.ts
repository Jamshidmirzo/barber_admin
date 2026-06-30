"use client";

import { createContext, useContext } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import api from "@/lib/api";

export type SalonRole = "owner" | "admin" | "master";

export interface Salon {
  id: string;
  slug: string;
  name: string;
  owner_id: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  working_hours: Record<string, unknown>;
  created_at: string | null;
}

export interface SalonContextData {
  salon: Salon;
  role: SalonRole;
}

/**
 * Запрос контекста салона текущего пользователя.
 * 404 (нет салона) НЕ ретраим — это валидный сигнал «нужен онбординг».
 * 401 перехватывает axios-интерсептор в lib/api.ts → редирект на /login.
 */
export function useSalonContextQuery(): UseQueryResult<SalonContextData> {
  return useQuery<SalonContextData>({
    queryKey: ["salon-context"],
    queryFn: () => api.get("/salons/me/context").then((r) => r.data),
    retry: (failureCount, err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 401) return false;
      return failureCount < 1;
    },
    staleTime: 5 * 60_000,
  });
}

// ── React-контекст для доступа к салону на всех страницах дашборда ──────────

const SalonCtx = createContext<SalonContextData | null>(null);

export const SalonProvider = SalonCtx.Provider;

/** Доступ к салону + роли внутри дашборда. Бросает, если использован вне провайдера. */
export function useSalon(): SalonContextData {
  const ctx = useContext(SalonCtx);
  if (ctx === null) {
    throw new Error("useSalon must be used within <SalonProvider> (dashboard layout)");
  }
  return ctx;
}

/** Управленческие роли — видят финансы, команду, аналитику. */
export function isManager(role: SalonRole): boolean {
  return role === "owner" || role === "admin";
}
