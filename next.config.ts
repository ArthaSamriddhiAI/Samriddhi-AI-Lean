import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
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
