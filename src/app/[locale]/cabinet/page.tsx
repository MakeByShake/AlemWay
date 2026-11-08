import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CABINET_SUPPORT_WHATSAPP, currentCabinet, displayName } from "@/lib/cabinet/server";
import { CABINET_TEXT, cabinetLocale } from "@/lib/cabinet/i18n";
import { FILE_KINDS, serviceOf } from "@/lib/cabinet/fields";
import { CabinetApp, type CabinetView } from "@/components/cabinet/CabinetApp";
import { CabinetPayment } from "@/components/cabinet/CabinetPayment";
import { paymentTotals } from "@/lib/cabinet/payments";
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
          <WhatsAppLink href={whatsappLink(CABINET_SUPPORT_WHATSAPP, t.helpMessage)} place="cabinet_invalid" className="btn-whatsapp mt-8">
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

  return (
    <>
      <CabinetApp key={JSON.stringify(view.files) + view.status} view={view} locale={cabinetLocale(locale)} />
      <CabinetPayment
        locale={cabinetLocale(locale)}
        view={{
          ...paymentTotals(cab.price, cab.payments),
          items: [...(cab.payments ?? [])]
            .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
            .map((p) => ({ amount: p.amount, status: p.status, paidAt: p.paidAt })),
        }}
      />
      <section className="container-x pb-16">
        <div className="card mx-auto flex max-w-3xl flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[18px] font-bold">{t.helpTitle}</p>
            <p className="mt-1 text-[15px] text-muted">
              {t.helpText} <span className="whitespace-nowrap font-semibold text-ink">+7 777 588 29 49</span>
            </p>
          </div>
          <WhatsAppLink href={whatsappLink(CABINET_SUPPORT_WHATSAPP, t.helpMessage)} place="cabinet_help" className="btn-whatsapp shrink-0">
            <WhatsAppIcon /> {t.helpButton}
          </WhatsAppLink>
        </div>
      </section>
    </>
  );
}

