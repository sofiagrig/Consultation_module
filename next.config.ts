import type { NextConfig } from "next";

// Every screen is per-user (permissions come from the signed-in session), so pages render
// on request. Same setup as the clinic contacts module (sofiagrig/dental-branch-directory).
const nextConfig: NextConfig = {
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
