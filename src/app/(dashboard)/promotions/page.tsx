"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Trash2, Copy, Check, X, ToggleLeft, ToggleRight, Search, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import api, { parseApiError } from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";

interface Promocode {
  id: string;
  code: string;
  discount_pct: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ValidateResult {
  valid: boolean;
  discount_pct: number | null;
  promocode_id: string | null;
  error: string | null;
}

interface TeamMember {
  id: string;
  name: string | null;
  last_name: string | null;
  phone: string;
  photo_url: string | null;
  is_active: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru", { day:"numeric", month:"short", year:"numeric" });
}

function fullName(m: Pick<TeamMember, "name" | "last_name" | "phone">) {
  return [m.name, m.last_name].filter(Boolean).join(" ") || m.phone;
}

function initials(m: Pick<TeamMember, "name" | "last_name" | "phone">) {
  return fullName(m).slice(0, 2).toUpperCase();
}

const inp: React.CSSProperties = {
  width:"100%", background:"var(--bg)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"10px 14px", fontSize:13, fontFamily:"'Manrope',sans-serif",
  outline:"none", boxSizing:"border-box",
};

export default function PromotionsPage() {
  const { role } = useSalon();
  if (isManager(role)) return <OwnerView />;
  return <MasterView />;
}

// ── Master View ────────────────────────────────────────────────────────────────

function MasterView() {
  const t = useTranslations("Promotions");
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ code:"", discount_pct:"10", max_uses:"", expires_at:"" });
  const [formErr, setFormErr] = useState("");

  const { data: codes, isLoading } = useQuery<Promocode[]>({
    queryKey:["promocodes"],
    queryFn: () => api.get("/promocodes").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: { code: string; discount_pct: number; max_uses?: number; expires_at?: string }) =>
      api.post<Promocode>("/promocodes", body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["promocodes"] }); setShowForm(false); setForm({ code:"", discount_pct:"10", max_uses:"", expires_at:"" }); setFormErr(""); },
    onError: (e) => setFormErr(parseApiError(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch<Promocode>(`/promocodes/${id}`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey:["promocodes"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/promocodes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey:["promocodes"] }),
  });

  function handleCreate() {
    setFormErr("");
    const code = form.code.toUpperCase().trim();
    if (!code) return setFormErr(t("master.errors.codeRequired"));
    const pct = parseInt(form.discount_pct);
    if (isNaN(pct) || pct < 1 || pct > 100) return setFormErr(t("master.errors.discountRange"));
    const body: Parameters<typeof create.mutate>[0] = { code, discount_pct: pct };
    if (form.max_uses) body.max_uses = parseInt(form.max_uses);
    if (form.expires_at) body.expires_at = new Date(form.expires_at).toISOString();
    create.mutate(body);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };

  return (
    <div style={{ padding:"32px 36px", maxWidth:680 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>{t("master.title")}</h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>{t("master.subtitle")}</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          <Plus size={14} /> {t("master.createButton")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...cardS, padding:20, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ color:"var(--text)", fontWeight:600, fontSize:14 }}>{t("master.form.title")}</span>
            <button onClick={() => setShowForm(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>{t("master.form.codeLabel")}</label>
              <input style={{ ...inp, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"monospace" }} placeholder={t("codePlaceholder")} value={form.code} onChange={(e) => setForm({ ...form, code:e.target.value.toUpperCase() })} maxLength={20} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>{t("master.form.discountLabel")}</label>
              <input style={inp} type="number" min={1} max={100} placeholder="10" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct:e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>{t("master.form.maxUsesLabel")} <span style={{ color:"var(--text3)" }}>{t("master.form.maxUsesHint")}</span></label>
              <input style={inp} type="number" min={1} placeholder="50" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses:e.target.value })} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>{t("master.form.expiresLabel")} <span style={{ color:"var(--text3)" }}>{t("master.form.expiresHint")}</span></label>
              <input style={inp} type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at:e.target.value })} />
            </div>
          </div>
          {formErr && <p style={{ color:"var(--red)", fontSize:12, marginTop:10 }}>{formErr}</p>}
          <button onClick={handleCreate} disabled={create.isPending} style={{ marginTop:14, width:"100%", background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"10px", fontSize:13, fontWeight:700, cursor:create.isPending ? "not-allowed" : "pointer", opacity:create.isPending ? 0.6 : 1 }}>
            {create.isPending ? t("master.form.submitting") : t("master.form.submit")}
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2].map((i) => <div key={i} style={{ ...cardS, padding:20, height:76, animation:"pulse 1.5s infinite" }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      ) : !codes?.length ? (
        <div style={{ ...cardS, padding:"48px 0", textAlign:"center" }}>
          <Tag size={28} style={{ color:"var(--text3)", display:"block", margin:"0 auto 10px" }} />
          <p style={{ color:"var(--text2)", fontSize:14 }}>{t("master.empty")}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {codes.map((p) => (
            <div key={p.id} style={{ ...cardS, padding:16, display:"flex", alignItems:"center", gap:14, opacity: p.is_active ? 1 : 0.55 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--text)", letterSpacing:"0.12em", fontSize:15 }}>{p.code}</span>
                  <button onClick={() => copyCode(p.code)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex", padding:0 }}>
                    {copied === p.code ? <Check size={13} style={{ color:"var(--green)" }} /> : <Copy size={13} />}
                  </button>
                  {!p.is_active && <span style={{ fontSize:10, background:"var(--border)", color:"var(--text3)", padding:"2px 7px", borderRadius:10 }}>{t("master.disabledBadge")}</span>}
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12 }}>
                  <span style={{ color:"var(--gold)", fontWeight:600 }}>−{p.discount_pct}%</span>
                  <span style={{ color:"var(--text2)" }}>{p.max_uses ? t("master.usesWithMax", { current:p.current_uses, max:p.max_uses }) : t("master.usesNoMax", { current:p.current_uses })}</span>
                  {p.expires_at ? <span style={{ color:"var(--text2)" }}>{t("master.untilDate", { date:fmtDate(p.expires_at) })}</span> : <span style={{ color:"var(--text3)" }}>{t("master.unlimited")}</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                <button onClick={() => toggle.mutate({ id:p.id, is_active:!p.is_active })} title={p.is_active ? t("master.disableTooltip") : t("master.enableTooltip")} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:0 }}>
                  {p.is_active ? <ToggleRight size={22} style={{ color:"var(--gold)" }} /> : <ToggleLeft size={22} style={{ color:"var(--text3)" }} />}
                </button>
                <button onClick={() => { if (confirm(t("master.deleteConfirm", { code:p.code }))) remove.mutate(p.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex", padding:0 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:24, display:"flex", gap:10, background:"var(--gold-dim)", border:"1px solid var(--gold-dim2)", borderRadius:"var(--radius)", padding:14 }}>
        <Info size={14} style={{ color:"var(--gold)", flexShrink:0, marginTop:1 }} />
        <p style={{ color:"var(--text2)", fontSize:12, margin:0, lineHeight:1.6 }}>
          {t("master.infoBox")}
        </p>
      </div>
    </div>
  );
}

// ── Owner View ─────────────────────────────────────────────────────────────────

function OwnerView() {
  const t = useTranslations("Promotions");
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);

  const { data: team } = useQuery<{ items: TeamMember[]; total: number }>({
    queryKey:["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const members = team?.items ?? [];

  const errorLabels: Record<string, string> = {
    not_found: t("owner.errors.not_found"),
    inactive: t("owner.errors.inactive"),
    expired: t("owner.errors.expired"),
    max_uses: t("owner.errors.max_uses"),
  };

  async function handleValidate() {
    if (!selectedMasterId || !codeInput.trim()) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const r = await api.post<ValidateResult>("/promocodes/validate", { master_id:selectedMasterId, code:codeInput.toUpperCase().trim() });
      setValidateResult(r.data);
    } catch {
      setValidateResult({ valid:false, discount_pct:null, promocode_id:null, error:"not_found" });
    } finally {
      setValidating(false);
    }
  }

  const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };

  return (
    <div style={{ padding:"32px 36px", maxWidth:680 }}>
      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:"0 0 6px" }}>{t("owner.title")}</h1>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:28 }}>{t("owner.subtitle")}</p>

      {/* Team */}
      <div style={{ marginBottom:24 }}>
        <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 12px" }}>{t("owner.teamTitle")}</p>
        {!members.length ? (
          <p style={{ color:"var(--text3)", fontSize:13 }}>{t("owner.noMasters")}</p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {members.map((m) => (
              <div key={m.id} style={{ ...cardS, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--gold-dim)", color:"var(--gold)", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={fullName(m)} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  ) : initials(m)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:"var(--text)", fontSize:13, fontWeight:500, margin:0 }}>{fullName(m)}</p>
                  <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>{m.phone}</p>
                </div>
                <span style={{ fontSize:11, background:"var(--bg)", border:"1px solid var(--border)", color:"var(--text3)", padding:"3px 10px", borderRadius:20 }}>{t("owner.selfManaged")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validate tool */}
      <div style={{ ...cardS, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <Search size={14} style={{ color:"var(--gold)" }} />
          <span style={{ color:"var(--text)", fontWeight:600, fontSize:14 }}>{t("owner.validate.title")}</span>
        </div>
        <p style={{ color:"var(--text2)", fontSize:12, margin:"0 0 16px" }}>{t("owner.validate.subtitle")}</p>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>{t("owner.validate.masterLabel")}</label>
            <select style={{ ...inp }} value={selectedMasterId} onChange={(e) => { setSelectedMasterId(e.target.value); setValidateResult(null); }}>
              <option value="">{t("owner.validate.masterPlaceholder")}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>{t("owner.validate.codeLabel")}</label>
            <input style={{ ...inp, textTransform:"uppercase", fontFamily:"monospace", letterSpacing:"0.1em" }} placeholder={t("codePlaceholder")} value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setValidateResult(null); }} onKeyDown={(e) => e.key === "Enter" && handleValidate()} maxLength={20} />
          </div>
          <button onClick={handleValidate} disabled={!selectedMasterId || !codeInput.trim() || validating} style={{ background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"10px", fontSize:13, fontWeight:700, cursor:(!selectedMasterId || !codeInput.trim() || validating) ? "not-allowed" : "pointer", opacity:(!selectedMasterId || !codeInput.trim()) ? 0.5 : 1 }}>
            {validating ? t("owner.validate.submitting") : t("owner.validate.submit")}
          </button>
        </div>

        {validateResult && (
          <div style={{ marginTop:14, padding:14, borderRadius:"var(--radius)", display:"flex", alignItems:"flex-start", gap:10, background: validateResult.valid ? "rgba(76,175,125,0.08)" : "rgba(224,90,90,0.08)", border: `1px solid ${validateResult.valid ? "rgba(76,175,125,0.2)" : "rgba(224,90,90,0.2)"}` }}>
            {validateResult.valid ? <Check size={16} style={{ color:"var(--green)", flexShrink:0, marginTop:1 }} /> : <X size={16} style={{ color:"var(--red)", flexShrink:0, marginTop:1 }} />}
            <div>
              <p style={{ color: validateResult.valid ? "var(--green)" : "var(--red)", fontWeight:600, fontSize:13, margin:0 }}>
                {validateResult.valid ? t("owner.validate.resultValid") : t("owner.validate.resultInvalid")}
              </p>
              <p style={{ color:"var(--text2)", fontSize:12, margin:"3px 0 0" }}>
                {validateResult.valid
                  ? t("owner.validate.discountResult", { pct:validateResult.discount_pct ?? 0 })
                  : (errorLabels[validateResult.error ?? ""] ?? t("owner.errors.unknown"))}
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:16, display:"flex", gap:10, background:"var(--gold-dim)", border:"1px solid var(--gold-dim2)", borderRadius:"var(--radius)", padding:14 }}>
        <Info size={14} style={{ color:"var(--gold)", flexShrink:0, marginTop:1 }} />
        <p style={{ color:"var(--text2)", fontSize:12, margin:0, lineHeight:1.6 }}>
          {t("owner.infoBox")}
        </p>
      </div>
    </div>
  );
}
