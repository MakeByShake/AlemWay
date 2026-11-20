import { type NextRequest } from "next/server";
import { ROLE_TITLES, requireAdminUser } from "@/lib/admin/session";
import { getActivity, getTeamStatsData, teamStats } from "@/lib/admin/activity";
import { cabinetName, getFinanceRows } from "@/lib/admin/data";
import { PAYMENT_METHODS, PAYMENT_STATUS_TITLES, paymentTotals } from "@/lib/cabinet/payments";
import { CABINET_STATUSES } from "@/lib/cabinet/fields";
import { almatyNow } from "@/lib/consultation";
import { PERIODS, dayBounds, periodBounds, toDay, toPeriod } from "@/lib/admin/periods";
import { buildXlsx, xlsxResponse, type Cell, type Sheet } from "@/lib/admin/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE: Record<string, string> = { ferienjob: "Германия (Ferienjob)", keta: "K-ETA" };
const STATUS = Object.fromEntries(CABINET_STATUSES.map((s) => [s.value, s.title]));
const METHOD = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.title]));

/** ISO time → «20.11.2026 14:05» in Almaty; plain date → «20.11.2026». */
function fmt(v?: string) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join(".");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(",", "");
}

/** Excel download of «Активность» (period from ?period=) or «Финансы». */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const today = almatyNow().date;

  if (kind === "finance") {
    await requireAdminUser({ owner: true });
    const rows = (await getFinanceRows()).map((r) => ({ ...r, money: paymentTotals(r.price, r.payments, { discount: r.discount, plan: r.plan, today }) }));
    const name = (r: (typeof rows)[number]) => cabinetName(r);

    const clients: Cell[][] = [
      ["№", "Клиент", "Телефон", "Услуга", "Этап", "Менеджер", "Сумма договора", "Скидка", "Оплачено", "Чеки на проверке", "Остаток", "Просрочено", "Следующий платёж до"],
      ...rows.map((r) => [
        r.number ?? "",
        name(r),
        r.clientPhone ?? "",
        SERVICE[r.service ?? "ferienjob"] ?? r.service ?? "",
        STATUS[r.status ?? ""] ?? r.status ?? "",
        r.managerName ?? "",
        r.money.hasPrice ? r.money.price : "",
        r.money.discount || "",
        r.money.paid,
        r.money.pending || "",
        r.money.hasPrice ? r.money.remaining : "",
        r.money.overdue || "",
        fmt(r.money.next?.dueDate),
      ]),
    ];

    const payments: Cell[][] = [
      ["Дата оплаты", "№", "Клиент", "Менеджер", "Сумма", "Тип", "Способ", "Статус", "Кто платил", "Комментарий", "Добавлен"],
      ...rows
        .flatMap((r) => (r.payments ?? []).map((p) => ({ p, r })))
        .sort((a, b) => (b.p.paidAt ?? b.p.createdAt).localeCompare(a.p.paidAt ?? a.p.createdAt))
        .map(({ p, r }) => [
          fmt(p.paidAt ?? p.createdAt),
          r.number ?? "",
          name(r),
          r.managerName ?? "",
          (p.kind === "refund" ? -1 : 1) * (p.amount || 0),
          p.kind === "refund" ? "Возврат" : "Оплата",
          METHOD[p.method ?? ""] ?? "",
          PAYMENT_STATUS_TITLES[p.status] ?? p.status,
          p.payer ?? "",
          p.note ?? "",
          fmt(p.createdAt),
        ]),
    ];

    const byManager = new Map<string, { clients: number; price: number; paid: number; debt: number; overdue: number }>();
    for (const r of rows) {
      const k = r.managerName || "Без менеджера";
      const m = byManager.get(k) ?? { clients: 0, price: 0, paid: 0, debt: 0, overdue: 0 };
      m.clients += 1;
      m.price += r.money.price;
      m.paid += r.money.paid;
      m.debt += r.money.remaining;
      m.overdue += r.money.overdue;
      byManager.set(k, m);
    }
    const managers: Cell[][] = [
      ["Менеджер", "Клиентов", "Сумма договоров", "Получено", "Долг клиентов", "Просрочено"],
      ...[...byManager.entries()].map(([k, m]) => [k, m.clients, m.price, m.paid, m.debt, m.overdue]),
    ];

    const sheets: Sheet[] = [
      { name: "Клиенты", rows: clients },
      { name: "Платежи", rows: payments },
      { name: "По менеджерам", rows: managers },
    ];
    return xlsxResponse(buildXlsx(sheets), `AlemWay-finansy-${today}.xlsx`);
  }

  if (kind === "activity") {
    const me = await requireAdminUser({ full: true });
    const money = me.role === "owner";
    const period = toPeriod(req.nextUrl.searchParams.get("period"));
    const day = toDay(req.nextUrl.searchParams.get("date"));
    const { from, to } = day ? dayBounds(day) : periodBounds(period, today);
    const [data, feed] = await Promise.all([getTeamStatsData(), getActivity({ since: from, until: to, limit: 5000 })]);
    const stats = teamStats(data, from, to);
    const names = Object.fromEntries(data.members.map((m) => [m.login, m.name]));
    const role = (r: string) => ROLE_TITLES[r] ?? r;

    const team: Cell[][] = [
      ["Сотрудник", "Роль", "Продал (за период)", ...(money ? ["Сумма договоров", "Оплачено по продажам"] : []), "Консультаций", "Действий", "Ведёт сейчас", "Завершено", "Последнее действие"],
      ...[...stats]
        .sort((a, b) => b.actions - a.actions || b.sold - a.sold)
        .map((m) => [m.name, role(m.role), m.sold, ...(money ? [m.soldSum, m.paidSum] : []), m.consultations, m.actions, m.leading, m.finished, fmt(m.lastAt)]),
    ];

    const actions: Cell[][] = [
      ["Время", "Кто", "Клиент", "Что сделал(а)"],
      ...feed.filter((a) => !to || a.at < to).map((a) => [fmt(a.at), a.name || names[a.login] || a.login, a.client ?? "", a.text]),
    ];

    const title = day ? day.split("-").reverse().join(".") : (PERIODS.find((p) => p.value === period)?.title ?? period);
    const sheets: Sheet[] = [
      { name: `Команда — ${title}`, rows: team },
      { name: "Действия", rows: actions, widths: [18, 20, 28, 70] },
    ];
    return xlsxResponse(buildXlsx(sheets), `AlemWay-aktivnost-${day ?? `${period}-${today}`}.xlsx`);
  }

  return new Response("Not found", { status: 404 });
}
