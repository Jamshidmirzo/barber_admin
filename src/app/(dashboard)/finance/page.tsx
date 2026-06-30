"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import api from "@/lib/api";

type Period = "week" | "month" | "year";

interface WeeklyStats {
  week_start: string;
  week_end: string;
  appointments_total: number;
  appointments_completed: number;
  revenue_total_uzs: number;
  new_clients: number;
  returning_clients: number;
  top_services: { service_name: string; count: number; revenue: number }[];
  appointments_by_day: { date: string; count: number }[];
  compared_to_previous_week: { appointments_delta_pct: number | null; revenue_delta_pct: number | null };
}

interface TeamMember {
  id: string;
  name: string | null;
  last_name: string | null;
  phone: string;
  is_active: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("ru") + " сум";
}

function delta(pct: number | null) {
  if (pct === null) return null;
  const sign = pct >= 0 ? "+" : "";
  const color = pct >= 0 ? "text-green-400" : "text-red-400";
  return <span className={`text-xs ${color}`}>{sign}{pct.toFixed(0)}% к прошлой неделе</span>;
}

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>("week");

  // Use existing weekly-stats endpoint; for month/year we still call it but note it's weekly granularity
  const { data: stats, isLoading: statsLoading } = useQuery<WeeklyStats>({
    queryKey: ["finance", "weekly-stats", period],
    queryFn: () => api.get("/masters/me/weekly-stats").then((r) => r.data),
  });

  const { data: team } = useQuery<{ items: TeamMember[]; total: number }>({
    queryKey: ["team", "members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const maxCount = Math.max(...(stats?.appointments_by_day?.map((d) => d.count) ?? [1]), 1);

  const periods: { key: Period; label: string }[] = [
    { key: "week", label: "Неделя" },
    { key: "month", label: "Месяц" },
    { key: "year", label: "Год" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Финансы</h1>
          <p className="text-gray-400 text-sm mt-0.5">Аналитика и доходы</p>
        </div>
        <div className="flex bg-[#1F2937] rounded-xl p-1 gap-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.key ? "bg-[#F59E0B] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <div key={i} className="bg-[#1F2937] rounded-2xl p-5 animate-pulse h-24" />)}
        </div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Выручка"
              value={fmt(stats.revenue_total_uzs)}
              sub={delta(stats.compared_to_previous_week.revenue_delta_pct)}
            />
            <KpiCard
              label="Завершено записей"
              value={String(stats.appointments_completed)}
              sub={delta(stats.compared_to_previous_week.appointments_delta_pct)}
            />
            <KpiCard
              label="Средний чек"
              value={stats.appointments_completed > 0
                ? fmt(Math.round(stats.revenue_total_uzs / stats.appointments_completed))
                : "—"}
              sub={<span className="text-xs text-gray-500">{stats.new_clients} новых клиентов</span>}
            />
          </div>

          {/* Bar chart */}
          <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
            <p className="text-white font-semibold text-sm mb-4">Записи по дням</p>
            <div className="flex items-end gap-2 h-32">
              {stats.appointments_by_day.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{d.count || ""}</span>
                  <div
                    className="w-full rounded-t-lg bg-[#F59E0B]/80 transition-all"
                    style={{ height: `${Math.max((d.count / maxCount) * 96, d.count > 0 ? 8 : 2)}px` }}
                  />
                  <span className="text-[10px] text-gray-500">
                    {new Date(d.date).toLocaleDateString("ru", { weekday: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top services */}
          {stats.top_services.length > 0 && (
            <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
              <p className="text-white font-semibold text-sm mb-3">Топ услуги</p>
              <div className="space-y-2">
                {stats.top_services.map((s) => (
                  <div key={s.service_name} className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{s.service_name}</span>
                    <div className="text-right">
                      <span className="text-[#F59E0B] text-sm font-medium">{fmt(s.revenue)}</span>
                      <span className="text-gray-500 text-xs ml-2">× {s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24">
          <TrendingUp className="w-8 h-8 text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">Нет данных</p>
        </div>
      )}

      {/* Team table */}
      {team && team.items.length > 0 && (
        <div className="bg-[#1F2937] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-3">Барберы</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium pb-2">Имя</th>
                <th className="text-left text-gray-400 font-medium pb-2">Телефон</th>
                <th className="text-right text-gray-400 font-medium pb-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {team.items.map((m) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 text-white">{[m.name, m.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="py-2.5 text-gray-400">{m.phone}</td>
                  <td className="py-2.5 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.is_active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-500"}`}>
                      {m.is_active ? "Активен" : "Неактивен"}
                    </span>
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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-[#1F2937] rounded-2xl p-5">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white text-xl font-bold mb-1">{value}</p>
      {sub}
    </div>
  );
}
