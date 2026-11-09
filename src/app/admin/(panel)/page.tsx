import Link from "next/link";
import { getDashboard, cabinetName, LEAD_STATUSES } from "@/lib/admin/data";
import { requireAdminUser } from "@/lib/admin/session";
import { Badge, Empty, PageTitle, Progress, SERVICE_SHORT, fmtDate } from "@/components/admin/bits";

export const metadata = { title: "Главная" };

export default async function AdminHome() {
  const me = await requireAdminUser();
  const d = await getDashboard(me.login);
  const cards = [
    { label: "Мои клиенты", value: d.myClients, href: `/admin/clients?manager=${me.login}` },
    { label: "Новые заявки", value: d.newLeads, href: "/admin/leads?status=new", hot: d.newLeads > 0 },
    { label: "Заявок за 7 дней", value: d.leadsWeek, href: "/admin/leads" },
    { label: "Клиенты в работе", value: d.activeClients, href: "/admin/clients" },
    { label: "Ждут нашего действия", value: d.waitingAction, href: "/admin/clients?status=signed_uploaded", hot: d.waitingAction > 0 },
    { label: "Новые отзывы", value: d.newFeedback, href: "/admin/feedback?status=new", hot: d.newFeedback > 0 },
  ];
  return (
    <>
      <PageTitle title={`Здравствуйте, ${me.name}!`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <a key={c.label} href={c.href} className={`card p-4 transition-colors hover:border-brand ${c.hot ? "border-brand" : ""}`}>
            <p className="text-[13px] text-muted">{c.label}</p>
            <p className={`mt-1 text-[30px] font-bold tabular-nums ${c.hot ? "text-brand" : ""}`}>{c.value}</p>
          </a>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[18px] font-bold">Ждут нашего действия</h2>
          {d.actionClients.length === 0 ? (
            <Empty>Нет клиентов, которые ждут нас 👍</Empty>
          ) : (
            <ul className="card divide-y divide-line">
              {d.actionClients.map((c) => (
                <li key={c._id}>
                  <Link href={`/admin/clients/${c._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface">
                    <span className="font-semibold">
                      {c.number ? `№${c.number} · ` : ""}
                      {cabinetName(c)} <span className="ml-1 text-[13px] font-normal text-muted">{SERVICE_SHORT[c.service ?? "ferienjob"]}</span>
                    </span>
                    <Progress service={c.service} status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-[18px] font-bold">Последние заявки</h2>
          {d.latestLeads.length === 0 ? (
            <Empty>Заявок пока нет</Empty>
          ) : (
            <ul className="card divide-y divide-line">
              {d.latestLeads.map((l) => {
                const st = LEAD_STATUSES.find((x) => x.value === (l.status ?? "new")) ?? LEAD_STATUSES[0];
                return (
                  <li key={l._id}>
                    <Link href="/admin/leads" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface">
                      <span>
                        <span className="font-semibold">{l.name || "Без имени"}</span>
                        <span className="ml-2 text-[13px] text-muted">{l.serviceTitle}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[13px] text-muted">
                        {fmtDate(l.createdAt)} <Badge tone={st.tone}>{st.title}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
