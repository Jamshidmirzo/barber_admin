"use client";

// Route-segment error boundary. Wraps every page under /app except the
// root layout — for that see global-error.tsx. Minimal on purpose:
// audit called out the missing boundary, not a design deliverable.

import { useEffect } from "react";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Once we wire up a reporting sink (Sentry, etc.) this is where it
    // goes — for now the browser console is the only sink we have.
    console.error("route-segment error", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text)",
          margin: 0,
          marginBottom: 6,
        }}
      >
        Что-то пошло не так
      </h2>
      <p
        style={{
          color: "var(--text2)",
          fontSize: 13,
          margin: 0,
          marginBottom: 20,
          maxWidth: 360,
        }}
      >
        Не удалось отобразить эту страницу. Попробуйте ещё раз или обновите
        страницу.
      </p>
      <button
        onClick={() => unstable_retry()}
        style={{
          background: "var(--gold)",
          color: "#0a0a0b",
          border: "none",
          borderRadius: "var(--radius, 10px)",
          padding: "9px 20px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        Повторить
      </button>
    </div>
  );
}
