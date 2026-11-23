import type { MetadataRoute } from "next";

/** Lets a phone install the site like an app (iPhone: «Поделиться» → «На экран „Домой“»). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlemWay",
    short_name: "AlemWay",
    description: "Кабинет клиента и чат с AlemWay",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#2340ff",
    lang: "ru",
    icons: [
      { src: "/brand/alemway_icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/brand/alemway_icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
