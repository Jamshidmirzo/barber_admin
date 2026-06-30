"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Scissors, Check, X, Loader2 } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;
type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Авто-подсказка slug из названия (пока пользователь не правил slug вручную)
  useEffect(() => {
    if (slugTouched || name.trim().length < 2) return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await api.get("/salons/slug/suggest", {
          params: { name: name.trim() },
        });
        setSlug(res.data?.slug ?? "");
      } catch {
        /* подсказка необязательна — игнорируем */
      }
    }, 500);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [name, slugTouched]);

  // Live-валидация доступности slug
  useEffect(() => {
    const s = slug.toLowerCase().trim();
    if (!s) {
      setAvailability("idle");
      return;
    }
    if (!SLUG_RE.test(s)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await api.get("/salons/slug/check", { params: { slug: s } });
        setAvailability(res.data?.available ? "available" : "taken");
      } catch {
        setAvailability("invalid");
      }
    }, 400);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [slug]);

  const canSubmit =
    name.trim().length >= 2 && availability === "available" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      await api.post("/salons", { name: name.trim(), slug: slug.toLowerCase().trim() });
      await qc.invalidateQueries({ queryKey: ["salon-context"] });
      router.replace("/barbers");
    } catch (err) {
      setError(parseApiError(err, "Не удалось создать салон"));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111827] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F59E0B] mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Создание салона</h1>
          <p className="text-gray-400 text-sm mt-1">
            Назовите барбершоп — получите адрес сайта на hayrli.app
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1F2937] rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Название салона</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Flek Barbershop"
              maxLength={200}
              required
              autoFocus
              className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Адрес сайта (slug)
            </label>
            <div className="relative">
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="flek"
                maxLength={100}
                className="w-full bg-[#111827] text-white rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#F59E0B] placeholder-gray-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {availability === "checking" && (
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                )}
                {availability === "available" && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                {(availability === "taken" || availability === "invalid") && (
                  <X className="w-4 h-4 text-red-500" />
                )}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {slug ? (
                  <span className="text-gray-400">
                    {slug}
                    <span className="text-gray-600">.hayrli.app</span>
                  </span>
                ) : (
                  "ваш-slug.hayrli.app"
                )}
              </p>
              {availability === "taken" && (
                <span className="text-xs text-red-400">занято</span>
              )}
              {availability === "invalid" && slug && (
                <span className="text-xs text-red-400">
                  только a-z, 0-9 и дефис, от 3 символов
                </span>
              )}
              {availability === "available" && (
                <span className="text-xs text-green-500">свободно</span>
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Создаём..." : "Создать салон"}
          </button>
        </form>
      </div>
    </div>
  );
}
