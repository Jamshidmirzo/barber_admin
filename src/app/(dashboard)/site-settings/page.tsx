"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  ExternalLink,
  Upload,
  Trash2,
  Plus,
  X,
  Check,
  ImageIcon,
} from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import {
  useSalon,
  type Salon,
  type SiteStyle,
  type SiteService,
  type WeekDay,
  type DayHours,
  type WorkingHours,
} from "@/hooks/useSalon";

// ── Constants ────────────────────────────────────────────────────────────────
const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || "hayrli.app";

const STYLES: { id: SiteStyle; label: string; hint: string }[] = [
  { id: "modern", label: "Современный", hint: "Чисто, технологично, ярко" },
  { id: "classic", label: "Классический", hint: "Тёпло, респектабельно" },
  { id: "luxury", label: "Премиум", hint: "Элегантно, эксклюзивно" },
  { id: "minimal", label: "Минимализм", hint: "Лаконично, много воздуха" },
];

const DAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Понедельник" },
  { key: "tue", label: "Вторник" },
  { key: "wed", label: "Среда" },
  { key: "thu", label: "Четверг" },
  { key: "fri", label: "Пятница" },
  { key: "sat", label: "Суббота" },
  { key: "sun", label: "Воскресенье" },
];

type FullHours = Record<WeekDay, DayHours>;

function normalizeHours(wh: WorkingHours | null | undefined): FullHours {
  const out = {} as FullHours;
  for (const { key } of DAYS) {
    const d = wh?.[key];
    out[key] = {
      open: d?.open ?? "09:00",
      close: d?.close ?? "20:00",
      closed: d?.closed ?? false,
    };
  }
  return out;
}

const inputCls =
  "w-full rounded-xl bg-[#111827] px-3 py-2.5 text-sm text-white outline-none placeholder-gray-600 focus:ring-2 focus:ring-[#F59E0B]";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SiteSettingsPage() {
  const { salon } = useSalon();
  const qc = useQueryClient();

  // Основная информация
  const [name, setName] = useState(() => salon.name ?? "");
  const [tagline, setTagline] = useState(() => salon.tagline ?? "");
  const [description, setDescription] = useState(() => salon.description ?? "");
  const [phone, setPhone] = useState(() => salon.phone ?? "");
  const [address, setAddress] = useState(() => salon.address ?? "");

  // Стиль / обложка / часы / услуги
  const [style, setStyle] = useState<SiteStyle>(
    () => salon.site_content?.style ?? "modern"
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(
    () => salon.cover_url
  );
  const [hours, setHours] = useState<FullHours>(() =>
    normalizeHours(salon.working_hours)
  );
  const [services, setServices] = useState<SiteService[]>(
    () => salon.site_content?.services ?? []
  );

  const [err, setErr] = useState("");
  const [coverErr, setCoverErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const siteUrl = `https://${salon.slug}.${SITE_DOMAIN}`;

  // Снимок исходного состояния — для определения «есть несохранённые правки».
  const initial = useRef(
    JSON.stringify({
      name: salon.name ?? "",
      tagline: salon.tagline ?? "",
      description: salon.description ?? "",
      phone: salon.phone ?? "",
      address: salon.address ?? "",
      hours: normalizeHours(salon.working_hours),
      services: salon.site_content?.services ?? [],
    })
  );

  const current = useMemo(
    () =>
      JSON.stringify({
        name,
        tagline,
        description,
        phone,
        address,
        hours,
        services,
      }),
    [name, tagline, description, phone, address, hours, services]
  );
  const dirty = current !== initial.current;

  // ── Mutations ────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: () =>
      api
        .patch<Salon>(`/salons/${salon.id}`, {
          // Пустая строка (а не null) — чтобы PATCH мог очистить поле:
          // бэкенд игнорирует None, но применяет "".
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          phone: phone.trim(),
          address: address.trim(),
          working_hours: hours,
          site_content: { ...(salon.site_content ?? {}), services, style },
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-context"] });
      initial.current = current;
      setErr("");
    },
    onError: (e: unknown) =>
      setErr(parseApiError(e, "Не удалось сохранить изменения")),
  });

  const themeMutation = useMutation({
    mutationFn: (s: SiteStyle) =>
      api.patch<Salon>(`/salons/${salon.id}`, { site_style: s }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salon-context"] }),
    onError: (e: unknown) =>
      setErr(parseApiError(e, "Не удалось сменить тему")),
  });

  const coverUpload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api
        .post<Salon>(`/salons/${salon.id}/cover-image`, fd)
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      setCoverUrl(data.cover_url);
      setCoverErr("");
      qc.invalidateQueries({ queryKey: ["salon-context"] });
    },
    onError: (e: unknown) =>
      setCoverErr(parseApiError(e, "Не удалось загрузить фото")),
  });

  const coverDelete = useMutation({
    mutationFn: () =>
      api.delete<Salon>(`/salons/${salon.id}/cover-image`).then((r) => r.data),
    onSuccess: (data) => {
      setCoverUrl(data.cover_url);
      qc.invalidateQueries({ queryKey: ["salon-context"] });
    },
    onError: (e: unknown) =>
      setCoverErr(parseApiError(e, "Не удалось удалить фото")),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const selectStyle = (s: SiteStyle) => {
    if (s === style) return;
    setStyle(s);
    themeMutation.mutate(s);
  };

  const onPickFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverErr("Нужен файл-изображение (jpg, png, webp)");
      return;
    }
    coverUpload.mutate(file);
  };

  const setDay = (key: WeekDay, patch: Partial<DayHours>) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));

  const updateService = (i: number, patch: Partial<SiteService>) =>
    setServices((arr) =>
      arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl p-4 pb-28 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10">
            <Globe className="h-5 w-5 text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Настройки сайта</h1>
            <p className="text-sm text-gray-400">
              Редактируйте контент — он сразу обновится на сайте
            </p>
          </div>
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-white/10"
        >
          <ExternalLink className="h-4 w-4" />
          Открыть мой сайт
        </a>
      </div>

      <div className="space-y-5">
        {/* ── Секция 1: Основная информация ──────────────────────────── */}
        <Section title="Основная информация">
          <Field label="Название барбершопа">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barber Pro"
              className={inputCls}
            />
          </Field>
          <Field label="Теглайн (слоган в шапке)">
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Лучшие стрижки в Ташкенте"
              className={inputCls}
            />
          </Field>
          <Field label="Описание">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Барбершоп в центре города, работаем с 2015 года…"
              className={`${inputCls} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Телефон">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className={inputCls}
              />
            </Field>
            <Field label="Адрес">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ташкент, Чиланзар, ул. …"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ── Секция 2: Визуальный стиль ─────────────────────────────── */}
        <Section
          title="Визуальный стиль"
          hint={themeMutation.isPending ? "Сохраняем…" : "Сохраняется сразу"}
        >
          <div className="grid grid-cols-2 gap-3">
            {STYLES.map((s) => {
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectStyle(s.id)}
                  className={`relative rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? "border-[#F59E0B] bg-[#F59E0B]/10"
                      : "border-white/10 bg-[#111827] hover:border-white/20"
                  }`}
                >
                  {active && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#F59E0B]">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <p className="text-sm font-semibold text-white">{s.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{s.hint}</p>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Секция 3: Фото обложки ─────────────────────────────────── */}
        <Section title="Фото обложки">
          {coverUrl ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt="Обложка сайта"
                  className="h-44 w-full object-cover"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={coverUpload.isPending}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {coverUpload.isPending ? "Загрузка…" : "Заменить"}
                </button>
                <button
                  type="button"
                  onClick={() => coverDelete.mutate()}
                  disabled={coverDelete.isPending}
                  className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onPickFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-colors ${
                dragOver
                  ? "border-[#F59E0B] bg-[#F59E0B]/5"
                  : "border-white/15 bg-[#111827] hover:border-white/30"
              }`}
            >
              <ImageIcon className="h-7 w-7 text-gray-500" />
              <p className="text-sm text-gray-300">
                {coverUpload.isPending
                  ? "Загрузка…"
                  : "Перетащите фото сюда или нажмите"}
              </p>
              <p className="text-xs text-gray-600">JPG, PNG, WEBP · до 10 МБ</p>
            </button>
          )}
          {coverErr && (
            <p className="mt-2 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400">
              {coverErr}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Section>

        {/* ── Секция 4: Рабочие часы ─────────────────────────────────── */}
        <Section title="Рабочие часы">
          <div className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const d = hours[key];
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-[#111827] px-3 py-2.5"
                >
                  <span className="w-28 shrink-0 text-sm text-gray-300">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDay(key, { closed: !d.closed })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      d.closed ? "bg-white/10" : "bg-[#F59E0B]"
                    }`}
                    aria-label={d.closed ? "Выходной" : "Рабочий день"}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                        d.closed ? "left-0.5" : "left-[22px]"
                      }`}
                    />
                  </button>
                  {d.closed ? (
                    <span className="text-sm text-gray-500">Выходной</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={d.open}
                        onChange={(e) => setDay(key, { open: e.target.value })}
                        className="rounded-lg bg-[#1F2937] px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#F59E0B]"
                      />
                      <span className="text-gray-500">—</span>
                      <input
                        type="time"
                        value={d.close}
                        onChange={(e) => setDay(key, { close: e.target.value })}
                        className="rounded-lg bg-[#1F2937] px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#F59E0B]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Секция 5: Услуги ───────────────────────────────────────── */}
        <Section title="Услуги">
          <div className="space-y-3">
            {services.length === 0 && (
              <p className="text-sm text-gray-500">
                Пока нет услуг. Добавьте первую — она появится на сайте.
              </p>
            )}
            {services.map((s, i) => (
              <div
                key={i}
                className="space-y-2 rounded-xl bg-[#111827] p-3"
              >
                <div className="flex gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => updateService(i, { name: e.target.value })}
                    placeholder="Название (Стрижка)"
                    className="flex-1 rounded-lg bg-[#1F2937] px-3 py-2 text-sm text-white outline-none placeholder-gray-600 focus:ring-2 focus:ring-[#F59E0B]"
                  />
                  <input
                    value={s.price ?? ""}
                    onChange={(e) => updateService(i, { price: e.target.value })}
                    placeholder="Цена"
                    className="w-28 shrink-0 rounded-lg bg-[#1F2937] px-3 py-2 text-sm text-white outline-none placeholder-gray-600 focus:ring-2 focus:ring-[#F59E0B]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setServices((arr) => arr.filter((_, idx) => idx !== i))
                    }
                    className="flex shrink-0 items-center rounded-lg bg-red-500/10 px-2.5 text-red-400 hover:bg-red-500/20"
                    aria-label="Удалить услугу"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={s.description ?? ""}
                  onChange={(e) =>
                    updateService(i, { description: e.target.value })
                  }
                  placeholder="Описание (необязательно)"
                  className="w-full rounded-lg bg-[#1F2937] px-3 py-2 text-sm text-white outline-none placeholder-gray-600 focus:ring-2 focus:ring-[#F59E0B]"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setServices((arr) => [
                  ...arr,
                  { name: "", description: "", price: "" },
                ])
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm text-gray-300 hover:border-white/30"
            >
              <Plus className="h-4 w-4" />
              Добавить услугу
            </button>
          </div>
        </Section>
      </div>

      {/* ── Save bar ──────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-[#1F2937]/95 px-4 py-3 backdrop-blur sm:left-60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="truncate text-sm text-gray-400">
            {err ? (
              <span className="text-red-400">{err}</span>
            ) : dirty ? (
              "Есть несохранённые изменения"
            ) : (
              "Все изменения сохранены"
            )}
          </p>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || name.trim().length < 2}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {save.isPending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-[#1F2937] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
          {title}
        </h2>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

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
