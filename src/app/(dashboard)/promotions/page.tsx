"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Trash2, Copy, Check, X, ToggleLeft, ToggleRight, Search, Info } from "lucide-react";
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

const ERROR_LABELS: Record<string, string> = {
  not_found:"Промокод не найден", inactive:"Промокод отключён",
  expired:"Срок действия истёк", max_uses:"Лимит использований исчерпан",
};

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
    if (!code) return setFormErr("Введите код");
    const pct = parseInt(form.discount_pct);
    if (isNaN(pct) || pct < 1 || pct > 100) return setFormErr("Скидка от 1 до 100%");
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
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>Мои промокоды</h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>Клиенты вводят код при записи — получают скидку</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          <Plus size={14} /> Создать
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...cardS, padding:20, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ color:"var(--text)", fontWeight:600, fontSize:14 }}>Новый промокод</span>
            <button onClick={() => setShowForm(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>Код (A-Z, 0-9)</label>
              <input style={{ ...inp, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"monospace" }} placeholder="SUMMER20" value={form.code} onChange={(e) => setForm({ ...form, code:e.target.value.toUpperCase() })} maxLength={20} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>Скидка %</label>
              <input style={inp} type="number" min={1} max={100} placeholder="10" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct:e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>Макс. использований <span style={{ color:"var(--text3)" }}>(пусто = без лимита)</span></label>
              <input style={inp} type="number" min={1} placeholder="50" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses:e.target.value })} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>Действует до <span style={{ color:"var(--text3)" }}>(пусто = бессрочно)</span></label>
              <input style={inp} type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at:e.target.value })} />
            </div>
          </div>
          {formErr && <p style={{ color:"var(--red)", fontSize:12, marginTop:10 }}>{formErr}</p>}
          <button onClick={handleCreate} disabled={create.isPending} style={{ marginTop:14, width:"100%", background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"10px", fontSize:13, fontWeight:700, cursor:create.isPending ? "not-allowed" : "pointer", opacity:create.isPending ? 0.6 : 1 }}>
            {create.isPending ? "Создание…" : "Создать промокод"}
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
          <p style={{ color:"var(--text2)", fontSize:14 }}>Нет промокодов — создайте первый</p>
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
                  {!p.is_active && <span style={{ fontSize:10, background:"var(--border)", color:"var(--text3)", padding:"2px 7px", borderRadius:10 }}>Отключён</span>}
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12 }}>
                  <span style={{ color:"var(--gold)", fontWeight:600 }}>−{p.discount_pct}%</span>
                  <span style={{ color:"var(--text2)" }}>Использований: {p.current_uses}{p.max_uses ? ` / ${p.max_uses}` : ""}</span>
                  {p.expires_at ? <span style={{ color:"var(--text2)" }}>До {fmtDate(p.expires_at)}</span> : <span style={{ color:"var(--text3)" }}>Бессрочный</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                <button onClick={() => toggle.mutate({ id:p.id, is_active:!p.is_active })} title={p.is_active ? "Отключить" : "Включить"} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:0 }}>
                  {p.is_active ? <ToggleRight size={22} style={{ color:"var(--gold)" }} /> : <ToggleLeft size={22} style={{ color:"var(--text3)" }} />}
                </button>
                <button onClick={() => { if (confirm(`Удалить промокод ${p.code}?`)) remove.mutate(p.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex", padding:0 }}>
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
          Клиент вводит код при записи через приложение. Скидка применяется к цене услуги. Каждый промокод привязан к вам — клиент указывает и код, и вашего мастера.
        </p>
      </div>
    </div>
  );
}

// ── Owner View ─────────────────────────────────────────────────────────────────

function OwnerView() {
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);

  const { data: team } = useQuery<{ items: TeamMember[]; total: number }>({
    queryKey:["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const members = team?.items ?? [];

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
      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:"0 0 6px" }}>Акции и промокоды</h1>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:28 }}>Каждый мастер управляет своими промокодами самостоятельно</p>

      {/* Team */}
      <div style={{ marginBottom:24 }}>
        <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:"0 0 12px" }}>Команда</p>
        {!members.length ? (
          <p style={{ color:"var(--text3)", fontSize:13 }}>Нет мастеров в команде</p>
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
                <span style={{ fontSize:11, background:"var(--bg)", border:"1px solid var(--border)", color:"var(--text3)", padding:"3px 10px", borderRadius:20 }}>управляет сам</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validate tool */}
      <div style={{ ...cardS, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <Search size={14} style={{ color:"var(--gold)" }} />
          <span style={{ color:"var(--text)", fontWeight:600, fontSize:14 }}>Проверить промокод</span>
        </div>
        <p style={{ color:"var(--text2)", fontSize:12, margin:"0 0 16px" }}>Убедитесь, что промокод активен перед тем как применить скидку вручную</p>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>Мастер</label>
            <select style={{ ...inp }} value={selectedMasterId} onChange={(e) => { setSelectedMasterId(e.target.value); setValidateResult(null); }}>
              <option value="">Выберите мастера…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:"var(--text2)", display:"block", marginBottom:6 }}>Промокод</label>
            <input style={{ ...inp, textTransform:"uppercase", fontFamily:"monospace", letterSpacing:"0.1em" }} placeholder="SUMMER20" value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setValidateResult(null); }} onKeyDown={(e) => e.key === "Enter" && handleValidate()} maxLength={20} />
          </div>
          <button onClick={handleValidate} disabled={!selectedMasterId || !codeInput.trim() || validating} style={{ background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"10px", fontSize:13, fontWeight:700, cursor:(!selectedMasterId || !codeInput.trim() || validating) ? "not-allowed" : "pointer", opacity:(!selectedMasterId || !codeInput.trim()) ? 0.5 : 1 }}>
            {validating ? "Проверяем…" : "Проверить"}
          </button>
        </div>

        {validateResult && (
          <div style={{ marginTop:14, padding:14, borderRadius:"var(--radius)", display:"flex", alignItems:"flex-start", gap:10, background: validateResult.valid ? "rgba(76,175,125,0.08)" : "rgba(224,90,90,0.08)", border: `1px solid ${validateResult.valid ? "rgba(76,175,125,0.2)" : "rgba(224,90,90,0.2)"}` }}>
            {validateResult.valid ? <Check size={16} style={{ color:"var(--green)", flexShrink:0, marginTop:1 }} /> : <X size={16} style={{ color:"var(--red)", flexShrink:0, marginTop:1 }} />}
            <div>
              <p style={{ color: validateResult.valid ? "var(--green)" : "var(--red)", fontWeight:600, fontSize:13, margin:0 }}>
                {validateResult.valid ? "Промокод действителен" : "Промокод недействителен"}
              </p>
              <p style={{ color:"var(--text2)", fontSize:12, margin:"3px 0 0" }}>
                {validateResult.valid ? `Скидка: ${validateResult.discount_pct}%` : (ERROR_LABELS[validateResult.error ?? ""] ?? "Неизвестная ошибка")}
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:16, display:"flex", gap:10, background:"var(--gold-dim)", border:"1px solid var(--gold-dim2)", borderRadius:"var(--radius)", padding:14 }}>
        <Info size={14} style={{ color:"var(--gold)", flexShrink:0, marginTop:1 }} />
        <p style={{ color:"var(--text2)", fontSize:12, margin:0, lineHeight:1.6 }}>
          Мастера создают промокоды в разделе «Акции» своего аккаунта. Клиент вводит код при онлайн-записи — скидка применяется автоматически.
        </p>
      </div>
    </div>
  );
}
