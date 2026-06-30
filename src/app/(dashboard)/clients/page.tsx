"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserRound } from "lucide-react";
import api from "@/lib/api";

interface Client {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery<{ items: Client[]; total: number }>({
    queryKey: ["clients", debounced],
    queryFn: () =>
      api.get("/clients", { params: { search: debounced || undefined, limit: 100, offset: 0 } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; phone: string; notes?: string }) => api.post("/clients", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setShowCreate(false); resetForm(); },
    onError: (e: unknown) => setFormErr(errMsg(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; phone?: string; notes?: string } }) =>
      api.put(`/clients/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setEditing(null); },
    onError: (e: unknown) => setFormErr(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setEditing(null); },
  });

  function resetForm() { setForm({ name: "", phone: "", notes: "" }); setFormErr(""); }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, notes: c.notes ?? "" });
    setFormErr("");
  }

  function errMsg(e: unknown) {
    return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Ошибка";
  }

  const items = data?.items ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Клиенты</h1>
          <p className="text-gray-400 text-sm mt-0.5">{data?.total ?? 0} клиентов</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); resetForm(); }}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full bg-[#1F2937] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#1F2937] rounded-2xl p-4 animate-pulse flex gap-4 items-center">
              <div className="w-11 h-11 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-white/10 rounded w-36" />
                <div className="h-3 bg-white/10 rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
            <UserRound className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">{debounced ? "Ничего не найдено" : "Нет клиентов"}</p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((c) => (
            <div
              key={c.id}
              onClick={() => openEdit(c)}
              className="bg-[#1F2937] hover:bg-white/5 rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] font-semibold text-sm flex items-center justify-center shrink-0">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium text-sm truncate">{c.name}</p>
                <p className="text-gray-400 text-xs truncate">{c.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-300 text-sm">{c.visit_count} визит{c.visit_count === 1 ? "" : c.visit_count < 5 ? "а" : "ов"}</p>
                <p className="text-gray-500 text-xs">{fmtDate(c.last_visit_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Новый клиент" onClose={() => setShowCreate(false)}>
          <ClientForm
            form={form}
            setForm={setForm}
            formErr={formErr}
            onSubmit={() => {
              setFormErr("");
              createMutation.mutate({ name: form.name, phone: form.phone, notes: form.notes || undefined });
            }}
            onCancel={() => setShowCreate(false)}
            loading={createMutation.isPending}
            submitLabel="Создать"
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Редактировать клиента" onClose={() => setEditing(null)}>
          <ClientForm
            form={form}
            setForm={setForm}
            formErr={formErr}
            onSubmit={() => {
              setFormErr("");
              updateMutation.mutate({ id: editing.id, body: { name: form.name, phone: form.phone, notes: form.notes || undefined } });
            }}
            onCancel={() => setEditing(null)}
            loading={updateMutation.isPending}
            submitLabel="Сохранить"
          />
          <div className="mt-3 pt-3 border-t border-white/5">
            <button
              onClick={() => {
                if (confirm(`Удалить клиента "${editing.name}"?`)) deleteMutation.mutate(editing.id);
              }}
              disabled={deleteMutation.isPending}
              className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Удаляем..." : "Удалить клиента"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ClientForm({
  form, setForm, formErr, onSubmit, onCancel, loading, submitLabel,
}: {
  form: { name: string; phone: string; notes: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; notes: string }>>;
  formErr: string;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      {(["name", "phone"] as const).map((field) => (
        <div key={field}>
          <label className="block text-xs text-gray-400 mb-1.5">{field === "name" ? "Имя" : "Телефон"}</label>
          <input
            value={form[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
            placeholder={field === "name" ? "Иван Иванов" : "+998901234567"}
            className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
          />
        </div>
      ))}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Заметки</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Необязательно"
          rows={2}
          className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600 resize-none"
        />
      </div>
      {formErr && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{formErr}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors">
          Отмена
        </button>
        <button
          onClick={onSubmit}
          disabled={loading || !form.name || !form.phone}
          className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? "..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
