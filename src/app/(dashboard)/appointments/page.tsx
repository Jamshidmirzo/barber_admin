"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Calendar, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import api from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";
import { useIntlLocale } from "@/lib/locale";

interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  master_id?: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  price?: number;
  note?: string | null;
}

interface Client { id: string; name: string; phone: string; }
interface Service { id: string; name: string; }
interface Master { id: string; name: string; }


// Maps raw backend status codes (including variant spellings) to the
// translation keys under the "status" namespace (Appointments.status.*)
function statusKey(raw: string): string {
  switch (raw) {
    case "in_progress":
    case "inprogress":
      return "inProgress";
    case "no_show":
    case "noshow":
      return "noShow";
    case "cancelled_by_client":
      return "cancelled";
    default:
      return raw;
  }
}

// Colors from design spec
const STATUS_COLOR: Record<string, string> = {
  pending:             "#c2933a",
  scheduled:           "#7d97b8",
  confirmed:           "#5f9d6f",
  in_progress:         "#c9a45c",
  inprogress:          "#c9a45c",
  completed:           "#8a8f86",
  cancelled:           "#b56a54",
  cancelled_by_client: "#b56a54",
  no_show:             "#8a6a6a",
  noshow:              "#8a6a6a",
};

const BADGE_BG: Record<string, string> = {
  pending:             "rgba(194,147,58,0.13)",
  scheduled:           "rgba(125,151,184,0.13)",
  confirmed:           "rgba(95,157,111,0.13)",
  in_progress:         "rgba(201,164,92,0.13)",
  inprogress:          "rgba(201,164,92,0.13)",
  completed:           "rgba(138,143,134,0.13)",
  cancelled:           "rgba(181,106,84,0.13)",
  cancelled_by_client: "rgba(181,106,84,0.13)",
  no_show:             "rgba(138,106,106,0.13)",
  noshow:              "rgba(138,106,106,0.13)",
};

const STATUS_LEGEND = [
  { key: "pending",     color: "#c2933a" },
  { key: "scheduled",   color: "#7d97b8" },
  { key: "confirmed",   color: "#5f9d6f" },
  { key: "in_progress", color: "#c9a45c" },
  { key: "completed",   color: "#8a8f86" },
  { key: "cancelled",   color: "#b56a54" },
  { key: "no_show",     color: "#8a6a6a" },
];
function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ApptForm {
  client_name: string;
  service_id: string;
  starts_at: string;  // HH:MM
  master_id: string;
  status: string;
}

const emptyForm: ApptForm = {
  client_name: "",
  service_id: "",
  starts_at: "",
  master_id: "",
  status: "scheduled",
};

const fldInp: React.CSSProperties = {
  width: "100%",
  background: "var(--bg,var(--surface))",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "9px 14px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'Manrope',sans-serif",
};

function ApptModal({
  appt,
  date,
  salonId,
  clients,
  services,
  masters,
  onClose,
}: {
  appt: Appointment | null;
  date: string;
  salonId: string;
  clients: Client[];
  services: Service[];
  masters: Master[];
  onClose: () => void;
}) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const locale = useIntlLocale();
  const qc = useQueryClient();
  const isEdit = appt !== null;

  const [form, setForm] = useState<ApptForm>(() => {
    if (appt) {
      return {
        client_name: "",
        service_id: appt.service_id,
        starts_at: formatTime(appt.starts_at, locale),
        master_id: appt.master_id ?? "",
        status: appt.status,
      };
    }
    return { ...emptyForm };
  });

  const [clientSearch, setClientSearch] = useState(() => {
    if (appt) return "";
    return "";
  });

  const [err, setErr] = useState("");

  const createM = useMutation({
    mutationFn: (body: object) => api.post(`/salons/${salonId}/appointments`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); onClose(); },
    onError: () => setErr(t("modal.createError")),
  });

  const updateM = useMutation({
    mutationFn: (body: object) => api.put(`/salons/${salonId}/appointments/${appt?.id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); onClose(); },
    onError: () => setErr(t("modal.saveError")),
  });

  const deleteM = useMutation({
    mutationFn: () => api.delete(`/salons/${salonId}/appointments/${appt?.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); onClose(); },
  });

  function handleSave() {
    setErr("");
    const body: Record<string, string> = {
      service_id: form.service_id,
      status: form.status,
    };
    if (form.starts_at) {
      body.starts_at = `${date}T${form.starts_at}:00`;
    }
    if (form.master_id) body.master_id = form.master_id;
    if (!isEdit) {
      // find client by search text
      const found = clients.find(
        (c) => c.name.toLowerCase() === clientSearch.toLowerCase() || c.phone === clientSearch
      );
      if (found) body.client_id = found.id;
      else if (clientSearch) body.client_name = clientSearch;
    }
    if (isEdit) updateM.mutate(body);
    else createM.mutate(body);
  }

  const loading = createM.isPending || updateM.isPending;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div style={{
        background: "var(--card,var(--surface))",
        border: "1px solid var(--border)",
        borderRadius: 18,
        width: "100%", maxWidth: 460,
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ color: "var(--text)", fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, margin: 0 }}>
            {isEdit ? t("modal.editTitle") : t("modal.newTitle")}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Client */}
          {!isEdit && (
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {t("modal.clientLabel")}
              </label>
              <input
                list="appt-clients-list"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={t("modal.clientPlaceholder")}
                style={fldInp}
              />
              <datalist id="appt-clients-list">
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>{c.phone}</option>
                ))}
              </datalist>
            </div>
          )}

          {/* Service */}
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text2)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {t("modal.serviceLabel")}
            </label>
            <select
              value={form.service_id}
              onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
              style={{ ...fldInp }}
            >
              <option value="">{t("modal.selectServicePlaceholder")}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text2)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {t("modal.timeLabel")}
            </label>
            <input
              type="time"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              style={fldInp}
            />
          </div>

          {/* Master */}
          {masters.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {t("modal.masterLabel")}
              </label>
              <select
                value={form.master_id}
                onChange={(e) => setForm((f) => ({ ...f, master_id: e.target.value }))}
                style={{ ...fldInp }}
              >
                <option value="">{t("modal.noMasterOption")}</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text2)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {t("modal.statusLabel")}
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              style={{ ...fldInp }}
            >
              {STATUS_LEGEND.map((s) => (
                <option key={s.key} value={s.key}>{t(`status.${statusKey(s.key)}`)}</option>
              ))}
            </select>
          </div>

          {err && (
            <p style={{ color: "var(--red)", fontSize: 12, background: "rgba(224,90,90,0.08)", borderRadius: "var(--radius)", padding: "8px 12px", margin: 0 }}>
              {err}
            </p>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text2)", fontSize: 13, padding: "9px", cursor: "pointer" }}
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{ flex: 1, background: "var(--gold)", color: "#0a0a0b", border: "none", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, padding: "9px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t("modal.saving") : tc("save")}
            </button>
          </div>

          {/* Delete */}
          {isEdit && (
            <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => { if (confirm(t("modal.deleteConfirm"))) deleteM.mutate(); }}
                disabled={deleteM.isPending}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 13, padding: "6px 0", opacity: deleteM.isPending ? 0.5 : 1 }}
              >
                {deleteM.isPending ? t("modal.deleting") : t("modal.deleteButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const t = useTranslations("Appointments");
  const { salon } = useSalon();
  const locale = useIntlLocale();
  const salonId = salon?.id ?? "";

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  const start = `${date}T00:00:00`;
  const end   = `${date}T23:59:59`;

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments", date],
    queryFn: () =>
      api.get("/appointments", { params: { start, end } }).then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.items ?? [];
      }),
  });

  const { data: clientsData } = useQuery<{ items: Client[]; total: number }>({
    queryKey: ["clients", "all"],
    queryFn: () => api.get("/clients", { params: { limit: 500, offset: 0 } }).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get("/services").then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: mastersData } = useQuery<Master[]>({
    queryKey: ["masters"],
    queryFn: () => api.get("/masters").then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.items ?? [];
    }),
    staleTime: 60_000,
  });

  const clientsArr = clientsData?.items ?? [];
  const servicesArr = services ?? [];
  const mastersArr = mastersData ?? [];

  const clientMap = Object.fromEntries(clientsArr.map((c) => [c.id, c.name]));
  const serviceMap = Object.fromEntries(servicesArr.map((s) => [s.id, s.name]));
  const masterMap = Object.fromEntries(mastersArr.map((m) => [m.id, m.name]));

  function prevDay() {
    const d = new Date(date); d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  }

  const isToday = date === new Date().toISOString().slice(0, 10);
  const displayDate = new Date(date).toLocaleDateString("ru", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Status counts for legend
  const statusCounts: Record<string, number> = {};
  for (const a of appointments ?? []) {
    const k = a.status;
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
  }
  // Normalize in_progress / inprogress etc for counting
  const normalizedCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(statusCounts)) {
    if (k === "inprogress") normalizedCounts["in_progress"] = (normalizedCounts["in_progress"] ?? 0) + v;
    else if (k === "noshow") normalizedCounts["no_show"] = (normalizedCounts["no_show"] ?? 0) + v;
    else if (k === "cancelled_by_client") normalizedCounts["cancelled"] = (normalizedCounts["cancelled"] ?? 0) + v;
    else normalizedCounts[k] = (normalizedCounts[k] ?? 0) + v;
  }

  function openNew() {
    setEditingAppt(null);
    setModalOpen(true);
  }
  function openEdit(a: Appointment) {
    setEditingAppt(a);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingAppt(null);
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 960 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {t("title")}
          </h1>
          {isToday && (
            <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>{t("today")}</p>
          )}
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Day navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={prevDay}
              style={{
                width: 36, height: 36, borderRadius: "var(--radius)",
                background: "var(--surface)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text2)",
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{
              padding: "7px 18px", background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", minWidth: 210, textAlign: "center",
            }}>
              <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>
                {displayDate}
              </span>
            </div>

            <button
              onClick={nextDay}
              style={{
                width: 36, height: 36, borderRadius: "var(--radius)",
                background: "var(--surface)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text2)",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* New appointment button */}
          <button
            onClick={openNew}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px",
              background: "var(--gold)", color: "#0a0a0b",
              border: "none", borderRadius: "var(--radius)",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}
          >
            <Plus size={16} />
            {t("newAppointment")}
          </button>
        </div>
      </div>

      {/* Status legend */}
      {!isLoading && appointments && appointments.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {STATUS_LEGEND.map((s) => {
            const count = normalizedCounts[s.key] ?? 0;
            if (count === 0) return null;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text2)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                {t(`status.${statusKey(s.key)}`)}
                <span style={{ color: "var(--text3)" }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)", padding: "16px 22px",
              display: "flex", gap: 18, alignItems: "center", animation: "pulse 1.5s infinite",
              marginBottom: 1,
            }}>
              <div style={{ width: 64, height: 36, background: "var(--border)", borderRadius: 4 }} />
              <div style={{ width: 3, height: 40, background: "var(--border)", borderRadius: 3 }} />
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--border)" }} />
              <div style={{ flex: 1, height: 14, background: "var(--border)", borderRadius: 4 }} />
              <div style={{ width: 100, height: 14, background: "var(--border)", borderRadius: 4 }} />
            </div>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!appointments || appointments.length === 0) && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-lg)",
            background: "var(--surface)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <Calendar size={28} style={{ color: "var(--text3)" }} />
          </div>
          <p style={{ color: "var(--text2)", fontSize: 14 }}>{t("emptyState")}</p>
        </div>
      )}

      {/* List — card container matching design */}
      {!isLoading && appointments && appointments.length > 0 && (
        <div style={{
          background: "var(--card,var(--surface))",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
        }}>
          {appointments.map((a, idx) => {
            const color = STATUS_COLOR[a.status] ?? "var(--text3)";
            const badgeBg = BADGE_BG[a.status] ?? "rgba(255,255,255,0.06)";
            const clientName = clientMap[a.client_id] ?? t("unknownClient");
            const masterName = a.master_id ? (masterMap[a.master_id] ?? "") : "";
            const isLast = idx === appointments.length - 1;
            return (
              <div
                key={a.id}
                onClick={() => openEdit(a)}
                style={{
                  display: "flex", alignItems: "center", gap: 18,
                  padding: "16px 22px",
                  borderBottom: isLast ? "none" : "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Time column */}
                <div style={{ width: 64, flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, lineHeight: 1.1, color: "var(--text)" }}>
                    {formatTime(a.starts_at, locale)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                    {formatTime(a.ends_at, locale )}
                  </div>
                </div>

                {/* Color stripe */}
                <span style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: color, flexShrink: 0 }} />

                {/* Avatar */}
                <span style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: 11,
                  background: "var(--gold-dim)",
                  border: "1px solid var(--gold-dim2,var(--border))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14,
                  fontFamily: "'Manrope',sans-serif",
                  color: "var(--gold)",
                }}>
                  {initials(clientName)}
                </span>

                {/* Client + service */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {clientName}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {serviceMap[a.service_id] ?? t("unknownService")}
                  </div>
                </div>

                {/* Master + price */}
                <div style={{ textAlign: "right", minWidth: 110, flexShrink: 0 }}>
                  {masterName && (
                    <div style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 500 }}>
                      {masterName}
                    </div>
                  )}
                  {a.price != null && (
                    <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, fontFamily: "'Playfair Display',serif", marginTop: masterName ? 2 : 0 }}>
                      {a.price.toLocaleString("ru")} {t("currency")}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{
                  fontSize: 11.5,
                  color: color,
                  fontWeight: 600,
                  padding: "5px 12px",
                  background: badgeBg,
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  minWidth: 100,
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  {t(`status.${statusKey(a.status)}`)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ApptModal
          appt={editingAppt}
          date={date}
          salonId={salonId}
          clients={clientsArr}
          services={servicesArr}
          masters={mastersArr}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
