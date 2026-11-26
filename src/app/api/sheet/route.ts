import { NextResponse, type NextRequest } from "next/server";
import { checkSheetKey, deanSheetRows, sheetRows, teamSheetRows } from "@/lib/admin/sheet-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JSON for the team's Google Sheet (the sheet's script calls this every 10 minutes). Needs the secret key. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!checkSheetKey(key)) return NextResponse.json({ ok: false }, { status: 404 });
  // The partner sheet's first script wrote phones as formulas (#ERROR!) — only the fixed script (v=3) gets data.
  const view = req.nextUrl.searchParams.get("view");
  if (view !== "team" && !["3", "4", "5", "6"].includes(req.nextUrl.searchParams.get("v") ?? ""))
    return NextResponse.json({ ok: false, error: "Обновите скрипт в таблице (новая версия)" }, { status: 410 });
  const base = req.nextUrl.origin.includes("localhost") ? req.nextUrl.origin : "https://alemway.kz";
  // view=team: our own sheet «wt 2027 AlemWay» (simple colour view); default: the partner-format tab.
  // view=dean: «Не ставят печать» tab of the partner sheet.
  // Partner view also lists our clients to delete from the sheet (holidays start after 4 June) — only the v=5 script uses it.
  // view=ready / view=pending: partner tabs «Клиенты» (stamped) and «Ожидаются» (not stamped yet) — the v=6 script.
  const partner = view === "team" || view === "dean" ? null : await sheetRows(base, view === "ready" || view === "pending" ? view : "all");
  const rows = view === "team" ? await teamSheetRows(base) : view === "dean" ? await deanSheetRows() : partner!.rows;
  return NextResponse.json({ ok: true, at: new Date().toISOString(), rows, ...(partner ? { remove: partner.remove } : {}) }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
