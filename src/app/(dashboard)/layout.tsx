"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users, Scissors, Calendar, UserRound, Clock,
  TrendingUp, Settings, LogOut,
  BarChart3, Tag, Sun, Moon, LayoutDashboard,
} from "lucide-react";
import { useAuth, logout } from "@/hooks/useAuth";
import { SalonProvider, isManager, useSalonContextQuery } from "@/hooks/useSalon";

const NAV_GROUPS = [
  {
    label: "Главное",
    items: [
      { href: "/dashboard",      label: "Обзор",         icon: LayoutDashboard, managerOnly: true,  masterOnly: false },
      { href: "/appointments",   label: "Записи",        icon: Calendar,   managerOnly: false, masterOnly: false },
      { href: "/schedule",       label: "Расписание",    icon: Clock,      managerOnly: false, masterOnly: false },
      { href: "/promotions",     label: "Акции",         icon: Tag,        managerOnly: false, masterOnly: true  },
    ],
  },
  {
    label: "Клиентура",
    items: [
      { href: "/clients",        label: "Клиенты",       icon: UserRound,  managerOnly: false, masterOnly: false },
      { href: "/services",       label: "Услуги",        icon: Scissors,   managerOnly: false, masterOnly: false },
      { href: "/barbers",        label: "Мастера",       icon: Users,      managerOnly: true,  masterOnly: false },
    ],
  },
  {
    label: "Бизнес",
    managerOnly: true,
    items: [
      { href: "/analytics",      label: "Аналитика",     icon: BarChart3,  managerOnly: true,  masterOnly: false },
      { href: "/finance",        label: "Финансы",       icon: TrendingUp, managerOnly: true,  masterOnly: false },
    ],
  },
];

// flat list used for route-blocking checks
const nav = NAV_GROUPS.flatMap(g => g.items);

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

function NavBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"8px",
        borderRadius:"var(--radius)", background: hov ? "rgba(255,255,255,0.06)" : "transparent",
        border:"1px solid var(--border)", cursor:"pointer", color: hov ? "var(--text)" : "var(--text2)",
        fontSize:13, fontWeight:500, flex:1,
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
            {NAV_GROUPS.filter(g => !g.managerOnly || canManage).map((group) => {
              const groupItems = group.items.filter(item => {
                if (item.managerOnly && !canManage) return false;
                if (item.masterOnly && canManage) return false;
                return true;
              });
              if (groupItems.length === 0) return null;
              return (
                <div key={group.label} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--text3)", padding: "12px 10px 5px", fontWeight: 600 }}>
                    {group.label}
                  </div>
                  {groupItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return <NavLink key={href} href={href} active={active} icon={Icon} label={label} />;
                  })}
                </div>
              );
            })}
          </nav>

          {/* Bottom */}
          <div style={S.bottom}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <NavBtn onClick={() => setDark((d) => !d)} title={dark ? "Светлая тема" : "Тёмная тема"}>
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </NavBtn>
              <LogoutBtn />
            </div>
            <Link
              href="/profile"
              style={{ display:"flex", alignItems:"center", gap:11, padding:"8px", border:"1px solid var(--border)", background:"var(--surface)", borderRadius:12, cursor:"pointer", textDecoration:"none" }}
            >
              <span style={{ width:34, height:34, flexShrink:0, borderRadius:9, background:"var(--gold-dim)", border:"1px solid var(--gold-dim2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"var(--gold)" }}>
                {(data.salon.name || "?")[0].toUpperCase()}
              </span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:"block", fontWeight:600, fontSize:13, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {data.salon.name}
                </span>
                <span style={{ display:"block", fontSize:11, color:"var(--text3)" }}>
                  {canManage ? "Владелец" : "Мастер"}
                </span>
              </span>
            </Link>
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
        position: "relative",
        display:"flex", alignItems:"center", gap:12, padding:"9px 11px",
        borderRadius:"var(--radius)", textDecoration:"none",
        color: active ? "var(--text)" : hov ? "var(--text)" : "var(--text2)",
        background: active ? "var(--gold-dim)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        fontSize:13, fontWeight: active ? 600 : 500,
        transition:"background 0.15s, color 0.15s",
      }}
    >
      {active && (
        <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: "var(--gold)", borderRadius: "0 3px 3px 0" }} />
      )}
      <Icon size={14} style={{ flexShrink:0, color: active ? "var(--gold)" : undefined }} />
      {label}
    </Link>
  );
}

function LogoutBtn() {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={logout}
      title="Выйти"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", padding:"8px",
        borderRadius:"var(--radius)",
        background: hov ? "rgba(224,90,90,0.08)" : "transparent",
        border:"1px solid var(--border)", cursor:"pointer",
        color: hov ? "var(--red)" : "var(--text2)",
        flex:1,
        transition:"background 0.15s, color 0.15s",
      }}
    >
      <LogOut size={14} />
    </button>
  );
}
