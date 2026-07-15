"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Building2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";
import { useProfileQuery, type Profile } from "@/hooks/useProfile";
import { SPECIALIZATION_IDS } from "@/lib/specializations";

const BIO_MAX_LENGTH = 500;

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
  const tSpec = useTranslations("Specializations");
  // Guards against ids saved by an older catalog version that no longer
  // exist — falls back to the raw id instead of throwing on a missing key.
  const specLabel = (id: string) => (SPECIALIZATION_IDS.includes(id) ? tSpec(`items.${id}`) : id);
  const { salon } = useSalon();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", last_name: "", city: "", bio: "" });
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specQuery, setSpecQuery] = useState("");
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useProfileQuery();

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name ?? "",
      last_name: data.last_name ?? "",
      city: data.city ?? "",
      bio: data.bio ?? "",
    });
    setSpecializations(data.specializations);
  }, [data]);

  const specMatches = useMemo(() => {
    const q = specQuery.trim().toLowerCase();
    if (!q) return [];
    return SPECIALIZATION_IDS
      .filter((id) => !specializations.includes(id) && specLabel(id).toLowerCase().includes(q))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specQuery, specializations]);

  function addSpecialization(id: string) {
    setSpecializations((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSpecQuery("");
  }

  function removeSpecialization(id: string) {
    setSpecializations((prev) => prev.filter((s) => s !== id));
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put("/profile", {
      name: form.name.trim() || null,
      last_name: form.last_name.trim() || null,
      city: form.city.trim() || null,
      bio: form.bio.trim() || null,
      specializations,
    }),
    onSuccess: (res) => {
      // Write the server's response straight into the cache instead of
      // invalidating — we just saved this data, no need for a follow-up GET.
      qc.setQueryData<Profile>(["profile"], (prev) => ({ ...(prev as Profile), ...res.data }));
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
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "var(--gold-dim)", color: "var(--gold)",
            fontWeight: 700, fontSize: 26, display: "flex",
            alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0,
          }}>
            {data.photo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={data.photo_url} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials}
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
          {specializations.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {specializations.map((s) => (
                <span key={s} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 6px 6px 12px", borderRadius: 999,
                  background: "var(--gold-dim)", color: "var(--gold)",
                  fontSize: 12.5, fontWeight: 600,
                }}>
                  {specLabel(s)}
                  <button
                    type="button" onClick={() => removeSpecialization(s)}
                    aria-label={`${t("specializations.remove")}: ${specLabel(s)}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 16, height: 16, borderRadius: "50%", border: "none",
                      background: "rgba(0,0,0,0.15)", color: "inherit", cursor: "pointer", padding: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: "relative" }}>
            <input
              value={specQuery}
              onChange={(e) => setSpecQuery(e.target.value)}
              placeholder={t("placeholders.specializationsSearch")}
              style={inp}
            />
            {specQuery.trim().length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 5,
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", overflow: "hidden",
                boxShadow: "0 12px 24px rgba(0,0,0,0.18)",
              }}>
                {specMatches.length > 0 ? specMatches.map((id, i) => (
                  <button
                    key={id} type="button" onClick={() => addSpecialization(id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 14px", background: "transparent", border: "none",
                      borderBottom: i < specMatches.length - 1 ? "1px solid var(--border)" : "none",
                      color: "var(--text)", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {specLabel(id)}
                  </button>
                )) : (
                  <div style={{ padding: "10px 14px", color: "var(--text3)", fontSize: 12.5 }}>
                    {t("specializations.noResults")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>{t("fields.bio")}</label>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value.slice(0, BIO_MAX_LENGTH))}
            rows={3}
            maxLength={BIO_MAX_LENGTH}
            placeholder={t("placeholders.bio")}
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            {t("bioCounter", { count: form.bio.length, max: BIO_MAX_LENGTH })}
          </div>
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
