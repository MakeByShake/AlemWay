import type { ReactNode } from "react";

// The real <html> is rendered in app/[locale]/layout.tsx and app/studio/layout.tsx.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
