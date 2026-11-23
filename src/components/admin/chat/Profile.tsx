"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Check, CircleAlert, Download, FileText, FolderArchive, IdCard, Loader2, Megaphone, Phone, Send, X } from "lucide-react";
import type { ChatProfile, ProfileFile } from "@/lib/chat/admin";
import { formatTenge } from "@/lib/cabinet/payments";
import { Badge, WA_TARGET, fmtDate, type Tone } from "@/components/admin/bits";
import { Avatar } from "./Avatar";
import type { BroadcastParty } from "./Broadcast";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** WhatsApp chat with a number: the phone app on a phone, WhatsApp Web (one reused tab) on a computer. */
function WhatsApp({ digits, className, children }: { digits: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        if (window.matchMedia("(pointer: coarse)").matches) return;
        e.preventDefault();
        window.open(`https://web.whatsapp.com/send?phone=${digits}`, WA_TARGET, "noopener");
      }}
    >
      {children}
    </a>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function deadlineText(d: NonNullable<ChatProfile["deadline"]>) {
  if (d.state === "done") return `до ${d.date} · сдано`;
  if (d.state === "overdue") return `был до ${d.date} · просрочен на ${Math.abs(d.days)} дн.`;
  return `до ${d.date} · ${d.days === 0 ? "сегодня последний день" : `осталось ${d.days} дн.`}`;
}

export type ProfileProps = {
  id: string;
  /** Changes when the chat got new messages or documents: the profile reloads. */
  stamp: string;
  canWrite: boolean;
  /** Documents the team has already asked for in this chat. */
  asked: readonly string[];
  onClose: () => void;
  onOpenChat: (id: string) => void;
  onAsked: () => void;
  onBroadcast: (party: BroadcastParty) => void;
};

/**
 * The client's profile next to the chat, like a contact's page in a messenger:
 * who it is, how to reach them, where the case stands, every document, the payment.
 */
export function Profile({ id, stamp, canWrite, asked, onClose, onOpenChat, onAsked, onBroadcast }: ProfileProps) {
  const [p, setP] = useState<ChatProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    let dead = false;
    void (async () => {
      // «after=9» — no messages, only the profile.
      const res = await fetch(`/api/admin/chat?id=${encodeURIComponent(id)}&profile=1&after=9`, { cache: "no-store" }).catch(() => null);
      const json = res?.ok ? ((await res.json().catch(() => null)) as { ok?: boolean; profile?: ChatProfile } | null) : null;
      if (dead) return;
      if (json?.ok && json.profile) {
        setP(json.profile);
        setFailed(false);
      } else setFailed(true);
    })();
    return () => {
      dead = true;
    };
  }, [id, stamp, again]);

  async function ask(kind: string) {
    setAsking(kind);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ id, doc: kind }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message || "Не получилось. Попробуйте ещё раз.");
      setSent((s) => [...s, kind]);
      onAsked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось. Попробуйте ещё раз.");
    } finally {
      setAsking(null);
    }
  }

  const main = p?.phones[0];
  const quick = "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border border-line bg-white px-2 text-[13px] font-semibold hover:border-brand";

  return (
    <aside
      aria-label="Профиль клиента"
      className="fixed inset-0 z-[65] flex flex-col bg-white lg:absolute lg:inset-y-0 lg:right-0 lg:left-auto lg:z-20 lg:w-[380px] lg:border-l lg:border-line lg:shadow-[-16px_0_32px_-20px_rgba(11,15,36,0.35)] 2xl:static 2xl:z-auto 2xl:w-[360px] 2xl:shrink-0 2xl:shadow-none"
    >
      <header className="flex items-center gap-1 border-b border-line px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:pt-2">
        <button type="button" onClick={onClose} aria-label="Закрыть профиль" title="Закрыть профиль" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface">
          <ArrowLeft className="h-5 w-5 lg:hidden" />
          <X className="hidden h-5 w-5 lg:block" />
        </button>
        <p className="text-[16px] font-bold">Профиль клиента</p>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!p && !failed && (
          <p className="flex justify-center py-10 text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </p>
        )}
        {!p && failed && (
          <div className="py-10 text-center text-[15px] text-muted">
            <p>Не получилось загрузить профиль.</p>
            <button type="button" onClick={() => setAgain((n) => n + 1)} className="btn-ghost mt-3 min-h-10 px-4 text-[14px]">
              Повторить
            </button>
          </div>
        )}
        {p && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <Avatar name={p.name} size="lg" />
              <p className="mt-2 text-[19px] leading-tight font-bold">{p.name}</p>
              <p className="mt-0.5 text-[13.5px] text-muted">
                {p.number != null ? `№${p.number} · ` : ""}
                {p.serviceTitle}
              </p>
              <Badge tone={p.stage.tone as Tone} className="mt-2 max-w-full !whitespace-normal">
                {p.stage.step}/{p.stage.total} · {p.stage.label}
              </Badge>
            </div>

            <div className={clsx("grid gap-2", main ? "grid-cols-3" : "grid-cols-1")}>
              {main && (
                <a href={`tel:+${main.digits}`} className={quick}>
                  <Phone className="h-[18px] w-[18px] text-brand" /> Позвонить
                </a>
              )}
              {main && (
                <WhatsApp digits={main.digits} className={quick}>
                  <Send className="h-[18px] w-[18px] text-[#128c4a]" /> WhatsApp
                </WhatsApp>
              )}
              <Link prefetch={false} href={`/admin/clients/${p.id}`} className={quick}>
                <IdCard className="h-[18px] w-[18px] text-brand" /> Карточка
              </Link>
            </div>
            {!main && <p className="text-center text-[13px] text-muted">Телефон клиента не указан.</p>}

            <Section title="Дело">
              <dl className="space-y-1.5 text-[14.5px]">
                <Fact label="Ведущий" value={p.managerName || "не назначен"} />
                {p.sellerName && <Fact label="Продал" value={p.sellerName} />}
                {p.deadline && <Fact label="Срок сдачи" value={deadlineText(p.deadline)} tone={p.deadline.state === "overdue" ? "red" : p.deadline.state === "done" ? "green" : undefined} />}
              </dl>
              {p.dean && (
                <p className="mt-2 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[13.5px] text-orange-800">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <b>Деканат не ставит печать.</b> {p.dean}
                  </span>
                </p>
              )}
            </Section>

            {p.phones.length > 0 && (
              <Section title="Телефоны">
                <ul className="space-y-1.5">
                  {p.phones.map((ph) => (
                    <li key={ph.digits} className="flex items-center gap-2 text-[14.5px]">
                      <span className="min-w-0 flex-1">
                        <a href={`tel:+${ph.digits}`} className="font-semibold tabular-nums hover:text-brand">
                          {ph.phone}
                        </a>
                        <span className="block truncate text-[12.5px] text-muted">{ph.label}</span>
                      </span>
                      <WhatsApp digits={ph.digits} className="btn-whatsapp min-h-8 shrink-0 px-2.5 text-[13px]">
                        WhatsApp
                      </WhatsApp>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {p.facts.length > 0 && (
              <Section title="Данные">
                <dl className="space-y-1.5 text-[14.5px]">
                  {p.facts.map((f) => (
                    <Fact key={f.label} label={f.label} value={f.value} />
                  ))}
                </dl>
              </Section>
            )}

            {p.companions.length > 0 && (
              <Section
                title="Едут вместе"
                aside={
                  canWrite && (
                    <button type="button" onClick={() => onBroadcast({ id: p.id, name: p.name, number: p.number })} className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
                      <Megaphone className="h-3.5 w-3.5" /> Написать всем
                    </button>
                  )
                }
              >
                <ul className="space-y-1">
                  {p.companions.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpenChat(c.id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[14.5px] hover:bg-surface" title="Открыть чат">
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                        {c.number != null && <span className="shrink-0 text-[12.5px] text-muted tabular-nums">№{c.number}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section
              title={`Документы · ${p.fileCount} из ${p.files.length}`}
              aside={
                p.fileCount > 0 && (
                  <a href={`/api/admin/cabinet/zip?id=${encodeURIComponent(p.id)}`} className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
                    <FolderArchive className="h-3.5 w-3.5" /> Скачать всё
                  </a>
                )
              }
            >
              <ul className="grid grid-cols-2 gap-2">
                {p.files.map((f) => (
                  <li key={f.kind}>
                    <Tile id={p.id} f={f} canAsk={canWrite && f.canAsk} asked={asked.includes(f.kind) || sent.includes(f.kind)} asking={asking === f.kind} busy={Boolean(asking)} onAsk={() => void ask(f.kind)} />
                  </li>
                ))}
              </ul>
              {error && (
                <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[13.5px] text-red-700">
                  {error}
                </p>
              )}
              {p.ai && (
                <div className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-[13.5px]">
                  <p className="font-semibold text-warn">Проверка ИИ: документы не готовы</p>
                  {p.ai.missing.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {p.ai.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Section>

            {p.money && (
              <Section title="Оплата">
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className={clsx("h-full rounded-full", p.money.remaining > 0 ? "bg-brand" : "bg-accent")} style={{ width: `${p.money.price > 0 ? Math.min(100, Math.round((p.money.paid / p.money.price) * 100)) : 0}%` }} />
                </div>
                <dl className="mt-2 space-y-1.5 text-[14.5px]">
                  <Fact label="Оплачено" value={`${formatTenge(p.money.paid)} из ${formatTenge(p.money.price)}`} />
                  <Fact label="Осталось" value={p.money.remaining > 0 ? formatTenge(p.money.remaining) : "оплачено полностью"} tone={p.money.remaining > 0 ? undefined : "green"} />
                  {p.money.pending !== 0 && <Fact label="На проверке" value={formatTenge(p.money.pending)} />}
                  {p.money.overdue > 0 && <Fact label="Просрочено" value={formatTenge(p.money.overdue)} tone="red" />}
                </dl>
              </Section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <div className="flex gap-3">
      <dt className="w-[118px] shrink-0 text-muted">{label}</dt>
      <dd className={clsx("min-w-0 flex-1 break-words font-medium", tone === "red" && "text-red-700", tone === "green" && "text-[#0a7a42]")}>{value}</dd>
    </div>
  );
}

function Tile({ id, f, canAsk, asked, asking, busy, onAsk }: { id: string; f: ProfileFile; canAsk: boolean; asked: boolean; asking: boolean; busy: boolean; onAsk: () => void }) {
  const url = `/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${f.kind}`;
  if (f.state === "ok") {
    return (
      <div className="flex h-full flex-col rounded-xl border border-accent/40 bg-accent-soft/50 p-2.5">
        <a href={`${url}&view=1`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-start gap-2 hover:text-brand" title="Открыть документ">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0a7a42]" />
          <span className="min-w-0 text-[13.5px] leading-snug font-semibold break-words">{f.label}</span>
        </a>
        <div className="mt-1.5 flex items-center justify-between gap-1 text-[12px] text-muted">
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-[#0a7a42]" /> {f.uploadedAt ? fmtDate(f.uploadedAt, false) : "есть"}
          </span>
          <a href={url} aria-label={`Скачать: ${f.label}`} title="Скачать" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white hover:text-brand">
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }
  const warn = f.state === "warn";
  return (
    <div className={clsx("flex h-full flex-col rounded-xl border border-dashed p-2.5", warn ? "border-orange-300 bg-orange-50" : "border-line bg-surface/60")}>
      <div className="flex flex-1 items-start gap-2">
        <FileText className={clsx("mt-0.5 h-5 w-5 shrink-0", warn ? "text-orange-500" : "text-muted/70")} />
        <span className="min-w-0 text-[13.5px] leading-snug font-semibold break-words text-ink/80">{f.label}</span>
      </div>
      <p className={clsx("mt-1.5 text-[12px]", warn ? "font-semibold text-orange-700" : "text-muted")}>{warn ? "деканат не ставит" : "нет"}</p>
      {canAsk && (
        <button type="button" onClick={onAsk} disabled={busy} className="mt-1.5 flex min-h-8 items-center justify-center gap-1 rounded-lg bg-white px-2 text-[12.5px] font-semibold text-brand shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-brand)] disabled:opacity-60">
          {asking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {asked ? "Попросить ещё раз" : "Попросить у клиента"}
        </button>
      )}
    </div>
  );
}
