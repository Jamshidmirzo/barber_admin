"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, Scissors, Calendar, UserRound, Clock, TrendingUp, Settings, LogOut, Sparkles, Globe, BarChart3, Tag } from "lucide-react";
import { useAuth, logout } from "@/hooks/useAuth";
import { SalonProvider, isManager, useSalonContextQuery } from "@/hooks/useSalon";

// managerOnly: только владелец/админ видит раздел.
// masterOnly: только мастер (барбер в составе салона) видит раздел.
const nav = [
  { href: "/barbers",       label: "Барберы",        icon: Users,    managerOnly: true,  masterOnly: false },
  { href: "/services",      label: "Услуги",          icon: Scissors, managerOnly: false, masterOnly: false },
  { href: "/appointments",  label: "Записи",          icon: Calendar, managerOnly: false, masterOnly: false },
  { href: "/clients",       label: "Клиенты",         icon: UserRound,managerOnly: false, masterOnly: false },
  { href: "/analytics",     label: "Аналитика",       icon: BarChart3,managerOnly: true,  masterOnly: false },
  { href: "/schedule",      label: "Расписание",      icon: Clock,    managerOnly: false, masterOnly: false },
  { href: "/promotions",    label: "Акции",           icon: Tag,      managerOnly: false, masterOnly: true  },
  { href: "/site-generator",label: "Сайт (AI)",       icon: Sparkles, managerOnly: true,  masterOnly: false },
  { href: "/site-settings", label: "Настройки сайта", icon: Globe,    managerOnly: true,  masterOnly: false },
  { href: "/finance",       label: "Финансы",         icon: TrendingUp,managerOnly: true, masterOnly: false },
  { href: "/profile",       label: "Профиль",         icon: Settings, managerOnly: false, masterOnly: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError, error } = useSalonContextQuery();

  // 404 → пользователь авторизован, но салона ещё нет → ведём на онбординг.
  // (401 уже перехватывает axios-интерсептор → /login.)
  const status = (error as { response?: { status?: number } })?.response?.status;
  useEffect(() => {
    if (isError && status === 404) {
      router.replace("/onboarding");
    }
  }, [isError, status, router]);

  // Route guard: неправильные роли → редиректим на «Записи».
  // Мастер не может зайти на managerOnly-разделы, менеджер — на masterOnly.
  const role = data?.role;
  useEffect(() => {
    if (!role) return;
    const manager = isManager(role);
    const blocked = nav.some((i) => {
      const match = pathname === i.href || pathname.startsWith(i.href + "/");
      if (!match) return false;
      if (i.managerOnly && !manager) return true;
      if (i.masterOnly && manager) return true;
      return false;
    });
    if (blocked) router.replace("/appointments");
  }, [role, pathname, router]);

  if (isLoading || (isError && status === 404)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111827]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#F59E0B]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111827] px-6">
        <div className="max-w-sm text-center">
          <p className="text-white font-semibold mb-1">Не удалось загрузить салон</p>
          <p className="text-gray-400 text-sm">Проверьте подключение и обновите страницу.</p>
        </div>
      </div>
    );
  }

  const canManage = isManager(data.role);
  const visibleNav = nav.filter((item) => {
    if (item.managerOnly && !canManage) return false;
    if (item.masterOnly && canManage) return false;
    return true;
  });

  return (
    <SalonProvider value={data}>
      <div className="flex h-screen bg-[#111827]">
        <aside className="w-60 shrink-0 bg-[#1F2937] flex flex-col">
          <div className="px-5 py-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-[#F59E0B] flex items-center justify-center overflow-hidden">
                {data.salon.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.salon.avatar_url}
                    alt={data.salon.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Scissors className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate" title={data.salon.name}>
                  {data.salon.name}
                </p>
                <p className="text-gray-500 text-xs truncate">
                  {data.salon.slug}.hayrli.app
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {visibleNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-white/5">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SalonProvider>
  );
}
