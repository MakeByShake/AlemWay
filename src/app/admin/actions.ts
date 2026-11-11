"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  LOGIN_RE,
  isFullRole,
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
import { CABINET_STATUSES, FERIENJOB_FULL_SECTIONS, FILE_KINDS, FILE_LABELS, KETA_FIELDS, serviceOf, type FileKind } from "@/lib/cabinet/fields";
import { deleteFile } from "@/lib/cabinet/storage";

const FERIENJOB_ALL_FIELDS = FERIENJOB_FULL_SECTIONS.flatMap((sec) => sec.fields);
import { FEEDBACK_STATUS_LIST, LEAD_STATUSES } from "@/lib/admin/data";
import { formatTenge, parseAmount } from "@/lib/cabinet/payments";
import { removePayment, setPaymentStatus } from "@/lib/cabinet/payments-server";
import { setAiBalance } from "@/lib/ai/usage";
import { CONSULTATION_STATUSES } from "@/lib/consultation";
import { logActivity } from "@/lib/admin/activity";

const statusTitle = (v?: string) => CABINET_STATUSES.find((x) => x.value === v)?.title ?? v ?? "";

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
  await requireAdminUser({ full: true });
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
  await requireAdminUser({ full: true });
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
  if (!isFullRole(me.role)) return { login: me.login, name: me.name };
  if (picked === null) return { login: me.login, name: me.name };
  if (!picked) return null;
  const u = await getAdminUserByLogin(picked);
  return u ? { login: u.login, name: u.name } : null;
}

/** Any team member by login ("" = nobody). */
async function memberFor(login: string) {
  if (!login) return null;
  const u = await getAdminUserByLogin(login);
  return u ? { login: u.login, name: u.name } : null;
}

export async function createCabinetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
  try {
    const leadId = s(fd, "leadId", 100);
    const service = s(fd, "service", 20);
    const res = await createCabinet({
      clientName: s(fd, "clientName", 80),
      clientPhone: s(fd, "clientPhone", 30),
      service: service || undefined,
      leadId,
      manager: await managerFor(me, fd.has("manager") ? s(fd, "manager", 40) : null),
      seller: fd.has("seller") ? await memberFor(s(fd, "seller", 40)) : null,
    });
    await logActivity(me, "client_created", `создал(а) клиента ${s(fd, "clientName", 80)}`, { _id: res.id, clientName: s(fd, "clientName", 80) });
    if (leadId) await patchDoc(leadId, { status: "paid" }).catch(() => {});
    revalidatePath("/admin", "layout");
    return { ok: true, ...res, clientName: s(fd, "clientName", 80), phone: s(fd, "clientPhone", 30), curator: me.role === "owner" ? undefined : me.name, service: service || undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCabinetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
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
  if (fd.has("manager") && isFullRole(me.role)) {
    const m = await managerFor(me, s(fd, "manager", 40));
    if (m) Object.assign(set, { manager: m.login, managerName: m.name });
    else unset.push("manager", "managerName");
  }
  // Who sold the client (usually «Отдел продаж»): they then see this client too.
  if (fd.has("seller")) {
    const m = await memberFor(s(fd, "seller", 40));
    if (m) Object.assign(set, { seller: m.login, sellerName: m.name });
    else unset.push("seller", "sellerName");
  }
  for (const key of ["workFrom", "workTo", "ketaValidUntil"]) {
    if (!fd.has(key)) continue;
    const v = isoDate(s(fd, key, 10));
    if (v) set[key] = v;
    else unset.push(key);
  }
  try {
    await patchCabinet(id, set, unset);
    if (set.status && set.status !== (cab.status ?? "waiting_data"))
      await logActivity(me, "status", `перевёл(а) на этап «${statusTitle(set.status as string)}»`, cab);
    if (fd.has("seller") && (set.seller ?? "") !== (cab.seller ?? ""))
      await logActivity(me, "seller", set.sellerName ? `указал(а), что продал(а): ${set.sellerName}` : "убрал(а), кто продал", cab);
    const managerChanged = "manager" in set ? set.manager !== cab.manager : unset.includes("manager") && Boolean(cab.manager);
    if (managerChanged)
      await logActivity(me, "manager", set.managerName ? `назначил(а) ведущего: ${set.managerName}` : "убрал(а) ведущего", cab);
    const edited = ["clientName", "clientPhone", "managerNote", "employerName", "workCity", "workPosition", "clientMessage", "workFrom", "workTo", "ketaValidUntil"].some(
      (k) => fd.has(k) && (set[k] ?? "") !== ((cab as Record<string, unknown>)[k] ?? "")
    );
    if (edited) await logActivity(me, "contacts", "обновил(а) данные клиента", cab, 15);
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
  if (!isFullRole(me.role) && cab.manager !== me.login && cab.seller !== me.login) return { error: "Этот клиент закреплён за другим сотрудником" };
  const { hash, link } = newLoginToken();
  await patchCabinet(id, { tokenHash: hash, linkCreatedAt: new Date().toISOString() });
  await logActivity(me, "link", "создал(а) новую ссылку для входа", cab);
  revalidatePath(`/admin/clients/${id}`);
  const curator = cab?.managerName && cab.managerName !== "AlemWay" ? cab.managerName : undefined;
  return { ok: true, link, clientName: cab?.clientName, phone: cab?.clientPhone || cab?.data?.phone, curator, service: cab?.service };
}

export async function declarationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Кабинет не найден" };
  if (serviceOf(cab.service) !== "ferienjob") return { error: "Декларация ZAV есть только у Ferienjob" };
  if (!cab.files?.enrollment?.path) return { error: "Нет справки с места учёбы — без неё ИИ не сделает декларацию" };
  try {
    const ai = await checkAndBuildDeclaration(id, "manager");
    await logActivity(me, "declaration", `запустил(а) ИИ-декларацию: ${ai.status}`, cab);
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
  await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  await deleteCabinetCompletely(id);
  // Its history goes too (the links would lead nowhere).
  await writeClient().delete({ query: `*[_type == "activity" && cabinet == $id]`, params: { id } }).catch(() => null);
  revalidatePath("/admin", "layout");
  redirect("/admin/clients");
}

// ---------- Companions («едут вместе») ----------

/** Puts two clients into one group (merging groups if both already had one). */
export async function addCompanionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const raw = s(fd, "other", 200);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Кабинет не найден" };
  // «№12 Имя» from the list, or just «12».
  const num = Number(raw.match(/^\s*№?\s*(\d+)/)?.[1]);
  const otherId = raw.startsWith("cabinets.")
    ? raw
    : num
      ? await writeClient().fetch<string | null>(`*[_type == "cabinet" && number == $num && !(_id in path("drafts.**"))][0]._id`, { num })
      : null;
  const other = otherId ? await getCabinet(otherId) : null;
  if (!other) return { error: "Клиент не найден — выберите из списка" };
  if (other._id === cab._id) return { error: "Это тот же клиент" };
  if (cab.party && cab.party === other.party) return { error: "Они уже в одной группе" };

  const party = cab.party || other.party || `p-${randomUUID().slice(0, 8)}`;
  const ids = new Set([cab._id, other._id]);
  // Both had different groups: everyone from the second group joins the first.
  if (cab.party && other.party) {
    const rest = await writeClient().fetch<string[]>(`*[_type == "cabinet" && party == $p && !(_id in path("drafts.**"))]._id`, { p: other.party });
    rest.forEach((x) => ids.add(x));
  }
  try {
    for (const x of ids) await patchCabinet(x, { party });
    const label = (c: { number?: number; clientName?: string; data?: Record<string, string | undefined> }) =>
      [c.number ? `№${c.number}` : "", c.clientName?.trim() || [c.data?.firstName, c.data?.lastName].filter(Boolean).join(" ")].filter(Boolean).join(" ");
    await logActivity(me, "companions", `отметил(а), что едет вместе с ${label(other)}`, cab);
    revalidatePath("/admin", "layout");
    return { ok: true, message: `Добавлено: ${label(other)}` };
  } catch (err) {
    return fail(err);
  }
}

/** Takes a client out of the group; a group of one is dissolved. */
export async function removeCompanionAction(fd: FormData) {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "other", 100);
  const from = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab?.party) return;
  const party = cab.party;
  await patchCabinet(id, {}, ["party"]);
  const left = await writeClient().fetch<string[]>(`*[_type == "cabinet" && party == $p && !(_id in path("drafts.**"))]._id`, { p: party });
  if (left.length === 1) await patchCabinet(left[0]!, {}, ["party"]);
  const host = from.startsWith("cabinets.") ? await getCabinet(from) : null;
  await logActivity(me, "companions", `убрал(а) из группы «едут вместе»: ${cab.number ? "№" + cab.number + " " : ""}${cab.clientName ?? ""}`, host);
  revalidatePath("/admin", "layout");
}

// ---------- Feedback ----------

export async function updateFeedbackAction(fd: FormData) {
  await requireAdminUser({ full: true });
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
  await requireAdminUser({ full: true });
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
  const roleRaw = s(fd, "role", 10);
  const role = roleRaw === "owner" ? "owner" : roleRaw === "sales" ? "sales" : "manager";
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
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return { error: "Клиент не найден" };
  const raw = s(fd, "price", 30);
  const price = parseAmount(raw);
  if (raw && !price) return { error: "Сумма — только число, например 250000" };
  await patchCabinet(id, price ? { price } : {}, price ? [] : ["price"]);
  await logActivity(me, "price", price ? `указал(а) сумму договора ${formatTenge(price)}` : "убрал(а) сумму договора", cab);
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true, message: price ? `Сумма к оплате: ${formatTenge(price)}` : "Сумма убрана" };
}

export async function paymentStatusAction(fd: FormData) {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const key = s(fd, "key", 40);
  const status = s(fd, "status", 20);
  if (!id.startsWith("cabinets.") || !["confirmed", "rejected", "pending"].includes(status)) return;
  await setPaymentStatus(id, key, status as "confirmed" | "rejected" | "pending");
  const cab = await getCabinet(id);
  const p = cab?.payments?.find((x) => x._key === key);
  const verb = status === "confirmed" ? "подтвердил(а)" : status === "rejected" ? "отклонил(а)" : "вернул(а) на проверку";
  await logActivity(me, "payment_status", `${verb} оплату${p ? " " + formatTenge(p.amount) : ""}`, cab);
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/finance");
}

export async function deletePaymentAction(fd: FormData) {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return;
  const p = cab.payments?.find((x) => x._key === s(fd, "key", 40));
  await removePayment(cab, s(fd, "key", 40));
  await logActivity(me, "payment_status", `удалил(а) оплату${p ? " " + formatTenge(p.amount) : ""}`, cab);
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/finance");
}

/** Manager edits the client's questionnaire (any field). Empty = cleared. */
export async function updateAnketaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
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
    await logActivity(me, "anketa", "исправил(а) анкету", cab, 15);
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
  const roleRaw = s(fd, "role", 10);
  const role = roleRaw === "owner" ? "owner" : roleRaw === "sales" ? "sales" : "manager";
  if (!LOGIN_RE.test(login) || login === me.login) return;
  const user = await getAdminUserByLogin(login);
  if (!user) return;
  await writeClient().patch(user._id).set({ role }).commit();
  revalidatePath("/admin/team");
}

/** Manager deletes one file of a client (from storage too). */
export async function deleteClientFileAction(fd: FormData) {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const kind = s(fd, "kind", 20) as FileKind;
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab || !FILE_KINDS.includes(kind)) return;
  const path = cab.files?.[kind]?.path;
  await patchCabinet(id, {}, [`files.${kind}`]);
  if (path) await deleteFile(path);
  if (path) await logActivity(me, "file_delete", `удалил(а) файл «${FILE_LABELS[kind]?.ru ?? kind}»`, cab);
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
  if (!isFullRole(me.role)) {
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
    if (isFullRole(me.role)) {
      const u = login ? await getAdminUserByLogin(login) : null;
      if (u) Object.assign(set, { manager: u.login, managerName: u.name });
      else unset.push("manager", "managerName");
    }
  }
  if (Object.keys(set).length || unset.length) await patchDoc(id, set, unset);
  if (set.status) {
    const c = await writeClient().fetch<{ name?: string; date?: string; time?: string } | null>(`*[_id == $id][0]{name, date, time}`, { id });
    const title = CONSULTATION_STATUSES.find((x) => x.value === set.status)?.title.toLowerCase();
    await logActivity(me, "consultation", `консультация ${c?.name ?? ""} (${c?.date ?? ""} ${c?.time ?? ""}) — ${title}`);
  }
  revalidatePath("/admin/consultations");
  revalidatePath("/admin");
}

export async function deleteConsultationAction(fd: FormData) {
  await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  if (!id.startsWith("consultations.")) return;
  await deleteDoc(id);
  revalidatePath("/admin/consultations");
}

/** Owner marks who takes consultations (they appear on the booking page). */
export async function setConsultantAction(fd: FormData) {
  await requireAdminUser({ owner: true });
  const login = s(fd, "login", 40);
  const user = LOGIN_RE.test(login) ? await getAdminUserByLogin(login) : null;
  if (!user) return;
  await writeClient().patch(user._id).set({ consultant: s(fd, "consultant", 5) === "yes" }).commit();
  revalidatePath("/admin/team");
  revalidatePath("/ru/consultation");
  revalidatePath("/kk/consultation");
}
