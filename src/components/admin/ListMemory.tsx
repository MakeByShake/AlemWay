"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Admin lists remember their filters for this browser tab, so going into a card and back keeps them. */

const KEY = (path: string) => `aw-list:${path}`;

export function readListQuery(path: string) {
  try {
    return sessionStorage.getItem(KEY(path)) ?? "";
  } catch {
    return "";
  }
}

const noSubscribe = () => () => {};
/** The remembered «?…» of a list ("" on the server and before anything was saved). */
export function useListQuery(path: string) {
  return useSyncExternalStore(noSubscribe, () => readListQuery(path), () => "");
}

/** Put on a list page: saves its current filters. */
export function RememberListQuery({ path }: { path: string }) {
  const sp = useSearchParams();
  const qs = sp.toString();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY(path), qs ? `?${qs}` : "");
    } catch {
      // Storage blocked: the list just opens without filters.
    }
  }, [path, qs]);
  return null;
}

/** Link to a list that opens it with the filters it had last time. */
export function ListLink({ path, className, children }: { path: string; className?: string; children: ReactNode }) {
  const query = useListQuery(path);
  return (
    <Link prefetch={false} href={`${path}${query}`} className={className}>
      {children}
    </Link>
  );
}
