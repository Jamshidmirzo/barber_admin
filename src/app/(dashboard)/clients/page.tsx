"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  Search,
  UserRound,
  Download,
  ChevronRight,
  Trophy,
  Share2,
  Check,
} from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useSalon, isManager } from "@/hooks/useSalon";

interface City {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
}

function fmtMoney(n: number) {
  return n.toLocaleString("ru") + " сум";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export default function ClientsPage() {
  const { salon, role } = useSalon();
  if (!isManager(role)) return <PersonalClients />;
  return <CrmClients salonId={salon.id} salonName={salon.name} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Менеджерская CRM-витрина: агрегаты, фильтры, рейтинг лояльности, экспорт
// ─────────────────────────────────────────────────────────────────────────────

interface SalonClient {
  id: string;
  name: string;
  phone: string;
  city_id: string | null;
  city_name: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_date: string | null;
  loyalty: "gold" | "silver" | null;
}

interface ClientPage {
  items: SalonClient[];
  total: number;
  page: number;
  limit: number;
}

interface LoyaltyItem {
  rank: number;
  client_id: string;
  name: string;
  phone: string;
  total_visits: number;
  total_spent: number;
}

type Sort = "visits" | "revenue" | "last_visit";
type Tab = "list" | "rating";

const SORT_LABELS: Record<Sort, string> = {
  visits: "По визитам",
  revenue: "По выручке",
  last_visit: "По дате",
};

function LoyaltyBadge({ loyalty }: { loyalty: SalonClient["loyalty"] }) {
  if (loyalty === "gold") return <span title="Топ-10% по визитам">🥇</span>;
  if (loyalty === "silver") return <span title="Топ-30% по визитам">🥈</span>;
  return null;
}

function CrmClients({ salonId, salonName }: { salonId: string; salonName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("list");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cityId, setCityId] = useState<string>("");
  const [sort, setSort] = useState<Sort>("visits");
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: cities } = useQuery<City[]>({
    queryKey: ["cities"],
    queryFn: () => api.get("/cities").then((r) => r.data),
    staleTime: 30 * 60_000,
  });

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ClientPage>({
    queryKey: ["salon-clients", salonId, debounced, cityId, sort],
    queryFn: ({ pageParam }) =>
      api
        .get(`/salons/${salonId}/clients`, {
          params: {
            search: debounced || undefined,
            city_id: cityId || undefined,
            sort,
            page: pageParam,
            limit: 20,
          },
        })
        .then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? last.page + 1 : undefined;
    },
    enabled: tab === "list",
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const { data: loyalty, isLoading: loyaltyLoading } = useQuery<{ items: LoyaltyItem[] }>({
    queryKey: ["salon-clients-loyalty", salonId],
    queryFn: () => api.get(`/salons/${salonId}/clients/loyalty`, { params: { limit: 20 } }).then((r) => r.data),
    enabled: tab === "rating",
  });

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get(`/salons/${salonId}/clients/export`, {
        params: { search: debounced || undefined, city_id: cityId || undefined, sort },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // тихо — кнопка не блокирует основную работу
    } finally {
      setExporting(false);
    }
  }

  function shareRating() {
    const list = loyalty?.items ?? [];
    if (list.length === 0) return;
    const medals = ["🥇", "🥈", "🥉"];
    const lines = list
      .slice(0, 10)
      .map((c, i) => `${medals[i] ?? `${c.rank}.`} ${c.name} — ${c.total_visits} визит${plural(c.total_visits, "", "а", "ов")}`)
      .join("\n");
    const text = `🏆 Самые лояльные клиенты ${salonName}:\n\n${lines}\n\nСпасибо, что выбираете нас! 💈`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Клиенты</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} клиентов в базе салона</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" /> {exporting ? "Готовим..." : "Экспорт CSV"}
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 mb-5 bg-[#1F2937] p-1 rounded-xl w-fit">
        {(["list", "rating"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              tab === t ? "bg-[#F59E0B] text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "rating" && <Trophy className="w-4 h-4" />}
            {t === "list" ? "Все клиенты" : "Рейтинг лояльности"}
          </button>
        ))}
      </div>

      {tab === "list" ? (
        <>
          {/* Панель фильтров */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени или телефону"
                className="w-full bg-[#1F2937] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
              />
            </div>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="bg-[#1F2937] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] sm:w-44"
            >
              <option value="">Все города</option>
              {cities?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="bg-[#1F2937] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] sm:w-44"
            >
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                <option key={s} value={s}>{SORT_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Таблица */}
          {isLoading ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            <Empty text={debounced || cityId ? "Ничего не найдено" : "Нет клиентов"} />
          ) : (
            <div className="bg-[#1F2937] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-white/5">
                    <th className="text-left font-medium px-4 py-3">Имя</th>
                    <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Телефон</th>
                    <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Город</th>
                    <th className="text-right font-medium px-4 py-3">Визиты</th>
                    <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">Выручка</th>
                    <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Последний</th>
                    <th className="px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/clients/${c.id}`)}
                      className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] font-semibold text-xs flex items-center justify-center shrink-0">
                            {initials(c.name)}
                          </div>
                          <span className="text-white font-medium flex items-center gap-1.5">
                            {c.name} <LoyaltyBadge loyalty={c.loyalty} />
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{c.city_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-white">{c.total_visits}</td>
                      <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">{fmtMoney(c.total_spent)}</td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{fmtDate(c.last_visit_date)}</td>
                      <td className="px-2"><ChevronRight className="w-4 h-4 text-gray-600" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasNextPage && (
            <div className="flex justify-center mt-5">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-300 text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
              >
                {isFetchingNextPage ? "Загрузка..." : "Показать ещё"}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm">Топ-20 клиентов по количеству визитов</p>
            <button
              onClick={shareRating}
              disabled={(loyalty?.items.length ?? 0) === 0}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Скопировано" : "Поделиться"}
            </button>
          </div>
          {loyaltyLoading ? (
            <ListSkeleton />
          ) : (loyalty?.items.length ?? 0) === 0 ? (
            <Empty text="Пока нет визитов для рейтинга" />
          ) : (
            <div className="space-y-2">
              {loyalty!.items.map((c) => (
                <div
                  key={c.client_id}
                  onClick={() => router.push(`/clients/${c.client_id}`)}
                  className="bg-[#1F2937] hover:bg-white/5 rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-colors"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                    c.rank === 1 ? "bg-[#F59E0B] text-white"
                    : c.rank <= 3 ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                    : "bg-white/5 text-gray-400"
                  }`}>
                    {c.rank <= 3 ? ["🥇", "🥈", "🥉"][c.rank - 1] : c.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{c.name}</p>
                    <p className="text-gray-500 text-xs truncate">{c.phone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white text-sm font-semibold">{c.total_visits} визит{plural(c.total_visits, "", "а", "ов")}</p>
                    <p className="text-gray-500 text-xs">{fmtMoney(c.total_spent)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-[#1F2937] rounded-2xl p-4 animate-pulse flex gap-4 items-center">
          <div className="w-9 h-9 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-white/10 rounded w-36" />
            <div className="h-3 bg-white/10 rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
        <UserRound className="w-8 h-8 text-gray-600" />
      </div>
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Личный список мастера (роль master) — поведение прежней страницы сохранено
// ─────────────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
}

function PersonalClients() {
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
    onError: (e: unknown) => setFormErr(parseApiError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; phone?: string; notes?: string } }) =>
      api.put(`/clients/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setEditing(null); },
    onError: (e: unknown) => setFormErr(parseApiError(e)),
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

      {isLoading && <ListSkeleton />}

      {!isLoading && items.length === 0 && (
        <Empty text={debounced ? "Ничего не найдено" : "Нет клиентов"} />
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
                <p className="text-gray-300 text-sm">{c.visit_count} визит{plural(c.visit_count, "", "а", "ов")}</p>
                <p className="text-gray-500 text-xs">{fmtDate(c.last_visit_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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
