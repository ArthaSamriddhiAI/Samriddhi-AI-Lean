import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Bundle the build-time-seeded SQLite DB into the serverless functions that
  // read it, so the file is present on Vercel's (otherwise read-only) runtime
  // filesystem. lib/prisma.ts then copies it to writable /tmp on cold start.
  // Covers the navigable DB-backed pages: cases list, case detail, investors.
  outputFileTracingIncludes: {
    "/cases": ["./prisma/dev.db"],
    "/cases/[id]": ["./prisma/dev.db"],
    "/investors": ["./prisma/dev.db"],
    "/investors/[id]": ["./prisma/dev.db"],
  },
  async rewrites() {
    return {
      // Serve the marketing landing page (public/landing.html) at the root
      // URL, ahead of the app-router "/" route, so visiting "/" shows the
      // landing standalone (no platform chrome). The URL stays "/". The
      // platform demo lives at /cases (the landing's CTAs point there).
      // app/page.tsx's redirect to /cases remains as a safe fallback.
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
    };
  },
};

export default config;
