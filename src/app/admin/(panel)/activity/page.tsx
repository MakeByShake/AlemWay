import Link from "next/link";
import clsx from "clsx";
import { ROLE_TITLES, isTopRole, requireAdminUser } from "@/lib/admin/session";
import { getActivity, getTeamStatsData, teamStats, type MemberStats } from "@/lib/admin/activity";
import { formatTenge } from "@/lib/cabinet/payments";
import { almatyNow } from "@/lib/consultation";
import { PERIODS, dayBounds, periodBounds, toDay, toPeriod } from "@/lib/admin/periods";
import { Badge, PageTitle } from "@/components/admin/bits";
import { ActivityFeed, avatarColor, initials, timeAgo } from "@/components/admin/ActivityFeed";

export const metadata = { title: "Активность команды" };


const MEDALS = ["🥇", "🥈", "🥉"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ period?: string; date?: string }> }) {
  const me = await requireAdminUser({ full: true });
  // Money (contract sums, payments) only for the owner, as on «Финансы».
  const money = isTopRole(me.role);
  const sp = await searchParams;
  const today = almatyNow().date;
  // A day picked in the calendar wins over the period buttons.
  const day = toDay(sp.date);
  const period = toPeriod(sp.period);
  const { from, to } = day ? dayBounds(day) : periodBounds(period, today);

  const [data, feed] = await Promise.all([getTeamStatsData(), getActivity({ since: from, until: to, limit: day ? 300 : 80 })]);
  const stats = teamStats(data, from, to);
  const names = Object.fromEntries(data.members.map((m) => [m.login, m.name]));
  const feedItems = feed;

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
          { label: "Оплачено по продажам (факт)", value: `${formatTenge(total.paidSum)}${total.soldSum ? ` · ${Math.round((total.paidSum / total.soldSum) * 100)}%` : ""}`, tone: "text-[#0a7a42]" },
          { label: "Осталось получить", value: formatTenge(Math.max(0, total.soldSum - total.paidSum)), tone: "" },
        ]
      : []),
    { label: "Действий команды", value: String(total.actions), tone: "text-brand" },
  ];

  return (
    <>
      <PageTitle title={day ? `Активность команды — ${day.split("-").reverse().join(".")}` : "Активность команды"} />

      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link prefetch={false}
            key={p.value}
            href={p.value === "month" ? "/admin/activity" : `/admin/activity?period=${p.value}`}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-[14px] font-medium",
              !day && period === p.value ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
            )}
          >
            {p.title}
          </Link>
        ))}
        <form action="/admin/activity" className="flex items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={day}
            max={today}
            aria-label="Выбрать день"
            className={clsx("rounded-full border px-3 py-1 text-[14px]", day ? "border-brand bg-brand-soft" : "border-line bg-white")}
          />
          <button type="submit" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[14px] font-medium hover:border-brand">
            📅 Показать день
          </button>
        </form>
        <a
          href={day ? `/admin/export/activity?date=${day}` : `/admin/export/activity?period=${period}`}
          download
          className="ml-auto rounded-full border border-line bg-white px-3.5 py-1.5 text-[14px] font-medium hover:border-brand"
        >
          ⬇️ Скачать Excel
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-[13px] text-muted">{k.label}</p>
            <p className={`mt-1 text-[17px] font-bold tabular-nums min-[400px]:text-[19px] sm:text-[22px] ${k.tone}`}>{k.value}</p>
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
                <Link prefetch={false} href="/admin/clients?seller=-" className="font-medium text-brand hover:underline">
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

const paidPct = (m: MemberStats) => (m.soldSum > 0 ? Math.min(100, Math.round((m.paidSum / m.soldSum) * 100)) : 0);

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
          <div className="team-bar relative h-full overflow-hidden rounded-full bg-brand/25" style={{ width: `${Math.max(width, m.sold ? 4 : 0)}%` }}>
            {/* Paid part of the contracts — the bar fills up as clients pay. */}
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: money ? `${paidPct(m)}%` : "100%" }} />
          </div>
        </div>
        {money && m.soldSum > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] tabular-nums">
            <span className="font-semibold text-[#0a7a42]">
              по факту оплачено {formatTenge(m.paidSum)} ({paidPct(m)}%)
            </span>
            {m.soldSum > m.paidSum && <span className="text-muted">осталось получить {formatTenge(m.soldSum - m.paidSum)}</span>}
          </p>
        )}
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
            <Link prefetch={false} key={c.label} href={c.href} className="rounded-lg bg-surface px-1 py-2 hover:bg-brand-soft">
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
