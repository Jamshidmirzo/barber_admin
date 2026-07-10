import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

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

// Track whether a refresh is already in flight to avoid cascading refresh calls.
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

function clearSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("barber_admin_token");
    localStorage.removeItem("barber_admin_refresh_token");
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalConfig = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url: string = originalConfig?.url ?? "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (err.response?.status === 401 && !isAuthEndpoint && !originalConfig._retry && typeof window !== "undefined") {
      const refreshToken = localStorage.getItem("barber_admin_refresh_token");

      if (!refreshToken) {
        clearSession();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        // Queue the request until the ongoing refresh resolves.
        return new Promise<string>((resolve) => {
          refreshQueue.push(resolve);
        }).then((newToken) => {
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
          return api(originalConfig);
        });
      }

      originalConfig._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
          { timeout: 10000 }
        );

        const newAccessToken: string = res.data?.tokens?.access_token ?? res.data?.access_token;
        if (!newAccessToken) throw new Error("No access token in refresh response");

        localStorage.setItem("barber_admin_token", newAccessToken);

        // Persist new refresh token if backend rotates it.
        const newRefreshToken: string | undefined =
          res.data?.tokens?.refresh_token ?? res.data?.refresh_token;
        if (newRefreshToken) {
          localStorage.setItem("barber_admin_refresh_token", newRefreshToken);
        }

        processQueue(newAccessToken);
        originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalConfig);
      } catch {
        refreshQueue = [];
        clearSession();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
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
