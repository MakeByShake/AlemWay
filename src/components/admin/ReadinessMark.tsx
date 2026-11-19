"use client";

import { useOptimistic, useTransition } from "react";
import { setReadinessAction } from "@/app/admin/actions";

type Mark = "plus" | "zero" | "minus" | "";

const MARKS: { v: Exclude<Mark, "">; label: string; title: string; on: string }[] = [
  { v: "plus", label: "+", title: "Сделает декларацию без проблем", on: "bg-emerald-500 text-white border-emerald-500" },
  { v: "zero", label: "0", title: "Сделает, нужно собрать документы и поставить печать", on: "bg-amber-400 text-white border-amber-400" },
  { v: "minus", label: "−", title: "Декан не поставит печать", on: "bg-red-500 text-white border-red-500" },
];

/** Three quick buttons in the client list; a second click on the active one clears the mark. */
export function ReadinessMark({ id, value, suggested }: { id: string; value?: Mark; suggested?: Mark }) {
  const [current, setCurrent] = useOptimistic<Mark>(value ?? "");
  const [, start] = useTransition();
  const shown = current || suggested || "";
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white text-[14px] font-bold" role="group" aria-label="Отметка по декларации">
      {MARKS.map((m) => {
        const active = shown === m.v;
        return (
          <button
            key={m.v}
            type="button"
            title={m.title + (active && !current ? " (по оранжевой отметке)" : "")}
            aria-pressed={active}
            onClick={(e) => {
              e.preventDefault();
              const next: Mark = current === m.v ? "" : m.v;
              start(async () => {
                setCurrent(next);
                await setReadinessAction(id, next);
              });
            }}
            className={`h-8 w-8 border-l border-line first:border-l-0 transition-colors ${active ? `${m.on} ${current ? "" : "opacity-60"}` : "text-muted hover:bg-surface"}`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
