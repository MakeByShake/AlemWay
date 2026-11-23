import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { SanityClient } from "next-sanity";
import { apiVersion, dataset, isSanityConfigured, projectId } from "@/sanity/env";
import { serviceOf, type FileKind } from "@/lib/cabinet/fields";
import { writeClient, type Cabinet } from "@/lib/cabinet/server";
import { deleteFile } from "@/lib/cabinet/storage";
import { messageText, previewOf } from "./texts";
import { chatIdOf, type ChatAttachment, type ChatEvent, type ChatFrom, type ChatMessage, type ChatMessageView, type ChatState } from "./types";

/**
 * Chat storage. One private document per client: `chats.<uuid of the cabinet>` (the dot keeps it out of the
 * public API). Messages are an array inside it, so a hundred clients stay a hundred documents.
 *
 * Live updates: next to each chat lives a tiny public «signal» document with only a counter. Its id is an
 * HMAC of the cabinet id, so it says nothing about the client. Browsers listen to it (Sanity listen API)
 * and, when it changes, ask our API for the new messages. No message text ever goes through the public API.
 */

export type ChatDoc = ChatState & {
  _id: string;
  cabinet: string;
  lastAt?: string;
  lastText?: string;
  lastFrom?: ChatFrom;
  messages: ChatMessage[];
};

type Tx = ReturnType<SanityClient["transaction"]>;

export type ChatChange = {
  messages?: ChatMessage[];
  set?: Record<string, unknown>;
  unset?: string[];
  inc?: Record<string, number>;
  /** The team's chat list changes too (someone waits, was answered, a new message for a person). */
  inbox?: boolean;
};

// ---------- Live signals ----------

/** Target of the team's chat list signal. */
export const INBOX = "inbox";

function signalId(target: string): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return `chatsig-${createHmac("sha256", secret).update(`chat-signal:${target}`).digest("hex").slice(0, 32)}`;
}

/** Address the browser listens to for changes of one chat (pass the cabinet id) or of the team's list (INBOX). */
export function liveUrl(target: string): string | null {
  const id = signalId(target);
  if (!id || !isSanityConfigured) return null;
  // SANITY_API_HOST: local tests only (see src/sanity/client.ts).
  const host = process.env.SANITY_API_HOST || `https://${projectId}.api.sanity.io`;
  const q = new URLSearchParams({ query: "*[_id == $id]", $id: JSON.stringify(id), includeResult: "false", visibility: "query" });
  return `${host}/v${apiVersion}/data/listen/${dataset}?${q.toString()}`;
}

function bump(tx: Tx, target: string) {
  const id = signalId(target);
  if (!id) return;
  tx.createIfNotExists({ _id: id, _type: "chatSignal", n: 0 });
  tx.patch(id, (p) => p.inc({ n: 1 }));
}

// ---------- Reading and writing ----------

const CHAT_FIELDS = `_id, cabinet, mode, waiting, waitingSince, clientReadAt, staffReadAt, unreadStaff, unreadClient, lastAt, lastText, lastFrom, messages`;

export async function getChat(cabinetId: string): Promise<ChatDoc | null> {
  const doc = await writeClient().fetch<Partial<ChatDoc> | null>(`*[_id == $id][0]{${CHAT_FIELDS}}`, { id: chatIdOf(cabinetId) });
  if (!doc) return null;
  return {
    ...doc,
    _id: chatIdOf(cabinetId),
    cabinet: cabinetId,
    mode: doc.mode === "human" ? "human" : "ai",
    waiting: Boolean(doc.waiting),
    unreadStaff: doc.unreadStaff ?? 0,
    unreadClient: doc.unreadClient ?? 0,
    messages: doc.messages ?? [],
  };
}

/** Whether the chat already holds a message with this key. */
export async function hasMessage(cabinetId: string, key: string) {
  return writeClient().fetch<boolean>(`count(*[_id == $id && $key in messages[]._key]) > 0`, { id: chatIdOf(cabinetId), key });
}

export function newMessage(m: Omit<ChatMessage, "_key" | "at"> & { _key?: string; at?: string }): ChatMessage {
  return { ...m, _key: m._key ?? randomBytes(9).toString("hex"), at: m.at ?? new Date().toISOString() };
}

function addChange(tx: Tx, cabinetId: string, change: ChatChange, now: string) {
  const id = chatIdOf(cabinetId);
  // Every field the patch below touches exists from the start, so the order of patch operations never matters.
  tx.createIfNotExists({ _id: id, _type: "chat", cabinet: cabinetId, mode: "ai", waiting: false, unreadStaff: 0, unreadClient: 0, createdAt: now, messages: [] });
  const messages = change.messages ?? [];
  // The list of chats shows the last real message: events and team notes don't move a chat up.
  const last = [...messages].reverse().find((m) => m.kind !== "event" && m.kind !== "note");
  const set = { ...(last ? { lastAt: last.at, lastText: previewOf(last), lastFrom: last.from } : {}), ...change.set };
  tx.patch(id, (p) => {
    let q = p.setIfMissing({ messages: [], unreadStaff: 0, unreadClient: 0 });
    if (Object.keys(set).length) q = q.set(set);
    if (change.unset?.length) q = q.unset(change.unset);
    if (change.inc && Object.keys(change.inc).length) q = q.inc(change.inc);
    if (messages.length) q = q.insert("after", "messages[-1]", messages);
    return q;
  });
  bump(tx, cabinetId);
}

export async function writeChat(cabinetId: string, change: ChatChange) {
  const tx = writeClient().transaction();
  addChange(tx, cabinetId, change, new Date().toISOString());
  if (change.inbox) bump(tx, INBOX);
  await tx.commit();
}

/** What the browser gets: no storage paths; `fileUrl` is where this reader downloads an attachment. */
export function toView(m: ChatMessage, fileUrl: (m: ChatMessage) => string): ChatMessageView {
  const { file, ...rest } = m;
  return file ? { ...rest, file: { name: file.name, contentType: file.contentType, size: file.size, url: fileUrl(m) } } : rest;
}

/** Messages for the client: without the team's notes, logins and broadcast ids. */
export function clientMessages(messages: ChatMessage[]): ChatMessageView[] {
  return messages
    .filter((m) => m.kind !== "note")
    .map((m) => {
      const { by: _by, bulk: _bulk, ...rest } = toView(m, (x) => `/api/cabinet/chat/file?key=${encodeURIComponent(x._key)}`);
      void _by;
      void _bulk;
      return rest;
    });
}

/** A file name safe to show and to download with: no folders or odd characters; the extension follows the real type. */
export function attachmentName(original: string | undefined, ext: string) {
  const base = (original ?? "")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${base || "file"}.${ext}`;
}

// ---------- What happens in a chat ----------

/** The assistant answers Ferienjob questions only (its knowledge is the declaration and its documents). */
export const aiAvailable = (cab: Pick<Cabinet, "service">) => serviceOf(cab.service) === "ferienjob" && Boolean(process.env.ANTHROPIC_API_KEY);

/** A client's message that a person has to answer: the chat goes to «Ждут ответа». */
const forPerson = (chat: Pick<ChatDoc, "waiting" | "waitingSince"> | null, at: string): ChatChange => ({
  set: { mode: "human", waiting: true, ...(chat?.waiting && chat.waitingSince ? {} : { waitingSince: at }) },
  inc: { unreadStaff: 1 },
  inbox: true,
});

/**
 * Stores the client's message. `ai` tells whether the assistant should answer it now:
 * only while no person has taken the chat over (mode «ai»).
 */
export async function postClientMessage(cab: Cabinet, text: string, key?: string) {
  const chat = await getChat(cab._id);
  if (key && chat?.messages.some((m) => m._key === key)) return { duplicate: true as const, ai: false, history: chat.messages };
  const ai = aiAvailable(cab) && (chat?.mode ?? "ai") === "ai";
  const message = newMessage({ from: "client", kind: "text", text, ...(key ? { _key: key } : {}) });
  await writeChat(cab._id, { messages: [message], ...(ai ? {} : forPerson(chat, message.at)) });
  return { duplicate: false as const, ai, history: [...(chat?.messages ?? []), message] };
}

/** Stores the assistant's answer. `handoff` — the assistant passed the question to a person. */
export async function postAiReply(cabinetId: string, text: string, handoff: boolean, key?: string) {
  const message = newMessage({ from: "ai", kind: "text", text, ...(key ? { _key: key } : {}) });
  await writeChat(cabinetId, { messages: [message], ...(handoff ? forPerson(null, message.at) : {}) });
}

/** A line from the site in the client's chat. For the client it counts as a new message. */
export async function postEvent(
  cabinetId: string,
  event: ChatEvent,
  opts: { arg?: string; doc?: FileKind; action?: ChatMessage["action"]; by?: string; byName?: string; change?: ChatChange; silent?: boolean } = {}
) {
  const { change, silent, ...rest } = opts;
  const message = newMessage({ from: "system", kind: "event", event, text: messageText({ text: "", event, arg: rest.arg }, "ru"), ...rest });
  await writeChat(cabinetId, {
    ...change,
    messages: [message],
    inc: { ...(silent ? {} : { unreadClient: 1 }), ...change?.inc },
  });
}

/** Same as postEvent, but never throws: an event in the chat must not break the action that caused it. */
export async function chatEvent(cabinetId: string, event: ChatEvent, opts: Parameters<typeof postEvent>[2] = {}) {
  try {
    await postEvent(cabinetId, event, opts);
  } catch (err) {
    console.error("[chat] event failed", event, err);
  }
}

/**
 * The declaration was made or replaced: the client gets it in the chat with a «Скачать» button.
 * `before` — the cabinet as it was. Once the case has moved past the dean's stamp, a rebuilt declaration is the team's business.
 */
export async function declarationEvent(before: Pick<Cabinet, "_id" | "status" | "files">) {
  const opts = { doc: "declaration" as const, action: "download" as const };
  if (!before.files?.declaration?.path) return chatEvent(before._id, "declaration_ready", opts);
  if (!before.status || before.status === "waiting_data" || before.status === "declaration_ready") return chatEvent(before._id, "declaration_updated", opts);
}

/** The assistant could not answer: the question goes to a person. */
export const aiFailed = (cabinetId: string) => postEvent(cabinetId, "ai_down", { silent: true, change: forPerson(null, new Date().toISOString()) });

/** «Позвать куратора». */
export async function callCurator(cab: Cabinet) {
  const chat = await getChat(cab._id);
  if (chat?.waiting) return;
  await postEvent(cab._id, "called", { silent: true, change: forPerson(chat, new Date().toISOString()) });
}

/**
 * The client sent a file. A document (`doc`) is already saved in the cabinet; anything else (`file`) is kept
 * with the chat and always needs a person to look at it.
 */
export async function postClientFile(cab: Cabinet, input: { doc?: FileKind; file?: ChatAttachment; text?: string }) {
  const chat = await getChat(cab._id);
  const message = newMessage({ from: "client", kind: "file", text: input.text ?? "", ...(input.doc ? { doc: input.doc } : {}), ...(input.file ? { file: input.file } : {}) });
  const person = (chat?.mode ?? "ai") === "human" || !input.doc || !aiAvailable(cab);
  const told = person && (chat?.mode ?? "ai") === "ai" && !chat?.waiting;
  await writeChat(cab._id, {
    messages: [message, ...(told ? [newMessage({ from: "system", kind: "event", event: "file_received", text: messageText({ text: "", event: "file_received" }, "ru") })] : [])],
    ...(person ? forPerson(chat, message.at) : {}),
  });
  return message;
}

export type Staff = { login: string; name: string };

/**
 * A team member writes to the client: from now on a person answers, the assistant stays silent until «Решено».
 * `note` — a note for the team only: the client never gets it and nothing else changes.
 */
export async function postStaffMessage(cabinetId: string, who: Staff, input: { text: string; note?: boolean; doc?: FileKind; file?: ChatAttachment; key?: string }) {
  // The browser names the message, so pressing «Отправить» twice (or a retry after a lost answer) stores it once.
  if (input.key && (await hasMessage(cabinetId, input.key))) return null;
  const base = { from: "staff" as const, text: input.text, by: who.login, byName: who.name, ...(input.key ? { _key: input.key } : {}) };
  if (input.note) {
    const note = newMessage({ ...base, kind: "note" });
    await writeChat(cabinetId, { messages: [note] });
    return note;
  }
  const message = newMessage({
    ...base,
    kind: input.file ? "file" : "text",
    ...(input.doc ? { doc: input.doc, action: "upload" as const } : {}),
    ...(input.file ? { file: input.file } : {}),
  });
  await writeChat(cabinetId, {
    messages: [message],
    set: { mode: "human", waiting: false, unreadStaff: 0, staffReadAt: message.at },
    unset: ["waitingSince"],
    inc: { unreadClient: 1 },
    inbox: true,
  });
  return message;
}

/** «Решено»: the question is closed, the assistant answers again. */
export async function resolveChat(cabinetId: string, who: Staff) {
  await postEvent(cabinetId, "resolved", {
    silent: true,
    by: who.login,
    byName: who.name,
    change: { set: { mode: "ai", waiting: false, unreadStaff: 0, staffReadAt: new Date().toISOString() }, unset: ["waitingSince"], inbox: true },
  });
}

/** The reader opened the chat: their counter of new messages goes to zero. */
export async function markRead(cabinetId: string, side: "client" | "staff") {
  const now = new Date().toISOString();
  await writeChat(
    cabinetId,
    side === "client" ? { set: { clientReadAt: now, unreadClient: 0 } } : { set: { staffReadAt: now, unreadStaff: 0 }, inbox: true }
  );
}

// ---------- One message to many clients ----------

export const newBroadcastId = () => `broadcasts.${randomUUID()}`;

/**
 * Sends the same text into each client's own chat. Started only by a team member, by hand.
 * It does not take the chats over: the assistant keeps answering questions about documents.
 */
export async function sendBroadcast(who: Staff, cabinetIds: string[], text: string, filter: string) {
  const c = writeClient();
  const id = newBroadcastId();
  const at = new Date().toISOString();
  await c.create({ _id: id, _type: "chatBroadcast", at, by: who.login, byName: who.name, text, filter, recipients: cabinetIds });
  for (let i = 0; i < cabinetIds.length; i += 40) {
    const tx = c.transaction();
    for (const cab of cabinetIds.slice(i, i + 40)) {
      addChange(tx, cab, { messages: [newMessage({ from: "staff", kind: "text", text, by: who.login, byName: who.name, bulk: id, at })], inc: { unreadClient: 1 } }, at);
    }
    if (i + 40 >= cabinetIds.length) bump(tx, INBOX);
    await tx.commit();
  }
  return id;
}

// ---------- Deleting a client ----------

/** Removes the chat of a deleted client: its attachments, the document and its signal. */
export async function deleteChatOf(cabinetId: string) {
  const chat = await getChat(cabinetId);
  for (const m of chat?.messages ?? []) if (m.file?.path) await deleteFile(m.file.path);
  const tx = writeClient().transaction().delete(chatIdOf(cabinetId));
  const signal = signalId(cabinetId);
  if (signal) tx.delete(signal);
  // The team's list of chats loses a row.
  if (chat) bump(tx, INBOX);
  await tx.commit();
}
