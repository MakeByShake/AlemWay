import "server-only";
import { writeClient, type StoredFile } from "@/lib/cabinet/server";
import type { CabinetRow } from "./data";

/**
 * Employers in Germany (Ferienjob). Private documents `employers.<uuid>` (dot prefix = never public).
 * Clients are attached through `employer` (the employer's _id) on the cabinet.
 */

export const EMPLOYER_STATUSES = [
  { value: "active", title: "Работаем", tone: "green" },
  { value: "talks", title: "Переговоры", tone: "blue" },
  { value: "paused", title: "Пауза", tone: "amber" },
  { value: "stopped", title: "Не работаем", tone: "gray" },
] as const;
export type EmployerStatus = (typeof EMPLOYER_STATUSES)[number]["value"];

export const EMPLOYER_INDUSTRIES = [
  { value: "hotel", title: "🏨 Отель" },
  { value: "restaurant", title: "🍽️ Ресторан / кафе" },
  { value: "warehouse", title: "📦 Склад / логистика" },
  { value: "factory", title: "🏭 Завод / производство" },
  { value: "farm", title: "🌾 Ферма / сбор урожая" },
  { value: "cleaning", title: "🧹 Клининг" },
  { value: "retail", title: "🛒 Магазин / супермаркет" },
  { value: "other", title: "Другое" },
] as const;

export const HOUSING_OPTIONS = [
  { value: "free", title: "Даёт бесплатно" },
  { value: "paid", title: "Даёт, платно" },
  { value: "help", title: "Помогает найти" },
  { value: "none", title: "Нет, ищут сами" },
] as const;

export const FOOD_OPTIONS = [
  { value: "yes", title: "Да, питание есть" },
  { value: "partly", title: "Частично / скидка" },
  { value: "no", title: "Нет" },
] as const;

/** Every text field of the employer card, with its max length (the action saves only these). */
export const EMPLOYER_TEXT_FIELDS = {
  name: 120,
  legalName: 160,
  industry: 20,
  status: 20,
  city: 80,
  street: 120,
  zip: 12,
  region: 80,
  website: 200,
  contactName: 120,
  contactRole: 80,
  phone: 40,
  email: 120,
  whatsapp: 40,
  contact2: 300,
  partner: 160,
  positions: 2000,
  wage: 60,
  hours: 60,
  places: 6,
  housing: 10,
  housingCost: 120,
  housingNote: 600,
  food: 10,
  transfer: 600,
  requirements: 1500,
  duties: 2000,
  feedback: 3000,
  note: 3000,
} as const;
export type EmployerTextField = keyof typeof EMPLOYER_TEXT_FIELDS;
export const EMPLOYER_DATE_FIELDS = ["workFrom", "workTo"] as const;

export type EmployerFile = StoredFile & { _key: string; label: string };

export type Employer = { _id: string; _createdAt: string; number?: number; files?: EmployerFile[]; workFrom?: string; workTo?: string } & Partial<
  Record<EmployerTextField, string>
>;

export type EmployerRow = Employer & { clients: number };

const notDraft = `!(_id in path("drafts.**"))`;
const ROW = `_id, _createdAt, number, name, legalName, industry, status, city, contactName, phone, whatsapp, places, wage, housing, workFrom, workTo,
  "clients": count(*[_type == "cabinet" && ${notDraft} && employer == ^._id])`;

export async function getEmployers(filter: { q?: string; status?: string; industry?: string } = {}) {
  const q = filter.q?.trim() ? `*${filter.q.trim().replace(/[*"\\]/g, "")}*` : null;
  const rows = await writeClient().fetch<EmployerRow[]>(
    `*[_type == "employer" && ${notDraft}
       && (!defined($status) || coalesce(status, "active") == $status)
       && (!defined($industry) || industry == $industry)
       && (!defined($q) || name match $q || legalName match $q || city match $q || contactName match $q || phone match $q || partner match $q || string(number) == $num)
     ] | order(name asc)[0...300]{${ROW}}`,
    {
      q,
      num: filter.q?.trim().replace(/^№\s*/, "") || null,
      status: filter.status || null,
      industry: filter.industry || null,
    }
  );
  // The ones we work with first, then talks, pause, stopped.
  const rank = (v?: string) => EMPLOYER_STATUSES.findIndex((s) => s.value === (v || "active"));
  return rows.sort((a, b) => rank(a.status) - rank(b.status));
}

export function getEmployer(id: string) {
  return writeClient().fetch<Employer | null>(`*[_id == $id && _type == "employer"][0]`, { id });
}

/** Short list for the «Работодатель» picker on a client. */
export function getEmployerOptions() {
  return writeClient().fetch<{ _id: string; name?: string; city?: string; status?: string }[]>(
    `*[_type == "employer" && ${notDraft}] | order(name asc){_id, name, city, status}`
  );
}

/** Clients attached to this employer. */
export function getEmployerClients(id: string) {
  return writeClient().fetch<(CabinetRow & { manager?: string; seller?: string; workFrom?: string; workTo?: string; workPosition?: string })[]>(
    `*[_type == "cabinet" && ${notDraft} && employer == $id] | order(coalesce(number, 0) desc){
      _id, number, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName,
      manager, seller, managerName, sellerName, workFrom, workTo, workPosition
    }`,
    { id }
  );
}

export const employerStatus = (v?: string) => EMPLOYER_STATUSES.find((s) => s.value === (v || "active")) ?? EMPLOYER_STATUSES[0];
export const optionTitle = (list: readonly { value: string; title: string }[], v?: string) => list.find((o) => o.value === v)?.title;
