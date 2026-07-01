"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tag,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Search,
  Info,
} from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Promocode {
  id: string;
  code: string;
  discount_pct: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ValidateResult {
  valid: boolean;
  discount_pct: number | null;
  promocode_id: string | null;
  error: string | null;
}

interface TeamMember {
  id: string;
  name: string | null;
  last_name: string | null;
  phone: string;
  photo_url: string | null;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fullName(m: Pick<TeamMember, "name" | "last_name" | "phone">) {
  return [m.name, m.last_name].filter(Boolean).join(" ") || m.phone;
}

function initials(m: Pick<TeamMember, "name" | "last_name" | "phone">) {
  const n = fullName(m);
  return n.slice(0, 2).toUpperCase();
}

const ERROR_LABELS: Record<string, string> = {
  not_found: "Промокод не найден",
  inactive: "Промокод отключён",
  expired: "Срок действия истёк",
  max_uses: "Лимит использований исчерпан",
};

const inputCls =
  "w-full rounded-xl bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-[#F59E0B]";

// ── Root ─────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const { role } = useSalon();
  if (isManager(role)) return <OwnerView />;
  return <MasterView />;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER VIEW — full CRUD of own promo codes
// ═══════════════════════════════════════════════════════════════════════════

function MasterView() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    discount_pct: "10",
    max_uses: "",
    expires_at: "",
  });
  const [formErr, setFormErr] = useState("");

  const { data: codes, isLoading } = useQuery<Promocode[]>({
    queryKey: ["promocodes"],
    queryFn: () => api.get("/promocodes").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: {
      code: string;
      discount_pct: number;
      max_uses?: number;
      expires_at?: string;
    }) => api.post<Promocode>("/promocodes", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promocodes"] });
      setShowForm(false);
      setForm({ code: "", discount_pct: "10", max_uses: "", expires_at: "" });
      setFormErr("");
    },
    onError: (e) => setFormErr(parseApiError(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch<Promocode>(`/promocodes/${id}`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promocodes"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/promocodes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promocodes"] }),
  });

  function handleCreate() {
    setFormErr("");
    const code = form.code.toUpperCase().trim();
    if (!code) return setFormErr("Введите код");
    const pct = parseInt(form.discount_pct);
    if (isNaN(pct) || pct < 1 || pct > 100)
      return setFormErr("Скидка от 1 до 100%");
    const body: Parameters<typeof create.mutate>[0] = {
      code,
      discount_pct: pct,
    };
    if (form.max_uses) body.max_uses = parseInt(form.max_uses);
    if (form.expires_at) body.expires_at = new Date(form.expires_at).toISOString();
    create.mutate(body);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Мои промокоды</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Клиенты вводят код при записи — получают скидку
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[#1F2937] rounded-2xl p-5 mb-6 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Новый промокод</p>
            <button onClick={() => setShowForm(false)}>
              <X className="w-4 h-4 text-gray-500 hover:text-white" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Код (A-Z, 0-9)</label>
              <input
                className={inputCls + " uppercase tracking-widest font-mono"}
                placeholder="SUMMER20"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={20}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Скидка %</label>
              <input
                className={inputCls}
                type="number"
                min={1}
                max={100}
                placeholder="10"
                value={form.discount_pct}
                onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Макс. использований <span className="text-gray-600">(пусто = без лимита)</span>
              </label>
              <input
                className={inputCls}
                type="number"
                min={1}
                placeholder="50"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">
                Действует до <span className="text-gray-600">(пусто = бессрочно)</span>
              </label>
              <input
                className={inputCls}
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          </div>
          {formErr && <p className="text-red-400 text-xs mt-3">{formErr}</p>}
          <button
            onClick={handleCreate}
            disabled={create.isPending}
            className="mt-4 w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {create.isPending ? "Создание…" : "Создать промокод"}
          </button>
        </div>
      )}

      {/* Codes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[#1F2937] rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : !codes?.length ? (
        <div className="bg-[#1F2937] rounded-2xl p-10 text-center">
          <Tag className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Нет промокодов — создайте первый</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((p) => (
            <div
              key={p.id}
              className={`bg-[#1F2937] rounded-2xl p-4 flex items-center gap-4 border ${
                p.is_active ? "border-white/5" : "border-transparent opacity-60"
              }`}
            >
              {/* Code */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-white tracking-widest text-base">
                    {p.code}
                  </span>
                  <button
                    onClick={() => copyCode(p.code)}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    {copied === p.code ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {!p.is_active && (
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                      Отключён
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  <span className="text-[#F59E0B] font-semibold">−{p.discount_pct}%</span>
                  <span>
                    Использований: {p.current_uses}
                    {p.max_uses ? ` / ${p.max_uses}` : ""}
                  </span>
                  {p.expires_at && (
                    <span>До {fmtDate(p.expires_at)}</span>
                  )}
                  {!p.expires_at && <span className="text-gray-600">Бессрочный</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}
                  title={p.is_active ? "Отключить" : "Включить"}
                >
                  {p.is_active ? (
                    <ToggleRight className="w-6 h-6 text-[#F59E0B]" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-500" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Удалить промокод ${p.code}?`)) remove.mutate(p.id);
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How-it-works hint */}
      <div className="mt-8 bg-[#1F2937]/50 rounded-xl p-4 flex gap-3 text-xs text-gray-400">
        <Info className="w-4 h-4 shrink-0 text-[#F59E0B] mt-0.5" />
        <p>
          Клиент вводит код при записи через приложение. Скидка применяется к цене услуги.
          Каждый промокод привязан к вам — клиент указывает и код, и вашего мастера.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OWNER VIEW — team overview + manual code validator
// ═══════════════════════════════════════════════════════════════════════════

function OwnerView() {
  const { salon } = useSalon();
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);

  const { data: team } = useQuery<{ items: TeamMember[]; total: number }>({
    queryKey: ["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const members = team?.items ?? [];

  async function handleValidate() {
    if (!selectedMasterId || !codeInput.trim()) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const r = await api.post<ValidateResult>("/promocodes/validate", {
        master_id: selectedMasterId,
        code: codeInput.toUpperCase().trim(),
      });
      setValidateResult(r.data);
    } catch {
      setValidateResult({ valid: false, discount_pct: null, promocode_id: null, error: "not_found" });
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Акции и промокоды</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Каждый мастер управляет своими промокодами самостоятельно
        </p>
      </div>

      {/* Team + status */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-white mb-3">Команда</h2>
        {!members.length ? (
          <p className="text-gray-500 text-sm">Нет мастеров в команде</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="bg-[#1F2937] rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] text-xs font-bold shrink-0">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo_url}
                      alt={fullName(m)}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials(m)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{fullName(m)}</p>
                  <p className="text-xs text-gray-500">{m.phone}</p>
                </div>
                <span className="text-xs text-gray-500 bg-[#111827] px-2.5 py-1 rounded-lg">
                  управляет сам
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validate tool */}
      <div className="bg-[#1F2937] rounded-2xl p-5 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-[#F59E0B]" />
          <h2 className="text-sm font-semibold text-white">Проверить промокод</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Убедитесь, что промокод активен и ещё не исчерпан перед тем как применить скидку вручную
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Мастер</label>
            <select
              className={inputCls}
              value={selectedMasterId}
              onChange={(e) => {
                setSelectedMasterId(e.target.value);
                setValidateResult(null);
              }}
            >
              <option value="">Выберите мастера…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Промокод</label>
            <input
              className={inputCls + " uppercase font-mono tracking-widest"}
              placeholder="SUMMER20"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase());
                setValidateResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleValidate()}
              maxLength={20}
            />
          </div>
          <button
            onClick={handleValidate}
            disabled={!selectedMasterId || !codeInput.trim() || validating}
            className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {validating ? "Проверяем…" : "Проверить"}
          </button>
        </div>

        {/* Result */}
        {validateResult && (
          <div
            className={`mt-4 rounded-xl p-4 flex items-start gap-3 ${
              validateResult.valid
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}
          >
            {validateResult.valid ? (
              <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              {validateResult.valid ? (
                <>
                  <p className="text-green-400 font-semibold text-sm">Промокод действителен</p>
                  <p className="text-green-300/70 text-xs mt-0.5">
                    Скидка: <strong>{validateResult.discount_pct}%</strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-red-400 font-semibold text-sm">Промокод недействителен</p>
                  <p className="text-red-300/70 text-xs mt-0.5">
                    {ERROR_LABELS[validateResult.error ?? ""] ?? "Неизвестная ошибка"}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 bg-[#1F2937]/50 rounded-xl p-4 flex gap-3 text-xs text-gray-400">
        <Info className="w-4 h-4 shrink-0 text-[#F59E0B] mt-0.5" />
        <p>
          Мастера создают промокоды в разделе «Акции» своего аккаунта. Клиент вводит код
          при онлайн-записи — скидка применяется автоматически.
        </p>
      </div>
    </div>
  );
}
