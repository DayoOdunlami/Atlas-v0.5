import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    // Resolve bare `app-types/*` imports to our local stub directory
    config.resolve.alias = {
      ...config.resolve.alias,
      "app-types": path.resolve(__dirname, "src/lib/app-types"),
    };

    // vega-canvas tries to require the native `canvas` package for server-side
    // rendering. Since Atlas charts are always client-side, stub it out so the
    // server bundle doesn't crash during build.
    if (isServer) {
      config.resolve.alias["canvas"] = false;
    }

    return config;
  },
};

export default nextConfig;
