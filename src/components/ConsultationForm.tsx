"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { CONSULTATION_SLOTS, CONSULTATION_TOPICS, formatDayRu } from "@/lib/consultation";

const TEXT = {
  ru: {
    day: "Выберите день",
    time: "Выберите время",
    loading: "Проверяем свободное время…",
    none: "На этот день всё занято — выберите другой.",
    name: "Ваше имя",
    phone: "Телефон (WhatsApp)",
    topic: "Тема",
    comment: "Ваш вопрос (необязательно)",
    consent: "Согласен(а) на обработку персональных данных",
    submit: "Записаться на консультацию",
    sending: "Записываем…",
    pickSlot: "Выберите день и время.",
    fill: "Укажите имя и телефон в формате +7 777 123 45 67 и поставьте галочку.",
    taken: "Это время только что заняли. Выберите другое.",
    error: "Не получилось записаться. Напишите нам в WhatsApp.",
    doneTitle: "Вы записаны! 🎉",
    doneText: (d: string, t: string) => `Ждём вас ${d} в ${t}. Менеджер напишет в WhatsApp, подтвердит запись и расскажет, как оплатить 2 000 ₸.`,
    again: "Записаться ещё раз",
  },
  kk: {
    day: "Күнді таңдаңыз",
    time: "Уақытты таңдаңыз",
    loading: "Бос уақытты тексеріп жатырмыз…",
    none: "Бұл күні бәрі бос емес — басқа күнді таңдаңыз.",
    name: "Атыңыз",
    phone: "Телефон (WhatsApp)",
    topic: "Тақырып",
    comment: "Сұрағыңыз (міндетті емес)",
    consent: "Дербес деректерді өңдеуге келісемін",
    submit: "Кеңеске жазылу",
    sending: "Жазып жатырмыз…",
    pickSlot: "Күн мен уақытты таңдаңыз.",
    fill: "Атыңызды және телефонды +7 777 123 45 67 форматында жазып, белгі қойыңыз.",
    taken: "Бұл уақытты жаңа ғана алып қойды. Басқасын таңдаңыз.",
    error: "Жазылу болмады. WhatsApp-қа жазыңыз.",
    doneTitle: "Сіз жазылдыңыз! 🎉",
    doneText: (d: string, t: string) => `Сізді ${d}, ${t}-да күтеміз. Менеджер WhatsApp-қа жазып, жазылуды растайды және 2 000 ₸ қалай төлеуді айтады.`,
    again: "Тағы жазылу",
  },
};

export function ConsultationForm({ days, locale }: { days: string[]; locale: "ru" | "kk" }) {
  const t = TEXT[locale];
  const [date, setDate] = useState(days[0] ?? "");
  const [time, setTime] = useState("");
  const [booked, setBooked] = useState<string[] | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", topic: "ferienjob", comment: "", consent: false, website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    fetch(`/api/consultation?date=${date}`)
      .then((r) => r.json())
      .then((j: { booked?: string[] }) => alive && setBooked(j.booked ?? []))
      .catch(() => alive && setBooked([]));
    return () => {
      alive = false;
    };
  }, [date]);

  // Past hours of today are not offered.
  const now = new Date();
  const todayAlmaty = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(now);
  const hourAlmaty = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Almaty", hour: "2-digit", hour12: false }).format(now));
  const free = CONSULTATION_SLOTS.filter((s) => !(booked ?? []).includes(s) && (date !== todayAlmaty || Number(s.slice(0, 2)) > hourAlmaty));

  if (done) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
        <h2 className="mt-4 text-[24px] font-bold">{t.doneTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-muted">{t.doneText(formatDayRu(done.date, locale), done.time)}</p>
        <button type="button" className="btn-ghost mt-6" onClick={() => setDone(null)}>
          {t.again}
        </button>
      </div>
    );
  }

  return (
    <form
      className="card space-y-6 p-6 sm:p-8"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!date || !time) return setError(t.pickSlot);
        if (form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 11 || !form.consent) return setError(t.fill);
        setBusy(true);
        try {
          const res = await fetch("/api/consultation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, date, time, locale }),
          });
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.ok) setDone({ date, time });
          else if (j.error === "slot_taken") {
            setError(t.taken);
            setBooked((b) => [...(b ?? []), time]);
            setTime("");
          } else if (j.error === "invalid") setError(t.fill);
          else setError(t.error);
        } catch {
          setError(t.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-3 text-[16px] font-bold">{t.day}</legend>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDate(d);
                setTime("");
                setBooked(null);
              }}
              className={clsx(
                "shrink-0 rounded-xl border px-3.5 py-2.5 text-[14px] font-semibold capitalize",
                d === date ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
              )}
            >
              {formatDayRu(d, locale)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-[16px] font-bold">{t.time}</legend>
        {booked === null ? (
          <p className="flex items-center gap-2 text-[14px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
          </p>
        ) : free.length === 0 ? (
          <p className="text-[14px] text-muted">{t.none}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {free.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTime(s)}
                className={clsx(
                  "rounded-xl border py-2.5 text-[15px] font-semibold tabular-nums",
                  s === time ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[14px] font-medium">
          {t.name}
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={80} />
        </label>
        <label className="grid gap-1.5 text-[14px] font-medium">
          {t.phone}
          <input
            className="field"
            type="tel"
            inputMode="tel"
            placeholder="+7 777 123 45 67"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            autoComplete="tel"
            maxLength={20}
          />
        </label>
        <label className="grid gap-1.5 text-[14px] font-medium sm:col-span-2">
          {t.topic}
          <select className="field" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            {CONSULTATION_TOPICS.map((x) => (
              <option key={x.value} value={x.value}>
                {x[locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[14px] font-medium sm:col-span-2">
          {t.comment}
          <textarea className="field" rows={3} maxLength={1000} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </label>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </div>

      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
        {t.consent}
      </label>

      {error && <p className="rounded-xl bg-warn-soft px-4 py-3 text-[15px] text-warn">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-5 w-5" />} {busy ? t.sending : t.submit}
        {!busy && time && date ? ` · ${formatDayRu(date, locale)}, ${time}` : ""}
      </button>
    </form>
  );
}
