"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";

type State =
  | { s: "working" }
  | { s: "building"; to: string; tier: string }
  | { s: "already"; to: string; sent: boolean }
  | { s: "expired" | "invalid" }
  | { s: "error"; message: string };

// Confirms on load with a POST, not on the link's GET, so email scanners that
// open links do not confirm on the visitor's behalf.
export default function ConfirmEmail({ token }: { token: string }) {
  const [state, setState] = useState<State>({ s: "working" });
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (!token) return setState({ s: "invalid" });
    fetch("/api/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (d.status === "building") {
          track("email_confirmed", { tier: d.tier });
          setState({ s: "building", to: d.to, tier: d.tier });
        } else if (d.status === "already") setState({ s: "already", to: d.to, sent: d.sent });
        else if (d.status === "expired" || d.status === "invalid") setState({ s: d.status });
        else setState({ s: "error", message: d.error || "Something went wrong." });
      })
      .catch(() => setState({ s: "error", message: "Could not reach the server. Check your connection and reload this page." }));
  }, [token]);

  return (
    <div className="card confirm" role="status">
      {state.s === "working" && <h1>Confirming your email…</h1>}
      {state.s === "building" && (
        <>
          <h1>✅ Email confirmed</h1>
          <p>
            We are building your {state.tier === "pro" ? "full marketing plan" : "competitor teardown"} now. The PDF will arrive at <b>{state.to}</b>, usually within
            two minutes.
          </p>
          <p className="note">You can close this page. Not in your inbox? Check spam or promotions.</p>
        </>
      )}
      {state.s === "already" && (
        <>
          <h1>Already confirmed</h1>
          <p>{state.sent ? <>We already emailed this report to <b>{state.to}</b>.</> : <>Your report is on its way to <b>{state.to}</b>.</>}</p>
          <p className="note">Not in your inbox? Check spam or promotions.</p>
        </>
      )}
      {state.s === "expired" && (
        <>
          <h1>This link has expired</h1>
          <p>Confirmation links work for 24 hours. Request your report again and we will send a new one.</p>
        </>
      )}
      {state.s === "invalid" && (
        <>
          <h1>This link does not work</h1>
          <p>It may be incomplete. Open it straight from the email, or request your report again.</p>
        </>
      )}
      {state.s === "error" && (
        <>
          <h1>Something went wrong</h1>
          <p>{state.message}</p>
        </>
      )}
      {state.s !== "working" && state.s !== "building" && (
        <p style={{ marginTop: 18 }}>
          <a className="btn" href="/#start">Get a report</a>
        </p>
      )}
    </div>
  );
}
