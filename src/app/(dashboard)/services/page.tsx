"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, Scissors, X } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string;
}

interface ServicesResponse {
  items: ServiceItem[];
  total: number;
}

interface Barber {
  id: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

const CATEGORIES = [
  { value: "all",      label: "Все" },
  { value: "haircut",  label: "Стрижка" },
  { value: "beard",    label: "Борода" },
  { value: "coloring", label: "Окрашивание" },
  { value: "treatment",label: "Уход" },
  { value: "other",    label: "Прочее" },
];

const CAT_LABELS: Record<string, string> = {
  haircut:   "Стрижка",
  beard:     "Борода",
  coloring:  "Окрашивание",
  treatment: "Уход",
  other:     "Прочее",
};

function barberLabel(b: Pick<Barber, "name" | "last_name">): string {
  return [b.name, b.last_name].filter(Boolean).join(" ") || "Без имени";
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "10px 14px",
  fontSize: 13,
  fontFamily: "'Manrope',sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

export default function ServicesPage() {
  const { salon } = useSalon();
  const qc = useQueryClient();

  const [catFilter, setCatFilter] = useState<string>("all");
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "haircut", price: "", duration_minutes: "" });
  const [formErr, setFormErr] = useState("");

  // Services list
  const { data: servicesData, isLoading: servicesLoading } = useQuery<ServicesResponse>({
    queryKey: ["salon-services", salon.id],
    queryFn: () => api.get(`/salons/${salon.id}/services`).then((r) => r.data),
  });

  // Team members for barber filter
  const { data: team } = useQuery<{ items: Barber[]; total: number }>({
    queryKey: ["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const barbers = team?.items ?? [];

  // Create service mutation
  const createMutation = useMutation({
    mutationFn: (body: { name: string; category: string; price: number; duration_minutes: number }) =>
      api.post(`/salons/${salon.id}/services`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-services", salon.id] });
      setShowModal(false);
      setForm({ name: "", category: "haircut", price: "", duration_minutes: "" });
      setFormErr("");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Ошибка при создании услуги";
      setFormErr(msg);
    },
  });

  // Delete service mutation
  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) =>
      api.delete(`/salons/${salon.id}/services/${serviceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-services", salon.id] });
    },
  });

  const allServices = servicesData?.items ?? [];

  // Apply filters
  const filtered = allServices.filter((s) => {
    if (catFilter !== "all" && s.category !== catFilter) return false;
    return true;
  });

  function handleSave() {
    setFormErr("");
    const price = parseFloat(form.price);
    const duration = parseInt(form.duration_minutes, 10);
    if (!form.name.trim()) { setFormErr("Введите название услуги"); return; }
    if (isNaN(price) || price <= 0) { setFormErr("Введите корректную цену"); return; }
    if (isNaN(duration) || duration <= 0) { setFormErr("Введите корректную длительность"); return; }
    createMutation.mutate({ name: form.name.trim(), category: form.category, price, duration_minutes: duration });
  }

  function openModal() {
    setForm({ name: "", category: "haircut", price: "", duration_minutes: "" });
    setFormErr("");
    setShowModal(true);
  }

  const selectStyle: React.CSSProperties = {
    padding: "10px 12px",
    border: "1px solid var(--border)",
    background: "var(--card, var(--surface))",
    borderRadius: 11,
    color: "var(--text)",
    font: "600 12.5px 'Manrope',sans-serif",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div style={{ padding: "32px 36px" }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div style={{ animation: "fadeUp .35s ease both" }}>

        {/* Top bar: barber filter + new service button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: "var(--text)", margin: 0, marginRight: 4 }}>
            Услуги
          </h1>
          <select
            value={barberFilter}
            onChange={(e) => setBarberFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Все мастера</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{barberLabel(b)}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <button
            onClick={openModal}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "10px 16px",
              background: "var(--gold)", color: "#171205",
              border: 0, borderRadius: 11,
              cursor: "pointer",
              font: "700 13px 'Manrope',sans-serif",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
          >
            <Plus size={15} />
            Услуга
          </button>
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => {
            const active = catFilter === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setCatFilter(c.value)}
                style={{
                  padding: "7px 14px",
                  border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
                  background: active ? "var(--gold)" : "var(--card, var(--surface))",
                  borderRadius: 20,
                  cursor: "pointer",
                  font: "600 12.5px 'Manrope',sans-serif",
                  color: active ? "#171205" : "var(--text2)",
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Skeleton */}
        {servicesLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--card, var(--surface))",
                  border: "1px solid var(--border)",
                  borderRadius: 15,
                  padding: 18,
                  animation: "pulse 1.5s infinite",
                  minHeight: 130,
                }}
              >
                <div style={{ height: 12, background: "var(--border)", borderRadius: 6, width: "40%", marginBottom: 12 }} />
                <div style={{ height: 16, background: "var(--border)", borderRadius: 6, width: "70%", marginBottom: 32 }} />
                <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ height: 12, background: "var(--border)", borderRadius: 6, width: "30%" }} />
                  <div style={{ height: 12, background: "var(--border)", borderRadius: 6, width: "25%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!servicesLoading && filtered.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "var(--radius-lg)",
              background: "var(--surface)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Scissors size={28} style={{ color: "var(--text3)" }} />
            </div>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 16 }}>
              {allServices.length === 0
                ? "Нет услуг. Добавьте первую!"
                : "Нет услуг в этой категории."}
            </p>
            {allServices.length === 0 && (
              <button
                onClick={openModal}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "10px 18px",
                  background: "var(--gold)", color: "#171205",
                  border: 0, borderRadius: 11,
                  cursor: "pointer",
                  font: "700 13px 'Manrope',sans-serif",
                }}
              >
                <Plus size={15} />
                Новая услуга
              </button>
            )}
          </div>
        )}

        {/* Cards grid */}
        {!servicesLoading && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {filtered.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                onDelete={() => deleteMutation.mutate(s.id)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{
            background: "var(--card, var(--surface))",
            border: "1px solid var(--border)",
            borderRadius: 18,
            width: "100%", maxWidth: 420,
            padding: 28,
            animation: "fadeUp .2s ease both",
          }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ color: "var(--text)", fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, margin: 0 }}>
                Новая услуга
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text2)", marginBottom: 5, fontWeight: 500 }}>
                  Название
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Мужская стрижка"
                  style={inputStyle}
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text2)", marginBottom: 5, fontWeight: 500 }}>
                  Категория
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Price + Duration row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text2)", marginBottom: 5, fontWeight: 500 }}>
                    Цена (сум)
                  </label>
                  <input
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    placeholder="50000"
                    type="number"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text2)", marginBottom: 5, fontWeight: 500 }}>
                    Длительность (мин)
                  </label>
                  <input
                    value={form.duration_minutes}
                    onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    placeholder="30"
                    type="number"
                    min="1"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Error */}
              {formErr && (
                <div style={{
                  background: "rgba(224,90,90,0.08)",
                  border: "1px solid rgba(224,90,90,0.2)",
                  borderRadius: "var(--radius)",
                  padding: "9px 13px",
                  color: "var(--red)",
                  fontSize: 13,
                }}>
                  {formErr}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "10px",
                    fontSize: 13, fontWeight: 500,
                    color: "var(--text2)",
                    cursor: "pointer",
                    fontFamily: "'Manrope',sans-serif",
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                  style={{
                    flex: 1,
                    background: "var(--gold)",
                    color: "#171205",
                    border: "none",
                    borderRadius: "var(--radius)",
                    padding: "10px",
                    fontSize: 13, fontWeight: 700,
                    cursor: createMutation.isPending ? "not-allowed" : "pointer",
                    opacity: createMutation.isPending ? 0.6 : 1,
                    fontFamily: "'Manrope',sans-serif",
                  }}
                >
                  {createMutation.isPending ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Service card component ────────────────────────────────────────────────────

interface ServiceCardProps {
  service: ServiceItem;
  onDelete: () => void;
  deleting: boolean;
}

function ServiceCard({ service, onDelete, deleting }: ServiceCardProps) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const catLabel = CAT_LABELS[service.category] ?? service.category;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
      style={{
        background: "var(--card, var(--surface))",
        border: `1px solid ${hovered ? "var(--gold-dim2, rgba(201,164,92,0.20))" : "var(--border)"}`,
        borderRadius: 15,
        padding: 18,
        transition: "border-color 0.15s",
        position: "relative",
      }}
    >
      {/* Top section */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Category badge */}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--gold)",
            background: "var(--gold-dim, rgba(201,164,92,0.12))",
            padding: "3px 9px",
            borderRadius: 20,
          }}>
            {catLabel}
          </span>
          {/* Service name */}
          <div style={{
            fontFamily: "'Playfair Display',serif",
            fontSize: 16.5,
            fontWeight: 600,
            color: "var(--text)",
            marginTop: 11,
            lineHeight: 1.3,
          }}>
            {service.name}
          </div>
        </div>

        {/* Scissors icon or delete confirm */}
        {confirmDelete ? (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              disabled={deleting}
              style={{
                background: "rgba(224,90,90,0.15)", border: "1px solid rgba(224,90,90,0.3)",
                borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 700,
                color: "var(--red, #e05a5a)", cursor: "pointer",
                fontFamily: "'Manrope',sans-serif",
              }}
            >
              Да
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                background: "none", border: "1px solid var(--border)",
                borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 600,
                color: "var(--text2)", cursor: "pointer",
                fontFamily: "'Manrope',sans-serif",
              }}
            >
              Нет
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Удалить услугу"
            style={{
              width: 32, height: 32, flexShrink: 0,
              borderRadius: 9,
              border: "1px solid var(--border)",
              background: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text3)",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(224,90,90,0.4)";
              (e.currentTarget as HTMLElement).style.color = "var(--red, #e05a5a)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text3)";
            }}
          >
            <Scissors size={14} />
          </button>
        )}
      </div>

      {/* Bottom section */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
      }}>
        {/* Duration */}
        <div style={{ fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 5 }}>
          <Clock size={14} style={{ color: "var(--text3)" }} />
          {service.duration_minutes} мин
        </div>
        {/* Price */}
        <div style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: 17,
          fontWeight: 600,
          color: "var(--gold)",
        }}>
          {service.price.toLocaleString("ru")} сум
        </div>
      </div>
    </div>
  );
}
