import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Production (crm.hayrli.app) runs this as `node server.js` under a
  // systemd unit (hayrli-web.service) with a trimmed node_modules — the
  // standalone output shape. This was never actually committed here; the
  // server's current build was produced from an uncommitted local tweak,
  // which is why a plain `npm run build` doesn't reproduce what's deployed.
  output: "standalone",

  // Hide the framework fingerprint. Small win, but the audit called it
  // out and there is zero downside to disabling.
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "https://api.hayrli.app/api/v1/:path*",
      },
    ];
  },

  // Minimum viable security headers. Deliberately NOT adding a CSP:
  // TODO: CSP requires audit of KakaoMapPicker.tsx and YandexMapPicker.tsx
  // external hosts (dapi.kakao.com, api-maps.yandex.ru, tile servers,
  // etc.) before enabling — leaving that to a follow-up so we don't ship
  // a header that breaks map onboarding.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
