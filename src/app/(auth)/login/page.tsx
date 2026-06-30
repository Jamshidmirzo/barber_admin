"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api, { parseApiError } from "@/lib/api";

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");

  // Login state
  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");

  // Register state
  const [regPhone, setRegPhone] = useState("+998");
  const [regName, setRegName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function saveToken(token: string) {
    localStorage.setItem("barber_admin_token", token);
    router.push("/appointments");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { phone, password });
      const token = res.data?.tokens?.access_token;
      if (token) saveToken(token);
      else setError("Неверный ответ сервера");
    } catch (err) {
      setError(parseApiError(err, "Неверный телефон или пароль"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (regPassword !== regPassword2) {
      setError("Пароли не совпадают");
      return;
    }
    if (regPassword.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        phone: regPhone,
        password: regPassword,
        name: regName,
        last_name: regLastName,
      });
      const token = res.data?.tokens?.access_token;
      if (token) saveToken(token);
      else setError("Неверный ответ сервера");
    } catch (err) {
      setError(parseApiError(err, "Ошибка регистрации"));
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
          <p className="text-gray-400 text-sm mt-1">Панель управления барбершопом</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#1F2937] rounded-xl p-1 mb-4">
          <button
            onClick={() => { setTab("login"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "login" ? "bg-[#F59E0B] text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Войти
          </button>
          <button
            onClick={() => { setTab("register"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "register" ? "bg-[#F59E0B] text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Login form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="bg-[#1F2937] rounded-2xl p-6 space-y-4">
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
            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>
        )}

        {/* Register form */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="bg-[#1F2937] rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Имя</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Алишер"
                  required
                  className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Фамилия</label>
                <input
                  type="text"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  placeholder="Каримов"
                  className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Телефон</label>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+998901234567"
                required
                className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Пароль</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
                className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Повторите пароль</label>
              <input
                type="password"
                value={regPassword2}
                onChange={(e) => setRegPassword2(e.target.value)}
                placeholder="••••••"
                required
                className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
              />
            </div>
            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              {loading ? "Регистрируем..." : "Создать аккаунт"}
            </button>
            <p className="text-center text-xs text-gray-500">
              После регистрации создашь свой барбершоп
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
