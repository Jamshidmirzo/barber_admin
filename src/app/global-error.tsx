"use client";

// Last-resort error boundary. This one replaces the root layout when it
// hits, so it must ship its own <html>/<body> — see Next 16 docs. Metadata
// exports aren't supported here (must be a Client Component), so we set
// the title via a <title> element instead.

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Deliberately basic — dark background matches the app theme in case
  // globals.css never loaded (i.e., the error itself was in the shell).
  return (
    <html lang="en">
      <head>
        <title>Ошибка — BarberAdmin</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0a0a0b",
          color: "#e6e6e6",
          fontFamily: "system-ui, -apple-system, 'Manrope', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              marginBottom: 8,
              color: "#e6e6e6",
            }}
          >
            Приложение не может продолжить работу
          </h1>
          <p
            style={{
              margin: 0,
              marginBottom: 22,
              fontSize: 14,
              color: "#a0a0a0",
              lineHeight: 1.5,
            }}
          >
            Произошла непредвиденная ошибка. Попробуйте перезагрузить или
            вернуться на главную.
            {error?.digest ? (
              <>
                <br />
                <span style={{ fontSize: 11, color: "#666" }}>
                  ref: {error.digest}
                </span>
              </>
            ) : null}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              background: "#c9a45c",
              color: "#0a0a0b",
              border: "none",
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
