"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserX, Eye, EyeOff, Copy, Check, Search, UserCheck, ChevronRight } from "lucide-react";
import api from "@/lib/api";

interface Barber {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
  is_active: boolean;
  is_blocked: boolean;
  specializations: string[];
}

interface SearchResult {
  id: string;
  phone: string;
  name: string | null;
  last_name: string | null;
  photo_url: string | null;
  specializations: string[];
  is_already_in_team: boolean;
}

function initials(b: Barber | SearchResult) {
  const n = [b.name, b.last_name].filter(Boolean).join(" ");
  return n ? n.slice(0, 2).toUpperCase() : b.phone.slice(-2);
}

function fullName(b: Barber | SearchResult) {
  return [b.name, b.last_name].filter(Boolean).join(" ") || "—";
}

interface TeamMemberStat {
  master_id: string;
  name: string;
  photo_url: string | null;
  total_revenue: number;
  total_appointments: number;
  worked_hours: number;
}

function fmtMoney(n: number) {
  return n.toLocaleString("ru") + " сум";
}

type ModalTab = "create" | "search";

export default function BarbersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<ModalTab>("create");
  const [created, setCreated] = useState<{ phone: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: "", last_name: "", phone: "+998", password: "" });
  const [formErr, setFormErr] = useState("");

  // Search tab state
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery<{ items: Barber[]; total: number }>({
    queryKey: ["team-members"],
    queryFn: () => api.get("/team/members").then((r) => r.data),
  });

  const { data: teamStats } = useQuery<{ members: TeamMemberStat[] }>({
    queryKey: ["team-stats", "30d"],
    queryFn: () => api.get("/team/stats").then((r) => r.data),
  });

  const statsById = new Map((teamStats?.members ?? []).map((m) => [m.master_id, m]));

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post("/team/members", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setCreated({ phone: form.phone, password: form.password });
      setForm({ name: "", last_name: "", phone: "+998", password: "" });
      setShowModal(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Ошибка создания";
      setFormErr(msg);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
  });

  const transferMutation = useMutation({
    mutationFn: (master_id: string) => api.post("/team/transfer", { master_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setShowModal(false);
      setSearchQ("");
      setSearchResults([]);
    },
  });

  useEffect(() => {
    if (searchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/team/search", { params: { q: searchQ } });
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchQ]);

  function openModal() {
    setShowModal(true);
    setTab("create");
    setFormErr("");
    setSearchQ("");
    setSearchResults([]);
  }

  function copyCreated() {
    if (!created) return;
    navigator.clipboard.writeText(`Телефон: ${created.phone}\nПароль: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Барберы</h1>
          <p className="text-gray-400 text-sm mt-0.5">{data?.total ?? 0} сотрудников</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить барбера
        </button>
      </div>

      {/* Credential banner */}
      {created && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-green-400 text-sm font-semibold mb-1">Барбер создан — передайте данные для входа:</p>
            <p className="text-white text-sm font-mono">📱 {created.phone}</p>
            <p className="text-white text-sm font-mono">🔑 {created.password}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={copyCreated} className="flex items-center gap-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs px-3 py-1.5 rounded-lg transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
            <button onClick={() => setCreated(null)} className="text-gray-500 hover:text-white text-xs px-2">✕</button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1F2937] rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-white/10 rounded w-28" />
                  <div className="h-3 bg-white/10 rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">Нет барберов. Добавьте первого!</p>
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((b) => {
            const st = statsById.get(b.id);
            return (
              <Link
                key={b.id}
                href={`/barbers/${b.id}`}
                className="group bg-[#1F2937] hover:bg-[#243040] rounded-2xl p-5 block transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] font-bold text-sm shrink-0">
                    {initials(b)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{fullName(b)}</p>
                    <p className="text-gray-400 text-xs tabular-nums">{b.phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${b.is_active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-500"}`}>
                    {b.is_active ? "Активен" : "Неактивен"}
                  </span>
                </div>
                {b.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {b.specializations.map((s) => (
                      <span key={s} className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}

                {/* Метрики за 30 дней */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#111827] rounded-xl px-3 py-2">
                    <p className="text-gray-500 text-[10px] mb-0.5">Выручка 30д</p>
                    <p className="text-white text-sm font-semibold truncate">{fmtMoney(st?.total_revenue ?? 0)}</p>
                  </div>
                  <div className="bg-[#111827] rounded-xl px-3 py-2">
                    <p className="text-gray-500 text-[10px] mb-0.5">Записи 30д</p>
                    <p className="text-white text-sm font-semibold">{st?.total_appointments ?? 0}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {b.is_active ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        deactivateMutation.mutate(b.id);
                      }}
                      disabled={deactivateMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Деактивировать
                    </button>
                  ) : (
                    <span />
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#F59E0B] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Добавить барбера</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#111827] rounded-xl p-1 mb-5">
              <button
                onClick={() => setTab("create")}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${tab === "create" ? "bg-[#F59E0B] text-white" : "text-gray-400 hover:text-white"}`}
              >
                Создать нового
              </button>
              <button
                onClick={() => setTab("search")}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${tab === "search" ? "bg-[#F59E0B] text-white" : "text-gray-400 hover:text-white"}`}
              >
                Найти в системе
              </button>
            </div>

            {/* Tab: Create */}
            {tab === "create" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Имя</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Алишер"
                      className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Фамилия</label>
                    <input
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      placeholder="Каримов"
                      className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Телефон</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+998901234567"
                    type="tel"
                    className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Пароль</label>
                  <div className="relative">
                    <input
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      type={showPass ? "text" : "password"}
                      placeholder="Минимум 6 символов"
                      className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {formErr && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{formErr}</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors">
                    Отмена
                  </button>
                  <button
                    onClick={() => { setFormErr(""); createMutation.mutate(form); }}
                    disabled={createMutation.isPending || !form.phone || !form.password}
                    className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {createMutation.isPending ? "Создаём..." : "Создать"}
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Search */}
            {tab === "search" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Имя или телефон..."
                    className="w-full bg-[#111827] text-white rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                    autoFocus
                  />
                </div>

                {searching && (
                  <p className="text-gray-500 text-xs text-center py-4">Ищем...</p>
                )}

                {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-4">Никого не нашли</p>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 bg-[#111827] rounded-xl px-3 py-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] font-bold text-xs shrink-0">
                          {initials(r)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">{fullName(r)}</p>
                          <p className="text-gray-400 text-xs tabular-nums">{r.phone}</p>
                        </div>
                        {r.is_already_in_team ? (
                          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full shrink-0">
                            <UserCheck className="w-3 h-3" />
                            В команде
                          </span>
                        ) : (
                          <button
                            onClick={() => transferMutation.mutate(r.id)}
                            disabled={transferMutation.isPending}
                            className="text-xs bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                          >
                            Добавить
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {searchQ.length < 2 && (
                  <p className="text-gray-600 text-xs text-center py-6">Введите минимум 2 символа для поиска</p>
                )}

                <button onClick={() => setShowModal(false)} className="w-full bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors mt-2">
                  Закрыть
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
