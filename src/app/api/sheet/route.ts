import { NextResponse, type NextRequest } from "next/server";
import { checkSheetKey, sheetRows, teamSheetRows } from "@/lib/admin/sheet-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JSON for the team's Google Sheet (the sheet's script calls this every 10 minutes). Needs the secret key. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!checkSheetKey(key)) return NextResponse.json({ ok: false }, { status: 404 });
  // The partner sheet's first script wrote phones as formulas (#ERROR!) — only the fixed script (v=3) gets data.
  if (req.nextUrl.searchParams.get("view") !== "team" && req.nextUrl.searchParams.get("v") !== "3")
    return NextResponse.json({ ok: false, error: "Обновите скрипт в таблице (новая версия)" }, { status: 410 });
  const base = req.nextUrl.origin.includes("localhost") ? req.nextUrl.origin : "https://alemway.kz";
  // view=team: our own sheet «wt 2027 AlemWay» (simple colour view); default: the partner-format tab.
  const rows = req.nextUrl.searchParams.get("view") === "team" ? await teamSheetRows(base) : await sheetRows(base);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), rows }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
