"use client";

import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import api from "@/lib/api";

interface Profile {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  specializations: string[];
  is_onboarded: boolean;
}

export default function ProfilePage() {
  const { data, isLoading } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div style={{ padding:"32px 36px" }}>
        <div style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius-lg)", padding:28, maxWidth:520,
          animation:"pulse 1.5s infinite",
        }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"var(--border)", marginBottom:20 }} />
          <div style={{ height:18, background:"var(--border)", borderRadius:4, width:160, marginBottom:10 }} />
          <div style={{ height:14, background:"var(--border)", borderRadius:4, width:120 }} />
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (!data) return null;

  const fullName = [data.name, data.last_name].filter(Boolean).join(" ") || "—";
  const initials = fullName !== "—" ? fullName.slice(0, 2).toUpperCase() : data.phone.slice(-2);

  const rowStyle: React.CSSProperties = {
    display:"flex", justifyContent:"space-between", alignItems:"flex-start",
    padding:"14px 0", borderBottom:"1px solid var(--border)",
  };

  return (
    <div style={{ padding:"32px 36px" }}>
      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"var(--text)", margin:"0 0 28px" }}>
        Профиль
      </h1>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:28, maxWidth:520 }}>

        {/* Avatar row */}
        <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:24 }}>
          <div style={{
            width:68, height:68, borderRadius:"50%",
            background: data.photo_url ? "transparent" : "var(--gold-dim)",
            color:"var(--gold)", fontWeight:700, fontSize:22,
            display:"flex", alignItems:"center", justifyContent:"center",
            overflow:"hidden", flexShrink:0,
          }}>
            {data.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo_url} alt={fullName} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            ) : initials}
          </div>
          <div>
            <p style={{ color:"var(--text)", fontWeight:600, fontSize:18, margin:0, marginBottom:4 }}>{fullName}</p>
            <p style={{ color:"var(--text2)", fontSize:13, margin:0 }}>{data.phone}</p>
          </div>
        </div>

        {/* Fields */}
        <div>
          {data.city && (
            <div style={rowStyle}>
              <span style={{ color:"var(--text2)", fontSize:13 }}>Город</span>
              <span style={{ color:"var(--text)", fontSize:13 }}>{data.city}</span>
            </div>
          )}
          {data.bio && (
            <div style={rowStyle}>
              <span style={{ color:"var(--text2)", fontSize:13 }}>О себе</span>
              <span style={{ color:"var(--text)", fontSize:13, textAlign:"right", maxWidth:240 }}>{data.bio}</span>
            </div>
          )}
          {data.specializations.length > 0 && (
            <div style={rowStyle}>
              <span style={{ color:"var(--text2)", fontSize:13 }}>Специализации</span>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"flex-end", maxWidth:240 }}>
                {data.specializations.map((s) => (
                  <span key={s} style={{
                    fontSize:11, background:"var(--gold-dim)", color:"var(--gold)",
                    padding:"2px 8px", borderRadius:20, fontWeight:500,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ ...rowStyle, borderBottom:"none" }}>
            <span style={{ color:"var(--text2)", fontSize:13 }}>Онбординг</span>
            <span style={{ fontSize:13, color: data.is_onboarded ? "var(--green)" : "var(--gold)" }}>
              {data.is_onboarded ? "Завершён" : "Не завершён"}
            </span>
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          marginTop:20, padding:16,
          background:"var(--gold-dim)", border:"1px solid var(--gold-dim2)",
          borderRadius:"var(--radius)",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <Settings size={15} style={{ color:"var(--gold)", flexShrink:0 }} />
          <div>
            <p style={{ color:"var(--gold)", fontSize:13, fontWeight:600, margin:0 }}>Редактирование профиля</p>
            <p style={{ color:"var(--text2)", fontSize:12, margin:"3px 0 0" }}>
              Используйте мобильное приложение для редактирования профиля
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
