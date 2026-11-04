/**
 * Заливает стартовый контент в Sanity:  npm run seed
 * Нужны в .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_WRITE_TOKEN.
 *
 * Документы создаются с постоянными _id, поэтому повторный запуск обновляет их, а не дублирует.
 * Удалённые из стартового набора услуги (Япония, Польша, Словакия, Green Card) скрипт тоже убирает, если они есть.
 */
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

function serviceDoc(s: Service) {
  const { category, ...rest } = s;
  return {
    ...rest,
    slug: { _type: "slug", current: s.slug.current },
    category: category ? { _type: "reference", _ref: category._id } : undefined,
  };
}

async function main() {
  const tx = client.transaction();
  tx.createOrReplace(seedSettings);
  for (const c of seedCategories) tx.createOrReplace({ ...c, slug: { _type: "slug", current: c.slug.current } });
  for (const s of seedServices) tx.createOrReplace(serviceDoc(s));
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
