import type { Metadata, Viewport } from "next";
import "./globals.css";

const url = process.env.NEXT_PUBLIC_APP_URL || "https://reverse-engineering-marketing.vercel.app";
const title = "Marketing Scholars: reverse-engineer your competitors' marketing strategies, then build yours";
const description =
  "Paste any competitor's URL. Get their marketing strategy (channels, SEO, funnel, offer and blind spots) as a free PDF in under a minute. Then build your own 90-day plan from it.";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  openGraph: { title, description, url, siteName: "Marketing Scholars", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = { themeColor: "#f6f2ea" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
