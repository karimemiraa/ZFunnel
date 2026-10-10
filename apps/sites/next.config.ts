import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Single .env at the repo root for every app (forceReload: Next already loaded the app dir).
loadEnvConfig(`${process.cwd()}/../..`, process.env.NODE_ENV !== "production", undefined, true);

const config: NextConfig = {
  transpilePackages: ["@zfunnel/db", "@zfunnel/blocks"],
  poweredByHeader: false,
};

export default config;
