"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, UserX, Eye, EyeOff, Copy, Check, Search, UserCheck, X } from "lucide-react";
import api from "@/lib/api";
import { useIntlLocale } from "@/lib/locale";

interface Barber {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
  is_active: boolean;
  is_blocked: boolean;
  specializations: string[];
}

interface SearchResult {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
  specializations: string[];
  is_already_in_team: boolean;
}

interface TeamMemberStat {
  master_id: string;
  name: string;
  photo_url: string | null;
  total_revenue: number;
  total_appointments: number;
  worked_hours: number;
}

function initials(b: Barber | SearchResult) {
  const n = [b.name, b.last_name].filter(Boolean).join(" ");
  return n ? n.slice(0, 2).toUpperCase() : b.phone.slice(-2);
}

function fullName(b: Barber | SearchResult) {
  return [b.name, b.last_name].filter(Boolean).join(" ") || "—";
}

function fmtMoney(n: number, currency: string, locale: string) {
  return n.toLocaleString(locale) + " " + currency;
}

const inputStyle: React.CSSProperties = {
  width:"100%", background:"var(--bg)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"10px 14px", fontSize:13, fontFamily:"'Manrope',sans-serif",
  outline:"none",
};

type ModalTab = "create" | "search";

export default function BarbersPage() {
  const t = useTranslations("Barbers");
  const tc = useTranslations("Common");
  const locale = useIntlLocale();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<ModalTab>("create");
  const [created, setCreated] = useState<{ phone: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name:"", last_name:"", phone:"+998", password:"" });
  const [formErr, setFormErr] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  

  const { data, isLoading } = useQuery<{ items: Barber[]; total: number }>({
    queryKey: ["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const { data: teamStats } = useQuery<{ members: TeamMemberStat[] }>({
    queryKey: ["team-stats", "30d"],
    queryFn: () => api.get("/team/stats").then((r) => r.data),
  });

  const statsById = new Map((teamStats?.members ?? []).map((m) => [m.master_id, m]));

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("998") ? digits.slice(3) : digits;
    let out = "+998";
    if (local.length > 0) out += " " + local.slice(0, 2);
    if (local.length > 2) out += " " + local.slice(2, 5);
    if (local.length > 5) out += " " + local.slice(5, 7);
    if (local.length > 7) out += " " + local.slice(7, 9);
    return out;
  }

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post("/team/members", { ...body, phone: body.phone.replace(/\s/g, "") }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setCreated({ phone: form.phone, password: form.password });
      setForm({ name:"", last_name:"", phone:"+998", password:"" });
      setShowModal(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("modal.createError");
      setFormErr(msg);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
  });

  const transferMutation = useMutation({
    mutationFn: (master_id: string) => api.post("/team/transfer", { master_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setShowModal(false);
      setSearchQ(""); setSearchResults([]);
    },
  });

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/team/search", { params: { q: searchQ } });
        setSearchResults(res.data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [searchQ]);

  function copyCreated() {
    if (!created) return;
    navigator.clipboard.writeText(t("banner.clipboardText", { phone: created.phone, password: created.password }));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding:"32px 36px" }}>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:"0 0 20px" }}>
          {t("title")}
        </h1>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:220, maxWidth:360 }}>
            <Search size={16} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", pointerEvents:"none" }} />
            <input
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              style={{
                width:"100%", padding:"10px 14px 10px 38px",
                background:"var(--card)", border:"1px solid var(--border)",
                borderRadius:11, color:"var(--text)", fontSize:13.5, outline:"none",
              }}
            />
          </div>
          <button
            onClick={() => { setShowModal(true); setTab("search"); setFormErr(""); }}
            style={{
              padding:"10px 16px", border:"1px solid rgba(201,164,92,0.20)",
              background:"rgba(201,164,92,0.12)", color:"var(--gold)",
              borderRadius:11, cursor:"pointer", fontSize:12.5, fontWeight:600,
            }}
          >
            {t("invite")}
          </button>
          <div style={{ flex:1 }} />
          <button
            onClick={() => { setShowModal(true); setTab("create"); setFormErr(""); setSearchQ(""); setSearchResults([]); }}
            style={{
              display:"flex", alignItems:"center", gap:7, background:"var(--gold)", color:"#171205",
              border:"none", borderRadius:11, padding:"10px 16px",
              fontSize:13, fontWeight:700, cursor:"pointer",
            }}
          >
            <Plus size={16} /> {t("addBarber")}
          </button>
        </div>
      </div>

      {/* Credential banner */}
      {created && (
        <div style={{
          marginBottom:24, background:"rgba(76,175,125,0.08)",
          border:"1px solid rgba(76,175,125,0.2)", borderRadius:"var(--radius-lg)",
          padding:"16px 20px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16,
        }}>
          <div>
            <p style={{ color:"var(--green)", fontWeight:600, fontSize:13, margin:"0 0 8px" }}>
              {t("banner.created")}
            </p>
            <p style={{ color:"var(--text)", fontFamily:"monospace", fontSize:13, margin:"0 0 4px" }}>📱 {created.phone}</p>
            <p style={{ color:"var(--text)", fontFamily:"monospace", fontSize:13, margin:0 }}>🔑 {created.password}</p>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <button
              onClick={copyCreated}
              style={{
                display:"flex", alignItems:"center", gap:6,
                background:"rgba(76,175,125,0.15)", border:"none", borderRadius:"var(--radius)",
                color:"var(--green)", fontSize:12, fontWeight:600, padding:"6px 12px", cursor:"pointer",
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t("banner.copied") : t("banner.copy")}
            </button>
            <button
              onClick={() => setCreated(null)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:"6px" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{
              background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--radius-lg)", padding:20, animation:"pulse 1.5s infinite",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <div style={{ width:48, height:48, borderRadius:"50%", background:"var(--border)" }} />
                <div style={{ flex:1 }}>
                  <div style={{ height:13, background:"var(--border)", borderRadius:4, marginBottom:8, width:"60%" }} />
                  <div style={{ height:11, background:"var(--border)", borderRadius:4, width:"40%" }} />
                </div>
              </div>
            </div>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      )}

      {/* Empty */}
      {!isLoading && data?.items.length === 0 && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0", textAlign:"center" }}>
          <div style={{
            width:64, height:64, borderRadius:"var(--radius-lg)",
            background:"var(--surface)", border:"1px solid var(--border)",
            display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16,
          }}>
            <Plus size={28} style={{ color:"var(--text3)" }} />
          </div>
          <p style={{ color:"var(--text2)", fontSize:14 }}>{t("empty")}</p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && data && data.items.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {data.items.filter((b) => {
            if (!filterQ) return true;
            const q = filterQ.toLowerCase();
            return fullName(b).toLowerCase().includes(q) || b.phone.includes(q);
          }).map((b) => {
            const st = statsById.get(b.id);
            return (
              <Link
                key={b.id}
                href={`/barbers/${b.id}`}
                style={{
                  display:"block", textDecoration:"none",
                  background:"var(--card)", border:"1px solid var(--border)",
                  borderRadius:16, padding:20, cursor:"pointer",
                  transition:"border-color 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,164,92,0.20)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
              >
                {/* Avatar + name + status */}
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
                  <div style={{
                    width:48, height:48, flexShrink:0, borderRadius:13,
                    background:"rgba(201,164,92,0.12)", border:"1px solid rgba(201,164,92,0.20)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:700, fontSize:17, color:"var(--gold)", overflow:"hidden",
                  }}>
                    {b.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.photo_url} alt={fullName(b)} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    ) : initials(b)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16.5, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {fullName(b)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>{b.phone}</div>
                  </div>
                  <span style={{
                    fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:20, flexShrink:0,
                    background: b.is_active ? "rgba(76,175,125,0.12)" : "rgba(90,90,82,0.12)",
                    color: b.is_active ? "var(--green)" : "var(--text3)",
                    border: `1px solid ${b.is_active ? "rgba(76,175,125,0.18)" : "rgba(90,90,82,0.18)"}`,
                  }}>
                    {b.is_active ? t("status.active") : t("status.inactive")}
                  </span>
                </div>

                {/* 3-stat row */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, paddingTop:16, borderTop:"1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"var(--gold)" }}>
                      {st ? (st.total_revenue >= 1_000_000 ? (st.total_revenue / 1_000_000).toFixed(1) + "M" : fmtMoney(st.total_revenue, t("currency"), locale)) : "—"}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>{t("stats.revenue")}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600 }}>
                      {st?.total_appointments ?? "—"}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>{t("stats.appointments")}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600 }}>
                      {st ? Math.round(st.worked_hours) : "—"}{t("stats.hoursShort")}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>{t("stats.workedHours")}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:20,
        }}>
          <div style={{
            background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius-lg)", width:"100%", maxWidth:440, padding:28,
          }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <h2 style={{ color:"var(--text)", fontSize:17, fontWeight:600, margin:0 }}>{t("modal.title")}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)" }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal tabs */}
            <div style={{
              display:"flex", background:"var(--bg)", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", padding:4, marginBottom:20,
            }}>
              {(["create","search"] as ModalTab[]).map((mt) => (
                <button
                  key={mt}
                  onClick={() => setTab(mt)}
                  style={{
                    flex:1, padding:"7px 0", fontSize:13, fontWeight:600,
                    borderRadius:9, border:"none", cursor:"pointer",
                    background: tab === mt ? "var(--gold)" : "transparent",
                    color: tab === mt ? "#0a0a0b" : "var(--text2)",
                    transition:"background 0.15s, color 0.15s",
                  }}
                >
                  {mt === "create" ? t("modal.tabCreate") : t("modal.tabSearch")}
                </button>
              ))}
            </div>

            {/* Create tab */}
            {tab === "create" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {(["name","last_name"] as const).map((f) => (
                    <div key={f}>
                      <label style={{ display:"block", fontSize:12, color:"var(--text2)", marginBottom:5, fontWeight:500 }}>
                        {f === "name" ? t("modal.nameLabel") : t("modal.lastNameLabel")}
                      </label>
                      <input
                        value={form[f]}
                        onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                        placeholder={f === "name" ? t("modal.namePlaceholder") : t("modal.lastNamePlaceholder")}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, color:"var(--text2)", marginBottom:5, fontWeight:500 }}>{t("modal.phoneLabel")}</label>
                  <input
                    value={form.phone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw.startsWith("+998")) { setForm((p) => ({ ...p, phone: "+998" })); return; }
                      setForm((p) => ({ ...p, phone: formatPhone(raw) }));
                    }}
                    placeholder={t("modal.phonePlaceholder")} type="tel" style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, color:"var(--text2)", marginBottom:5, fontWeight:500 }}>{t("modal.passwordLabel")}</label>
                  <div style={{ position:"relative" }}>
                    <input
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      type={showPass ? "text" : "password"}
                      placeholder={t("modal.passwordPlaceholder")}
                      style={{ ...inputStyle, paddingRight:40 }}
                    />
                    <button
                      type="button" onClick={() => setShowPass((v) => !v)}
                      style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text2)" }}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {formErr && (
                  <div style={{ background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:"var(--radius)", padding:"9px 13px", color:"var(--red)", fontSize:13 }}>
                    {formErr}
                  </div>
                )}
                <div style={{ display:"flex", gap:10, marginTop:4 }}>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px", fontSize:13, fontWeight:500, color:"var(--text2)", cursor:"pointer" }}
                  >
                    {tc("cancel")}
                  </button>
                  <button
                    onClick={() => { setFormErr(""); createMutation.mutate(form); }}
                    disabled={createMutation.isPending || !form.phone || !form.password}
                    style={{
                      flex:1, background:"var(--gold)", color:"#0a0a0b",
                      border:"none", borderRadius:"var(--radius)", padding:"10px",
                      fontSize:13, fontWeight:700, cursor:"pointer",
                      opacity: (createMutation.isPending || !form.phone || !form.password) ? 0.5 : 1,
                    }}
                  >
                    {createMutation.isPending ? t("modal.creating") : t("modal.create")}
                  </button>
                </div>
              </div>
            )}

            {/* Search tab */}
            {tab === "search" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ position:"relative" }}>
                  <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", pointerEvents:"none" }} />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder={t("modal.searchPlaceholder")}
                    style={{ ...inputStyle, paddingLeft:36 }}
                    autoFocus
                  />
                </div>
                {searching && <p style={{ color:"var(--text2)", fontSize:13, textAlign:"center", padding:"12px 0" }}>{t("modal.searching")}</p>}
                {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
                  <p style={{ color:"var(--text2)", fontSize:13, textAlign:"center", padding:"12px 0" }}>{t("modal.noResults")}</p>
                )}
                {searchResults.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:240, overflowY:"auto" }}>
                    {searchResults.map((r) => (
                      <div key={r.id} style={{
                        display:"flex", alignItems:"center", gap:12,
                        background:"var(--bg)", border:"1px solid var(--border)",
                        borderRadius:"var(--radius)", padding:"10px 14px",
                      }}>
                        <div style={{
                          width:36, height:36, borderRadius:"50%",
                          background:"var(--gold-dim)", color:"var(--gold)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontWeight:700, fontSize:12, flexShrink:0,
                        }}>
                          {initials(r)}
                        </div>
                        <div style={{ minWidth:0, flex:1 }}>
                          <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fullName(r)}</p>
                          <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>{r.phone}</p>
                        </div>
                        {r.is_already_in_team ? (
                          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--green)", background:"rgba(76,175,125,0.1)", padding:"3px 8px", borderRadius:20, flexShrink:0 }}>
                            <UserCheck size={11} /> {t("modal.inTeam")}
                          </span>
                        ) : (
                          <button
                            onClick={() => transferMutation.mutate(r.id)}
                            disabled={transferMutation.isPending}
                            style={{
                              background:"var(--gold)", color:"#0a0a0b", border:"none",
                              borderRadius:"var(--radius)", padding:"5px 12px",
                              fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0,
                              opacity: transferMutation.isPending ? 0.5 : 1,
                            }}
                          >
                            {tc("add")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {searchQ.length < 2 && (
                  <p style={{ color:"var(--text3)", fontSize:12, textAlign:"center", padding:"16px 0" }}>{t("modal.minChars")}</p>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                    padding:"10px", fontSize:13, fontWeight:500, color:"var(--text2)", cursor:"pointer", marginTop:4,
                  }}
                >
                  {tc("close")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
