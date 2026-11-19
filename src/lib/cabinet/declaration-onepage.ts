import { PDFDocument } from "pdf-lib";

/**
 * The ZAV declaration on ONE page: page 1 (A–C, slightly smaller) and below it the top of page 2
 * (D «Vacation job» and E «Signature»). Some deans want a single sheet. Form fields are flattened first.
 */
export async function onePageDeclaration(src: Uint8Array): Promise<Uint8Array> {
  const filled = await PDFDocument.load(src);
  try {
    filled.getForm().flatten();
  } catch {
    // no form — already flat
  }
  const flat = await PDFDocument.load(await filled.save());
  const [p1, p2] = flat.getPages();
  const { width: W, height: H } = p1.getSize();
  const out = await PDFDocument.create();
  // Page 1 without its footer (barcode + «Page 1 of 2»), page 2 — only sections D and E.
  const top = { left: 0, right: W, bottom: H * 0.113, top: H };
  const bottom = { left: 0, right: W, bottom: H * 0.704, top: H * 0.92 };
  const [e1, e2] = await out.embedPages([p1, p2], [top, bottom]);
  const page = out.addPage([W, H]);
  const margin = 14;
  const total = top.top - top.bottom + (bottom.top - bottom.bottom);
  const s = Math.min(1, (H - 2 * margin) / total);
  const x = (W - W * s) / 2;
  const h1 = (top.top - top.bottom) * s;
  const h2 = (bottom.top - bottom.bottom) * s;
  page.drawPage(e1, { x, y: H - margin - h1, xScale: s, yScale: s });
  page.drawPage(e2, { x, y: H - margin - h1 - h2, xScale: s, yScale: s });
  return out.save();
}
