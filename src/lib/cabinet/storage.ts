import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * Private file storage for client documents (passports, certificates, declarations).
 * Production: a *private* Vercel Blob store — files are never reachable by URL, only through our API.
 * Local development without BLOB_READ_WRITE_TOKEN: files go to .data/blob (git-ignored).
 */

const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(process.cwd(), ".data", "blob");

function assertStorage() {
  if (!blobConfigured() && process.env.NODE_ENV === "production") {
    throw new Error("File storage is not configured: connect a private Vercel Blob store (BLOB_READ_WRITE_TOKEN).");
  }
}

function localPath(pathname: string) {
  const full = path.join(LOCAL_DIR, pathname);
  if (!full.startsWith(LOCAL_DIR + path.sep)) throw new Error("bad path");
  return full;
}

export async function saveFile(pathname: string, body: Buffer, contentType: string): Promise<string> {
  assertStorage();
  if (blobConfigured()) {
    const blob = await put(pathname, body, { access: "private", contentType, addRandomSuffix: true });
    return blob.pathname;
  }
  const file = localPath(pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  await fs.writeFile(file + ".type", contentType);
  return pathname;
}

export async function readFile(pathname: string): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  assertStorage();
  if (blobConfigured()) {
    const res = await get(pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { body: res.stream, contentType: res.blob.contentType || "application/octet-stream" };
  }
  try {
    const file = localPath(pathname);
    const [body, contentType] = await Promise.all([fs.readFile(file), fs.readFile(file + ".type", "utf8").catch(() => "application/octet-stream")]);
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function deleteFile(pathname: string | undefined) {
  if (!pathname) return;
  try {
    if (blobConfigured()) await del(pathname);
    else {
      const file = localPath(pathname);
      await Promise.all([fs.rm(file, { force: true }), fs.rm(file + ".type", { force: true })]);
    }
  } catch (err) {
    console.error("[storage] delete failed", err);
  }
}
