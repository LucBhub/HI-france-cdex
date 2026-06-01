import type { NextConfig } from "next";

console.log("[NextConfig] Loading config...");
console.log(
  "[NextConfig] INTERNAL_API_URL env var:",
  process.env.INTERNAL_API_URL,
);

const internalApiUrl = process.env.INTERNAL_API_URL || "http://backend:3002";
console.log("[NextConfig] Using INTERNAL_API_URL (evaluated):", internalApiUrl);

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: process.cwd(),
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },

  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    const internalApiUrl =
      process.env.INTERNAL_API_URL || "http://backend:3002";
    console.log("[NextConfig] Runtime INTERNAL_API_URL:", internalApiUrl);
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
