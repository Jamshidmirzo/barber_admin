"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";

interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price?: number;
  note?: string | null;
}

interface Client { id: string; name: string; phone: string; }
interface Service { id: string; name: string; }

const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидает",
  scheduled: "Запланирована",
  confirmed: "Подтверждена",
  in_progress: "В процессе",
  completed: "Завершена",
  cancelled: "Отменена",
  no_show: "Не явился",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  scheduled: "bg-blue-500/10 text-blue-400",
  confirmed: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-purple-500/10 text-purple-400",
  completed: "bg-green-500/10 text-green-400",
  cancelled: "bg-red-500/10 text-red-400",
  no_show: "bg-gray-500/10 text-gray-400",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

export default function AppointmentsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments", date],
    queryFn: () =>
      api.get("/appointments", { params: { start, end } }).then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.items ?? [];
      }),
  });

  const { data: clientsData } = useQuery<{ items: Client[]; total: number }>({
    queryKey: ["clients", "all"],
    queryFn: () => api.get("/clients", { params: { limit: 500, offset: 0 } }).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get("/services").then((r) => r.data),
    staleTime: 60_000,
  });

  const clientMap = Object.fromEntries((clientsData?.items ?? []).map((c) => [c.id, c.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s) => [s.id, s.name]));

  function prevDay() {
    const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10));
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10));
  }

  const displayDate = new Date(date).toLocaleDateString("ru", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Записи</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1F2937] hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white text-sm font-medium capitalize min-w-[180px] text-center">{displayDate}</span>
          <button onClick={nextDay} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1F2937] hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1F2937] rounded-2xl p-4 animate-pulse flex gap-4">
              <div className="h-4 bg-white/10 rounded w-16" />
              <div className="h-4 bg-white/10 rounded w-40" />
              <div className="h-4 bg-white/10 rounded w-24 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!appointments || appointments.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">Нет записей на этот день</p>
        </div>
      )}

      {!isLoading && appointments && appointments.length > 0 && (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="bg-[#1F2937] rounded-2xl p-4 flex items-center gap-4">
              <div className="text-[#F59E0B] font-mono text-sm font-semibold w-14 shrink-0">
                {formatTime(a.starts_at)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">
                  {clientMap[a.client_id] ?? "Клиент"}
                </p>
                <p className="text-gray-400 text-xs truncate">
                  {serviceMap[a.service_id] ?? "Услуга"} · до {formatTime(a.ends_at)}
                </p>
                {a.note && <p className="text-gray-500 text-xs truncate mt-0.5">{a.note}</p>}
              </div>
              {a.price != null && (
                <p className="text-gray-300 text-sm tabular-nums shrink-0">
                  {a.price.toLocaleString()} сум
                </p>
              )}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_COLOR[a.status] ?? "bg-gray-500/10 text-gray-400"}`}>
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
