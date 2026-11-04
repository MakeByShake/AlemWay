"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { readUtm, trackGoal } from "@/lib/analytics";
import { WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

export type LeadServiceOption = { slug: string; title: string };

/** Formats any input into +7 (XXX) XXX-XX-XX. */
export function formatPhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = "+7";
  if (p.length) out += " (" + p.slice(0, 3);
  if (p.length >= 3) out += ")";
  if (p.length > 3) out += " " + p.slice(3, 6);
  if (p.length > 6) out += "-" + p.slice(6, 8);
  if (p.length > 8) out += "-" + p.slice(8, 10);
  return out;
}

type Status = "idle" | "sending" | "success" | "error" | "rate";

export function LeadForm({
  services,
  defaultService = "",
  whatsappHref,
}: {
  services: LeadServiceOption[];
  defaultService?: string;
  whatsappHref: string;
}) {
  const t = useTranslations("form");
  const locale = useLocale();
  const id = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const digits = phone.replace(/\D/g, "");
    const consent = fd.get("consent") === "on";

    const errs: Record<string, string> = {};
    if (name.length < 2) errs.name = t("errName");
    if (digits.length !== 11) errs.phone = t("errPhone");
    if (!consent) errs.consent = t("errConsent");
    setErrors(errs);
    if (Object.keys(errs).length) {
      form.querySelector<HTMLElement>(`[name="${Object.keys(errs)[0]}"]`)?.focus();
      return;
    }

    setStatus("sending");
    const serviceSlug = String(fd.get("service") || "");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: `+${digits}`,
          service: serviceSlug,
          serviceTitle: services.find((s) => s.slug === serviceSlug)?.title || "",
          comment: String(fd.get("comment") || "").trim(),
          consent,
          website: String(fd.get("website") || ""), // honeypot
          locale,
          page: window.location.pathname,
          utm: readUtm(),
        }),
      });
      if (res.status === 429) return setStatus("rate");
      if (!res.ok) throw new Error(String(res.status));
      trackGoal("lead_submit", { service: serviceSlug || "none" });
      setStatus("success");
      form.reset();
      setPhone("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card p-6 sm:p-8" role="status" aria-live="polite">
        <CheckCircle2 className="h-10 w-10 text-accent" strokeWidth={1.75} />
        <h3 className="mt-4 text-2xl font-bold tracking-[-0.02em]">{t("successTitle")}</h3>
        <p className="mt-2 text-[16px] text-muted">{t("successText")}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <WhatsAppLink href={whatsappHref} place="lead_success" className="btn-whatsapp">
            <WhatsAppIcon /> WhatsApp
          </WhatsAppLink>
          <button type="button" className="btn-ghost" onClick={() => setStatus("idle")}>
            {t("successAgain")}
          </button>
        </div>
      </div>
    );
  }

  const label = "mb-1.5 block text-[14px] font-semibold";
  const err = "mt-1.5 text-[13px] font-medium text-[#c62828]";

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-5 sm:p-7">
      <div>
        <label htmlFor={`${id}-name`} className={label}>
          {t("name")}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          maxLength={80}
          placeholder={t("namePlaceholder")}
          className="field"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${id}-name-err` : undefined}
        />
        {errors.name && (
          <p id={`${id}-name-err`} className={err}>
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-phone`} className={label}>
          {t("phone")}
        </label>
        <input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 (___) ___-__-__"
          value={phone}
          onChange={(e) => setPhone(e.target.value ? formatPhone(e.target.value) : "")}
          onFocus={() => !phone && setPhone("+7")}
          onBlur={() => phone === "+7" && setPhone("")}
          className="field"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? `${id}-phone-err` : undefined}
        />
        {errors.phone && (
          <p id={`${id}-phone-err`} className={err}>
            {errors.phone}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-service`} className={label}>
          {t("service")}
        </label>
        <select id={`${id}-service`} name="service" defaultValue={defaultService} className="field appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23545a73%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10">
          <option value="">{t("selectService")}</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
          <option value="other">{t("otherService")}</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-comment`} className={label}>
          {t("comment")} <span className="font-normal text-muted">({t("optional")})</span>
        </label>
        <textarea id={`${id}-comment`} name="comment" rows={3} maxLength={1000} placeholder={t("commentPlaceholder")} className="field resize-y" />
      </div>

      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-muted">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
            aria-invalid={Boolean(errors.consent)}
          />
          <span>
            {t("consentBefore")}{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-brand underline underline-offset-2">
              {t("consentLink")}
            </Link>
          </span>
        </label>
        {errors.consent && <p className={err}>{errors.consent}</p>}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={status === "sending"}>
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("sending")}
          </>
        ) : (
          t("submit")
        )}
      </button>

      {(status === "error" || status === "rate") && (
        <div className="rounded-[12px] bg-warn-soft p-4 text-[14px] text-warn" role="alert">
          <p>{status === "rate" ? t("tooMany") : t("error")}</p>
          <WhatsAppLink href={whatsappHref} place="lead_error" className="mt-2 inline-flex items-center gap-2 font-semibold text-accent">
            <WhatsAppIcon className="h-4 w-4" /> WhatsApp
          </WhatsAppLink>
        </div>
      )}
    </form>
  );
}
