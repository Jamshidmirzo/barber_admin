"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Save,
  ChevronLeft,
  ChevronRight,
  Wand2,
  X,
  Ban,
  CalendarPlus,
  Unlock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import api, { parseApiError } from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";

// ───────────────────────── shared helpers ──────────────────────────────────

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];
const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function fmtDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function todayKey(): DayKey {
  return DAY_KEYS[(new Date().getDay() + 6) % 7];
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU").format(v) + " сум";
}

// ───────────────────────── page entry (role branch) ────────────────────────

export default function SchedulePage() {
  const { role } = useSalon();
  if (isManager(role)) return <TeamScheduleGrid />;
  return <WorkdaysEditor />;
}

// ───────────────────────── manager: visual team grid ───────────────────────

type SlotStatus = "booked" | "free" | "blocked";

interface Slot {
  slot_id: string;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
  client_name?: string | null;
  service?: string | null;
  reason?: string | null;
}

interface DayStats {
  booked: number;
  free: number;
  blocked: number;
  revenue: number;
}

interface DaySchedule {
  working_hours: { start: string; end: string } | null;
  slots: Slot[];
  stats: DayStats;
}

interface BarberWeek {
  master_id: string;
  name: string;
  avatar_url: string | null;
  days: Record<string, DaySchedule>;
}

interface WeekSchedule {
  week_start: string;
  barbers: BarberWeek[];
}

interface SelectedSlot {
  masterId: string;
  masterName: string;
  dayKey: DayKey;
  date: string;
  slot: Slot;
}

// CSS var shorthands for schedule grid
const S = {
  card: { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" } as React.CSSProperties,
};

function TeamScheduleGrid() {
  const { salon } = useSalon();
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState<string>(() => fmtDateISO(new Date()));
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<DayKey>(() => todayKey());
  const [selected, setSelected] = useState<SelectedSlot | null>(null);

  const queryKey = ["salon-schedule", salon.id, anchor];
  const { data, isLoading, isError, error } = useQuery<WeekSchedule>({
    queryKey,
    queryFn: () =>
      api
        .get(`/salons/${salon.id}/schedule/week`, { params: { date: anchor } })
        .then((r) => r.data),
  });

  const weekStart = data ? parseISO(data.week_start) : parseISO(anchor);
  const weekDates = DAY_KEYS.map((_, i) => addDays(weekStart, i));

  const barbers = useMemo(() => {
    if (!data) return [];
    if (barberFilter === "all") return data.barbers;
    return data.barbers.filter((b) => b.master_id === barberFilter);
  }, [data, barberFilter]);

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const fillGapMutation = useMutation({
    mutationFn: () =>
      api.post(`/salons/${salon.id}/schedule/fill-gap`, {
        date: fmtDateISO(weekDates[DAY_KEYS.indexOf(selectedDay)]),
        master_id: barberFilter === "all" ? null : barberFilter,
      }),
    onSuccess: (res) => {
      invalidate();
      const filled = (res.data as { filled?: number })?.filled ?? 0;
      alert(filled > 0 ? `Заблокировано пустых окон: ${filled}` : "Подходящих пустых окон не найдено");
    },
    onError: (e) => alert(parseApiError(e, "Не удалось заполнить окна")),
  });

  // ── day stats for the selected day (aggregate over visible barbers) ──
  const dayAgg = useMemo(() => {
    let booked = 0,
      free = 0,
      blocked = 0,
      revenue = 0;
    for (const b of barbers) {
      const d = b.days[selectedDay];
      if (!d) continue;
      booked += d.stats.booked;
      free += d.stats.free;
      blocked += d.stats.blocked;
      revenue += d.stats.revenue;
    }
    const denom = booked + free;
    const load = denom > 0 ? Math.round((booked / denom) * 100) : 0;
    return { booked, free, blocked, revenue, load };
  }, [barbers, selectedDay]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${weekStart.getDate()} ${MONTHS_SHORT[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
  }, [weekStart]);

  return (
    <div style={{ padding:"28px 32px" }}>
      {/* Header */}
      <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
              Расписание команды
            </h1>
            <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Сетка занятости барберов на неделю</p>
          </div>
          <button
            onClick={() => fillGapMutation.mutate()}
            disabled={fillGapMutation.isPending || !data}
            style={{
              display:"flex", alignItems:"center", gap:8,
              background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", padding:"9px 16px",
              color:"var(--text2)", fontSize:13, fontWeight:500, cursor:"pointer",
              opacity:(fillGapMutation.isPending || !data) ? 0.5 : 1,
            }}
          >
            {fillGapMutation.isPending ? <Loader2 size={14} style={{ animation:"spin 0.8s linear infinite" }} /> : <Wand2 size={14} />}
            Заполнить пустые окна
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </button>
        </div>

        {/* Week nav + barber chips */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button
              onClick={() => setAnchor(fmtDateISO(addDays(weekStart, -7)))}
              aria-label="Предыдущая неделя"
              style={{ padding:8, borderRadius:"var(--radius)", background:"var(--surface)", border:"1px solid var(--border)", cursor:"pointer", color:"var(--text2)", display:"flex" }}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ color:"var(--text)", fontSize:13, fontWeight:500, minWidth:140, textAlign:"center" }}>{weekLabel}</span>
            <button
              onClick={() => setAnchor(fmtDateISO(addDays(weekStart, 7)))}
              aria-label="Следующая неделя"
              style={{ padding:8, borderRadius:"var(--radius)", background:"var(--surface)", border:"1px solid var(--border)", cursor:"pointer", color:"var(--text2)", display:"flex" }}
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => setAnchor(fmtDateISO(new Date()))}
              style={{ fontSize:12, color:"var(--gold)", background:"none", border:"none", cursor:"pointer", marginLeft:4 }}
            >
              Сегодня
            </button>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <Chip active={barberFilter === "all"} onClick={() => setBarberFilter("all")}>Все</Chip>
            {data?.barbers.map((b) => (
              <Chip key={b.master_id} active={barberFilter === b.master_id} onClick={() => setBarberFilter(b.master_id)}>
                {b.name}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Day stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <StatCard label={`Загрузка (${DAY_SHORT[DAY_KEYS.indexOf(selectedDay)]})`} value={`${dayAgg.load}%`} />
        <StatCard label="Выручка дня" value={fmtMoney(dayAgg.revenue)} />
        <StatCard label="Пустые окна" value={String(dayAgg.free)} />
        <StatCard label="Заблокировано" value={String(dayAgg.blocked)} />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ ...S.card, padding:24, height:320, animation:"pulse 1.5s infinite" }}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : isError ? (
        <div style={{ ...S.card, padding:24, color:"var(--red)", fontSize:13 }}>
          {parseApiError(error, "Не удалось загрузить расписание")}
        </div>
      ) : barbers.length === 0 ? (
        <div style={{ ...S.card, padding:40, textAlign:"center", color:"var(--text2)", fontSize:14 }}>
          В салоне пока нет барберов.
        </div>
      ) : (
        <div style={{ ...S.card, padding:12, overflowX:"auto" }}>
          <table style={{ borderSpacing:6, borderCollapse:"separate", width:"100%", minWidth:820 }}>
            <thead>
              <tr>
                <th style={{ width:128, position:"sticky", left:0, zIndex:10, background:"var(--surface)" }} />
                {DAY_KEYS.map((key, i) => {
                  const d = weekDates[i];
                  const isSel = key === selectedDay;
                  return (
                    <th key={key} style={{ padding:0 }}>
                      <button
                        onClick={() => setSelectedDay(key)}
                        style={{
                          width:"100%", borderRadius:"var(--radius)", padding:"6px 8px",
                          fontSize:11, fontWeight:600, border:"none", cursor:"pointer",
                          background: isSel ? "var(--gold-dim)" : "transparent",
                          color: isSel ? "var(--gold)" : "var(--text2)",
                          transition:"background 0.15s, color 0.15s",
                        }}
                      >
                        {DAY_SHORT[i]} {d.getDate()}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {barbers.map((b) => (
                <tr key={b.master_id}>
                  <td style={{ position:"sticky", left:0, zIndex:10, background:"var(--surface)", verticalAlign:"top" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, paddingRight:8, paddingTop:4 }}>
                      <Avatar name={b.name} url={b.avatar_url} />
                      <span style={{ color:"var(--text)", fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:88 }}>{b.name}</span>
                    </div>
                  </td>
                  {DAY_KEYS.map((key, i) => {
                    const day = b.days[key];
                    const dateISO = fmtDateISO(weekDates[i]);
                    return (
                      <td key={key} style={{ verticalAlign:"top" }}>
                        <DayCell
                          day={day}
                          highlight={key === selectedDay}
                          onSlot={(slot) =>
                            setSelected({ masterId: b.master_id, masterName: b.name, dayKey: key, date: dateISO, slot })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginTop:16 }}>
        <LegendDot color="rgba(76,175,125,0.8)" label="Занято" />
        <LegendDot color="var(--border)" label="Свободно" />
        <LegendDot color="rgba(224,90,90,0.7)" label="Заблокировано" />
      </div>

      {selected && (
        <SlotPanel
          salonId={salon.id}
          selected={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            invalidate();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── small presentational parts ──────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:"5px 12px", borderRadius:"var(--radius)", border:"none", cursor:"pointer",
        fontSize:11, fontWeight:600,
        background: active ? "var(--gold)" : "var(--surface)",
        color: active ? "#0a0a0b" : "var(--text2)",
        transition:"background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:16 }}>
      <p style={{ color:"var(--text2)", fontSize:11, margin:0, fontWeight:600 }}>{label}</p>
      <p style={{ color:"var(--text)", fontSize:18, fontWeight:700, margin:"4px 0 0" }}>{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--text2)" }}>
      <span style={{ width:12, height:12, borderRadius:3, background:color, display:"inline-block" }} />
      {label}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width:28, height:28, borderRadius:"50%", background:"var(--gold-dim)", color:"var(--gold)",
      fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
      overflow:"hidden", flexShrink:0,
    }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      ) : (initials || "?")}
    </div>
  );
}

function DayCell({ day, highlight, onSlot }: { day: DaySchedule | undefined; highlight: boolean; onSlot: (slot: Slot) => void }) {
  if (!day || !day.working_hours) {
    return (
      <div style={{
        borderRadius:"var(--radius)", minHeight:88, display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:11, color:"var(--text3)",
        background: highlight ? "rgba(255,255,255,0.03)" : "transparent",
      }}>
        Выходной
      </div>
    );
  }
  return (
    <div style={{
      display:"flex", flexDirection:"column", gap:4, minWidth:96,
      borderRadius:"var(--radius)", padding:4,
      background: highlight ? "rgba(255,255,255,0.03)" : "transparent",
    }}>
      {day.slots.map((s) => (
        <SlotBlock key={s.slot_id} slot={s} onClick={() => onSlot(s)} />
      ))}
    </div>
  );
}

function SlotBlock({ slot, onClick }: { slot: Slot; onClick: () => void }) {
  const base: React.CSSProperties = {
    width:"100%", textAlign:"left", borderRadius:6, padding:"4px 7px",
    fontSize:11, lineHeight:1.4, border:"none", cursor:"pointer",
    transition:"opacity 0.15s",
  };
  if (slot.status === "booked") {
    return (
      <button onClick={onClick} style={{ ...base, background:"rgba(76,175,125,0.75)", color:"#fff" }}>
        <span style={{ fontWeight:600 }}>{slot.starts_at}</span>
        <span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{slot.client_name}</span>
        {slot.service && <span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", opacity:0.8 }}>{slot.service}</span>}
      </button>
    );
  }
  if (slot.status === "blocked") {
    return (
      <button onClick={onClick} style={{
        ...base,
        background:"rgba(224,90,90,0.65)", color:"#fff",
        backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,0.12) 4px,rgba(0,0,0,0.12) 8px)",
      }}>
        <span style={{ fontWeight:600 }}>{slot.starts_at}</span>
        <span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", opacity:0.9 }}>{slot.reason || "Блок"}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{ ...base, background:"rgba(255,255,255,0.05)", color:"var(--text2)" }}>
      {slot.starts_at}–{slot.ends_at}
    </button>
  );
}

// ───────────────────────── side panel ──────────────────────────────────────

function SlotPanel({
  salonId,
  selected,
  onClose,
  onChanged,
}: {
  salonId: string;
  selected: SelectedSlot;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { slot, masterId, masterName, date } = selected;
  const [reason, setReason] = useState("");

  const blockMutation = useMutation({
    mutationFn: () =>
      api.post(`/salons/${salonId}/schedule/block`, {
        master_id: masterId,
        date,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        reason: reason.trim() || null,
      }),
    onSuccess: onChanged,
    onError: (e) => alert(parseApiError(e, "Не удалось заблокировать")),
  });

  const unblockMutation = useMutation({
    mutationFn: () => api.delete(`/salons/${salonId}/schedule/block/${slot.slot_id}`),
    onSuccess: onChanged,
    onError: (e) => alert(parseApiError(e, "Не удалось разблокировать")),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/salons/${salonId}/schedule/appointment/${slot.slot_id}`),
    onSuccess: onChanged,
    onError: (e) => alert(parseApiError(e, "Не удалось отменить запись")),
  });

  const dateLabel = useMemo(() => {
    const d = parseISO(date);
    return `${DAY_SHORT[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }, [date]);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", justifyContent:"flex-end" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div style={{
        position:"relative", width:"100%", maxWidth:360, height:"100%",
        background:"var(--surface)", borderLeft:"1px solid var(--border)",
        padding:24, overflowY:"auto",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ color:"var(--text)", fontWeight:600, fontSize:16, margin:0 }}>Слот</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", padding:4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
          <Row label="Барбер" value={masterName} />
          <Row label="День" value={dateLabel} />
          <Row label="Время" value={`${slot.starts_at} – ${slot.ends_at}`} />
        </div>

        {slot.status === "booked" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:14, display:"flex", flexDirection:"column", gap:8 }}>
              <Row label="Клиент" value={slot.client_name || "—"} />
              <Row label="Услуга" value={slot.service || "—"} />
            </div>
            <button
              onClick={() => { if (confirm("Отменить запись клиента?")) cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                background:"rgba(224,90,90,0.9)", color:"#fff", border:"none", borderRadius:"var(--radius)",
                padding:"10px", fontSize:13, fontWeight:600, cursor:"pointer",
                opacity: cancelMutation.isPending ? 0.5 : 1,
              }}
            >
              <Ban size={14} /> Отменить запись
            </button>
          </div>
        )}

        {slot.status === "free" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ color:"var(--text2)", fontSize:12, display:"block", marginBottom:6, fontWeight:500 }}>
                Причина блокировки (необязательно)
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="Обед, перерыв…"
                style={{
                  width:"100%", background:"var(--bg)", color:"var(--text)",
                  border:"1px solid var(--border)", borderRadius:"var(--radius)",
                  padding:"9px 12px", fontSize:13, outline:"none",
                }}
              />
            </div>
            <button
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                color:"var(--text2)", padding:"10px", fontSize:13, fontWeight:500, cursor:"pointer",
                opacity: blockMutation.isPending ? 0.5 : 1,
              }}
            >
              <Ban size={14} /> Заблокировать
            </button>
            <Link
              href="/appointments"
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                background:"var(--gold)", color:"#0a0a0b", borderRadius:"var(--radius)",
                padding:"10px", fontSize:13, fontWeight:700, textDecoration:"none",
              }}
            >
              <CalendarPlus size={14} /> Создать запись
            </Link>
          </div>
        )}

        {slot.status === "blocked" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:14 }}>
              <Row label="Причина" value={slot.reason || "—"} />
            </div>
            <button
              onClick={() => unblockMutation.mutate()}
              disabled={unblockMutation.isPending}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                color:"var(--text2)", padding:"10px", fontSize:13, fontWeight:500, cursor:"pointer",
                opacity: unblockMutation.isPending ? 0.5 : 1,
              }}
            >
              <Unlock size={14} /> Разблокировать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
      <span style={{ color:"var(--text2)", fontSize:13, flexShrink:0 }}>{label}</span>
      <span style={{ color:"var(--text)", fontSize:13, textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</span>
    </div>
  );
}

// ───────────────────────── master: working-hours editor ────────────────────

interface Workday {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_working: boolean;
}

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const DEFAULT_DAYS: Workday[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "18:00",
  break_start: "13:00",
  break_end: "14:00",
  is_working: i < 6,
}));

function WorkdaysEditor() {
  const qc = useQueryClient();
  const [days, setDays] = useState<Workday[]>(DEFAULT_DAYS);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<Workday[]>({
    queryKey: ["schedule", "workdays"],
    queryFn: () => api.get("/schedule/workdays").then((r) => r.data),
  });

  useEffect(() => {
    if (!data) return;
    if (data.length === 0) return;
    const merged = DEFAULT_DAYS.map((def) => {
      const found = data.find((d) => d.day_of_week === def.day_of_week);
      return found ?? def;
    });
    setDays(merged);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put("/schedule/workdays", { workdays: days }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function update(idx: number, patch: Partial<Workday>) {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  const timeInput: React.CSSProperties = {
    background:"var(--bg)", color:"var(--text)", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", padding:"6px 10px", fontSize:13, outline:"none",
  };

  return (
    <div style={{ padding:"32px 36px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
            Расписание
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Рабочие часы барбершопа</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{
            display:"flex", alignItems:"center", gap:8, background:"var(--gold)", color:"#0a0a0b",
            border:"none", borderRadius:"var(--radius)", padding:"9px 18px",
            fontSize:13, fontWeight:700, cursor:"pointer", opacity: saveMutation.isPending ? 0.5 : 1,
          }}
        >
          <Save size={14} />
          {saved ? "Сохранено!" : saveMutation.isPending ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2,3,4,5,6,7].map((i) => (
            <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:16, height:60, animation:"pulse 1.5s infinite" }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {days.map((day, idx) => (
            <div key={day.day_of_week} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"14px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:20 }}>
                <div style={{ width:128, flexShrink:0 }}>
                  <p style={{ color:"var(--text)", fontSize:14, fontWeight:500, margin:0 }}>{DAY_NAMES[day.day_of_week]}</p>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => update(idx, { is_working: !day.is_working })}
                  style={{
                    position:"relative", width:40, height:20, borderRadius:10,
                    background: day.is_working ? "var(--gold)" : "var(--border)",
                    border:"none", cursor:"pointer", flexShrink:0,
                    transition:"background 0.2s",
                  }}
                >
                  <span style={{
                    position:"absolute", top:2, width:16, height:16, borderRadius:"50%",
                    background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.3)",
                    transition:"transform 0.2s",
                    transform: day.is_working ? "translateX(22px)" : "translateX(2px)",
                  }} />
                </button>

                {day.is_working ? (
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <Clock size={13} style={{ color:"var(--text3)" }} />
                      <input type="time" value={day.start_time} onChange={(e) => update(idx, { start_time: e.target.value })} style={timeInput} />
                      <span style={{ color:"var(--text3)", fontSize:12 }}>—</span>
                      <input type="time" value={day.end_time} onChange={(e) => update(idx, { end_time: e.target.value })} style={timeInput} />
                    </div>
                    <span style={{ color:"var(--text3)", fontSize:12 }}>Перерыв:</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="time" value={day.break_start ?? ""} onChange={(e) => update(idx, { break_start: e.target.value || null })} style={timeInput} />
                      <span style={{ color:"var(--text3)", fontSize:12 }}>—</span>
                      <input type="time" value={day.break_end ?? ""} onChange={(e) => update(idx, { break_end: e.target.value || null })} style={timeInput} />
                    </div>
                  </div>
                ) : (
                  <span style={{ color:"var(--text3)", fontSize:13 }}>Выходной</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
