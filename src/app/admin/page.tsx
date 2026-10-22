import type { Metadata } from "next";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = { title: "Admin | Marketing Scholars", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="wrap admin">
      <AdminPanel />
    </main>
  );
}
