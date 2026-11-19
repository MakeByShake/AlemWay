import "server-only";
import { NextResponse } from "next/server";
import { readFile } from "./storage";
import { onePageDeclaration } from "./declaration-onepage";
import type { StoredFile } from "./server";

/** Streams a private file as a download. Never cached by browsers or CDNs. */
export async function fileResponse(file: StoredFile | undefined, opts: { inline?: boolean; onePage?: boolean } = {}) {
  if (!file?.path) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const found = await readFile(file.path);
  if (!found) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  // The 2-page declaration put on one sheet (made on the fly, nothing extra is stored).
  if (opts.onePage && found.contentType === "application/pdf") {
    const src = Buffer.isBuffer(found.body) ? found.body : Buffer.from(await new Response(found.body as BodyInit).arrayBuffer());
    const out = await onePageDeclaration(new Uint8Array(src));
    return new NextResponse(Buffer.from(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename="${safeName.replace(/\.pdf$/i, "")}-1-page.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return new NextResponse(found.body as BodyInit, {
    headers: {
      "Content-Type": found.contentType,
      "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
