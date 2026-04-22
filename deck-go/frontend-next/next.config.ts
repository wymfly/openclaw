import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function resolveConnectSrc(): string {
  const sources = new Set(["'self'", "ws:", "wss:"]);
  for (const raw of [process.env.NEXT_PUBLIC_DECK_GO_API_BASE, process.env.DECK_GO_API_BASE]) {
    if (!raw?.trim()) {
      continue;
    }
    try {
      const target = new URL(raw);
      sources.add(target.origin);
      if (target.protocol === "http:" || target.protocol === "ws:") {
        sources.add(`ws://${target.host}`);
      }
      if (target.protocol === "https:" || target.protocol === "wss:") {
        sources.add(`wss://${target.host}`);
      }
    } catch {
      // Ignore invalid env values and keep the default CSP.
    }
  }
  return Array.from(sources).join(" ");
}

const connectSrc = resolveConnectSrc();

const nextConfig: NextConfig = {
  // Server needs native modules (ws)
  serverExternalPackages: ["ws"],
  // Support standalone output for Docker deployment
  output: "standalone",

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              `connect-src ${connectSrc}`,
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
