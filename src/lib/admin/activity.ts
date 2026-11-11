import "server-only";
import { randomUUID } from "node:crypto";
import { writeClient } from "@/lib/cabinet/server";
import type { Payment } from "@/lib/cabinet/payments";

/**
 * Team activity log: who did what and when. One small private document per action
 * (`activity.<uuid>`, dot prefix = never public). Logging never breaks the action itself.
 */

export type ActivityKind =
  | "client_created"
  | "status"
  | "seller"
  | "manager"
  | "contacts"
  | "anketa"
  | "file_upload"
  | "file_delete"
  | "payment"
  | "payment_status"
  | "price"
  | "link"
  | "declaration"
  | "consultation"
  | "companions";

export const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  client_created: "🆕",
  status: "🚦",
  seller: "🤝",
  manager: "👤",
  contacts: "✏️",
  anketa: "📝",
  file_upload: "📎",
  file_delete: "🗑️",
  payment: "💳",
  payment_status: "✅",
  price: "🏷️",
  link: "🔗",
  declaration: "🤖",
  consultation: "📅",
  companions: "👥",
};

export type Activity = {
  _id: string;
  at: string;
  login: string;
  name?: string;
  kind: ActivityKind;
  text: string;
  cabinet?: string;
  client?: string;
};

export async function logActivity(
  who: { login: string | null; name?: string } | null,
  kind: ActivityKind,
  text: string,
  cab?: { _id: string; number?: number; clientName?: string; data?: Record<string, string | undefined> } | null,
  /** Autosaved edits: log one line per person, client and kind within this many minutes. */
  dedupeMinutes = 0
) {
  if (!who?.login) return;
  try {
    if (dedupeMinutes && cab) {
      const recent = await writeClient().fetch<boolean>(
        `count(*[_type == "activity" && login == $login && kind == $kind && cabinet == $cab && at >= $since]) > 0`,
        { login: who.login, kind, cab: cab._id, since: new Date(Date.now() - dedupeMinutes * 60_000).toISOString() }
      );
      if (recent) return;
    }
    const client = cab
      ? [cab.number ? `№${cab.number}` : "", [cab.data?.firstName, cab.data?.lastName].filter(Boolean).join(" ") || cab.clientName || ""]
          .filter(Boolean)
          .join(" ")
      : undefined;
    await writeClient().create({
      _id: `activity.${randomUUID()}`,
      _type: "activity",
      at: new Date().toISOString(),
      login: who.login,
      ...(who.name ? { name: who.name } : {}),
      kind,
      text: text.slice(0, 300),
      ...(cab ? { cabinet: cab._id, client } : {}),
    });
  } catch (err) {
    console.error("[activity] log failed", err);
  }
}

export function getActivity(opts: { since?: string; cabinet?: string; limit?: number } = {}) {
  return writeClient().fetch<Activity[]>(
    `*[_type == "activity" && (!defined($since) || at >= $since) && (!defined($cabinet) || cabinet == $cabinet)] | order(at desc)[0...$limit]{
      _id, at, login, name, kind, text, cabinet, client
    }`,
    { since: opts.since ?? null, cabinet: opts.cabinet ?? null, limit: opts.limit ?? 60 }
  );
}

export type TeamStatsInput = {
  members: { login: string; name: string; role: string }[];
  cabinets: {
    _id: string;
    _createdAt: string;
    status?: string;
    seller?: string;
    manager?: string;
    price?: number;
    payments?: Payment[];
  }[];
  consultations: { manager?: string; status?: string; date?: string }[];
  actions: { login: string; at: string }[];
};

/** Everything the «Активность команды» page needs, in one query. */
export function getTeamStatsData() {
  return writeClient().fetch<TeamStatsInput>(`{
    "members": *[_type == "adminUser"] | order(name asc){login, name, role},
    "cabinets": *[_type == "cabinet" && !(_id in path("drafts.**"))]{_id, _createdAt, status, seller, manager, price, payments},
    "consultations": *[_type == "consultation" && !(_id in path("drafts.**"))]{manager, status, date},
    "actions": *[_type == "activity" && at >= $since]{login, at}
  }`, { since: new Date(Date.now() - 400 * 864e5).toISOString() });
}

export type MemberStats = {
  login: string;
  name: string;
  role: string;
  sold: number;
  soldSum: number;
  paidSum: number;
  leading: number;
  finished: number;
  consultations: number;
  actions: number;
  lastAt?: string;
  /** Did something in the last 15 minutes. */
  online: boolean;
};

const FINISHED = ["done", "keta_rejected"];

/** Per-person numbers for a period (from..to as YYYY-MM-DD / ISO; open ends allowed). */
export function teamStats(d: TeamStatsInput, from?: string, to?: string): MemberStats[] {
  const inRange = (v?: string) => !!v && (!from || v >= from) && (!to || v < to);
  return d.members.map((m) => {
    const sold = d.cabinets.filter((c) => c.seller === m.login && inRange(c._createdAt));
    const paidSum = d.cabinets
      .filter((c) => c.seller === m.login)
      .flatMap((c) => c.payments ?? [])
      .filter((p) => p.status === "confirmed" && inRange(p.paidAt || p.createdAt))
      .reduce((s, p) => s + (p.amount || 0), 0);
    const mine = d.cabinets.filter((c) => c.manager === m.login);
    const acts = d.actions.filter((a) => a.login === m.login);
    const lastAt = acts.reduce<string | undefined>((max, a) => (!max || a.at > max ? a.at : max), undefined);
    return {
      login: m.login,
      name: m.name,
      role: m.role,
      sold: sold.length,
      soldSum: sold.reduce((s, c) => s + (c.price || 0), 0),
      paidSum,
      leading: mine.filter((c) => !FINISHED.includes(c.status ?? "")).length,
      finished: mine.filter((c) => c.status === "done").length,
      consultations: d.consultations.filter((c) => c.manager === m.login && c.status === "done" && inRange(c.date)).length,
      actions: acts.filter((a) => inRange(a.at)).length,
      lastAt,
      online: !!lastAt && Date.now() - new Date(lastAt).getTime() < 15 * 60_000,
    };
  });
}
