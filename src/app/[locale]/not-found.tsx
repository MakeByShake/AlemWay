import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const n = await getTranslations("nav");
  return (
    <section className="container-x py-24 sm:py-32">
      <p className="eyebrow">404</p>
      <h1 className="h-display mt-3">{t("title")}</h1>
      <p className="mt-4 max-w-lg text-[17px] text-muted">{t("text")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="btn-primary">
          {t("back")}
        </Link>
        <Link href="/services" className="btn-ghost">
          {n("allServices")}
        </Link>
      </div>
    </section>
  );
}
