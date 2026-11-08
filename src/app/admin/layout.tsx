import "@fontsource-variable/inter/wght.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Админка — AlemWay", template: "%s — Админка AlemWay" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2340ff" };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-surface antialiased">{children}</body>
    </html>
  );
}
