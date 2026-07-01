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
import {
  ArrowLeft,
  Phone,
  TrendingUp,
  FileText,
  Film,
  Heart,
  Eye,
} from "lucide-react";
import api from "@/lib/api";

// ─── API Interfaces ──────────────────────────────────────────────────────────

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

interface MasterContentStats {
  master_id: string;
  posts_count: number;
  likes_count: number;
  comments_count: number;
  reels_count: number;
  total_reels_views: number;
  story_views_24h: number;
  subscribers_count: number;
}

// ─── UI Period types ──────────────────────────────────────────────────────────

type PeriodKey = "7" | "30" | "90" | "custom";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-[#1F2937] rounded-2xl p-5">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white text-xl font-bold mb-1">{value}</p>
      {sub}
    </div>
  );
}

function SkeletonBlock({ h = "h-24" }: { h?: string }) {
  return <div className={`bg-[#1F2937] rounded-2xl ${h} animate-pulse`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BarberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // UI-only state
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

  // Query 1: booking / revenue stats
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

  // Query 2: content stats (period-independent)
  const { data: contentData } = useQuery<MasterContentStats>({
    queryKey: ["master", id, "content-stats"],
    queryFn: () =>
      api.get(`/team/members/${id}/content-stats`).then((r) => r.data),
  });

  // Derived values
  const totalHours = data ? data.worked_hours + data.idle_hours : 0;
  const efficiency =
    totalHours > 0 ? Math.round((data!.worked_hours / totalHours) * 100) : 0;
  const idlePct =
    totalHours > 0 ? Math.round((data!.idle_hours / totalHours) * 100) : 0;
  const maxServiceCount = Math.max(
    ...(data?.top_services.map((s) => s.count) ?? [1]),
    1
  );

  const hasContent =
    contentData &&
    (contentData.posts_count > 0 ||
      contentData.reels_count > 0 ||
      contentData.likes_count > 0 ||
      contentData.total_reels_views > 0 ||
      contentData.story_views_24h > 0);

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "7", label: "7д" },
    { key: "30", label: "30д" },
    { key: "90", label: "90д" },
    { key: "custom", label: "Период" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/barbers"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к команде
      </Link>

      {/* ── A) Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] font-bold text-lg shrink-0 overflow-hidden">
            {data?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.photo_url}
                alt={data.name}
                className="w-full h-full object-cover"
              />
            ) : (
              initials(data?.name ?? "", data?.phone ?? "")
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {data?.name ?? "Барбер"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {data?.specializations && data.specializations.length > 0 ? (
                data.specializations.map((s) => (
                  <span
                    key={s}
                    className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-xs tabular-nums">
                  {data?.phone}
                </span>
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

      {/* ── B) Instagram-style summary bar ─────────────────────────────────── */}
      {isLoading || !data ? (
        <SkeletonBlock h="h-20" />
      ) : (
        <div className="bg-[#1F2937] rounded-2xl mb-6 grid grid-cols-3 divide-x divide-white/5">
          <SummaryCell label="Записи" value={String(data.total_appointments)} />
          <SummaryCell label="Клиенты" value={String(data.unique_clients)} />
          <SummaryCell label="Выручка" value={fmt(data.total_revenue)} small />
        </div>
      )}

      {/* ── C) Period selector ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex bg-[#1F2937] rounded-xl p-1 gap-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.key
                  ? "bg-[#F59E0B] text-white"
                  : "text-gray-400 hover:text-white"
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
        <div className="grid grid-cols-1 gap-4">
          <SkeletonBlock h="h-20" />
          <SkeletonBlock h="h-16" />
          <SkeletonBlock h="h-72" />
          <SkeletonBlock h="h-48" />
        </div>
      ) : (
        <>
          {/* ── D) Content stats ───────────────────────────────────────────── */}
          {hasContent && (
            <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
              <p className="text-white font-semibold text-sm mb-4">
                Контент
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ContentCard
                  icon={<FileText className="w-4 h-4" />}
                  label="Посты"
                  value={contentData!.posts_count}
                />
                <ContentCard
                  icon={<Film className="w-4 h-4" />}
                  label="Реелсы"
                  value={contentData!.reels_count}
                />
                <ContentCard
                  icon={<Heart className="w-4 h-4" />}
                  label="Лайки"
                  value={contentData!.likes_count}
                />
                <ContentCard
                  icon={<Eye className="w-4 h-4" />}
                  label="Сторис 24ч"
                  value={contentData!.story_views_24h}
                />
              </div>
            </div>
          )}

          {/* ── E) Time utilisation ────────────────────────────────────────── */}
          <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold text-sm">Загрузка времени</p>
              <p className="text-sm">
                <span className={idlePct > 30 ? "text-red-400" : "text-gray-400"}>
                  {idlePct}% пустые слоты
                </span>
              </p>
            </div>
            <div className="h-3 w-full rounded-full bg-[#111827] overflow-hidden flex">
              <div
                className="bg-[#F59E0B] h-full rounded-l-full"
                style={{ width: `${efficiency}%` }}
              />
              <div
                className="bg-red-500/40 h-full rounded-r-full"
                style={{ width: `${idlePct}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                Работал {data.worked_hours} ч
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                Пустые {data.idle_hours} ч
              </span>
            </div>
          </div>

          {/* ── F) Revenue line chart ──────────────────────────────────────── */}
          <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
            <p className="text-white font-semibold text-sm mb-4">
              Выручка по дням
            </p>
            {data.revenue_by_day.some((d) => d.revenue > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.revenue_by_day}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#374151"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tick={{ fill: "#6B7280", fontSize: 11 }}
                      stroke="#374151"
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                      }
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
                      labelFormatter={(l) =>
                        new Date(l as string).toLocaleDateString("ru")
                      }
                      formatter={(v) =>
                        [fmt(Number(v)), "Выручка"] as [string, string]
                      }
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

          {/* ── G) Two-column: top services + recent clients ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top services */}
            <div className="bg-[#1F2937] rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Топ услуг</p>
              {data.top_services.length > 0 ? (
                <div className="space-y-3">
                  {data.top_services.map((s) => (
                    <div key={s.service_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-300 text-sm truncate pr-2">
                          {s.name}
                        </span>
                        <span className="text-gray-500 text-xs shrink-0">
                          × {s.count}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#111827] overflow-hidden">
                        <div
                          className="h-full bg-[#F59E0B]/80 rounded-full"
                          style={{
                            width: `${(s.count / maxServiceCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-6 text-center">
                  Нет данных
                </p>
              )}
            </div>

            {/* Recent clients */}
            <div className="bg-[#1F2937] rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">
                Последние клиенты
              </p>
              {data.recent_clients.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-gray-400 font-medium pb-2">
                        Имя
                      </th>
                      <th className="text-left text-gray-400 font-medium pb-2">
                        Услуга
                      </th>
                      <th className="text-right text-gray-400 font-medium pb-2">
                        Сумма
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_clients.map((c, i) => (
                      <tr
                        key={`${c.client_id ?? "x"}-${i}`}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="py-2.5 pr-2">
                          <p className="text-white truncate">{c.name}</p>
                          <p className="text-gray-500 text-xs">
                            {new Date(c.date).toLocaleDateString("ru")}
                          </p>
                        </td>
                        <td className="py-2.5 text-gray-400 pr-2 truncate">
                          {c.service_name ?? "—"}
                        </td>
                        <td className="py-2.5 text-right text-[#F59E0B] font-medium whitespace-nowrap">
                          {fmt(c.amount_uzs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm py-6 text-center">
                  Нет завершённых записей
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Local sub-components ────────────────────────────────────────────────────

function SummaryCell({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-4 px-2">
      <p
        className={`text-white font-bold leading-none ${
          small ? "text-base" : "text-2xl"
        }`}
      >
        {value}
      </p>
      <p className="text-gray-500 text-xs mt-1">{label}</p>
    </div>
  );
}

function ContentCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-[#111827] rounded-xl p-3 flex items-center gap-3">
      <span className="text-gray-500 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm leading-none">
          {value.toLocaleString("ru")}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">{label}</p>
      </div>
    </div>
  );
}
