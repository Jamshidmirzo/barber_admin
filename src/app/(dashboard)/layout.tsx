"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users, Scissors, Calendar, UserRound, Clock,
  TrendingUp, Settings, LogOut, Sparkles, Globe,
  BarChart3, Tag, Sun, Moon,
} from "lucide-react";
import { useAuth, logout } from "@/hooks/useAuth";
import { SalonProvider, isManager, useSalonContextQuery } from "@/hooks/useSalon";

const nav = [
  { href: "/barbers",        label: "Барберы",         icon: Users,      managerOnly: true,  masterOnly: false },
  { href: "/services",       label: "Услуги",           icon: Scissors,   managerOnly: false, masterOnly: false },
  { href: "/appointments",   label: "Записи",           icon: Calendar,   managerOnly: false, masterOnly: false },
  { href: "/clients",        label: "Клиенты",          icon: UserRound,  managerOnly: false, masterOnly: false },
  { href: "/analytics",      label: "Аналитика",        icon: BarChart3,  managerOnly: true,  masterOnly: false },
  { href: "/schedule",       label: "Расписание",       icon: Clock,      managerOnly: false, masterOnly: false },
  { href: "/promotions",     label: "Акции",            icon: Tag,        managerOnly: false, masterOnly: true  },
  { href: "/site-generator", label: "Сайт (AI)",        icon: Sparkles,   managerOnly: true,  masterOnly: false },
  { href: "/site-settings",  label: "Настройки сайта",  icon: Globe,      managerOnly: true,  masterOnly: false },
  { href: "/finance",        label: "Финансы",          icon: TrendingUp, managerOnly: true,  masterOnly: false },
  { href: "/profile",        label: "Профиль",          icon: Settings,   managerOnly: false, masterOnly: false },
];

const S = {
  root: { display:"flex", height:"100vh", background:"var(--bg)" } as React.CSSProperties,
  aside: {
    width: "var(--sidebar-w)", minWidth: "var(--sidebar-w)",
    background: "var(--bg2)", borderRight: "1px solid var(--border)",
    display:"flex", flexDirection:"column", overflow:"hidden",
  } as React.CSSProperties,
  logo: { padding:"22px 18px 18px", borderBottom:"1px solid var(--border)" } as React.CSSProperties,
  logoRow: { display:"flex", alignItems:"center", gap:12 } as React.CSSProperties,
  logoIcon: {
    width:38, height:38, borderRadius:10, background:"var(--gold)",
    display:"flex", alignItems:"center", justifyContent:"center",
    overflow:"hidden", flexShrink:0,
  } as React.CSSProperties,
  nav: { flex:1, padding:"10px 8px", overflowY:"auto", display:"flex", flexDirection:"column", gap:1 } as React.CSSProperties,
  bottom: { padding:"8px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:1 } as React.CSSProperties,
  main: { flex:1, overflowY:"auto" } as React.CSSProperties,
};

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
        borderRadius:"var(--radius)", background: hov ? "rgba(255,255,255,0.04)" : "transparent",
        border:"none", cursor:"pointer", color: hov ? "var(--text)" : "var(--text2)",
        fontSize:13, fontWeight:500, width:"100%", textAlign:"left",
        transition:"background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError, error } = useSalonContextQuery();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  const status = (error as { response?: { status?: number } })?.response?.status;
  useEffect(() => {
    if (isError && status === 404) router.replace("/onboarding");
  }, [isError, status, router]);

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
      <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
        <div style={{
          width:32, height:32, borderRadius:"50%",
          border:"2px solid var(--border)", borderTopColor:"var(--gold)",
          animation:"spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"0 24px" }}>
        <div style={{ textAlign:"center" }}>
          <p style={{ color:"var(--text)", fontWeight:600, marginBottom:4 }}>Не удалось загрузить салон</p>
          <p style={{ color:"var(--text2)", fontSize:13 }}>Проверьте подключение и обновите страницу.</p>
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
      <div style={S.root}>

        <aside style={S.aside}>
          {/* Logo */}
          <div style={S.logo}>
            <div style={S.logoRow}>
              <div style={S.logoIcon}>
                {data.salon.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.salon.avatar_url} alt={data.salon.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                ) : (
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, color:"#0a0a0b" }}>H</span>
                )}
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ color:"var(--text)", fontWeight:600, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }} title={data.salon.name}>
                  {data.salon.name}
                </p>
                <p style={{ color:"var(--text3)", fontSize:11, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {data.salon.slug}.hayrli.app
                </p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={S.nav}>
            {visibleNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <NavLink key={href} href={href} active={active} icon={Icon} label={label} />
              );
            })}
          </nav>

          {/* Bottom */}
          <div style={S.bottom}>
            <NavBtn onClick={() => setDark((d) => !d)}>
              {dark ? <Sun size={14} /> : <Moon size={14} />}
              {dark ? "Светлая тема" : "Тёмная тема"}
            </NavBtn>
            <LogoutBtn />
          </div>
        </aside>

        <main style={S.main}>{children}</main>
      </div>
    </SalonProvider>
  );
}

function NavLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: React.ElementType; label: string }) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
        borderRadius:"var(--radius)", textDecoration:"none",
        color: active ? "var(--gold)" : hov ? "var(--text)" : "var(--text2)",
        background: active ? "var(--gold-dim)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        fontSize:13, fontWeight: active ? 600 : 500,
        transition:"background 0.15s, color 0.15s",
      }}
    >
      <Icon size={14} style={{ flexShrink:0 }} />
      {label}
    </Link>
  );
}

function LogoutBtn() {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={logout}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
        borderRadius:"var(--radius)",
        background: hov ? "rgba(224,90,90,0.08)" : "transparent",
        border:"none", cursor:"pointer",
        color: hov ? "var(--red)" : "var(--text2)",
        fontSize:13, fontWeight:500, width:"100%", textAlign:"left",
        transition:"background 0.15s, color 0.15s",
      }}
    >
      <LogOut size={14} />
      Выйти
    </button>
  );
}
