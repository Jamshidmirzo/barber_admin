"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Check, ExternalLink, Plus, X, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

type Style = "modern" | "classic" | "luxury" | "minimal";

interface SiteService { name: string; description: string; }
interface SiteContent {
  heading?: string; subheading?: string; about?: string;
  services?: SiteService[]; cta?: { title?: string; button?: string }; style?: Style;
}
interface GenerateResponse {
  site_url: string; tagline: string | null;
  description: string | null; site_content: SiteContent;
}

const STYLES: { id: Style; label: string; hint: string }[] = [
  { id:"modern",  label:"Современный", hint:"Чисто, технологично, ярко" },
  { id:"classic", label:"Классический", hint:"Тёпло, респектабельно" },
  { id:"luxury",  label:"Премиум",      hint:"Элегантно, эксклюзивно" },
  { id:"minimal", label:"Минимализм",   hint:"Лаконично, много воздуха" },
];

const inputStyle: React.CSSProperties = {
  width:"100%", background:"var(--bg)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"10px 14px", fontSize:13, fontFamily:"'Manrope',sans-serif", outline:"none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:12, color:"var(--text2)", marginBottom:6, fontWeight:500 }}>{label}</label>
      {children}
    </div>
  );
}

export default function SiteGeneratorPage() {
  const { salon } = useSalon();

  const [step, setStep] = useState<1|2|3>(1);
  const [name, setName] = useState(() => salon.name ?? "");
  const [location, setLocation] = useState(() => salon.address ?? salon.city ?? "");
  const [phone, setPhone] = useState(() => salon.phone ?? "");
  const [services, setServices] = useState<string[]>([]);
  const [serviceDraft, setServiceDraft] = useState("");
  const [description, setDescription] = useState(() => salon.description ?? "");
  const [style, setStyle] = useState<Style>("modern");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [err, setErr] = useState("");

  const generate = useMutation({
    mutationFn: (body: { name: string; location: string; phone: string; services: string[]; description: string; style_preferences: Style }) =>
      api.post<GenerateResponse>(`/salons/${salon.id}/generate-site`, body).then((r) => r.data),
    onSuccess: (data) => { setResult(data); setStep(2); },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data?.message ||
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Не удалось сгенерировать сайт. Попробуйте ещё раз.";
      setErr(msg);
    },
  });

  const addService = () => {
    const v = serviceDraft.trim();
    if (v && !services.includes(v)) setServices((s) => [...s, v]);
    setServiceDraft("");
  };

  const content = result?.site_content;
  const stepLabels = useMemo(() => ["Данные", "Предпросмотр", "Публикация"], []);
  const cardStyle: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:28 };

  return (
    <div style={{ padding:"32px 36px", maxWidth:720 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <div style={{
          width:44, height:44, borderRadius:"var(--radius)",
          background:"var(--gold-dim)", display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <Sparkles size={20} style={{ color:"var(--gold)" }} />
        </div>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, color:"var(--text)", margin:0 }}>
            AI-конструктор сайта
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:3 }}>
            Заполните форму — Claude создаст контент сайта
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:28 }}>
        {stepLabels.map((label, i) => {
          const n = (i + 1) as 1|2|3;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:700,
                background: active ? "var(--gold)" : done ? "var(--gold-dim)" : "var(--surface)",
                color: active ? "#0a0a0b" : done ? "var(--gold)" : "var(--text3)",
                border: active ? "none" : done ? "1px solid var(--gold-dim2)" : "1px solid var(--border)",
              }}>
                {done ? <Check size={13} /> : n}
              </div>
              <span style={{ fontSize:13, color: active ? "var(--text)" : "var(--text3)", fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
              {n < 3 && <div style={{ width:24, height:1, background:"var(--border)", margin:"0 4px" }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Form */}
      {step === 1 && (
        <div style={{ ...cardStyle, display:"flex", flexDirection:"column", gap:20 }}>
          <Field label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Barber Pro" style={inputStyle} />
          </Field>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Field label="Локация">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ташкент, Чиланзар" style={inputStyle} />
            </Field>
            <Field label="Телефон">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" style={inputStyle} />
            </Field>
          </div>

          <Field label="Услуги">
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={serviceDraft}
                onChange={(e) => setServiceDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(); } }}
                placeholder="Стрижка, борода…"
                style={inputStyle}
              />
              <button
                onClick={addService} type="button"
                style={{
                  flexShrink:0, padding:"0 14px", borderRadius:"var(--radius)",
                  background:"var(--bg)", border:"1px solid var(--border)",
                  color:"var(--text2)", cursor:"pointer",
                }}
              >
                <Plus size={15} />
              </button>
            </div>
            {services.length > 0 && (
              <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
                {services.map((s) => (
                  <span key={s} style={{
                    display:"flex", alignItems:"center", gap:4,
                    background:"var(--gold-dim)", color:"var(--gold)",
                    fontSize:12, fontWeight:500, padding:"3px 10px", borderRadius:20,
                  }}>
                    {s}
                    <button
                      type="button" onClick={() => setServices((arr) => arr.filter((x) => x !== s))}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gold)", padding:0, display:"flex" }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Описание (от себя)">
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} placeholder="Барбершоп в центре города, работаем с 2015 года…"
              style={{ ...inputStyle, resize:"none" }}
            />
          </Field>

          <Field label="Стиль оформления">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {STYLES.map((s) => (
                <button
                  key={s.id} type="button" onClick={() => setStyle(s.id)}
                  style={{
                    padding:16, borderRadius:"var(--radius)", textAlign:"left",
                    border: style === s.id ? "1px solid var(--gold)" : "1px solid var(--border)",
                    background: style === s.id ? "var(--gold-dim)" : "var(--bg)",
                    cursor:"pointer", transition:"border-color 0.15s, background 0.15s",
                  }}
                >
                  <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0, marginBottom:3 }}>{s.label}</p>
                  <p style={{ color:"var(--text2)", fontSize:12, margin:0 }}>{s.hint}</p>
                </button>
              ))}
            </div>
          </Field>

          {err && (
            <div style={{ background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:"var(--radius)", padding:"10px 14px", color:"var(--red)", fontSize:13 }}>
              {err}
            </div>
          )}

          <button
            onClick={() => { setErr(""); generate.mutate({ name:name.trim(), location:location.trim(), phone:phone.trim(), services, description:description.trim(), style_preferences:style }); }}
            disabled={generate.isPending || name.trim().length < 2}
            style={{
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              width:"100%", background:"var(--gold)", color:"#0a0a0b",
              border:"none", borderRadius:"var(--radius)", padding:"12px",
              fontSize:14, fontWeight:700, cursor: (generate.isPending || name.trim().length < 2) ? "not-allowed" : "pointer",
              opacity: (generate.isPending || name.trim().length < 2) ? 0.5 : 1,
            }}
          >
            <Sparkles size={15} />
            {generate.isPending ? "Генерируем…" : "Сгенерировать сайт"}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && content && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={cardStyle}>
            <p style={{ color:"var(--gold)", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 8px" }}>
              {STYLES.find((s) => s.id === content.style)?.label ?? "Стиль"}
            </p>
            <h2 style={{ color:"var(--text)", fontSize:24, fontWeight:700, margin:0, marginBottom:4 }}>{content.heading}</h2>
            {content.subheading && (
              <p style={{ color:"var(--gold)", fontSize:15, margin:0, marginBottom:14 }}>{content.subheading}</p>
            )}
            {content.about && (
              <p style={{ color:"var(--text2)", fontSize:13, lineHeight:1.6, margin:0, marginBottom:16 }}>{content.about}</p>
            )}
            {content.services && content.services.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10, marginBottom:16 }}>
                {content.services.map((s, i) => (
                  <div key={`${s.name}-${i}`} style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:14 }}>
                    <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0, marginBottom:4 }}>{s.name}</p>
                    <p style={{ color:"var(--text2)", fontSize:12, margin:0 }}>{s.description}</p>
                  </div>
                ))}
              </div>
            )}
            {content.cta?.title && (
              <div style={{
                padding:16, background:"var(--gold-dim)", border:"1px solid var(--gold-dim2)",
                borderRadius:"var(--radius)", textAlign:"center",
              }}>
                <p style={{ color:"var(--text)", fontSize:14, margin:"0 0 10px" }}>{content.cta.title}</p>
                <span style={{ background:"var(--gold)", color:"#0a0a0b", fontSize:13, fontWeight:700, padding:"7px 18px", borderRadius:"var(--radius)", display:"inline-block" }}>
                  {content.cta.button}
                </span>
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                display:"flex", alignItems:"center", gap:8,
                background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                color:"var(--text2)", padding:"10px 18px", fontSize:13, fontWeight:500, cursor:"pointer",
              }}
            >
              <ArrowLeft size={14} /> К форме
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                background:"var(--gold)", color:"#0a0a0b", border:"none",
                borderRadius:"var(--radius)", padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer",
              }}
            >
              <Check size={14} /> Опубликовать
            </button>
          </div>
          <p style={{ textAlign:"center", color:"var(--text3)", fontSize:12 }}>
            Контент уже сохранён. «Опубликовать» покажет ссылку на сайт.
          </p>
        </div>
      )}

      {/* Step 3: Published */}
      {step === 3 && result && (
        <div style={{ ...cardStyle, textAlign:"center" }}>
          <div style={{
            width:56, height:56, borderRadius:"var(--radius-lg)",
            background:"rgba(76,175,125,0.12)", border:"1px solid rgba(76,175,125,0.2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 18px",
          }}>
            <Check size={28} style={{ color:"var(--green)" }} />
          </div>
          <h2 style={{ color:"var(--text)", fontSize:20, fontWeight:700, margin:"0 0 8px" }}>Сайт опубликован!</h2>
          <p style={{ color:"var(--text2)", fontSize:14, margin:"0 0 18px" }}>Ваш сайт доступен по адресу:</p>
          <div style={{
            maxWidth:400, margin:"0 auto 24px",
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
            background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            padding:"12px 16px",
          }}>
            <span style={{ color:"var(--gold)", fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {result.site_url.replace(/^https?:\/\//, "")}
            </span>
            <a
              href={result.site_url} target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", gap:4, color:"var(--text2)", fontSize:12, textDecoration:"none", flexShrink:0 }}
            >
              Открыть <ExternalLink size={12} />
            </a>
          </div>
          <button
            onClick={() => { setStep(1); setResult(null); }}
            style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", fontSize:13 }}
          >
            Сгенерировать заново
          </button>
        </div>
      )}
    </div>
  );
}
