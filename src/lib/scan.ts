/**
 * Phone "document scanner" without native code: the client photographs each page with the camera,
 * we straighten the brightness (paper becomes white, text dark), optionally make it black-and-white,
 * and put all pages into one PDF. Works the same in the browser, the installed site and the Android app.
 */

export type ScanPage = { id: string; source: File; rotate: 0 | 90 | 180 | 270; bw: boolean; preview: string };

const MAX_SIDE = 2000;

/** Draws one page with the filters applied and returns a canvas. */
async function renderPage(page: ScanPage, maxSide = MAX_SIDE): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(page.source);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const turned = page.rotate === 90 || page.rotate === 270;
  const canvas = document.createElement("canvas");
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((page.rotate * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bitmap.close?.();
  enhance(ctx, canvas.width, canvas.height, page.bw);
  return canvas;
}

/**
 * Levels stretch: the darkest 2 % become black, the brightest 10 % (the paper) become white.
 * Shadows and the yellow tint of indoor light go away; colour stamps stay visible unless bw is on.
 */
function enhance(ctx: CanvasRenderingContext2D, w: number, h: number, bw: boolean) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 16) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
  const total = hist.reduce((a, b) => a + b, 0);
  const at = (share: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= total * share) return v;
    }
    return 255;
  };
  const lo = at(0.02);
  const hi = Math.max(lo + 40, at(0.9));
  const k = 255 / (hi - lo);
  const map = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) map[v] = (v - lo) * k;
  for (let i = 0; i < d.length; i += 4) {
    if (bw) {
      const y = map[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8];
      d[i] = d[i + 1] = d[i + 2] = y;
    } else {
      d[i] = map[d[i]];
      d[i + 1] = map[d[i + 1]];
      d[i + 2] = map[d[i + 2]];
    }
  }
  ctx.putImageData(img, 0, 0);
}

const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));

/** Small preview of a page with its filters, as an object URL (caller revokes it). */
export async function previewOf(page: ScanPage): Promise<string> {
  const blob = await toBlob(await renderPage(page, 700), 0.7);
  if (!blob) throw new Error("preview failed");
  return URL.createObjectURL(blob);
}

const LIMIT = 3.8 * 1024 * 1024;

/** All pages as one PDF that fits the upload limit (quality goes down step by step if needed). */
export async function pagesToPdf(pages: ScanPage[], name: string): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  for (const [side, q] of [
    [MAX_SIDE, 0.8],
    [1600, 0.65],
    [1200, 0.55],
  ] as const) {
    const pdf = await PDFDocument.create();
    for (const page of pages) {
      const canvas = await renderPage(page, side);
      const blob = await toBlob(canvas, q);
      if (!blob) throw new Error("render failed");
      const jpg = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      // A4 width (595 pt); height follows the photo.
      const width = 595;
      const height = (canvas.height / canvas.width) * width;
      pdf.addPage([width, height]).drawImage(jpg, { x: 0, y: 0, width, height });
    }
    const bytes = await pdf.save();
    const file = new File([bytes as BlobPart], `${name}.pdf`, { type: "application/pdf" });
    if (file.size <= LIMIT || side === 1200) return file;
  }
  throw new Error("unreachable");
}
