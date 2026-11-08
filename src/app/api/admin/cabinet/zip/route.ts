import { type NextRequest } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getCabinet, displayName } from "@/lib/cabinet/server";
import { readFile } from "@/lib/cabinet/storage";
import { FERIENJOB_FULL_SECTIONS, FILE_KINDS, KETA_SECTIONS, serviceOf } from "@/lib/cabinet/fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function bytes(body: ReadableStream | Buffer): Promise<Uint8Array> {
  if (Buffer.isBuffer(body)) return new Uint8Array(body);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

// Latin file names inside the archive: Cyrillic names break in some unzip programs.
const ZIP_NAMES: Record<string, string> = {
  passport: "passport",
  enrollment: "spravka",
  calendar: "kalendar-vuza",
  declaration: "deklaraciya",
  signed: "deklaraciya-podpisannaya",
  zav: "ZAV",
  photo: "foto",
  keta: "K-ETA",
};

const safe = (s: string) => s.replace(/[^\w.\-а-яА-ЯёЁ ]/g, "_").trim() || "file";

/** Manager downloads everything of a client in one ZIP: all files + a text file with the questionnaire. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return adminError("Клиент не найден", 404);

  const files: Record<string, Uint8Array> = {};
  for (const kind of FILE_KINDS) {
    const f = cab.files?.[kind];
    if (!f?.path) continue;
    const found = await readFile(f.path).catch(() => null);
    if (!found) continue;
    const ext = f.name.split(".").pop() || "bin";
    files[`${ZIP_NAMES[kind] ?? kind}.${ext}`] = await bytes(found.body as ReadableStream | Buffer);
  }

  const sections = serviceOf(cab.service) === "keta" ? KETA_SECTIONS : FERIENJOB_FULL_SECTIONS;
  const known = new Set(sections.flatMap((s) => s.fields.map((f) => f.key)));
  const lines = [`Клиент: ${displayName(cab)}`, `Телефон: ${cab.clientPhone ?? "—"}`, ""];
  for (const s of sections) {
    const rows = s.fields.filter((f) => cab.data?.[f.key]).map((f) => `${f.label.ru}: ${cab.data![f.key]}`);
    if (rows.length) lines.push(`== ${s.title.ru} ==`, ...rows, "");
  }
  const extra = Object.entries(cab.data ?? {}).filter(([k, v]) => v && !known.has(k));
  if (extra.length) lines.push("== Другое ==", ...extra.map(([k, v]) => `${k}: ${v}`), "");
  if (cab.aiCheck) {
    lines.push(
      `== Проверка ИИ: ${cab.aiCheck.status} ==`,
      ...Object.entries(cab.aiCheck.fields)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`),
      ""
    );
    if (cab.aiCheck.missing.length) lines.push("Чего не хватает:", ...cab.aiCheck.missing.map((m) => `- ${m}`), "");
    if (cab.aiCheck.checks.length) lines.push("Проверить:", ...cab.aiCheck.checks.map((m) => `- ${m}`), "");
  }
  files["anketa.txt"] = strToU8(lines.join("\n"));

  const zip = zipSync(files, { level: 6 });
  const name = `${safe(displayName(cab))}.zip`;
  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="client.zip"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
