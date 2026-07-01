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

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const sign = pct >= 0 ? "+" : "";
  return (
    <span style={{ fontSize:12, color: pct >= 0 ? "var(--green)" : "var(--red)", fontWeight:500 }}>
      {sign}{pct.toFixed(0)}% к прошлой неделе
    </span>
  );
}

const cardStyle: React.CSSProperties = {
  background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)",
};

const periods: { key: Period; label: string }[] = [
  { key:"week", label:"Неделя" },
  { key:"month", label:"Месяц" },
  { key:"year", label:"Год" },
];

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>("week");

  const { data: stats, isLoading: statsLoading } = useQuery<WeeklyStats>({
    queryKey: ["finance", "weekly-stats", period],
    queryFn: () => api.get("/masters/me/weekly-stats").then((r) => r.data),
  });

  const { data: team } = useQuery<{ items: TeamMember[]; total: number }>({
    queryKey: ["team", "members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const maxCount = Math.max(...(stats?.appointments_by_day?.map((d) => d.count) ?? [1]), 1);

  return (
    <div style={{ padding:"32px 36px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
            Финансы
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Аналитика и доходы</p>
        </div>
        <div style={{
          display:"flex", background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", padding:4, gap:4,
        }}>
          {periods.map((p) => (
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

      {statsLoading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{ ...cardStyle, padding:24, height:100, animation:"pulse 1.5s infinite" }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : stats ? (
        <>
          {/* KPI */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
            <KpiCard
              label="Выручка"
              value={fmt(stats.revenue_total_uzs)}
              sub={<Delta pct={stats.compared_to_previous_week.revenue_delta_pct} />}
            />
            <KpiCard
              label="Завершено записей"
              value={String(stats.appointments_completed)}
              sub={<Delta pct={stats.compared_to_previous_week.appointments_delta_pct} />}
            />
            <KpiCard
              label="Средний чек"
              value={stats.appointments_completed > 0
                ? fmt(Math.round(stats.revenue_total_uzs / stats.appointments_completed))
                : "—"}
              sub={<span style={{ fontSize:12, color:"var(--text2)" }}>{stats.new_clients} новых клиентов</span>}
            />
          </div>

          {/* Bar chart */}
          <div style={{ ...cardStyle, padding:24, marginBottom:20 }}>
            <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 18px" }}>Записи по дням</p>
            <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120 }}>
              {stats.appointments_by_day.map((d) => (
                <div key={d.date} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:10, color:"var(--text3)" }}>{d.count || ""}</span>
                  <div style={{
                    width:"100%", borderRadius:"6px 6px 0 0",
                    background:"var(--gold)", opacity:0.85,
                    height: `${Math.max((d.count / maxCount) * 88, d.count > 0 ? 8 : 2)}px`,
                    transition:"height 0.3s",
                  }} />
                  <span style={{ fontSize:10, color:"var(--text3)" }}>
                    {new Date(d.date).toLocaleDateString("ru", { weekday:"short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top services */}
          {stats.top_services.length > 0 && (
            <div style={{ ...cardStyle, padding:24, marginBottom:20 }}>
              <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 14px" }}>Топ услуги</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {stats.top_services.map((s) => (
                  <div key={s.service_name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color:"var(--text2)", fontSize:13 }}>{s.service_name}</span>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ color:"var(--gold)", fontSize:13, fontWeight:700 }}>{fmt(s.revenue)}</span>
                      <span style={{ color:"var(--text3)", fontSize:12, marginLeft:8 }}>× {s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0" }}>
          <TrendingUp size={32} style={{ color:"var(--text3)", marginBottom:12 }} />
          <p style={{ color:"var(--text2)", fontSize:14 }}>Нет данных</p>
        </div>
      )}

      {/* Team table */}
      {team && team.items.length > 0 && (
        <div style={{ ...cardStyle, padding:24 }}>
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 14px" }}>Барберы</p>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Имя","Телефон","Статус"].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 2 ? "right" : "left",
                    color:"var(--text3)", fontWeight:600, fontSize:11, padding:"0 0 10px",
                    textTransform:"uppercase", letterSpacing:"0.05em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.items.map((m, idx) => (
                <tr key={m.id} style={{ borderBottom: idx < team.items.length-1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding:"12px 0", color:"var(--text)", fontSize:13, fontWeight:500 }}>
                    {[m.name, m.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td style={{ padding:"12px 0", color:"var(--text2)", fontSize:13 }}>{m.phone}</td>
                  <td style={{ padding:"12px 0", textAlign:"right" }}>
                    <span style={{
                      fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20,
                      background: m.is_active ? "rgba(76,175,125,0.12)" : "rgba(90,90,82,0.12)",
                      color: m.is_active ? "var(--green)" : "var(--text3)",
                    }}>
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
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24 }}>
      <p style={{ color:"var(--text2)", fontSize:11, margin:"0 0 6px", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</p>
      <p style={{ color:"var(--text)", fontSize:22, fontWeight:700, margin:"0 0 5px" }}>{value}</p>
      {sub}
    </div>
  );
}
