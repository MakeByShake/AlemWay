import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { MANAGER_UPLOAD_KINDS, type CabinetStatus, type ManagerUploadKind } from "@/lib/cabinet/fields";
import { cabinetAdminUrl, displayName, getCabinet, patchCabinet } from "@/lib/cabinet/server";
import { readUpload, storeCabinetFile } from "@/lib/cabinet/uploads";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER: CabinetStatus[] = ["waiting_data", "declaration_ready", "signed_uploaded", "zav_received", "done"];
/** Moves the status forward to `target`, never backwards. */
const atLeast = (current: CabinetStatus | undefined, target: CabinetStatus) =>
  ORDER.indexOf(current ?? "waiting_data") >= ORDER.indexOf(target) ? current! : target;

const ERRORS: Record<string, string> = {
  too_large: "Файл больше 4 МБ — сожмите его.",
  bad_type: "Подойдёт только PDF, JPG или PNG.",
  no_file: "Файл не выбран.",
  bad_request: "Не удалось прочитать файл.",
};

/**
 * Manager uploads a file into a client's cabinet from the Studio:
 * ZAV (moves the cabinet to «ZAV получен — контракт есть»), or a replacement for any client file.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = (req.nextUrl.searchParams.get("id") ?? "").replace(/^drafts\./, "");
  const kind = req.nextUrl.searchParams.get("kind") as ManagerUploadKind;
  if (!id.startsWith("cabinets.") || !MANAGER_UPLOAD_KINDS.includes(kind)) return adminError("Некорректный запрос");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Кабинет не найден", 404);

  const up = await readUpload(req);
  if (!up.ok) return adminError(ERRORS[up.error] ?? "Ошибка загрузки", up.status);
  const { file, cleanup } = await storeCabinetFile(cab, kind, up);

  const surname = (cab.data?.lastName ?? "client").replace(/[^A-Za-z0-9-]/g, "") || "client";
  if (kind === "zav") file.name = `ZAV-${surname}.${up.ext}`;
  if (kind === "declaration") file.name = `ZAV-Declaration-${surname}.${up.ext}`;

  const set: Record<string, unknown> = { [`files.${kind}`]: file };
  if (kind === "zav") Object.assign(set, { status: atLeast(cab.status, "zav_received"), zavReceivedAt: file.uploadedAt });
  if (kind === "declaration") set.status = atLeast(cab.status, "declaration_ready");
  if (kind === "signed") Object.assign(set, { status: atLeast(cab.status, "signed_uploaded"), signedAt: file.uploadedAt });
  await patchCabinet(id, set);
  await cleanup();

  if (kind === "zav") {
    await sendTelegram([
      "<b>🎉 ZAV загружен — контракт есть</b>",
      "",
      `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
      "Клиент увидит ZAV и данные о работе в своём кабинете.",
      "",
      `📋 <a href="${cabinetAdminUrl(id)}">Открыть кабинет в админке</a>`,
    ]);
  }
  return NextResponse.json({ ok: true, status: set.status ?? cab.status });
}
