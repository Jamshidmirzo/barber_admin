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
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Расписание команды</h1>
            <p className="text-gray-400 text-sm mt-0.5">Сетка занятости барберов на неделю</p>
          </div>
          <button
            onClick={() => fillGapMutation.mutate()}
            disabled={fillGapMutation.isPending || !data}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            {fillGapMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Заполнить пустые окна
          </button>
        </div>

        {/* Week nav + barber chips */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnchor(fmtDateISO(addDays(weekStart, -7)))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
              aria-label="Предыдущая неделя"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white text-sm font-medium min-w-[140px] text-center">{weekLabel}</span>
            <button
              onClick={() => setAnchor(fmtDateISO(addDays(weekStart, 7)))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
              aria-label="Следующая неделя"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAnchor(fmtDateISO(new Date()))}
              className="ml-1 text-xs text-[#F59E0B] hover:underline"
            >
              Сегодня
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Chip active={barberFilter === "all"} onClick={() => setBarberFilter("all")}>
              Все
            </Chip>
            {data?.barbers.map((b) => (
              <Chip key={b.master_id} active={barberFilter === b.master_id} onClick={() => setBarberFilter(b.master_id)}>
                {b.name}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Day stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label={`Загрузка (${DAY_SHORT[DAY_KEYS.indexOf(selectedDay)]})`} value={`${dayAgg.load}%`} />
        <StatCard label="Выручка дня" value={fmtMoney(dayAgg.revenue)} />
        <StatCard label="Пустые окна" value={String(dayAgg.free)} />
        <StatCard label="Заблокировано" value={String(dayAgg.blocked)} />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="bg-[#1F2937] rounded-2xl p-6 animate-pulse h-80" />
      ) : isError ? (
        <div className="bg-[#1F2937] rounded-2xl p-6 text-red-400 text-sm">
          {parseApiError(error, "Не удалось загрузить расписание")}
        </div>
      ) : barbers.length === 0 ? (
        <div className="bg-[#1F2937] rounded-2xl p-10 text-center text-gray-400 text-sm">
          В салоне пока нет барберов.
        </div>
      ) : (
        <div className="bg-[#1F2937] rounded-2xl p-3 overflow-x-auto">
          <table className="border-separate border-spacing-2 w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="w-32 sticky left-0 z-10 bg-[#1F2937]" />
                {DAY_KEYS.map((key, i) => {
                  const d = weekDates[i];
                  const isSel = key === selectedDay;
                  return (
                    <th key={key} className="p-0">
                      <button
                        onClick={() => setSelectedDay(key)}
                        className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          isSel ? "bg-[#F59E0B]/15 text-[#F59E0B]" : "text-gray-400 hover:bg-white/5"
                        }`}
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
                  <td className="sticky left-0 z-10 bg-[#1F2937] align-top">
                    <div className="flex items-center gap-2 pr-2 pt-1">
                      <Avatar name={b.name} url={b.avatar_url} />
                      <span className="text-white text-sm font-medium truncate max-w-[88px]">{b.name}</span>
                    </div>
                  </td>
                  {DAY_KEYS.map((key, i) => {
                    const day = b.days[key];
                    const dateISO = fmtDateISO(weekDates[i]);
                    return (
                      <td key={key} className="align-top">
                        <DayCell
                          day={day}
                          highlight={key === selectedDay}
                          onSlot={(slot) =>
                            setSelected({
                              masterId: b.master_id,
                              masterName: b.name,
                              dayKey: key,
                              date: dateISO,
                              slot,
                            })
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
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
        <LegendDot className="bg-emerald-500/80" label="Занято" />
        <LegendDot className="bg-white/10" label="Свободно" />
        <LegendDot className="bg-red-500/70" label="Заблокировано" />
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
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? "bg-[#F59E0B] text-white" : "bg-white/5 text-gray-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1F2937] rounded-2xl p-4">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-white text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-semibold flex items-center justify-center overflow-hidden">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials || "?"
      )}
    </div>
  );
}

function DayCell({
  day,
  highlight,
  onSlot,
}: {
  day: DaySchedule | undefined;
  highlight: boolean;
  onSlot: (slot: Slot) => void;
}) {
  if (!day || !day.working_hours) {
    return (
      <div className={`rounded-lg min-h-[88px] h-full flex items-center justify-center text-[11px] text-gray-600 ${highlight ? "bg-white/5" : ""}`}>
        Выходной
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-1 min-w-[96px] rounded-lg p-1 ${highlight ? "bg-white/5" : ""}`}>
      {day.slots.map((s) => (
        <SlotBlock key={s.slot_id} slot={s} onClick={() => onSlot(s)} />
      ))}
    </div>
  );
}

function SlotBlock({ slot, onClick }: { slot: Slot; onClick: () => void }) {
  const base = "w-full text-left rounded-md px-2 py-1 text-[11px] leading-tight transition-colors";
  if (slot.status === "booked") {
    return (
      <button onClick={onClick} className={`${base} bg-emerald-500/80 hover:bg-emerald-500 text-white`}>
        <span className="font-medium">{slot.starts_at}</span>
        <span className="block truncate">{slot.client_name}</span>
        {slot.service ? <span className="block truncate opacity-80">{slot.service}</span> : null}
      </button>
    );
  }
  if (slot.status === "blocked") {
    return (
      <button
        onClick={onClick}
        className={`${base} bg-red-500/70 hover:bg-red-500/90 text-white bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.12)_4px,rgba(0,0,0,0.12)_8px)]`}
      >
        <span className="font-medium">{slot.starts_at}</span>
        <span className="block truncate opacity-90">{slot.reason || "Блок"}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={`${base} bg-white/5 hover:bg-white/10 text-gray-400`}>
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-[#1F2937] p-6 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Слот</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 text-sm mb-6">
          <Row label="Барбер" value={masterName} />
          <Row label="День" value={dateLabel} />
          <Row label="Время" value={`${slot.starts_at} – ${slot.ends_at}`} />
        </div>

        {slot.status === "booked" && (
          <div className="space-y-4">
            <div className="bg-[#111827] rounded-xl p-4 space-y-1.5 text-sm">
              <Row label="Клиент" value={slot.client_name || "—"} />
              <Row label="Услуга" value={slot.service || "—"} />
            </div>
            <button
              onClick={() => {
                if (confirm("Отменить запись клиента?")) cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-red-500/90 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              <Ban className="w-4 h-4" />
              Отменить запись
            </button>
          </div>
        )}

        {slot.status === "free" && (
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs block mb-1.5">Причина блокировки (необязательно)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="Обед, перерыв…"
                className="w-full bg-[#111827] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#F59E0B]"
              />
            </div>
            <button
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              <Ban className="w-4 h-4" />
              Заблокировать
            </button>
            <Link
              href="/appointments"
              className="w-full flex items-center justify-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              <CalendarPlus className="w-4 h-4" />
              Создать запись
            </Link>
          </div>
        )}

        {slot.status === "blocked" && (
          <div className="space-y-4">
            <div className="bg-[#111827] rounded-xl p-4 text-sm">
              <Row label="Причина" value={slot.reason || "—"} />
            </div>
            <button
              onClick={() => unblockMutation.mutate()}
              disabled={unblockMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              <Unlock className="w-4 h-4" />
              Разблокировать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className="text-white text-right truncate">{value}</span>
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Расписание</h1>
          <p className="text-gray-400 text-sm mt-0.5">Рабочие часы барбершопа</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? "Сохранено!" : saveMutation.isPending ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="bg-[#1F2937] rounded-2xl p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day, idx) => (
            <div key={day.day_of_week} className="bg-[#1F2937] rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <p className="text-white text-sm font-medium">{DAY_NAMES[day.day_of_week]}</p>
                </div>

                <button
                  onClick={() => update(idx, { is_working: !day.is_working })}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${day.is_working ? "bg-[#F59E0B]" : "bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${day.is_working ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>

                {day.is_working ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="time"
                        value={day.start_time}
                        onChange={(e) => update(idx, { start_time: e.target.value })}
                        className="bg-[#111827] text-white text-sm rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#F59E0B]"
                      />
                      <span className="text-gray-500 text-xs">—</span>
                      <input
                        type="time"
                        value={day.end_time}
                        onChange={(e) => update(idx, { end_time: e.target.value })}
                        className="bg-[#111827] text-white text-sm rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#F59E0B]"
                      />
                    </div>
                    <span className="text-gray-600 text-xs">Перерыв:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={day.break_start ?? ""}
                        onChange={(e) => update(idx, { break_start: e.target.value || null })}
                        className="bg-[#111827] text-white text-sm rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#F59E0B]"
                      />
                      <span className="text-gray-500 text-xs">—</span>
                      <input
                        type="time"
                        value={day.break_end ?? ""}
                        onChange={(e) => update(idx, { break_end: e.target.value || null })}
                        className="bg-[#111827] text-white text-sm rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#F59E0B]"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-600 text-sm">Выходной</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
