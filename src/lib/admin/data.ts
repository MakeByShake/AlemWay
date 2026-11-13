import "server-only";
import { writeClient, type Cabinet } from "@/lib/cabinet/server";
import type { ServiceId } from "@/lib/cabinet/fields";
import type { Payment } from "@/lib/cabinet/payments";

/** Reads for the /admin pages. Everything goes through the server token; nothing is public. */

export const LEAD_STATUSES = [
  { value: "new", title: "Новая", tone: "blue" },
  { value: "in_progress", title: "В работе", tone: "amber" },
  { value: "paid", title: "Оплачено", tone: "green" },
  { value: "closed", title: "Закрыто", tone: "gray" },
] as const;

export const FEEDBACK_STATUS_LIST = [
  { value: "new", title: "Новый", tone: "blue" },
  { value: "read", title: "Прочитан", tone: "amber" },
  { value: "done", title: "Сделано", tone: "green" },
] as const;

export const FEEDBACK_TOPIC_TITLES: Record<string, string> = { site: "О сайте", service: "О работе", other: "Другое" };

export type Lead = {
  _id: string;
  status?: string;
  name?: string;
  phone?: string;
  serviceTitle?: string;
  comment?: string;
  locale?: string;
  page?: string;
  createdAt?: string;
  managerNote?: string;
  cabinetId?: string | null;
};

export type Feedback = {
  _id: string;
  status?: string;
  rating?: number;
  topic?: string;
  liked?: string;
  improve?: string;
  name?: string;
  contact?: string;
  page?: string;
  createdAt?: string;
  managerNote?: string;
};

export type CabinetRow = {
  _id: string;
  number?: number;
  _createdAt: string;
  service?: ServiceId;
  status?: string;
  clientName?: string;
  clientPhone?: string;
  firstName?: string;
  lastName?: string;
  managerName?: string;
  sellerName?: string;
  party?: string;
  /** Open «деканат не ставит печать» report. */
  dean?: boolean;
  employerName?: string;
};

export type CabinetFull = Cabinet & { _createdAt: string; managerNote?: string; linkCreatedAt?: string; leadId?: string };

const notDraft = `!(_id in path("drafts.**"))`;

export function getLeads(status?: string) {
  return writeClient().fetch<Lead[]>(
    `*[_type == "lead" && ${notDraft} && (!defined($status) || coalesce(status, "new") == $status)] | order(coalesce(createdAt, _createdAt) desc)[0...300]{
      _id, status, name, phone, serviceTitle, comment, locale, page, "createdAt": coalesce(createdAt, _createdAt), managerNote,
      "cabinetId": *[_type == "cabinet" && lead._ref == ^._id && ${notDraft}][0]._id
    }`,
    { status: status ?? null }
  );
}

export function getFeedback(status?: string) {
  return writeClient().fetch<Feedback[]>(
    `*[_type == "feedback" && ${notDraft} && (!defined($status) || coalesce(status, "new") == $status)] | order(coalesce(createdAt, _createdAt) desc)[0...300]{
      _id, status, rating, topic, liked, improve, name, contact, page, "createdAt": coalesce(createdAt, _createdAt), managerNote
    }`,
    { status: status ?? null }
  );
}

export function getCabinets(filter: { service?: string; status?: string; q?: string; manager?: string; seller?: string; mine?: string; group?: string }) {
  const q = filter.q?.trim() ? `*${filter.q.trim().replace(/[*"\\]/g, "")}*` : null;
  return writeClient().fetch<CabinetRow[]>(
    `*[_type == "cabinet" && ${notDraft}
       && (!defined($service) || coalesce(service, "ferienjob") == $service)
       && (!defined($status) || coalesce(status, "waiting_data") == $status)
       && (!defined($group) || coalesce(group, "new") == $group)
       && (!defined($manager) || ($manager == "-" && !defined(manager)) || manager == $manager)
       && (!defined($seller) || ($seller == "-" && !defined(seller)) || seller == $seller)
       && (!defined($mine) || manager == $mine || seller == $mine)
       && (!defined($q) || string(number) == $num || clientName match $q || clientPhone match $q || data.firstName match $q || data.lastName match $q)
     ] | order(coalesce(number, 0) desc, _createdAt desc)[0...300]{
      _id, number, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName, managerName, sellerName, party,
      "dean": defined(deanIssue) && !defined(deanIssue.resolvedAt), "employerName": select(defined(employer) => employerName)
    }`,
    {
      service: filter.service || null,
      status: filter.status || null,
      q,
      num: filter.q?.trim().replace(/^№\s*/, "") || null,
      manager: filter.manager || null,
      seller: filter.seller || null,
      mine: filter.mine || null,
      group: filter.group || null,
    }
  );
}

/** Other clients in the same «едут вместе» group. */
export function getCompanions(party: string | undefined, id: string) {
  if (!party) return Promise.resolve([] as CabinetRow[]);
  return writeClient().fetch<CabinetRow[]>(
    `*[_type == "cabinet" && ${notDraft} && party == $party && _id != $id] | order(number asc){
      _id, number, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName, managerName, sellerName
    }`,
    { party, id }
  );
}

/** Short list of every client for pickers: «№12 Имя Фамилия». */
export function getClientOptions() {
  return writeClient().fetch<CabinetRow[]>(
    `*[_type == "cabinet" && ${notDraft}] | order(coalesce(number, 0) desc){_id, number, _createdAt, clientName, "firstName": data.firstName, "lastName": data.lastName, party}`
  );
}

export function getCabinetFull(id: string) {
  return writeClient().fetch<CabinetFull | null>(
    `*[_id == $id && _type == "cabinet"][0]{..., "leadId": lead._ref}`,
    { id }
  );
}

export function getDashboard(login: string, onlyMine = false) {
  return writeClient().fetch<{
    newLeads: number;
    leadsWeek: number;
    activeClients: number;
    waitingAction: number;
    newFeedback: number;
    myClients: number;
    latestLeads: Lead[];
    actionClients: CabinetRow[];
  }>(
    `{
      "newLeads": count(*[_type == "lead" && ${notDraft} && coalesce(status, "new") == "new"]),
      "leadsWeek": count(*[_type == "lead" && ${notDraft} && dateTime(_createdAt) > dateTime(now()) - 60*60*24*7]),
      "activeClients": count(*[_type == "cabinet" && ${notDraft} && !(status in ["done", "keta_rejected"]) && (!$onlyMine || manager == $login || seller == $login)]),
      "waitingAction": count(*[_type == "cabinet" && ${notDraft} && status in ["signed_uploaded", "keta_applying"] && (!$onlyMine || manager == $login || seller == $login)]),
      "myClients": count(*[_type == "cabinet" && ${notDraft} && (manager == $login || seller == $login) && !(status in ["done", "keta_rejected"])]),
      "newFeedback": count(*[_type == "feedback" && ${notDraft} && coalesce(status, "new") == "new"]),
      "latestLeads": *[_type == "lead" && ${notDraft}] | order(coalesce(createdAt, _createdAt) desc)[0...5]{
        _id, status, name, phone, serviceTitle, "createdAt": coalesce(createdAt, _createdAt)
      },
      "actionClients": *[_type == "cabinet" && ${notDraft} && status in ["signed_uploaded", "keta_applying"] && (!$onlyMine || manager == $login || seller == $login)] | order(_updatedAt desc)[0...8]{
        _id, number, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName
      }
    }`,
    { login, onlyMine }
  );
}

/** Logins and names for the «Менеджер» pickers. */
export function getManagerOptions() {
  return writeClient().fetch<{ login: string; name: string }[]>(`*[_type == "adminUser"] | order(name asc){login, name}`);
}

export function getAdminUsers() {
  return writeClient().fetch<{ _id: string; login: string; name: string; role: string; consultant?: boolean; createdAt?: string }[]>(
    `*[_type == "adminUser"] | order(createdAt asc){_id, login, name, role, consultant, createdAt}`
  );
}

/** Sets fields on a document and on its Studio draft, if one exists (so a later publish doesn't undo it). */
export async function patchDoc(id: string, set: Record<string, unknown>, unset: string[] = []) {
  const c = writeClient();
  const draftId = `drafts.${id}`;
  const hasDraft = Boolean(await c.fetch(`defined(*[_id == $id][0]._id)`, { id: draftId }));
  const tx = c.transaction();
  for (const target of hasDraft ? [id, draftId] : [id]) {
    tx.patch(target, (p) => {
      const q = p.set(set);
      return unset.length ? q.unset(unset) : q;
    });
  }
  await tx.commit({ visibility: "sync" });
}

export async function deleteDoc(id: string) {
  await writeClient().transaction().delete(id).delete(`drafts.${id}`).commit({ visibility: "sync" });
}

/** «Имя (для нас)» comes first — the team can rename a client; the questionnaire name is the fallback. */
export const cabinetName = (c: { firstName?: string; lastName?: string; clientName?: string; data?: Record<string, string | undefined> }) =>
  c.clientName?.trim() || [c.firstName ?? c.data?.firstName, c.lastName ?? c.data?.lastName].filter(Boolean).join(" ") || "Без имени";

export type FinanceRow = CabinetRow & { price?: number; payments?: Payment[]; manager?: string };

export function getFinanceRows() {
  return writeClient().fetch<FinanceRow[]>(
    `*[_type == "cabinet" && ${notDraft}] | order(coalesce(number, 0) desc){
      _id, number, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName,
      manager, managerName, price, payments
    }`
  );
}

export type Consultation = {
  _id: string;
  status?: string;
  name?: string;
  phone?: string;
  date?: string;
  time?: string;
  topicTitle?: string;
  comment?: string;
  price?: number;
  paid?: boolean;
  manager?: string;
  managerName?: string;
  managerNote?: string;
  createdAt?: string;
};

/** Upcoming (from today) or past consultations; optional status and manager filters. */
export function getConsultations(filter: { when: "upcoming" | "past"; today: string; status?: string; manager?: string }) {
  const upcoming = filter.when === "upcoming";
  return writeClient().fetch<Consultation[]>(
    `*[_type == "consultation" && !(_id in path("drafts.**"))
       && (${upcoming ? "date >= $today" : "date < $today"})
       && (!defined($status) || status == $status)
       && (!defined($manager) || manager == $manager)
     ] | order(date ${upcoming ? "asc" : "desc"}, time ${upcoming ? "asc" : "desc"})[0...300]{
      _id, status, name, phone, date, time, topicTitle, comment, price, paid, manager, managerName, managerNote, createdAt
    }`,
    { today: filter.today, status: filter.status || null, manager: filter.manager || null }
  );
}

export function countConsultationsToday(today: string) {
  return writeClient().fetch<number>(`count(*[_type == "consultation" && date == $today && status in ["new", "confirmed"]])`, { today });
}
