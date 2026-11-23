import { Suspense } from "react";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { ChatsApp } from "@/components/admin/chat/ChatsApp";

export const metadata = { title: "Чаты" };

/** Chats with clients: the list, the open chat and the client's profile. Everything is loaded by the browser. */
export default async function ChatsPage() {
  const me = await requireAdminUser();
  return (
    <Suspense>
      <ChatsApp full={isFullRole(me.role)} myName={me.name} />
    </Suspense>
  );
}
