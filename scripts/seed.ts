/**
 * Заливает стартовый контент в Sanity:  npm run seed
 * Нужны в .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_WRITE_TOKEN.
 *
 * Документы создаются с постоянными _id, поэтому повторный запуск обновляет их, а не дублирует.
 * Удалённые из стартового набора услуги (Япония, Польша, Словакия, Green Card) скрипт тоже убирает, если они есть.
 */
import { createReadStream } from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";
import { seedCategories, seedFaq, seedServices, seedSettings } from "../src/content/seed";
import type { Service } from "../src/lib/types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !token) {
  console.error("❌ Нет NEXT_PUBLIC_SANITY_PROJECT_ID или SANITY_API_WRITE_TOKEN в .env.local");
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: "2025-10-01", useCdn: false });

const REMOVED_IDS = [
  "service-visa-japan",
  "service-visa-poland",
  "service-visa-slovakia",
  "service-green-card",
  "category-green-card",
];

// Local photos (/images/...) are uploaded once and replaced with Sanity asset references.
const uploaded = new Map<string, string>();
async function uploadImages<T>(value: T): Promise<T> {
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => uploadImages(v)))) as T;
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  if (typeof obj.src === "string" && obj.src.startsWith("/")) {
    const { src, ...rest } = obj;
    let id = uploaded.get(src as string);
    if (!id) {
      const file = path.join(process.cwd(), "public", src as string);
      const asset = await client.assets.upload("image", createReadStream(file), { filename: path.basename(file) });
      id = asset._id;
      uploaded.set(src as string, id);
      console.log(`🖼  Загружено фото ${src}`);
    }
    return { ...rest, _type: "image", asset: { _type: "reference", _ref: id } } as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = await uploadImages(v);
  return out as T;
}

function serviceDoc(s: Service) {
  const { category, ...rest } = s;
  return {
    ...rest,
    slug: { _type: "slug", current: s.slug.current },
    category: category ? { _type: "reference", _ref: category._id } : undefined,
  };
}

async function main() {
  const settings = await uploadImages(seedSettings);
  const services = await uploadImages(seedServices.map(serviceDoc));

  const tx = client.transaction();
  tx.createOrReplace(settings);
  for (const c of seedCategories) tx.createOrReplace({ ...c, slug: { _type: "slug", current: c.slug.current } });
  for (const s of services) tx.createOrReplace(s);
  for (const f of seedFaq) tx.createOrReplace(f);
  await tx.commit();
  console.log(`✅ Залито: настройки, ${seedCategories.length} категории, ${seedServices.length} услуги, ${seedFaq.length} вопроса FAQ`);

  // Убираем услуги, которых больше нет в стартовом наборе (и их черновики).
  const existing = await client.fetch<string[]>(`*[_id in $ids || _id in $drafts]._id`, {
    ids: REMOVED_IDS,
    drafts: REMOVED_IDS.map((id) => `drafts.${id}`),
  });
  if (existing.length) {
    // Услуги скрываем (на них могут ссылаться заявки), пустую категорию удаляем.
    const hide = client.transaction();
    for (const id of existing) {
      if (id.includes("category-")) hide.delete(id);
      else hide.patch(id, (p) => p.set({ visible: false }));
    }
    await hide.commit().catch(async (err) => {
      console.warn("⚠️  Не удалось удалить категорию (на неё ссылаются). Скрываю только услуги.", err.message);
      const t2 = client.transaction();
      existing.filter((id) => !id.includes("category-")).forEach((id) => t2.patch(id, (p) => p.set({ visible: false })));
      await t2.commit();
    });
    console.log(`🧹 Скрыто/удалено старых документов: ${existing.length}`);
  }
}

main().catch((err) => {
  console.error("❌ Ошибка:", err.message);
  process.exit(1);
});
