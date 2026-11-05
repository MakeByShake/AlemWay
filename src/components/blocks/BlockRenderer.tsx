import { getTranslations } from "next-intl/server";
import { AlertTriangle, Check, FileCheck2, Info } from "lucide-react";
import { formatPrice, l } from "@/lib/i18n-content";
import { SHOW_PRICES } from "@/lib/prices";
import type { PageBlock } from "@/lib/types";
import { hasImage } from "@/sanity/image";
import { Media } from "../Media";
import { FaqList, Prose } from "../Sections";
import { WhatsAppIcon, WhatsAppLink } from "../WhatsAppLink";

type Ctx = { locale: string; whatsappHref: string };

function BlockTitle({ text }: { text: string }) {
  if (!text) return null;
  return <h2 className="mb-6 text-[24px] leading-tight font-bold tracking-[-0.025em] sm:text-[30px]">{text}</h2>;
}

async function Block({ block, ctx }: { block: PageBlock; ctx: Ctx }) {
  const { locale } = ctx;
  const title = l(block.title, locale);

  switch (block._type) {
    case "richText":
      return (
        <div>
          <BlockTitle text={title} />
          <Prose text={block.body} locale={locale} />
        </div>
      );

    case "features":
      if (!block.items?.length) return null;
      return (
        <div>
          <BlockTitle text={title} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {block.items.map((it) => (
              <li key={it._key} className="flex gap-3 rounded-[14px] bg-surface p-4 text-[16px] leading-snug">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {l(it, locale)}
              </li>
            ))}
          </ul>
        </div>
      );

    case "documents":
      if (!block.items?.length) return null;
      return (
        <div>
          <BlockTitle text={title} />
          <ol className="card divide-y divide-line">
            {block.items.map((it, i) => (
              <li key={it._key} className="flex gap-4 px-4 py-3.5 text-[16px] leading-snug sm:px-5">
                <span className="w-6 shrink-0 pt-px text-right text-[14px] font-semibold text-muted tabular-nums">{i + 1}</span>
                <span>{l(it, locale)}</span>
              </li>
            ))}
          </ol>
          {l(block.note, locale) && (
            <p className="mt-4 flex gap-2 text-[14px] leading-relaxed text-muted">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
              {l(block.note, locale)}
            </p>
          )}
        </div>
      );

    case "steps":
      if (!block.items?.length) return null;
      return (
        <div>
          <BlockTitle text={title} />
          <ol className="relative space-y-0">
            {block.items.map((it, i) => (
              <li key={it._key} className="relative flex gap-4 pb-7 last:pb-0">
                {i < block.items!.length - 1 && <span className="absolute top-10 bottom-0 left-[19px] w-px bg-line" aria-hidden />}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-white">{i + 1}</span>
                <div className="pt-1.5">
                  <p className="text-[17px] font-semibold tracking-[-0.01em]">{l(it.title, locale)}</p>
                  {l(it.text, locale) && <p className="mt-1 text-[15px] leading-relaxed text-muted">{l(it.text, locale)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case "pricing": {
      // Tariff tables are hidden while prices are off.
      if (!SHOW_PRICES || !block.plans?.length) return null;
      const t = await getTranslations("service");
      return (
        <div>
          <BlockTitle text={title} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {block.plans.map((p) => (
              <div key={p._key} className="card flex flex-col p-6">
                <p className="text-[16px] font-semibold">{l(p.name, locale)}</p>
                <p className="mt-2 text-[28px] font-bold tracking-[-0.03em]">
                  {!p.priceOnRequest && typeof p.price === "number" ? formatPrice(p.price, locale) : <span className="text-xl">{t("priceOnRequest")}</span>}
                </p>
                {p.features?.length ? (
                  <ul className="mt-4 space-y-2 border-t border-line pt-4">
                    {p.features.map((f) => (
                      <li key={f._key} className="flex gap-2 text-[15px] text-ink/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                        {l(f, locale)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "faq":
      return (
        <div>
          <BlockTitle text={title} />
          <FaqList
            items={(block.items ?? []).map((q) => ({ key: q._key, question: l(q.question, locale), answer: l(q.answer, locale) }))}
          />
        </div>
      );

    case "imageText": {
      const right = block.imagePosition === "right";
      return (
        <div className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
          <Media
            image={block.image}
            locale={locale}
            placeholder={title || "Фото"}
            sizes="(min-width: 768px) 400px, 100vw"
            className={`aspect-[4/3] rounded-[16px] ${right ? "md:order-2" : ""}`}
            width={1000}
          />
          <div>
            <BlockTitle text={title} />
            <Prose text={block.body} locale={locale} />
          </div>
        </div>
      );
    }

    case "gallery": {
      const images = (block.images ?? []).filter(hasImage);
      if (!images.length) return null;
      return (
        <div>
          <BlockTitle text={title} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {images.map((img, i) => (
              <Media
                key={(img as { _key?: string })._key ?? i}
                image={img}
                locale={locale}
                placeholder=""
                sizes="(min-width: 768px) 260px, 50vw"
                className="aspect-square rounded-[14px]"
                width={700}
              />
            ))}
          </div>
        </div>
      );
    }

    case "cta": {
      const t = await getTranslations("service");
      return (
        <div className="rounded-[20px] bg-ink p-6 text-white sm:p-10">
          <p className="text-[24px] leading-tight font-bold tracking-[-0.025em] sm:text-[30px]">{title}</p>
          {l(block.text, locale) && <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-white/70">{l(block.text, locale)}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="#lead" className="btn bg-white text-ink hover:bg-white/90">
              {l(block.buttonLabel, locale) || t("leaveRequest")}
            </a>
            {block.showWhatsapp !== false && (
              <WhatsAppLink href={ctx.whatsappHref} place="cta_block" className="btn-whatsapp">
                <WhatsAppIcon /> WhatsApp
              </WhatsAppLink>
            )}
          </div>
        </div>
      );
    }

    case "alert": {
      const warn = block.tone !== "info";
      const Icon = warn ? AlertTriangle : Info;
      return (
        <div className={`flex gap-4 rounded-[16px] border p-5 sm:p-6 ${warn ? "border-[#f3dfae] bg-warn-soft" : "border-brand/15 bg-brand-soft"}`} role="note">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${warn ? "text-warn" : "text-brand"}`} />
          <div>
            {title && <p className={`text-[17px] font-semibold ${warn ? "text-[#5c3d00]" : "text-ink"}`}>{title}</p>}
            {l(block.body, locale) && <p className="mt-1 text-[15px] leading-relaxed text-ink/75">{l(block.body, locale)}</p>}
          </div>
        </div>
      );
    }

    case "stats":
      if (!block.items?.length) return null;
      return (
        <div>
          <BlockTitle text={title} />
          <dl className="grid gap-px overflow-hidden rounded-[16px] border border-line bg-line sm:grid-cols-3">
            {block.items.map((s) => (
              <div key={s._key} className="bg-white p-5 sm:p-6">
                <dt className="sr-only">{l(s.label, locale)}</dt>
                <dd className="text-[36px] leading-none font-bold tracking-[-0.04em] text-brand">{s.value}</dd>
                <dd className="mt-2 text-[15px] text-muted">{l(s.label, locale)}</dd>
              </div>
            ))}
          </dl>
        </div>
      );

    default:
      return null;
  }
}

/** Renders the page builder. Unknown or empty blocks are skipped instead of crashing the page. */
export function BlockRenderer({ blocks, ctx }: { blocks?: PageBlock[] | null; ctx: Ctx }) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-14 sm:space-y-16">
      {blocks.map((b) => (
        <section key={b._key} className="reveal">
          <Block block={b} ctx={ctx} />
        </section>
      ))}
    </div>
  );
}
