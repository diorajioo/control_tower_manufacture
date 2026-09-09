/** @type {import('next').NextConfig} */

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",                              // Next.js hydration
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.groq.com https://graph.microsoft.com https://login.microsoftonline.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy",            value: CSP },
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
  experimental: {
    serverComponentsExternalPackages: ["snowflake-sdk"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
