"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Save } from "lucide-react";
import api from "@/lib/api";

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

export default function SchedulePage() {
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

                {/* Toggle */}
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
