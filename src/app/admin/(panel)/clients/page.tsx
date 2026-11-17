import Link from "next/link";
import { Suspense } from "react";
import { RememberListQuery } from "@/components/admin/ListMemory";
import { getCabinets, cabinetName, getManagerOptions } from "@/lib/admin/data";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { CABINET_STATUSES } from "@/lib/cabinet/fields";
import { Badge, Empty, RowLegend, rowTone, PageTitle, Progress, SERVICE_SHORT, fmtDate, waLink, WA_TARGET } from "@/components/admin/bits";
import { NewClientForm } from "@/components/admin/NewClientForm";

export const metadata = { title: "Клиенты" };

const SERVICE_FILTER = [
  { value: "", title: "Все услуги" },
  { value: "ferienjob", title: "🇩🇪 Германия" },
  { value: "keta", title: "🇰🇷 K-ETA" },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ service?: string; status?: string; q?: string; manager?: string; seller?: string; group?: string; dean?: string }> }) {
  const sp = await searchParams;
  const service = sp.service === "ferienjob" || sp.service === "keta" ? sp.service : "";
  const status = CABINET_STATUSES.some((s) => s.value === sp.status) ? sp.status! : "";
  const q = (sp.q ?? "").slice(0, 60);
  const [me, managers] = await Promise.all([requireAdminUser(), getManagerOptions()]);
  // «owner» here = full rights (owner or manager); «Отдел продаж» is read-only.
  const owner = isFullRole(me.role);
  // «Отдел продаж» sees only the clients they lead or sold.
  const pick = (v?: string) => (v === "-" || managers.some((m) => m.login === v) ? v! : "");
  const manager = owner ? pick(sp.manager) : "";
  const seller = owner ? pick(sp.seller) : "";
  const group = sp.group === "old" || sp.group === "new" ? sp.group : "";
  const dean = sp.dean === "1";
  const rows = await getCabinets({ service, status, q, manager, seller, group, dean, mine: owner ? undefined : me.login });
  const deanCount = rows.filter((r) => r.dean).length;
  const freeCount = owner ? rows.filter((r) => r.noManager).length : 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
  // «Едут вместе»: how many from each group are in this list.
  const partySize = new Map<string, number>();
  for (const r of rows) if (r.party) partySize.set(r.party, (partySize.get(r.party) ?? 0) + 1);
  const tabHref = (g: string) => {
    const u = new URLSearchParams();
    if (g) u.set("group", g);
    if (sp.manager) u.set("manager", sp.manager);
    if (sp.seller) u.set("seller", sp.seller);
    const qs = u.toString();
    return qs ? `/admin/clients?${qs}` : "/admin/clients";
  };

  return (
    <>
      <Suspense>
        <RememberListQuery path="/admin/clients" />
      </Suspense>
      <PageTitle title={owner ? "Клиенты (личные кабинеты)" : "Мои клиенты"} />

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Группы клиентов">
        {[
          { g: "", label: "Все" },
          { g: "new", label: "Новые — заполняют сами" },
          { g: "old", label: "Старые — данные заполняем мы" },
        ].map((x) => (
          <Link prefetch={false}
            key={x.g || "all"}
            href={tabHref(x.g)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[15px] font-semibold ${group === x.g ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      <details className="card mb-6 p-4 sm:p-5">
        <summary className="cursor-pointer text-[16px] font-bold text-brand">+ Новый клиент</summary>
        <p className="mt-2 text-[14px] text-muted">Создайте кабинет, когда клиент оплатил: сразу можно приложить договор и чеки. Клиент войдёт по ссылке без пароля.</p>
        <NewClientForm full={owner} isOwner={owner} me={me.login} members={managers} />
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
        {owner && (
        <select name="manager" defaultValue={manager || "all"} className="field w-full sm:w-auto sm:max-w-[240px]" aria-label="Кто ведёт">
          <option value="all">👤 Ведёт: все</option>
          <option value={me.login}>Веду я</option>
          {managers
            .filter((m) => m.login !== me.login)
            .map((m) => (
              <option key={m.login} value={m.login}>
                {m.name}
              </option>
            ))}
          <option value="-">Без ведущего</option>
        </select>
        )}
        {owner && (
          <select name="seller" defaultValue={seller || "all"} className="field w-full sm:w-auto sm:max-w-[240px]" aria-label="Кто продал">
            <option value="all">🤝 Продал: все</option>
            {managers.map((m) => (
              <option key={m.login} value={m.login}>
                {m.name}
              </option>
            ))}
            <option value="-">Не указано</option>
          </select>
        )}
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

      {dean ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-[14.5px]">
          <span className="font-semibold text-orange-900">🟠 Показаны только клиенты, у которых деканат не ставит печать</span>
          <Link prefetch={false} href="/admin/clients" className="font-semibold text-brand hover:underline">
            Показать всех
          </Link>
        </div>
      ) : (
        deanCount > 0 && (
          <Link
            prefetch={false}
            href="/admin/clients?dean=1"
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-[14.5px] hover:bg-orange-100"
          >
            <span className="font-semibold text-orange-900">
              🟠 Деканат не ставит печать: {deanCount} {deanCount % 10 === 1 && deanCount % 100 !== 11 ? "клиент ждёт" : "клиента ждут"} нашего действия
            </span>
            <span className="font-semibold text-brand">Показать →</span>
          </Link>
        )
      )}

      {freeCount > 0 && manager !== "-" && (
        <Link
          prefetch={false}
          href="/admin/clients?manager=-"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14.5px] hover:bg-amber-100"
        >
          <span className="font-semibold text-amber-900">
            🆕 Без ведущего: {freeCount} — отдел продаж добавил, назначьте ведущего и напишите клиенту
          </span>
          <span className="font-semibold text-brand">Показать →</span>
        </Link>
      )}

      {rows.length === 0 ? (
        <Empty>Клиентов не найдено</Empty>
      ) : (
        <>
          <RowLegend />
          <ul className="card divide-y divide-line">
          {rows.map((c) => {
            const wa = waLink(c.clientPhone);
            const tone = rowTone(c.status, c.dean);
            return (
              <li key={c._id} title={tone.title} className={`grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-center lg:gap-4 ${tone.cls}`}>
                <Link prefetch={false} href={`/admin/clients/${c._id}`} className="min-w-0 hover:text-brand">
                  <span className="block font-semibold">
                    {c.number && <span className="mr-1.5 text-muted tabular-nums">№{c.number}</span>}
                    {cabinetName(c)}
                  </span>
                  <span className="text-[13px] text-muted">
                    {SERVICE_SHORT[c.service ?? "ferienjob"]} · {c.clientPhone || "без телефона"} · создан {fmtDate(c._createdAt, false)}
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <Progress service={c.service} status={c.status} />
                  {c.deadline && ["waiting_data", "declaration_ready"].includes(c.status ?? "waiting_data") && (() => {
                    const days = Math.round((Date.parse(c.deadline) - Date.parse(today)) / 86_400_000);
                    return (
                      <Badge tone={days < 0 ? "red" : days <= 2 ? "amber" : "blue"}>
                        ⏰ {days < 0 ? `срок прошёл ${fmtDate(c.deadline, false)}` : days === 0 ? "срок сегодня" : `${days} дн. до срока`}
                      </Badge>
                    );
                  })()}
                  {c.license === "yes" && (
                    <Badge tone="green" title="Есть водительские права">
                      🚗 ВП{c.licenseCat ? ` ${c.licenseCat}` : ""}
                    </Badge>
                  )}
                  {c.license === "soon" && (
                    <Badge tone="amber" title="Права будут позже">
                      🚗 ВП позже{c.licenseReady ? ` · ${c.licenseReady}` : ""}
                    </Badge>
                  )}
                  {c.party && (partySize.get(c.party) ?? 0) > 1 && <Badge tone="blue">👥 вместе: {partySize.get(c.party)}</Badge>}
                  {c.employerName && <Badge tone="blue">🏢 {c.employerName}</Badge>}
                  {c.sellerName && <Badge tone="green">🤝 {c.sellerName}</Badge>}
                  <Badge tone={c.managerName ? "gray" : "amber"}>👤 {c.managerName || "Без ведущего"}</Badge>
                  {wa && (
                    <a href={wa} target={WA_TARGET} rel="noopener noreferrer" className="ml-auto text-[13px] font-semibold text-accent hover:underline">
                      WhatsApp
                    </a>
                  )}
                </div>
              </li>
            );
          })}
          </ul>
        </>
      )}
    </>
  );
}
