import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// CSP for the public site. 'unsafe-inline' is needed for scripts because pages are static (ISR),
// so per-request nonces are not possible. Hosts: Sanity (content/images), Yandex Metrika, Vercel Analytics.
const siteCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://mc.yandex.ru https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://cdn.sanity.io https://mc.yandex.ru",
  "font-src 'self'",
  "connect-src 'self' https://*.sanity.io https://mc.yandex.ru https://*.vercel-insights.com",
  "frame-src 'self' https://mc.yandex.ru",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: commonHeaders },
      // Public site gets a strict CSP. The admin (/studio) is a large Sanity app with its own needs,
      // so it only gets the anti-framing rule plus the common headers above.
      { source: "/((?!studio).*)", headers: [{ key: "Content-Security-Policy", value: siteCsp }] },
      {
        source: "/studio/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  // Classic ISR model: pages are static and refreshed by the Sanity webhook.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default withNextIntl(nextConfig);
