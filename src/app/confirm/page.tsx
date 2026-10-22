import type { Metadata } from "next";
import ConfirmEmail from "@/components/ConfirmEmail";

export const metadata: Metadata = { title: "Confirm your email | Marketing Scholars", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="wrap narrow">
      <p className="brandmark">Marketing <span>Scholars</span></p>
      <ConfirmEmail token={typeof token === "string" ? token : ""} />
    </main>
  );
}
