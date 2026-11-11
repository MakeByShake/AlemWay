import Link from "next/link";
import type { ReactNode } from "react";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { logoutAction } from "../actions";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const me = await requireAdminUser();
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href="/admin" className="block">
            <span className="text-[13px] font-semibold tracking-wide text-brand uppercase">AlemWay</span>
            <span className="block text-[18px] font-bold leading-tight">Админка</span>
          </Link>
          <form action={logoutAction} className="lg:hidden">
            <button className="text-[14px] text-muted hover:text-ink">Выйти</button>
          </form>
        </div>
        <AdminNav owner={me.role === "owner"} full={isFullRole(me.role)} />
        <div className="hidden px-5 pt-6 text-[13px] text-muted lg:block">
          <p>
            Вы вошли как <b className="text-ink">{me.name}</b>
          </p>
          <form action={logoutAction} className="mt-2">
            <button className="font-medium text-brand hover:underline">Выйти</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
