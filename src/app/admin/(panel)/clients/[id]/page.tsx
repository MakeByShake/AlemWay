import Link from "next/link";
import { notFound } from "next/navigation";
import { getCabinetFull, cabinetName } from "@/lib/admin/data";
import { CABINET_STATUSES, FILE_LABELS, SERVICE_FILES, SERVICE_TITLES, sectionsFor, serviceOf, type CabinetField } from "@/lib/cabinet/fields";
import { declarationAction, deleteCabinetAction, newLinkAction, updateCabinetAction } from "../../../actions";
import { Badge, PageTitle, Progress, fmtDate, waLink } from "@/components/admin/bits";
import { ActionForm, ConfirmForm, FileUpload, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Клиент" };

const STATUSES_FOR = {
  ferienjob: ["waiting_data", "declaration_ready", "signed_uploaded", "zav_received", "done"],
  keta: ["waiting_data", "keta_applying", "keta_applied", "keta_approved", "keta_rejected", "done"],
} as const;

function showValue(f: CabinetField, v: string | undefined) {
  if (!v) return <span className="text-muted">—</span>;
  if (f.kind === "yesno") return v === "yes" ? "Да" : v === "no" ? "Нет" : v;
  if (f.kind === "select") return f.options?.find((o) => o.value === v)?.label.ru ?? v;
  if (f.kind === "date") return fmtDate(v, false);
  return v;
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-[18px] font-bold">{title}</h2>
      {hint && <p className="mt-1 text-[14px] text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const input = "field py-2 text-[15px]";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  if (!/^cabinets\.[\w-]+$/.test(id)) notFound();
  const cab = await getCabinetFull(id);
  if (!cab) notFound();

  const service = serviceOf(cab.service);
  const keta = service === "keta";
  const name = cabinetName(cab);
  const wa = waLink(cab.clientPhone || cab.data?.phone);
  const statusOptions = CABINET_STATUSES.filter((s) => (STATUSES_FOR[service] as readonly string[]).includes(s.value));

  return (
    <>
      <Link href="/admin/clients" className="text-[14px] text-muted hover:text-brand">
        ← Все клиенты
      </Link>
      <PageTitle title={name}>
        <div className="flex items-center gap-3">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp min-h-10 px-4 text-[14px]">
              WhatsApp
            </a>
          )}
        </div>
      </PageTitle>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3 text-[14px] text-muted">
        <Badge tone="blue">{SERVICE_TITLES[service].ru}</Badge>
        <Progress service={service} status={cab.status} />
        <span>создан {fmtDate(cab._createdAt)}</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Этап и контакты">
          <ActionForm action={updateCabinetAction} className="grid gap-3">
            <input type="hidden" name="id" value={id} />
            <label className="grid gap-1 text-[14px] font-medium">
              Этап
              <select name="status" defaultValue={cab.status ?? "waiting_data"} className={input}>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-[14px] font-medium">
                Имя (для нас)
                <input name="clientName" defaultValue={cab.clientName} className={input} />
              </label>
              <label className="grid gap-1 text-[14px] font-medium">
                Телефон
                <input name="clientPhone" defaultValue={cab.clientPhone} className={input} />
              </label>
            </div>
            <label className="grid gap-1 text-[14px] font-medium">
              Заметка менеджера (клиент не видит)
              <textarea name="managerNote" defaultValue={cab.managerNote} rows={3} className={input} />
            </label>
            <div>
              <SubmitButton pendingText="Сохраняем…">Сохранить</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Ссылка для входа клиента" hint="Клиент входит по личной ссылке без пароля. Потерял ссылку — создайте новую (старая перестанет работать).">
          <p className="mb-3 text-[14px]">Последняя ссылка создана: {fmtDate(cab.linkCreatedAt)}</p>
          <ActionForm action={newLinkAction} phone={cab.clientPhone || cab.data?.phone}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className="btn-ghost" pendingText="Создаём…">
              Новая ссылка для клиента
            </SubmitButton>
          </ActionForm>
        </Section>

        <Section title="Файлы" hint="Скачать, загрузить или заменить файл (PDF, JPG, PNG до 4 МБ).">
          <ul className="divide-y divide-line">
            {SERVICE_FILES[service].all.map((kind) => {
              const f = cab.files?.[kind];
              return (
                <li key={kind} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{FILE_LABELS[kind].ru}</p>
                    <p className="text-[13px] text-muted">{f ? `${f.name} · ${fmtDate(f.uploadedAt)}` : "Не загружено"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {f && (
                      <a href={`/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${kind}`} className="btn-primary min-h-9 px-3 text-[13px]">
                        Скачать
                      </a>
                    )}
                    <FileUpload id={id} kind={kind} label={f ? "Заменить" : "Загрузить"} />
                  </div>
                </li>
              );
            })}
          </ul>
          {!keta && (
            <div className="mt-3 border-t border-line pt-3">
              <ActionForm action={declarationAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="btn-ghost min-h-9 px-3 text-[13px]" pendingText="Создаём…">
                  Создать декларацию заново из анкеты
                </SubmitButton>
              </ActionForm>
            </div>
          )}
        </Section>

        <Section
          title={keta ? "K-ETA — что видит клиент" : "Работа в Германии (необязательно)"}
          hint={keta ? "Дата действия и сообщение показываются в кабинете клиента." : "Если заполните — клиент увидит это в кабинете после загрузки ZAV."}
        >
          <ActionForm action={updateCabinetAction} className="grid gap-3">
            <input type="hidden" name="id" value={id} />
            {keta ? (
              <label className="grid gap-1 text-[14px] font-medium">
                K-ETA действует до
                <input type="date" name="ketaValidUntil" defaultValue={cab.ketaValidUntil} className={input} />
              </label>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-[14px] font-medium">
                    Работодатель
                    <input name="employerName" defaultValue={cab.employerName} className={input} />
                  </label>
                  <label className="grid gap-1 text-[14px] font-medium">
                    Город
                    <input name="workCity" defaultValue={cab.workCity} className={input} />
                  </label>
                </div>
                <label className="grid gap-1 text-[14px] font-medium">
                  Работа / должность
                  <input name="workPosition" defaultValue={cab.workPosition} className={input} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-[14px] font-medium">
                    С
                    <input type="date" name="workFrom" defaultValue={cab.workFrom} className={input} />
                  </label>
                  <label className="grid gap-1 text-[14px] font-medium">
                    По
                    <input type="date" name="workTo" defaultValue={cab.workTo} className={input} />
                  </label>
                </div>
              </>
            )}
            <label className="grid gap-1 text-[14px] font-medium">
              Сообщение клиенту
              <textarea name="clientMessage" defaultValue={cab.clientMessage} rows={3} className={input} />
            </label>
            <div>
              <SubmitButton pendingText="Сохраняем…">Сохранить</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>

      <section className="card mt-5 p-4 sm:p-6">
        <h2 className="text-[18px] font-bold">Анкета клиента</h2>
        <p className="mt-1 text-[14px] text-muted">{cab.submittedAt ? `Отправлена ${fmtDate(cab.submittedAt)}` : "Клиент ещё не отправил анкету"}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {sectionsFor(service).map((sec) => (
            <div key={sec.id}>
              <h3 className="mb-2 text-[15px] font-bold text-brand">{sec.title.ru}</h3>
              <dl className="divide-y divide-line text-[14px]">
                {sec.fields.map((f) => (
                  <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 py-1.5">
                    <dt className="text-muted">{f.label.ru}</dt>
                    <dd className="font-medium break-words">{showValue(f, cab.data?.[f.key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex justify-end">
        <ConfirmForm
          action={deleteCabinetAction}
          hidden={{ id }}
          confirmText={`Удалить клиента «${name}» полностью? Удалятся кабинет и все файлы (паспорт, декларация…). Это нельзя отменить.`}
          className="rounded-lg border border-red-200 px-4 py-2 text-[14px] font-semibold text-red-600 hover:bg-red-50"
        >
          Удалить клиента полностью
        </ConfirmForm>
      </div>
    </>
  );
}
