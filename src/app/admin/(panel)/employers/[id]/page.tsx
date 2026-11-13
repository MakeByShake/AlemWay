import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cabinetName, getClientOptions } from "@/lib/admin/data";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import {
  EMPLOYER_INDUSTRIES,
  EMPLOYER_STATUSES,
  FOOD_OPTIONS,
  HOUSING_OPTIONS,
  employerStatus,
  getEmployer,
  getEmployerClients,
  optionTitle,
  type Employer,
} from "@/lib/admin/employers";
import {
  addEmployerClientAction,
  deleteEmployerAction,
  deleteEmployerFileAction,
  removeEmployerClientAction,
  updateEmployerAction,
} from "../../../employer-actions";
import { Badge, Empty, PageTitle, Progress, fmtDate, waLink } from "@/components/admin/bits";
import { ActionForm, ConfirmForm, QuickButton, SubmitButton } from "@/components/admin/ui";
import { EmployerFileUpload } from "@/components/admin/EmployerFileUpload";

export const metadata = { title: "Работодатель" };

const TABS = [
  { id: "overview", label: "Обзор" },
  { id: "info", label: "Вся информация" },
  { id: "files", label: "Файлы" },
] as const;

const input = "field py-2 text-[15px] font-normal text-ink";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-[18px] font-bold">{title}</h2>
      {hint && <p className="mt-1 text-[14px] text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One field of the edit form. */
function F({
  e,
  name,
  label,
  type = "text",
  rows,
  options,
  placeholder,
  wide,
}: {
  e: Employer;
  name: keyof Employer;
  label: string;
  type?: string;
  rows?: number;
  options?: readonly { value: string; title: string }[];
  placeholder?: string;
  wide?: boolean;
}) {
  const value = (e[name] as string | undefined) ?? "";
  return (
    <label className={`grid gap-1 text-[14px] font-medium ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {options ? (
        <select name={name} defaultValue={value} className={input}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.title}
            </option>
          ))}
        </select>
      ) : rows ? (
        <textarea name={name} defaultValue={value} rows={rows} placeholder={placeholder} className={`${input} resize-y`} />
      ) : (
        <input name={name} type={type} defaultValue={value} placeholder={placeholder} className={input} />
      )}
    </label>
  );
}

/** A block of fields that saves by itself. */
function EditBlock({ id, owner, title, hint, children }: { id: string; owner: boolean; title: string; hint?: string; children: ReactNode }) {
  return (
    <Section title={title} hint={hint}>
      <ActionForm action={updateEmployerAction} autoSave className="grid gap-3 sm:grid-cols-2">
        <fieldset disabled={!owner} className="contents">
          <input type="hidden" name="id" value={id} />
          {children}
        </fieldset>
      </ActionForm>
    </Section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-line font-medium">{children}</dd>
    </>
  );
}

export default async function EmployerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!/^employers\.[\w-]+$/.test(id)) notFound();
  const tabParam = (await searchParams).tab;
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam! : "overview";
  const [e, me, clients] = await Promise.all([getEmployer(id), requireAdminUser(), getEmployerClients(id)]);
  if (!e) notFound();
  const owner = isFullRole(me.role);
  // «Отдел продаж» sees only their own clients in the list.
  const visible = owner ? clients : clients.filter((c) => c.manager === me.login || c.seller === me.login);
  const clientOptions = owner && tab === "overview" ? await getClientOptions() : [];
  const st = employerStatus(e.status);
  const places = Number(e.places) || 0;
  const wa = waLink(e.whatsapp || e.phone);
  const address = [[e.street, [e.zip, e.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), e.region].filter(Boolean).join(", ");
  const files = e.files ?? [];

  return (
    <>
      <Link prefetch={false} href="/admin/employers" className="text-[14px] text-muted hover:text-brand">
        ← Все работодатели
      </Link>
      <PageTitle title={e.number ? `№${e.number} · ${e.name ?? "Без названия"}` : (e.name ?? "Без названия")}>
        <div className="flex flex-wrap items-center gap-3">
          {e.website && (
            <a href={e.website} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-10 px-4 text-[14px]">
              🌐 Сайт
            </a>
          )}
          {e.email && (
            <a href={`mailto:${e.email}`} className="btn-ghost min-h-10 px-4 text-[14px]">
              ✉️ Email
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp min-h-10 px-4 text-[14px]">
              WhatsApp
            </a>
          )}
        </div>
      </PageTitle>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3 text-[14px] text-muted">
        <Badge tone={st.tone}>{st.title}</Badge>
        {e.industry && <Badge tone="blue">{optionTitle(EMPLOYER_INDUSTRIES, e.industry)}</Badge>}
        <Badge tone={places && clients.length >= places ? "amber" : "gray"}>
          👥 {clients.length}
          {places ? ` / ${places} мест` : " клиент."}
        </Badge>
        {e.city && <span>📍 {e.city}</span>}
        <span>добавлен {fmtDate(e._createdAt, false)}</span>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Разделы работодателя">
        {TABS.map((t) => (
          <Link
            prefetch={false}
            key={t.id}
            href={t.id === "overview" ? `/admin/employers/${id}` : `/admin/employers/${id}?tab=${t.id}`}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[15px] font-semibold ${tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.id === "files" && files.length > 0 && <span className="ml-1.5 rounded-full bg-surface px-1.5 text-[12px] text-muted">{files.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-5">
          <section className="card p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[18px] font-bold">👥 Закреплённые клиенты</h2>
              {places > 0 && (
                <span className={`text-[14px] font-semibold ${clients.length >= places ? "text-warn" : "text-muted"}`}>
                  {clients.length >= places ? "Все места заняты" : `Свободно мест: ${places - clients.length}`}
                </span>
              )}
            </div>
            {visible.length > 0 ? (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {visible.map((c) => (
                  <li key={c._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <Link prefetch={false} href={`/admin/clients/${c._id}`} className="min-w-0 flex-1 hover:text-brand">
                      <span className="block font-semibold">
                        {c.number && <span className="mr-1.5 text-muted tabular-nums">№{c.number}</span>}
                        {cabinetName(c)}
                      </span>
                      {(c.workPosition || c.workFrom) && (
                        <span className="text-[13px] text-muted">
                          {[c.workPosition, c.workFrom && `${fmtDate(c.workFrom, false)}–${c.workTo ? fmtDate(c.workTo, false) : "…"}`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </Link>
                    <Progress service={c.service} status={c.status} />
                    <Badge tone={c.managerName ? "gray" : "amber"}>👤 {c.managerName || "не назначен"}</Badge>
                    {owner && (
                      <QuickButton
                        action={removeEmployerClientAction}
                        hidden={{ id, client: c._id }}
                        confirmText={`Открепить «${cabinetName(c)}» от этого работодателя?`}
                        className="rounded-lg px-2 py-1 text-[13px] font-medium text-muted hover:bg-red-50 hover:text-red-600"
                      >
                        Открепить
                      </QuickButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14px] text-muted">Пока никого не закрепили.</p>
            )}
            {owner && (
              <ActionForm action={addEmployerClientAction} className="mt-4 flex flex-wrap gap-2" resetOnSuccess>
                <input type="hidden" name="id" value={id} />
                <input
                  name="client"
                  list="employer-client-options"
                  required
                  autoComplete="off"
                  placeholder="Начните вводить имя или № клиента"
                  className="field min-w-[240px] flex-1 py-2 text-[15px]"
                />
                <datalist id="employer-client-options">
                  {clientOptions
                    .filter((o) => !clients.some((c) => c._id === o._id))
                    .map((o) => (
                      <option key={o._id} value={`${o.number ? `№${o.number} ` : ""}${cabinetName(o)}`} />
                    ))}
                </datalist>
                <SubmitButton className="btn-ghost" pendingText="Закрепляем…">
                  + Закрепить клиента
                </SubmitButton>
              </ActionForm>
            )}
            {owner && <p className="mt-2 text-[12.5px] text-muted">Клиенту подставятся название, город, должность и даты работы (если они у него ещё пустые) — он увидит их в кабинете после ZAV.</p>}
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="🏢 Коротко">
              <dl className="grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[auto_1fr]">
                <Fact label="Юр. название">{e.legalName}</Fact>
                <Fact label="Адрес">{address}</Fact>
                <Fact label="Через кого">{e.partner}</Fact>
                <Fact label="Вакансии">{e.positions}</Fact>
                <Fact label="Оплата">{e.wage}</Fact>
                <Fact label="Часы">{e.hours}</Fact>
                <Fact label="Период">{e.workFrom && `${fmtDate(e.workFrom, false)} – ${e.workTo ? fmtDate(e.workTo, false) : "…"}`}</Fact>
                <Fact label="Мест">{e.places}</Fact>
              </dl>
              {!e.legalName && !address && !e.positions && !e.wage && (
                <p className="text-[14px] text-muted">
                  Данных пока нет — заполните во вкладке{" "}
                  <Link prefetch={false} href={`/admin/employers/${id}?tab=info`} className="font-semibold text-brand hover:underline">
                    «Вся информация»
                  </Link>
                  .
                </p>
              )}
            </Section>
            <Section title="📞 Контакты">
              <dl className="grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[auto_1fr]">
                <Fact label="Контакт">{[e.contactName, e.contactRole].filter(Boolean).join(", ")}</Fact>
                <Fact label="Телефон">
                  {e.phone && (
                    <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className="text-brand hover:underline">
                      {e.phone}
                    </a>
                  )}
                </Fact>
                <Fact label="WhatsApp">{e.whatsapp}</Fact>
                <Fact label="Email">
                  {e.email && (
                    <a href={`mailto:${e.email}`} className="text-brand hover:underline">
                      {e.email}
                    </a>
                  )}
                </Fact>
                <Fact label="Сайт">
                  {e.website && (
                    <a href={e.website} target="_blank" rel="noopener noreferrer" className="break-all text-brand hover:underline">
                      {e.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </Fact>
                <Fact label="Ещё контакты">{e.contact2}</Fact>
              </dl>
              {!e.contactName && !e.phone && !e.email && <p className="text-[14px] text-muted">Контактов пока нет.</p>}
            </Section>
            <Section title="🏠 Жильё, питание, дорога">
              <dl className="grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[auto_1fr]">
                <Fact label="Жильё">{[optionTitle(HOUSING_OPTIONS, e.housing), e.housingCost].filter(Boolean).join(" — ")}</Fact>
                <Fact label="О жилье">{e.housingNote}</Fact>
                <Fact label="Питание">{optionTitle(FOOD_OPTIONS, e.food)}</Fact>
                <Fact label="Как добраться">{e.transfer}</Fact>
              </dl>
              {!e.housing && !e.food && !e.transfer && <p className="text-[14px] text-muted">Не заполнено.</p>}
            </Section>
            <Section title="📋 Требования и заметки">
              <dl className="grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[auto_1fr]">
                <Fact label="Требования">{e.requirements}</Fact>
                <Fact label="Обязанности">{e.duties}</Fact>
                <Fact label="Отзывы студентов">{e.feedback}</Fact>
                <Fact label="Заметка">{e.note}</Fact>
              </dl>
              {!e.requirements && !e.duties && !e.feedback && !e.note && <p className="text-[14px] text-muted">Не заполнено.</p>}
            </Section>
          </div>
        </div>
      )}

      {tab === "info" && (
        <div className="grid gap-5 xl:grid-cols-2">
          {!owner && <p className="rounded-xl bg-surface px-4 py-3 text-[14px] text-muted xl:col-span-2">Отдел продаж видит информацию, но не меняет её.</p>}
          <EditBlock id={id} owner={owner} title="🏢 Компания">
            <F e={e} name="name" label="Название" wide />
            <F e={e} name="legalName" label="Юридическое название (GmbH…)" wide />
            <F e={e} name="industry" label="Сфера" options={EMPLOYER_INDUSTRIES} />
            <F e={e} name="status" label="Статус" options={EMPLOYER_STATUSES} />
            <F e={e} name="partner" label="Через кого работаем (агентство / партнёр)" wide placeholder="Напрямую или название партнёра" />
          </EditBlock>
          <EditBlock id={id} owner={owner} title="📍 Адрес">
            <F e={e} name="street" label="Улица, дом" wide />
            <F e={e} name="zip" label="Индекс" />
            <F e={e} name="city" label="Город" />
            <F e={e} name="region" label="Земля / регион" placeholder="Bayern" />
            <F e={e} name="website" label="Сайт" placeholder="https://…" />
          </EditBlock>
          <EditBlock id={id} owner={owner} title="📞 Контакты">
            <F e={e} name="contactName" label="Контактное лицо" />
            <F e={e} name="contactRole" label="Должность" placeholder="HR, менеджер отеля…" />
            <F e={e} name="phone" label="Телефон" type="tel" placeholder="+49 …" />
            <F e={e} name="whatsapp" label="WhatsApp" type="tel" placeholder="+49 …" />
            <F e={e} name="email" label="Email" type="email" wide />
            <F e={e} name="contact2" label="Другие контакты" rows={2} wide placeholder="Второй контакт, Telegram, часы для звонков…" />
          </EditBlock>
          <EditBlock id={id} owner={owner} title="💼 Работа и оплата">
            <F e={e} name="positions" label="Вакансии / должности (каждая с новой строки)" rows={3} wide placeholder={"Housekeeping\nKitchen helper"} />
            <F e={e} name="duties" label="Обязанности" rows={3} wide />
            <F e={e} name="wage" label="Оплата" placeholder="13,90 €/час брутто" />
            <F e={e} name="hours" label="Часы" placeholder="40 ч/нед, 5 дней" />
            <F e={e} name="workFrom" label="Период с" type="date" />
            <F e={e} name="workTo" label="Период по" type="date" />
            <F e={e} name="places" label="Сколько мест (студентов)" type="number" />
            <F e={e} name="requirements" label="Требования" rows={3} wide placeholder="Немецкий A2, английский, возраст, пол, права…" />
          </EditBlock>
          <EditBlock id={id} owner={owner} title="🏠 Жильё, питание, дорога">
            <F e={e} name="housing" label="Жильё" options={HOUSING_OPTIONS} />
            <F e={e} name="housingCost" label="Стоимость жилья" placeholder="250 €/мес, вычитают из зарплаты" />
            <F e={e} name="housingNote" label="О жилье" rows={2} wide placeholder="Комната на 2 человек, 5 мин пешком…" />
            <F e={e} name="food" label="Питание" options={FOOD_OPTIONS} />
            <F e={e} name="transfer" label="Как добраться" rows={2} wide placeholder="Ближайший аэропорт, вокзал, встречают ли…" />
          </EditBlock>
          <EditBlock id={id} owner={owner} title="📝 Отзывы и заметки" hint="Видит только команда.">
            <F e={e} name="feedback" label="Отзывы студентов, которые там работали" rows={4} wide />
            <F e={e} name="note" label="Заметка команды" rows={4} wide />
          </EditBlock>
          {owner && (
            <div className="xl:col-span-2">
              <ConfirmForm
                action={deleteEmployerAction}
                hidden={{ id }}
                confirmText={`Удалить работодателя «${e.name ?? ""}» вместе с файлами? Клиенты останутся, только открепятся.`}
              >
                Удалить работодателя
              </ConfirmForm>
            </div>
          )}
        </div>
      )}

      {tab === "files" && (
        <Section title="📎 Документы" hint="Договор, условия, фото жилья — PDF, JPG или PNG до 4 МБ.">
          {owner && <EmployerFileUpload id={id} />}
          {files.length === 0 ? (
            <div className="mt-4">
              <Empty>Файлов пока нет</Empty>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {[...files].reverse().map((f) => {
                const url = `/api/admin/employer/file?id=${encodeURIComponent(id)}&key=${f._key}`;
                return (
                  <li key={f._key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{f.label}</span>
                      <span className="text-[13px] text-muted">
                        {f.name} · {Math.max(1, Math.round(f.size / 1024))} КБ · {fmtDate(f.uploadedAt)}
                      </span>
                    </span>
                    <a href={`${url}&view=1`} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-brand hover:underline">
                      Открыть
                    </a>
                    <a href={url} className="text-[14px] font-semibold text-brand hover:underline">
                      Скачать
                    </a>
                    {owner && (
                      <QuickButton
                        action={deleteEmployerFileAction}
                        hidden={{ id, key: f._key }}
                        confirmText={`Удалить «${f.label}»?`}
                        className="rounded-lg px-2 py-1 text-[13px] font-medium text-muted hover:bg-red-50 hover:text-red-600"
                      >
                        Удалить
                      </QuickButton>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
