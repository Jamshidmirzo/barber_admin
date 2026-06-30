"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Sparkles, Copy, Check, TrendingUp, TrendingDown } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

// ── Типы ответов бэкенда ─────────────────────────────────────────────────
interface HeatCell {
  day: string;
  hour: number;
  appointments: number;
  revenue: number;
}
interface HeatmapResponse {
  heatmap: HeatCell[];
  peak_day: string | null;
  peak_hour: number | null;
  slowest_day: string | null;
  slowest_hour: number | null;
}
interface WeekPoint {
  week: string;
  revenue: number;
  appointments: number;
}
interface DowPoint {
  day: string;
  avg_revenue: number;
  avg_appointments: number;
}
interface TrendsResponse {
  revenue_by_week: WeekPoint[];
  revenue_by_day_of_week: DowPoint[];
  avg_check: number;
  growth_vs_prev_period: number;
}
interface PromoSuggestion {
  title: string;
  description: string;
  day: string;
  hours: string;
  discount_suggestion: string;
  expected_impact: string;
}
interface PromoResponse {
  suggestions: PromoSuggestion[];
  summary: string;
}

// ── Константы / хелперы ──────────────────────────────────────────────────
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_RU: Record<string, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};
const DAY_RU_FULL: Record<string, string> = {
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
  sun: "Воскресенье",
};
const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9:00 … 20:00

type PeriodKey = "30" | "90" | "180" | "365";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30", label: "30д" },
  { key: "90", label: "90д" },
  { key: "180", label: "6м" },
  { key: "365", label: "год" },
];

function fmt(n: number) {
  return n.toLocaleString("ru") + " сум";
}
function hh(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export default function AnalyticsPage() {
  const { salon } = useSalon();
  const salonId = salon.id;
  const [period, setPeriod] = useState<PeriodKey>("30");

  const range = useMemo(() => {
    const days = Number(period);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  const heatmapQ = useQuery<HeatmapResponse>({
    queryKey: ["analytics-heatmap", salonId, period],
    queryFn: () =>
      api
        .get(`/salons/${salonId}/analytics/heatmap`, {
          params: { from: range.from, to: range.to },
        })
        .then((r) => r.data),
  });

  const trendsQ = useQuery<TrendsResponse>({
    queryKey: ["analytics-trends", salonId, period],
    queryFn: () =>
      api
        .get(`/salons/${salonId}/analytics/trends`, {
          params: { from: range.from, to: range.to },
        })
        .then((r) => r.data),
  });

  return (
    <div className="p-8">
      {/* Header + period filter */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Аналитика</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Загрузка, тренды выручки и подсказки по акциям
          </p>
        </div>
        <div className="flex bg-[#1F2937] rounded-xl p-1 gap-1">
          {PERIODS.map((p) => (
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
      </div>

      <HeatmapSection q={heatmapQ} />
      <TrendsSection q={trendsQ} />
      <PromoSection
        salonId={salonId}
        heatmap={heatmapQ.data}
        trends={trendsQ.data}
      />
    </div>
  );
}

// ── Секция 1: тепловая карта ─────────────────────────────────────────────
function HeatmapSection({
  q,
}: {
  q: { data?: HeatmapResponse; isLoading: boolean };
}) {
  const cells = q.data?.heatmap ?? [];
  const map = useMemo(() => {
    const m = new Map<string, HeatCell>();
    for (const c of cells) m.set(`${c.day}-${c.hour}`, c);
    return m;
  }, [cells]);
  const maxApp = useMemo(
    () => Math.max(1, ...cells.map((c) => c.appointments)),
    [cells],
  );

  function bg(app: number) {
    if (app <= 0) return "#111827";
    const alpha = 0.12 + (app / maxApp) * 0.88;
    return `rgba(34, 197, 94, ${alpha.toFixed(3)})`;
  }

  return (
    <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-white font-semibold text-sm">Тепловая карта загрузки</p>
        {q.data?.peak_day && (
          <p className="text-xs text-gray-400">
            Пик:{" "}
            <span className="text-green-400">
              {DAY_RU_FULL[q.data.peak_day]}
            </span>{" "}
            {q.data.peak_hour != null && hh(q.data.peak_hour)}
            {q.data.slowest_day && (
              <>
                {" · "}Тихо:{" "}
                <span className="text-gray-300">
                  {DAY_RU_FULL[q.data.slowest_day]}
                </span>{" "}
                {q.data.slowest_hour != null && hh(q.data.slowest_hour)}
              </>
            )}
          </p>
        )}
      </div>

      {q.isLoading ? (
        <div className="h-48 animate-pulse bg-white/5 rounded-xl" />
      ) : cells.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-gray-600">
          <TrendingUp className="w-7 h-7 mb-2" />
          <p className="text-sm text-gray-500">Нет записей за период</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-10" />
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="text-[10px] text-gray-500 font-medium pb-1 w-9"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d}>
                  <td className="text-xs text-gray-400 pr-2 text-right">
                    {DAY_RU[d]}
                  </td>
                  {HOURS.map((h) => {
                    const c = map.get(`${d}-${h}`);
                    const app = c?.appointments ?? 0;
                    return (
                      <td key={h}>
                        <div
                          title={`${DAY_RU[d]} ${hh(h)} — ${app} записей, ${fmt(
                            c?.revenue ?? 0,
                          )}`}
                          className="w-9 h-9 rounded-md flex items-center justify-center text-[11px] font-medium transition-transform hover:scale-110 cursor-default"
                          style={{
                            backgroundColor: bg(app),
                            color: app > 0 ? "#fff" : "#374151",
                          }}
                        >
                          {app > 0 ? app : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Секция 2: тренды ─────────────────────────────────────────────────────
function TrendsSection({
  q,
}: {
  q: { data?: TrendsResponse; isLoading: boolean };
}) {
  const data = q.data;
  const dowData = (data?.revenue_by_day_of_week ?? []).map((d) => ({
    ...d,
    day_ru: DAY_RU[d.day] ?? d.day,
  }));
  const growth = data?.growth_vs_prev_period ?? 0;
  const up = growth >= 0;

  return (
    <>
      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1F2937] rounded-2xl p-5">
          <p className="text-gray-400 text-xs mb-1">Средний чек</p>
          <p className="text-white text-xl font-bold">
            {data ? fmt(data.avg_check) : "—"}
          </p>
        </div>
        <div className="bg-[#1F2937] rounded-2xl p-5">
          <p className="text-gray-400 text-xs mb-1">Рост vs прошлый период</p>
          <p
            className={`text-xl font-bold flex items-center gap-1.5 ${
              up ? "text-green-400" : "text-red-400"
            }`}
          >
            {up ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            {data ? `${up ? "+" : ""}${growth}%` : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Линейный график выручки по неделям */}
        <div className="bg-[#1F2937] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">
            Выручка по неделям
          </p>
          {q.isLoading ? (
            <div className="h-64 animate-pulse bg-white/5 rounded-xl" />
          ) : (data?.revenue_by_week.length ?? 0) > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data!.revenue_by_week}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    stroke="#374151"
                    minTickGap={20}
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
            <EmptyChart />
          )}
        </div>

        {/* Bar chart: средняя выручка по дням недели */}
        <div className="bg-[#1F2937] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">
            Средняя выручка по дням недели
          </p>
          {q.isLoading ? (
            <div className="h-64 animate-pulse bg-white/5 rounded-xl" />
          ) : dowData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dowData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day_ru"
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    stroke="#374151"
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
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid #374151",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                    formatter={(v) =>
                      [fmt(Number(v)), "Ср. выручка"] as [string, string]
                    }
                  />
                  <Bar
                    dataKey="avg_revenue"
                    fill="#F59E0B"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>
    </>
  );
}

function EmptyChart() {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-gray-600">
      <TrendingUp className="w-7 h-7 mb-2" />
      <p className="text-sm text-gray-500">Нет данных за период</p>
    </div>
  );
}

// ── Секция 3: ИИ-подсказки по акциям ─────────────────────────────────────
function PromoSection({
  salonId,
  heatmap,
  trends,
}: {
  salonId: string;
  heatmap?: HeatmapResponse;
  trends?: TrendsResponse;
}) {
  const dayLoads = useMemo(() => {
    if (!heatmap) return [];
    const totals = new Map<string, number>();
    for (const c of heatmap.heatmap)
      totals.set(c.day, (totals.get(c.day) ?? 0) + c.appointments);
    return DAYS.filter((d) => totals.has(d)).map((d) => ({
      day: d,
      appointments: totals.get(d) ?? 0,
    }));
  }, [heatmap]);

  const mutation = useMutation<PromoResponse, unknown>({
    mutationFn: () =>
      api
        .post(`/salons/${salonId}/analytics/promo-suggestions`, {
          peak_day: heatmap?.peak_day ?? null,
          peak_hour: heatmap?.peak_hour ?? null,
          slowest_day: heatmap?.slowest_day ?? null,
          slowest_hour: heatmap?.slowest_hour ?? null,
          avg_check: trends?.avg_check ?? 0,
          growth_vs_prev_period: trends?.growth_vs_prev_period ?? 0,
          day_loads: dayLoads,
        })
        .then((r) => r.data),
  });

  const ready = !!heatmap && !!trends;

  return (
    <div className="bg-[#1F2937] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#F59E0B]" />
          <p className="text-white font-semibold text-sm">
            ИИ-подсказки по акциям
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!ready || mutation.isPending}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {mutation.isPending ? "ИИ анализирует…" : "Получить подсказки от ИИ"}
        </button>
      </div>

      {mutation.isPending && (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#F59E0B] mb-3" />
          <p className="text-gray-400 text-sm">
            ИИ анализирует ваши данные…
          </p>
          <p className="text-gray-600 text-xs mt-1">обычно 2–5 секунд</p>
        </div>
      )}

      {mutation.isError && !mutation.isPending && (
        <p className="text-red-400 text-sm py-4">
          {parseApiError(mutation.error, "Не удалось получить подсказки")}
        </p>
      )}

      {mutation.data && !mutation.isPending && (
        <div>
          {mutation.data.summary && (
            <p className="text-gray-300 text-sm bg-[#111827] rounded-xl p-4 mb-4">
              {mutation.data.summary}
            </p>
          )}
          {mutation.data.suggestions.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              Подсказок нет — загрузка ровная.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mutation.data.suggestions.map((s, i) => (
                <PromoCard key={i} s={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {!mutation.data && !mutation.isPending && !mutation.isError && (
        <p className="text-gray-500 text-sm">
          Нажмите кнопку — ИИ найдёт провальные часы и предложит акции, чтобы их
          заполнить.
        </p>
      )}
    </div>
  );
}

function PromoCard({ s }: { s: PromoSuggestion }) {
  const [copied, setCopied] = useState(false);

  function copyForPost() {
    const text =
      `🔥 ${s.title}\n\n${s.description}\n\n` +
      `📅 ${DAY_RU_FULL[s.day] ?? s.day}, ${s.hours}\n` +
      `🎁 Скидка ${s.discount_suggestion}\n\n` +
      `Записывайтесь — количество мест ограничено!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#111827] rounded-xl p-4 border border-white/5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white font-semibold text-sm">{s.title}</p>
        <span className="shrink-0 text-[10px] font-semibold bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 rounded-full">
          🤖 AI
        </span>
      </div>
      <p className="text-gray-400 text-sm mb-3 leading-relaxed">
        {s.description}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded-lg">
          {DAY_RU_FULL[s.day] ?? s.day} · {s.hours}
        </span>
        <span className="text-xs bg-green-500/15 text-green-400 px-2 py-1 rounded-lg">
          Скидка {s.discount_suggestion}
        </span>
      </div>
      {s.expected_impact && (
        <p className="text-gray-500 text-xs mb-3">📈 {s.expected_impact}</p>
      )}
      <button
        onClick={copyForPost}
        className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Скопировано" : "Скопировать для поста"}
      </button>
    </div>
  );
}
