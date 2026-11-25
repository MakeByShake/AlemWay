import Link from "next/link";
import { ListLink } from "@/components/admin/ListMemory";
import type { DeanIssue } from "@/lib/cabinet/server";
import { notFound } from "next/navigation";
import {
  getCabinetFull,
  cabinetName,
  getClientOptions,
  getCompanions,
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
  addCompanionAction,
  resolveDeanIssueAction,
  addContactAction,
  removeContactAction,
  saveDeanIssueAction,
  removeCompanionAction,
  declarationAction,
  deleteCabinetAction,
  deleteClientFileAction,
  setEnrollmentAnyLangAction,
  setNoEnrollmentAction,
  updateAnketaAction,
  deletePaymentAction,
  deleteReceiptAction,
  updatePaymentAction,
  newLinkAction,
  paymentStatusAction,
  setPriceAction,
  setDeadlineAction,
  updateCabinetAction,
} from "../../../actions";
import {
  KASPI_PAY_URL,
  PAYMENT_METHODS,
  PAYMENT_STATUS_TITLES,
  formatTenge,
  paymentTotals,
  receiptsOf,
} from "@/lib/cabinet/payments";
import { AddReceiptButton, PlanEditor } from "@/components/admin/PaymentTools";
import {
  Badge,
  PageTitle,
  Progress,
  fmtDate,
  waLink, WA_TARGET,
} from "@/components/admin/bits";
import { Pipeline } from "@/components/Pipeline";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { OldClientMessage } from "@/components/admin/OldClientMessage";
import { getActivity } from "@/lib/admin/activity";
import { getEmployerOptions } from "@/lib/admin/employers";
import { setClientEmployerAction } from "../../../employer-actions";
import {
  ActionForm,
  AddPaymentForm,
  ConfirmForm,
  CopyButton,
  FileUpload,
  LinkBox,
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

function DeanForm({ id, issue, uniName }: { id: string; issue?: DeanIssue | null; uniName?: string }) {
  const open = issue && !issue.resolvedAt ? issue : null;
  return (
    <ActionForm action={saveDeanIssueAction} className="mt-3 grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1 text-[13px] font-medium">
        Университет
        <input name="uni" defaultValue={open?.uni ?? uniName ?? ""} className={input} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Факультет
        <input name="faculty" defaultValue={open?.faculty ?? ""} placeholder="Например: Информационных технологий" className={input} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Группа / курс
        <input name="group" defaultValue={open?.group ?? ""} placeholder="ИС-23-1" className={input} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Имя декана / сотрудника
        <input name="deanName" defaultValue={open?.deanName ?? ""} placeholder="Ахметов Ерлан Сапарович" className={input} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Телефон деканата / декана
        <input name="phone" defaultValue={open?.phone ?? ""} placeholder="+7 727 000 00 00" className={input} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Почему не ставят (если известно)
        <input name="reason" defaultValue={open?.reason ?? ""} placeholder="Говорят, не ставят печать на чужие бланки" className={input} />
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary min-h-9 px-4 text-[14px]" pendingText="Сохраняем…">
          Сохранить
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

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
  const [companions, clientOptions, employers] = await Promise.all([
    getCompanions(cab.party, id),
    tab === "overview" ? getClientOptions() : [],
    tab === "overview" && serviceOf(cab.service) === "ferienjob" ? getEmployerOptions() : [],
  ]);
  // «owner» here = full rights (owner or manager); «Отдел продаж» is read-only.
  const owner = isFullRole(me.role);
  // «Отдел продаж» opens only the clients they lead or sold.
  if (!owner && cab.manager !== me.login && cab.seller !== me.login) notFound();

  const service = serviceOf(cab.service);
  const keta = service === "keta";
  const name = cabinetName(cab);
  const wa = waLink(cab.clientPhone || cab.data?.phone);
  const money = paymentTotals(cab.price, cab.payments, { discount: cab.discount, plan: cab.plan, today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date()) });
  // «Напомнить об оплате»: WhatsApp with the sum, the date and the Kaspi link.
  const firstName = (cab.clientName || cab.data?.firstName || "").trim().split(/\s+/)[0];
  const reminderText = [
    `Здравствуйте${firstName ? `, ${firstName}` : ""}!`,
    `Напоминаем об оплате услуг AlemWay: ${money.next ? `${money.next.title.toLowerCase()} — ${formatTenge(money.next.left)}${money.next.dueDate ? ` до ${fmtDate(money.next.dueDate, false)}` : ""}` : `осталось ${formatTenge(money.remaining)}`}.`,
    `Оплатить можно через Kaspi: ${KASPI_PAY_URL}`,
    "После оплаты пришлите, пожалуйста, чек сюда. Спасибо!",
  ].join("\n");
  // Hand-in deadline: days left (Almaty), or done once the signed declaration is in.
  const todayKz = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
  const deadline = {
    state: !cab.deadline ? "none" : !["waiting_data", "declaration_ready"].includes(cab.status ?? "waiting_data") ? "done" : cab.deadline < todayKz ? "overdue" : "open",
    days: cab.deadline ? Math.round((Date.parse(cab.deadline) - Date.parse(todayKz)) / 86_400_000) : 0,
  };
  const reminderLink = waLink(cab.clientPhone || cab.data?.phone, reminderText);
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
      <ListLink path="/admin/clients" className="text-[14px] text-muted hover:text-brand">
        ← Все клиенты
      </ListLink>
      <PageTitle title={cab.number ? `№${cab.number} · ${name}` : name}>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/admin/cabinet/zip?id=${encodeURIComponent(id)}`}
            className="btn-ghost min-h-10 px-4 text-[14px]"
          >
            ⬇ Скачать всё (ZIP)
          </a>
          <Link prefetch={false} href={`/admin/chats?c=${encodeURIComponent(id)}`} className="btn-primary min-h-10 px-4 text-[14px]">
            💬 Чат
          </Link>
          {wa && (
            <a
              href={wa}
              target={WA_TARGET}
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
          {!keta && (
            <section className={`card mb-5 p-4 sm:p-6 ${deadline.state === "overdue" ? "border-2 border-red-300 bg-red-50" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-bold">⏰ Срок сдачи документов и декларации</h2>
                  <p className="mt-1 text-[13px] text-muted">Клиент видит таймер в кабинете. Он останавливается, когда клиент загрузит подписанную декларацию.</p>
                </div>
                {cab.deadline && (
                  <Badge tone={deadline.state === "done" ? "green" : deadline.state === "overdue" ? "red" : deadline.days <= 2 ? "amber" : "blue"}>
                    {deadline.state === "done"
                      ? "Сдано ✓"
                      : deadline.state === "overdue"
                        ? `Просрочено с ${fmtDate(cab.deadline, false)}`
                        : `до ${fmtDate(cab.deadline, false)} · ${deadline.days === 0 ? "сегодня" : `осталось ${deadline.days} дн.`}`}
                  </Badge>
                )}
              </div>
              <ActionForm action={setDeadlineAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={id} />
                <label className="grid gap-1 text-[13px] font-medium">
                  Срок (дата)
                  <input type="date" name="deadline" defaultValue={cab.deadline ?? ""} className={`${input} w-44`} />
                </label>
                <SubmitButton className="btn-primary min-h-10 px-4 text-[14px]" pendingText="Сохраняем…">
                  Поставить
                </SubmitButton>
                {[
                  ["3", "+3 дня"],
                  ["7", "+1 неделя"],
                  ["14", "+2 недели"],
                ].map(([v, l]) => (
                  <button key={v} name="days" value={v} className="btn-ghost min-h-10 px-3 text-[14px]">
                    {l}
                  </button>
                ))}
                {cab.deadline && (
                  <button name="days" value="clear" className="min-h-10 px-2 text-[14px] text-red-600 hover:underline">
                    Убрать срок
                  </button>
                )}
              </ActionForm>
            </section>
          )}

          <section className="mb-5">
            {cab.loginLink ? (
              <LinkBox
                title="🔗 Ссылка и приветствие для клиента"
                link={cab.loginLink}
                phone={cab.clientPhone || cab.data?.phone}
                name={cab.data?.firstName || cab.clientName}
                curator={cab.managerName && cab.managerName !== "AlemWay" ? cab.managerName : undefined}
                service={cab.service}
              />
            ) : (
              <p className="card p-4 text-[14px] text-muted">Ссылки ещё нет — создайте её внизу страницы: «Новая ссылка для клиента».</p>
            )}
          </section>

          <section className="card mb-5 p-4 sm:p-6">
            <h2 className="mb-3 text-[18px] font-bold">Процесс клиента</h2>
            <Pipeline service={service} status={cab.status} />
          </section>

          {cab.deanIssue && !cab.deanIssue.resolvedAt && (
            <section className="card mb-5 border-2 border-orange-400 bg-orange-50 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-bold text-orange-900">🟠 Деканат не ставит подпись и печать — клиент ждёт нашего действия</h2>
                  <p className="mt-1 text-[13px] text-muted">
                    {cab.deanIssue.addedBy ? `Добавил(а) ${cab.deanIssue.addedBy}` : "Клиент написал"} {fmtDate(cab.deanIssue.at)}
                  </p>
                </div>
                {owner && (
                  <QuickButton action={resolveDeanIssueAction} hidden={{ id }} className="btn-ghost min-h-9 bg-white px-3 text-[13px]">
                    ✓ Решено
                  </QuickButton>
                )}
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[auto_1fr]">
                <dt className="text-muted">Университет</dt>
                <dd className="font-medium">{cab.deanIssue.uni}</dd>
                <dt className="text-muted">Факультет</dt>
                <dd className="font-medium">{cab.deanIssue.faculty}</dd>
                <dt className="text-muted">Группа</dt>
                <dd className="font-medium">{cab.deanIssue.group}</dd>
                {cab.deanIssue.deanName && (
                  <>
                    <dt className="text-muted">Декан / сотрудник</dt>
                    <dd className="font-medium">{cab.deanIssue.deanName}</dd>
                  </>
                )}
                <dt className="text-muted">Номер деканата</dt>
                <dd className="font-medium">
                  {cab.deanIssue.phone ? (
                    <a href={`tel:${cab.deanIssue.phone.replace(/[^\d+]/g, "")}`} className="text-brand hover:underline">
                      {cab.deanIssue.phone}
                    </a>
                  ) : (
                    "не указан"
                  )}
                </dd>
                <dt className="text-muted">Почему</dt>
                <dd className="whitespace-pre-line font-medium">{cab.deanIssue.reason || "—"}</dd>
              </dl>
              <details className="mt-3">
                <summary className="cursor-pointer text-[14px] font-semibold text-brand">Изменить / дописать</summary>
                <DeanForm id={id} issue={cab.deanIssue} uniName={cab.data?.uniName} />
              </details>
            </section>
          )}
          {!keta && (!cab.deanIssue || cab.deanIssue.resolvedAt) && (
            <details className="card mb-5 p-4 sm:p-5">
              <summary className="cursor-pointer text-[15px] font-semibold text-brand">+ Деканат не ставит печать — добавить данные (если клиент прислал в WhatsApp)</summary>
              <DeanForm id={id} issue={null} uniName={cab.data?.uniName} />
            </details>
          )}
          {cab.deanIssue?.resolvedAt && (
            <p className="mb-5 text-[13px] text-muted">
              ✓ Вопрос с деканатом решён {fmtDate(cab.deanIssue.resolvedAt)}
              {cab.deanIssue.resolvedBy ? ` (${cab.deanIssue.resolvedBy})` : ""}: {cab.deanIssue.uni}, {cab.deanIssue.faculty}, группа {cab.deanIssue.group}.
            </p>
          )}

          <section className="card mb-5 p-4 sm:p-6">
            <h2 className="text-[18px] font-bold">📞 Контакты</h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {[{ _key: "main", label: "Клиент (основной)", phone: cab.clientPhone || cab.data?.phone || "" }, ...(cab.contacts ?? [])]
                .filter((c) => c.phone)
                .map((c) => {
                  const w = waLink(c.phone);
                  return (
                    <li key={c._key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-[13px] text-muted">{c.label}</span>
                        <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="font-semibold tabular-nums hover:text-brand">
                          {c.phone}
                        </a>
                      </span>
                      <span className="flex items-center gap-2">
                        {w && (
                          <a href={w} target={WA_TARGET} rel="noopener noreferrer" className="btn-whatsapp min-h-8 px-2.5 text-[13px]">
                            WhatsApp
                          </a>
                        )}
                        {c._key !== "main" && (
                          <QuickButton
                            action={removeContactAction}
                            hidden={{ id, key: c._key }}
                            confirmText={`Удалить контакт ${c.label}?`}
                            className="min-h-8 px-2 text-[13px] text-red-600 hover:underline"
                          >
                            Удалить
                          </QuickButton>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>
            <ActionForm action={addContactAction} resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
              <input type="hidden" name="id" value={id} />
              <label className="grid gap-1 text-[13px] font-medium">
                Кто это
                <input name="label" placeholder="Мама, папа, 2-й номер" className={input} />
              </label>
              <label className="grid gap-1 text-[13px] font-medium">
                Телефон
                <input name="phone" required placeholder="+7 777 123 45 67" className={input} />
              </label>
              <SubmitButton className="btn-ghost min-h-10 px-4 text-[14px]" pendingText="Добавляем…">
                + Добавить контакт
              </SubmitButton>
            </ActionForm>
          </section>

          <section className="card mb-5 p-4 sm:p-6">
            <h2 className="text-[18px] font-bold">👥 Едет вместе с</h2>
            <p className="mt-1 text-[13px] text-muted">Друзья, которые хотят поехать вместе — чтобы оформить и устроить их рядом.</p>
            {companions.length > 0 ? (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {companions.map((c) => (
                  <li key={c._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <Link prefetch={false} href={`/admin/clients/${c._id}`} className="min-w-0 flex-1 font-semibold hover:text-brand">
                      {c.number && <span className="mr-1.5 text-muted tabular-nums">№{c.number}</span>}
                      {cabinetName(c)}
                    </Link>
                    <Progress service={c.service} status={c.status} />
                    <Badge tone={c.managerName ? "gray" : "amber"}>👤 {c.managerName || "не назначен"}</Badge>
                    {owner && (
                      <QuickButton
                        action={removeCompanionAction}
                        hidden={{ id, other: c._id }}
                        confirmText={`Убрать «${cabinetName(c)}» из группы?`}
                        className="rounded-lg px-2 py-1 text-[13px] font-medium text-muted hover:bg-red-50 hover:text-red-600"
                      >
                        Убрать
                      </QuickButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14px] text-muted">Пока едет один.</p>
            )}
            {owner && (
              <ActionForm action={addCompanionAction} className="mt-4 flex flex-wrap gap-2" resetOnSuccess>
                <input type="hidden" name="id" value={id} />
                <input
                  name="other"
                  list="companion-options"
                  required
                  autoComplete="off"
                  placeholder="Начните вводить имя или № клиента"
                  className="field min-w-[240px] flex-1 py-2 text-[15px]"
                />
                <datalist id="companion-options">
                  {clientOptions
                    .filter((o) => o._id !== id && !(cab.party && o.party === cab.party))
                    .map((o) => (
                      <option key={o._id} value={`${o.number ? `№${o.number} ` : ""}${cabinetName(o)}`} />
                    ))}
                </datalist>
                <SubmitButton className="btn-ghost" pendingText="Добавляем…">
                  + Добавить друга
                </SubmitButton>
              </ActionForm>
            )}
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
                      <option value="baybol">🤝 Продан для Baybol — отдельно от наших</option>
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

            {!keta && owner && (
              <Section
                title={`📨 Новый бланк 06/2026 — сообщение клиенту${cab.reform ? " · анкета уже обнулена" : ""}`}
                hint="Создаст личную ссылку и готовый текст с именем, ссылкой и сроком: старым клиентам — про новый бланк и анкету заново, клиентам с сайта — обычное приветствие (там уже сказано, как загрузить декларацию с печатью)."
              >
                <OldClientMessage id={id} name={cab.data?.firstName || cab.clientName || ""} phone={cab.clientPhone || cab.data?.phone} reformed={Boolean(cab.reform)} old={(cab.group ?? "new") === "old" || Boolean(cab.reform)} curator={cab.managerName && cab.managerName !== "AlemWay" ? cab.managerName : undefined} />
              </Section>
            )}

            <Section
              title="Ссылка для входа клиента"
              hint="Клиент входит по личной ссылке без пароля. Потерял ссылку — создайте новую (старые ссылки тоже продолжат работать)."
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
              {!keta && (
                <ActionForm action={setClientEmployerAction} className="mb-4 grid gap-1" autoSave>
                  <fieldset disabled={!owner} className="contents">
                    <input type="hidden" name="id" value={id} />
                    <label className="grid gap-1 text-[14px] font-medium">
                      🏢 Закреплён за работодателем
                      <select name="employer" defaultValue={cab.employer ?? ""} className={input}>
                        <option value="">— не закреплён —</option>
                        {employers.map((e) => (
                          <option key={e._id} value={e._id}>
                            {e.name}
                            {e.city ? ` · ${e.city}` : ""}
                            {e.status === "stopped" ? " (не работаем)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="text-[13px] text-muted">
                      {cab.employer ? (
                        <Link prefetch={false} href={`/admin/employers/${cab.employer}`} className="font-semibold text-brand hover:underline">
                          Открыть карточку работодателя →
                        </Link>
                      ) : employers.length === 0 ? (
                        <>
                          Работодателей ещё нет —{" "}
                          <Link prefetch={false} href="/admin/employers" className="font-semibold text-brand hover:underline">
                            добавьте в разделе «Работодатели»
                          </Link>
                          .
                        </>
                      ) : (
                        "Название, город, должность и даты подставятся ниже сами (если пустые)."
                      )}
                    </span>
                  </fieldset>
                </ActionForm>
              )}
              <ActionForm key={cab.employer ?? "none"} action={updateCabinetAction} className="grid gap-3" autoSave>
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
                          Работодатель (видит клиент)
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
                confirmText={`Удалить клиента «${name}» полностью? Удалятся кабинет и все файлы (паспорт, декларация…), а номера клиентов после него сдвинутся на один. Это нельзя отменить.`}
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
                ? "Можно исправить любое поле — сохраняется автоматически. Исправленное командой ИИ возьмёт в декларацию как есть (важнее справки): после правки нажмите «Проверить ИИ заново» на вкладке «Файлы» — декларация обновится и у клиента."
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
                              <span>
                                {f.label.ru}
                                {cab.teamEdited?.includes(f.key) && (
                                  <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-px text-[11px] font-semibold text-brand" title="ИИ возьмёт это значение в декларацию как есть">
                                    ✎ исправлено командой
                                  </span>
                                )}
                              </span>
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
                        {kind === "enrollment" && owner && (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                            {cab.enrollmentAnyLang && <span className="font-semibold text-amber-700">✓ Принимаем на русском/казахском — английская будет позже</span>}
                            <QuickButton
                              action={setEnrollmentAnyLangAction}
                              hidden={{ id, on: cab.enrollmentAnyLang ? "no" : "yes" }}
                              className="font-semibold text-brand hover:underline"
                            >
                              {cab.enrollmentAnyLang ? "Снова требовать английскую" : "Принять справку на русском (английская позже)"}
                            </QuickButton>
                            {!f && (
                              <>
                                {cab.noEnrollment && <span className="font-semibold text-amber-700">✓ Без справки — клиент сам вписывает вуз и даты</span>}
                                <QuickButton
                                  action={setNoEnrollmentAction}
                                  hidden={{ id, on: cab.noEnrollment ? "no" : "yes" }}
                                  className="font-semibold text-brand hover:underline"
                                >
                                  {cab.noEnrollment ? "Снова требовать справку" : "Разрешить без справки"}
                                </QuickButton>
                              </>
                            )}
                          </div>
                        )}
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
              {(cab.archivedFiles?.length ?? 0) > 0 && (
                <details className="mt-3 rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-[14px] font-semibold text-muted">
                    🗄 Архив — файлы до перехода на новый бланк ({cab.archivedFiles!.length})
                  </summary>
                  <ul className="mt-2 divide-y divide-line">
                    {cab.archivedFiles!.map((f, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]">
                        <span>
                          {FILE_LABELS[f.kind as keyof typeof FILE_LABELS]?.ru ?? f.kind}
                          <span className="ml-2 text-[12.5px] text-muted">{fmtDate(f.uploadedAt, false)}</span>
                        </span>
                        <a
                          href={`/api/admin/cabinet/file?id=${encodeURIComponent(id)}&archived=${i}&view=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand hover:underline"
                        >
                          Открыть
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
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
          {/* Summary: what is due, paid, left, and what comes next. */}
          <section className="card mb-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold">Оплата</h2>
                <p className="mt-1 text-[14px] text-muted">Только для команды — клиент этого не видит.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {money.remaining > 0 && reminderLink && (
                  <a href={reminderLink} target={WA_TARGET} rel="noopener noreferrer" className="btn-whatsapp min-h-9 px-3 text-[13px]">
                    Напомнить об оплате
                  </a>
                )}
                <CopyButton text={KASPI_PAY_URL} label="Ссылка Kaspi" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-surface px-3 py-2.5">
                <p className="text-[12px] text-muted">К оплате</p>
                <p className="font-bold tabular-nums">{money.hasPrice ? formatTenge(money.price) : "—"}</p>
                {money.discount > 0 && (
                  <p className="text-[12px] text-muted">
                    <s>{formatTenge(money.fullPrice)}</s> − скидка {formatTenge(money.discount)}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                <p className="text-[12px] text-muted">Оплачено</p>
                <p className="font-bold tabular-nums">{formatTenge(money.paid)}</p>
                {money.pending !== 0 && <p className="text-[12px] text-brand">+ {formatTenge(money.pending)} на проверке</p>}
              </div>
              <div className={`rounded-xl px-3 py-2.5 ${money.overdue > 0 ? "bg-red-50" : money.remaining > 0 ? "bg-warn-soft" : "bg-surface"}`}>
                <p className="text-[12px] text-muted">{money.overpaid > 0 ? "Переплата" : "Остаток"}</p>
                <p className={`font-bold tabular-nums ${money.overdue > 0 ? "text-red-700" : ""}`}>
                  {!money.hasPrice ? "—" : formatTenge(money.overpaid > 0 ? money.overpaid : money.remaining)}
                </p>
                {money.overdue > 0 && <p className="text-[12px] font-semibold text-red-700">просрочено {formatTenge(money.overdue)}</p>}
              </div>
              <div className="rounded-xl bg-surface px-3 py-2.5">
                <p className="text-[12px] text-muted">Следующий платёж</p>
                {money.hasPrice && money.remaining === 0 ? (
                  <p className="font-bold text-[#0a7a42]">Оплачено ✅</p>
                ) : money.next ? (
                  <>
                    <p className="font-bold tabular-nums">{formatTenge(money.next.left)}</p>
                    <p className="text-[12px] text-muted">
                      {money.next.title}
                      {money.next.dueDate ? ` · до ${fmtDate(money.next.dueDate, false)}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-muted">{money.hasPrice ? "план не составлен" : "—"}</p>
                )}
              </div>
            </div>
          </section>

          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            {/* Price and discount + the plan. */}
            <section className="card p-4 sm:p-6">
              <h3 className="text-[16px] font-bold">Сумма и скидка</h3>
              <ActionForm action={setPriceAction} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={id} />
                <label className="grid gap-1 text-[13px] font-medium">
                  Цена услуги, ₸
                  <input name="price" inputMode="numeric" defaultValue={cab.price ?? ""} placeholder="750000" className={input} />
                </label>
                <label className="grid gap-1 text-[13px] font-medium">
                  Скидка (₸ или %)
                  <input name="discount" defaultValue={cab.discount ?? ""} placeholder="50000 или 10%" className={input} />
                </label>
                <label className="grid gap-1 text-[13px] font-medium sm:col-span-2">
                  За что скидка
                  <input name="discountNote" defaultValue={cab.discountNote ?? ""} placeholder="Например: пришёл с другом, студент-отличник" className={input} />
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton className="btn-ghost min-h-9 px-4 text-[14px]" pendingText="Сохраняем…">
                    Сохранить
                  </SubmitButton>
                </div>
              </ActionForm>

              <h3 className="mt-6 text-[16px] font-bold">План оплаты</h3>
              <p className="mt-1 text-[13px] text-muted">Предоплата, остаток, в долг — с датами. Оплаченное закрывает части по порядку.</p>
              {money.plan.length > 0 && (
                <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                  {money.plan.map((pl) => (
                    <li key={pl._key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block font-semibold">{pl.title}</span>
                        <span className="text-[12.5px] text-muted">
                          {formatTenge(pl.amount)}
                          {pl.dueDate ? ` · до ${fmtDate(pl.dueDate, false)}` : ""}
                          {pl.state === "partial" ? ` · внесено ${formatTenge(pl.paid)}` : ""}
                        </span>
                      </span>
                      <Badge tone={pl.state === "paid" ? "green" : pl.state === "overdue" ? "red" : pl.state === "partial" ? "blue" : "amber"}>
                        {pl.state === "paid" ? "Оплачено" : pl.state === "overdue" ? `Просрочено · ${formatTenge(pl.left)}` : pl.state === "partial" ? `Осталось ${formatTenge(pl.left)}` : "Ждём"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3" open={money.plan.length === 0}>
                <summary className="cursor-pointer text-[14px] font-semibold text-brand">{money.plan.length ? "Изменить план" : "Составить план"}</summary>
                <div className="mt-3">
                  <PlanEditor id={id} total={money.price} plan={cab.plan} />
                </div>
              </details>
            </section>

            <section className="card p-4 sm:p-6">
              <h3 className="mb-1 text-[16px] font-bold">Добавить оплату</h3>
              <p className="mb-3 text-[13px] text-muted">
                Можно сразу несколько чеков.{!owner && " Ваши платежи подтверждает менеджер."}
              </p>
              <AddPaymentForm id={id} methods={PAYMENT_METHODS} />
            </section>
          </div>

          <section className="card p-4 sm:p-6">
            <h3 className="mb-2 text-[16px] font-bold">Платежи и чеки</h3>
            {payments.length === 0 ? (
              <p className="text-[14px] text-muted">Платежей пока нет.</p>
            ) : (
              <ul className="divide-y divide-line">
                {payments.map((p) => {
                  const refund = p.kind === "refund";
                  const editable = owner || (p.by === me.login && p.status !== "confirmed");
                  const receipts = receiptsOf(p);
                  return (
                    <li key={p._key} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-[16px] font-bold tabular-nums ${refund ? "text-red-700" : ""}`}>
                          {refund ? "− " : ""}
                          {formatTenge(p.amount)}
                          {refund && <span className="ml-2 text-[13px] font-semibold">возврат клиенту</span>}
                        </p>
                        <Badge tone={p.status === "confirmed" ? "green" : p.status === "pending" ? "amber" : "red"}>{PAYMENT_STATUS_TITLES[p.status]}</Badge>
                      </div>
                      <p className="text-[13px] text-muted">
                        {[
                          fmtDate(p.paidAt, false),
                          PAYMENT_METHODS.find((m) => m.value === p.method)?.title,
                          p.payer && `платил(а): ${p.payer}`,
                          p.by === "client" ? "чек от клиента" : `добавил(а) ${p.byName ?? "менеджер"}`,
                          p.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {receipts.map((r, i) => (
                          <span key={r._key} className="inline-flex items-center overflow-hidden rounded-lg border border-line">
                            <a
                              href={`/api/admin/cabinet/receipt?id=${encodeURIComponent(id)}&key=${p._key}&r=${r._key}&view=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-[13px] font-semibold text-brand hover:bg-brand-soft"
                            >
                              🧾 Чек {receipts.length > 1 ? i + 1 : ""}
                            </a>
                            {editable && (
                              <QuickButton
                                action={deleteReceiptAction}
                                hidden={{ id, key: p._key, r: r._key ?? "main" }}
                                confirmText="Удалить этот чек?"
                                className="border-l border-line px-2 py-1 text-[13px] text-muted hover:bg-red-50 hover:text-red-600"
                              >
                                ×
                              </QuickButton>
                            )}
                          </span>
                        ))}
                        <AddReceiptButton id={id} paymentKey={p._key} />
                        {owner && p.status !== "confirmed" && (
                          <QuickButton action={paymentStatusAction} hidden={{ id, key: p._key, status: "confirmed" }} className="btn-whatsapp min-h-8 px-2.5 text-[13px]">
                            Подтвердить
                          </QuickButton>
                        )}
                        {owner && p.status === "pending" && (
                          <QuickButton action={paymentStatusAction} hidden={{ id, key: p._key, status: "rejected" }}>
                            Отклонить
                          </QuickButton>
                        )}
                        {editable && (
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
                      {editable && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[13px] font-semibold text-brand">Исправить</summary>
                          <ActionForm action={updatePaymentAction} className="mt-2 grid gap-2 rounded-xl bg-surface p-3 sm:grid-cols-3">
                            <input type="hidden" name="id" value={id} />
                            <input type="hidden" name="key" value={p._key} />
                            <label className="grid gap-1 text-[13px] font-medium">
                              Сумма, ₸
                              <input name="amount" inputMode="numeric" defaultValue={p.amount} className={input} />
                            </label>
                            <label className="grid gap-1 text-[13px] font-medium">
                              Дата
                              <input name="paidAt" type="date" defaultValue={p.paidAt ?? ""} className={input} />
                            </label>
                            <label className="grid gap-1 text-[13px] font-medium">
                              Способ
                              <select name="method" defaultValue={p.method ?? "other"} className={input}>
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m.value} value={m.value}>
                                    {m.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-1 text-[13px] font-medium">
                              Тип
                              <select name="kind" defaultValue={refund ? "refund" : "payment"} className={input}>
                                <option value="payment">Оплата</option>
                                <option value="refund">Возврат клиенту</option>
                              </select>
                            </label>
                            <label className="grid gap-1 text-[13px] font-medium">
                              Кто платил
                              <input name="payer" defaultValue={p.payer ?? ""} placeholder="сам клиент" className={input} />
                            </label>
                            <label className="grid gap-1 text-[13px] font-medium">
                              Комментарий
                              <input name="note" defaultValue={p.note ?? ""} className={input} />
                            </label>
                            <div className="sm:col-span-3">
                              <SubmitButton className="btn-primary min-h-9 px-4 text-[14px]" pendingText="Сохраняем…">
                                Сохранить
                              </SubmitButton>
                            </div>
                          </ActionForm>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
