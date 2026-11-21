import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // Shown in the menu. Bump package.json "version" (patch) on every push to main.
  // Served at games.hailatat.icu/classicsudoku (the hub proxies /classicsudoku/* here, Next.js multi-zones).
  basePath: "/classicsudoku",
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version, NEXT_PUBLIC_BASE_PATH: "/classicsudoku" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
