import Link from "next/link";
import { cabinetName, getFinanceRows } from "@/lib/admin/data";
import { requireAdminUser } from "@/lib/admin/session";
import { getAiStats } from "@/lib/ai/usage";
import { AiBalance } from "@/components/admin/AiBalance";
import { formatTenge, paymentTotals } from "@/lib/cabinet/payments";
import { Badge, Empty, FilterTabs, PageTitle, SERVICE_SHORT, fmtDate } from "@/components/admin/bits";

export const metadata = { title: "Финансы" };

const FILTERS = [
  { value: "overdue", title: "Просрочено" },
  { value: "debt", title: "Должники" },
  { value: "paid", title: "Оплачено полностью" },
  { value: "noprice", title: "Сумма не указана" },
];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser({ owner: true });
  const { status } = await searchParams;
  const [rawRows, ai] = await Promise.all([getFinanceRows(), getAiStats()]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
  const rows = rawRows.map((r) => ({ ...r, money: paymentTotals(r.price, r.payments, { discount: r.discount, plan: r.plan, today }) }));
  // Plan parts not paid yet: overdue first, then the nearest dates.
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
  const dues = rows
    .flatMap((r) => r.money.plan.filter((p) => p.left > 0 && p.dueDate && p.dueDate <= soon).map((p) => ({ ...p, row: r })))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const month = new Date().toISOString().slice(0, 7);
  const all = rows.flatMap((r) => (r.payments ?? []).map((p) => ({ ...p, row: r })));
  const confirmed = all.filter((p) => p.status === "confirmed");
  const pending = all.filter((p) => p.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sum = (xs: { amount: number; kind?: string }[]) => xs.reduce((s, x) => s + (x.kind === "refund" ? -1 : 1) * (x.amount || 0), 0);

  const totals = {
    expected: rows.reduce((s, r) => s + r.money.price, 0),
    paid: sum(confirmed),
    debt: rows.reduce((s, r) => s + r.money.remaining, 0),
    month: sum(confirmed.filter((p) => (p.paidAt ?? p.createdAt).startsWith(month))),
    pending: sum(pending),
    overdue: rows.reduce((s, r) => s + r.money.overdue, 0),
    discounts: rows.reduce((s, r) => s + r.money.discount, 0),
  };

  const byManager = new Map<string, { paid: number; debt: number; clients: number }>();
  for (const r of rows) {
    const k = r.managerName || "Без менеджера";
    const m = byManager.get(k) ?? { paid: 0, debt: 0, clients: 0 };
    m.paid += r.money.paid;
    m.debt += r.money.remaining;
    m.clients += 1;
    byManager.set(k, m);
  }

  const filtered = rows.filter((r) =>
    status === "overdue" ? r.money.overdue > 0 : status === "debt" ? r.money.remaining > 0 : status === "paid" ? r.money.hasPrice && r.money.remaining === 0 : status === "noprice" ? !r.money.hasPrice : true
  );

  const cards = [
    { label: "Получено всего", value: totals.paid, tone: "text-[#0a7a42]" },
    { label: "За этот месяц", value: totals.month, tone: "" },
    { label: "Ждём от клиентов", value: totals.debt, tone: "text-warn" },
    { label: "Просрочено", value: totals.overdue, tone: totals.overdue ? "text-red-700" : "" },
    { label: "Чеки на проверке", value: totals.pending, tone: "text-brand", extra: pending.length ? `${pending.length} шт.` : "" },
    { label: "Сумма всех договоров", value: totals.expected, tone: "", extra: totals.discounts ? `скидки: ${formatTenge(totals.discounts)}` : "" },
  ];

  return (
    <>
      <PageTitle title="Финансы" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[13px] text-muted">{c.label}</p>
            <p className={`mt-1 text-[17px] font-bold tabular-nums min-[400px]:text-[19px] sm:text-[22px] ${c.tone}`}>{formatTenge(c.value)}</p>
            {c.extra && <p className="text-[13px] text-muted">{c.extra}</p>}
          </div>
        ))}
      </div>

      {dues.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[18px] font-bold">Сроки оплаты: просрочено и на 2 недели</h2>
          <ul className="card divide-y divide-line">
            {dues.map((p) => (
              <li key={`${p.row._id}-${p._key}`}>
                <Link prefetch={false} href={`/admin/clients/${p.row._id}?tab=payment`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface">
                  <span className="min-w-0">
                    <b>
                      {p.row.number ? `№${p.row.number} · ` : ""}
                      {cabinetName(p.row)}
                    </b>{" "}
                    <span className="text-[13px] text-muted">
                      · {p.title} · {p.row.managerName || "без менеджера"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <b className="tabular-nums whitespace-nowrap">{formatTenge(p.left)}</b>
                    <Badge tone={p.state === "overdue" ? "red" : "amber"}>
                      {p.state === "overdue" ? "просрочено с" : "до"} {fmtDate(p.dueDate, false)}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[18px] font-bold">Чеки на проверке</h2>
          <ul className="card divide-y divide-line">
            {pending.map((p) => (
              <li key={p._key}>
                <Link prefetch={false} href={`/admin/clients/${p.row._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface">
                  <span>
                    <b>{cabinetName(p.row)}</b> <span className="text-[13px] text-muted">· {fmtDate(p.createdAt)} · {p.row.managerName || "без менеджера"}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <b className="tabular-nums">{formatTenge(p.amount)}</b> <Badge tone="amber">Проверить →</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-[18px] font-bold">По менеджерам</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[480px] text-[14px]">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Менеджер</th>
                <th className="px-4 py-2.5 font-medium">Клиентов</th>
                <th className="px-4 py-2.5 font-medium">Получено</th>
                <th className="px-4 py-2.5 font-medium">Долг клиентов</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...byManager.entries()].map(([name, m]) => (
                <tr key={name}>
                  <td className="px-4 py-2.5 font-semibold">{name}</td>
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{m.clients}</td>
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{formatTenge(m.paid)}</td>
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{formatTenge(m.debt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[18px] font-bold">Клиенты</h2>
        <FilterTabs base="/admin/finance" current={status} items={FILTERS} />
        {filtered.length === 0 ? (
          <Empty>Нет клиентов</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Клиент</th>
                  <th className="px-4 py-2.5 font-medium">Менеджер</th>
                  <th className="px-4 py-2.5 font-medium">К оплате</th>
                  <th className="px-4 py-2.5 font-medium">Оплачено</th>
                  <th className="px-4 py-2.5 font-medium">Остаток</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-surface">
                    <td className="px-4 py-2.5">
                      <Link prefetch={false} href={`/admin/clients/${r._id}`} className="font-semibold hover:text-brand">
                        {r.number ? `№${r.number} · ` : ""}
                        {cabinetName(r)}
                      </Link>
                      <span className="block text-[12.5px] text-muted">{SERVICE_SHORT[r.service ?? "ferienjob"]}</span>
                    </td>
                    <td className="px-4 py-2.5">{r.managerName || "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                      {r.money.hasPrice ? formatTenge(r.money.price) : <span className="whitespace-nowrap text-muted">не указана</span>}
                      {r.money.discount > 0 && <span className="block text-[12px] text-muted">скидка {formatTenge(r.money.discount)}</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                      {formatTenge(r.money.paid)}
                      {r.money.pending > 0 && <span className="block text-[12px] text-brand">+ {formatTenge(r.money.pending)} на проверке</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                      {!r.money.hasPrice ? "—" : r.money.remaining > 0 ? <Badge tone={r.money.overdue ? "red" : "amber"}>{formatTenge(r.money.remaining)}</Badge> : <Badge tone="green">Оплачено ✅</Badge>}
                      {r.money.overdue > 0 && <span className="block text-[12px] font-semibold text-red-700">просрочено {formatTenge(r.money.overdue)}</span>}
                      {r.money.next && r.money.overdue === 0 && r.money.next.dueDate && <span className="block text-[12px] text-muted">след.: до {fmtDate(r.money.next.dueDate, false)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="mt-8">
        <AiBalance stats={ai} />
      </div>
    </>
  );
}
