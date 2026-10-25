import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
