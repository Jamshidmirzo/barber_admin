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

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending:     { background:"rgba(201,164,92,0.12)",  color:"#c9a45c",  borderLeft:"3px solid #c9a45c" },
  scheduled:   { background:"rgba(91,141,238,0.10)",  color:"#5b8dee",  borderLeft:"3px solid #5b8dee" },
  confirmed:   { background:"rgba(91,141,238,0.10)",  color:"#5b8dee",  borderLeft:"3px solid #5b8dee" },
  in_progress: { background:"rgba(168,85,247,0.10)",  color:"#a855f7",  borderLeft:"3px solid #a855f7" },
  completed:   { background:"rgba(76,175,125,0.10)",  color:"#4caf7d",  borderLeft:"3px solid #4caf7d" },
  cancelled:   { background:"rgba(224,90,90,0.08)",   color:"#e05a5a",  borderLeft:"3px solid #e05a5a" },
  no_show:     { background:"rgba(90,90,82,0.15)",    color:"#9a9690",  borderLeft:"3px solid #5a5852" },
};

const BADGE_STYLE: Record<string, React.CSSProperties> = {
  pending:     { background:"rgba(201,164,92,0.14)",  color:"#c9a45c" },
  scheduled:   { background:"rgba(91,141,238,0.12)",  color:"#5b8dee" },
  confirmed:   { background:"rgba(91,141,238,0.12)",  color:"#5b8dee" },
  in_progress: { background:"rgba(168,85,247,0.12)",  color:"#a855f7" },
  completed:   { background:"rgba(76,175,125,0.12)",  color:"#4caf7d" },
  cancelled:   { background:"rgba(224,90,90,0.10)",   color:"#e05a5a" },
  no_show:     { background:"rgba(90,90,82,0.12)",    color:"#9a9690" },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru", { hour:"2-digit", minute:"2-digit" });
}

export default function AppointmentsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const start = `${date}T00:00:00`;
  const end   = `${date}T23:59:59`;

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
    queryFn: () => api.get("/clients", { params: { limit:500, offset:0 } }).then((r) => r.data),
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
    const d = new Date(date); d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  }

  const isToday = date === new Date().toISOString().slice(0, 10);
  const displayDate = new Date(date).toLocaleDateString("ru", {
    weekday:"long", day:"numeric", month:"long",
  });

  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
            Записи
          </h1>
          {isToday && (
            <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Сегодня</p>
          )}
        </div>

        {/* Day navigator */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button
            onClick={prevDay}
            style={{
              width:36, height:36, borderRadius:"var(--radius)",
              background:"var(--surface)", border:"1px solid var(--border)",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", color:"var(--text2)",
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{
            padding:"7px 18px", background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", minWidth:220, textAlign:"center",
          }}>
            <span style={{ color:"var(--text)", fontSize:13, fontWeight:500, textTransform:"capitalize" }}>
              {displayDate}
            </span>
          </div>

          <button
            onClick={nextDay}
            style={{
              width:36, height:36, borderRadius:"var(--radius)",
              background:"var(--surface)", border:"1px solid var(--border)",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", color:"var(--text2)",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} style={{
              background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--radius-lg)", padding:"16px 20px",
              display:"flex", gap:20, alignItems:"center", animation:"pulse 1.5s infinite",
            }}>
              <div style={{ width:40, height:14, background:"var(--border)", borderRadius:4 }} />
              <div style={{ flex:1, height:14, background:"var(--border)", borderRadius:4 }} />
              <div style={{ width:80, height:14, background:"var(--border)", borderRadius:4 }} />
            </div>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!appointments || appointments.length === 0) && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0", textAlign:"center" }}>
          <div style={{
            width:64, height:64, borderRadius:"var(--radius-lg)",
            background:"var(--surface)", border:"1px solid var(--border)",
            display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16,
          }}>
            <Calendar size={28} style={{ color:"var(--text3)" }} />
          </div>
          <p style={{ color:"var(--text2)", fontSize:14 }}>Нет записей на этот день</p>
        </div>
      )}

      {/* List */}
      {!isLoading && appointments && appointments.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {appointments.map((a) => {
            const statusStyle = STATUS_STYLE[a.status] ?? { background:"var(--surface)", color:"var(--text2)", borderLeft:"3px solid var(--border)" };
            const badgeStyle  = BADGE_STYLE[a.status]  ?? { background:"var(--gold-dim)", color:"var(--gold)" };
            return (
              <div
                key={a.id}
                style={{
                  ...statusStyle,
                  border:"1px solid var(--border)",
                  borderRadius:"var(--radius-lg)",
                  padding:"14px 20px",
                  display:"flex", alignItems:"center", gap:20,
                }}
              >
                {/* Time */}
                <div style={{ fontFamily:"monospace", fontSize:15, fontWeight:700, color:"var(--gold)", flexShrink:0, width:42 }}>
                  {formatTime(a.starts_at)}
                </div>

                {/* Info */}
                <div style={{ minWidth:0, flex:1 }}>
                  <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {clientMap[a.client_id] ?? "Клиент"}
                  </p>
                  <p style={{ color:"var(--text2)", fontSize:12, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {serviceMap[a.service_id] ?? "Услуга"} · до {formatTime(a.ends_at)}
                  </p>
                  {a.note && (
                    <p style={{ color:"var(--text3)", fontSize:12, margin:"3px 0 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {a.note}
                    </p>
                  )}
                </div>

                {/* Price */}
                {a.price != null && (
                  <p style={{ color:"var(--text)", fontSize:13, fontWeight:500, flexShrink:0 }}>
                    {a.price.toLocaleString("ru")} сум
                  </p>
                )}

                {/* Status badge */}
                <span style={{
                  ...badgeStyle,
                  fontSize:11, fontWeight:600, padding:"3px 10px",
                  borderRadius:20, flexShrink:0,
                }}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
