import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001/api/v1",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("barber_admin_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url: string = err.config?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");
    if (err.response?.status === 401 && !isAuthEndpoint && typeof window !== "undefined") {
      localStorage.removeItem("barber_admin_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/**
 * Единый парсер ошибок API. Backend (operhair) отдаёт доменные ошибки в форме
 * `{ error: { code, message } }`, а FastAPI-валидация — в `{ detail: ... }`.
 * Хелпер достаёт человекочитаемое сообщение из любой из этих форм.
 */
export function parseApiError(err: unknown, fallback = "Произошла ошибка"): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data as
    | {
        error?: { message?: string };
        detail?: unknown;
        message?: string;
      }
    | undefined;

  if (!data) return fallback;

  // Доменная ошибка operhair: { error: { message } }
  if (data.error?.message) return data.error.message;

  // FastAPI: detail может быть строкой или массивом ошибок валидации
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    const first = data.detail[0] as { msg?: string } | undefined;
    if (first?.msg) return first.msg;
  }

  if (typeof data.message === "string") return data.message;

  return fallback;
}

export default api;
