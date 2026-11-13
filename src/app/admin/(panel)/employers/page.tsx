import Link from "next/link";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { EMPLOYER_INDUSTRIES, EMPLOYER_STATUSES, HOUSING_OPTIONS, employerStatus, getEmployers, optionTitle } from "@/lib/admin/employers";
import { createEmployerAction } from "../../employer-actions";
import { Badge, Empty, PageTitle, fmtDate, waLink } from "@/components/admin/bits";
import { ActionForm, CloseDetailsButton, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Работодатели" };

export default async function EmployersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; industry?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const status = EMPLOYER_STATUSES.some((s) => s.value === sp.status) ? sp.status! : "";
  const industry = EMPLOYER_INDUSTRIES.some((s) => s.value === sp.industry) ? sp.industry! : "";
  const [me, rows] = await Promise.all([requireAdminUser(), getEmployers({ q, status, industry })]);
  const owner = isFullRole(me.role);
  const totalClients = rows.reduce((n, r) => n + r.clients, 0);
  const totalPlaces = rows.reduce((n, r) => n + (Number(r.places) || 0), 0);

  return (
    <>
      <PageTitle title="Работодатели">
        <p className="text-[14px] text-muted">
          {rows.length} работодател{rows.length % 10 === 1 && rows.length % 100 !== 11 ? "ь" : "ей"} · закреплено клиентов: {totalClients}
          {totalPlaces > 0 && ` из ${totalPlaces} мест`}
        </p>
      </PageTitle>

      {owner && (
        <details className="card mb-6 p-4 sm:p-5">
          <summary className="cursor-pointer text-[16px] font-bold text-brand">+ Новый работодатель</summary>
          <p className="mt-2 text-[14px] text-muted">Достаточно названия и города — остальное заполните в карточке.</p>
          <ActionForm action={createEmployerAction} className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-[14px] font-medium">
              Название
              <input name="name" required minLength={2} className="field" placeholder="Hotel Seeblick GmbH" />
            </label>
            <label className="grid gap-1 text-[14px] font-medium">
              Город
              <input name="city" className="field" placeholder="München" />
            </label>
            <label className="grid gap-1 text-[14px] font-medium">
              Сфера
              <select name="industry" defaultValue="" className="field">
                <option value="">—</option>
                {EMPLOYER_INDUSTRIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <SubmitButton pendingText="Создаём…">Создать</SubmitButton>
              <CloseDetailsButton />
            </div>
          </ActionForm>
        </details>
      )}

      <form className="mb-5 flex flex-wrap gap-2" action="/admin/employers">
        <input name="q" defaultValue={q} placeholder="Поиск: название, город, контакт, телефон" className="field min-w-[220px] flex-1" />
        <select name="industry" defaultValue={industry} className="field w-full sm:w-auto sm:max-w-[240px]">
          <option value="">Все сферы</option>
          {EMPLOYER_INDUSTRIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.title}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="field w-full sm:w-auto sm:max-w-[240px]">
          <option value="">Все статусы</option>
          {EMPLOYER_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.title}
            </option>
          ))}
        </select>
        <button className="btn-ghost">Найти</button>
      </form>

      {rows.length === 0 ? (
        <Empty>{q || status || industry ? "Никого не найдено" : "Работодателей пока нет — добавьте первого"}</Empty>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((e) => {
            const st = employerStatus(e.status);
            const places = Number(e.places) || 0;
            const wa = waLink(e.whatsapp || e.phone);
            return (
              <li key={e._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <Link prefetch={false} href={`/admin/employers/${e._id}`} className="min-w-0 flex-1 hover:text-brand">
                  <span className="block font-semibold">
                    {e.number && <span className="mr-1.5 text-muted tabular-nums">№{e.number}</span>}
                    {e.name || "Без названия"}
                  </span>
                  <span className="text-[13px] text-muted">
                    {[
                      optionTitle(EMPLOYER_INDUSTRIES, e.industry),
                      e.city,
                      e.wage && `${e.wage}`,
                      optionTitle(HOUSING_OPTIONS, e.housing) && `жильё: ${optionTitle(HOUSING_OPTIONS, e.housing)!.toLowerCase()}`,
                      e.workFrom && `${fmtDate(e.workFrom, false)}–${e.workTo ? fmtDate(e.workTo, false) : "…"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "нет данных"}
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={places && e.clients >= places ? "amber" : e.clients ? "blue" : "gray"}>
                    👥 {e.clients}
                    {places ? ` / ${places} мест` : " клиент."}
                  </Badge>
                  <Badge tone={st.tone}>{st.title}</Badge>
                  {e.contactName && <span className="text-[13px] text-muted">📞 {e.contactName}</span>}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-accent hover:underline">
                      WhatsApp
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
