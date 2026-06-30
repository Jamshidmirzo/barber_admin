"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Scissors, Calendar, UserRound, Clock, TrendingUp, Settings, LogOut } from "lucide-react";
import { useAuth, logout } from "@/hooks/useAuth";

const nav = [
  { href: "/barbers", label: "Барберы", icon: Users },
  { href: "/services", label: "Услуги", icon: Scissors },
  { href: "/appointments", label: "Записи", icon: Calendar },
  { href: "/clients", label: "Клиенты", icon: UserRound },
  { href: "/schedule", label: "Расписание", icon: Clock },
  { href: "/finance", label: "Финансы", icon: TrendingUp },
  { href: "/profile", label: "Профиль", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuth();
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[#111827]">
      <aside className="w-60 shrink-0 bg-[#1F2937] flex flex-col">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">BarberAdmin</p>
              <p className="text-gray-500 text-xs">Панель управления</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
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
  );
}
