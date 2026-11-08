import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход" };

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm p-7 sm:p-8">
        <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">AlemWay</p>
        <h1 className="mt-1 text-[24px] font-bold">Вход в админку</h1>
        <LoginForm />
      </div>
    </main>
  );
}
