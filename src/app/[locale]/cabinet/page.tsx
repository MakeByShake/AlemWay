import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { currentCabinet, displayName } from "@/lib/cabinet/server";
import { CABINET_TEXT, cabinetLocale } from "@/lib/cabinet/i18n";
import { FILE_KINDS, serviceOf } from "@/lib/cabinet/fields";
import { CabinetApp, type CabinetView } from "@/components/cabinet/CabinetApp";
import { WhatsAppIcon, WhatsAppLink } from "@/components/WhatsAppLink";
import { whatsappLink } from "@/lib/i18n-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: CABINET_TEXT[cabinetLocale(locale)].metaTitle, robots: { index: false, follow: false } };
}

export default async function CabinetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = CABINET_TEXT[cabinetLocale(locale)];
  const cab = await currentCabinet().catch(() => null);

  if (!cab) {
    return (
      <section className="container-x py-16 sm:py-24">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="h-section">{t.invalidTitle}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">{t.invalidText}</p>
          <WhatsAppLink href={whatsappLink(undefined)} place="cabinet_invalid" className="btn-whatsapp mt-8">
            <WhatsAppIcon /> {t.writeManager}
          </WhatsAppLink>
        </div>
      </section>
    );
  }

  // Only what the page needs: no storage paths, no token hash.
  const files = Object.fromEntries(
    FILE_KINDS.map((k) => {
      const f = cab.files?.[k];
      return [k, f?.path ? { name: f.name, size: f.size, uploadedAt: f.uploadedAt } : null];
    })
  ) as CabinetView["files"];

  const view: CabinetView = {
    service: serviceOf(cab.service),
    ketaValidUntil: cab.ketaValidUntil ?? null,
    today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date()),
    name: displayName(cab),
    status: cab.status ?? "waiting_data",
    data: cab.data ?? {},
    files,
    declarationDate: cab.declarationDate ?? null,
    job: {
      employer: cab.employerName ?? null,
      city: cab.workCity ?? null,
      position: cab.workPosition ?? null,
      from: cab.workFrom ?? null,
      to: cab.workTo ?? null,
      message: cab.clientMessage ?? null,
    },
  };

  return <CabinetApp key={JSON.stringify(view.files) + view.status} view={view} locale={cabinetLocale(locale)} />;
}

