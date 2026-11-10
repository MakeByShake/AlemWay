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
import { checkAndBuildDeclaration } from "@/lib/cabinet/ai-flow";
import { aiReady } from "@/lib/ai/declaration";
import { CABINET_STATUSES, FERIENJOB_FULL_SECTIONS, FILE_KINDS, KETA_FIELDS, serviceOf, type FileKind } from "@/lib/cabinet/fields";
import { deleteFile } from "@/lib/cabinet/storage";

const FERIENJOB_ALL_FIELDS = FERIENJOB_FULL_SECTIONS.flatMap((sec) => sec.fields);
import { FEEDBACK_STATUS_LIST, LEAD_STATUSES } from "@/lib/admin/data";
import { formatTenge, parseAmount } from "@/lib/cabinet/payments";
import { removePayment, setPaymentStatus } from "@/lib/cabinet/payments-server";
import { setAiBalance } from "@/lib/ai/usage";
import { CONSULTATION_STATUSES } from "@/lib/consultation";

/** Every action re-checks the login: server actions can be called directly by POST. */

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  link?: string;
  id?: string;
  login?: string;
  clientName?: string;
  phone?: string;
  curator?: string;
  service?: string;
} | null;

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
  await requireAdminUser({ owner: true });
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
  await requireAdminUser({ owner: true });
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
  const me = await requireAdminUser({ owner: true });
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
    return { ok: true, ...res, clientName: s(fd, "clientName", 80), phone: s(fd, "clientPhone", 30), curator: me.role === "owner" ? undefined : me.name, service: service || undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCabinetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  if (!id.startsWith("cabinets.")) return { error: "Некорректный кабинет" };
  const cab = await getCabinet(id);
  if (!cab) return { error: "Кабинет не найден" };

  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  const status = s(fd, "status", 40);
  if (CABINET_STATUSES.some((x) => x.value === status)) set.status = status;
  const group = s(fd, "group", 5);
  if (group === "old" || group === "new") set.group = group;
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
  const me = await requireAdminUser();
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Кабинет не найден" };
  if (me.role !== "owner" && cab.manager !== me.login) return { error: "Этот клиент закреплён за другим менеджером" };
  const { hash, link } = newLoginToken();
  await patchCabinet(id, { tokenHash: hash, linkCreatedAt: new Date().toISOString() });
  revalidatePath(`/admin/clients/${id}`);
  const curator = cab?.managerName && cab.managerName !== "AlemWay" ? cab.managerName : undefined;
  return { ok: true, link, clientName: cab?.clientName, phone: cab?.clientPhone || cab?.data?.phone, curator, service: cab?.service };
}

export async function declarationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Кабинет не найден" };
  if (serviceOf(cab.service) !== "ferienjob") return { error: "Декларация ZAV есть только у Ferienjob" };
  if (!cab.files?.enrollment?.path) return { error: "Нет справки с места учёбы — без неё ИИ не сделает декларацию" };
  try {
    const ai = await checkAndBuildDeclaration(id, "manager");
    revalidatePath(`/admin/clients/${id}`);
    return aiReady(ai.status)
      ? { ok: true, message: `ИИ: ${ai.status}. Декларация создана (дата — сегодня).` }
      : { error: `ИИ: НЕ ГОТОВО. Чего не хватает: ${ai.missing.join("; ") || "см. проверку ниже"}` };
  } catch (err) {
    console.error("[admin] AI check failed", err);
    return { error: "ИИ сейчас недоступен. Попробуйте позже." };
  }
}

export async function deleteCabinetAction(fd: FormData) {
  await requireAdminUser({ owner: true });
  await deleteCabinetCompletely(s(fd, "id", 100));
  revalidatePath("/admin", "layout");
  redirect("/admin/clients");
}

// ---------- Feedback ----------

export async function updateFeedbackAction(fd: FormData) {
  await requireAdminUser({ owner: true });
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
  await requireAdminUser({ owner: true });
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
  await requireAdminUser({ owner: true });
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
  await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  const key = s(fd, "key", 40);
  const status = s(fd, "status", 20);
  if (!id.startsWith("cabinets.") || !["confirmed", "rejected", "pending"].includes(status)) return;
  await setPaymentStatus(id, key, status as "confirmed" | "rejected" | "pending");
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/finance");
}

export async function deletePaymentAction(fd: FormData) {
  await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return;
  await removePayment(cab, s(fd, "key", 40));
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/finance");
}

/** Manager edits the client's questionnaire (any field). Empty = cleared. */
export async function updateAnketaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Кабинет не найден" };
  const fields = serviceOf(cab.service) === "keta" ? KETA_FIELDS : FERIENJOB_ALL_FIELDS;
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const f of fields) {
    if (!fd.has(`d_${f.key}`)) continue;
    const v = s(fd, `d_${f.key}`, f.maxLength ?? 300);
    if (v) set[`data.${f.key}`] = v;
    else unset.push(`data.${f.key}`);
  }
  try {
    await patchCabinet(id, set, unset);
    revalidatePath(`/admin/clients/${id}`);
    return { ok: true, message: "Анкета сохранена" };
  } catch (err) {
    return fail(err);
  }
}

/** Owner changes someone's role (manager ↔ owner). You can't change your own role. */
export async function setRoleAction(fd: FormData) {
  const me = await requireAdminUser({ owner: true });
  const login = s(fd, "login", 40);
  const role = s(fd, "role", 10) === "owner" ? "owner" : "manager";
  if (!LOGIN_RE.test(login) || login === me.login) return;
  const user = await getAdminUserByLogin(login);
  if (!user) return;
  await writeClient().patch(user._id).set({ role }).commit();
  revalidatePath("/admin/team");
}

/** Manager deletes one file of a client (from storage too). */
export async function deleteClientFileAction(fd: FormData) {
  await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  const kind = s(fd, "kind", 20) as FileKind;
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab || !FILE_KINDS.includes(kind)) return;
  const path = cab.files?.[kind]?.path;
  await patchCabinet(id, {}, [`files.${kind}`]);
  if (path) await deleteFile(path);
  revalidatePath(`/admin/clients/${id}`);
}

/** Owner types the balance shown in the Claude Console; the site counts spending from now on. */
export async function setAiBalanceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser({ owner: true });
  const amount = Number(s(fd, "amount", 20).replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return { error: "Укажите сумму в долларах, например 97.40" };
  await setAiBalance(amount);
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  return { ok: true, message: `Остаток ${amount.toFixed(2)} $ сохранён — дальше сайт считает расходы сам` };
}

// ---------- Consultations ----------

export async function updateConsultationAction(fd: FormData) {
  const me = await requireAdminUser();
  const id = s(fd, "id", 100);
  if (!id.startsWith("consultations.")) return;
  // Managers see every consultation but change only the ones the owner gave them.
  if (me.role !== "owner") {
    const assigned = await writeClient().fetch<string | null>(`*[_id == $id][0].manager`, { id });
    if (assigned !== me.login) return;
  }
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  const status = s(fd, "status", 20);
  if (CONSULTATION_STATUSES.some((x) => x.value === status)) set.status = status;
  if (fd.has("paid")) set.paid = s(fd, "paid", 5) === "yes";
  if (fd.has("managerNote")) set.managerNote = s(fd, "managerNote", 2000);
  // Who takes the consultation: only the owner assigns.
  if (fd.has("manager")) {
    const login = s(fd, "manager", 40);
    if (me.role === "owner") {
      const u = login ? await getAdminUserByLogin(login) : null;
      if (u) Object.assign(set, { manager: u.login, managerName: u.name });
      else unset.push("manager", "managerName");
    }
  }
  if (Object.keys(set).length || unset.length) await patchDoc(id, set, unset);
  revalidatePath("/admin/consultations");
  revalidatePath("/admin");
}

export async function deleteConsultationAction(fd: FormData) {
  await requireAdminUser({ owner: true });
  const id = s(fd, "id", 100);
  if (!id.startsWith("consultations.")) return;
  await deleteDoc(id);
  revalidatePath("/admin/consultations");
}
