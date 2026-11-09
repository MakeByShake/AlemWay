import "server-only";
import { writeClient } from "@/lib/cabinet/server";

/**
 * Our own count of AI spending (the Console balance can't be read with a normal API key).
 * Every AI call adds its tokens and cost to a per-month document `aiUsage.YYYY-MM`.
 * The owner types the Console balance once (`aiBalance`); remaining = that balance − spent since then.
 */

// Claude Opus 5.5, $ per 1M tokens: input 4, output 20, cache read 0.20, cache write 5 (1.25× input).
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costOf(u: Usage) {
  return (
    ((u.input_tokens ?? 0) * PRICE.input +
      (u.output_tokens ?? 0) * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
    1_000_000
  );
}

const monthKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit" }).format(d);

/** Adds one AI call to this month's totals. Never throws — spending stats must not break the site. */
export async function recordUsage(kind: "declaration" | "chat", usage: Usage | null | undefined) {
  if (!usage) return;
  try {
    const cost = costOf(usage);
    const month = monthKey();
    const id = `aiUsage.${month}`;
    const c = writeClient();
    await c.createIfNotExists({ _id: id, _type: "aiUsage", month, cost: 0, calls: 0, declarations: 0, chats: 0, inputTokens: 0, outputTokens: 0 });
    await c
      .patch(id)
      .inc({
        cost,
        calls: 1,
        [kind === "declaration" ? "declarations" : "chats"]: 1,
        inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens ?? 0,
      })
      .commit();
    // Spending since the balance was entered (keeps «remaining» exact across months).
    await c.patch("ai.balance").inc({ spentSince: cost }).commit().catch(() => {});
  } catch (err) {
    console.error("[ai usage] record failed", err);
  }
}

export type AiStats = {
  month: { month: string; cost: number; calls: number; declarations: number; chats: number } | null;
  balance: { amount: number; asOf: string; spentSince: number } | null;
  monthlyLimit: number;
};

export async function getAiStats(): Promise<AiStats> {
  const c = writeClient();
  const [month, balance] = await Promise.all([
    c.fetch<AiStats["month"]>(`*[_id == $id][0]{month, cost, calls, declarations, chats}`, { id: `aiUsage.${monthKey()}` }),
    c.fetch<AiStats["balance"]>(`*[_id == "ai.balance"][0]{amount, asOf, "spentSince": coalesce(spentSince, 0)}`),
  ]);
  return { month, balance, monthlyLimit: Number(process.env.AI_MONTHLY_LIMIT_USD || 10) };
}

/** Owner enters the balance shown in the Console; counting starts again from now. */
export async function setAiBalance(amount: number) {
  await writeClient().createOrReplace({ _id: "ai.balance", _type: "aiBalance", amount, asOf: new Date().toISOString(), spentSince: 0 });
}
