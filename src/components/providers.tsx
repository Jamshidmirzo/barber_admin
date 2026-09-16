"use client";

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { parseApiError } from "@/lib/api";

// ── Lightweight toast pipeline ────────────────────────────────────────────
// The repo has no toast library, and pulling one in is out of scope for the
// audit-fix wave. The QueryCache/MutationCache onError handlers below need
// to surface errors to the user somehow, so we expose a module-level
// pushToast that queues messages and a <Toaster /> that renders them.

type ToastKind = "error";
interface Toast { id: number; kind: ToastKind; text: string }
let toastListeners: ((t: Toast) => void)[] = [];
let toastId = 0;

function pushToast(text: string, kind: ToastKind = "error") {
  const t: Toast = { id: ++toastId, kind, text };
  toastListeners.forEach((fn) => fn(t));
}

function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const on = (t: Toast) => setItems((prev) => [...prev, t]);
    toastListeners.push(on);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== on);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((t) =>
      setTimeout(() => dismiss(t.id), 5000)
    );
    return () => timers.forEach((h) => clearTimeout(h));
  }, [items, dismiss]);

  if (items.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(224,90,90,0.4)",
            borderRadius: "var(--radius, 8px)",
            padding: "10px 14px",
            color: "var(--text)",
            fontSize: 13,
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--red, #e05a5a)",
              flexShrink: 0,
              marginTop: 6,
            }}
          />
          <span style={{ flex: 1, wordBreak: "break-word" }}>{t.text}</span>
          <button
            onClick={() => dismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text3)",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              padding: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        // Surface every failed fetch/mutation somewhere so silent failures
        // (empty modals, spinners that stop with no result) don't stack up
        // — see AUDIT.md §Проглоченные мутации.
        queryCache: new QueryCache({
          onError: (err) => pushToast(parseApiError(err)),
        }),
        mutationCache: new MutationCache({
          onError: (err) => pushToast(parseApiError(err)),
        }),
        defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
      })
  );
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
