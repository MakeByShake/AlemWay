import "@fontsource-variable/inter/wght.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";

export const metadata: Metadata = {
  title: "AlemWay",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "AlemWay", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2340ff" };

/** The app's start screen lives outside the language folders: the app opens it first. */
export default function AppRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-surface antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
