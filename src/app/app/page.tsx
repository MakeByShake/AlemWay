import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin/session";
import { currentCabinet } from "@/lib/cabinet/server";
import { AppStart } from "@/components/pwa/AppStart";

export const dynamic = "force-dynamic";

/**
 * Start screen of the app (and of the site installed on a phone): «Я клиент» / «Я сотрудник».
 * Whoever is already logged in goes straight to their place.
 */
export default async function AppStartPage() {
  const admin = await verifySession((await cookies()).get(ADMIN_COOKIE)?.value).catch(() => null);
  if (admin) redirect("/admin/chats");
  const cab = await currentCabinet().catch(() => null);
  if (cab) redirect("/ru/cabinet");
  return <AppStart />;
}
