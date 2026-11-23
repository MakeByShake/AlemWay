import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { adminError } from "@/lib/admin-auth";
import { getCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";
import { saveFile } from "@/lib/cabinet/storage";
import { readUploadForm } from "@/lib/cabinet/uploads";
import { canSeeChat, chatStaff } from "@/lib/chat/admin";
import { attachmentName, getChat, hasMessage, postStaffMessage } from "@/lib/chat/server";
import { STAFF_TEXT_MAX, isCabinetId, isMessageKey } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  too_large: "Файл больше 4 МБ — сожмите его.",
  bad_type: "Подойдёт только PDF, JPG или PNG.",
  no_file: "Файл не выбран.",
  bad_request: "Не удалось прочитать файл.",
};

/** A team member sends the client a file in the chat (a memo, a filled form, a photo). */
export async function POST(req: NextRequest) {
  const me = await chatStaff(req, true);
  if (!me) return adminError("Нет доступа. Войдите в админку заново.", 401);
  if (!me.full) return adminError("Отдел продаж может только читать чаты своих клиентов.", 403);
  const id = req.nextUrl.searchParams.get("id");
  if (!isCabinetId(id)) return adminError("Некорректный запрос");
  if (!(await getCabinet(id))) return adminError("Клиент не найден", 404);

  const { form, upload } = await readUploadForm(req);
  if (!upload) return adminError(ERRORS.no_file);
  if (!upload.ok) return adminError(ERRORS[upload.error] ?? "Ошибка загрузки", upload.status);
  const picked = form?.get("file");
  const caption = form?.get("text");
  const key = form?.get("key");
  // The same file sent twice (a retry after a lost answer) is stored once.
  if (isMessageKey(key) && (await hasMessage(id, key))) return NextResponse.json({ ok: true });
  const path = await saveFile(`${id}/chat-${randomUUID()}.${upload.ext}`, upload.buf, upload.type);
  await postStaffMessage(id, me, {
    text: typeof caption === "string" ? caption.trim().slice(0, STAFF_TEXT_MAX) : "",
    file: { path, name: attachmentName(picked instanceof File ? picked.name : undefined, upload.ext), contentType: upload.type, size: upload.buf.length },
    key: isMessageKey(key) ? key : undefined,
  });
  return NextResponse.json({ ok: true });
}

/** The team opens or downloads a file that was sent in a chat. */
export async function GET(req: NextRequest) {
  const me = await chatStaff(req);
  if (!me) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!isCabinetId(id)) return adminError("Некорректный запрос");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Клиент не найден", 404);
  if (!canSeeChat(me, cab)) return adminError("Этот клиент закреплён за другим сотрудником", 403);
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const m = (await getChat(id))?.messages.find((x) => x._key === key);
  if (!m?.file) return adminError("Файл не найден", 404);
  return fileResponse({ ...m.file, uploadedAt: m.at }, { inline: req.nextUrl.searchParams.get("view") === "1" });
}
