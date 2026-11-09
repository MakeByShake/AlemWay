import Link from "next/link";
import { getCabinets, cabinetName, getManagerOptions } from "@/lib/admin/data";
import { requireAdminUser } from "@/lib/admin/session";
import { CABINET_STATUSES } from "@/lib/cabinet/fields";
import { createCabinetAction } from "../../actions";
import { Badge, Empty, PageTitle, Progress, SERVICE_SHORT, fmtDate, waLink } from "@/components/admin/bits";
import { ActionForm, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Клиенты" };

const SERVICE_FILTER = [
  { value: "", title: "Все услуги" },
  { value: "ferienjob", title: "🇩🇪 Германия" },
  { value: "keta", title: "🇰🇷 K-ETA" },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ service?: string; status?: string; q?: string; manager?: string; group?: string }> }) {
  const sp = await searchParams;
  const service = sp.service === "ferienjob" || sp.service === "keta" ? sp.service : "";
  const status = CABINET_STATUSES.some((s) => s.value === sp.status) ? sp.status! : "";
  const q = (sp.q ?? "").slice(0, 60);
  const [me, managers] = await Promise.all([requireAdminUser(), getManagerOptions()]);
  const owner = me.role === "owner";
  // Managers open «Мои клиенты» by default; "all" shows everyone.
  const managerParam = sp.manager ?? (owner ? "" : me.login);
  const manager = managerParam === "-" || managers.some((m) => m.login === managerParam) ? managerParam : "";
  const group = sp.group === "old" || sp.group === "new" ? sp.group : "";
  const rows = await getCabinets({ service, status, q, manager, group });
  const tabHref = (g: string) => {
    const u = new URLSearchParams();
    if (g) u.set("group", g);
    if (sp.manager) u.set("manager", sp.manager);
    const qs = u.toString();
    return qs ? `/admin/clients?${qs}` : "/admin/clients";
  };

  return (
    <>
      <PageTitle title="Клиенты (личные кабинеты)" />

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Группы клиентов">
        {[
          { g: "", label: "Все" },
          { g: "new", label: "Новые — заполняют сами" },
          { g: "old", label: "Старые — данные заполняем мы" },
        ].map((x) => (
          <Link
            key={x.g || "all"}
            href={tabHref(x.g)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[15px] font-semibold ${group === x.g ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      <details className="card mb-6 p-4 sm:p-5">
        <summary className="cursor-pointer text-[16px] font-bold text-brand">+ Новый клиент (без заявки с сайта)</summary>
        <p className="mt-2 text-[14px] text-muted">Создайте кабинет, когда клиент оплатил. Клиент войдёт по ссылке без пароля.</p>
        <ActionForm action={createCabinetAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" resetOnSuccess>
          <label className="grid gap-1 text-[14px] font-medium">
            Имя клиента
            <input name="clientName" required minLength={2} className="field" placeholder="Айгерим Нурланова" />
          </label>
          <label className="grid gap-1 text-[14px] font-medium">
            Телефон
            <input name="clientPhone" className="field" placeholder="+7 777 123 45 67" />
          </label>
          <label className="grid gap-1 text-[14px] font-medium">
            Услуга
            <select name="service" className="field">
              <option value="ferienjob">🇩🇪 Германия (Ferienjob)</option>
              <option value="keta">🇰🇷 K-ETA</option>
            </select>
          </label>
          {owner && (
            <label className="grid gap-1 text-[14px] font-medium sm:col-span-2">
              Менеджер
              <select name="manager" defaultValue={me.login} className="field">
                <option value="">— не назначен —</option>
                {managers.map((m) => (
                  <option key={m.login} value={m.login}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <SubmitButton pendingText="Создаём…">Создать</SubmitButton>
        </ActionForm>
      </details>

      <form className="mb-5 flex flex-wrap gap-2" action="/admin/clients">
        {group && <input type="hidden" name="group" value={group} />}
        <input name="q" defaultValue={q} placeholder="Поиск: имя, телефон или №" className="field min-w-[220px] flex-1" />
        <select name="service" defaultValue={service} className="field w-full sm:w-auto sm:max-w-[240px]">
          {SERVICE_FILTER.map((s) => (
            <option key={s.value} value={s.value}>
              {s.title}
            </option>
          ))}
        </select>
        <select name="manager" defaultValue={sp.manager === undefined && !owner ? me.login : manager || "all"} className="field w-full sm:w-auto sm:max-w-[240px]">
          <option value="all">Все менеджеры</option>
          <option value={me.login}>Мои клиенты</option>
          {managers
            .filter((m) => m.login !== me.login)
            .map((m) => (
              <option key={m.login} value={m.login}>
                {m.name}
              </option>
            ))}
          <option value="-">Без менеджера</option>
        </select>
        <select name="status" defaultValue={status} className="field w-full sm:w-auto sm:max-w-[240px]">
          <option value="">Все этапы</option>
          {CABINET_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.title}
            </option>
          ))}
        </select>
        <button className="btn-ghost">Найти</button>
      </form>

      {rows.length === 0 ? (
        <Empty>Клиентов не найдено</Empty>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((c) => {
            const wa = waLink(c.clientPhone);
            return (
              <li key={c._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <Link href={`/admin/clients/${c._id}`} className="min-w-0 flex-1 hover:text-brand">
                  <span className="block font-semibold">
                    {c.number && <span className="mr-1.5 text-muted tabular-nums">№{c.number}</span>}
                    {cabinetName(c)}
                  </span>
                  <span className="text-[13px] text-muted">
                    {SERVICE_SHORT[c.service ?? "ferienjob"]} · {c.clientPhone || "без телефона"} · создан {fmtDate(c._createdAt, false)}
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={c.managerName ? "gray" : "amber"}>👤 {c.managerName || "Без менеджера"}</Badge>
                  <Progress service={c.service} status={c.status} />
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
