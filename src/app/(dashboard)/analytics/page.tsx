"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";
import { useAdminCountry, currencyForCountry } from "@/hooks/useAdminCountry";

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

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"] as const;
const HOURS = Array.from({ length:12 }, (_, i) => i + 9);

type PeriodKey = "30" | "90" | "180" | "365";
const PERIODS: { key: PeriodKey; tKey: string }[] = [
  { key:"30", tKey:"d30" }, { key:"90", tKey:"d90" },
  { key:"180", tKey:"m6" }, { key:"365", tKey:"year" },
];

type Translator = ReturnType<typeof useTranslations>;

function dayLabel(t: Translator, day: string | null | undefined, full: boolean) {
  if (!day) return "";
  const known = (DAYS as readonly string[]).includes(day);
  return known ? t(`days.${full ? "full" : "short"}.${day}`) : day;
}

function fmt(n: number, currency: string) { return n.toLocaleString("ru") + " " + currency; }
function hh(h: number) { return `${String(h).padStart(2,"0")}:00`; }

const cardStyle: React.CSSProperties = {
  background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24,
};

export default function AnalyticsPage() {
  const t = useTranslations("Analytics");
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
            {t("title")}
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>{t("subtitle")}</p>
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
              {t(`periods.${p.tKey}`)}
            </button>
          ))}
        </div>
      </div>

      <HeatmapSection q={heatmapQ} />
      <TrendsSection q={trendsQ} heatmap={heatmapQ.data} />
    </div>
  );
}

function HeatmapSection({ q }: { q: { data?: HeatmapResponse; isLoading: boolean } }) {
  const t = useTranslations("Analytics");
  const currency = currencyForCountry(useAdminCountry());
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
        <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>{t("heatmap.title")}</p>
        {q.data?.peak_day && (
          <p style={{ fontSize:12, color:"var(--text2)", margin:0 }}>
            {t("heatmap.peakLabel")} <span style={{ color:"var(--gold)" }}>{dayLabel(t, q.data.peak_day, true)}</span>{" "}
            {q.data.peak_hour != null && hh(q.data.peak_hour)}
            {q.data.slowest_day && (
              <> · {t("heatmap.quietLabel")} <span style={{ color:"var(--text)" }}>{dayLabel(t, q.data.slowest_day, true)}</span>{" "}
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
          <p style={{ fontSize:13, color:"var(--text2)" }}>{t("heatmap.empty")}</p>
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
                  <td style={{ fontSize:11, color:"var(--text2)", paddingRight:6, textAlign:"right" }}>{dayLabel(t, d, false)}</td>
                  {HOURS.map((h) => {
                    const c = map.get(`${d}-${h}`);
                    const app = c?.appointments ?? 0;
                    return (
                      <td key={h}>
                        <div
                          title={t("heatmap.cellTooltip", { day: dayLabel(t, d, false), hour: hh(h), count: app, revenue: fmt(c?.revenue ?? 0, currency) })}
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

function TrendsSection({ q, heatmap }: { q: { data?: TrendsResponse; isLoading: boolean }; heatmap?: HeatmapResponse }) {
  const t = useTranslations("Analytics");
  const currency = currencyForCountry(useAdminCountry());
  const data = q.data;
  const dowData = (data?.revenue_by_day_of_week ?? []).map((d) => ({ ...d, day_label: dayLabel(t, d.day, false) }));
  const growth = data?.growth_vs_prev_period ?? 0;
  const up = growth >= 0;

  const chartTooltip = {
    contentStyle: { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, color:"var(--text)", fontSize:12 },
  };

  return (
    <>
      {/* KPI cards — 4 in a row matching design */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
        <div style={cardStyle}>
          <p style={{ color:"var(--text2)", fontSize:12, margin:"0 0 12px" }}>{t("kpi.avgCheck")}</p>
          <p style={{ fontFamily:"'Playfair Display',serif", color:"var(--text)", fontSize:26, fontWeight:600, margin:0 }}>{data ? fmt(data.avg_check, currency) : "—"}</p>
          <p style={{ fontSize:12, color: up ? "var(--green)" : "var(--text3)", fontWeight:600, margin:"8px 0 0" }}>
            {data ? `${up ? "+" : ""}${growth}%` : ""} <span style={{ color:"var(--text3)", fontWeight:400 }}>{t("kpi.avgCheckCaption")}</span>
          </p>
        </div>
        <div style={cardStyle}>
          <p style={{ color:"var(--text2)", fontSize:12, margin:"0 0 12px" }}>{t("kpi.revenueGrowth")}</p>
          <p style={{ fontFamily:"'Playfair Display',serif", color: up ? "var(--gold)" : "var(--red)", fontSize:26, fontWeight:600, margin:0, display:"flex", alignItems:"center", gap:8 }}>
            {up ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {data ? `${up ? "+" : ""}${growth}%` : "—"}
          </p>
          <p style={{ fontSize:12, color:"var(--text3)", margin:"8px 0 0" }}>{t("kpi.revenueGrowthCaption")}</p>
        </div>
        <div style={cardStyle}>
          <p style={{ color:"var(--text2)", fontSize:12, margin:"0 0 12px" }}>{t("kpi.peak")}</p>
          <p style={{ fontFamily:"'Playfair Display',serif", color:"var(--text)", fontSize:20, fontWeight:600, margin:0 }}>
            {heatmap?.peak_day ? `${dayLabel(t, heatmap.peak_day, false)} ${heatmap.peak_hour != null ? hh(heatmap.peak_hour) : ""}` : "—"}
          </p>
          <p style={{ fontSize:12, color:"var(--text3)", margin:"8px 0 0" }}>{t("kpi.peakCaption")}</p>
        </div>
        <div style={cardStyle}>
          <p style={{ color:"var(--text2)", fontSize:12, margin:"0 0 12px" }}>{t("kpi.quiet")}</p>
          <p style={{ fontFamily:"'Playfair Display',serif", color:"var(--text)", fontSize:20, fontWeight:600, margin:0 }}>
            {heatmap?.slowest_day ? `${dayLabel(t, heatmap.slowest_day, false)} ${heatmap.slowest_hour != null ? hh(heatmap.slowest_hour) : ""}` : "—"}
          </p>
          <p style={{ fontSize:12, color:"var(--text3)", margin:"8px 0 0" }}>{t("kpi.quietCaption")}</p>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:20, marginBottom:20 }}>
        {/* Line chart */}
        <div style={cardStyle}>
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 18px" }}>{t("charts.revenueByWeekTitle")}</p>
          {q.isLoading ? (
            <div style={{ height:240, background:"var(--bg2)", borderRadius:"var(--radius)", animation:"pulse 1.5s infinite" }} />
          ) : (data?.revenue_by_week.length ?? 0) > 0 ? (
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.revenue_by_week} margin={{ top:5, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" minTickGap={20} />
                  <YAxis tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" width={40} />
                  <Tooltip {...chartTooltip} formatter={(v) => [fmt(Number(v), currency), t("charts.revenueLabel")] as [string, string]} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} dot={false} activeDot={{ r:4, fill:"var(--gold)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart />}
        </div>

        {/* Bar chart */}
        <div style={cardStyle}>
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 18px" }}>{t("charts.revenueByDowTitle")}</p>
          {q.isLoading ? (
            <div style={{ height:240, background:"var(--bg2)", borderRadius:"var(--radius)", animation:"pulse 1.5s infinite" }} />
          ) : dowData.length > 0 ? (
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dowData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day_label" tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" />
                  <YAxis tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" width={40} />
                  <Tooltip {...chartTooltip} cursor={{ fill:"rgba(255,255,255,0.04)" }} formatter={(v) => [fmt(Number(v), currency), t("charts.avgRevenueLabel")] as [string, string]} />
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
  const t = useTranslations("Analytics");
  return (
    <div style={{ height:240, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text3)" }}>
      <TrendingUp size={28} style={{ marginBottom:8 }} />
      <p style={{ fontSize:13, color:"var(--text2)" }}>{t("charts.empty")}</p>
    </div>
  );
}

