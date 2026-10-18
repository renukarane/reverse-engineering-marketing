import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketMirror: reverse engineer any competitor's marketing",
  description: "Paste a competitor URL. Get their reverse-engineered marketing teardown as a PDF, free. Add your brand for a full end-to-end marketing plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
