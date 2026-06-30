"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { phone, password });
      const token = res.data?.tokens?.access_token;
      if (token) {
        localStorage.setItem("barber_admin_token", token);
        router.push("/barbers");
      } else {
        setError("Неверный ответ сервера");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Неверный телефон или пароль";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111827]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F59E0B] mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">BarberAdmin</h1>
          <p className="text-gray-400 text-sm mt-1">Войдите в панель управления</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1F2937] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Телефон</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998901234567"
              required
              className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
