import "server-only";
import { NextResponse } from "next/server";
import { readFile } from "./storage";
import type { StoredFile } from "./server";

/** Streams a private file as a download. Never cached by browsers or CDNs. */
export async function fileResponse(file: StoredFile | undefined, opts: { inline?: boolean } = {}) {
  if (!file?.path) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const found = await readFile(file.path);
  if (!found) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  return new NextResponse(found.body as BodyInit, {
    headers: {
      "Content-Type": found.contentType,
      "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
