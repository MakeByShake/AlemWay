import Link from "next/link";
import { getConsultations, getManagerOptions } from "@/lib/admin/data";
import { requireAdminUser } from "@/lib/admin/session";
import { CONSULTATION_PRICE, CONSULTATION_STATUSES, almatyNow, formatDayRu } from "@/lib/consultation";
import { deleteConsultationAction, updateConsultationAction } from "../../actions";
import { Badge, Empty, FilterTabs, PageTitle, waLink } from "@/components/admin/bits";
import { AutoSelect, NoteForm, QuickButton } from "@/components/admin/ui";

export const metadata = { title: "Консультации" };

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ status?: string; when?: string; mine?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdminUser();
  const owner = me.role === "owner";
  const when = sp.when === "past" ? "past" : "upcoming";
  const status = CONSULTATION_STATUSES.some((s) => s.value === sp.status) ? sp.status : undefined;
  const mine = sp.mine === "1";
  const { date: today } = almatyNow();
  const [items, managers] = await Promise.all([
    getConsultations({ when, today, status, manager: mine ? me.login : undefined }),
    getManagerOptions(),
  ]);

  const byDay = new Map<string, typeof items>();
  for (const c of items) byDay.set(c.date ?? "", [...(byDay.get(c.date ?? "") ?? []), c]);
  const paidSum = items.filter((c) => c.paid).reduce((s, c) => s + (c.price ?? CONSULTATION_PRICE), 0);
  const q = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const all = { when: when === "past" ? "past" : undefined, mine: mine ? "1" : undefined, status, ...patch };
    for (const [k, v] of Object.entries(all)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/admin/consultations?${s}` : "/admin/consultations";
  };

  return (
    <>
      <PageTitle title="Консультации">
        <p className="text-[14px] text-muted">
          2 000 ₸ · будни 10:00–19:00 · запись на сайте: <a href="/ru/consultation" target="_blank" className="font-medium text-brand hover:underline">alemway.kz/consultation</a>
        </p>
      </PageTitle>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {[
          { label: "Предстоящие", href: q({ when: undefined }), active: when === "upcoming" },
          { label: "Прошедшие", href: q({ when: "past" }), active: when === "past" },
        ].map((x) => (
          <Link
            key={x.label}
            href={x.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[15px] font-semibold ${x.active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {x.label}
          </Link>
        ))}
        <Link
          href={q({ mine: mine ? undefined : "1" })}
          className={`-mb-px ml-auto border-b-2 px-4 py-2.5 text-[15px] font-semibold ${mine ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
        >
          {mine ? "✓ " : ""}Только мои
        </Link>
      </nav>
      <FilterTabs base={q({ status: undefined })} current={status} items={[...CONSULTATION_STATUSES]} />

      {items.length === 0 ? (
        <Empty>{when === "upcoming" ? "Записей пока нет" : "Прошедших консультаций нет"}</Empty>
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-[16px] font-bold capitalize">
                {formatDayRu(day)} {day === today && <Badge tone="blue">сегодня</Badge>}
              </h2>
              <ul className="grid gap-3">
                {list.map((c) => {
                  const st = CONSULTATION_STATUSES.find((s) => s.value === (c.status ?? "new")) ?? CONSULTATION_STATUSES[0];
                  const wa = waLink(c.phone);
                  return (
                    <li key={c._id} className="card p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[17px] font-bold">
                            <span className="mr-2 tabular-nums text-brand">{c.time}</span>
                            {c.name}
                          </p>
                          <p className="mt-0.5 text-[14px] text-muted">
                            {c.topicTitle} · {c.phone}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={st.tone}>{st.title}</Badge>
                          {(owner || c.manager === me.login) && (
                            <AutoSelect action={updateConsultationAction} hidden={{ id: c._id }} name="status" value={c.status ?? "new"} options={CONSULTATION_STATUSES} />
                          )}
                        </div>
                      </div>
                      {c.comment && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[14px] whitespace-pre-line">{c.comment}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
                        <span className="text-muted">Принимает:</span>
                        {owner ? (
                          <AutoSelect
                            action={updateConsultationAction}
                            hidden={{ id: c._id }}
                            name="manager"
                            label="Кто принимает"
                            value={c.manager ?? ""}
                            options={[{ value: "", title: "— не назначен —" }, ...managers.map((m) => ({ value: m.login, title: m.name }))]}
                          />
                        ) : (
                          <b>{c.managerName || "не назначен"}</b>
                        )}
                        {(owner || c.manager === me.login) && (
                          <>
                        <span className="text-muted">Оплата:</span>
                        <AutoSelect
                          action={updateConsultationAction}
                          hidden={{ id: c._id }}
                          name="paid"
                          label="Оплата"
                          value={c.paid ? "yes" : "no"}
                          options={[
                            { value: "no", title: `Не оплачено (${(c.price ?? CONSULTATION_PRICE).toLocaleString("ru-RU")} ₸)` },
                            { value: "yes", title: "✅ Оплачено" },
                          ]}
                        />
                          </>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp min-h-8 px-3 text-[13px]">
                            WhatsApp
                          </a>
                        )}
                      </div>
                      {(owner || c.manager === me.login) && (
                        <div className="mt-3">
                          <NoteForm action={updateConsultationAction} id={c._id} value={c.managerNote} placeholder="Заметка: о чём говорили, что дальше…" />
                        </div>
                      )}
                      {owner && (
                        <div className="mt-2 flex justify-end">
                          <QuickButton
                            action={deleteConsultationAction}
                            hidden={{ id: c._id }}
                            confirmText={`Удалить запись «${c.name}»?`}
                            className="text-[13px] font-medium text-red-600 hover:underline"
                          >
                            Удалить
                          </QuickButton>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {paidSum > 0 && <p className="mt-6 text-[14px] text-muted">Оплачено в этом списке: <b className="text-ink">{paidSum.toLocaleString("ru-RU")} ₸</b></p>}
    </>
  );
}
