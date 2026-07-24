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
    queryFn: () =>
      api.get("/profile").then((r) => {
        const data = r.data;
        // Backend serializes `Country` as uppercase ("UZ"/"KR" — deliberately,
        // after a past incident with mixed casing in that DB column, see
        // app.domain.entities.user.Country's docstring). Every consumer here
        // (useAdminCountry, onboarding's isKorea/isUzbek, barbers/profile
        // pages) compares against lowercase "kr"/"uz" — normalize once at
        // the fetch boundary instead of fixing every call site, and instead
        // of re-opening the casing question on the backend.
        return {
          ...data,
          country: data.country ? (data.country.toLowerCase() as "uz" | "kr") : null,
        };
      }),
    staleTime: 5 * 60_000,
  });
}
