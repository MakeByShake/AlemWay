/**
 * Chat between a client and the AlemWay team (shared by client and server code — no server-only imports).
 * One chat per client. Replies are signed: the assistant (AI), a team member, or the site itself (events).
 */
import type { FileKind } from "@/lib/cabinet/fields";

export type ChatFrom = "client" | "ai" | "staff" | "system";
/** note — seen by the team only; event — a line from the site («Декларация готова»); file — an uploaded file. */
export type ChatKind = "text" | "note" | "event" | "file";
/** Who answers the client now: the assistant, or a person (the assistant stays silent until «Решено»). */
export type ChatMode = "ai" | "human";

export const CHAT_EVENTS = [
  "declaration_ready",
  "declaration_updated",
  "stage",
  "deadline",
  "deadline_removed",
  "zav",
  "keta",
  "called",
  "file_received",
  "signed_both",
  "ai_down",
  "resolved",
] as const;
export type ChatEvent = (typeof CHAT_EVENTS)[number];

export type ChatAttachment = { path: string; name: string; contentType: string; size: number };

/** A message as stored. */
export type ChatMessage = {
  _key: string;
  at: string;
  from: ChatFrom;
  kind: ChatKind;
  text: string;
  /** Team member who wrote it (login and the name shown to the client). */
  by?: string;
  byName?: string;
  /** A file sent in the chat that is not one of the client's documents. */
  file?: ChatAttachment;
  /** The client's document this message is about: an uploaded file, a request to upload, a ready declaration. */
  doc?: FileKind;
  /** Button under the message: download `doc`, upload it right from the chat, or open the cabinet. */
  action?: "download" | "upload" | "cabinet";
  /** Event code and its parameter — the text is shown in the reader's language. */
  event?: ChatEvent;
  arg?: string;
  /** Sent to many clients at once (id of the broadcast). */
  bulk?: string;
};

/** A message as the browser gets it: no storage paths. */
export type ChatMessageView = Omit<ChatMessage, "file"> & { file?: { name: string; contentType: string; size: number; url: string } };

export type ChatState = {
  mode: ChatMode;
  /** The client waits for a person. */
  waiting: boolean;
  waitingSince?: string;
  /** When the client / the team last opened the chat. */
  clientReadAt?: string;
  staffReadAt?: string;
  unreadStaff: number;
  unreadClient: number;
};

export const CHAT_TEXT_MAX = 1500;
export const STAFF_TEXT_MAX = 4000;
/** A client-made key of a message: sending the same message twice stores it once. */
export const isMessageKey = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{10,24}$/.test(v);
/** A fresh key for a message the browser is about to send. */
export const newMessageKey = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);

export const chatIdOf = (cabinetId: string) => `chats.${cabinetId.replace(/^cabinets\./, "")}`;
export const cabinetIdOfChat = (chatId: string) => `cabinets.${chatId.replace(/^chats\./, "")}`;
export const isCabinetId = (v: unknown): v is string => typeof v === "string" && /^cabinets\.[\w-]{1,80}$/.test(v);
