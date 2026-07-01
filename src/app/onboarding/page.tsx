"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Scissors, Check, X, Loader2 } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSalonContextQuery } from "@/hooks/useSalon";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;
type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

const inp: React.CSSProperties = {
  width:"100%", background:"rgba(255,255,255,0.04)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"12px 16px", fontSize:14, fontFamily:"'Manrope',sans-serif",
  outline:"none", boxSizing:"border-box",
};

export default function OnboardingPage() {
  useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: salonCtx } = useSalonContextQuery();
  useEffect(() => { if (salonCtx?.salon) router.replace("/appointments"); }, [salonCtx, router]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (slugTouched || name.trim().length < 2) return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try { const res = await api.get("/salons/slug/suggest", { params:{ name:name.trim() } }); setSlug(res.data?.slug ?? ""); } catch { /**/ }
    }, 500);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [name, slugTouched]);

  useEffect(() => {
    const s = slug.toLowerCase().trim();
    if (!s) { setAvailability("idle"); return; }
    if (!SLUG_RE.test(s)) { setAvailability("invalid"); return; }
    setAvailability("checking");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try { const res = await api.get("/salons/slug/check", { params:{ slug:s } }); setAvailability(res.data?.available ? "available" : "taken"); }
      catch { setAvailability("invalid"); }
    }, 400);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [slug]);

  const canSubmit = name.trim().length >= 2 && availability === "available" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(""); setSubmitting(true);
    try {
      await api.post("/salons", { name:name.trim(), slug:slug.toLowerCase().trim() });
      await qc.invalidateQueries({ queryKey:["salon-context"] });
      router.replace("/barbers");
    } catch (err) { setError(parseApiError(err, "Не удалось создать салон")); setSubmitting(false); }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"40px 16px" }}>
      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:"var(--gold)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
            <Scissors size={28} style={{ color:"#0a0a0b" }} />
          </div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"var(--text)", margin:0 }}>Создание салона</h1>
          <p style={{ color:"var(--text2)", fontSize:14, marginTop:8 }}>
            Назовите барбершоп — получите адрес сайта на hayrli.app
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:28, display:"flex", flexDirection:"column", gap:20 }}>

          {/* Name */}
          <div>
            <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>Название салона</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Flek Barbershop" maxLength={200} required autoFocus style={inp} />
          </div>

          {/* Slug */}
          <div>
            <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>Адрес сайта (slug)</label>
            <div style={{ position:"relative" }}>
              <input
                type="text" value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
                placeholder="flek" maxLength={100}
                style={{ ...inp, paddingRight:38 }}
              />
              <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)" }}>
                {availability === "checking" && <Loader2 size={14} style={{ color:"var(--text3)", animation:"spin 1s linear infinite" }} />}
                {availability === "available" && <Check size={14} style={{ color:"var(--green)" }} />}
                {(availability === "taken" || availability === "invalid") && <X size={14} style={{ color:"var(--red)" }} />}
              </span>
            </div>
            <div style={{ marginTop:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>
                {slug ? (
                  <><span style={{ color:"var(--text2)" }}>{slug}</span><span>.hayrli.app</span></>
                ) : "ваш-slug.hayrli.app"}
              </p>
              {availability === "taken" && <span style={{ color:"var(--red)", fontSize:11 }}>занято</span>}
              {availability === "invalid" && slug && <span style={{ color:"var(--red)", fontSize:11 }}>только a-z, 0-9 и дефис, от 3 символов</span>}
              {availability === "available" && <span style={{ color:"var(--green)", fontSize:11 }}>свободно</span>}
            </div>
          </div>

          {error && (
            <p style={{ color:"var(--red)", fontSize:13, background:"rgba(224,90,90,0.08)", borderRadius:"var(--radius)", padding:"10px 14px", margin:0 }}>{error}</p>
          )}

          <button type="submit" disabled={!canSubmit} style={{ width:"100%", background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"13px", fontSize:14, fontWeight:700, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.45, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {submitting && <Loader2 size={15} style={{ animation:"spin 1s linear infinite" }} />}
            {submitting ? "Создаём..." : "Создать салон"}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
