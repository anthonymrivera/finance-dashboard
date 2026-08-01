import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";

/**
 * Self-hosted at build time by next/font — no runtime Google requests. The
 * design's voice is this serif; without it, every non-Apple device fell back
 * from Iowan Old Style to Georgia and the whole register changed. The `opsz`
 * axis matters: it keeps hairline details at text sizes and tightens the lede
 * figure at display size.
 */
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-serif-vf",
});

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "Every account, one view.",
  // This app renders private financial data; keep it out of search indexes
  // even if the URL is ever shared or leaks via a referrer header.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={serif.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
