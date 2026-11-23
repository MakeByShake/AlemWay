import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { ShareInbox } from "@/components/admin/ShareInbox";

export const metadata = { title: "Файл в карточку клиента" };

/** Files shared to AlemWay from WhatsApp or the gallery wait here until a team member picks the client. */
export default async function SharePage({ searchParams }: { searchParams: Promise<{ lost?: string }> }) {
  const me = await requireAdminUser();
  const { lost } = await searchParams;
  return <ShareInbox full={isFullRole(me.role)} lost={lost === "1"} />;
}
