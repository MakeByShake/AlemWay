import "server-only";
import { createHash } from "node:crypto";
import { writeClient } from "@/lib/cabinet/server";

/**
 * Team members who take consultations (owner ticks «Ведёт консультации» in «Команда»).
 * The site gets only a name and an opaque key — never the login.
 */
export type Consultant = { key: string; name: string; login: string };

export const consultantKey = (login: string) => createHash("sha256").update(`consultant:${login}`).digest("hex").slice(0, 12);

export async function getConsultants(): Promise<Consultant[]> {
  const users = await writeClient().fetch<{ login: string; name: string }[]>(`*[_type == "adminUser" && consultant == true] | order(name asc){login, name}`);
  return users.map((u) => ({ ...u, key: consultantKey(u.login) }));
}

/** Booked hours of a day: for one consultant, or (for «любой») the hours when everyone is busy. */
export async function bookedHours(date: string, consultant: Consultant | null, all: Consultant[]) {
  const rows = await writeClient().fetch<{ time: string; manager?: string }[]>(
    `*[_type == "consultation" && date == $date && status in ["new", "confirmed"]]{time, manager}`,
    { date }
  );
  const byTime = new Map<string, { total: number; logins: Set<string> }>();
  for (const r of rows) {
    const x = byTime.get(r.time) ?? { total: 0, logins: new Set<string>() };
    x.total++;
    if (r.manager) x.logins.add(r.manager);
    byTime.set(r.time, x);
  }
  const capacity = Math.max(all.length, 1);
  return [...byTime.entries()]
    .filter(([, x]) => (consultant ? x.logins.has(consultant.login) || x.total >= capacity : x.total >= capacity))
    .map(([t]) => t);
}
