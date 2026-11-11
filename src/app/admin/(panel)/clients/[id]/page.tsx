import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCabinetFull,
  cabinetName,
  getManagerOptions,
} from "@/lib/admin/data";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import {
  CABINET_STATUSES,
  PIPELINES,
  FERIENJOB_FULL_SECTIONS,
  FILE_LABELS,
  KETA_SECTIONS,
  SERVICE_FILES,
  SERVICE_TITLES,
  serviceOf,
  type CabinetField,
} from "@/lib/cabinet/fields";
import {
  declarationAction,
  deleteCabinetAction,
  deleteClientFileAction,
  updateAnketaAction,
  deletePaymentAction,
  newLinkAction,
  paymentStatusAction,
  setPriceAction,
  updateCabinetAction,
} from "../../../actions";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUS_TITLES,
  formatTenge,
  paymentTotals,
} from "@/lib/cabinet/payments";
import {
  Badge,
  PageTitle,
  Progress,
  fmtDate,
  waLink,
} from "@/components/admin/bits";
import { Pipeline } from "@/components/Pipeline";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { getActivity } from "@/lib/admin/activity";
import {
  ActionForm,
  AddPaymentForm,
  ConfirmForm,
  FileUpload,
  QuickButton,
  SubmitButton,
} from "@/components/admin/ui";

export const metadata = { title: "Клиент" };
// «Проверить ИИ заново» waits for the AI (up to a couple of minutes).
export const maxDuration = 300;

const STATUSES_FOR: Record<string, readonly string[]> = {
  ferienjob: PIPELINES.ferienjob.map((s) => s.status),
  keta: [...PIPELINES.keta.map((s) => s.status), "keta_rejected"],
};

function AnketaInput({ f, value }: { f: CabinetField; value: string }) {
  const name = `d_${f.key}`;
  const cls = "field py-2 text-[15px] font-normal text-ink";
  if (f.kind === "yesno")
    return (
      <select name={name} defaultValue={value} className={cls}>
        <option value="">—</option>
        <option value="yes">Да</option>
        <option value="no">Нет</option>
      </select>
    );
  if (f.kind === "select")
    return (
      <select name={name} defaultValue={value} className={cls}>
        <option value="">—</option>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label.ru}
          </option>
        ))}
      </select>
    );
  const type =
    f.kind === "date"
      ? "date"
      : f.kind === "email"
        ? "email"
        : f.kind === "number"
          ? "number"
          : "text";
  return (
    <input
      name={name}
      type={type}
      defaultValue={value}
      maxLength={f.maxLength ?? 200}
      placeholder={f.placeholder}
      className={cls}
    />
  );
}

function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-[18px] font-bold">{title}</h2>
      {hint && <p className="mt-1 text-[14px] text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const input = "field py-2 text-[15px]";

const PDF_FIELD_LABELS: Record<string, string> = {
  txtfDritteName: "1 Вуз",
  txtfDritteStr: "2 Улица",
  txtfDritteHausNr: "3 Дом",
  txtfDrittePlz: "4 Индекс",
  txtfDritteOrt: "5 Город",
  txtfDritteTel: "6 Телефон вуза",
  txtfDritteEmail: "7 Email вуза",
  txtfDritteWeb: "8 Сайт",
  txtfPersonVorname: "9 Имя",
  txtfPersonNachname: "10 Фамилия",
  datePersonGebDatum: "11 Дата рождения",
  txtfPersonNationalitaet: "12 Гражданство",
  txtfStudiumFach: "13 Специальность",
  txtfStudiumDauer: "14 Срок обучения",
  dateStudiumSeit: "15 Зачислен",
  dateStudiumEnde: "16 Окончание учёбы",
  dateStudiumFerienVon: "17 Каникулы с",
  dateStudiumFerienBis: "17 Каникулы по",
  rbtnStudiumFortsetzung: "18 Продолжит учёбу",
  txtfUnterschriftOrt: "19 Город подписи",
  dateUnterschriftDatum: "20 Дата",
};

const TABS = [
  { id: "overview", label: "Обзор" },
  { id: "anketa", label: "Анкета" },
  { id: "files", label: "Файлы" },
  { id: "payment", label: "Оплата" },
] as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: raw } = await params;
  const tabParam = (await searchParams).tab;
  const tab = TABS.some((x) => x.id === tabParam) ? tabParam! : "overview";
  const id = decodeURIComponent(raw);
  if (!/^cabinets\.[\w-]+$/.test(id)) notFound();
  const [cab, me, managers, history] = await Promise.all([
    getCabinetFull(id),
    requireAdminUser(),
    getManagerOptions(),
    getActivity({ cabinet: id, limit: 30 }),
  ]);
  if (!cab) notFound();
  // «owner» here = full rights (owner or manager); «Отдел продаж» is read-only.
  const owner = isFullRole(me.role);
  // «Отдел продаж» opens only the clients they lead or sold.
  if (!owner && cab.manager !== me.login && cab.seller !== me.login) notFound();

  const service = serviceOf(cab.service);
  const keta = service === "keta";
  const name = cabinetName(cab);
  const wa = waLink(cab.clientPhone || cab.data?.phone);
  const money = paymentTotals(cab.price, cab.payments);
  const fileCount = Object.values(cab.files ?? {}).filter(
    (f) => f?.path,
  ).length;
  const payments = [...(cab.payments ?? [])].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const statusOptions = STATUSES_FOR[service].map((v, i) => {
    const step = PIPELINES[service].find((s) => s.status === v);
    return {
      value: v,
      title: step
        ? `${i + 1}. ${step.title.ru}`
        : (CABINET_STATUSES.find((s) => s.value === v)?.title ?? v),
    };
  });

  return (
    <>
      <Link prefetch={false}
        href="/admin/clients"
        className="text-[14px] text-muted hover:text-brand"
      >
        ← Все клиенты
      </Link>
      <PageTitle title={cab.number ? `№${cab.number} · ${name}` : name}>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/admin/cabinet/zip?id=${encodeURIComponent(id)}`}
            className="btn-ghost min-h-10 px-4 text-[14px]"
          >
            ⬇ Скачать всё (ZIP)
          </a>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp min-h-10 px-4 text-[14px]"
            >
              WhatsApp
            </a>
          )}
        </div>
      </PageTitle>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3 text-[14px] text-muted">
        <Badge tone="blue">{SERVICE_TITLES[service].ru}</Badge>
        <Progress service={service} status={cab.status} />
        <Badge tone={cab.sellerName ? "green" : "gray"}>
          🤝 Продал: {cab.sellerName || "не указано"}
        </Badge>
        <Badge tone={cab.managerName ? "gray" : "amber"}>
          👤 Ведёт: {cab.managerName || "не назначен"}
        </Badge>
        <span>создан {fmtDate(cab._createdAt)}</span>
      </div>

      <nav
        className="mb-5 flex gap-1 overflow-x-auto border-b border-line"
        aria-label="Разделы клиента"
      >
        {TABS.map((tb) => (
          <Link prefetch={false}
            key={tb.id}
            href={
              tb.id === "overview"
                ? `/admin/clients/${id}`
                : `/admin/clients/${id}?tab=${tb.id}`
            }
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[15px] font-semibold ${tab === tb.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {tb.label}
            {tb.id === "files" && fileCount > 0 && (
              <span className="ml-1.5 rounded-full bg-surface px-1.5 text-[12px] text-muted">
                {fileCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <section className="card mb-5 p-4 sm:p-6">
            <h2 className="mb-3 text-[18px] font-bold">Процесс клиента</h2>
            <Pipeline service={service} status={cab.status} />
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Этап и контакты">
              <ActionForm action={updateCabinetAction} className="grid gap-3" autoSave>
                <fieldset disabled={!owner} className="contents">
                  <input type="hidden" name="id" value={id} />
                  <label className="grid gap-1 text-[14px] font-medium">
                    Этап
                    <select
                      name="status"
                      defaultValue={cab.status ?? "waiting_data"}
                      className={input}
                    >
                      {statusOptions.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[14px] font-medium">
                    Группа
                    <select
                      name="group"
                      defaultValue={cab.group ?? "new"}
                      className={input}
                    >
                      <option value="new">Новый — заполняет анкету сам</option>
                      <option value="old">Старый — данные заполняем мы</option>
                    </select>
                  </label>
                  {owner ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-[14px] font-medium">
                      🤝 Кто продал
                      <select name="seller" defaultValue={cab.seller ?? ""} className={input}>
                        <option value="">— не указано —</option>
                        {managers.map((m) => (
                          <option key={m.login} value={m.login}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-[14px] font-medium">
                      👤 Кто ведёт документы
                      <select
                        name="manager"
                        defaultValue={cab.manager ?? ""}
                        className={input}
                      >
                        <option value="">— не назначен —</option>
                        {managers.map((m) => (
                          <option key={m.login} value={m.login}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    </div>
                  ) : (
                    <p className="text-[14px]">
                      🤝 Продал: <b>{cab.sellerName || "не указано"}</b> · 👤 Ведёт:{" "}
                      <b>{cab.managerName || "не назначен"}</b>
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-[14px] font-medium">
                      Имя (для нас)
                      <input
                        name="clientName"
                        defaultValue={cab.clientName}
                        className={input}
                      />
                    </label>
                    <label className="grid gap-1 text-[14px] font-medium">
                      Телефон
                      <input
                        name="clientPhone"
                        defaultValue={cab.clientPhone}
                        className={input}
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-[14px] font-medium">
                    Заметка менеджера (клиент не видит)
                    <textarea
                      name="managerNote"
                      defaultValue={cab.managerNote}
                      rows={3}
                      className={input}
                    />
                  </label>
                </fieldset>
              </ActionForm>
            </Section>

            <Section
              title="Ссылка для входа клиента"
              hint="Клиент входит по личной ссылке без пароля. Потерял ссылку — создайте новую (старая перестанет работать)."
            >
              <p className="mb-3 text-[14px]">
                Последняя ссылка создана: {fmtDate(cab.linkCreatedAt)}
              </p>
              <ActionForm
                action={newLinkAction}
                phone={cab.clientPhone || cab.data?.phone}
              >
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="btn-ghost" pendingText="Создаём…">
                  Новая ссылка для клиента
                </SubmitButton>
              </ActionForm>
            </Section>

            <Section
              title={
                keta
                  ? "K-ETA — что видит клиент"
                  : "Работа в Германии (необязательно)"
              }
              hint={
                keta
                  ? "Дата действия и сообщение показываются в кабинете клиента."
                  : "Если заполните — клиент увидит это в кабинете после загрузки ZAV."
              }
            >
              <ActionForm action={updateCabinetAction} className="grid gap-3" autoSave>
                <fieldset disabled={!owner} className="contents">
                  <input type="hidden" name="id" value={id} />
                  {keta ? (
                    <label className="grid gap-1 text-[14px] font-medium">
                      K-ETA действует до
                      <input
                        type="date"
                        name="ketaValidUntil"
                        defaultValue={cab.ketaValidUntil}
                        className={input}
                      />
                    </label>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-[14px] font-medium">
                          Работодатель
                          <input
                            name="employerName"
                            defaultValue={cab.employerName}
                            className={input}
                          />
                        </label>
                        <label className="grid gap-1 text-[14px] font-medium">
                          Город
                          <input
                            name="workCity"
                            defaultValue={cab.workCity}
                            className={input}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1 text-[14px] font-medium">
                        Работа / должность
                        <input
                          name="workPosition"
                          defaultValue={cab.workPosition}
                          className={input}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-[14px] font-medium">
                          С
                          <input
                            type="date"
                            name="workFrom"
                            defaultValue={cab.workFrom}
                            className={input}
                          />
                        </label>
                        <label className="grid gap-1 text-[14px] font-medium">
                          По
                          <input
                            type="date"
                            name="workTo"
                            defaultValue={cab.workTo}
                            className={input}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  <label className="grid gap-1 text-[14px] font-medium">
                    Сообщение клиенту
                    <textarea
                      name="clientMessage"
                      defaultValue={cab.clientMessage}
                      rows={3}
                      className={input}
                    />
                  </label>
                </fieldset>
              </ActionForm>
            </Section>
          </div>
          <section className="card mt-5 p-4 sm:p-6">
            <h2 className="mb-1 text-[18px] font-bold">История действий</h2>
            <p className="mb-4 text-[13px] text-muted">Кто из команды и что делал с этим клиентом.</p>
            <ActivityFeed items={history} names={Object.fromEntries(managers.map((m) => [m.login, m.name]))} showClient={false} />
          </section>
          {owner && (
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
          )}
        </>
      )}

      {tab === "anketa" && (
        <>
          <section className="card p-4 sm:p-6">
            <h2 className="text-[18px] font-bold">Анкета клиента</h2>
            <p className="mt-1 text-[14px] text-muted">
              {cab.submittedAt
                ? `Отправлена ${fmtDate(cab.submittedAt)}`
                : "Клиент ещё не отправил анкету"}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {owner
                ? "Можно исправить любое поле — сохраняется автоматически. Клиент увидит исправленные данные у себя."
                : "Только просмотр: отдел продаж не меняет анкету."}
            </p>
            <ActionForm action={updateAnketaAction} className="mt-4" autoSave>
              <input type="hidden" name="id" value={id} />
              <fieldset disabled={!owner} className="contents">
                <div className="grid gap-6 lg:grid-cols-2">
                  {(keta ? KETA_SECTIONS : FERIENJOB_FULL_SECTIONS).map(
                    (sec) => {
                      const inputs = (
                        <div className="grid gap-2.5">
                          {sec.fields.map((f) => (
                            <label
                              key={f.key}
                              className="grid gap-1 text-[13px] font-medium text-muted"
                            >
                              {f.label.ru}
                              <AnketaInput
                                f={f}
                                value={cab.data?.[f.key] ?? ""}
                              />
                            </label>
                          ))}
                        </div>
                      );
                      // University address, phone, email, site: needed only for the declaration form (fields 1–8);
                      // the AI fills them from the certificate and its list of universities.
                      if (sec.id === "university")
                        return (
                          <details
                            key={sec.id}
                            className="rounded-xl border border-line p-3"
                          >
                            <summary className="cursor-pointer text-[15px] font-bold text-brand">
                              Данные вуза для декларации
                              <span className="ml-1 font-normal text-muted">
                                — заполняются автоматически
                              </span>
                            </summary>
                            <div className="mt-3">{inputs}</div>
                          </details>
                        );
                      return (
                        <fieldset key={sec.id}>
                          <legend className="mb-2 text-[15px] font-bold text-brand">
                            {sec.title.ru}
                          </legend>
                          {inputs}
                        </fieldset>
                      );
                    },
                  )}
                </div>
              </fieldset>
            </ActionForm>
          </section>
        </>
      )}

      {tab === "files" && (
        <>
          <div className="grid gap-5">
            <Section
              title="Файлы"
              hint="Скачать, загрузить или заменить файл (PDF, JPG, PNG до 4 МБ)."
            >
              <ul className="divide-y divide-line">
                {SERVICE_FILES[service].all.map((kind) => {
                  const f = cab.files?.[kind];
                  return (
                    <li
                      key={kind}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold">
                          {FILE_LABELS[kind].ru}
                        </p>
                        <p className="text-[13px] text-muted">
                          {f
                            ? `${f.name} · ${fmtDate(f.uploadedAt)}`
                            : "Не загружено"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {f && (
                          <>
                            <a
                              href={`/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${kind}&view=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary min-h-9 px-3 text-[13px]"
                            >
                              Открыть
                            </a>
                            <a
                              href={`/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${kind}`}
                              className="btn-ghost min-h-9 px-3 text-[13px]"
                            >
                              Скачать
                            </a>
                          </>
                        )}
                        {(owner || kind === "contract") && (
                          <FileUpload
                            id={id}
                            kind={kind}
                            label={f ? "Заменить" : "Загрузить"}
                          />
                        )}
                        {f && owner && (
                          <QuickButton
                            action={deleteClientFileAction}
                            hidden={{ id, kind }}
                            confirmText={`Удалить файл «${FILE_LABELS[kind].ru}»? Это нельзя отменить.`}
                            className="min-h-9 px-2 text-[13px] font-medium text-red-600 hover:underline"
                          >
                            Удалить
                          </QuickButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!keta && owner && (
                <div className="mt-3 border-t border-line pt-3">
                  <ActionForm action={declarationAction}>
                    <input type="hidden" name="id" value={id} />
                    <SubmitButton
                      className="btn-ghost min-h-9 px-3 text-[13px]"
                      pendingText="ИИ проверяет документы… до 2 минут"
                    >
                      🤖 Проверить ИИ заново и сделать декларацию
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
            </Section>
          </div>
          {!keta && cab.aiCheck && (
            <section className="card mt-5 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[18px] font-bold">
                  🤖 Проверка документов ИИ
                </h2>
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  {fmtDate(cab.aiCheck.checkedAt)}
                  <Badge
                    tone={
                      cab.aiCheck.status === "ГОТОВО"
                        ? "green"
                        : cab.aiCheck.status === "НЕ ГОТОВО"
                          ? "red"
                          : "amber"
                    }
                  >
                    {cab.aiCheck.status}
                  </Badge>
                </span>
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 text-[14px]">
                  {cab.aiCheck.missing.length > 0 && (
                    <div>
                      <p className="font-bold text-warn">
                        Чего не хватает (видит клиент)
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {cab.aiCheck.missing.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cab.aiCheck.checks.length > 0 && (
                    <div>
                      <p className="font-bold">Проверить / ошибки</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {cab.aiCheck.checks.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cab.aiCheck.clientMessage && (
                    <div>
                      <p className="font-bold">Сообщение клиенту</p>
                      <p className="mt-1 rounded-lg bg-surface px-3 py-2 whitespace-pre-line">
                        {cab.aiCheck.clientMessage}
                      </p>
                    </div>
                  )}
                </div>
                <dl className="divide-y divide-line text-[13.5px]">
                  {Object.entries(cab.aiCheck.fields)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 py-1.5"
                      >
                        <dt className="text-muted">
                          {PDF_FIELD_LABELS[k] ?? k}
                        </dt>
                        <dd className="font-medium break-words">{v}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </section>
          )}
        </>
      )}

      {tab === "payment" && (
        <>
          <section className="card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-bold">Оплата</h2>
                <p className="mt-1 text-[14px] text-muted">
                  Только для учёта внутри команды — клиент оплату не видит.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface px-3 py-2">
                  <p className="text-[12px] text-muted">К оплате</p>
                  <p className="font-bold tabular-nums">
                    {money.hasPrice ? formatTenge(money.price) : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2">
                  <p className="text-[12px] text-muted">Оплачено</p>
                  <p className="font-bold tabular-nums">
                    {formatTenge(money.paid)}
                  </p>
                </div>
                <div
                  className={`rounded-xl px-3 py-2 ${money.remaining > 0 ? "bg-warn-soft" : "bg-surface"}`}
                >
                  <p className="text-[12px] text-muted">Остаток</p>
                  <p className="font-bold tabular-nums">
                    {money.hasPrice ? formatTenge(money.remaining) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {owner && (
              <ActionForm
                action={setPriceAction}
                className="mt-4 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={id} />
                <label className="grid gap-1 text-[14px] font-medium">
                  Сумма к оплате за услугу, ₸
                  <input
                    name="price"
                    inputMode="numeric"
                    defaultValue={cab.price ?? ""}
                    placeholder="например 250000"
                    className={`${input} w-56`}
                  />
                </label>
                <SubmitButton
                  className="btn-ghost min-h-10 px-4 text-[14px]"
                  pendingText="Сохраняем…"
                >
                  Сохранить сумму
                </SubmitButton>
              </ActionForm>
            )}

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[15px] font-bold">Платежи и чеки</h3>
                {payments.length === 0 ? (
                  <p className="text-[14px] text-muted">Платежей пока нет.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {payments.map((p) => (
                      <li key={p._key} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold tabular-nums">
                            {formatTenge(p.amount)}
                          </p>
                          <Badge
                            tone={
                              p.status === "confirmed"
                                ? "green"
                                : p.status === "pending"
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {PAYMENT_STATUS_TITLES[p.status]}
                          </Badge>
                        </div>
                        <p className="text-[13px] text-muted">
                          {fmtDate(p.paidAt, false)} ·{" "}
                          {PAYMENT_METHODS.find((m) => m.value === p.method)
                            ?.title ?? "—"}{" "}
                          ·{" "}
                          {p.by === "client"
                            ? "чек от клиента"
                            : `добавил ${p.byName ?? "менеджер"}`}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {p.receipt && (
                            <a
                              href={`/api/admin/cabinet/receipt?id=${encodeURIComponent(id)}&key=${p._key}&view=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary min-h-8 px-2.5 text-[13px]"
                            >
                              Открыть чек
                            </a>
                          )}
                          {owner && p.status !== "confirmed" && (
                            <QuickButton
                              action={paymentStatusAction}
                              hidden={{ id, key: p._key, status: "confirmed" }}
                              className="btn-whatsapp min-h-8 px-2.5 text-[13px]"
                            >
                              Подтвердить
                            </QuickButton>
                          )}
                          {owner && p.status === "pending" && (
                            <QuickButton
                              action={paymentStatusAction}
                              hidden={{ id, key: p._key, status: "rejected" }}
                            >
                              Отклонить
                            </QuickButton>
                          )}
                          {owner && (
                            <QuickButton
                              action={deletePaymentAction}
                              hidden={{ id, key: p._key }}
                              confirmText={`Удалить платёж ${formatTenge(p.amount)}?`}
                              className="min-h-8 px-2 text-[13px] text-red-600 hover:underline"
                            >
                              Удалить
                            </QuickButton>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-[15px] font-bold">
                  Добавить оплату вручную
                </h3>
                <AddPaymentForm id={id} methods={PAYMENT_METHODS} />
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
