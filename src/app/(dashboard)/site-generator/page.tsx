"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Check,
  ExternalLink,
  Plus,
  X,
  ArrowLeft,
} from "lucide-react";
import api from "@/lib/api";
import { useSalon } from "@/hooks/useSalon";

// ── Types ────────────────────────────────────────────────────────────────────
type Style = "modern" | "classic" | "luxury" | "minimal";

interface SiteService {
  name: string;
  description: string;
}

interface SiteContent {
  heading?: string;
  subheading?: string;
  about?: string;
  services?: SiteService[];
  cta?: { title?: string; button?: string };
  style?: Style;
}

interface GenerateResponse {
  site_url: string;
  tagline: string | null;
  description: string | null;
  site_content: SiteContent;
}

const STYLES: { id: Style; label: string; hint: string }[] = [
  { id: "modern", label: "Современный", hint: "Чисто, технологично, ярко" },
  { id: "classic", label: "Классический", hint: "Тёпло, респектабельно" },
  { id: "luxury", label: "Премиум", hint: "Элегантно, эксклюзивно" },
  { id: "minimal", label: "Минимализм", hint: "Лаконично, много воздуха" },
];

export default function SiteGeneratorPage() {
  // Salon comes from the dashboard context (layout guarantees it exists).
  const { salon } = useSalon();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Form fields are prefilled from the salon at mount (lazy initializers —
  // no setState-in-effect).
  const [name, setName] = useState(() => salon.name ?? "");
  const [location, setLocation] = useState(
    () => salon.address ?? salon.city ?? ""
  );
  const [phone, setPhone] = useState(() => salon.phone ?? "");
  const [services, setServices] = useState<string[]>([]);
  const [serviceDraft, setServiceDraft] = useState("");
  const [description, setDescription] = useState(
    () => salon.description ?? ""
  );
  const [style, setStyle] = useState<Style>("modern");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [err, setErr] = useState("");

  const generate = useMutation({
    mutationFn: (body: {
      name: string;
      location: string;
      phone: string;
      services: string[];
      description: string;
      style_preferences: Style;
    }) =>
      api
        .post<GenerateResponse>(`/salons/${salon.id}/generate-site`, body)
        .then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      setStep(2);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.message ||
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        "Не удалось сгенерировать сайт. Попробуйте ещё раз.";
      setErr(msg);
    },
  });

  const addService = () => {
    const v = serviceDraft.trim();
    if (v && !services.includes(v)) setServices((s) => [...s, v]);
    setServiceDraft("");
  };

  const content = result?.site_content;

  const stepLabels = useMemo(
    () => ["Данные", "Предпросмотр", "Публикация"],
    []
  );

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10">
          <Sparkles className="h-5 w-5 text-[#F59E0B]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI-конструктор сайта</h1>
          <p className="text-sm text-gray-400">
            Заполните форму — Claude создаст контент сайта
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-[#F59E0B] text-white"
                    : done
                      ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                      : "bg-white/5 text-gray-500"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span
                className={`text-sm ${active ? "text-white" : "text-gray-500"}`}
              >
                {label}
              </span>
              {n < 3 && <div className="mx-1 h-px w-6 bg-white/10" />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: form ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5 rounded-2xl bg-[#1F2937] p-6">
          <Field label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barber Pro"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Локация">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ташкент, Чиланзар"
                className={inputCls}
              />
            </Field>
            <Field label="Телефон">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Услуги">
            <div className="flex gap-2">
              <input
                value={serviceDraft}
                onChange={(e) => setServiceDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addService();
                  }
                }}
                placeholder="Стрижка, борода…"
                className={inputCls}
              />
              <button
                onClick={addService}
                type="button"
                className="flex shrink-0 items-center gap-1 rounded-xl bg-white/5 px-3 text-sm text-gray-300 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {services.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {services.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded-full bg-[#F59E0B]/10 px-3 py-1 text-xs text-[#F59E0B]"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() =>
                        setServices((arr) => arr.filter((x) => x !== s))
                      }
                      className="hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Описание (от себя)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Барбершоп в центре города, работаем с 2015 года…"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Стиль оформления">
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    style === s.id
                      ? "border-[#F59E0B] bg-[#F59E0B]/10"
                      : "border-white/10 bg-[#111827] hover:border-white/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{s.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{s.hint}</p>
                </button>
              ))}
            </div>
          </Field>

          {err && (
            <p className="rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400">
              {err}
            </p>
          )}

          <button
            onClick={() => {
              setErr("");
              generate.mutate({
                name: name.trim(),
                location: location.trim(),
                phone: phone.trim(),
                services,
                description: description.trim(),
                style_preferences: style,
              });
            }}
            disabled={generate.isPending || name.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F59E0B] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generate.isPending ? "Генерируем…" : "Сгенерировать сайт"}
          </button>
        </div>
      )}

      {/* ── Step 2: preview ───────────────────────────────────────────── */}
      {step === 2 && content && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#1F2937] p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#F59E0B]">
              {STYLES.find((s) => s.id === content.style)?.label ?? "Стиль"}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {content.heading}
            </h2>
            {content.subheading && (
              <p className="mt-1 text-[#F59E0B]">{content.subheading}</p>
            )}
            {content.about && (
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {content.about}
              </p>
            )}

            {content.services && content.services.length > 0 && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {content.services.map((s, i) => (
                  <div
                    key={`${s.name}-${i}`}
                    className="rounded-xl bg-[#111827] p-4"
                  >
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {s.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {content.cta?.title && (
              <div className="mt-5 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-4 text-center">
                <p className="text-sm text-white">{content.cta.title}</p>
                <span className="mt-2 inline-block rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-white">
                  {content.cta.button}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-300 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              К форме
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F59E0B] py-3 text-sm font-semibold text-white hover:bg-[#D97706]"
            >
              <Check className="h-4 w-4" />
              Опубликовать
            </button>
          </div>
          <p className="text-center text-xs text-gray-500">
            Контент уже сохранён. «Опубликовать» покажет ссылку на сайт.
          </p>
        </div>
      )}

      {/* ── Step 3: published ─────────────────────────────────────────── */}
      {step === 3 && result && (
        <div className="rounded-2xl bg-[#1F2937] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
            <Check className="h-7 w-7 text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Сайт опубликован!</h2>
          <p className="mt-1 text-sm text-gray-400">
            Ваш сайт доступен по адресу:
          </p>
          <div className="mx-auto mt-4 flex max-w-sm items-center justify-between gap-3 rounded-xl bg-[#111827] px-4 py-3">
            <span className="truncate text-sm font-medium text-[#F59E0B]">
              {result.site_url.replace(/^https?:\/\//, "")}
            </span>
            <a
              href={result.site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              Открыть
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <button
            onClick={() => {
              setStep(1);
              setResult(null);
            }}
            className="mt-6 text-sm text-gray-400 hover:text-white"
          >
            Сгенерировать заново
          </button>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-[#111827] px-3 py-2.5 text-sm text-white outline-none placeholder-gray-600 focus:ring-2 focus:ring-[#F59E0B]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-gray-400">{label}</label>
      {children}
    </div>
  );
}
