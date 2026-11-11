import "server-only";
import { getCabinet, newCabinetId, newLoginToken, writeClient } from "./server";
import { deleteFile } from "./storage";
import { serviceOf, type ServiceId } from "./fields";
import { DEFAULT_PRICE } from "./payments";

/** Manager operations on cabinets, shared by the Studio API routes and the /admin pages. */

export class AdminOpError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** Creates a cabinet (optionally from a lead) and returns the client's login link (shown once). */
export async function createCabinet(input: { clientName: string; clientPhone: string; service?: string; leadId?: string; manager?: { login: string; name: string } | null; seller?: { login: string; name: string } | null }) {
  const clientName = input.clientName.trim().slice(0, 80);
  const clientPhone = input.clientPhone.trim().slice(0, 30);
  const leadId = (input.leadId ?? "").trim().replace(/^drafts\./, "");
  if (clientName.length < 2) throw new AdminOpError("Укажите имя клиента");

  const client = writeClient();
  let service: ServiceId = serviceOf(input.service);
  if (leadId) {
    if (!/^[\w.-]+$/.test(leadId)) throw new AdminOpError("Некорректная заявка");
    const existing = await client.fetch<string | null>(`*[_type == "cabinet" && lead._ref == $lead][0]._id`, { lead: leadId });
    if (existing) throw new AdminOpError("Для этой заявки кабинет уже есть. Откройте его и нажмите «Новая ссылка для клиента».", 409);
    // From a lead: the service follows what the client chose on the site.
    const slug = await client.fetch<string | null>(`*[_id == $lead][0].service->slug.current`, { lead: leadId });
    if (!input.service) service = slug && /eta|korea/i.test(slug) ? "keta" : "ferienjob";
  }

  const id = newCabinetId();
  const { hash, link } = newLoginToken();
  // Client number: the next after the largest one (never reused).
  const last = await client.fetch<number | null>(`*[_type == "cabinet" && defined(number)] | order(number desc)[0].number`);
  await client.create({
    _id: id,
    _type: "cabinet",
    number: (last ?? 0) + 1,
    // «Новые» fill in the questionnaire themselves; imported «старые» were filled in by the team.
    group: "new",
    service,
    status: "waiting_data",
    ...(DEFAULT_PRICE[service] ? { price: DEFAULT_PRICE[service] } : {}),
    clientName,
    clientPhone,
    ...(input.manager ? { manager: input.manager.login, managerName: input.manager.name } : {}),
    ...(input.seller ? { seller: input.seller.login, sellerName: input.seller.name } : {}),
    tokenHash: hash,
    linkCreatedAt: new Date().toISOString(),
    ...(leadId ? { lead: { _type: "reference", _ref: leadId, _weak: true } } : {}),
    data: clientPhone.replace(/\D/g, "") ? { phone: clientPhone } : {},
    files: {},
  });
  return { id, link };
}

/** Deletes a client completely: every stored file and the cabinet document with its draft. */
export async function deleteCabinetCompletely(rawId: string) {
  const id = rawId.replace(/^drafts\./, "");
  if (!id.startsWith("cabinets.")) throw new AdminOpError("Некорректный кабинет");
  const [published, draft] = await Promise.all([getCabinet(id), getCabinet(id, true)]);
  if (!published && !draft) throw new AdminOpError("Кабинет не найден", 404);

  // Files from both versions (the draft may point to a newer upload).
  const paths = new Set<string>();
  for (const cab of [published, draft]) {
    for (const f of Object.values(cab?.files ?? {})) if (f?.path) paths.add(f.path);
    for (const p of cab?.payments ?? []) if (p.receipt?.path) paths.add(p.receipt.path);
  }
  let failed = 0;
  for (const p of paths) {
    try {
      await deleteFile(p);
    } catch (err) {
      console.error("[cabinet delete] file", p, err);
      failed++;
    }
  }
  await writeClient().transaction().delete(id).delete(`drafts.${id}`).commit();
  return { deletedFiles: paths.size - failed, failedFiles: failed };
}
