import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
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
