import "server-only";
import { writeClient, type Cabinet } from "@/lib/cabinet/server";
import type { ServiceId } from "@/lib/cabinet/fields";

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
  _createdAt: string;
  service?: ServiceId;
  status?: string;
  clientName?: string;
  clientPhone?: string;
  firstName?: string;
  lastName?: string;
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

export function getCabinets(filter: { service?: string; status?: string; q?: string }) {
  const q = filter.q?.trim() ? `*${filter.q.trim().replace(/[*"\\]/g, "")}*` : null;
  return writeClient().fetch<CabinetRow[]>(
    `*[_type == "cabinet" && ${notDraft}
       && (!defined($service) || coalesce(service, "ferienjob") == $service)
       && (!defined($status) || coalesce(status, "waiting_data") == $status)
       && (!defined($q) || clientName match $q || clientPhone match $q || data.firstName match $q || data.lastName match $q)
     ] | order(_createdAt desc)[0...300]{
      _id, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName
    }`,
    { service: filter.service || null, status: filter.status || null, q }
  );
}

export function getCabinetFull(id: string) {
  return writeClient().fetch<CabinetFull | null>(
    `*[_id == $id && _type == "cabinet"][0]{..., "leadId": lead._ref}`,
    { id }
  );
}

export function getDashboard() {
  return writeClient().fetch<{
    newLeads: number;
    leadsWeek: number;
    activeClients: number;
    waitingAction: number;
    newFeedback: number;
    latestLeads: Lead[];
    actionClients: CabinetRow[];
  }>(
    `{
      "newLeads": count(*[_type == "lead" && ${notDraft} && coalesce(status, "new") == "new"]),
      "leadsWeek": count(*[_type == "lead" && ${notDraft} && dateTime(_createdAt) > dateTime(now()) - 60*60*24*7]),
      "activeClients": count(*[_type == "cabinet" && ${notDraft} && !(status in ["done", "keta_rejected"])]),
      "waitingAction": count(*[_type == "cabinet" && ${notDraft} && status in ["signed_uploaded", "keta_applying"]]),
      "newFeedback": count(*[_type == "feedback" && ${notDraft} && coalesce(status, "new") == "new"]),
      "latestLeads": *[_type == "lead" && ${notDraft}] | order(coalesce(createdAt, _createdAt) desc)[0...5]{
        _id, status, name, phone, serviceTitle, "createdAt": coalesce(createdAt, _createdAt)
      },
      "actionClients": *[_type == "cabinet" && ${notDraft} && status in ["signed_uploaded", "keta_applying"]] | order(_updatedAt desc)[0...8]{
        _id, _createdAt, service, status, clientName, clientPhone, "firstName": data.firstName, "lastName": data.lastName
      }
    }`
  );
}

export function getAdminUsers() {
  return writeClient().fetch<{ _id: string; login: string; name: string; role: string; createdAt?: string }[]>(
    `*[_type == "adminUser"] | order(createdAt asc){_id, login, name, role, createdAt}`
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

export const cabinetName = (c: { firstName?: string; lastName?: string; clientName?: string; data?: Record<string, string | undefined> }) =>
  [c.firstName ?? c.data?.firstName, c.lastName ?? c.data?.lastName].filter(Boolean).join(" ") || c.clientName || "Без имени";
