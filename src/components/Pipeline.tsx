import clsx from "clsx";
import { Check } from "lucide-react";
import { pipelineState, type CabinetStatus, type ServiceId } from "@/lib/cabinet/fields";

const TEXT = {
  ru: { next: "Следующий этап", now: "Сейчас", you: "делаете вы", we: "делаем мы", finished: "Все этапы пройдены 🎉", rejected: "Отказ — свяжитесь с менеджером" },
  kk: { next: "Келесі кезең", now: "Қазір", you: "сіз жасайсыз", we: "біз жасаймыз", finished: "Барлық кезең өтті 🎉", rejected: "Бас тартылды — менеджерге хабарласыңыз" },
};

/** Every step of the client's process: done ✓, current (highlighted), and what comes next. */
export function Pipeline({ service, status, locale = "ru" }: { service: ServiceId; status: CabinetStatus | undefined; locale?: "ru" | "kk" }) {
  const t = TEXT[locale];
  const p = pipelineState(service, status);
  return (
    <div>
      <ol className="grid gap-1.5">
        {p.steps.map((s, i) => {
          const done = i < p.index || p.finished;
          const current = i === p.index && !p.finished;
          return (
            <li
              key={s.status}
              aria-current={current ? "step" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl border px-3 py-2 text-[14px] leading-tight sm:text-[15px]",
                done && "border-accent/30 bg-accent-soft",
                current && "border-brand bg-brand-soft font-semibold",
                !done && !current && "border-line text-muted"
              )}
            >
              <span
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums",
                  done ? "bg-accent text-white" : current ? "bg-brand text-white" : "bg-surface text-muted"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="flex-1">{s.title[locale]}</span>
              {current && <span className="hidden text-[12px] font-medium text-brand sm:inline">{s.who === "client" ? t.you : t.we}</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[14px]">
        {p.rejected ? (
          <b className="text-warn">{t.rejected}</b>
        ) : p.finished ? (
          <b className="text-[#0a7a42]">{t.finished}</b>
        ) : p.next ? (
          <>
            <span className="text-muted">{t.next}: </span>
            <b>{p.next.title[locale]}</b>
          </>
        ) : null}
      </p>
    </div>
  );
}
