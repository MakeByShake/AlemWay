/**
 * Makes files small enough to upload (server limit ~4 MB) — in the browser, before sending.
 * Photos: resized to JPEG. PDFs over the limit (usually phone scans): every page is redrawn as a JPEG image
 * and put into a new PDF. Text stays readable; stamps and signatures stay visible.
 */

const LIMIT = 3.8 * 1024 * 1024;

async function shrinkImage(file: File, maxSide = 2400, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

async function shrinkPdf(file: File, width: number, quality: number): Promise<File> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const { PDFDocument } = await import("pdf-lib");
  const src = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out = await PDFDocument.create();
  const pages = Math.min(src.numPages, 20);
  for (let i = 1; i <= pages; i++) {
    const page = await src.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) throw new Error("render failed");
    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    out.addPage([base.width, base.height]).drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
  }
  const bytes = await out.save();
  return new File([bytes as BlobPart], file.name.replace(/\.pdf$/i, "") + ".pdf", { type: "application/pdf" });
}

/** Returns a file that fits the upload limit when possible (otherwise the original — the server will say «too large»). */
export async function compressForUpload(file: File): Promise<File> {
  try {
    if (/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) {
      if (file.size < 1.5 * 1024 * 1024 && file.type !== "image/webp" && !/hei[cf]/i.test(file.type)) return file;
      let out = await shrinkImage(file);
      if (out.size > LIMIT) out = await shrinkImage(file, 1800, 0.7);
      return out;
    }
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      if (file.size <= LIMIT) return file;
      for (const [width, q] of [
        [1600, 0.75],
        [1300, 0.6],
        [1000, 0.5],
      ] as const) {
        const out = await shrinkPdf(file, width, q);
        if (out.size <= LIMIT) return out;
      }
    }
  } catch (err) {
    console.error("[compress] failed", err);
  }
  return file;
}
