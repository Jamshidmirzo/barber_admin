"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, MapPin, Scissors, UserRound, Calendar, Wallet, Clock } from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

interface VisitHistoryItem {
  appointment_id: string;
  date: string;
  barber_name: string;
  service_name: string | null;
  amount: number;
}

interface FavoriteRef {
  id: string;
  name: string;
  count: number;
}

interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  city_id: string | null;
  city_name: string | null;
  total_visits: number;
  total_spent: number;
  first_visit: string | null;
  last_visit: string | null;
  favorite_barber: FavoriteRef | null;
  favorite_service: FavoriteRef | null;
  visits_history: VisitHistoryItem[];
}

function fmtMoney(n: number) {
  return n.toLocaleString("ru") + " сум";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function ClientDetailPage() {
  const { salon } = useSalon();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const { data, isLoading, isError } = useQuery<ClientDetail>({
    queryKey: ["salon-client", salon.id, clientId],
    queryFn: () => api.get(`/salons/${salon.id}/clients/${clientId}`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-6 w-24 bg-white/10 rounded animate-pulse mb-6" />
        <div className="bg-[#1F2937] rounded-2xl h-32 animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <BackLink />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <UserRound className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">Клиент не найден</p>
        </div>
      </div>
    );
  }

  const idle = daysSince(data.last_visit);
  const idleColor =
    idle === null ? "" : idle > 60 ? "bg-red-500/15 text-red-400" : idle > 30 ? "bg-yellow-500/15 text-yellow-400" : "bg-green-500/15 text-green-400";

  return (
    <div className="p-8 max-w-4xl">
      <BackLink />

      {/* Шапка */}
      <div className="bg-[#1F2937] rounded-2xl p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B] font-bold text-lg flex items-center justify-center shrink-0">
            {initials(data.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">{data.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {data.phone}</span>
              {data.city_name && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {data.city_name}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {data.favorite_barber && (
                <span className="flex items-center gap-1.5 text-xs bg-white/5 text-gray-300 px-3 py-1.5 rounded-lg">
                  <UserRound className="w-3.5 h-3.5 text-[#F59E0B]" /> Любимый барбер: <b className="text-white font-medium">{data.favorite_barber.name}</b>
                </span>
              )}
              {data.favorite_service && (
                <span className="flex items-center gap-1.5 text-xs bg-white/5 text-gray-300 px-3 py-1.5 rounded-lg">
                  <Scissors className="w-3.5 h-3.5 text-[#F59E0B]" /> Любимая услуга: <b className="text-white font-medium">{data.favorite_service.name}</b>
                </span>
              )}
            </div>
          </div>
          {idle !== null && (
            <span className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg ${idleColor}`}>
              {idle === 0 ? "Был сегодня" : `Не приходил ${idle} дн.`}
            </span>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={<Calendar className="w-4 h-4" />} label="Визиты" value={String(data.total_visits)} />
        <Kpi icon={<Wallet className="w-4 h-4" />} label="Выручка" value={fmtMoney(data.total_spent)} />
        <Kpi icon={<Clock className="w-4 h-4" />} label="Первый визит" value={fmtDate(data.first_visit)} />
        <Kpi icon={<Clock className="w-4 h-4" />} label="Последний визит" value={fmtDate(data.last_visit)} />
      </div>

      {/* История визитов */}
      <div className="bg-[#1F2937] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-white font-semibold text-sm">История визитов</h2>
        </div>
        {data.visits_history.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">Пока нет завершённых визитов</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-white/5">
                <th className="text-left font-medium px-5 py-3">Дата</th>
                <th className="text-left font-medium px-5 py-3">Барбер</th>
                <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Услуга</th>
                <th className="text-right font-medium px-5 py-3">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {data.visits_history.map((v) => (
                <tr key={v.appointment_id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-gray-300">{fmtDateTime(v.date)}</td>
                  <td className="px-5 py-3 text-gray-300">{v.barber_name}</td>
                  <td className="px-5 py-3 text-gray-400 hidden sm:table-cell">{v.service_name ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-white">{fmtMoney(v.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
      <ArrowLeft className="w-4 h-4" /> К клиентам
    </Link>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#1F2937] rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1.5">{icon} {label}</div>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  );
}
