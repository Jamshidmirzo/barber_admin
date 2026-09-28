"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HayrliMark } from "@/components/HayrliLogo";

const PATH_TO_KEY: Array<{ prefix: string; itemKey: string }> = [
  { prefix: "/dashboard",  itemKey: "overview"    },
  { prefix: "/schedule",   itemKey: "schedule"    },
  { prefix: "/clients",    itemKey: "clients"     },
  { prefix: "/services",   itemKey: "services"    },
  { prefix: "/barbers",    itemKey: "barbers"     },
  { prefix: "/analytics",  itemKey: "analytics"   },
  { prefix: "/finance",    itemKey: "finance"     },
  { prefix: "/profile",    itemKey: "profile"     },
  { prefix: "/onboarding", itemKey: "onboarding"  },
];

export function MobileTopbar({ onOpen, salonName }: { onOpen: () => void; salonName?: string }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const match = PATH_TO_KEY.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));

  let title = salonName || "";
  if (match) {
    try {
      title = t(`items.${match.itemKey}`);
    } catch {
      // key not defined for that route (e.g. /profile) — fall back to salon name
      title = salonName || "";
    }
  }

  return (
    <header
      className="only-on-mobile"
      style={{
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("openMenu")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        <Menu size={18} />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <HayrliMark style={{ width: 16, height: 15, color: "#0a0a0b" }} />
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
      </div>
    </header>
  );
}
