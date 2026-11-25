import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { writeClient } from "@/lib/cabinet/server";

/**
 * Our own admin login (/admin): login + password for each manager.
 * Users are private Sanity documents `admins.<login>` (the dot hides them from the public API).
 * The session is a signed cookie; changing the password or removing the user ends old sessions.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const ADMIN_COOKIE = "aw_admin";
const SESSION_DAYS = 30;

export type AdminRole = "owner" | "founder" | "manager" | "sales";

/**
 * Roles:
 * - owner «Администратор» — everything, including team accounts (who makes the site);
 * - founder «Учредитель» — sees everything (money, finance, activity of every employee) and can work with clients;
 * - manager «Операционный отдел» — all work with clients after the sale, no money reports;
 * - sales «Отдел продаж» — only the clients they sold or lead, read-only.
 */
export const isFullRole = (role: string | undefined) => role === "owner" || role === "founder" || role === "manager";
/** Sees money: finance, payment sums in «Активность», AI costs. */
export const isTopRole = (role: string | undefined) => role === "owner" || role === "founder";
export const ROLE_TITLES: Record<string, string> = { owner: "Администратор", founder: "Учредитель", manager: "Операционный отдел", sales: "Отдел продаж" };
/** Role picker in «Команда», from the least to the most access. */
export const ROLE_OPTIONS = [
  { value: "sales", title: "Отдел продаж — только свои клиенты, просмотр" },
  { value: "manager", title: "Операционный отдел — вся работа с клиентами" },
  { value: "founder", title: "Учредитель — видит всё, включая деньги" },
  { value: "owner", title: "Администратор — всё, плюс команда и сайт" },
] as const;
export const toRole = (v: string): AdminRole => (v === "owner" || v === "founder" || v === "sales" ? v : "manager");
export type AdminUser = {
  _id: string;
  login: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  sessionVersion: number;
  createdAt?: string;
};
export type SessionUser = Omit<AdminUser, "passwordHash">;

export const LOGIN_RE = /^[a-z0-9_.-]{3,30}$/;
export const adminUserId = (login: string) => `admins.${login}`;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET is not set (min 32 chars)");
  return s;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function checkPassword(password: string, stored: string) {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(got, expected);
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function sessionValue(user: Pick<AdminUser, "login" | "sessionVersion">) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${user.login}.${exp}.${user.sessionVersion}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: SESSION_DAYS * 86_400 };
}

export async function getAdminUserByLogin(login: string): Promise<AdminUser | null> {
  if (!LOGIN_RE.test(login)) return null;
  return writeClient().fetch<AdminUser | null>(`*[_id == $id][0]{_id, login, name, role, passwordHash, sessionVersion, createdAt}`, {
    id: adminUserId(login),
  });
}

/** Checks a session cookie value; returns the user or null. */
export async function verifySession(value: string | undefined): Promise<SessionUser | null> {
  if (!value || value.length > 300) return null;
  // Logins may contain dots, so read the fixed parts from the right: login.exp.ver.sig
  const parts = value.split(".");
  if (parts.length < 4) return null;
  const [expStr, ver, sig] = parts.slice(-3);
  const login = parts.slice(0, -3).join(".");
  const expected = sign(`${login}.${expStr}.${ver}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (!(Number(expStr) > Date.now())) return null;
  const user = await getAdminUserByLogin(login);
  if (!user || String(user.sessionVersion) !== ver) return null;
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

/** The logged-in admin of this request (cached per request), or null. */
export const currentAdmin = cache(async (): Promise<SessionUser | null> => {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  try {
    return await verifySession(value);
  } catch (err) {
    console.error("[admin] session check failed", err);
    return null;
  }
});

/** For admin pages and server actions: the user, or redirect to the login page. */
export async function requireAdminUser(opts: { owner?: boolean; top?: boolean; full?: boolean } = {}): Promise<SessionUser> {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  if (opts.owner && user.role !== "owner") redirect("/admin");
  if (opts.top && !isTopRole(user.role)) redirect("/admin");
  if (opts.full && !isFullRole(user.role)) redirect("/admin");
  return user;
}

// --- Brute-force protection (per server instance; scrypt also slows guessing down). ---
const attempts = new Map<string, { n: number; until: number }>();
export function loginBlocked(key: string) {
  const a = attempts.get(key);
  return Boolean(a && a.until > Date.now() && a.n >= 5);
}
export function loginFailed(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 15 * 60_000 });
  else a.n += 1;
  if (attempts.size > 1000) attempts.clear();
}
export const loginSucceeded = (key: string) => attempts.delete(key);
