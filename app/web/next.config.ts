import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // npm run e2e builds into its own folder, so it can run next to `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  // Let phones on the home network (and 127.0.0.1) load `next dev`.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
  // The dev badge sits over the drawing toolbar on phones (every corner has a
  // control). Errors still show in the dev overlay.
  devIndicators: false,
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
