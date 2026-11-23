"use client";

import { useEffect, useRef } from "react";

/**
 * A chat that covers the screen: locks the page behind it and follows the visible part of the window,
 * so the input row stays above the on-screen keyboard. Put the returned ref on the element that covers.
 * `afterFit` runs after each change of size.
 * `below` — cover only on screens narrower than this many pixels (wider ones show the chat inside the page).
 */
export function useCoverScreen<T extends HTMLElement>(afterFit: () => void, below?: number) {
  const shell = useRef<T>(null);
  const cb = useRef(afterFit);
  useEffect(() => {
    cb.current = afterFit;
  }, [afterFit]);

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    const vv = window.visualViewport;
    const narrow = below ? window.matchMedia(`(max-width: ${below - 0.02}px)`) : null;
    const fit = () => {
      const el = shell.current;
      if (!el) return;
      const cover = !narrow || narrow.matches;
      root.style.overflow = cover ? "hidden" : before;
      el.style.height = cover && vv ? `${vv.height}px` : "";
      el.style.top = cover && vv ? `${vv.offsetTop}px` : "";
      cb.current();
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    narrow?.addEventListener("change", fit);
    return () => {
      root.style.overflow = before;
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      narrow?.removeEventListener("change", fit);
    };
  }, [below]);

  return shell;
}
