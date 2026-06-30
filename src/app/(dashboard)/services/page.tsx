"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Scissors } from "lucide-react";
import api from "@/lib/api";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_min: number;
  category: string | null;
  is_active: boolean;
}

const CATEGORIES = ["haircut", "beard", "coloring", "treatment", "other"];
const CAT_LABELS: Record<string, string> = {
  haircut: "Стрижка",
  beard: "Борода",
  coloring: "Окрашивание",
  treatment: "Уход",
  other: "Другое",
};

export default function ServicesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", duration_min: "30", category: "haircut" });
  const [formErr, setFormErr] = useState("");

  const { data, isLoading } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get("/services").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; price: number; duration_min: number; category: string }) =>
      api.post("/services", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      setShowModal(false);
      setForm({ name: "", price: "", duration_min: "30", category: "haircut" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Ошибка создания";
      setFormErr(msg);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Услуги</h1>
          <p className="text-gray-400 text-sm mt-0.5">{data?.length ?? 0} услуг</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormErr(""); }}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить услугу
        </button>
      </div>

      {isLoading && (
        <div className="bg-[#1F2937] rounded-2xl overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-5 py-4 border-b border-white/5 animate-pulse flex gap-4">
              <div className="h-4 bg-white/10 rounded w-40" />
              <div className="h-4 bg-white/10 rounded w-20 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
            <Scissors className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">Нет услуг. Добавьте первую!</p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="bg-[#1F2937] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium px-5 py-3">Название</th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">Категория</th>
                <th className="text-left text-gray-400 font-medium px-5 py-3">Длительность</th>
                <th className="text-right text-gray-400 font-medium px-5 py-3">Цена</th>
                <th className="text-right text-gray-400 font-medium px-5 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => (
                <tr key={s.id} className={i < data.length - 1 ? "border-b border-white/5" : ""}>
                  <td className="px-5 py-4 text-white font-medium">{s.name}</td>
                  <td className="px-5 py-4 text-gray-400">{s.category ? (CAT_LABELS[s.category] ?? s.category) : "—"}</td>
                  <td className="px-5 py-4 text-gray-400">{s.duration_min} мин</td>
                  <td className="px-5 py-4 text-right text-[#F59E0B] font-semibold tabular-nums">
                    {s.price.toLocaleString()} сум
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.is_active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-500"}`}>
                      {s.is_active ? "Активна" : "Скрыта"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Новая услуга</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Название</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Мужская стрижка"
                  className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Цена (сум)</label>
                  <input
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="50000"
                    type="number"
                    min={0}
                    className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Длительность (мин)</label>
                  <input
                    value={form.duration_min}
                    onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                    placeholder="30"
                    type="number"
                    min={5}
                    className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Категория</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full bg-[#111827] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CAT_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              {formErr && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{formErr}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setFormErr("");
                    createMutation.mutate({
                      name: form.name,
                      price: Number(form.price),
                      duration_min: Number(form.duration_min),
                      category: form.category,
                    });
                  }}
                  disabled={createMutation.isPending || !form.name || !form.price}
                  className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {createMutation.isPending ? "Создаём..." : "Создать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
