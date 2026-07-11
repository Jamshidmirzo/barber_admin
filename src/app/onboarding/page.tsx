"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scissors, Loader2 } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSalonContextQuery } from "@/hooks/useSalon";

interface Profile {
  country: "uz" | "kr" | null;
}

const BRN_RE = /^\d{10}$/;

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

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile").then((r) => r.data),
  });
  const isKorea = profile?.country === "kr";

  const [name, setName] = useState("");
  const [brn, setBrn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const brnValid = !isKorea || BRN_RE.test(brn.replace(/[\s-]/g, ""));
  const canSubmit = name.trim().length >= 2 && brnValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(""); setSubmitting(true);
    try {
      await api.post("/salons", {
        name: name.trim(),
        ...(isKorea ? { business_registration_number: brn.replace(/[\s-]/g, "") } : {}),
      });
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
            Назовите барбершоп, чтобы начать работу
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:28, display:"flex", flexDirection:"column", gap:20 }}>

          {/* Name */}
          <div>
            <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>Название салона</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Flek Barbershop" maxLength={200} required autoFocus style={inp} />
          </div>

          {/* Business registration number — Korea only */}
          {isKorea && (
            <div>
              <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>Номер регистрации бизнеса (사업자등록번호)</label>
              <input
                type="text" value={brn}
                onChange={(e) => setBrn(e.target.value)}
                placeholder="0000000000" maxLength={20}
                style={inp}
              />
              {brn && !brnValid && (
                <p style={{ color:"var(--red)", fontSize:11, margin:"6px 0 0" }}>Должно содержать ровно 10 цифр</p>
              )}
            </div>
          )}

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
