"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Sparkles, Copy, Check, TrendingUp, TrendingDown } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

interface HeatCell { day: string; hour: number; appointments: number; revenue: number; }
interface HeatmapResponse {
  heatmap: HeatCell[];
  peak_day: string | null; peak_hour: number | null;
  slowest_day: string | null; slowest_hour: number | null;
}
interface WeekPoint { week: string; revenue: number; appointments: number; }
interface DowPoint { day: string; avg_revenue: number; avg_appointments: number; }
interface TrendsResponse {
  revenue_by_week: WeekPoint[];
  revenue_by_day_of_week: DowPoint[];
  avg_check: number;
  growth_vs_prev_period: number;
}
interface PromoSuggestion {
  title: string; description: string; day: string; hours: string;
  discount_suggestion: string; expected_impact: string;
}
interface PromoResponse { suggestions: PromoSuggestion[]; summary: string; }

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"] as const;
const DAY_RU: Record<string, string> = { mon:"Пн", tue:"Вт", wed:"Ср", thu:"Чт", fri:"Пт", sat:"Сб", sun:"Вс" };
const DAY_RU_FULL: Record<string, string> = {
  mon:"Понедельник", tue:"Вторник", wed:"Среда", thu:"Четверг",
  fri:"Пятница", sat:"Суббота", sun:"Воскресенье",
};
const HOURS = Array.from({ length:12 }, (_, i) => i + 9);

type PeriodKey = "30" | "90" | "180" | "365";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key:"30", label:"30д" }, { key:"90", label:"90д" },
  { key:"180", label:"6м" }, { key:"365", label:"год" },
];

function fmt(n: number) { return n.toLocaleString("ru") + " сум"; }
function hh(h: number) { return `${String(h).padStart(2,"0")}:00`; }

const cardStyle: React.CSSProperties = {
  background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24,
};

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
    queryFn: () => api.get(`/salons/${salonId}/analytics/heatmap`, { params: { from: range.from, to: range.to } }).then((r) => r.data),
  });

  const trendsQ = useQuery<TrendsResponse>({
    queryKey: ["analytics-trends", salonId, period],
    queryFn: () => api.get(`/salons/${salonId}/analytics/trends`, { params: { from: range.from, to: range.to } }).then((r) => r.data),
  });

  return (
    <div style={{ padding:"32px 36px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:16 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
            Аналитика
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Загрузка, тренды выручки и подсказки по акциям</p>
        </div>
        <div style={{
          display:"flex", background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", padding:4, gap:4,
        }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding:"6px 14px", borderRadius:9, border:"none", cursor:"pointer",
                background: period === p.key ? "var(--gold)" : "transparent",
                color: period === p.key ? "#0a0a0b" : "var(--text2)",
                fontSize:12, fontWeight:600, transition:"background 0.15s, color 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <HeatmapSection q={heatmapQ} />
      <TrendsSection q={trendsQ} />
      <PromoSection salonId={salonId} heatmap={heatmapQ.data} trends={trendsQ.data} />
    </div>
  );
}

function HeatmapSection({ q }: { q: { data?: HeatmapResponse; isLoading: boolean } }) {
  const cells = q.data?.heatmap ?? [];
  const map = useMemo(() => {
    const m = new Map<string, HeatCell>();
    for (const c of cells) m.set(`${c.day}-${c.hour}`, c);
    return m;
  }, [cells]);
  const maxApp = useMemo(() => Math.max(1, ...cells.map((c) => c.appointments)), [cells]);

  function bg(app: number) {
    if (app <= 0) return "var(--bg2)";
    const alpha = 0.15 + (app / maxApp) * 0.85;
    return `rgba(201,164,92,${alpha.toFixed(3)})`;
  }

  return (
    <div style={{ ...cardStyle, marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:8 }}>
        <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>Тепловая карта загрузки</p>
        {q.data?.peak_day && (
          <p style={{ fontSize:12, color:"var(--text2)", margin:0 }}>
            Пик: <span style={{ color:"var(--gold)" }}>{DAY_RU_FULL[q.data.peak_day]}</span>{" "}
            {q.data.peak_hour != null && hh(q.data.peak_hour)}
            {q.data.slowest_day && (
              <> · Тихо: <span style={{ color:"var(--text)" }}>{DAY_RU_FULL[q.data.slowest_day]}</span>{" "}
              {q.data.slowest_hour != null && hh(q.data.slowest_hour)}</>
            )}
          </p>
        )}
      </div>

      {q.isLoading ? (
        <div style={{ height:180, background:"var(--bg2)", borderRadius:"var(--radius)", animation:"pulse 1.5s infinite" }}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : cells.length === 0 ? (
        <div style={{ height:160, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text3)" }}>
          <TrendingUp size={28} style={{ marginBottom:8 }} />
          <p style={{ fontSize:13, color:"var(--text2)" }}>Нет записей за период</p>
        </div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderSpacing:4, borderCollapse:"separate" }}>
            <thead>
              <tr>
                <th style={{ width:32 }} />
                {HOURS.map((h) => (
                  <th key={h} style={{ width:34, fontSize:10, color:"var(--text3)", fontWeight:500, paddingBottom:4, textAlign:"center" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d}>
                  <td style={{ fontSize:11, color:"var(--text2)", paddingRight:6, textAlign:"right" }}>{DAY_RU[d]}</td>
                  {HOURS.map((h) => {
                    const c = map.get(`${d}-${h}`);
                    const app = c?.appointments ?? 0;
                    return (
                      <td key={h}>
                        <div
                          title={`${DAY_RU[d]} ${hh(h)} — ${app} записей, ${fmt(c?.revenue ?? 0)}`}
                          style={{
                            width:34, height:34, borderRadius:7,
                            background: bg(app),
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:11, fontWeight:600,
                            color: app > 0 ? "#0a0a0b" : "var(--text3)",
                            cursor:"default",
                            transition:"transform 0.1s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1.1)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; }}
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

function TrendsSection({ q }: { q: { data?: TrendsResponse; isLoading: boolean } }) {
  const data = q.data;
  const dowData = (data?.revenue_by_day_of_week ?? []).map((d) => ({ ...d, day_ru: DAY_RU[d.day] ?? d.day }));
  const growth = data?.growth_vs_prev_period ?? 0;
  const up = growth >= 0;

  const chartTooltip = {
    contentStyle: { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, color:"var(--text)", fontSize:12 },
  };

  return (
    <>
      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
        <div style={cardStyle}>
          <p style={{ color:"var(--text2)", fontSize:11, margin:"0 0 6px", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Средний чек</p>
          <p style={{ color:"var(--text)", fontSize:22, fontWeight:700, margin:0 }}>{data ? fmt(data.avg_check) : "—"}</p>
        </div>
        <div style={cardStyle}>
          <p style={{ color:"var(--text2)", fontSize:11, margin:"0 0 6px", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Рост vs прошлый период</p>
          <p style={{ color: up ? "var(--green)" : "var(--red)", fontSize:22, fontWeight:700, margin:0, display:"flex", alignItems:"center", gap:8 }}>
            {up ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {data ? `${up ? "+" : ""}${growth}%` : "—"}
          </p>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:20, marginBottom:20 }}>
        {/* Line chart */}
        <div style={cardStyle}>
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 18px" }}>Выручка по неделям</p>
          {q.isLoading ? (
            <div style={{ height:240, background:"var(--bg2)", borderRadius:"var(--radius)", animation:"pulse 1.5s infinite" }} />
          ) : (data?.revenue_by_week.length ?? 0) > 0 ? (
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.revenue_by_week} margin={{ top:5, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" minTickGap={20} />
                  <YAxis tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" width={40} />
                  <Tooltip {...chartTooltip} formatter={(v) => [fmt(Number(v)), "Выручка"] as [string, string]} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} dot={false} activeDot={{ r:4, fill:"var(--gold)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart />}
        </div>

        {/* Bar chart */}
        <div style={cardStyle}>
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 18px" }}>Средняя выручка по дням недели</p>
          {q.isLoading ? (
            <div style={{ height:240, background:"var(--bg2)", borderRadius:"var(--radius)", animation:"pulse 1.5s infinite" }} />
          ) : dowData.length > 0 ? (
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dowData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day_ru" tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" />
                  <YAxis tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" width={40} />
                  <Tooltip {...chartTooltip} cursor={{ fill:"rgba(255,255,255,0.04)" }} formatter={(v) => [fmt(Number(v)), "Ср. выручка"] as [string, string]} />
                  <Bar dataKey="avg_revenue" fill="var(--gold)" radius={[6,6,0,0]} fillOpacity={0.9} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart />}
        </div>
      </div>
    </>
  );
}

function EmptyChart() {
  return (
    <div style={{ height:240, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text3)" }}>
      <TrendingUp size={28} style={{ marginBottom:8 }} />
      <p style={{ fontSize:13, color:"var(--text2)" }}>Нет данных за период</p>
    </div>
  );
}

function PromoSection({ salonId, heatmap, trends }: { salonId: string; heatmap?: HeatmapResponse; trends?: TrendsResponse }) {
  const dayLoads = useMemo(() => {
    if (!heatmap) return [];
    const totals = new Map<string, number>();
    for (const c of heatmap.heatmap) totals.set(c.day, (totals.get(c.day) ?? 0) + c.appointments);
    return DAYS.filter((d) => totals.has(d)).map((d) => ({ day: d, appointments: totals.get(d) ?? 0 }));
  }, [heatmap]);

  const mutation = useMutation<PromoResponse, unknown>({
    mutationFn: () =>
      api.post(`/salons/${salonId}/analytics/promo-suggestions`, {
        peak_day: heatmap?.peak_day ?? null, peak_hour: heatmap?.peak_hour ?? null,
        slowest_day: heatmap?.slowest_day ?? null, slowest_hour: heatmap?.slowest_hour ?? null,
        avg_check: trends?.avg_check ?? 0,
        growth_vs_prev_period: trends?.growth_vs_prev_period ?? 0,
        day_loads: dayLoads,
      }).then((r) => r.data),
  });

  const ready = !!heatmap && !!trends;

  return (
    <div style={{ ...cardStyle, marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Sparkles size={16} style={{ color:"var(--gold)" }} />
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>ИИ-подсказки по акциям</p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!ready || mutation.isPending}
          style={{
            display:"flex", alignItems:"center", gap:8, background:"var(--gold)", color:"#0a0a0b",
            border:"none", borderRadius:"var(--radius)", padding:"9px 18px",
            fontSize:13, fontWeight:700, cursor: (!ready || mutation.isPending) ? "not-allowed" : "pointer",
            opacity: (!ready || mutation.isPending) ? 0.5 : 1, fontFamily:"'Manrope',sans-serif",
          }}
        >
          <Sparkles size={14} />
          {mutation.isPending ? "ИИ анализирует…" : "Получить подсказки от ИИ"}
        </button>
      </div>

      {mutation.isPending && (
        <div style={{ padding:"40px 0", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
          <div style={{ width:32, height:32, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--gold)", animation:"spin 0.8s linear infinite", marginBottom:12 }} />
          <p style={{ color:"var(--text2)", fontSize:13 }}>ИИ анализирует ваши данные…</p>
          <p style={{ color:"var(--text3)", fontSize:12, marginTop:4 }}>обычно 2–5 секунд</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {mutation.isError && !mutation.isPending && (
        <p style={{ color:"var(--red)", fontSize:13, padding:"12px 0" }}>
          {parseApiError(mutation.error, "Не удалось получить подсказки")}
        </p>
      )}

      {mutation.data && !mutation.isPending && (
        <div>
          {mutation.data.summary && (
            <p style={{
              color:"var(--text2)", fontSize:13, background:"var(--bg2)",
              border:"1px solid var(--border)", borderRadius:"var(--radius)",
              padding:"14px 16px", marginBottom:16, lineHeight:1.6,
            }}>
              {mutation.data.summary}
            </p>
          )}
          {mutation.data.suggestions.length === 0 ? (
            <p style={{ color:"var(--text2)", fontSize:13, textAlign:"center", padding:"12px 0" }}>
              Подсказок нет — загрузка ровная.
            </p>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
              {mutation.data.suggestions.map((s, i) => <PromoCard key={i} s={s} />)}
            </div>
          )}
        </div>
      )}

      {!mutation.data && !mutation.isPending && !mutation.isError && (
        <p style={{ color:"var(--text3)", fontSize:13 }}>
          Нажмите кнопку — ИИ найдёт провальные часы и предложит акции, чтобы их заполнить.
        </p>
      )}
    </div>
  );
}

function PromoCard({ s }: { s: PromoSuggestion }) {
  const [copied, setCopied] = useState(false);

  function copyForPost() {
    const text = `🔥 ${s.title}\n\n${s.description}\n\n📅 ${DAY_RU_FULL[s.day] ?? s.day}, ${s.hours}\n🎁 Скидка ${s.discount_suggestion}\n\nЗаписывайтесь — количество мест ограничено!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background:"var(--bg2)", border:"1px solid var(--border)",
      borderRadius:"var(--radius)", padding:16,
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:8 }}>
        <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>{s.title}</p>
        <span style={{ flexShrink:0, fontSize:10, fontWeight:700, background:"var(--gold-dim)", color:"var(--gold)", padding:"2px 8px", borderRadius:20 }}>
          🤖 AI
        </span>
      </div>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:12, lineHeight:1.55, marginTop:0 }}>{s.description}</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
        <span style={{ fontSize:11, background:"var(--surface)", color:"var(--text2)", padding:"3px 9px", borderRadius:20, border:"1px solid var(--border)" }}>
          {DAY_RU_FULL[s.day] ?? s.day} · {s.hours}
        </span>
        <span style={{ fontSize:11, background:"rgba(76,175,125,0.12)", color:"var(--green)", padding:"3px 9px", borderRadius:20 }}>
          Скидка {s.discount_suggestion}
        </span>
      </div>
      {s.expected_impact && (
        <p style={{ color:"var(--text3)", fontSize:12, marginBottom:12 }}>📈 {s.expected_impact}</p>
      )}
      <button
        onClick={copyForPost}
        style={{
          display:"flex", alignItems:"center", gap:6, background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--radius)",
          color:"var(--text2)", fontSize:12, fontWeight:500, padding:"6px 12px",
          cursor:"pointer",
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Скопировано" : "Скопировать для поста"}
      </button>
    </div>
  );
}
