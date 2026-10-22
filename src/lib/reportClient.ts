"use client";

import { reportHtml } from "./reportHtml";
import type { Report } from "./types";

// Browser helpers to save or open a report the page already holds. Used by the
// admin page, and by the main page until email-only delivery is switched on.

/** Asks the server to render the PDF, then downloads it. Throws a readable error. */
export async function downloadReportPdf(report: Report): Promise<void> {
  // iPhone/iPad Safari ignores programmatic downloads and blocks pop-ups opened
  // after an await, so open the tab now, inside the click, and fill it in later.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const tab = ios ? window.open("", "_blank") : null;
  try {
    const res = await fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
    if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Could not build the PDF (error ${res.status}).`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "marketing-report.pdf";
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Revoking straight away cancels the download in Safari and Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** Opens the printable HTML report in a new tab. Call it synchronously in a click so pop-up blockers allow it. */
export function openReportHtml(report: Report): void {
  const url = URL.createObjectURL(new Blob([reportHtml(report, window.location.origin)], { type: "text/html" }));
  const w = window.open(url, "_blank");
  if (!w) window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
