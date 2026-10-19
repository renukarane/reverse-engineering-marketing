import type { Metadata, Viewport } from "next";
import "./globals.css";

const url = process.env.NEXT_PUBLIC_APP_URL || "https://reverse-engineering-marketing.vercel.app";
const title = "MarketMirror: see exactly how your competitor gets customers";
const description =
  "Paste any competitor's URL. Get their marketing playbook (channels, SEO, funnel, offer and blind spots) as a free PDF in under a minute. Then turn it into your own 90-day plan.";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  openGraph: { title, description, url, siteName: "MarketMirror", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = { themeColor: "#070816" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
