import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Let phones on the home network (and 127.0.0.1) load `next dev`.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
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
