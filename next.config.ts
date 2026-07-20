import type { NextConfig } from "next";

/**
 * next.config.ts
 *
 * Performance improvements added in issue #85 (reduce initial render time):
 * - `images.formats`: serve AVIF/WebP where the browser supports them.
 * - `compress`: enable gzip/br compression for all responses.
 * - `poweredByHeader`: remove the `X-Powered-By` header (minor payload trim).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Serve modern image formats (AVIF then WebP) where supported.
  // The 339 KB PNG splash icon shrinks substantially in AVIF.
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Enable HTTP compression (gzip / brotli) for all responses.
  compress: true,

  // Strip the X-Powered-By: Next.js header to shave a few bytes.
  poweredByHeader: false,
};

export default nextConfig;
