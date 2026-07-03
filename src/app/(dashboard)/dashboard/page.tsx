"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Receipt, Gauge, CreditCard } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

// ── Types ────────────────────────────────────────────────────────────────────

interface WeekDay {
  date: string;
  revenue: number;
  label: string;
}

interface TopBarber {
  id: string;
  name: string;
  appointments: number;
  revenue: number;
}

interface UpcomingAppointment {
  id: string;
  time: string;
  client_name: string;
  service_name: string;
  barber_name: string;
  status: string;
}

interface OverviewData {
  today_revenue: number;
  today_revenue_delta_pct: number | null;
  today_appointments: number;
  today_appointments_delta_pct: number | null;
  today_load: number;
  today_load_delta_pct: number | null;
  avg_check: number;
  avg_check_delta_pct: number | null;
  week_revenue_by_day: WeekDay[];
  top_barbers: TopBarber[];
  upcoming_appointments: UpcomingAppointment[];
}

// ── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:    "#c2933a",
  scheduled:  "#7d97b8",
  confirmed:  "#5f9d6f",
  inprogress: "#c9a45c",
  completed:  "#8a8f86",
  cancelled:  "#b56a54",
  noshow:     "#8a6a6a",
};

const STATUS_LABEL: Record<string, string> = {
  pending:    "Ожидает",
  scheduled:  "Запланирована",
  confirmed:  "Подтверждена",
  inprogress: "В процессе",
  completed:  "Завершена",
  cancelled:  "Отменена",
  noshow:     "Не явился",
};

// ── Stub data ────────────────────────────────────────────────────────────────

const STUB: OverviewData = {
  today_revenue: 1_850_000,
  today_revenue_delta_pct: 12,
  today_appointments: 14,
  today_appointments_delta_pct: 5,
  today_load: 78,
  today_load_delta_pct: -3,
  avg_check: 132_142,
  avg_check_delta_pct: 8,
  week_revenue_by_day: [
    { date: "2026-06-27", revenue: 980_000,   label: "Пт" },
    { date: "2026-06-28", revenue: 1_120_000,  label: "Сб" },
    { date: "2026-06-29", revenue: 560_000,   label: "Вс" },
    { date: "2026-06-30", revenue: 1_430_000,  label: "Пн" },
    { date: "2026-07-01", revenue: 1_650_000,  label: "Вт" },
    { date: "2026-07-02", revenue: 1_200_000,  label: "Ср" },
    { date: "2026-07-03", revenue: 1_850_000,  label: "Чт" },
  ],
  top_barbers: [
    { id: "1", name: "Алишер Камолов",  appointments: 12, revenue: 1_584_000 },
    { id: "2", name: "Дониёр Рашидов",  appointments: 9,  revenue: 1_188_000 },
    { id: "3", name: "Бобур Юсупов",    appointments: 7,  revenue: 924_000 },
  ],
  upcoming_appointments: [
    { id: "a1", time: "14:30", client_name: "Камол Назаров",  service_name: "Стрижка + борода", barber_name: "Алишер К.", status: "confirmed" },
    { id: "a2", time: "15:00", client_name: "Тимур Эргашев",  service_name: "Классическая стрижка", barber_name: "Дониёр Р.", status: "pending" },
    { id: "a3", time: "15:30", client_name: "Санжар Холиков", service_name: "Стрижка",         barber_name: "Бобур Ю.", status: "scheduled" },
    { id: "a4", time: "16:00", client_name: "Акбар Миrzаев",  service_name: "Борода",           barber_name: "Алишер К.", status: "confirmed" },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtRevenue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("ru", { maximumFractionDigits: 1 }) + " млн";
  if (n >= 1_000)     return (n / 1_000).toLocaleString("ru", { maximumFractionDigits: 0 }) + " тыс";
  return n.toLocaleString("ru");
}

function fmtFull(n: number): string {
  return n.toLocaleString("ru") + " сум";
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function deltaColor(pct: number | null): string {
  if (pct === null) return "var(--text3)";
  return pct >= 0 ? "var(--green)" : "var(--red)";
}

function deltaText(pct: number | null): string {
  if (pct === null) return "";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w, h, br = 8 }: { w?: string | number; h: number; br?: number }) {
  return (
    <div style={{
      width: w ?? "100%", height: h, borderRadius: br,
      background: "var(--surface)",
      animation: "skPulse 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { salon } = useSalon();
  const router = useRouter();

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["dashboard", "overview", salon.id],
    queryFn: () =>
      api.get(`/salons/${salon.id}/analytics/overview`).then((r) => r.data),
    // On error fall back to stub — treated as "no data" and we show stub below
    retry: false,
  });

  // Use real data if available, otherwise stub
  const d: OverviewData = data ?? STUB;
  const showSkeleton = isLoading;

  const maxRevenue = Math.max(...d.week_revenue_by_day.map((b) => b.revenue), 1);
  const weekTotal  = d.week_revenue_by_day.reduce((s, b) => s + b.revenue, 0);

  const kpis = [
    {
      label: "Выручка сегодня",
      value: showSkeleton ? "" : fmtRevenue(d.today_revenue) + " сум",
      delta: d.today_revenue_delta_pct,
      sub:   "к вчерашнему дню",
      icon:  <TrendingUp size={16} style={{ color: "var(--gold)" }} />,
    },
    {
      label: "Записей сегодня",
      value: showSkeleton ? "" : String(d.today_appointments),
      delta: d.today_appointments_delta_pct,
      sub:   "к вчерашнему дню",
      icon:  <Receipt size={16} style={{ color: "var(--gold)" }} />,
    },
    {
      label: "Загрузка",
      value: showSkeleton ? "" : `${d.today_load}%`,
      delta: d.today_load_delta_pct,
      sub:   "к вчерашнему дню",
      icon:  <Gauge size={16} style={{ color: "var(--gold)" }} />,
    },
    {
      label: "Средний чек",
      value: showSkeleton ? "" : fmtRevenue(d.avg_check) + " сум",
      delta: d.avg_check_delta_pct,
      sub:   "к вчерашнему дню",
      icon:  <CreditCard size={16} style={{ color: "var(--gold)" }} />,
    },
  ];

  return (
    <div style={{ padding: "32px 36px" }}>

      {/* Pulse animation */}
      <style>{`
        @keyframes skPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .apt-row:hover { background: rgba(255,255,255,0.035) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 24, fontWeight: 600,
          color: "var(--text)", margin: 0,
        }}>
          Дашборд
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4, margin: "4px 0 0" }}>
          {salon.name} — сводная статистика
        </p>
      </div>

      {/* KPI row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 16,
      }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
          }}>
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 14,
            }}>
              <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>
                {k.label}
              </span>
              {k.icon}
            </div>

            {showSkeleton ? (
              <>
                <Skeleton h={28} w="70%" br={6} />
                <div style={{ marginTop: 9 }}>
                  <Skeleton h={12} w="55%" br={4} />
                </div>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 26, fontWeight: 600,
                  lineHeight: 1, letterSpacing: "-0.01em",
                  color: "var(--text)",
                }}>
                  {k.value}
                </div>
                <div style={{ marginTop: 9, fontSize: 12, fontWeight: 600, color: deltaColor(k.delta) }}>
                  {deltaText(k.delta)}{" "}
                  <span style={{ color: "var(--text3)", fontWeight: 400 }}>{k.sub}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Middle row: bar chart + top barbers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.55fr 1fr",
        gap: 16,
        marginBottom: 16,
      }}>

        {/* Week revenue bar chart */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 22,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline",
            justifyContent: "space-between", marginBottom: 18,
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 17, fontWeight: 600, color: "var(--text)",
            }}>
              Выручка за неделю
            </div>
            {!showSkeleton && (
              <div style={{ fontSize: 12, color: "var(--text2)" }}>
                Итого{" "}
                <span style={{ color: "var(--gold)", fontWeight: 700 }}>
                  {fmtRevenue(weekTotal)} сум
                </span>
              </div>
            )}
          </div>

          {showSkeleton ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 170 }}>
              {[60, 80, 45, 95, 70, 55, 90].map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9, height: "100%", justifyContent: "flex-end" }}>
                  <Skeleton h={h} br={7} />
                  <Skeleton h={11} w={20} br={3} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 170, paddingTop: 8 }}>
              {d.week_revenue_by_day.map((bar) => {
                const isMax = bar.revenue === maxRevenue;
                const ratio = bar.revenue / maxRevenue;
                const barH  = Math.max(Math.round(ratio * 150), 28);
                return (
                  <div key={bar.date} style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 9,
                    height: "100%", justifyContent: "flex-end",
                  }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>
                      {fmtRevenue(bar.revenue)}
                    </div>
                    <div style={{
                      width: "100%", maxWidth: 34, height: barH,
                      background: isMax ? "var(--gold)" : "var(--gold-dim2)",
                      borderRadius: "7px 7px 3px 3px",
                      transition: "height .5s ease",
                    }} />
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>
                      {bar.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top barbers */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 22,
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 17, fontWeight: 600,
            color: "var(--text)", marginBottom: 16,
          }}>
            Лучшие мастера
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {showSkeleton ? (
              [1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Skeleton w={36} h={36} br={10} />
                  <div style={{ flex: 1 }}>
                    <Skeleton h={14} w="65%" br={4} />
                    <div style={{ marginTop: 5 }}>
                      <Skeleton h={11} w="40%" br={3} />
                    </div>
                  </div>
                  <Skeleton w={60} h={14} br={4} />
                </div>
              ))
            ) : (
              d.top_barbers.slice(0, 3).map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    width: 36, height: 36, flex: "none",
                    borderRadius: 10,
                    background: "var(--gold-dim)",
                    border: "1px solid rgba(201,164,92,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13,
                    fontFamily: "var(--sans, sans-serif)",
                    color: "var(--gold)",
                  }}>
                    {initials(b.name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13.5,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      color: "var(--text)",
                    }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text3)" }}>
                      {b.appointments} записей
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600, fontSize: 14,
                    color: "var(--gold)",
                    whiteSpace: "nowrap",
                  }}>
                    {fmtRevenue(b.revenue)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upcoming appointments */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 22,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline",
          justifyContent: "space-between", marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 17, fontWeight: 600, color: "var(--text)",
          }}>
            Ближайшие записи
          </div>
          <span
            onClick={() => router.push("/appointments")}
            style={{
              fontSize: 12.5, color: "var(--gold)",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            Все записи →
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {showSkeleton ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 10px" }}>
                <Skeleton w={52} h={15} br={4} />
                <Skeleton w={8} h={8} br={50} />
                <div style={{ flex: 1 }}>
                  <Skeleton h={14} w="45%" br={4} />
                  <div style={{ marginTop: 5 }}>
                    <Skeleton h={11} w="60%" br={3} />
                  </div>
                </div>
                <Skeleton w={80} h={24} br={20} />
              </div>
            ))
          ) : (
            d.upcoming_appointments.slice(0, 4).map((apt) => {
              const color = STATUS_COLOR[apt.status] ?? "var(--text3)";
              const label = STATUS_LABEL[apt.status] ?? apt.status;
              return (
                <div
                  key={apt.id}
                  className="apt-row"
                  style={{
                    display: "flex", alignItems: "center",
                    gap: 16, padding: "12px 10px",
                    borderRadius: 11, transition: "background .15s",
                  }}
                >
                  {/* Time */}
                  <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600, fontSize: 15,
                    width: 52, flex: "none",
                    color: "var(--text)",
                  }}>
                    {apt.time}
                  </div>

                  {/* Status dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    flex: "none", background: color,
                  }} />

                  {/* Client + service */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>
                      {apt.client_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>
                      {apt.service_name} · {apt.barber_name}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 11.5, color: color, fontWeight: 600,
                    padding: "4px 10px",
                    background: "var(--surface)",
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}>
                    {label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
