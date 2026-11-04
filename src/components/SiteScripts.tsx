"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { captureUtm } from "@/lib/analytics";

const YM_ID = process.env.NEXT_PUBLIC_YM_ID;

/** Yandex Metrika (only if NEXT_PUBLIC_YM_ID is set) + UTM capture + short notice. */
export function SiteScripts() {
  useEffect(() => {
    captureUtm();
  }, []);

  if (!YM_ID) return null;

  return (
    <>
      <Script id="ym" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${Number(YM_ID)},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});`}
      </Script>
      <CookieNotice />
    </>
  );
}

const NOTICE_KEY = "aw_notice_ok";

function CookieNotice() {
  const t = useTranslations("cookie");
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(NOTICE_KEY)) setShow(true);
    } catch {}
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-line bg-white p-4 shadow-[0_12px_40px_-12px_rgba(11,15,36,0.25)] sm:bottom-5">
      <p className="text-[14px] leading-relaxed text-muted">
        {t("text")}{" "}
        <Link href="/privacy" className="font-medium text-brand underline-offset-2 hover:underline">
          {t("link")}
        </Link>
        .
      </p>
      <button
        type="button"
        className="btn-primary mt-3 min-h-10 px-4 text-[14px]"
        onClick={() => {
          try {
            localStorage.setItem(NOTICE_KEY, "1");
          } catch {}
          setShow(false);
        }}
      >
        {t("ok")}
      </button>
    </div>
  );
}
