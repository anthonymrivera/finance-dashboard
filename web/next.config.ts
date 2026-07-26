import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * Next and Vercel send none of these by default, and this app serves account
 * balances and full transaction history — so they are worth setting explicitly.
 *
 * Content-Security-Policy is deliberately absent. Plaid Link loads scripts from
 * cdn.plaid.com and opens its own iframe, and a policy strict enough to be worth
 * having is easy to get subtly wrong in a way that only shows up mid-link, when
 * a bank connection fails. The XSS surface here is small (no user-generated
 * content is rendered) and session cookies are httpOnly, so a broken CSP would
 * cost more than it buys. Add one behind report-only first if it is ever wanted.
 */
const securityHeaders = [
  {
    // Force HTTPS for two years, including subdomains. Vercel terminates TLS,
    // so this only hardens what is already an HTTPS-only deployment.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // The app never needs to be framed. Blocks clickjacking outright — note
    // this concerns *us* being embedded, not Plaid's iframe inside our page.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Stops the browser second-guessing declared content types.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Send the origin cross-site, never the full path. Account and transaction
    // URLs should not leak into third-party referrer logs.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Nothing here uses these APIs; deny them so injected code cannot either.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
