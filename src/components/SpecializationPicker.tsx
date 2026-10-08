"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { Check, Search } from "lucide-react";
import api from "@/lib/api";

/**
 * Phase-3 specialization picker — modal grid of catalog thumbnails that
 * the services page uses to attach a spec_id to a new/edited service.
 *
 * Consumes GET /v1/catalog/specializations with the active locale.
 * Falls back silently to an empty grid when the backend doesn't ship
 * the Phase-3 catalog yet (older deploy); the caller can still save
 * the service — spec_id is nullable server-side.
 */
interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  native_name: string | null;
  thumb_url: string | null;
  aliases: string[];
}

interface CatalogResponse {
  version: string;
  categories: unknown[];
  items: CatalogItem[];
}

interface SpecializationPickerProps {
  value: string | null;
  onChange: (specId: string | null) => void;
  disabled?: boolean;
}

export function SpecializationPicker({ value, onChange, disabled }: SpecializationPickerProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data } = useQuery<CatalogResponse>({
    queryKey: ["catalog-specializations", locale],
    queryFn: () =>
      api
        .get("/catalog/specializations", { params: { lang: locale } })
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const items = data?.items ?? [];
  const picked = useMemo(
    () => items.find((i) => i.id === value) ?? null,
    [items, value],
  );
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.native_name?.toLowerCase().includes(q) ||
        i.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [items, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "10px 12px", cursor: disabled ? "default" : "pointer",
          color: "var(--text)", fontFamily: "'Manrope',sans-serif", fontSize: 14,
        }}
      >
        {picked?.thumb_url ? (
          <img
            src={picked.thumb_url}
            alt=""
            width={32}
            height={32}
            style={{ borderRadius: 6, objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: "var(--surface)",
          }} />
        )}
        <span style={{ flex: 1, textAlign: "left" }}>
          {picked ? picked.name : "— Pick a specialization —"}
        </span>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg)", borderRadius: 16, width: "100%",
              maxWidth: 720, maxHeight: "80vh", display: "flex",
              flexDirection: "column", padding: 20,
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
              padding: "10px 12px", border: "1px solid var(--border)",
              borderRadius: 9999, background: "var(--surface)",
            }}>
              <Search size={16} color="var(--text2)" />
              <input
                type="text"
                autoFocus
                placeholder="Search (fade, 페이드, фейд…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "var(--text)", fontFamily: "'Manrope',sans-serif", fontSize: 14,
                }}
              />
            </div>
            <div style={{
              overflowY: "auto", display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
            }}>
              {filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onChange(it.id);
                    setOpen(false);
                  }}
                  style={{
                    position: "relative", display: "flex", flexDirection: "column",
                    gap: 8, padding: 8, background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 12,
                    cursor: "pointer", color: "var(--text)",
                    fontFamily: "'Manrope',sans-serif", fontSize: 12,
                    textAlign: "left",
                  }}
                >
                  {it.thumb_url ? (
                    <img
                      src={it.thumb_url}
                      alt=""
                      style={{
                        width: "100%", aspectRatio: "1", objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", aspectRatio: "1",
                      background: "var(--bg)", borderRadius: 8,
                    }} />
                  )}
                  <span style={{ fontWeight: 600 }}>{it.name}</span>
                  {it.native_name && it.native_name !== it.name && (
                    <span style={{ color: "var(--text2)", fontSize: 11 }}>
                      {it.native_name}
                    </span>
                  )}
                  {value === it.id && (
                    <div style={{
                      position: "absolute", top: 6, right: 6, width: 20, height: 20,
                      background: "var(--gold)", borderRadius: 999,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={12} color="#000" />
                    </div>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{
                  gridColumn: "1 / -1", textAlign: "center",
                  color: "var(--text2)", padding: 40,
                  fontFamily: "'Manrope',sans-serif",
                }}>
                  No matches
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
