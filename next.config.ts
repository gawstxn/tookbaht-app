import type { NextConfig } from "next";
import pkg from "./package.json";

const dev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Static CSP (no nonces) so pages can be prerendered and navigations stay
 * instant. Next.js needs inline scripts for its bootstrap data, hence
 * 'unsafe-inline'; everything else stays locked to this origin + Supabase.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!dev && supabaseUrl.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    // The app uses Supabase Auth and the database only. In the browser, swap the
    // Realtime and Storage clients (built eagerly by supabase-js) for tiny stubs;
    // server code (cron, admin) keeps the real packages.
    resolveAlias: {
      "@supabase/realtime-js": { browser: "./lib/stubs/realtime-js.ts" },
      "@supabase/storage-js": { browser: "./lib/stubs/storage-js.ts" },
    },
  },
  env: {
    // Shown under "ลบบัญชี" on the profile screen.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
