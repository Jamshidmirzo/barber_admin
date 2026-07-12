"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowLeft, Phone, TrendingUp, FileText, Film, Heart, Eye } from "lucide-react";
import api from "@/lib/api";
import { useIntlLocale } from "@/lib/locale";
import { useAdminCountry, currencyForCountry } from "@/hooks/useAdminCountry";

interface TopService { service_id: string; name: string; count: number; }
interface RecentClient { client_id: string | null; name: string; date: string; service_name: string | null; amount_uzs: number; }
interface RevenuePoint { date: string; revenue: number; }
interface MasterStats {
  master_id: string; name: string; phone: string; photo_url: string | null; specializations: string[];
  date_from: string; date_to: string; total_revenue: number; total_appointments: number;
  unique_clients: number; worked_hours: number; idle_hours: number;
  top_services: TopService[]; recent_clients: RecentClient[]; revenue_by_day: RevenuePoint[];
}
interface MasterContentStats {
  master_id: string; posts_count: number; likes_count: number; comments_count: number;
  reels_count: number; total_reels_views: number; story_views_24h: number; subscribers_count: number;
}

type PeriodKey = "7" | "30" | "90" | "custom";

function fmt(n: number, currency: string, locale: string) { return n.toLocaleString(locale) + " " + currency; }
function shortDay(iso: string, locale: string) { return new Date(iso).toLocaleDateString(locale, { day:"2-digit", month:"2-digit" }); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function initials(name: string, phone: string) { const n = name.trim(); return n && n !== "—" ? n.slice(0, 2).toUpperCase() : phone.slice(-2); }

const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };

export default function BarberDetailPage() {
  const t = useTranslations("BarberDetail");
  const tc = useTranslations("Common");
  const params = useParams<{ id: string }>();
  const id = params.id;
  const currency = currencyForCountry(useAdminCountry());
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    if (period === "custom") { if (!customFrom || !customTo) return null; return { from:customFrom, to:customTo }; }
    const days = Number(period), to = new Date(), from = new Date();
    from.setDate(to.getDate() - (days - 1));
    return { from:isoDate(from), to:isoDate(to) };
  }, [period, customFrom, customTo]);

  const { data, isLoading } = useQuery<MasterStats>({
    queryKey:["master", id, "stats", range?.from, range?.to],
    queryFn: () => api.get(`/team/members/${id}/stats`, { params: range ? { from:range.from, to:range.to } : undefined }).then((r) => r.data),
    enabled: !!range,
  });

  const { data: contentData } = useQuery<MasterContentStats>({
    queryKey:["master", id, "content-stats"],
    queryFn: () => api.get(`/team/members/${id}/content-stats`).then((r) => r.data),
  });

  const locale = useIntlLocale();
  const totalHours = data ? data.worked_hours + data.idle_hours : 0;
  const efficiency = totalHours > 0 ? Math.round((data!.worked_hours / totalHours) * 100) : 0;
  const idlePct = totalHours > 0 ? Math.round((data!.idle_hours / totalHours) * 100) : 0;
  const maxServiceCount = Math.max(...(data?.top_services.map((s) => s.count) ?? [1]), 1);
  const hasContent = contentData && (contentData.posts_count > 0 || contentData.reels_count > 0 || contentData.likes_count > 0 || contentData.total_reels_views > 0 || contentData.story_views_24h > 0);

  const periods: { key: PeriodKey; label: string }[] = [
    { key:"7", label: t("periods.d7") },
    { key:"30", label: t("periods.d30") },
    { key:"90", label: t("periods.d90") },
    { key:"custom", label: t("periods.custom") },
  ];

  const inp: React.CSSProperties = { background:"var(--bg)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"7px 12px", fontSize:13, outline:"none" };

  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>
      <Link href="/barbers" style={{ display:"inline-flex", alignItems:"center", gap:6, color:"var(--text2)", fontSize:13, textDecoration:"none", marginBottom:20 }}>
        <ArrowLeft size={14} /> {t("backToTeam")}
      </Link>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, minWidth:0 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--gold-dim)", color:"var(--gold)", fontWeight:700, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
            {data?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo_url} alt={data.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            ) : initials(data?.name ?? "", data?.phone ?? "")}
          </div>
          <div style={{ minWidth:0 }}>
            <h1 style={{ color:"var(--text)", fontSize:20, fontWeight:700, margin:0 }}>{data?.name ?? t("defaultName")}</h1>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:4 }}>
              {data?.specializations?.length ? data.specializations.map((s) => (
                <span key={s} style={{ fontSize:11, background:"var(--bg)", border:"1px solid var(--border)", color:"var(--text2)", padding:"2px 8px", borderRadius:20 }}>{s}</span>
              )) : <span style={{ color:"var(--text3)", fontSize:12 }}>{data?.phone}</span>}
            </div>
          </div>
        </div>
        {data?.phone && (
          <a href={`tel:${data.phone}`} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--gold)", color:"#0a0a0b", textDecoration:"none", borderRadius:"var(--radius)", padding:"9px 16px", fontSize:13, fontWeight:700 }}>
            <Phone size={14} /> {t("call")}
          </a>
        )}
      </div>

      {/* Summary bar */}
      {isLoading || !data ? (
        <div style={{ ...cardS, height:76, marginBottom:24, animation:"pulse 1.5s infinite" }}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : (
        <div style={{ ...cardS, marginBottom:24, display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
          <SummaryCell label={t("summary.appointments")} value={String(data.total_appointments)} />
          <SummaryCell label={t("summary.clients")} value={String(data.unique_clients)} border />
          <SummaryCell label={t("summary.revenue")} value={fmt(data.total_revenue, currency, locale)} border small />
        </div>
      )}

      {/* Period selector */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <div style={{ display:"flex", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:4, gap:4 }}>
          {periods.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding:"6px 12px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, background: period===p.key ? "var(--gold)" : "transparent", color: period===p.key ? "#0a0a0b" : "var(--text2)" }}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={inp} />
            <span style={{ color:"var(--text3)" }}>—</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={inp} />
          </div>
        )}
      </div>

      {isLoading || !data ? (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {[80,64,260,180].map((h,i) => <div key={i} style={{ ...cardS, height:h, animation:"pulse 1.5s infinite" }} />)}
        </div>
      ) : (
        <>
          {/* Content stats */}
          {hasContent && (
            <div style={{ ...cardS, padding:20, marginBottom:16 }}>
              <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 14px" }}>{t("content.title")}</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                <ContentCard icon={<FileText size={14} />} label={t("content.posts")} value={contentData!.posts_count} />
                <ContentCard icon={<Film size={14} />} label={t("content.reels")} value={contentData!.reels_count} />
                <ContentCard icon={<Heart size={14} />} label={t("content.likes")} value={contentData!.likes_count} />
                <ContentCard icon={<Eye size={14} />} label={t("content.stories24h")} value={contentData!.story_views_24h} />
              </div>
            </div>
          )}

          {/* Time utilisation */}
          <div style={{ ...cardS, padding:20, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>{t("timeUsage.title")}</p>
              <span style={{ fontSize:12, color: idlePct > 30 ? "var(--red)" : "var(--text3)" }}>{t("timeUsage.idlePct", { pct: idlePct })}</span>
            </div>
            <div style={{ height:10, width:"100%", borderRadius:5, background:"var(--bg)", overflow:"hidden", display:"flex" }}>
              <div style={{ background:"var(--gold)", height:"100%", borderRadius:"5px 0 0 5px", width:`${efficiency}%` }} />
              <div style={{ background:"rgba(224,90,90,0.4)", height:"100%", borderRadius:"0 5px 5px 0", width:`${idlePct}%` }} />
            </div>
            <div style={{ display:"flex", gap:16, marginTop:8, fontSize:12, color:"var(--text3)" }}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:10, height:10, borderRadius:"50%", background:"var(--gold)", display:"inline-block" }} /> {t("timeUsage.worked", { hours: data.worked_hours })}</span>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:10, height:10, borderRadius:"50%", background:"rgba(224,90,90,0.4)", display:"inline-block" }} /> {t("timeUsage.idle", { hours: data.idle_hours })}</span>
            </div>
          </div>

          {/* Revenue chart */}
          <div style={{ ...cardS, padding:20, marginBottom:16 }}>
            <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 16px" }}>{t("revenueChart.title")}</p>
            {data.revenue_by_day.some((d) => d.revenue > 0) ? (
              <div style={{ height:240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenue_by_day} margin={{ top:5, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(value) => shortDay(value, locale)} tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" minTickGap={24} />
                    <YAxis tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} tick={{ fill:"var(--text3)", fontSize:11 }} stroke="var(--border)" width={40} />
                    <Tooltip contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, color:"var(--text)", fontSize:13 }} labelFormatter={(l) => new Date(l as string).toLocaleDateString(locale)} formatter={(v) => [fmt(Number(v), currency, locale), t("revenueChart.tooltipLabel")] as [string, string]} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} dot={false} activeDot={{ r:4, fill:"var(--gold)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height:120, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <TrendingUp size={24} style={{ color:"var(--text3)", marginBottom:8 }} />
                <p style={{ color:"var(--text2)", fontSize:13 }}>{t("revenueChart.empty")}</p>
              </div>
            )}
          </div>

          {/* Two columns */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Top services */}
            <div style={{ ...cardS, padding:20 }}>
              <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 14px" }}>{t("topServices.title")}</p>
              {data.top_services.length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {data.top_services.map((s) => (
                    <div key={s.service_id}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ color:"var(--text2)", fontSize:13 }}>{s.name}</span>
                        <span style={{ color:"var(--text3)", fontSize:12 }}>× {s.count}</span>
                      </div>
                      <div style={{ height:6, background:"var(--bg)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", background:"var(--gold)", borderRadius:3, width:`${(s.count/maxServiceCount)*100}%`, opacity:0.85 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:"24px 0" }}>{tc("noData")}</p>
              )}
            </div>

            {/* Recent clients */}
            <div style={{ ...cardS, padding:20 }}>
              <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 14px" }}>{t("recentClients.title")}</p>
              {data.recent_clients.length > 0 ? (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--border)" }}>
                      {[t("recentClients.columnName"), t("recentClients.columnService"), t("recentClients.columnAmount")].map((h, i) => (
                        <th key={h} style={{ textAlign: i===2 ? "right" : "left", color:"var(--text3)", fontWeight:600, fontSize:11, paddingBottom:8, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_clients.map((c, i) => (
                      <tr key={`${c.client_id ?? "x"}-${i}`} style={{ borderBottom:"1px solid var(--border)" }}>
                        <td style={{ paddingTop:10, paddingBottom:10, paddingRight:8 }}>
                          <p style={{ color:"var(--text)", margin:0 }}>{c.name}</p>
                          <p style={{ color:"var(--text3)", fontSize:11, margin:0 }}>{new Date(c.date).toLocaleDateString(locale)}</p>
                        </td>
                        <td style={{ color:"var(--text2)", paddingRight:8 }}>{c.service_name ?? "—"}</td>
                        <td style={{ textAlign:"right", color:"var(--gold)", fontWeight:600, whiteSpace:"nowrap" }}>{fmt(c.amount_uzs, currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:"24px 0" }}>{t("recentClients.empty")}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCell({ label, value, small=false, border=false }: { label: string; value: string; small?: boolean; border?: boolean }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"16px 8px", borderLeft: border ? "1px solid var(--border)" : "none" }}>
      <p style={{ color:"var(--text)", fontWeight:700, fontSize: small ? 14 : 22, margin:0 }}>{value}</p>
      <p style={{ color:"var(--text3)", fontSize:11, margin:"4px 0 0" }}>{label}</p>
    </div>
  );
}

function ContentCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 12px", display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ color:"var(--text3)", flexShrink:0 }}>{icon}</span>
      <div style={{ minWidth:0 }}>
        <p style={{ color:"var(--text)", fontWeight:600, fontSize:13, margin:0 }}>{value.toLocaleString("ru")}</p>
        <p style={{ color:"var(--text3)", fontSize:11, margin:0 }}>{label}</p>
      </div>
    </div>
  );
}
