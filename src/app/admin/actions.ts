"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  LOGIN_RE,
  adminUserId,
  checkPassword,
  getAdminUserByLogin,
  hashPassword,
  loginBlocked,
  loginFailed,
  loginSucceeded,
  requireAdminUser,
  sessionValue,
} from "@/lib/admin/session";
import { deleteDoc, patchDoc } from "@/lib/admin/data";
import { AdminOpError, createCabinet, deleteCabinetCompletely } from "@/lib/cabinet/admin-ops";
import { getCabinet, newLoginToken, patchCabinet, writeClient } from "@/lib/cabinet/server";
import { generateDeclaration } from "@/lib/cabinet/declaration";
import { CABINET_FIELDS, CABINET_STATUSES, serviceOf, validateCabinetData } from "@/lib/cabinet/fields";
import { FEEDBACK_STATUS_LIST, LEAD_STATUSES } from "@/lib/admin/data";
import { formatTenge, parseAmount } from "@/lib/cabinet/payments";
import { removePayment, setPaymentStatus } from "@/lib/cabinet/payments-server";

/** Every action re-checks the login: server actions can be called directly by POST. */

export type ActionState = { ok?: boolean; error?: string; message?: string; link?: string; id?: string; login?: string } | null;

const s = (fd: FormData, key: string, max = 2000) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const fail = (err: unknown): ActionState => {
  if (err instanceof AdminOpError) return { error: err.message };
  console.error("[admin action]", err);
  return { error: "Не получилось. Попробуйте ещё раз." };
};

// ---------- Login ----------

async function setSessionCookie(value: string, maxAge: number) {
  // Secure everywhere except a local test server on http://localhost.
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test((await headers()).get("host") ?? "");
  (await cookies()).set(ADMIN_COOKIE, value, { httpOnly: true, secure: !local, sameSite: "lax", path: "/", maxAge });
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const login = s(fd, "login", 40).toLowerCase();
  const password = s(fd, "password", 200);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const key = `${ip}|${login}`;
  if (loginBlocked(key)) return { error: "Слишком много попыток. Подождите 15 минут.", login };

  const user = login && password ? await getAdminUserByLogin(login) : null;
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    loginFailed(key);
    return { error: "Неверный логин или пароль", login };
  }
  loginSucceeded(key);
  const { value, maxAge } = sessionValue(user);
  await setSessionCookie(value, maxAge);
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ---------- Leads ----------

export async function updateLeadAction(fd: FormData) {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!/^leads\.[\w-]+$|^[\w-]+$/.test(id)) return;
  const set: Record<string, unknown> = {};
  const status = s(fd, "status", 30);
  if (LEAD_STATUSES.some((x) => x.value === status)) set.status = status;
  if (fd.has("managerNote")) set.managerNote = s(fd, "managerNote", 2000);
  if (Object.keys(set).length) await patchDoc(id, set);
  revalidatePath("/admin", "layout");
}

export async function deleteLeadAction(fd: FormData) {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!/^leads\.[\w-]+$|^[\w-]+$/.test(id)) return;
  const type = await writeClient().fetch<string | null>(`*[_id == $id][0]._type`, { id });
  if (type !== "lead") return;
  await deleteDoc(id);
  revalidatePath("/admin", "layout");
}

// ---------- Cabinets (clients) ----------

/** Owner picks the manager; a manager's own new clients are assigned to them. "" = nobody. */
async function managerFor(me: { login: string; name: string; role: string }, picked: string | null) {
  if (me.role !== "owner") return { login: me.login, name: me.name };
  if (picked === null) return { login: me.login, name: me.name };
  if (!picked) return null;
  const u = await getAdminUserByLogin(picked);
  return u ? { login: u.login, name: u.name } : null;
}

export async function createCabinetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser();
  try {
    const leadId = s(fd, "leadId", 100);
    const service = s(fd, "service", 20);
    const res = await createCabinet({
      clientName: s(fd, "clientName", 80),
      clientPhone: s(fd, "clientPhone", 30),
      service: service || undefined,
      leadId,
      manager: await managerFor(me, fd.has("manager") ? s(fd, "manager", 40) : null),
    });
    if (leadId) await patchDoc(leadId, { status: "paid" }).catch(() => {});
    revalidatePath("/admin", "layout");
    return { ok: true, ...res };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCabinetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!id.startsWith("cabinets.")) return { error: "Некорректный кабинет" };
  const cab = await getCabinet(id);
  if (!cab) return { error: "Кабинет не найден" };

  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  const status = s(fd, "status", 40);
  if (CABINET_STATUSES.some((x) => x.value === status)) set.status = status;
  for (const key of ["clientName", "clientPhone", "managerNote", "employerName", "workCity", "workPosition", "clientMessage"]) {
    if (fd.has(key)) set[key] = s(fd, key, key === "clientMessage" || key === "managerNote" ? 3000 : 200);
  }
  // Only the owner assigns managers.
  if (fd.has("manager") && me.role === "owner") {
    const m = await managerFor(me, s(fd, "manager", 40));
    if (m) Object.assign(set, { manager: m.login, managerName: m.name });
    else unset.push("manager", "managerName");
  }
  for (const key of ["workFrom", "workTo", "ketaValidUntil"]) {
    if (!fd.has(key)) continue;
    const v = isoDate(s(fd, key, 10));
    if (v) set[key] = v;
    else unset.push(key);
  }
  try {
    await patchCabinet(id, set, unset);
    revalidatePath(`/admin/clients/${id}`);
    return { ok: true, message: "Сохранено" };
  } catch (err) {
    return fail(err);
  }
}

export async function newLinkAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!id.startsWith("cabinets.") || !(await getCabinet(id))) return { error: "Кабинет не найден" };
  const { hash, link } = newLoginToken();
  await patchCabinet(id, { tokenHash: hash, linkCreatedAt: new Date().toISOString() });
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true, link };
}

export async function declarationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Кабинет не найден" };
  if (serviceOf(cab.service) !== "ferienjob") return { error: "Декларация ZAV есть только у Ferienjob" };
  const errors = validateCabinetData(cab.data ?? {});
  if (Object.keys(errors).length) {
    const names = Object.keys(errors).map((k) => CABINET_FIELDS.find((f) => f.key === k)?.label.ru ?? k);
    return { error: `Не заполнено или с ошибкой: ${names.join("; ")}` };
  }
  try {
    await generateDeclaration(cab);
    revalidatePath(`/admin/clients/${id}`);
    return { ok: true, message: "Декларация создана заново (дата — сегодня)" };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteCabinetAction(fd: FormData) {
  await requireAdminUser();
  await deleteCabinetCompletely(s(fd, "id", 100));
  revalidatePath("/admin", "layout");
  redirect("/admin/clients");
}

// ---------- Feedback ----------

export async function updateFeedbackAction(fd: FormData) {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!id.startsWith("feedback.")) return;
  const set: Record<string, unknown> = {};
  const status = s(fd, "status", 20);
  if (FEEDBACK_STATUS_LIST.some((x) => x.value === status)) set.status = status;
  if (fd.has("managerNote")) set.managerNote = s(fd, "managerNote", 2000);
  if (Object.keys(set).length) await patchDoc(id, set);
  revalidatePath("/admin", "layout");
}

export async function deleteFeedbackAction(fd: FormData) {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!id.startsWith("feedback.")) return;
  await deleteDoc(id);
  revalidatePath("/admin", "layout");
}

// ---------- Team ----------

export async function addManagerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser({ owner: true });
  const login = s(fd, "login", 40).toLowerCase();
  const name = s(fd, "name", 60);
  const password = s(fd, "password", 200);
  const role = s(fd, "role", 10) === "owner" ? "owner" : "manager";
  if (!LOGIN_RE.test(login)) return { error: "Логин: 3–30 символов, латиница, цифры, точка, дефис" };
  if (name.length < 2) return { error: "Укажите имя" };
  if (password.length < 8) return { error: "Пароль — минимум 8 символов" };
  if (await getAdminUserByLogin(login)) return { error: "Такой логин уже есть" };
  await writeClient().create({
    _id: adminUserId(login),
    _type: "adminUser",
    login,
    name,
    role,
    passwordHash: await hashPassword(password),
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/admin/team");
  return { ok: true, message: `Готово. Логин: ${login}` };
}

export async function removeManagerAction(fd: FormData) {
  const me = await requireAdminUser({ owner: true });
  const login = s(fd, "login", 40);
  if (!LOGIN_RE.test(login) || login === me.login) return;
  await writeClient().delete(adminUserId(login));
  revalidatePath("/admin/team");
}

export async function setPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser();
  const login = s(fd, "login", 40) || me.login;
  if (login !== me.login && me.role !== "owner") return { error: "Нет доступа" };
  const password = s(fd, "password", 200);
  if (password.length < 8) return { error: "Пароль — минимум 8 символов" };
  const user = await getAdminUserByLogin(login);
  if (!user) return { error: "Пользователь не найден" };
  const sessionVersion = (user.sessionVersion ?? 1) + 1;
  await writeClient()
    .patch(user._id)
    .set({ passwordHash: await hashPassword(password), sessionVersion })
    .commit();
  // Changing the password logs out old sessions; keep the current one if it is your own.
  if (login === me.login) {
    const { value, maxAge } = sessionValue({ login, sessionVersion });
    await setSessionCookie(value, maxAge);
  }
  return { ok: true, message: "Пароль изменён" };
}

// ---------- Payments ----------

export async function setPriceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!id.startsWith("cabinets.") || !(await getCabinet(id))) return { error: "Клиент не найден" };
  const raw = s(fd, "price", 30);
  const price = parseAmount(raw);
  if (raw && !price) return { error: "Сумма — только число, например 250000" };
  await patchCabinet(id, price ? { price } : {}, price ? [] : ["price"]);
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true, message: price ? `Сумма к оплате: ${formatTenge(price)}` : "Сумма убрана" };
}

export async function paymentStatusAction(fd: FormData) {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  const key = s(fd, "key", 40);
  const status = s(fd, "status", 20);
  if (!id.startsWith("cabinets.") || !["confirmed", "rejected", "pending"].includes(status)) return;
  await setPaymentStatus(id, key, status as "confirmed" | "rejected" | "pending");
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/finance");
}

export async function deletePaymentAction(fd: FormData) {
  await requireAdminUser();
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return;
  await removePayment(cab, s(fd, "key", 40));
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/finance");
}
