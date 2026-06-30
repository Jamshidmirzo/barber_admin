"use client";

import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import api from "@/lib/api";

interface Profile {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  specializations: string[];
  is_onboarded: boolean;
}

export default function ProfilePage() {
  const { data, isLoading } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="bg-[#1F2937] rounded-2xl p-6 max-w-lg animate-pulse space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/10" />
          <div className="h-5 bg-white/10 rounded w-40" />
          <div className="h-4 bg-white/10 rounded w-32" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const fullName = [data.name, data.last_name].filter(Boolean).join(" ") || "—";
  const initials = fullName !== "—" ? fullName.slice(0, 2).toUpperCase() : data.phone.slice(-2);

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-white mb-6">Профиль</h1>

      <div className="bg-[#1F2937] rounded-2xl p-6 max-w-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] font-bold text-lg">
            {initials}
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{fullName}</p>
            <p className="text-gray-400 text-sm tabular-nums">{data.phone}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {data.city && (
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-400">Город</span>
              <span className="text-white">{data.city}</span>
            </div>
          )}
          {data.bio && (
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-400">О себе</span>
              <span className="text-white text-right max-w-xs">{data.bio}</span>
            </div>
          )}
          {data.specializations.length > 0 && (
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-400">Специализации</span>
              <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                {data.specializations.map((s) => (
                  <span key={s} className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-between py-3">
            <span className="text-gray-400">Онбординг</span>
            <span className={data.is_onboarded ? "text-green-400" : "text-yellow-400"}>
              {data.is_onboarded ? "Завершён" : "Не завершён"}
            </span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl">
          <div className="flex items-center gap-2 text-[#F59E0B] text-sm">
            <Settings className="w-4 h-4" />
            <span className="font-medium">Редактирование профиля</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Используйте мобильное приложение для редактирования профиля</p>
        </div>
      </div>
    </div>
  );
}
