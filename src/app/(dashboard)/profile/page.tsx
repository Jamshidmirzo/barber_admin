"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Camera } from "lucide-react";
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

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 13px",
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", color: "var(--text)",
  fontSize: 14, outline: "none", fontFamily: "inherit",
};

const label: React.CSSProperties = {
  display: "block", fontSize: 11.5, color: "var(--text2)",
  marginBottom: 7, letterSpacing: ".02em",
};

export default function ProfilePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", last_name: "", city: "", bio: "", specializations: "" });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile").then((r) => r.data),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name ?? "",
      last_name: data.last_name ?? "",
      city: data.city ?? "",
      bio: data.bio ?? "",
      specializations: data.specializations.join(", "),
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/profile", {
      name: form.name.trim() || null,
      last_name: form.last_name.trim() || null,
      city: form.city.trim() || null,
      bio: form.bio.trim() || null,
      specializations: form.specializations.split(",").map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  if (isLoading) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 28, maxWidth: 620, animation: "pulse 1.5s infinite" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--border)", marginBottom: 20 }} />
          <div style={{ height: 18, background: "var(--border)", borderRadius: 4, width: 160, marginBottom: 10 }} />
          <div style={{ height: 14, background: "var(--border)", borderRadius: 4, width: 120 }} />
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (!data) return null;

  const fullName = [data.name, data.last_name].filter(Boolean).join(" ") || "—";
  const initials = fullName !== "—" ? fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : data.phone.slice(-2);

  return (
    <div style={{ padding: "32px 36px" }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: "var(--text)", margin: "0 0 28px" }}>
        Профиль
      </h1>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 26, maxWidth: 620 }}>

        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, paddingBottom: 22, borderBottom: "1px solid var(--border)" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "var(--gold-dim)", color: "var(--gold)",
              fontWeight: 700, fontSize: 26, display: "flex",
              alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {data.photo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={data.photo_url} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials}
            </div>
            <button style={{
              position: "absolute", bottom: -4, right: -4,
              width: 26, height: 26, borderRadius: "50%",
              background: "var(--gold)", border: "2px solid var(--card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <Camera size={12} style={{ color: "#0a0a0b" }} />
            </button>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, color: "var(--text)" }}>
              {fullName}
            </div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>
              {data.phone}
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>Имя</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Имя" style={inp} />
          </div>
          <div>
            <label style={label}>Фамилия</label>
            <input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Фамилия" style={inp} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>Телефон</label>
            <input value={data.phone} disabled style={{ ...inp, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={label}>Город</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ташкент" style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Специализации (через запятую)</label>
          <input value={form.specializations} onChange={(e) => set("specializations", e.target.value)} placeholder="Классические стрижки, бритьё" style={inp} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>О себе</label>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={3}
            placeholder="Расскажите о себе…"
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 26px", background: "var(--gold)", color: "#171205",
            border: "none", borderRadius: "var(--radius)",
            cursor: "pointer", fontWeight: 700, fontSize: 13,
            opacity: saveMutation.isPending ? 0.6 : 1,
          }}
        >
          <Save size={14} />
          {saved ? "Сохранено!" : saveMutation.isPending ? "Сохраняем…" : "Сохранить изменения"}
        </button>

        {saveMutation.isError && (
          <p style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>
            Не удалось сохранить. Попробуйте ещё раз.
          </p>
        )}
      </div>
    </div>
  );
}
