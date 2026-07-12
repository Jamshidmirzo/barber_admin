"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { locales, localeLabels, localeCookieName, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function select(next: Locale) {
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={localeLabels[locale]}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px",
          borderRadius: "var(--radius)", background: hov || open ? "rgba(255,255,255,0.06)" : "transparent",
          border: "1px solid var(--border)", cursor: "pointer", color: hov || open ? "var(--text)" : "var(--text2)",
          fontSize: 11, fontWeight: 600, width: "100%",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <Globe size={14} />
        {locale.toUpperCase()}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 0, minWidth: 150, zIndex: 50,
            background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden", padding: 4,
          }}
        >
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => select(l)}
              style={{
                display: "flex", width: "100%", padding: "7px 9px", borderRadius: 8, border: "none",
                background: l === locale ? "var(--gold-dim)" : "transparent",
                color: l === locale ? "var(--gold)" : "var(--text2)",
                fontSize: 13, fontWeight: l === locale ? 600 : 500, cursor: "pointer", textAlign: "left",
              }}
            >
              {localeLabels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
