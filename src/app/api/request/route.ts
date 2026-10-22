import { NextResponse } from "next/server";
import { validAccessCode } from "@/lib/access";
import { proGate } from "@/lib/billing";
import { appUrl } from "@/lib/deliver";
import { rateLimit } from "@/lib/rateLimit";
import { checkReportInput, clientIp, EmailSchema, ReportFields } from "@/lib/reportInput";
import { confirmFlowOn, createRequest } from "@/lib/requests";

export const runtime = "nodejs";

// Step 1 of an emailed report: save the request and email a confirmation link.
// Nothing is built until the visitor clicks it (see /api/confirm).
export async function POST(req: Request) {
  if (!confirmFlowOn()) return NextResponse.json({ error: "Email delivery is not set up yet." }, { status: 400 });
  const parsed = ReportFields.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid competitor URL." }, { status: 400 });
  const b = parsed.data;

  const email = (b.email ?? "").toLowerCase();
  if (!EmailSchema.safeParse(email).success) return NextResponse.json({ error: "Please enter a valid email address. We send the report there." }, { status: 400 });
  const checked = checkReportInput(b);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (checked.tier === "pro" && proGate() !== "free" && !validAccessCode(b.accessCode)) {
    return NextResponse.json(
      { error: proGate() === "razorpay" ? "The full report needs payment." : "The full report needs a valid access code.", code: "PAYWALL" },
      { status: 402 },
    );
  }

  const ip = clientIp(req);
  const emailRl = rateLimit(`email:${email}`, 3);
  if (!emailRl.ok) return NextResponse.json({ error: "Too many reports for that email. Try again in an hour." }, { status: 429 });
  const rl = rateLimit(ip);
  if (!rl.ok) return NextResponse.json({ error: `Too many reports from your network. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` }, { status: 429 });

  try {
    await createRequest({ email, tier: checked.tier, inputs: checked.inputs, ip, appUrl: appUrl(new URL(req.url).origin) });
    return NextResponse.json({ status: "confirm_sent", to: email });
  } catch (e) {
    console.error("[request]", e);
    return NextResponse.json({ error: "We could not send the confirmation email. Check the address and try again." }, { status: 502 });
  }
}
