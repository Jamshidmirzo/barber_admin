"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Camera, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

interface Profile {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  specializations: string[];
  country: "uz" | "kr" | null;
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
  const t = useTranslations("Profile");
  const { salon } = useSalon();
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
        {t("title")}
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
            <label style={label}>{t("fields.firstName")}</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("placeholders.firstName")} style={inp} />
          </div>
          <div>
            <label style={label}>{t("fields.lastName")}</label>
            <input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder={t("placeholders.lastName")} style={inp} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>{t("fields.phone")}</label>
            <input value={data.phone} disabled style={{ ...inp, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={label}>{t("fields.city")}</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("placeholders.city")} style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>{t("fields.specializations")}</label>
          <input value={form.specializations} onChange={(e) => set("specializations", e.target.value)} placeholder={t("placeholders.specializations")} style={inp} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>{t("fields.bio")}</label>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={3}
            placeholder={t("placeholders.bio")}
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
          {saved ? t("save.saved") : saveMutation.isPending ? t("save.saving") : t("save.idle")}
        </button>

        {saveMutation.isError && (
          <p style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>
            {t("saveError")}
          </p>
        )}
      </div>

      {/* Business info — captured at registration */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 26, maxWidth: 620, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Building2 size={16} style={{ color: "var(--gold)" }} />
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "var(--text)" }}>
            {t("business.title")}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: data.country === "kr" ? 14 : 0 }}>
          <div>
            <label style={label}>{t("business.salonName")}</label>
            <input value={salon.name} disabled style={{ ...inp, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={label}>{t("business.address")}</label>
            <input value={salon.address ?? "—"} disabled style={{ ...inp, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
        </div>

        {data.country === "kr" && (
          <div>
            <label style={label}>{t("business.brn")}</label>
            <input value={salon.business_registration_number ?? "—"} disabled style={{ ...inp, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
        )}
      </div>
    </div>
  );
}
