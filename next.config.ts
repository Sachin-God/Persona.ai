import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure server build is standalone so node_modules are packaged with the server
  output: "standalone",

  images: {
    domains: ["res.cloudinary.com"],
  },

  // If you're on Next 14+ you may have 'optimizePackageImports' in experimental
  experimental: {
    // Prevent Next's package optimizer from tree-shaking/pruning @prisma/client
    // (adjust to your Next version if this key lives elsewhere)
    optimizePackageImports: ["@prisma/client"],
  },

  // Keep server-side runtime behavior predictable
  // (no need to transpile @prisma/client on server; leave it as is)
  // If you're using pnpm/workspaces, consider transpilePackages if Next complains.
};

export default nextConfig;
