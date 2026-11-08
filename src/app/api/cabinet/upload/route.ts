import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { SERVICE_FILES, UPLOAD_KINDS, serviceOf, type UploadKind } from "@/lib/cabinet/fields";
import { cabinetAdminUrl, currentCabinet, displayName, patchCabinet } from "@/lib/cabinet/server";
import { readUpload, storeCabinetFile } from "@/lib/cabinet/uploads";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** Client uploads: passport and certificate while filling in, then the signed declaration. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);

  const service = serviceOf(cab.service);
  const kind = req.nextUrl.searchParams.get("kind") as UploadKind | null;
  if (!kind || !UPLOAD_KINDS.includes(kind) || !SERVICE_FILES[service].client.includes(kind)) return fail("bad_kind");

  const status = cab.status ?? "waiting_data";
  if (service === "keta") {
    if (status !== "waiting_data") return fail("locked", 409);
  } else if (kind === "signed") {
    // Signed scan: after the declaration exists, and can be replaced until ZAV arrives.
    if (!cab.files?.declaration?.path) return fail("no_declaration", 409);
    if (status !== "declaration_ready" && status !== "signed_uploaded") return fail("locked", 409);
  } else if (status !== "waiting_data" && status !== "declaration_ready") {
    return fail("locked", 409);
  }

  const up = await readUpload(req);
  if (!up.ok) return fail(up.error, up.status);
  const { file, cleanup } = await storeCabinetFile(cab, kind, up);

  const set: Record<string, unknown> = { [`files.${kind}`]: file };
  if (kind === "signed") Object.assign(set, { status: "signed_uploaded", signedAt: file.uploadedAt });
  await patchCabinet(cab._id, set);
  await cleanup();

  if (kind === "signed") {
    await sendTelegram([
      "<b>✅ Клиент закончил: подписанная декларация загружена</b>",
      "",
      `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
      "Деканат поставил подпись и печать. Со стороны клиента всё готово — можно передавать документы работодателю.",
      "",
      `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть кабинет в админке</a>`,
    ]);
  }

  return NextResponse.json({ ok: true, file: { name: file.name, size: file.size, uploadedAt: file.uploadedAt } });
}
