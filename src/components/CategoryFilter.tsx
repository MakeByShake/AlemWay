"use client";

import { useState, type ReactNode } from "react";

type Group = { id: string; title: string; content: ReactNode };

export function CategoryFilter({ groups, allLabel }: { groups: Group[]; allLabel: string }) {
  const [active, setActive] = useState("all");
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
      on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/75 hover:border-ink/30"
    }`;

  return (
    <>
      <div className="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist">
        <button type="button" role="tab" aria-selected={active === "all"} className={chip(active === "all")} onClick={() => setActive("all")}>
          {allLabel}
        </button>
        {groups.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={active === g.id} className={chip(active === g.id)} onClick={() => setActive(g.id)}>
            {g.title}
          </button>
        ))}
      </div>
      <div className="space-y-12">
        {groups
          .filter((g) => active === "all" || g.id === active)
          .map((g) => (
            <div key={g.id}>{g.content}</div>
          ))}
      </div>
    </>
  );
}
