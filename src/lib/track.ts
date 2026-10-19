// Client-side event helper. Fire-and-forget to our own /api/track endpoint.
export type TrackEvent =
  | "lp_view"
  | "cta_click"
  | "scroll_50"
  | "faq_open"
  | "report_started"
  | "report_completed"
  | "report_failed"
  | "pdf_download"
  | "html_view"
  | "upgrade_click"
  | "checkout_started"
  | "payment_success";

export function track(event: TrackEvent, props?: Record<string, string | number | boolean>) {
  try {
    const body = JSON.stringify({ event, props });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch {
    /* analytics must never break the page */
  }
}
