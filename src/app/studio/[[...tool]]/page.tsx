import { isSanityConfigured } from "@/sanity/env";
import { Studio } from "./Studio";

export const dynamic = "force-static";

export default function StudioPage() {
  if (!isSanityConfigured) {
    return (
      <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "80px auto", padding: 16, lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 24 }}>Админка ещё не подключена</h1>
        <p>
          Добавьте переменные <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> и <code>NEXT_PUBLIC_SANITY_DATASET</code> в
          настройки Vercel (Settings → Environment Variables) и сделайте Redeploy. Подробно — в README.md, раздел «Sanity».
        </p>
      </main>
    );
  }
  return <Studio />;
}
