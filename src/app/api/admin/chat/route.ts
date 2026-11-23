import { NextResponse, type NextRequest } from "next/server";
import { readJsonObject } from "@/lib/http";
import { adminError } from "@/lib/admin-auth";
import { FILE_KINDS, SERVICE_FILES, UPLOAD_KINDS, serviceOf, type UploadKind } from "@/lib/cabinet/fields";
import { cabinetName } from "@/lib/admin/data";
import { getCabinet } from "@/lib/cabinet/server";
import { canSeeChat, chatProfile, chatStaff } from "@/lib/chat/admin";
import { aiAvailable, getChat, liveUrl, postStaffMessage, toView } from "@/lib/chat/server";
import { fileAskName } from "@/lib/chat/texts";
import { STAFF_TEXT_MAX, isCabinetId, isMessageKey } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_LOGIN = () => adminError("Нет доступа. Войдите в админку заново.", 401);

/** One chat for the team: messages (with the team's notes), who answers now, optionally the client's profile. */
export async function GET(req: NextRequest) {
  const me = await chatStaff(req);
  if (!me) return NO_LOGIN();
  const id = req.nextUrl.searchParams.get("id");
  if (!isCabinetId(id)) return adminError("Некорректный запрос");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Клиент не найден", 404);
  if (!canSeeChat(me, cab)) return adminError("Этот клиент закреплён за другим сотрудником", 403);

  const after = req.nextUrl.searchParams.get("after");
  const [chat, profile] = await Promise.all([getChat(id), req.nextUrl.searchParams.get("profile") === "1" ? chatProfile(id, me) : null]);
  const all = chat?.messages ?? [];
  const fileUrl = (key: string) => `/api/admin/chat/file?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`;
  return NextResponse.json(
    {
      ok: true,
      client: { name: cabinetName(cab), number: cab.number ?? null, managerName: cab.managerName ?? null, service: serviceOf(cab.service) },
      /** Whether the assistant (AI) answers this client at all. */
      assistant: aiAvailable(cab),
      mode: chat?.mode ?? "ai",
      waiting: Boolean(chat?.waiting),
      waitingSince: chat?.waitingSince ?? null,
      clientReadAt: chat?.clientReadAt ?? null,
      unread: chat?.unreadStaff ?? 0,
      messages: (after && after.length < 40 ? all.filter((m) => m.at >= after) : all.slice(-400)).map((m) => toView(m, (x) => fileUrl(x._key))),
      /** Documents that are in the cabinet now (for the buttons under messages). */
      have: FILE_KINDS.filter((k) => cab.files?.[k]?.path),
      canWrite: me.full,
      live: liveUrl(id),
      ...(profile ? { profile } : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * A team member writes to the client. `note: true` — a note for the team only.
 * `doc` — «Попросить у клиента»: the message gets an upload button for that document.
 */
export async function POST(req: NextRequest) {
  const me = await chatStaff(req, true);
  if (!me) return NO_LOGIN();
  if (!me.full) return adminError("Отдел продаж может только читать чаты своих клиентов.", 403);
  const body = await readJsonObject(req, 32 * 1024);
  const id = body?.id;
  if (!isCabinetId(id)) return adminError("Некорректный запрос");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Клиент не найден", 404);

  const note = body?.note === true;
  let text = typeof body?.text === "string" ? body.text.trim().slice(0, STAFF_TEXT_MAX) : "";
  let doc: UploadKind | undefined;
  if (!note && typeof body?.doc === "string") {
    const kind = body.doc as UploadKind;
    if (!UPLOAD_KINDS.includes(kind) || !SERVICE_FILES[serviceOf(cab.service)].client.includes(kind)) return adminError("Этот документ клиент не загружает сам");
    doc = kind;
    const name = fileAskName(kind);
    if (!text) text = `Пожалуйста, загрузите документ: ${name.charAt(0).toLowerCase()}${name.slice(1)}. Это можно сделать прямо здесь, кнопкой ниже.`;
  }
  if (!text) return adminError("Напишите сообщение");
  await postStaffMessage(id, me, { text, note, doc, key: isMessageKey(body?.key) ? body.key : undefined });
  return NextResponse.json({ ok: true });
}
