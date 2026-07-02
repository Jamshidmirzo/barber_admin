"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Sparkles,
  Pencil,
  ImagePlus,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  Loader2,
  X,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

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
  style?: string;
}

interface Salon {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  site_content: SiteContent;
}

type Tab = "ai" | "edit" | "photos";

const STYLE_OPTIONS = [
  { value: "modern", label: "Современный" },
  { value: "classic", label: "Классический" },
  { value: "minimal", label: "Минималистичный" },
  { value: "bold", label: "Яркий" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function TabButton({
  tab,
  active,
  onClick,
  icon: Icon,
  label,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-[#F59E0B]/10 text-[#F59E0B]"
          : "text-gray-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const cls =
    "w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#F59E0B]/50 transition-colors";
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

// ── AI Tab ───────────────────────────────────────────────────────────────────

function AiTab({ salon }: { salon: Salon }) {
  const qc = useQueryClient();
  const [name, setName] = useState(salon.name ?? "");
  const [location, setLocation] = useState(
    [salon.address, salon.city].filter(Boolean).join(", "),
  );
  const [phone, setPhone] = useState(salon.phone ?? "");
  const [description, setDescription] = useState(salon.description ?? "");
  const [style, setStyle] = useState<string>(
    salon.site_content?.style ?? "modern",
  );
  const [servicesRaw, setServicesRaw] = useState(
    salon.site_content?.services?.map((s) => s.name).join(", ") ?? "",
  );
  const [result, setResult] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api
        .post(`/salons/${salon.id}/generate-site`, {
          name,
          location: location || null,
          phone: phone || null,
          services: servicesRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          description: description || null,
          style_preferences: style,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setResult(data.site_url);
      qc.invalidateQueries({ queryKey: ["salon"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#1F2937] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 text-[#F59E0B] mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">
            AI сгенерирует сайт на основе ваших данных
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Название"
            value={name}
            onChange={setName}
            placeholder="Барбершоп Black Label"
          />
          <InputField
            label="Телефон"
            value={phone}
            onChange={setPhone}
            placeholder="+998 90 123 45 67"
          />
        </div>

        <InputField
          label="Адрес / город"
          value={location}
          onChange={setLocation}
          placeholder="Ташкент, ул. Амира Темура 15"
        />

        <InputField
          label="Услуги (через запятую)"
          value={servicesRaw}
          onChange={setServicesRaw}
          placeholder="Стрижка, Борода, Укладка, Оформление бороды"
        />

        <InputField
          label="Описание (необязательно)"
          value={description}
          onChange={setDescription}
          placeholder="Расскажите о вашем барбершопе..."
          multiline
          rows={3}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
            Стиль сайта
          </label>
          <div className="flex gap-2 flex-wrap">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  style === s.value
                    ? "bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]"
                    : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => mutate()}
          disabled={isPending || !name.trim()}
          className="w-full flex items-center justify-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isPending ? "Генерирую..." : "Сгенерировать сайт"}
        </button>
      </div>

      {result && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Сайт готов!</p>
              <p className="text-gray-400 text-xs mt-0.5">{result}</p>
            </div>
          </div>
          <a
            href={result}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[#F59E0B] text-sm hover:underline"
          >
            Открыть <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Edit Tab ─────────────────────────────────────────────────────────────────

function EditTab({ salon }: { salon: Salon }) {
  const qc = useQueryClient();
  const sc = salon.site_content ?? {};

  const [heading, setHeading] = useState(sc.heading ?? salon.name ?? "");
  const [subheading, setSubheading] = useState(
    sc.subheading ?? salon.tagline ?? "",
  );
  const [about, setAbout] = useState(sc.about ?? salon.description ?? "");
  const [ctaTitle, setCtaTitle] = useState(
    sc.cta?.title ?? "Запишитесь прямо сейчас",
  );
  const [ctaButton, setCtaButton] = useState(
    sc.cta?.button ?? "Открыть в приложении",
  );
  const [services, setServices] = useState<SiteService[]>(
    sc.services ?? [],
  );
  const [saved, setSaved] = useState(false);

  const addService = () =>
    setServices((prev) => [...prev, { name: "", description: "" }]);

  const removeService = (i: number) =>
    setServices((prev) => prev.filter((_, idx) => idx !== i));

  const updateService = (i: number, field: keyof SiteService, val: string) =>
    setServices((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)),
    );

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api
        .patch(`/salons/${salon.id}`, {
          site_content: {
            heading,
            subheading,
            about,
            services,
            cta: { title: ctaTitle, button: ctaButton },
            style: sc.style,
          },
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#1F2937] rounded-2xl p-6 space-y-5">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wide">
          Hero
        </h3>
        <InputField
          label="Заголовок"
          value={heading}
          onChange={setHeading}
          placeholder="Black Label Barbershop"
        />
        <InputField
          label="Подзаголовок"
          value={subheading}
          onChange={setSubheading}
          placeholder="Лучший барбершоп в городе"
        />
      </div>

      <div className="bg-[#1F2937] rounded-2xl p-6 space-y-5">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wide">
          О нас
        </h3>
        <InputField
          label="Описание"
          value={about}
          onChange={setAbout}
          placeholder="Расскажите о вашем барбершопе..."
          multiline
          rows={4}
        />
      </div>

      <div className="bg-[#1F2937] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wide">
            Услуги
          </h3>
          <button
            onClick={addService}
            className="flex items-center gap-1.5 text-[#F59E0B] text-xs hover:text-[#D97706] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        {services.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-4">
            Нет услуг. Добавьте первую.
          </p>
        )}

        {services.map((s, i) => (
          <div
            key={i}
            className="flex gap-3 p-4 bg-[#111827] rounded-xl border border-white/5"
          >
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateService(i, "name", e.target.value)}
                placeholder="Название услуги"
                className="w-full bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none border-b border-white/10 pb-1.5 focus:border-[#F59E0B]/50 transition-colors"
              />
              <input
                type="text"
                value={s.description}
                onChange={(e) =>
                  updateService(i, "description", e.target.value)
                }
                placeholder="Описание (необязательно)"
                className="w-full bg-transparent text-gray-400 text-xs placeholder-gray-600 focus:outline-none focus:text-white transition-colors"
              />
            </div>
            <button
              onClick={() => removeService(i)}
              className="text-gray-600 hover:text-red-400 transition-colors self-start mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-[#1F2937] rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wide">
          Блок записи (CTA)
        </h3>
        <InputField
          label="Заголовок блока"
          value={ctaTitle}
          onChange={setCtaTitle}
          placeholder="Запишитесь прямо сейчас"
        />
        <InputField
          label="Текст кнопки"
          value={ctaButton}
          onChange={setCtaButton}
          placeholder="Открыть в приложении"
        />
      </div>

      <button
        onClick={() => mutate()}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <Check className="w-4 h-4" />
        ) : (
          <Pencil className="w-4 h-4" />
        )}
        {isPending ? "Сохраняю..." : saved ? "Сохранено!" : "Сохранить"}
      </button>
    </div>
  );
}

// ── Photos Tab ────────────────────────────────────────────────────────────────

function PhotosTab({ salon }: { salon: Salon }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api
        .post(`/salons/${salon.id}/cover-image`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon"] });
      setPreview(null);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Ошибка загрузки";
      setError(msg);
    },
  });

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Файл слишком большой (макс 10 МБ)");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    mutate(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1F2937] rounded-2xl p-6">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">
          Обложка сайта
        </h3>

        <div
          onClick={() => fileRef.current?.click()}
          className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-white/10 hover:border-[#F59E0B]/40 transition-colors"
          style={{ aspectRatio: "16/7" }}
        >
          {salon.cover_url || preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview ?? salon.cover_url!}
              alt="Обложка"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <ImagePlus className="w-8 h-8 text-gray-600" />
              <p className="text-gray-500 text-sm">Нажмите для загрузки</p>
              <p className="text-gray-600 text-xs">JPG, PNG, WebP — до 10 МБ</p>
            </div>
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2 rounded-full">
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              {isPending ? "Загружаю..." : "Заменить фото"}
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-xl px-4 py-2.5">
            <X className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="bg-[#1F2937]/50 rounded-2xl p-5 border border-white/5">
        <p className="text-gray-400 text-sm">
          <span className="text-white font-medium">Аватар</span> — загружается
          через мобильное приложение Hayrli Pro в разделе «Профиль».
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SitePage() {
  const [tab, setTab] = useState<Tab>("ai");

  const { data: salon, isLoading } = useQuery<Salon>({
    queryKey: ["salon"],
    queryFn: () => api.get("/salons/me").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="h-7 w-32 bg-white/5 rounded-lg animate-pulse mb-6" />
        <div className="bg-[#1F2937] rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-white/5 rounded" />
          <div className="h-12 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="p-8 text-gray-500 text-sm">
        Салон не найден. Пройдите онбординг.
      </div>
    );
  }

  const siteUrl = `https://${salon.slug}.hayrli.app`;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Сайт салона</h1>
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[#F59E0B] text-sm hover:underline"
        >
          <Globe className="w-4 h-4" />
          {salon.slug}.hayrli.app
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1F2937] rounded-xl p-1">
        <TabButton
          tab="ai"
          active={tab === "ai"}
          onClick={() => setTab("ai")}
          icon={Sparkles}
          label="AI Генерация"
        />
        <TabButton
          tab="edit"
          active={tab === "edit"}
          onClick={() => setTab("edit")}
          icon={Pencil}
          label="Редактировать"
        />
        <TabButton
          tab="photos"
          active={tab === "photos"}
          onClick={() => setTab("photos")}
          icon={ImagePlus}
          label="Фото"
        />
      </div>

      {tab === "ai" && <AiTab salon={salon} />}
      {tab === "edit" && <EditTab salon={salon} />}
      {tab === "photos" && <PhotosTab salon={salon} />}
    </div>
  );
}
