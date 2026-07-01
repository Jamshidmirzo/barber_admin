"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, ExternalLink, Upload, Trash2, Plus, X, Check, ImageIcon } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useSalon, type Salon, type SiteStyle, type SiteService, type WeekDay, type DayHours, type WorkingHours } from "@/hooks/useSalon";

const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || "hayrli.app";

const STYLES: { id: SiteStyle; label: string; hint: string }[] = [
  { id:"modern",  label:"Современный", hint:"Чисто, технологично, ярко" },
  { id:"classic", label:"Классический", hint:"Тёпло, респектабельно" },
  { id:"luxury",  label:"Премиум",      hint:"Элегантно, эксклюзивно" },
  { id:"minimal", label:"Минимализм",   hint:"Лаконично, много воздуха" },
];

const DAYS: { key: WeekDay; label: string }[] = [
  { key:"mon", label:"Понедельник" },
  { key:"tue", label:"Вторник" },
  { key:"wed", label:"Среда" },
  { key:"thu", label:"Четверг" },
  { key:"fri", label:"Пятница" },
  { key:"sat", label:"Суббота" },
  { key:"sun", label:"Воскресенье" },
];

type FullHours = Record<WeekDay, DayHours>;

function normalizeHours(wh: WorkingHours | null | undefined): FullHours {
  const out = {} as FullHours;
  for (const { key } of DAYS) {
    const d = wh?.[key];
    out[key] = { open: d?.open ?? "09:00", close: d?.close ?? "20:00", closed: d?.closed ?? false };
  }
  return out;
}

const inp: React.CSSProperties = {
  width:"100%", background:"var(--bg)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"10px 14px", fontSize:13, fontFamily:"'Manrope',sans-serif",
  outline:"none", boxSizing:"border-box",
};

function SectionBox({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
        <h2 style={{ color:"var(--text)", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", margin:0 }}>{title}</h2>
        {hint && <span style={{ color:"var(--text3)", fontSize:11 }}>{hint}</span>}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>{children}</div>
    </section>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:"block", color:"var(--text2)", fontSize:12, marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

export default function SiteSettingsPage() {
  const { salon } = useSalon();
  const qc = useQueryClient();

  const [name, setName] = useState(() => salon.name ?? "");
  const [tagline, setTagline] = useState(() => salon.tagline ?? "");
  const [description, setDescription] = useState(() => salon.description ?? "");
  const [phone, setPhone] = useState(() => salon.phone ?? "");
  const [address, setAddress] = useState(() => salon.address ?? "");
  const [style, setStyle] = useState<SiteStyle>(() => salon.site_content?.style ?? "modern");
  const [coverUrl, setCoverUrl] = useState<string | null>(() => salon.cover_url);
  const [hours, setHours] = useState<FullHours>(() => normalizeHours(salon.working_hours));
  const [services, setServices] = useState<SiteService[]>(() => salon.site_content?.services ?? []);
  const [err, setErr] = useState("");
  const [coverErr, setCoverErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const siteUrl = `https://${salon.slug}.${SITE_DOMAIN}`;

  const initial = useRef(JSON.stringify({ name: salon.name ?? "", tagline: salon.tagline ?? "", description: salon.description ?? "", phone: salon.phone ?? "", address: salon.address ?? "", hours: normalizeHours(salon.working_hours), services: salon.site_content?.services ?? [] }));
  const current = useMemo(() => JSON.stringify({ name, tagline, description, phone, address, hours, services }), [name, tagline, description, phone, address, hours, services]);
  const dirty = current !== initial.current;

  const save = useMutation({
    mutationFn: () => api.patch<Salon>(`/salons/${salon.id}`, { name:name.trim(), tagline:tagline.trim(), description:description.trim(), phone:phone.trim(), address:address.trim(), working_hours:hours, site_content:{ ...(salon.site_content ?? {}), services, style } }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["salon-context"] }); initial.current = current; setErr(""); },
    onError: (e: unknown) => setErr(parseApiError(e, "Не удалось сохранить")),
  });

  const themeMutation = useMutation({
    mutationFn: (s: SiteStyle) => api.patch<Salon>(`/salons/${salon.id}`, { site_style:s }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey:["salon-context"] }),
    onError: (e: unknown) => setErr(parseApiError(e, "Не удалось сменить тему")),
  });

  const coverUpload = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append("file", file); return api.post<Salon>(`/salons/${salon.id}/cover-image`, fd).then((r) => r.data); },
    onSuccess: (data) => { setCoverUrl(data.cover_url); setCoverErr(""); qc.invalidateQueries({ queryKey:["salon-context"] }); },
    onError: (e: unknown) => setCoverErr(parseApiError(e, "Не удалось загрузить фото")),
  });

  const coverDelete = useMutation({
    mutationFn: () => api.delete<Salon>(`/salons/${salon.id}/cover-image`).then((r) => r.data),
    onSuccess: (data) => { setCoverUrl(data.cover_url); qc.invalidateQueries({ queryKey:["salon-context"] }); },
    onError: (e: unknown) => setCoverErr(parseApiError(e, "Не удалось удалить")),
  });

  const selectStyle = (s: SiteStyle) => { if (s === style) return; setStyle(s); themeMutation.mutate(s); };
  const onPickFile = (file: File | undefined | null) => { if (!file) return; if (!file.type.startsWith("image/")) { setCoverErr("Нужен файл-изображение (jpg, png, webp)"); return; } coverUpload.mutate(file); };
  const setDay = (key: WeekDay, patch: Partial<DayHours>) => setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));
  const updateService = (i: number, patch: Partial<SiteService>) => setServices((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div style={{ padding:"32px 36px", maxWidth:720, paddingBottom:96 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:"var(--radius)", background:"var(--gold-dim)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Globe size={20} style={{ color:"var(--gold)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, color:"var(--text)", margin:0 }}>Настройки сайта</h1>
            <p style={{ color:"var(--text2)", fontSize:13, marginTop:3 }}>Редактируйте контент — он сразу обновится на сайте</p>
          </div>
        </div>
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:6, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"8px 14px", color:"var(--text2)", textDecoration:"none", fontSize:13 }}>
          <ExternalLink size={13} /> Открыть сайт
        </a>
      </div>

      {/* Основная информация */}
      <SectionBox title="Основная информация">
        <FieldLabel label="Название барбершопа">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Barber Pro" style={inp} />
        </FieldLabel>
        <FieldLabel label="Теглайн (слоган в шапке)">
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Лучшие стрижки в Ташкенте" style={inp} />
        </FieldLabel>
        <FieldLabel label="Описание">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Барбершоп в центре города…" style={{ ...inp, resize:"none" }} />
        </FieldLabel>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <FieldLabel label="Телефон">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" style={inp} />
          </FieldLabel>
          <FieldLabel label="Адрес">
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ташкент, Чиланзар" style={inp} />
          </FieldLabel>
        </div>
      </SectionBox>

      {/* Визуальный стиль */}
      <SectionBox title="Визуальный стиль" hint={themeMutation.isPending ? "Сохраняем…" : "Сохраняется сразу"}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {STYLES.map((s) => (
            <button key={s.id} type="button" onClick={() => selectStyle(s.id)} style={{
              padding:16, borderRadius:"var(--radius)", textAlign:"left", cursor:"pointer",
              border: style === s.id ? "1px solid var(--gold)" : "1px solid var(--border)",
              background: style === s.id ? "var(--gold-dim)" : "var(--bg)",
              position:"relative",
            }}>
              {style === s.id && (
                <span style={{ position:"absolute", top:8, right:8, width:18, height:18, borderRadius:"50%", background:"var(--gold)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Check size={11} style={{ color:"#0a0a0b" }} />
                </span>
              )}
              <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0, marginBottom:3 }}>{s.label}</p>
              <p style={{ color:"var(--text2)", fontSize:12, margin:0 }}>{s.hint}</p>
            </button>
          ))}
        </div>
      </SectionBox>

      {/* Фото обложки */}
      <SectionBox title="Фото обложки">
        {coverUrl ? (
          <div>
            <div style={{ overflow:"hidden", borderRadius:"var(--radius)", border:"1px solid var(--border)", marginBottom:12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Обложка" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={coverUpload.isPending} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", padding:"8px 14px", fontSize:13, cursor:"pointer", opacity: coverUpload.isPending ? 0.5 : 1 }}>
                <Upload size={13} /> {coverUpload.isPending ? "Загрузка…" : "Заменить"}
              </button>
              <button type="button" onClick={() => coverDelete.mutate()} disabled={coverDelete.isPending} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:"var(--radius)", color:"var(--red)", padding:"8px 14px", fontSize:13, cursor:"pointer", opacity: coverDelete.isPending ? 0.5 : 1 }}>
                <Trash2 size={13} /> Удалить
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onPickFile(e.dataTransfer.files?.[0]); }}
            style={{
              width:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              gap:8, padding:"40px 0", cursor:"pointer", border:"none",
              borderRadius:"var(--radius)", outline: dragOver ? "2px dashed var(--gold)" : "2px dashed var(--border)",
              background: dragOver ? "var(--gold-dim)" : "var(--bg)",
            }}
          >
            <ImageIcon size={24} style={{ color:"var(--text3)" }} />
            <p style={{ color:"var(--text2)", fontSize:13, margin:0 }}>{coverUpload.isPending ? "Загрузка…" : "Перетащите фото сюда или нажмите"}</p>
            <p style={{ color:"var(--text3)", fontSize:11, margin:0 }}>JPG, PNG, WEBP · до 10 МБ</p>
          </button>
        )}
        {coverErr && <p style={{ color:"var(--red)", fontSize:12, marginTop:8 }}>{coverErr}</p>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
      </SectionBox>

      {/* Рабочие часы */}
      <SectionBox title="Рабочие часы">
        {DAYS.map(({ key, label }) => {
          const d = hours[key];
          return (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", background:"var(--bg)", borderRadius:"var(--radius)", padding:"10px 14px" }}>
              <span style={{ color:"var(--text2)", fontSize:13, width:110, flexShrink:0 }}>{label}</span>
              <button type="button" onClick={() => setDay(key, { closed: !d.closed })} style={{
                position:"relative", width:44, height:24, borderRadius:12, cursor:"pointer", border:"none", flexShrink:0,
                background: d.closed ? "rgba(255,255,255,0.1)" : "var(--gold)",
              }}>
                <span style={{ position:"absolute", top:2, left: d.closed ? 2 : 22, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.15s" }} />
              </button>
              {d.closed ? (
                <span style={{ color:"var(--text3)", fontSize:13 }}>Выходной</span>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input type="time" value={d.open} onChange={(e) => setDay(key, { open:e.target.value })} style={{ ...inp, width:"auto", padding:"6px 10px" }} />
                  <span style={{ color:"var(--text3)" }}>—</span>
                  <input type="time" value={d.close} onChange={(e) => setDay(key, { close:e.target.value })} style={{ ...inp, width:"auto", padding:"6px 10px" }} />
                </div>
              )}
            </div>
          );
        })}
      </SectionBox>

      {/* Услуги */}
      <SectionBox title="Услуги">
        {services.length === 0 && (
          <p style={{ color:"var(--text3)", fontSize:13 }}>Пока нет услуг. Добавьте первую — она появится на сайте.</p>
        )}
        {services.map((s, i) => (
          <div key={i} style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:14 }}>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input value={s.name} onChange={(e) => updateService(i, { name:e.target.value })} placeholder="Название (Стрижка)" style={{ ...inp, flex:1 }} />
              <input value={s.price ?? ""} onChange={(e) => updateService(i, { price:e.target.value })} placeholder="Цена" style={{ ...inp, width:100 }} />
              <button type="button" onClick={() => setServices((arr) => arr.filter((_, idx) => idx !== i))} style={{ background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:"var(--radius)", color:"var(--red)", padding:"0 10px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                <X size={14} />
              </button>
            </div>
            <input value={s.description ?? ""} onChange={(e) => updateService(i, { description:e.target.value })} placeholder="Описание (необязательно)" style={inp} />
          </div>
        ))}
        <button type="button" onClick={() => setServices((arr) => [...arr, { name:"", description:"", price:"" }])} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 0", borderRadius:"var(--radius)", border:"2px dashed var(--border)", background:"transparent", color:"var(--text2)", fontSize:13, cursor:"pointer" }}>
          <Plus size={14} /> Добавить услугу
        </button>
      </SectionBox>

      {/* Save bar */}
      <div style={{ position:"fixed", inset:"auto 0 0 0", zIndex:10, borderTop:"1px solid var(--border)", background:"var(--bg2)", padding:"12px 24px 12px calc(var(--sidebar-w) + 24px)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <p style={{ fontSize:13, color: err ? "var(--red)" : dirty ? "var(--text2)" : "var(--text3)", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {err || (dirty ? "Есть несохранённые изменения" : "Все изменения сохранены")}
        </p>
        <button type="button" onClick={() => save.mutate()} disabled={!dirty || save.isPending || name.trim().length < 2} style={{ display:"flex", alignItems:"center", gap:6, background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"9px 20px", fontSize:13, fontWeight:700, cursor:(!dirty || save.isPending || name.trim().length < 2) ? "not-allowed" : "pointer", opacity:(!dirty || name.trim().length < 2) ? 0.5 : 1, flexShrink:0 }}>
          <Check size={13} /> {save.isPending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
