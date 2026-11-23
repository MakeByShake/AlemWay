"use client";

import { useEffect } from "react";

/** Registers the service worker: the site can be installed on a phone and shows notifications. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
  }, []);
  return null;
}
