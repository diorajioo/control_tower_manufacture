/** @type {import('next').NextConfig} */

// The page CSP needs a per-request nonce, so middleware.ts sets it; /api gets its own below.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options",                    value: "DENY" },
  { key: "X-Content-Type-Options",             value: "nosniff" },
  { key: "X-XSS-Protection",                   value: "1; mode=block" },
  { key: "Referrer-Policy",                    value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security",          value: "max-age=31536000; includeSubDomains; preload" },
  { key: "Permissions-Policy",                 value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy",         value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy",       value: "same-origin" },
];

const nextConfig = {
  // Self-contained server in .next/standalone for the Docker image (Kubernetes); Vercel ignores it
  output: "standalone",
  // On Kubernetes the app sits at https://poros-staging.paradev.io/ct-manuf (build arg in the
  // Dockerfile, set by .gitlab-ci.yml). Empty on Vercel and locally. See lib/basePath.ts.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  // No next/image in the app — turning the Image Optimization API off closes its advisories on Next 14
  images: { unoptimized: true },
  // Next 15: moved out of `experimental` (was serverComponentsExternalPackages)
  serverExternalPackages: ["snowflake-sdk"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      // /api only ever answers JSON (and the odd text). Should anything here ever echo input back
      // as HTML, this keeps it from running as a page on the host the other dashboards share.
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" }],
      },
    ];
  },
};

export default nextConfig;
