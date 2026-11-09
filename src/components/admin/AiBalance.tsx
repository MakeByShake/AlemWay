import type { AiStats } from "@/lib/ai/usage";
import { setAiBalanceAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "./ui";
import { fmtDate } from "./bits";

const usd = (n: number) => `${n.toFixed(2)} $`;

/** AI balance (estimated from our own spending count) and this month's spending vs the Console limit. */
export function AiBalance({ stats, compact }: { stats: AiStats; compact?: boolean }) {
  const spentMonth = stats.month?.cost ?? 0;
  const remaining = stats.balance ? Math.max(stats.balance.amount - stats.balance.spentSince, 0) : null;
  const limitLeft = Math.max(stats.monthlyLimit - spentMonth, 0);
  const pct = Math.min(100, Math.round((spentMonth / stats.monthlyLimit) * 100));
  if (compact) {
    return (
      <div className="card p-4">
        <p className="text-[13px] text-muted">ИИ: остаток на балансе</p>
        <p className="mt-1 text-[26px] font-bold tabular-nums">{remaining === null ? "—" : `≈ ${usd(remaining)}`}</p>
        <p className="text-[12.5px] text-muted">за месяц {usd(spentMonth)} из {stats.monthlyLimit} $</p>
      </div>
    );
  }
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-[18px] font-bold">🤖 ИИ: баланс и расходы</h2>
      <p className="mt-1 text-[14px] text-muted">Сайт сам считает, сколько потратил ИИ (декларации и помощник). Точный остаток — в Claude Console (platform.claude.com).</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-accent-soft p-3">
          <p className="text-[13px] text-muted">Осталось на балансе</p>
          <p className="text-[22px] font-bold tabular-nums">{remaining === null ? "—" : `≈ ${usd(remaining)}`}</p>
          {stats.balance && <p className="text-[12px] text-muted">с {fmtDate(stats.balance.asOf, false)} потрачено {usd(stats.balance.spentSince)}</p>}
        </div>
        <div className="rounded-xl bg-surface p-3">
          <p className="text-[13px] text-muted">Потрачено за месяц</p>
          <p className="text-[22px] font-bold tabular-nums">{usd(spentMonth)}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full ${pct >= 80 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className={`rounded-xl p-3 ${limitLeft < 2 ? "bg-warn-soft" : "bg-surface"}`}>
          <p className="text-[13px] text-muted">До лимита месяца ({stats.monthlyLimit} $)</p>
          <p className="text-[22px] font-bold tabular-nums">{usd(limitLeft)}</p>
          <p className="text-[12px] text-muted">когда закончится — ИИ остановится до 1-го числа</p>
        </div>
        <div className="rounded-xl bg-surface p-3">
          <p className="text-[13px] text-muted">Запросов за месяц</p>
          <p className="text-[22px] font-bold tabular-nums">{stats.month?.calls ?? 0}</p>
          <p className="text-[12px] text-muted">декларации: {stats.month?.declarations ?? 0} · сообщения: {stats.month?.chats ?? 0}</p>
        </div>
      </div>
      <ActionForm action={setAiBalanceAction} className="mt-5 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[14px] font-medium">
          Остаток из Console, $
          <input name="amount" inputMode="decimal" placeholder="например 97.40" className="field w-48 py-2" />
        </label>
        <SubmitButton className="btn-ghost min-h-10 px-4 text-[14px]" pendingText="Сохраняем…">
          Обновить остаток
        </SubmitButton>
      </ActionForm>
      <p className="mt-2 text-[12.5px] text-muted">Пополнили баланс в Console — впишите сюда новый остаток, и сайт продолжит считать от него.</p>
    </section>
  );
}
