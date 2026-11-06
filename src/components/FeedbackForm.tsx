"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { FEEDBACK_TOPICS, type FeedbackTopic } from "@/lib/feedback";
import { WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

type Status = "idle" | "sending" | "success" | "error" | "rate";

export function FeedbackForm({ whatsappHref }: { whatsappHref: string }) {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const id = useId();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [topic, setTopic] = useState<FeedbackTopic>("site");
  const [status, setStatus] = useState<Status>("idle");
  const [ratingError, setRatingError] = useState(false);
  const hints = t.raw("ratingHint") as string[];
  const shown = hover || rating;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating) {
      setRatingError(true);
      document.getElementById(`${id}-star-1`)?.focus();
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          topic,
          liked: String(fd.get("liked") || ""),
          improve: String(fd.get("improve") || ""),
          name: String(fd.get("name") || ""),
          contact: String(fd.get("contact") || ""),
          website: String(fd.get("website") || ""), // honeypot
          locale,
          page: window.location.pathname,
        }),
      });
      if (res.status === 429) return setStatus("rate");
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
      form.reset();
      setRating(0);
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
        <button type="button" className="btn-ghost mt-6" onClick={() => setStatus("idle")}>
          {t("again")}
        </button>
      </div>
    );
  }

  const label = "mb-1.5 block text-[14px] font-semibold";
  const opt = <span className="font-normal text-muted">({t("optional")})</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-5 p-5 sm:p-7">
      {/* Rating */}
      <fieldset>
        <legend className={label}>{t("ratingLabel")}</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={t("ratingLabel")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              id={`${id}-star-${n}`}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} — ${hints[n - 1]}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => {
                setRating(n);
                setRatingError(false);
              }}
              className="rounded-lg p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-9 w-9 sm:h-10 sm:w-10 ${n <= shown ? "fill-[#F5B301] text-[#F5B301]" : "text-line"}`}
                strokeWidth={1.5}
              />
            </button>
          ))}
          <span className="ml-2 text-[15px] font-medium text-muted" aria-live="polite">
            {shown ? hints[shown - 1] : ""}
          </span>
        </div>
        {ratingError && <p className="mt-1.5 text-[13px] font-medium text-[#c62828]">{t("errRating")}</p>}
      </fieldset>

      {/* Topic */}
      <fieldset>
        <legend className={label}>{t("topicLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TOPICS.map((tp) => (
            <button
              key={tp}
              type="button"
              aria-pressed={topic === tp}
              onClick={() => setTopic(tp)}
              className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
                topic === tp ? "border-brand bg-brand text-white" : "border-line bg-white text-ink/75 hover:border-ink/30"
              }`}
            >
              {t(`topics.${tp}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-liked`} className={label}>
          {t("likedLabel")} {opt}
        </label>
        <textarea id={`${id}-liked`} name="liked" rows={3} maxLength={1500} placeholder={t("likedPlaceholder")} className="field resize-y" />
      </div>

      <div>
        <label htmlFor={`${id}-improve`} className={label}>
          {t("improveLabel")} {opt}
        </label>
        <textarea id={`${id}-improve`} name="improve" rows={3} maxLength={1500} placeholder={t("improvePlaceholder")} className="field resize-y" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={label}>
            {t("nameLabel")} {opt}
          </label>
          <input id={`${id}-name`} name="name" autoComplete="name" maxLength={80} className="field" />
        </div>
        <div>
          <label htmlFor={`${id}-contact`} className={label}>
            {t("contactLabel")} {opt}
          </label>
          <input id={`${id}-contact`} name="contact" maxLength={80} className="field" aria-describedby={`${id}-contact-hint`} />
          <p id={`${id}-contact-hint`} className="mt-1 text-[12px] text-muted">
            {t("contactHint")}
          </p>
        </div>
      </div>

      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
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
          {status === "error" && (
            <WhatsAppLink href={whatsappHref} place="feedback_error" className="mt-2 inline-flex items-center gap-2 font-semibold text-accent">
              <WhatsAppIcon className="h-4 w-4" /> WhatsApp
            </WhatsAppLink>
          )}
        </div>
      )}
    </form>
  );
}
