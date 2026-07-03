"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

type Period = "month" | "quarter" | "year";

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

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " млн";
  return n.toLocaleString("ru") + " сум";
}

const PERIODS: { key: Period; label: string }[] = [
  { key:"month",   label:"Месяц"   },
  { key:"quarter", label:"Квартал" },
  { key:"year",    label:"Год"     },
];

const card: React.CSSProperties = {
  background:"var(--card)", border:"1px solid var(--border)", borderRadius:16, padding:20,
};

export default function FinancePage() {
  const { salon } = useSalon();
  const [period, setPeriod] = useState<Period>("month");

  const { data: stats, isLoading } = useQuery<WeeklyStats>({
    queryKey: ["finance", "stats", salon.id, period],
    queryFn: () => api.get("/masters/me/weekly-stats", { params: { period } }).then((r) => r.data),
  });

  const maxCount = useMemo(
    () => Math.max(...(stats?.appointments_by_day?.map((d) => d.count) ?? [1]), 1),
    [stats],
  );

  const maxRevSvc = useMemo(
    () => Math.max(...(stats?.top_services?.map((s) => s.revenue) ?? [1]), 1),
    [stats],
  );

  const revDelta = stats?.compared_to_previous_week.revenue_delta_pct ?? null;

  return (
    <div style={{ padding:"32px 36px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
            Финансы
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Выручка и показатели</p>
        </div>
        <div style={{ display:"flex", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:4, gap:4 }}>
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding:"6px 14px", borderRadius:9, border:"none", cursor:"pointer",
              background: period === p.key ? "var(--gold)" : "transparent",
              color: period === p.key ? "#0a0a0b" : "var(--text2)",
              fontSize:12, fontWeight:600, transition:"background 0.15s, color 0.15s",
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:16 }}>
          {[1,2,3,4].map((i) => <div key={i} style={{ ...card, height:100, animation:"pulse 1.5s infinite" }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : stats ? (
        <>
          {/* 4 KPI cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:16 }}>
            {/* Revenue — gold gradient */}
            <div style={{
              background:"linear-gradient(150deg,rgba(201,164,92,0.12),transparent 60%),var(--card)",
              border:"1px solid rgba(201,164,92,0.20)", borderRadius:16, padding:20,
            }}>
              <div style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>Общая выручка</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600, color:"var(--gold)" }}>
                {fmt(stats.revenue_total_uzs)}
              </div>
              <div style={{ fontSize:12, color: revDelta != null && revDelta >= 0 ? "var(--green)" : "var(--red)", fontWeight:600, marginTop:8 }}>
                {revDelta != null ? `${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(0)}%` : "—"}{" "}
                <span style={{ color:"var(--text3)", fontWeight:400 }}>к прошлому</span>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>Записей</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600 }}>
                {stats.appointments_total}
              </div>
              <div style={{ fontSize:12, color:"var(--text3)", marginTop:8 }}>
                {stats.appointments_completed} завершено
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>Новые клиенты</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600 }}>
                {stats.new_clients}
              </div>
              <div style={{ fontSize:12, color:"var(--text3)", marginTop:8 }}>впервые за период</div>
            </div>

            <div style={card}>
              <div style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>Постоянные</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600 }}>
                {stats.returning_clients}
              </div>
              <div style={{ fontSize:12, color:"var(--text3)", marginTop:8 }}>вернулись</div>
            </div>
          </div>

          {/* Chart + Top services side by side */}
          <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:16 }}>
            {/* Bar chart */}
            <div style={{ ...card, padding:22 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, marginBottom:18 }}>
                Записи по дням
              </div>
              {stats.appointments_by_day.length > 0 ? (
                <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:170 }}>
                  {stats.appointments_by_day.map((d) => {
                    const pct = d.count / maxCount;
                    const isMax = d.count === maxCount;
                    return (
                      <div key={d.date} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%", justifyContent:"flex-end" }}>
                        <div style={{
                          width:"100%", borderRadius:"4px 4px 1px 1px",
                          background: isMax ? "var(--gold)" : "rgba(201,164,92,0.35)",
                          height: `${Math.max(pct * 136, d.count > 0 ? 8 : 2)}px`,
                        }} />
                        <div style={{ fontSize:9.5, color:"var(--text3)" }}>
                          {new Date(d.date).toLocaleDateString("ru", { weekday:"short" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ height:170, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text3)", fontSize:13 }}>
                  Нет данных
                </div>
              )}
            </div>

            {/* Top services */}
            <div style={{ ...card, padding:22 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, marginBottom:16 }}>
                Топ услуг
              </div>
              {stats.top_services.length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {stats.top_services.slice(0, 5).map((s) => (
                    <div key={s.service_name}>
                      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{s.service_name}</span>
                        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:12.5, color:"var(--gold)", fontWeight:600 }}>
                          {fmt(s.revenue)}
                        </span>
                      </div>
                      <div style={{ height:6, background:"var(--surface)", borderRadius:6, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${(s.revenue / maxRevSvc) * 100}%`, background:"var(--gold)", borderRadius:6 }} />
                      </div>
                      <div style={{ fontSize:11, color:"var(--text3)", marginTop:5 }}>{s.count} записей</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:170, color:"var(--text3)", fontSize:13 }}>
                  Нет данных
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0" }}>
          <TrendingUp size={32} style={{ color:"var(--text3)", marginBottom:12 }} />
          <p style={{ color:"var(--text2)", fontSize:14 }}>Нет данных за период</p>
        </div>
      )}
    </div>
  );
}
