// Content-Security-Policy. Next's App Router injects inline bootstrap/hydration
// scripts, so without a per-request nonce we must allow 'unsafe-inline' for
// script/style — but we still lock the high-value vectors: no third-party script
// origins, no <object>/<embed>, no framing, no base-uri hijack, same-origin
// form posts + connections. img allows data:/blob: for the upload thumbnails.
// Dev (Turbopack HMR) needs 'unsafe-eval'; production builds never eval, so the
// deployed policy is the stricter one without it.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
