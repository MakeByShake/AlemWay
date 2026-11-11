import Link from "next/link";
import { cabinetName, getFinanceRows } from "@/lib/admin/data";
import { requireAdminUser } from "@/lib/admin/session";
import { getAiStats } from "@/lib/ai/usage";
import { AiBalance } from "@/components/admin/AiBalance";
import { formatTenge, paymentTotals } from "@/lib/cabinet/payments";
import { Badge, Empty, FilterTabs, PageTitle, SERVICE_SHORT, fmtDate } from "@/components/admin/bits";

export const metadata = { title: "Финансы" };

const FILTERS = [
  { value: "debt", title: "Должники" },
  { value: "paid", title: "Оплачено полностью" },
  { value: "noprice", title: "Сумма не указана" },
];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser({ owner: true });
  const { status } = await searchParams;
  const [rawRows, ai] = await Promise.all([getFinanceRows(), getAiStats()]);
  const rows = rawRows.map((r) => ({ ...r, money: paymentTotals(r.price, r.payments) }));

  const month = new Date().toISOString().slice(0, 7);
  const all = rows.flatMap((r) => (r.payments ?? []).map((p) => ({ ...p, row: r })));
  const confirmed = all.filter((p) => p.status === "confirmed");
  const pending = all.filter((p) => p.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + (x.amount || 0), 0);

  const totals = {
    expected: rows.reduce((s, r) => s + r.money.price, 0),
    paid: sum(confirmed),
    debt: rows.reduce((s, r) => s + r.money.remaining, 0),
    month: sum(confirmed.filter((p) => (p.paidAt ?? p.createdAt).startsWith(month))),
    pending: sum(pending),
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
    status === "debt" ? r.money.remaining > 0 : status === "paid" ? r.money.hasPrice && r.money.remaining === 0 : status === "noprice" ? !r.money.hasPrice : true
  );

  const cards = [
    { label: "Получено всего", value: totals.paid, tone: "text-[#0a7a42]" },
    { label: "За этот месяц", value: totals.month, tone: "" },
    { label: "Ждём от клиентов", value: totals.debt, tone: "text-warn" },
    { label: "Чеки на проверке", value: totals.pending, tone: "text-brand", extra: pending.length ? `${pending.length} шт.` : "" },
    { label: "Сумма всех договоров", value: totals.expected, tone: "" },
  ];

  return (
    <>
      <PageTitle title="Финансы" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[13px] text-muted">{c.label}</p>
            <p className={`mt-1 text-[22px] font-bold tabular-nums ${c.tone}`}>{formatTenge(c.value)}</p>
            {c.extra && <p className="text-[13px] text-muted">{c.extra}</p>}
          </div>
        ))}
      </div>

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
                  <td className="px-4 py-2.5 tabular-nums">{m.clients}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatTenge(m.paid)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatTenge(m.debt)}</td>
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
                    <td className="px-4 py-2.5 tabular-nums">{r.money.hasPrice ? formatTenge(r.money.price) : <span className="text-muted">не указана</span>}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatTenge(r.money.paid)}
                      {r.money.pending > 0 && <span className="block text-[12px] text-brand">+ {formatTenge(r.money.pending)} на проверке</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {!r.money.hasPrice ? "—" : r.money.remaining > 0 ? <Badge tone="amber">{formatTenge(r.money.remaining)}</Badge> : <Badge tone="green">Оплачено ✅</Badge>}
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
