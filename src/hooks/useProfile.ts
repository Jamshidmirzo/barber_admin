"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Profile {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  specializations: string[];
  country: "uz" | "kr" | null;
  is_onboarded: boolean;
}

/**
 * Профиль текущего пользователя. staleTime держит данные из кэша (в т.ч.
 * прогретые сразу после регистрации, см. login/page.tsx) без лишнего GET
 * /profile при каждом заходе на onboarding/profile — сеть дергаем только
 * когда кэш реально устарел или инвалидирован явно.
 */
export function useProfileQuery(): UseQueryResult<Profile> {
  return useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}
