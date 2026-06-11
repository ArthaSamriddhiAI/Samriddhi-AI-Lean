import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  /* The onboarding ingestion adapters (Package 07) run pdfjs and xlsx in
   * server actions. Webpack's server bundle breaks pdfjs's dynamic worker
   * import (vendor-chunks/pdf.worker.mjs does not exist); resolving both
   * packages from node_modules at runtime, exactly as the offline verify
   * scripts do, keeps one behaviour everywhere. */
  serverExternalPackages: ["pdfjs-dist", "xlsx"],
  /* Node 25 plus webpack 5 crash the WASM-backed xxhash64 hasher
   * (WasmHash._updateWithBuffer reads length of undefined) during the
   * production build. Force webpack to use Node's crypto sha256 hasher
   * instead; the wasm path is never entered. Output is deterministic. */
  webpack: (webpackConfig) => {
    if (webpackConfig.output) {
      webpackConfig.output.hashFunction = "sha256";
    }
    return webpackConfig;
  },
};

export default config;
