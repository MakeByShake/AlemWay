import { pushStatusOf } from "@/lib/push/server";
import "server-only";
import type { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, isFullRole, verifySession } from "@/lib/admin/session";
import { cabinetName, getCabinetFull, getCompanions } from "@/lib/admin/data";
import { clientProgress } from "@/components/admin/bits";
import { CABINET_STATUSES, SERVICE_FILES, SERVICE_TITLES, UPLOAD_KINDS, serviceOf, type FileKind, type UploadKind } from "@/lib/cabinet/fields";
import { paymentTotals } from "@/lib/cabinet/payments";
import { writeClient } from "@/lib/cabinet/server";
import { FILE_SHORT } from "./texts";
import type { ChatFrom, ChatMode } from "./types";

/** The team's side of the chats: who may see and write, the list of chats, the client's profile. */

export type ChatStaff = {
  login: string;
  name: string;
  /** Owner and managers see every chat and write; «Отдел продаж» only reads the chats of its own clients. */
  full: boolean;
};

/** The logged-in /admin user of this request. Writes must come from our own pages (CSRF). */
export async function chatStaff(req: NextRequest, write = false): Promise<ChatStaff | null> {
  if (write && !isSameOrigin(req)) return null;
  try {
    const user = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value);
    return user ? { login: user.login, name: user.name, full: isFullRole(user.role) } : null;
  } catch (err) {
    console.error("[chat] session check failed", err);
    return null;
  }
}

export const canSeeChat = (me: ChatStaff, cab: { manager?: string | null; seller?: string | null }) => me.full || cab.manager === me.login || cab.seller === me.login;

const notDraft = `!(_id in path("drafts.**"))`;
/** Cabinets this person may see / leads. */
const SEEN = `*[_type == "cabinet" && ${notDraft} && (manager == $login || seller == $login)]._id`;
const scope = (me: ChatStaff) => (me.full ? "true" : `cabinet in ${SEEN}`);
const mineScope = (me: ChatStaff) => (me.full ? `cabinet in *[_type == "cabinet" && ${notDraft} && manager == $login]._id` : `cabinet in ${SEEN}`);

export type ChatTab = "waiting" | "mine" | "all";

export type ChatRow = {
  cabinet: string;
  number?: number;
  name: string;
  status?: string;
  service?: string;
  managerName?: string;
  mine: boolean;
  mode: ChatMode;
  waiting: boolean;
  waitingSince?: string;
  lastAt?: string;
  lastText?: string;
  lastFrom?: ChatFrom;
  unread: number;
};

type CabinetBit = { _id?: string; number?: number; clientName?: string; firstName?: string; lastName?: string; manager?: string; managerName?: string; seller?: string; status?: string; service?: string };
type ChatBit = { cabinet?: string; mode?: string; waiting?: boolean; waitingSince?: string; lastAt?: string; lastText?: string; lastFrom?: ChatFrom; unread?: number };

const CAB_BIT = `{_id, number, clientName, "firstName": data.firstName, "lastName": data.lastName, manager, managerName, seller, status, service}`;
const CHAT_BIT = `cabinet, mode, waiting, waitingSince, lastAt, lastText, lastFrom, "unread": coalesce(unreadStaff, 0)`;

function row(me: ChatStaff, c: CabinetBit, chat: ChatBit | null | undefined): ChatRow {
  return {
    cabinet: c._id ?? chat?.cabinet ?? "",
    number: c.number,
    name: cabinetName(c),
    status: c.status,
    service: c.service,
    managerName: c.managerName,
    mine: c.manager === me.login || (!me.full && c.seller === me.login),
    mode: chat?.mode === "human" ? "human" : "ai",
    waiting: Boolean(chat?.waiting),
    waitingSince: chat?.waitingSince,
    lastAt: chat?.lastAt,
    lastText: chat?.lastText,
    lastFrom: chat?.lastFrom,
    unread: chat?.unread ?? 0,
  };
}

/** How many clients wait for a person (the number on «Чаты»), and how many of them are mine. */
export async function chatCounts(me: ChatStaff) {
  return writeClient().fetch<{ waiting: number; mine: number }>(
    `{
      "waiting": count(*[_type == "chat" && waiting == true && ${scope(me)}]),
      "mine": count(*[_type == "chat" && waiting == true && ${mineScope(me)}])
    }`,
    { login: me.login }
  );
}

/**
 * Chats for the list. «Ждут ответа» — who waits longest comes first; the other tabs — the latest message first.
 * With a search text: clients by name, phone or number, also the ones nobody has written to yet.
 */
export async function listChats(me: ChatStaff, opts: { tab: ChatTab; q?: string }): Promise<ChatRow[]> {
  const c = writeClient();
  const q = opts.q?.trim().replace(/[*"\\]/g, "") ?? "";
  if (q) {
    const found = await c.fetch<(CabinetBit & { chat: ChatBit | null })[]>(
      `*[_type == "cabinet" && ${notDraft} && ${me.full ? "true" : "(manager == $login || seller == $login)"}
         && (string(number) == $num || clientName match $q || clientPhone match $q || contacts[].phone match $q || data.firstName match $q || data.lastName match $q || data.phone match $q)
       ] | order(coalesce(number, 0) desc)[0...40]{
        _id, number, clientName, "firstName": data.firstName, "lastName": data.lastName, manager, managerName, seller, status, service,
        "chat": *[_type == "chat" && cabinet == ^._id][0]{${CHAT_BIT}}
      }`,
      { login: me.login, q: `*${q}*`, num: q.replace(/^№\s*/, "") }
    );
    return found.map((f) => row(me, f, f.chat));
  }
  const filter = opts.tab === "waiting" ? "waiting == true" : opts.tab === "mine" ? `defined(lastAt) && ${mineScope(me)}` : "defined(lastAt)";
  const order = opts.tab === "waiting" ? "coalesce(waitingSince, lastAt) asc" : "lastAt desc";
  const found = await c.fetch<(ChatBit & { c: CabinetBit | null })[]>(
    `*[_type == "chat" && ${filter} && ${scope(me)}] | order(${order})[0...200]{
      ${CHAT_BIT},
      "c": *[_id == ^.cabinet][0]${CAB_BIT}
    }`,
    { login: me.login }
  );
  // A chat whose client was deleted meanwhile is skipped.
  return found.filter((f) => f.c?._id).map((f) => row(me, f.c!, f));
}

// ---------- Profile of the client (the panel next to the chat) ----------

export type ProfileFile = {
  kind: FileKind;
  label: string;
  /** ok — uploaded; none — not yet; warn — the dean's office refuses to sign it. */
  state: "ok" | "none" | "warn";
  uploadedAt?: string;
  /** The client can upload this document themself now, so the team may ask for it in the chat. */
  canAsk: boolean;
};

export type ChatProfile = {
  id: string;
  number?: number;
  name: string;
  serviceTitle: string;
  status: string;
  stage: { step: number; total: number; label: string; tone: string };
  managerName?: string;
  sellerName?: string;
  deadline: { date: string; state: "open" | "overdue" | "done"; days: number } | null;
  /** `digits` — the number in international form without «+», for tel: and WhatsApp links. */
  phones: { label: string; phone: string; digits: string }[];
  facts: { label: string; value: string }[];
  companions: { id: string; number?: number; name: string }[];
  files: ProfileFile[];
  fileCount: number;
  ai: { status: string; missing: string[] } | null;
  dean: string | null;
  money: { price: number; paid: number; remaining: number; pending: number; overdue: number } | null;
};

const niceDate = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join(".") : "");

/** Everything the team wants to see about the client without leaving the chat. No links, keys or storage paths. */
export async function chatProfile(cabinetId: string, me: ChatStaff): Promise<ChatProfile | null> {
  const cab = await getCabinetFull(cabinetId);
  if (!cab || !canSeeChat(me, cab)) return null;
  const [companions, push] = await Promise.all([getCompanions(cab.party, cabinetId), pushStatusOf(cabinetId)]);
  const service = serviceOf(cab.service);
  const status = cab.status ?? "waiting_data";
  const p = clientProgress(service, status);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
  const d = cab.data ?? {};
  const dean = cab.deanIssue && !cab.deanIssue.resolvedAt ? cab.deanIssue : null;

  const phones: ChatProfile["phones"] = [];
  const seen = new Set<string>();
  const addPhone = (label: string, phone?: string) => {
    const digits = (phone ?? "").replace(/\D/g, "").replace(/^8(\d{10})$/, "7$1");
    if (digits.length < 11 || seen.has(digits)) return;
    seen.add(digits);
    phones.push({ label, phone: phone!.trim(), digits });
  };
  addPhone("Клиент", cab.clientPhone);
  addPhone("Клиент (из анкеты)", d.phone);
  for (const c of cab.contacts ?? []) addPhone(c.label || "Ещё номер", c.phone);

  const licence = d.licenseStatus === "yes" || cab.files?.license?.path ? `есть${d.driverLicense ? `, категория ${d.driverLicense}` : ""}` : d.licenseStatus === "soon" ? `получает${d.licenseReady ? `, ${d.licenseReady}` : ""}` : "";
  const work = [cab.workPosition, cab.workCity].filter(Boolean).join(", ");
  const workDates = cab.workFrom || cab.workTo ? `${niceDate(cab.workFrom) || "…"} – ${niceDate(cab.workTo) || "…"}` : "";
  const facts = [
    { label: "Вуз", value: d.uniName || cab.aiCheck?.fields?.txtfDritteName || "" },
    { label: "Специальность", value: d.subject || cab.aiCheck?.fields?.txtfStudiumFach || "" },
    { label: "Город", value: d.city ?? "" },
    { label: "Права", value: licence },
    { label: "Работодатель", value: [cab.employerName, work].filter(Boolean).join(" · ") },
    { label: "Даты работы", value: workDates },
    { label: "Уведомления", value: push },
  ].filter((f) => f.value);

  const askable = new Set<UploadKind>(SERVICE_FILES[service].client);
  const files: ProfileFile[] = SERVICE_FILES[service].all.map((kind) => {
    const f = cab.files?.[kind];
    const signedKind = kind === "signed" || kind === "signed2";
    return {
      kind,
      label: FILE_SHORT[kind].ru,
      state: f?.path ? "ok" : dean && signedKind ? "warn" : "none",
      uploadedAt: f?.path ? f.uploadedAt : undefined,
      canAsk: !f?.path && (UPLOAD_KINDS as readonly string[]).includes(kind) && askable.has(kind as UploadKind),
    };
  });

  const money = paymentTotals(cab.price, cab.payments, { discount: cab.discount, plan: cab.plan, today });
  const open = ["waiting_data", "declaration_ready"].includes(status);
  return {
    id: cabinetId,
    number: cab.number,
    name: cabinetName(cab),
    serviceTitle: SERVICE_TITLES[service].ru,
    status: CABINET_STATUSES.find((s) => s.value === status)?.title ?? status,
    stage: { step: p.step, total: p.total, label: p.label, tone: p.tone },
    managerName: cab.managerName,
    sellerName: cab.sellerName,
    deadline: cab.deadline
      ? { date: niceDate(cab.deadline), state: !open ? "done" : cab.deadline < today ? "overdue" : "open", days: Math.round((Date.parse(cab.deadline) - Date.parse(today)) / 86_400_000) }
      : null,
    phones,
    facts,
    companions: companions.map((c) => ({ id: c._id, number: c.number, name: cabinetName(c) })),
    files,
    fileCount: files.filter((f) => f.state === "ok").length,
    ai: cab.aiCheck && cab.aiCheck.status === "НЕ ГОТОВО" ? { status: cab.aiCheck.status, missing: cab.aiCheck.missing ?? [] } : null,
    dean: dean ? [dean.reason, dean.faculty].filter(Boolean).join(" · ") || "Деканат не ставит печать" : null,
    money: money.hasPrice ? { price: money.price, paid: money.paid, remaining: money.remaining, pending: money.pending, overdue: money.overdue } : null,
  };
}

// ---------- One message to many: who gets it ----------

export type BroadcastFilter = {
  /** Stage (status value) or "" for any. */
  status?: string;
  /** Only the clients who have not uploaded this document. */
  missing?: string;
  /** Only the clients I lead. */
  mine?: boolean;
  /** Friends who travel together: the group of this client. */
  partyOf?: string;
  service?: string;
};

export type Recipient = { id: string; number?: number; name: string; status?: string };

/** Clients that match the filter. Sold-for-Baybol and finished clients are never included. */
export async function broadcastRecipients(me: ChatStaff, f: BroadcastFilter): Promise<Recipient[]> {
  const c = writeClient();
  const party = f.partyOf ? await c.fetch<string | null>(`*[_id == $id][0].party`, { id: f.partyOf }) : null;
  if (f.partyOf && !party) {
    // No group: just this client.
    const one = await c.fetch<CabinetBit | null>(`*[_id == $id && _type == "cabinet"][0]${CAB_BIT}`, { id: f.partyOf });
    return one?._id ? [{ id: one._id, number: one.number, name: cabinetName(one), status: one.status }] : [];
  }
  const missing = f.missing && /^[a-z0-9]+$/.test(f.missing) ? f.missing : "";
  const rows = await c.fetch<CabinetBit[]>(
    `*[_type == "cabinet" && ${notDraft} && coalesce(group, "new") != "baybol"
       && (defined($party) || !(coalesce(status, "waiting_data") in ["done", "keta_rejected"]))
       && (!defined($party) || party == $party)
       && (!defined($status) || coalesce(status, "waiting_data") == $status)
       && (!defined($service) || coalesce(service, "ferienjob") == $service)
       && (!$mine || manager == $login)
       ${missing ? `&& !defined(files.${missing}.path)` : ""}
     ] | order(coalesce(number, 0) asc)[0...500]${CAB_BIT}`,
    { party, status: f.status || null, service: f.service || null, mine: Boolean(f.mine), login: me.login }
  );
  return rows.filter((r) => r._id).map((r) => ({ id: r._id!, number: r.number, name: cabinetName(r), status: r.status }));
}

export type BroadcastRow = { id: string; at: string; byName?: string; text: string; filter?: string; total: number; read: number; unread: { id: string; number?: number; name: string }[] };

/** Sent broadcasts with the read report: who has opened their chat since. */
export async function listBroadcasts(): Promise<BroadcastRow[]> {
  const rows = await writeClient().fetch<
    { _id: string; at: string; byName?: string; text: string; filter?: string; recipients?: string[]; readIds: string[]; people: CabinetBit[] }[]
  >(
    `*[_type == "chatBroadcast"] | order(at desc)[0...20]{
      _id, at, byName, text, filter, recipients,
      "readIds": *[_type == "chat" && cabinet in ^.recipients && clientReadAt >= ^.at].cabinet,
      "people": *[_type == "cabinet" && _id in ^.recipients]${CAB_BIT}
    }`
  );
  return rows.map((b) => {
    const read = new Set(b.readIds ?? []);
    const people = (b.people ?? []).filter((p) => p._id);
    return {
      id: b._id,
      at: b.at,
      byName: b.byName,
      text: b.text,
      filter: b.filter,
      total: b.recipients?.length ?? 0,
      read: people.filter((p) => read.has(p._id!)).length,
      unread: people.filter((p) => !read.has(p._id!)).map((p) => ({ id: p._id!, number: p.number, name: cabinetName(p) })),
    };
  });
}
