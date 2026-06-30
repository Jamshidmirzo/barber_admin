"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ArrowLeft, Phone, TrendingUp } from "lucide-react";
import api from "@/lib/api";

interface TopService {
  service_id: string;
  name: string;
  count: number;
}

interface RecentClient {
  client_id: string | null;
  name: string;
  date: string;
  service_name: string | null;
  amount_uzs: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface MasterStats {
  master_id: string;
  name: string;
  phone: string;
  photo_url: string | null;
  specializations: string[];
  date_from: string;
  date_to: string;
  total_revenue: number;
  total_appointments: number;
  unique_clients: number;
  worked_hours: number;
  idle_hours: number;
  top_services: TopService[];
  recent_clients: RecentClient[];
  revenue_by_day: RevenuePoint[];
}

type PeriodKey = "7" | "30" | "90" | "custom";

function fmt(n: number) {
  return n.toLocaleString("ru") + " сум";
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function initials(name: string, phone: string) {
  const n = name.trim();
  return n && n !== "—" ? n.slice(0, 2).toUpperCase() : phone.slice(-2);
}

function shortDay(iso: string) {
  return new Date(iso).toLocaleDateString("ru", { day: "2-digit", month: "2-digit" });
}

export default function BarberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [period, setPeriod] = useState<PeriodKey>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    if (period === "custom") {
      if (!customFrom || !customTo) return null;
      return { from: customFrom, to: customTo };
    }
    const days = Number(period);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    return { from: isoDate(from), to: isoDate(to) };
  }, [period, customFrom, customTo]);

  const { data, isLoading } = useQuery<MasterStats>({
    queryKey: ["master", id, "stats", range?.from, range?.to],
    queryFn: () =>
      api
        .get(`/team/members/${id}/stats`, {
          params: range ? { from: range.from, to: range.to } : undefined,
        })
        .then((r) => r.data),
    enabled: !!range,
  });

  const totalHours = data ? data.worked_hours + data.idle_hours : 0;
  const efficiency = totalHours > 0 ? Math.round((data!.worked_hours / totalHours) * 100) : 0;
  const idlePct = totalHours > 0 ? Math.round((data!.idle_hours / totalHours) * 100) : 0;
  const maxServiceCount = Math.max(...(data?.top_services.map((s) => s.count) ?? [1]), 1);

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "7", label: "7 дней" },
    { key: "30", label: "30 дней" },
    { key: "90", label: "90 дней" },
    { key: "custom", label: "Период" },
  ];

  return (
    <div className="p-8">
      <Link
        href="/barbers"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        К команде
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] font-bold shrink-0 overflow-hidden">
            {data?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo_url} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              initials(data?.name ?? "", data?.phone ?? "")
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{data?.name ?? "Барбер"}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {data?.specializations.length ? (
                data.specializations.map((s) => (
                  <span key={s} className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-xs tabular-nums">{data?.phone}</span>
              )}
            </div>
          </div>
        </div>
        {data?.phone && (
          <a
            href={`tel:${data.phone}`}
            className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
          >
            <Phone className="w-4 h-4" />
            Позвонить
          </a>
        )}
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-[#1F2937] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#F59E0B]"
            />
            <span className="text-gray-500">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-[#1F2937] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#F59E0B]"
            />
          </div>
        )}
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#1F2937] rounded-2xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Выручка" value={fmt(data.total_revenue)} />
            <KpiCard label="Записи" value={String(data.total_appointments)} />
            <KpiCard label="Клиенты" value={String(data.unique_clients)} />
            <KpiCard
              label="КПД"
              value={`${efficiency}%`}
              sub={
                <span className="text-xs text-gray-500">
                  {data.worked_hours} из {Math.round(totalHours)} ч
                </span>
              }
            />
          </div>

          {/* Idle hours indicator */}
          <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold text-sm">Загрузка времени</p>
              <p className="text-sm">
                <span className={idlePct > 30 ? "text-red-400" : "text-gray-400"}>
                  {idlePct}% времени пустые
                </span>
              </p>
            </div>
            <div className="h-3 w-full rounded-full bg-[#111827] overflow-hidden flex">
              <div className="bg-[#F59E0B] h-full" style={{ width: `${efficiency}%` }} />
              <div className="bg-red-500/40 h-full" style={{ width: `${idlePct}%` }} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Занято {data.worked_hours} ч
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" /> Пусто {data.idle_hours} ч
              </span>
            </div>
          </div>

          {/* Revenue line chart */}
          <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
            <p className="text-white font-semibold text-sm mb-4">Выручка по дням</p>
            {data.revenue_by_day.some((d) => d.revenue > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenue_by_day} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tick={{ fill: "#6B7280", fontSize: 11 }}
                      stroke="#374151"
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                      tick={{ fill: "#6B7280", fontSize: 11 }}
                      stroke="#374151"
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 12,
                        color: "#fff",
                      }}
                      labelFormatter={(l) => new Date(l as string).toLocaleDateString("ru")}
                      formatter={(v) => [fmt(Number(v)), "Выручка"] as [string, string]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#F59E0B" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-gray-600">
                <TrendingUp className="w-7 h-7 mb-2" />
                <p className="text-sm text-gray-500">Нет выручки за период</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top services */}
            <div className="bg-[#1F2937] rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Топ услуг</p>
              {data.top_services.length > 0 ? (
                <div className="space-y-3">
                  {data.top_services.map((s) => (
                    <div key={s.service_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-300 text-sm truncate pr-2">{s.name}</span>
                        <span className="text-gray-500 text-xs shrink-0">× {s.count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#111827] overflow-hidden">
                        <div
                          className="h-full bg-[#F59E0B]/80 rounded-full"
                          style={{ width: `${(s.count / maxServiceCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-6 text-center">Нет данных</p>
              )}
            </div>

            {/* Recent clients */}
            <div className="bg-[#1F2937] rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Последние клиенты</p>
              {data.recent_clients.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-gray-400 font-medium pb-2">Имя</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Услуга</th>
                      <th className="text-right text-gray-400 font-medium pb-2">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_clients.map((c, i) => (
                      <tr key={`${c.client_id ?? "x"}-${i}`} className="border-b border-white/5 last:border-0">
                        <td className="py-2.5 pr-2">
                          <p className="text-white truncate">{c.name}</p>
                          <p className="text-gray-500 text-xs">
                            {new Date(c.date).toLocaleDateString("ru")}
                          </p>
                        </td>
                        <td className="py-2.5 text-gray-400 pr-2 truncate">{c.service_name ?? "—"}</td>
                        <td className="py-2.5 text-right text-[#F59E0B] font-medium whitespace-nowrap">
                          {fmt(c.amount_uzs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm py-6 text-center">Нет завершённых записей</p>
              )}
            </div>
          </div>
        </>
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
