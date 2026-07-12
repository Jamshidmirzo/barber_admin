"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Phone, MapPin, Scissors, UserRound, Calendar, Wallet, Clock } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";
import { useIntlLocale } from "@/lib/locale";
import { useAdminCountry, currencyForCountry } from "@/hooks/useAdminCountry";

interface VisitHistoryItem {
  appointment_id: string; date: string; barber_name: string;
  service_name: string | null; amount: number;
}
interface FavoriteRef { id: string; name: string; count: number; }
interface ClientDetail {
  id: string; name: string; phone: string; city_id: string | null; city_name: string | null;
  total_visits: number; total_spent: number; first_visit: string | null; last_visit: string | null;
  favorite_barber: FavoriteRef | null; favorite_service: FavoriteRef | null;
  visits_history: VisitHistoryItem[];
}

function fmtMoney(n: number, currency: string, locale: string) { return n.toLocaleString(locale) + " " + currency; }
function fmtDate(iso: string | null) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("ru", { day:"numeric", month:"short", year:"numeric" }); }
function fmtDateTime(iso: string) { return new Date(iso).toLocaleString("ru", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }
function daysSince(iso: string | null): number | null { if (!iso) return null; return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); }

export default function ClientDetailPage() {
  const t = useTranslations("ClientDetail");
  const { salon } = useSalon();
  const locale = useIntlLocale();
  const currency = currencyForCountry(useAdminCountry());
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const { data, isLoading, isError } = useQuery<ClientDetail>({
    queryKey:["salon-client", salon.id, clientId],
    queryFn: () => api.get(`/salons/${salon.id}/clients/${clientId}`).then((r) => r.data),
  });

  const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };

  if (isLoading) {
    return (
      <div style={{ padding:"32px 36px" }}>
        <div style={{ height:20, width:100, background:"var(--surface)", borderRadius:4, marginBottom:24, animation:"pulse 1.5s infinite" }} />
        <div style={{ ...cardS, height:120, animation:"pulse 1.5s infinite" }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding:"32px 36px" }}>
        <BackLink />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"80px 0" }}>
          <UserRound size={36} style={{ color:"var(--text3)", marginBottom:12 }} />
          <p style={{ color:"var(--text2)", fontSize:14 }}>{t("notFound")}</p>
        </div>
      </div>
    );
  }

  const idle = daysSince(data.last_visit);
  const idleBg = idle === null ? "" : idle > 60 ? "rgba(224,90,90,0.1)" : idle > 30 ? "rgba(245,158,11,0.1)" : "rgba(76,175,125,0.1)";
  const idleColor = idle === null ? "" : idle > 60 ? "var(--red)" : idle > 30 ? "var(--gold)" : "var(--green)";

  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>
      <BackLink />

      {/* Header card */}
      <div style={{ ...cardS, padding:24, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:"var(--radius-lg)", background:"var(--gold-dim)", color:"var(--gold)", fontWeight:700, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {initials(data.name)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ color:"var(--text)", fontSize:20, fontWeight:700, margin:0 }}>{data.name}</h1>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 16px", marginTop:6, fontSize:13, color:"var(--text2)" }}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><Phone size={13} /> {data.phone}</span>
              {data.city_name && <span style={{ display:"flex", alignItems:"center", gap:5 }}><MapPin size={13} /> {data.city_name}</span>}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:10 }}>
              {data.favorite_barber && (
                <span style={{ display:"flex", alignItems:"center", gap:5, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"4px 10px", fontSize:12, color:"var(--text2)" }}>
                  <UserRound size={12} style={{ color:"var(--gold)" }} /> {t("favoriteBarberLabel")} <b style={{ color:"var(--text)" }}>{data.favorite_barber.name}</b>
                </span>
              )}
              {data.favorite_service && (
                <span style={{ display:"flex", alignItems:"center", gap:5, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"4px 10px", fontSize:12, color:"var(--text2)" }}>
                  <Scissors size={12} style={{ color:"var(--gold)" }} /> {t("favoriteServiceLabel")} <b style={{ color:"var(--text)" }}>{data.favorite_service.name}</b>
                </span>
              )}
            </div>
          </div>
          {idle !== null && (
            <span style={{ flexShrink:0, fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:"var(--radius)", background:idleBg, color:idleColor }}>
              {idle === 0 ? t("idle.today") : t("idle.daysAgo", { days:idle })}
            </span>
          )}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
        <KpiCard icon={<Calendar size={14} />} label={t("kpi.visits")} value={String(data.total_visits)} />
        <KpiCard icon={<Wallet size={14} />} label={t("kpi.revenue")} value={fmtMoney(data.total_spent, currency, locale)} />
        <KpiCard icon={<Clock size={14} />} label={t("kpi.firstVisit")} value={fmtDate(data.first_visit)} />
        <KpiCard icon={<Clock size={14} />} label={t("kpi.lastVisit")} value={fmtDate(data.last_visit)} />
      </div>

      {/* History */}
      <div style={cardS}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
          <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>{t("history.title")}</p>
        </div>
        {data.visits_history.length === 0 ? (
          <p style={{ color:"var(--text3)", fontSize:13, padding:"32px 20px", textAlign:"center" }}>{t("history.empty")}</p>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {[t("history.table.date"), t("history.table.barber"), t("history.table.service"), t("history.table.amount")].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 3 ? "right" : "left", color:"var(--text3)", fontWeight:600, fontSize:11, padding:"10px 20px", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.visits_history.map((v) => (
                <tr key={v.appointment_id} style={{ borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"12px 20px", color:"var(--text2)" }}>{fmtDateTime(v.date)}</td>
                  <td style={{ padding:"12px 20px", color:"var(--text2)" }}>{v.barber_name}</td>
                  <td style={{ padding:"12px 20px", color:"var(--text3)" }}>{v.service_name ?? "—"}</td>
                  <td style={{ padding:"12px 20px", textAlign:"right", color:"var(--gold)", fontWeight:600 }}>{fmtMoney(v.amount, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  const t = useTranslations("ClientDetail");
  return (
    <Link href="/clients" style={{ display:"inline-flex", alignItems:"center", gap:6, color:"var(--text2)", fontSize:13, textDecoration:"none", marginBottom:20 }}>
      <ArrowLeft size={14} /> {t("backLink")}
    </Link>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text3)", fontSize:11, marginBottom:6 }}>{icon} {label}</div>
      <p style={{ color:"var(--text)", fontWeight:700, fontSize:18, margin:0 }}>{value}</p>
    </div>
  );
}
