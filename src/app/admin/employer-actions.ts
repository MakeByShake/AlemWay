"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin/session";
import { logActivity } from "@/lib/admin/activity";
import { getCabinet, patchCabinet, writeClient } from "@/lib/cabinet/server";
import { deleteFile } from "@/lib/cabinet/storage";
import {
  EMPLOYER_DATE_FIELDS,
  EMPLOYER_INDUSTRIES,
  EMPLOYER_STATUSES,
  EMPLOYER_TEXT_FIELDS,
  FOOD_OPTIONS,
  HOUSING_OPTIONS,
  getEmployer,
  type EmployerTextField,
} from "@/lib/admin/employers";
import type { ActionState } from "./actions";

/** Employers («Работодатели»): only the owner and managers change them; «Отдел продаж» only looks. */

const s = (fd: FormData, key: string, max = 2000) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};
const isEmployerId = (id: string) => /^employers\.[\w-]+$/.test(id);
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

// Selects accept only their own options.
const CHOICES: Partial<Record<EmployerTextField, readonly { value: string }[]>> = {
  status: EMPLOYER_STATUSES,
  industry: EMPLOYER_INDUSTRIES,
  housing: HOUSING_OPTIONS,
  food: FOOD_OPTIONS,
};

function readFields(fd: FormData) {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, max] of Object.entries(EMPLOYER_TEXT_FIELDS) as [EmployerTextField, number][]) {
    if (!fd.has(key)) continue;
    let v = s(fd, key, max);
    if (key === "places") v = v.replace(/\D/g, "");
    if (key === "website" && v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
    const choices = CHOICES[key];
    if (v && choices && !choices.some((c) => c.value === v)) continue;
    if (v) set[key] = v;
    else unset.push(key);
  }
  for (const key of EMPLOYER_DATE_FIELDS) {
    if (!fd.has(key)) continue;
    const v = isoDate(s(fd, key, 10));
    if (v) set[key] = v;
    else unset.push(key);
  }
  return { set, unset };
}

export async function createEmployerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
  const name = s(fd, "name", 120);
  if (name.length < 2) return { error: "Впишите название работодателя" };
  const { set } = readFields(fd);
  const id = `employers.${randomUUID()}`;
  try {
    const max = await writeClient().fetch<number | null>(`math::max(*[_type == "employer"].number)`);
    await writeClient().create({ _id: id, _type: "employer", number: (max ?? 0) + 1, status: "active", ...set, name });
    await logActivity(me, "employer", `добавил(а) работодателя ${name}`);
  } catch (err) {
    console.error("[employer] create failed", err);
    return { error: "Не получилось. Попробуйте ещё раз." };
  }
  revalidatePath("/admin/employers");
  redirect(`/admin/employers/${id}`);
}

export async function updateEmployerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  if (!isEmployerId(id)) return { error: "Некорректный работодатель" };
  const before = await getEmployer(id);
  if (!before) return { error: "Работодатель не найден" };
  const { set, unset } = readFields(fd);
  if (unset.includes("name")) return { error: "Название не может быть пустым" };
  try {
    await writeClient().patch(id).set(set).unset(unset).commit({ visibility: "sync" });
    // The name the clients see in their cabinets follows the employer's name.
    if (typeof set.name === "string" && set.name !== before.name) {
      const ids = await writeClient().fetch<string[]>(`*[_type == "cabinet" && employer == $id]._id`, { id });
      await Promise.all(ids.map((cid) => patchCabinet(cid, { employerName: set.name })));
    }
    revalidatePath(`/admin/employers/${id}`);
    return { ok: true, message: "Сохранено" };
  } catch (err) {
    console.error("[employer] update failed", err);
    return { error: "Не получилось. Попробуйте ещё раз." };
  }
}

export async function deleteEmployerAction(fd: FormData) {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  if (!isEmployerId(id)) return;
  const emp = await getEmployer(id);
  if (!emp) return;
  // Clients keep the name and dates; only the link to the card goes.
  const ids = await writeClient().fetch<string[]>(`*[_type == "cabinet" && employer == $id]._id`, { id });
  await Promise.all(ids.map((cid) => patchCabinet(cid, {}, ["employer"])));
  await Promise.all((emp.files ?? []).map((f) => deleteFile(f.path).catch(() => null)));
  await writeClient().transaction().delete(id).delete(`drafts.${id}`).commit({ visibility: "sync" });
  await logActivity(me, "employer", `удалил(а) работодателя ${emp.name ?? ""}`);
  revalidatePath("/admin", "layout");
  redirect("/admin/employers");
}

export async function deleteEmployerFileAction(fd: FormData) {
  await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const key = s(fd, "key", 40);
  if (!isEmployerId(id)) return;
  const emp = await getEmployer(id);
  const file = emp?.files?.find((f) => f._key === key);
  if (!file) return;
  await writeClient().patch(id).unset([`files[_key=="${key}"]`]).commit({ visibility: "sync" });
  await deleteFile(file.path).catch(() => null);
  revalidatePath(`/admin/employers/${id}`);
}

/**
 * Attaches a client to an employer (or detaches with an empty employer). The client's job block gets
 * the employer's name, and city / position / dates if they were still empty.
 */
async function attach(me: { login: string; name: string }, cabId: string, employerId: string) {
  const cab = await getCabinet(cabId);
  if (!cab) return "Клиент не найден";
  if (!employerId) {
    if (!cab.employer) return null;
    await patchCabinet(cabId, {}, ["employer"]);
    await logActivity(me, "employer", `открепил(а) от работодателя ${cab.employerName ?? ""}`.trim(), cab);
    return null;
  }
  if (!isEmployerId(employerId)) return "Некорректный работодатель";
  const emp = await getEmployer(employerId);
  if (!emp) return "Работодатель не найден";
  const set: Record<string, unknown> = { employer: employerId, employerName: emp.name ?? "" };
  if (!cab.workCity && emp.city) set.workCity = emp.city;
  if (!cab.workPosition && emp.positions) set.workPosition = emp.positions.split("\n")[0].slice(0, 200);
  if (!cab.workFrom && emp.workFrom) set.workFrom = emp.workFrom;
  if (!cab.workTo && emp.workTo) set.workTo = emp.workTo;
  await patchCabinet(cabId, set);
  if (cab.employer !== employerId) await logActivity(me, "employer", `закрепил(а) за работодателем ${emp.name ?? ""}`, cab);
  return null;
}

/** From the client card: the «Работодатель» picker. */
export async function setClientEmployerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const employer = s(fd, "employer", 100);
  if (!id.startsWith("cabinets.")) return { error: "Некорректный кабинет" };
  const err = await attach(me, id, employer);
  if (err) return { error: err };
  revalidatePath(`/admin/clients/${id}`);
  if (employer) revalidatePath(`/admin/employers/${employer}`);
  return { ok: true, message: "Сохранено" };
}

/** From the employer card: «+ Закрепить клиента» by «№12 Имя» or number. */
export async function addEmployerClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const raw = s(fd, "client", 200);
  const num = Number(raw.match(/^\s*№?\s*(\d+)/)?.[1]);
  const cabId = raw.startsWith("cabinets.")
    ? raw
    : num
      ? await writeClient().fetch<string | null>(`*[_type == "cabinet" && number == $num && !(_id in path("drafts.**"))][0]._id`, { num })
      : null;
  if (!cabId) return { error: "Клиент не найден — выберите из списка или впишите номер" };
  const err = await attach(me, cabId, id);
  if (err) return { error: err };
  revalidatePath(`/admin/employers/${id}`);
  revalidatePath(`/admin/clients/${cabId}`);
  return { ok: true, message: "Клиент закреплён" };
}

export async function removeEmployerClientAction(fd: FormData) {
  const me = await requireAdminUser({ full: true });
  const id = s(fd, "id", 100);
  const cabId = s(fd, "client", 100);
  if (!cabId.startsWith("cabinets.")) return;
  await attach(me, cabId, "");
  revalidatePath(`/admin/employers/${id}`);
  revalidatePath(`/admin/clients/${cabId}`);
}
