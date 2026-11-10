import Link from "next/link";
import { getLeads, getManagerOptions, LEAD_STATUSES } from "@/lib/admin/data";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { createCabinetAction, deleteLeadAction, updateLeadAction } from "../../actions";
import { Badge, Empty, FilterTabs, PageTitle, fmtDate, waLink } from "@/components/admin/bits";
import { ActionForm, AutoSelect, ConfirmForm, NoteForm, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Заявки" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = LEAD_STATUSES.some((s) => s.value === status) ? status : undefined;
  const [leads, me, managers] = await Promise.all([getLeads(valid), requireAdminUser(), getManagerOptions()]);
  // «owner» here = full rights (owner or manager); «Отдел продаж» is read-only.
  const owner = isFullRole(me.role);

  return (
    <>
      <PageTitle title="Заявки с сайта" />
      <FilterTabs base="/admin/leads" current={valid} items={[...LEAD_STATUSES]} />
      {leads.length === 0 ? (
        <Empty>Заявок нет</Empty>
      ) : (
        <ul className="grid gap-3">
          {leads.map((l) => {
            const wa = waLink(l.phone);
            return (
              <li key={l._id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold">{l.name || "Без имени"}</p>
                    <p className="mt-0.5 text-[14px] text-muted">
                      {l.serviceTitle || "Услуга не выбрана"} · {fmtDate(l.createdAt)}
                      {l.locale === "kk" ? " · қазақша" : ""}
                    </p>
                  </div>
                  {owner ? (
                    <AutoSelect action={updateLeadAction} hidden={{ id: l._id }} name="status" value={l.status ?? "new"} options={LEAD_STATUSES} />
                  ) : (
                    <Badge tone={(LEAD_STATUSES.find((x) => x.value === (l.status ?? "new")) ?? LEAD_STATUSES[0]).tone}>
                      {(LEAD_STATUSES.find((x) => x.value === (l.status ?? "new")) ?? LEAD_STATUSES[0]).title}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {l.phone && (
                    <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-ink hover:text-brand">
                      {l.phone}
                    </a>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp min-h-8 px-3 text-[13px]">
                      WhatsApp
                    </a>
                  )}
                </div>
                {l.comment && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[14px] whitespace-pre-line">{l.comment}</p>}
                {owner && (
                  <>
                <div className="mt-3">
                  <NoteForm action={updateLeadAction} id={l._id} value={l.managerNote} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  {l.cabinetId ? (
                    <Link href={`/admin/clients/${l.cabinetId}`} className="text-[14px] font-semibold text-brand hover:underline">
                      Открыть кабинет клиента →
                    </Link>
                  ) : (
                    <ActionForm action={createCabinetAction} phone={l.phone} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="leadId" value={l._id} />
                      <input type="hidden" name="clientName" value={l.name ?? ""} />
                      <input type="hidden" name="clientPhone" value={l.phone ?? ""} />
                      {owner && (
                        <select name="manager" defaultValue={me.login} aria-label="Менеджер" className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px]">
                          <option value="">Менеджер: не назначен</option>
                          {managers.map((m) => (
                            <option key={m.login} value={m.login}>
                              Менеджер: {m.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <SubmitButton className="btn-primary min-h-9 px-3 text-[13px]" pendingText="Создаём…">
                        Клиент оплатил → создать кабинет
                      </SubmitButton>
                    </ActionForm>
                  )}
                  <ConfirmForm action={deleteLeadAction} hidden={{ id: l._id }} confirmText={`Удалить заявку «${l.name ?? ""}»? Это нельзя отменить.`}>
                    Удалить
                  </ConfirmForm>
                </div>
                  </>
                )}
                {!owner && l.managerNote && <p className="mt-3 text-[14px] text-muted">Заметка: {l.managerNote}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
