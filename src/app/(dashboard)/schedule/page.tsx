"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Clock, Save, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";

// ─── helpers ───────────────────────────────────────────────────────────────

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];
const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

function fmtDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseISO(s: string) { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function addDays(d: Date, n: number) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function fmtMoney(v: number, suffix: string) { return (v/1_000_000).toFixed(1).replace(".",",")+" "+suffix; }

// ─── page entry ─────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { role } = useSalon();
  if (isManager(role)) return <TeamScheduleGrid />;
  return <WorkdaysEditor />;
}

// ─── types ──────────────────────────────────────────────────────────────────

interface DayStats { booked: number; free: number; blocked: number; revenue: number; }
interface DaySchedule { working_hours: { start: string; end: string } | null; slots: unknown[]; stats: DayStats; }
interface BarberWeek { master_id: string; name: string; avatar_url: string | null; days: Record<string, DaySchedule>; }
interface WeekSchedule { week_start: string; barbers: BarberWeek[]; }

// ─── owner: summary grid ────────────────────────────────────────────────────

function TeamScheduleGrid() {
  const t = useTranslations("Schedule");
  const { salon } = useSalon();
  const [anchor, setAnchor] = useState(() => fmtDateISO(new Date()));
  const [barberFilter, setBarberFilter] = useState("all");

  const { data, isLoading } = useQuery<WeekSchedule>({
    queryKey: ["salon-schedule", salon.id, anchor],
    queryFn: () => api.get(`/salons/${salon.id}/schedule/week`, { params: { date: anchor } }).then(r => r.data),
  });

  const weekStart = data ? parseISO(data.week_start) : parseISO(anchor);
  const weekDates = DAY_KEYS.map((_, i) => addDays(weekStart, i));

  const barbers = useMemo(() => {
    if (!data) return [];
    if (barberFilter === "all") return data.barbers;
    return data.barbers.filter(b => b.master_id === barberFilter);
  }, [data, barberFilter]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${weekStart.getDate()} ${t(`months.${MONTH_KEYS[weekStart.getMonth()]}`)} – ${end.getDate()} ${t(`months.${MONTH_KEYS[end.getMonth()]}`)}`;
  }, [weekStart, t]);

  // weekly aggregates for KPI cards
  const weeklyStats = useMemo(() => {
    let totalBooked = 0, totalRevenue = 0, totalSlots = 0;
    for (const b of barbers) {
      for (const day of Object.values(b.days)) {
        totalBooked += day.stats.booked;
        totalRevenue += day.stats.revenue;
        totalSlots += day.stats.booked + day.stats.free;
      }
    }
    const avgLoad = totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 100) : 0;
    return { totalBooked, totalRevenue, avgLoad };
  }, [barbers]);

  const card: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
  };

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: "var(--text)", margin: 0 }}>
          {t("team.title")}
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          {t("team.subtitle")}
        </p>
      </div>

      {/* Week nav + barber filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setAnchor(fmtDateISO(addDays(weekStart, -7)))}
            style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600, minWidth: 148, textAlign: "center" }}>{weekLabel}</span>
          <button
            onClick={() => setAnchor(fmtDateISO(addDays(weekStart, 7)))}
            style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)" }}
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setAnchor(fmtDateISO(new Date()))}
            style={{ fontSize: 12, color: "var(--gold)", background: "none", border: "none", cursor: "pointer", marginLeft: 4 }}
          >
            {t("team.today")}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <FilterChip active={barberFilter === "all"} onClick={() => setBarberFilter("all")}>{t("team.filterAll")}</FilterChip>
          {data?.barbers.map(b => (
            <FilterChip key={b.master_id} active={barberFilter === b.master_id} onClick={() => setBarberFilter(b.master_id)}>
              {b.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ ...card, height: 280, animation: "pulse 1.5s infinite" }}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : barbers.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 14 }}>
          {t("team.emptyMasters")}
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "180px repeat(7,1fr)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "14px 18px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text3)", fontWeight: 600 }}>
              {t("team.masterColumn")}
            </div>
            {DAY_KEYS.map((key, i) => {
              const d = weekDates[i];
              return (
                <div key={key} style={{ padding: "14px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text2)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                  {t(`daysShort.${key}`)} <span style={{ color: "var(--text3)", fontWeight: 400 }}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Body rows */}
          {barbers.map((b) => (
            <div key={b.master_id} style={{ display: "grid", gridTemplateColumns: "180px repeat(7,1fr)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={b.name} url={b.avatar_url} />
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>
                  {b.name}
                </span>
              </div>
              {DAY_KEYS.map((key) => {
                const day = b.days[key];
                const isWorking = !!day?.working_hours;
                const count = day?.stats.booked ?? 0;
                let cellBg = "transparent";
                let cellBorder = "1px dashed var(--text3)";
                let cellColor = "var(--text3)";
                let cellLabel = "—";
                if (isWorking) {
                  if (count > 0) {
                    cellBg = "var(--gold-dim)";
                    cellBorder = "1px solid rgba(201,164,92,0.32)";
                    cellColor = "var(--gold)";
                    cellLabel = t("team.cellBooked", { count });
                  } else {
                    cellBg = "transparent";
                    cellBorder = "1px solid var(--border)";
                    cellColor = "var(--text3)";
                    cellLabel = "—";
                  }
                }
                return (
                  <div key={key} style={{ borderLeft: "1px solid rgba(255,255,255,0.05)", padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: "100%", height: 42, borderRadius: 8, background: cellBg, border: cellBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: cellColor }}>
                      {cellLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 16 }}>
        <KpiCard label={t("team.kpiBookings")} value={String(weeklyStats.totalBooked)} />
        <KpiCard label={t("team.kpiRevenue")} value={weeklyStats.totalRevenue > 0 ? fmtMoney(weeklyStats.totalRevenue, t("team.million")) : "—"} gold />
        <KpiCard label={t("team.kpiAvgLoad")} value={`${weeklyStats.avgLoad}%`} />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12, color: "var(--text2)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--gold-dim)", border: "1px solid rgba(201,164,92,0.32)", display: "inline-block" }} />
          {t("team.legendBooked")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "transparent", border: "1px solid var(--border)", display: "inline-block" }} />
          {t("team.legendFree")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "transparent", border: "1px dashed var(--text3)", display: "inline-block" }} />
          {t("team.legendDayOff")}
        </span>
      </div>
    </div>
  );
}

// ─── small components ───────────────────────────────────────────────────────

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: "var(--gold-dim)", border: "1px solid rgba(201,164,92,0.32)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--gold)", overflow: "hidden" }}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : (initials || "?")}
    </span>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "5px 12px", borderRadius: "var(--radius)", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: active ? "var(--gold)" : "var(--card)", color: active ? "#0a0a0b" : "var(--text2)", transition: "background 0.15s, color 0.15s" }}
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 15, padding: 20 }}>
      <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: gold ? "var(--gold)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

// ─── barber: working-hours editor ───────────────────────────────────────────

interface Workday {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_working: boolean;
}

const DEFAULT_DAYS: Workday[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i, start_time: "09:00", end_time: "18:00",
  break_start: "13:00", break_end: "14:00", is_working: i < 6,
}));

function WorkdaysEditor() {
  const t = useTranslations("Schedule");
  const tCommon = useTranslations("Common");
  const qc = useQueryClient();
  const [days, setDays] = useState<Workday[]>(DEFAULT_DAYS);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<Workday[]>({
    queryKey: ["schedule", "workdays"],
    queryFn: () => api.get("/schedule/workdays").then(r => r.data),
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    setDays(DEFAULT_DAYS.map(def => data.find(d => d.day_of_week === def.day_of_week) ?? def));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put("/schedule/workdays", { workdays: days }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  function update(idx: number, patch: Partial<Workday>) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }

  const timeInput: React.CSSProperties = {
    background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 13, outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {t("editor.title")}
          </h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            {t("editor.subtitle")}
          </p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--gold)", color: "#0a0a0b", border: "none", borderRadius: "var(--radius)", padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saveMutation.isPending ? 0.5 : 1 }}
        >
          <Save size={14} />
          {saved ? t("editor.saved") : saveMutation.isPending ? t("editor.saving") : tCommon("save")}
        </button>
      </div>

      <div style={{ maxWidth: 640, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, height: 58, animation: "pulse 1.5s infinite" }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {days.map((day, idx) => (
              <div key={day.day_of_week} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <span style={{ width: 44, fontWeight: 600, fontSize: 13, color: "var(--text)", flexShrink: 0 }}>
                  {t(`daysShort.${DAY_KEYS[day.day_of_week]}`)}
                </span>

                {/* Toggle */}
                <button
                  onClick={() => update(idx, { is_working: !day.is_working })}
                  style={{ width: 44, height: 26, flexShrink: 0, border: "none", borderRadius: 20, cursor: "pointer", background: day.is_working ? "var(--gold)" : "var(--border)", position: "relative", transition: "background 0.2s" }}
                >
                  <span style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.2s", left: day.is_working ? 21 : 3 }} />
                </button>

                {day.is_working ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={13} style={{ color: "var(--text3)", flexShrink: 0 }} />
                      <input type="time" value={day.start_time} onChange={e => update(idx, { start_time: e.target.value })} style={timeInput} />
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                      <input type="time" value={day.end_time} onChange={e => update(idx, { end_time: e.target.value })} style={timeInput} />
                    </div>
                    <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 4 }}>{t("editor.break")}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <input type="time" value={day.break_start ?? ""} onChange={e => update(idx, { break_start: e.target.value || null })} style={timeInput} />
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                      <input type="time" value={day.break_end ?? ""} onChange={e => update(idx, { break_end: e.target.value || null })} style={timeInput} />
                    </div>
                  </div>
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text3)" }}>{t("editor.dayOff")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
