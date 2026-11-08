"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import clsx from "clsx";

type Msg = { role: "user" | "assistant"; content: string };

const TEXT = {
  ru: {
    title: "Помощник AlemWay",
    sub: "Подскажет, каких документов не хватает, где взять справку и как заполнить анкету.",
    hello: "Здравствуйте! Я помощник куратора AlemWay. Спросите, что непонятно с документами или декларацией — подскажу.",
    placeholder: "Ваш вопрос…",
    send: "Отправить",
    tooMany: "Слишком много сообщений. Подождите немного или напишите куратору в WhatsApp.",
    error: "Не получилось ответить. Напишите, пожалуйста, куратору в WhatsApp.",
    chips: ["Что мне ещё загрузить?", "Где взять справку на английском?", "У меня ещё нет паспорта"],
    note: "Отвечает ИИ. Важные вопросы (оплата, виза, работодатель) уточняйте у куратора.",
  },
  kk: {
    title: "AlemWay көмекшісі",
    sub: "Қандай құжат жетпейтінін, анықтаманы қайдан алуды және сауалнаманы қалай толтыруды айтады.",
    hello: "Сәлеметсіз бе! Мен AlemWay кураторының көмекшісімін. Құжаттар немесе декларация бойынша сұрағыңызды жазыңыз.",
    placeholder: "Сұрағыңыз…",
    send: "Жіберу",
    tooMany: "Хабарлама тым көп. Біраз күтіңіз немесе WhatsApp-та кураторға жазыңыз.",
    error: "Жауап бере алмадым. WhatsApp-та кураторға жазыңыз.",
    chips: ["Тағы не жүктеуім керек?", "Ағылшынша анықтаманы қайдан аламын?", "Менде әлі паспорт жоқ"],
    note: "ЖИ жауап береді. Маңызды сұрақтарды (төлем, виза, жұмыс беруші) кураторден нақтылаңыз.",
  },
};

const KEY = "aw_chat";

export function CabinetChat({ locale }: { locale: "ru" | "kk" }) {
  const t = TEXT[locale];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the chat after a page refresh
      if (saved) setMsgs(JSON.parse(saved) as Msg[]);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    } catch {}
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/cabinet/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? t.tooMany : t.error);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: answer }]);
      }
      if (!answer.trim()) throw new Error(t.error);
    } catch (err) {
      setMsgs([...next, { role: "assistant", content: err instanceof Error ? err.message : t.error }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container-x pb-6">
      <div className="card mx-auto max-w-3xl p-6">
        <h2 className="flex items-center gap-2 text-[20px] font-bold">
          <Bot className="h-6 w-6 text-brand" /> {t.title}
        </h2>
        <p className="mt-1 text-[14px] text-muted">{t.sub}</p>

        <div ref={box} className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-xl bg-surface p-3 sm:p-4" aria-live="polite">
          <Bubble role="assistant" text={t.hello} />
          {msgs.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.content} typing={busy && i === msgs.length - 1 && !m.content} />
          ))}
        </div>

        {msgs.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {t.chips.map((c) => (
              <button key={c} type="button" onClick={() => ask(c)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[14px] hover:border-brand">
                {c}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1500}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            className="field flex-1"
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn-primary px-4 disabled:opacity-50" aria-label={t.send}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
        <p className="mt-2 text-[12.5px] text-muted">{t.note}</p>
      </div>
    </section>
  );
}

function Bubble({ role, text, typing }: { role: "user" | "assistant"; text: string; typing?: boolean }) {
  return (
    <div className={clsx("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-line",
          role === "user" ? "bg-brand text-white" : "border border-line bg-white text-ink"
        )}
      >
        {typing ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : text}
      </div>
    </div>
  );
}
