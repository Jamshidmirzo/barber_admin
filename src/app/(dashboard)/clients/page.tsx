"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserRound, Download, ChevronRight, Trophy, Share2, Check, X } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";

interface City { id: string; slug: string; name: string; sort_order: number; }

function fmtMoney(n: number) { return n.toLocaleString("ru") + " сум"; }
function fmtDate(iso: string | null) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("ru", { day:"numeric", month:"short", year:"numeric" }); }
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

const inp: React.CSSProperties = {
  background:"var(--bg)", color:"var(--text)", border:"1px solid var(--border)",
  borderRadius:"var(--radius)", padding:"9px 14px", fontSize:13, outline:"none",
  fontFamily:"'Manrope',sans-serif",
};

export default function ClientsPage() {
  const { salon, role } = useSalon();
  if (!isManager(role)) return <PersonalClients />;
  return <CrmClients salonId={salon.id} salonName={salon.name} />;
}

// ─── CRM View (manager) ───────────────────────────────────────────────────────

interface SalonClient {
  id: string; name: string; phone: string; city_id: string | null; city_name: string | null;
  total_visits: number; total_spent: number; last_visit_date: string | null; loyalty: "gold" | "silver" | null;
}
interface ClientPage { items: SalonClient[]; total: number; page: number; limit: number; }
interface LoyaltyItem { rank: number; client_id: string; name: string; phone: string; total_visits: number; total_spent: number; }
type Sort = "visits" | "revenue" | "last_visit";
type Tab = "list" | "rating";
const SORT_LABELS: Record<Sort, string> = { visits:"По визитам", revenue:"По выручке", last_visit:"По дате" };

function TierBadge({ tier }: { tier: SalonClient["loyalty"] }) {
  if (tier === "gold") {
    return (
      <span style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        padding: "2px 7px",
        borderRadius: 20,
        background: "rgba(201,164,92,0.13)",
        color: "var(--gold)",
        border: "1px solid rgba(201,164,92,0.32)",
        textTransform: "uppercase" as const,
        lineHeight: 1,
      }}>
        GOLD
      </span>
    );
  }
  if (tier === "silver") {
    return (
      <span style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        padding: "2px 7px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.06)",
        color: "var(--text2)",
        border: "1px solid rgba(255,255,255,0.12)",
        textTransform: "uppercase" as const,
        lineHeight: 1,
      }}>
        SILVER
      </span>
    );
  }
  return null;
}

function CrmClients({ salonId, salonName }: { salonId: string; salonName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("list");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cityId, setCityId] = useState("");
  const [sort, setSort] = useState<Sort>("visits");
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const { data: cities } = useQuery<City[]>({ queryKey:["cities"], queryFn: () => api.get("/cities").then((r) => r.data), staleTime:30*60_000 });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<ClientPage>({
    queryKey:["salon-clients", salonId, debounced, cityId, sort],
    queryFn: ({ pageParam }) => api.get(`/salons/${salonId}/clients`, { params:{ search:debounced||undefined, city_id:cityId||undefined, sort, page:pageParam, limit:20 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => { const loaded = pages.reduce((n,p)=>n+p.items.length,0); return loaded < last.total ? last.page+1 : undefined; },
    enabled: tab === "list",
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const { data: loyalty, isLoading: loyaltyLoading } = useQuery<{ items: LoyaltyItem[] }>({
    queryKey:["salon-clients-loyalty", salonId],
    queryFn: () => api.get(`/salons/${salonId}/clients/loyalty`, { params:{ limit:20 } }).then((r) => r.data),
    enabled: tab === "rating",
  });

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get(`/salons/${salonId}/clients/export`, { params:{ search:debounced||undefined, city_id:cityId||undefined, sort }, responseType:"blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a"); a.href = url; a.download = `clients_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { /**/ } finally { setExporting(false); }
  }

  function shareRating() {
    const list = loyalty?.items ?? [];
    if (!list.length) return;
    const medals = ["🥇","🥈","🥉"];
    const lines = list.slice(0,10).map((c,i)=>`${medals[i]??`${c.rank}.`} ${c.name} — ${c.total_visits} визит${plural(c.total_visits,"","а","ов")}`).join("\n");
    const text = `🏆 Самые лояльные клиенты ${salonName}:\n\n${lines}\n\nСпасибо, что выбираете нас! 💈`;
    navigator.clipboard.writeText(text).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };

  return (
    <div style={{ padding:"32px 36px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>Клиенты</h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>{total} клиентов в базе салона</p>
        </div>
        <button onClick={handleExport} disabled={exporting} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", padding:"9px 16px", fontSize:13, fontWeight:500, cursor:exporting ? "not-allowed" : "pointer", opacity:exporting ? 0.6 : 1 }}>
          <Download size={14} /> {exporting ? "Готовим..." : "Экспорт CSV"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:4, gap:4, width:"fit-content", marginBottom:20 }}>
        {(["list","rating"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, background: tab===t ? "var(--gold)" : "transparent", color: tab===t ? "#0a0a0b" : "var(--text2)" }}>
            {t === "rating" && <Trophy size={13} />}
            {t === "list" ? "Все клиенты" : "Рейтинг лояльности"}
          </button>
        ))}
      </div>

      {tab === "list" ? (
        <>
          {/* Filters */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:1, minWidth:200 }}>
              <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", pointerEvents:"none" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени или телефону" style={{ ...inp, width:"100%", paddingLeft:36, boxSizing:"border-box" }} />
            </div>
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={{ ...inp, minWidth:140 }}>
              <option value="">Все города</option>
              {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ ...inp, minWidth:150 }}>
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
            </select>
          </div>

          {/* Table */}
          {isLoading ? (
            <CrmSkeleton />
          ) : items.length === 0 ? (
            <EmptyState text={debounced || cityId ? "Ничего не найдено" : "Нет клиентов"} />
          ) : (
            <div style={cardS}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--border)" }}>
                    {["Имя","Телефон","Город","Визиты","Выручка","Последний",""].map((h, i) => (
                      <th key={h} style={{ textAlign: i >= 3 ? "right" : "left", color:"var(--text3)", fontWeight:600, fontSize:11, padding:"10px 16px", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)} style={{ borderBottom:"1px solid var(--border)", cursor:"pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:"50%", background:"var(--gold-dim)", color:"var(--gold)", fontWeight:700, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{initials(c.name)}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ color:"var(--text)", fontWeight:500 }}>{c.name}</span>
                            <TierBadge tier={c.loyalty} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px", color:"var(--text2)" }}>{c.phone}</td>
                      <td style={{ padding:"12px 16px", color:"var(--text2)" }}>{c.city_name ?? "—"}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", color:"var(--text)", fontWeight:600 }}>{c.total_visits}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", color:"var(--text2)" }}>{fmtMoney(c.total_spent)}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", color:"var(--text3)" }}>{fmtDate(c.last_visit_date)}</td>
                      <td style={{ padding:"12px 8px" }}><ChevronRight size={14} style={{ color:"var(--text3)" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasNextPage && (
            <div style={{ display:"flex", justifyContent:"center", marginTop:20 }}>
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", padding:"9px 24px", fontSize:13, cursor:isFetchingNextPage ? "not-allowed" : "pointer", opacity:isFetchingNextPage ? 0.6 : 1 }}>
                {isFetchingNextPage ? "Загрузка..." : "Показать ещё"}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <p style={{ color:"var(--text2)", fontSize:13 }}>Топ-20 клиентов по количеству визитов</p>
            <button onClick={shareRating} disabled={(loyalty?.items.length ?? 0) === 0} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", padding:"7px 14px", fontSize:13, cursor:"pointer", opacity:(loyalty?.items.length ?? 0) === 0 ? 0.4 : 1 }}>
              {copied ? <Check size={13} style={{ color:"var(--green)" }} /> : <Share2 size={13} />}
              {copied ? "Скопировано" : "Поделиться"}
            </button>
          </div>
          {loyaltyLoading ? <CrmSkeleton /> : (loyalty?.items.length ?? 0) === 0 ? <EmptyState text="Пока нет визитов для рейтинга" /> : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {loyalty!.items.map((c) => (
                <div key={c.client_id} onClick={() => router.push(`/clients/${c.client_id}`)} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:14, display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold-dim2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, background: c.rank === 1 ? "var(--gold)" : c.rank <= 3 ? "var(--gold-dim)" : "var(--bg)", color: c.rank === 1 ? "#0a0a0b" : c.rank <= 3 ? "var(--gold)" : "var(--text3)" }}>
                    {c.rank <= 3 ? ["🥇","🥈","🥉"][c.rank-1] : c.rank}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:"var(--text)", fontWeight:500, fontSize:14, margin:0 }}>{c.name}</p>
                    <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>{c.phone}</p>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <p style={{ color:"var(--text)", fontWeight:600, fontSize:14, margin:0 }}>{c.total_visits} визит{plural(c.total_visits,"","а","ов")}</p>
                    <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>{fmtMoney(c.total_spent)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CrmSkeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {[1,2,3,4,5].map((i) => <div key={i} style={{ height:60, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", animation:"pulse 1.5s infinite" }} />)}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0", textAlign:"center" }}>
      <div style={{ width:56, height:56, borderRadius:"var(--radius-lg)", background:"var(--surface)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
        <UserRound size={24} style={{ color:"var(--text3)" }} />
      </div>
      <p style={{ color:"var(--text2)", fontSize:14 }}>{text}</p>
    </div>
  );
}

// ─── Personal View (master) ───────────────────────────────────────────────────

interface Client {
  id: string; name: string; phone: string; notes: string | null;
  visit_count: number; last_visit_at: string | null; created_at: string;
}

function PersonalClients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name:"", phone:"", notes:"" });
  const [formErr, setFormErr] = useState("");

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 250); return () => clearTimeout(t); }, [search]);

  const { data, isLoading } = useQuery<{ items: Client[]; total: number }>({
    queryKey:["clients", debounced],
    queryFn: () => api.get("/clients", { params:{ search:debounced||undefined, limit:100, offset:0 } }).then((r) => r.data),
  });

  const createM = useMutation({
    mutationFn: (body: { name: string; phone: string; notes?: string }) => api.post("/clients", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["clients"] }); setShowCreate(false); resetForm(); },
    onError: (e: unknown) => setFormErr(parseApiError(e)),
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; phone?: string; notes?: string } }) => api.put(`/clients/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["clients"] }); setEditing(null); },
    onError: (e: unknown) => setFormErr(parseApiError(e)),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["clients"] }); setEditing(null); },
  });

  function resetForm() { setForm({ name:"", phone:"", notes:"" }); setFormErr(""); }
  function openEdit(c: Client) { setEditing(c); setForm({ name:c.name, phone:c.phone, notes:c.notes ?? "" }); setFormErr(""); }

  const items = data?.items ?? [];

  return (
    <div style={{ padding:"32px 36px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:0 }}>Клиенты</h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>{data?.total ?? 0} клиентов</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetForm(); }} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      <div style={{ position:"relative", marginBottom:16 }}>
        <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", pointerEvents:"none" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени или телефону" style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"9px 14px 9px 36px", fontSize:13, color:"var(--text)", outline:"none", boxSizing:"border-box" }} />
      </div>

      {isLoading && <CrmSkeleton />}
      {!isLoading && items.length === 0 && <EmptyState text={debounced ? "Ничего не найдено" : "Нет клиентов"} />}
      {!isLoading && items.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {items.map((c) => (
            <div key={c.id} onClick={() => openEdit(c)} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:14, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold-dim2)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--gold-dim)", color:"var(--gold)", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{initials(c.name)}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ color:"var(--text)", fontWeight:500, fontSize:13, margin:0 }}>{c.name}</p>
                <p style={{ color:"var(--text2)", fontSize:12, margin:0 }}>{c.phone}</p>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <p style={{ color:"var(--text2)", fontSize:13, margin:0 }}>{c.visit_count} визит{plural(c.visit_count,"","а","ов")}</p>
                <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>{fmtDate(c.last_visit_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ModalBox title="Новый клиент" onClose={() => setShowCreate(false)}>
          <ClientForm form={form} setForm={setForm} formErr={formErr} onSubmit={() => { setFormErr(""); createM.mutate({ name:form.name, phone:form.phone, notes:form.notes||undefined }); }} onCancel={() => setShowCreate(false)} loading={createM.isPending} submitLabel="Создать" />
        </ModalBox>
      )}

      {editing && (
        <ModalBox title="Редактировать клиента" onClose={() => setEditing(null)}>
          <ClientForm form={form} setForm={setForm} formErr={formErr} onSubmit={() => { setFormErr(""); updateM.mutate({ id:editing.id, body:{ name:form.name, phone:form.phone, notes:form.notes||undefined } }); }} onCancel={() => setEditing(null)} loading={updateM.isPending} submitLabel="Сохранить" />
          <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)" }}>
            <button onClick={() => { if (confirm(`Удалить клиента "${editing.name}"?`)) deleteM.mutate(editing.id); }} disabled={deleteM.isPending} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", color:"var(--red)", fontSize:13, padding:"8px 0", opacity:deleteM.isPending ? 0.5 : 1 }}>
              {deleteM.isPending ? "Удаляем..." : "Удалить клиента"}
            </button>
          </div>
        </ModalBox>
      )}
    </div>
  );
}

function ModalBox({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", width:"100%", maxWidth:420, padding:24 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ color:"var(--text)", fontWeight:600, fontSize:16, margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fldInp: React.CSSProperties = { width:"100%", background:"var(--bg)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"9px 14px", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"'Manrope',sans-serif" };

function ClientForm({ form, setForm, formErr, onSubmit, onCancel, loading, submitLabel }: {
  form: { name: string; phone: string; notes: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; notes: string }>>;
  formErr: string; onSubmit: () => void; onCancel: () => void; loading: boolean; submitLabel: string;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {(["name","phone"] as const).map((field) => (
        <div key={field}>
          <label style={{ display:"block", fontSize:11, color:"var(--text2)", marginBottom:6 }}>{field === "name" ? "Имя" : "Телефон"}</label>
          <input value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]:e.target.value }))} placeholder={field === "name" ? "Иван Иванов" : "+998901234567"} style={fldInp} />
        </div>
      ))}
      <div>
        <label style={{ display:"block", fontSize:11, color:"var(--text2)", marginBottom:6 }}>Заметки</label>
        <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes:e.target.value }))} placeholder="Необязательно" rows={2} style={{ ...fldInp, resize:"none" }} />
      </div>
      {formErr && <p style={{ color:"var(--red)", fontSize:12, background:"rgba(224,90,90,0.08)", borderRadius:"var(--radius)", padding:"8px 12px", margin:0 }}>{formErr}</p>}
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onCancel} style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:13, padding:"9px", cursor:"pointer" }}>Отмена</button>
        <button onClick={onSubmit} disabled={loading || !form.name || !form.phone} style={{ flex:1, background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:700, padding:"9px", cursor:(loading || !form.name || !form.phone) ? "not-allowed" : "pointer", opacity:(loading || !form.name || !form.phone) ? 0.5 : 1 }}>
          {loading ? "..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
