/** Which files a client may change at each stage (shared by the cabinet form and the chat). */
import { SERVICE_FILES, serviceOf, type UploadKind } from "./fields";
import type { Cabinet } from "./server";

type Rules = Pick<Cabinet, "service" | "status" | "files">;

/** Why the client can't upload, replace or delete this file now; null = allowed. */
export function lockReason(cab: Rules, kind: UploadKind, deleting = false): string | null {
  const service = serviceOf(cab.service);
  const status = cab.status ?? "waiting_data";
  if (service === "keta") return status !== "waiting_data" ? "locked" : null;
  if (kind === "signed" || kind === "signed2") {
    // Signed scans (2 copies): after the declaration exists, and can be replaced until ZAV arrives.
    if (!cab.files?.declaration?.path) return "no_declaration";
    // Deleting only before the client sends them to us.
    if (deleting) return status !== "declaration_ready" ? "locked" : null;
    return status !== "declaration_ready" && status !== "signed_uploaded" ? "locked" : null;
  }
  // Driving licence: often comes a month later — can be added until the trip.
  if (kind === "license") return status === "done" ? "locked" : null;
  return status !== "waiting_data" && status !== "declaration_ready" ? "locked" : null;
}

/** Documents the client may upload right now, in the order of the cabinet form. */
export const openUploadKinds = (cab: Rules): UploadKind[] => SERVICE_FILES[serviceOf(cab.service)].client.filter((k) => !lockReason(cab, k));
