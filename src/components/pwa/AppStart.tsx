"use client";

import { useState } from "react";
import { BriefcaseBusiness, GraduationCap, Link2 } from "lucide-react";

/** The login key from a pasted personal link (…/c/<key>) or the key itself. */
function keyOf(text: string) {
  const t = text.trim();
  const m = t.match(/\/c\/([A-Za-z0-9_-]{20,80})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,80}$/.test(t) ? t : null;
}

export function AppStart() {
  const [who, setWho] = useState<"client" | null>(null);
  const [link, setLink] = useState("");
  const [bad, setBad] = useState(false);
  const card = "card flex w-full items-center gap-4 p-5 text-left hover:border-brand";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static logo */}
      <img src="/brand/alemway_icon.svg" alt="" width={72} height={72} className="mx-auto h-[72px] w-[72px] rounded-[20px]" />
      <h1 className="mt-4 text-center text-[26px] font-bold">AlemWay</h1>
      <p className="mt-1 text-center text-[15px] text-muted">Кім кіреді? · Кто входит?</p>

      {who !== "client" ? (
        <div className="mt-8 grid gap-3">
          <button type="button" onClick={() => setWho("client")} className={card}>
            <GraduationCap className="h-8 w-8 shrink-0 text-brand" />
            <span>
              <span className="block text-[18px] font-bold">Я клиент</span>
              <span className="block text-[14px] text-muted">Мен клиентпін · кабинет, документы, чат</span>
            </span>
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the admin is a separate app */}
          <a href="/admin/login" className={card}>
            <BriefcaseBusiness className="h-8 w-8 shrink-0 text-brand" />
            <span>
              <span className="block text-[18px] font-bold">Я сотрудник</span>
              <span className="block text-[14px] text-muted">Мен қызметкермін · админка и чаты</span>
            </span>
          </a>
        </div>
      ) : (
        <form
          className="card mt-8 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const k = keyOf(link);
            if (!k) return setBad(true);
            // A full page load: the login link sets the cabinet cookie on the server.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = `/c/${k}`;
          }}
        >
          <p className="text-[17px] font-bold">Вход в кабинет</p>
          <p className="mt-1 text-[14.5px] text-muted">
            Нажмите на личную ссылку, которую прислал куратор в WhatsApp: кабинет откроется в приложении. Или вставьте ссылку сюда.
          </p>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-brand">
            <Link2 className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setBad(false);
              }}
              placeholder="https://alemway.kz/c/…"
              aria-label="Личная ссылка"
              className="min-h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </label>
          {bad && <p className="mt-2 text-[14px] text-red-600">Это не похоже на ссылку на кабинет. Скопируйте её из сообщения куратора целиком.</p>}
          <button type="submit" className="btn-primary mt-4 min-h-12 w-full text-[16px]">
            Войти
          </button>
          <button type="button" onClick={() => setWho(null)} className="mt-2 w-full py-2 text-[14px] font-medium text-muted hover:text-ink">
            Назад
          </button>
        </form>
      )}
    </main>
  );
}
