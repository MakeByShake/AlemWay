import Link from "next/link";
import clsx from "clsx";
import { ROLE_TITLES, requireAdminUser } from "@/lib/admin/session";
import { getActivity, getTeamStatsData, teamStats, type MemberStats } from "@/lib/admin/activity";
import { formatTenge } from "@/lib/cabinet/payments";
import { almatyNow } from "@/lib/consultation";
import { Badge, PageTitle } from "@/components/admin/bits";
import { ActivityFeed, avatarColor, initials, timeAgo } from "@/components/admin/ActivityFeed";

export const metadata = { title: "Активность команды" };

const PERIODS = [
  { value: "week", title: "7 дней" },
  { value: "month", title: "Этот месяц" },
  { value: "prev", title: "Прошлый месяц" },
  { value: "all", title: "Всё время" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

/** Period bounds as date strings (compare fine with both YYYY-MM-DD and ISO timestamps). */
function bounds(p: Period, today: string): { from?: string; to?: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const first = (yy: number, mm: number) => `${mm < 1 ? yy - 1 : mm > 12 ? yy + 1 : yy}-${String(((mm + 11) % 12) + 1).padStart(2, "0")}-01`;
  if (p === "week") return { from: new Date(Date.now() - 7 * 864e5).toISOString() };
  if (p === "month") return { from: first(y, m) };
  if (p === "prev") return { from: first(y, m - 1), to: first(y, m) };
  return {};
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const me = await requireAdminUser({ full: true });
  // Money (contract sums, payments) only for the owner, as on «Финансы».
  const money = me.role === "owner";
  const sp = await searchParams;
  const period: Period = PERIODS.some((x) => x.value === sp.period) ? (sp.period as Period) : "month";
  const { from, to } = bounds(period, almatyNow().date);

  const [data, feed] = await Promise.all([getTeamStatsData(), getActivity({ since: from, limit: 80 })]);
  const stats = teamStats(data, from, to);
  const names = Object.fromEntries(data.members.map((m) => [m.login, m.name]));
  const feedItems = to ? feed.filter((a) => a.at < to) : feed;

  const total = {
    sold: stats.reduce((s, m) => s + m.sold, 0),
    soldSum: stats.reduce((s, m) => s + m.soldSum, 0),
    paidSum: stats.reduce((s, m) => s + m.paidSum, 0),
    actions: stats.reduce((s, m) => s + m.actions, 0),
    noSeller: data.cabinets.filter((c) => !c.seller).length,
  };

  const sales = [...stats]
    .filter((m) => m.sold > 0 || m.role === "sales")
    .sort((a, b) => (money ? b.soldSum - a.soldSum : 0) || b.sold - a.sold);
  const topSales = Math.max(1, ...sales.map((m) => (money ? m.soldSum : m.sold)));
  const workers = [...stats].sort((a, b) => b.actions - a.actions || b.leading - a.leading);
  const topActions = Math.max(1, ...workers.map((m) => m.actions));

  const kpis = [
    { label: "Продано клиентов", value: String(total.sold), tone: "" },
    ...(money
      ? [
          { label: "Сумма договоров", value: formatTenge(total.soldSum), tone: "" },
          { label: "Оплачено по продажам", value: formatTenge(total.paidSum), tone: "text-[#0a7a42]" },
        ]
      : []),
    { label: "Действий команды", value: String(total.actions), tone: "text-brand" },
  ];

  return (
    <>
      <PageTitle title="Активность команды" />

      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={p.value === "month" ? "/admin/activity" : `/admin/activity?period=${p.value}`}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-[14px] font-medium",
              period === p.value ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
            )}
          >
            {p.title}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-[13px] text-muted">{k.label}</p>
            <p className={`mt-1 text-[22px] font-bold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <section className="card p-4 sm:p-6">
          <h2 className="text-[18px] font-bold">🤝 Кто сколько продал</h2>
          <p className="mb-4 mt-1 text-[13px] text-muted">
            По полю «Кто продал» в карточке клиента{money ? "; оплачено — подтверждённые оплаты этих клиентов" : ""}.
            {total.noSeller > 0 && (
              <>
                {" "}
                У{" "}
                <Link href="/admin/clients?seller=-" className="font-medium text-brand hover:underline">
                  {total.noSeller} клиентов
                </Link>{" "}
                продавец не указан.
              </>
            )}
          </p>
          {sales.length === 0 ? (
            <p className="text-[14px] text-muted">За этот период продаж нет. Укажите «Кто продал» в карточках клиентов.</p>
          ) : (
            <ol className="grid gap-4">
              {sales.map((m, i) => (
                <SalesRow key={m.login} m={m} place={i} money={money} width={((money ? m.soldSum : m.sold) / topSales) * 100} />
              ))}
            </ol>
          )}
        </section>

        <section className="card p-4 sm:p-6">
          <h2 className="text-[18px] font-bold">⚡ Лента действий</h2>
          <p className="mb-4 mt-1 text-[13px] text-muted">Что команда делала с клиентами — новые сверху.</p>
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <ActivityFeed items={feedItems} names={names} />
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-1 text-[18px] font-bold">👥 Кто сколько работает</h2>
        <p className="mb-4 text-[13px] text-muted">«Ведёт сейчас» и «Завершено» — за всё время; остальное — за выбранный период.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workers.map((m) => (
            <WorkerCard key={m.login} m={m} width={(m.actions / topActions) * 100} />
          ))}
        </div>
      </section>
    </>
  );
}

function Avatar({ m, big }: { m: MemberStats; big?: boolean }) {
  const online = m.online;
  return (
    <span className={clsx("relative flex shrink-0 items-center justify-center rounded-full font-bold", big ? "h-12 w-12 text-[16px]" : "h-10 w-10 text-[14px]", avatarColor(m.login))}>
      {initials(m.name)}
      {online && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-accent ring-2 ring-white" title="Активен(на) сейчас" />}
    </span>
  );
}

function SalesRow({ m, place, money, width }: { m: MemberStats; place: number; money: boolean; width: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-7 text-center text-[20px]" aria-label={`${place + 1} место`}>
        {MEDALS[place] ?? <span className="text-[14px] font-semibold text-muted">{place + 1}</span>}
      </span>
      <Avatar m={m} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold">
            {m.name} <span className="text-[12.5px] font-normal text-muted">{ROLE_TITLES[m.role] ?? m.role}</span>
          </p>
          <p className="text-[14px] tabular-nums">
            <b>{m.sold}</b> {plural(m.sold, "клиент", "клиента", "клиентов")}
            {money && m.soldSum > 0 && <span className="text-muted"> · {formatTenge(m.soldSum)}</span>}
          </p>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
          <div className="team-bar h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${Math.max(width, m.sold ? 4 : 0)}%` }} />
        </div>
        {money && m.paidSum > 0 && <p className="mt-1 text-[12.5px] text-[#0a7a42]">оплачено {formatTenge(m.paidSum)}</p>}
      </div>
    </li>
  );
}

function WorkerCard({ m, width }: { m: MemberStats; width: number }) {
  const cells = [
    { label: "Ведёт сейчас", value: m.leading, href: `/admin/clients?manager=${m.login}` },
    { label: "Завершено", value: m.finished },
    { label: "Консультаций", value: m.consultations },
    { label: "Продал", value: m.sold, href: `/admin/clients?seller=${m.login}` },
  ];
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar m={m} big />
        <div className="min-w-0">
          <p className="truncate font-semibold">{m.name}</p>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <Badge tone={m.role === "owner" ? "blue" : m.role === "sales" ? "green" : "gray"}>{ROLE_TITLES[m.role] ?? m.role}</Badge>
            {m.lastAt ? `был(а) ${timeAgo(m.lastAt)}` : "ещё нет действий"}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {cells.map((c) => {
          const inner = (
            <>
              <p className="text-[20px] font-bold tabular-nums">{c.value}</p>
              <p className="text-[11.5px] leading-tight text-muted">{c.label}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="rounded-lg bg-surface px-1 py-2 hover:bg-brand-soft">
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="rounded-lg bg-surface px-1 py-2">
              {inner}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-[12.5px] text-muted">
          <span>Действий за период</span>
          <b className="text-ink tabular-nums">{m.actions}</b>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="team-bar h-full rounded-full bg-brand" style={{ width: `${Math.max(width, m.actions ? 3 : 0)}%` }} />
        </div>
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10,
    b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
}
