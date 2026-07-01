"use client";

import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Scissors } from "lucide-react";
import api from "@/lib/api";

interface Barber {
  id: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

interface PublicServiceItem {
  id: string;
  name: string;
  price: number;
  duration_min: number;
  category: string;
}

interface MasterDetail {
  id: string;
  services: PublicServiceItem[];
}

interface ServiceRow extends PublicServiceItem {
  barberId: string;
  barberLabel: string;
}

const CAT_LABELS: Record<string, string> = {
  haircut: "Стрижка",
  beard: "Борода",
  coloring: "Окрашивание",
  treatment: "Уход",
  other: "Другое",
};

function barberLabel(b: Pick<Barber, "name" | "last_name">): string {
  return [b.name, b.last_name].filter(Boolean).join(" ") || "Без имени";
}

const CAT_BADGE: Record<string, React.CSSProperties> = {
  haircut:   { background:"var(--gold-dim)", color:"var(--gold)" },
  beard:     { background:"rgba(91,141,238,0.12)", color:"#5b8dee" },
  coloring:  { background:"rgba(168,85,247,0.12)", color:"#a855f7" },
  treatment: { background:"rgba(76,175,125,0.12)", color:"var(--green)" },
  other:     { background:"var(--bg2)", color:"var(--text2)" },
};

export default function ServicesPage() {
  const [barberFilter, setBarberFilter] = useState<string>("all");

  const { data: team, isLoading: teamLoading } = useQuery<{ items: Barber[]; total: number }>({
    queryKey: ["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const barbers = team?.items ?? [];

  const serviceQueries = useQueries({
    queries: barbers.map((b) => ({
      queryKey: ["master-services", b.id],
      queryFn: () => api.get<MasterDetail>(`/public/masters/${b.id}`).then((r) => r.data),
      staleTime: 60_000,
    })),
  });

  const servicesLoading = serviceQueries.some((q) => q.isLoading);
  const isLoading = teamLoading || servicesLoading;

  const rows: ServiceRow[] = [];
  barbers.forEach((b, i) => {
    const detail = serviceQueries[i]?.data;
    const label = barberLabel(b);
    (detail?.services ?? []).forEach((s) => {
      rows.push({ ...s, barberId: b.id, barberLabel: label });
    });
  });
  rows.sort((a, b) =>
    a.barberLabel.localeCompare(b.barberLabel, "ru") || a.name.localeCompare(b.name, "ru")
  );

  const filtered = barberFilter === "all" ? rows : rows.filter((r) => r.barberId === barberFilter);

  const selectStyle: React.CSSProperties = {
    background: "var(--surface)", color: "var(--text)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontSize: 13, fontFamily: "'Manrope',sans-serif",
    outline: "none", cursor: "pointer",
  };

  return (
    <div style={{ padding:"32px 36px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, gap:16 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>
            Услуги
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>
            {filtered.length} услуг{barberFilter === "all" && barbers.length > 0 ? ` · ${barbers.length} мастеров` : ""}
          </p>
        </div>
        <select value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} style={selectStyle}>
          <option value="all">Все мастера</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>{barberLabel(b)}</option>
          ))}
        </select>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{
              padding:"16px 20px", borderBottom:"1px solid var(--border)",
              display:"flex", gap:20, animation:"pulse 1.5s infinite",
            }}>
              <div style={{ height:13, background:"var(--border)", borderRadius:4, width:160 }} />
              <div style={{ height:13, background:"var(--border)", borderRadius:4, width:80, marginLeft:"auto" }} />
            </div>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0", textAlign:"center" }}>
          <div style={{
            width:64, height:64, borderRadius:"var(--radius-lg)",
            background:"var(--surface)", border:"1px solid var(--border)",
            display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16,
          }}>
            <Scissors size={28} style={{ color:"var(--text3)" }} />
          </div>
          <p style={{ color:"var(--text2)", fontSize:14 }}>
            {barbers.length === 0
              ? "В салоне пока нет мастеров. Добавьте барбера во вкладке «Барберы»."
              : "У выбранного мастера нет услуг."}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Название", "Категория", "Барбер", "Длительность", "Цена"].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 4 ? "right" : "left",
                    color:"var(--text3)", fontWeight:600, fontSize:11,
                    padding:"12px 20px", textTransform:"uppercase", letterSpacing:"0.05em",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const catStyle = CAT_BADGE[s.category] ?? CAT_BADGE.other;
                return (
                  <tr
                    key={`${s.barberId}-${s.id}`}
                    style={{ borderBottom: i < filtered.length-1 ? "1px solid var(--border)" : "none" }}
                  >
                    <td style={{ padding:"14px 20px", color:"var(--text)", fontWeight:600, fontSize:14 }}>{s.name}</td>
                    <td style={{ padding:"14px 20px" }}>
                      {s.category ? (
                        <span style={{ ...catStyle, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20 }}>
                          {CAT_LABELS[s.category] ?? s.category}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding:"14px 20px", color:"var(--text2)", fontSize:13 }}>{s.barberLabel}</td>
                    <td style={{ padding:"14px 20px", color:"var(--text2)", fontSize:13 }}>{s.duration_min} мин</td>
                    <td style={{ padding:"14px 20px", textAlign:"right", color:"var(--gold)", fontWeight:700, fontSize:14 }}>
                      {s.price.toLocaleString("ru")} сум
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
