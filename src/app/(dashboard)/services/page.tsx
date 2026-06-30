"use client";

import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Scissors } from "lucide-react";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface Barber {
  id: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

interface PublicServiceItem {
  id: string;
  name: string;
  price: number;
  duration_min: number;
  category: string;
}

interface MasterDetail {
  id: string;
  services: PublicServiceItem[];
}

interface ServiceRow extends PublicServiceItem {
  barberId: string;
  barberLabel: string;
}

const CAT_LABELS: Record<string, string> = {
  haircut: "Стрижка",
  beard: "Борода",
  coloring: "Окрашивание",
  treatment: "Уход",
  other: "Другое",
};

function barberLabel(b: Pick<Barber, "name" | "last_name">): string {
  return [b.name, b.last_name].filter(Boolean).join(" ") || "Без имени";
}

export default function ServicesPage() {
  const [barberFilter, setBarberFilter] = useState<string>("all");

  // Барберы салона — тот же источник, что и на странице /barbers.
  const { data: team, isLoading: teamLoading } = useQuery<{
    items: Barber[];
    total: number;
  }>({
    queryKey: ["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const barbers = team?.items ?? [];

  // Каталог услуг каждого мастера. /public/masters/{id} отдаёт активные услуги
  // (id, name, price, duration_min, category) — собираем по всем барберам.
  const serviceQueries = useQueries({
    queries: barbers.map((b) => ({
      queryKey: ["master-services", b.id],
      queryFn: () =>
        api.get<MasterDetail>(`/public/masters/${b.id}`).then((r) => r.data),
      staleTime: 60_000,
    })),
  });

  const servicesLoading = serviceQueries.some((q) => q.isLoading);
  const isLoading = teamLoading || servicesLoading;

  // Плоский список услуг с привязкой к барберу.
  const rows: ServiceRow[] = [];
  barbers.forEach((b, i) => {
    const detail = serviceQueries[i]?.data;
    const label = barberLabel(b);
    (detail?.services ?? []).forEach((s) => {
      rows.push({ ...s, barberId: b.id, barberLabel: label });
    });
  });
  rows.sort((a, b) =>
    a.barberLabel.localeCompare(b.barberLabel, "ru") ||
    a.name.localeCompare(b.name, "ru")
  );

  const filtered =
    barberFilter === "all"
      ? rows
      : rows.filter((r) => r.barberId === barberFilter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Услуги</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {filtered.length} услуг
            {barberFilter === "all" && barbers.length > 0
              ? ` · ${barbers.length} мастеров`
              : ""}
          </p>
        </div>

        {/* Фильтр по барберу */}
        <select
          value={barberFilter}
          onChange={(e) => setBarberFilter(e.target.value)}
          className="bg-[#1F2937] text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#F59E0B] cursor-pointer"
        >
          <option value="all">Все мастера</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {barberLabel(b)}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="bg-[#1F2937] rounded-2xl overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="px-5 py-4 border-b border-white/5 animate-pulse flex gap-4"
            >
              <div className="h-4 bg-white/10 rounded w-40" />
              <div className="h-4 bg-white/10 rounded w-24 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
            <Scissors className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">
            {barbers.length === 0
              ? "В салоне пока нет мастеров. Добавьте барбера во вкладке «Барберы»."
              : "У выбранного мастера нет услуг."}
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-[#1F2937] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium px-5 py-3">
                  Название
                </th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">
                  Категория
                </th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">
                  Барбер
                </th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">
                  Длительность
                </th>
                <th className="text-right text-gray-400 font-medium px-5 py-3">
                  Цена
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={`${s.barberId}-${s.id}`}
                  className={i < filtered.length - 1 ? "border-b border-white/5" : ""}
                >
                  <td className="px-5 py-4 text-white font-medium">{s.name}</td>
                  <td className="px-5 py-4 text-gray-400">
                    {s.category ? CAT_LABELS[s.category] ?? s.category : "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-300">{s.barberLabel}</td>
                  <td className="px-5 py-4 text-gray-400">{s.duration_min} мин</td>
                  <td className="px-5 py-4 text-right text-[#F59E0B] font-semibold tabular-nums">
                    {s.price.toLocaleString("ru")} сум
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
