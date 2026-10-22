# Marketing Scholars

Paste a competitor's URL and get their reverse-engineered marketing as a PDF.
Add your brand and domain and get a full end-to-end marketing plan built from it.

| | Free teardown | Full plan (Pro, one-time UPI payment) |
|---|---|---|
| Input | Competitor URL | Competitor URL + either **I have a website** (brand name + domain) or **Starting fresh** (what you sell + who for, optional name, city, budget) |
| Output | ~9 page PDF with clickable contents | ~22 page PDF with clickable contents |
| Contents | Positioning, awareness and sophistication stage, audience, channel map, content engine, SEO footprint (incl. programmatic patterns), funnel and offer, tech stack, what works and whether it transfers, blind spots, quick wins | Everything in Free, plus positioning statement, ICP and where they gather, strategies (borrowed mechanism + our twist), prioritised channel plan, 30/60/90 execution plan with hours and kill rules, content pillars, 12-week content calendar, repurposing chain, article skeleton, SEO keywords, ad angles, 6-email sequence, swipe file, KPIs, risks |

The analysis follows the copycat-marketing method: **copy the mechanism, never the material**,
separate observation from inference, never state traffic or ad spend as numbers, and be honest
about what transfers.

## How it works

1. **Footprint** (`src/lib/crawler.ts`): reads public pages only. That means the homepage, the pricing and blog pages (if linked), `robots.txt`, `sitemap.xml` (including sitemap indexes) and `llms.txt`. From these it detects:
   - CTAs, headings and price points
   - social profiles and `/for/` segment pages
   - lead magnets, proof signals and UTM campaign names
   - JSON-LD schema types
   - about 55 tools: ad pixels, email/CRM, analytics, CRO, CMS, payments, affiliate
   - sitemap section counts, programmatic `/pattern/{slug}` footprints and the publishing rate over the last 90 days
2. **Teardown** (`src/lib/analyze.ts`, `src/lib/prompts.ts`): a free LLM interprets the observed signals into a structured JSON teardown.
3. **Plan** (Pro) has two paths, chosen in the form:
   - **I have a website:** your site is crawled too. `src/lib/compare.ts` builds a deterministic "You vs them" table (14 observed signals, each ahead/even/behind with a fix), and the plan opens with "Where you stand today".
   - **Starting fresh:** no crawl of your site. The plan opens with a launch kit (name ideas if you have no name, pages to build, homepage outline, launch checklist), and days 1-30 become "Launch foundations".

   Then four smaller LLM calls (current state or launch kit, strategy, execution and content, then SEO/ads/email/swipe). They run one after another so they stay under free-tier tokens-per-minute limits. Any section a model skips is filled from the rule-based plan.
4. **PDF** (`src/lib/pdf.tsx`): rendered server-side with `@react-pdf/renderer`, using built-in fonts so no network is needed. A contents page lists every section with its real page number and links to it; page numbers are read back from the rendered PDF's named destinations, so it renders twice.

**Works without any AI key.** If no provider is configured, or all of them fail, a rule-based engine (`src/lib/fallback.ts`) builds the report from observed signals only. That report is clearly labelled as rule-based.

## Free AI providers

Set at least one. They are tried in this order, and a rate limit or error on one falls through to the next.

| Provider | Env var | Default model | Get a key |
|---|---|---|---|
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | https://console.groq.com/keys |
| Google Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` | https://aistudio.google.com/apikey |
| OpenRouter | `OPENROUTER_API_KEY` | `meta-llama/llama-3.3-70b-instruct:free` | https://openrouter.ai/keys |
| Any OpenAI-compatible (Ollama, etc.) | `OPENAI_COMPAT_BASE_URL` | `OPENAI_COMPAT_MODEL` | |

Free-tier models and limits change often, so override the model with `GROQ_MODEL`, `GEMINI_MODEL` or `OPENROUTER_MODEL`.

## For the marketing team

Start with **[docs/MARKETING-TEAM-GUIDE.md](docs/MARKETING-TEAM-GUIDE.md)**: what the tool does, positioning and messaging, content plan, and how to run A/B tests on messaging.

## Landing page and A/B tests

The home page is a conversion-focused squeeze page with three A/B tests running at once: positioning, opener and design. Assignment happens in `src/middleware.ts`, copy lives in `src/lib/experiments.ts`, and events go through `/api/track` to Vercel logs and optionally PostHog. Preview a variant with `/?pos=a&hook=b&design=b`. See **[docs/LAUNCH.md](docs/LAUNCH.md)** for the test plan, how to read results, and the Product Hunt launch kit.

## Run locally

```bash
cp .env.example .env.local   # add a free AI key
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run build                # production build
```

## Deploy (free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frenukarane%2Freverse-engineering-marketing&project-name=marketing-scholars&env=GROQ_API_KEY&envDescription=Free%20Groq%20key%20for%20AI%20analysis%20(console.groq.com%2Fkeys).%20Add%20Razorpay%20and%20Resend%20keys%20later.&envLink=https%3A%2F%2Fgithub.com%2Frenukarane%2Freverse-engineering-marketing%2Fblob%2Fmain%2F.env.example)

Or import the existing repo, so Vercel deploys on every push to `main`:
1. At https://vercel.com/new, choose **Import Git Repository** and pick `renukarane/reverse-engineering-marketing`. Vercel detects Next.js; keep the defaults.
2. Under **Environment Variables**, add `GROQ_API_KEY` (and/or `GEMINI_API_KEY`). That is enough for a first test.
3. Click **Deploy**. You get a `https://<project>.vercel.app` URL in about a minute.
4. Set `NEXT_PUBLIC_APP_URL` to that URL and redeploy.

The Hobby plan is free and the API routes set `maxDuration = 60`.

**Test stages:**

| Stage | Add these env vars | What you can test |
|---|---|---|
| 1. Free reports | `GROQ_API_KEY` | Free teardown plus the full plan (free while Razorpay is unset) |
| 2. Email | `RESEND_API_KEY`, `EMAIL_FROM` | The PDF arrives by email |
| 3. Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test), `RAZORPAY_WEBHOOK_SECRET` | Paying with UPI ID `success@razorpay` emails the full plan |

## Payments (Razorpay, UPI only, India)

The full report is a **one-time UPI payment** (default ₹499) through Razorpay Standard Checkout. Cards, netbanking and wallets are hidden; buyers pay with Google Pay, PhonePe, Paytm, BHIM or any UPI app (QR on desktop, intent or collect on mobile).

How it works, with no database:
1. The user fills in the Pro form. `POST /api/checkout` validates the URLs and creates a Razorpay **Order** in INR. The report inputs are stored in the order's `notes`.
2. The page opens Razorpay Checkout as a modal, set to UPI only. On success Razorpay returns `order_id`, `payment_id` and `signature`.
3. The page sends those to `/api/analyze`. The server verifies the HMAC signature, confirms with Razorpay that the payment belongs to the order and is captured (capturing it if it is only authorized), then builds the report from the **order notes, not from the browser**.
4. The proof is kept in the browser for 7 days, so the user can rebuild the report.
5. The webhook (`order.paid`) builds and emails the PDF the moment payment completes, even if the buyer closes the tab.
6. A `report_emailed_at` note on the payment makes sure it is emailed exactly once.

### Setup

1. Sign up at https://dashboard.razorpay.com and complete KYC. Test mode works immediately; live mode needs activation.
2. Go to **Account & Settings → API Keys**, generate a key, and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Go to **Account & Settings → Webhooks** and add `https://YOUR_APP/api/razorpay/webhook`:
   - choose a secret and put it in `RAZORPAY_WEBHOOK_SECRET`
   - tick the event `order.paid`
4. Set `NEXT_PUBLIC_APP_URL`, and optionally `PRO_PRICE_PAISE`.
5. Test with UPI ID `success@razorpay` (succeeds) or `failure@razorpay` (fails) in test mode.
6. When ready, swap in the live keys (`rzp_live_...`) and create the webhook again in live mode.

### Gating modes (`proGate()` in `src/lib/billing.ts`)

| `PRO_FREE_BETA` | Razorpay keys | Full report |
|---|---|---|
| unset | unset | Free (beta) |
| unset | set | Paid via UPI |
| `true` | any | Free |
| `false` | unset | Access code only |

Access codes in `PRO_ACCESS_CODES` unlock the full report in every mode.

### GST

If your turnover crosses the GST threshold, or you need a GST invoice for B2B buyers, register for GST and add invoicing. Razorpay can generate invoices. Check with your CA.

## Email delivery (Resend)

Reports are emailed as PDF attachments through [Resend](https://resend.com). The free plan covers 3,000 emails a month (100 a day).

| Report | When it is emailed | Email address used |
|---|---|---|
| Free teardown | As soon as it is built. Email becomes a required field, so this is your lead capture. | The one typed in the form |
| Paid full plan | By the Razorpay webhook the moment payment completes | The one typed in the form, else the one entered in Razorpay Checkout |
| Paid, no webhook set | Right after payment, in the page | Same as above |
| Access-code report | As soon as it is built, if an email is given | The one typed in the form |

A paid report is emailed **once per payment**:
- A `report_emailed_at` note is stored on the Razorpay payment, so there is still no database.
- An in-flight guard stops webhook retries and page rebuilds from sending duplicates.
- If the webhook fails, the success page sends the PDF itself once the payment is more than 5 minutes old and still unsent.

Each email address gets at most 3 free reports an hour.

**Setup:**
1. Create a Resend account.
2. Verify your sending domain by adding the DNS records Resend gives you.
3. Set `RESEND_API_KEY` and `EMAIL_FROM`, for example `Marketing Scholars <reports@yourdomain.com>`.

Until your domain is verified, Resend only delivers to your own account address.

## Security

The server fetches URLs that users type in, so every request goes through `src/lib/safeFetch.ts`:
- **Allowed targets:** http/https on ports 80 and 443 only. URLs with credentials are rejected.
- **Private addresses:** localhost, `.local` and `.internal` hostnames are blocked, along with private, loopback, link-local, metadata and CGNAT IPs.
- **DNS rebinding:** the resolved IP is checked at connect time, so a rebinding trick can't slip past.
- **Redirects:** every hop is re-validated.
- **Limits:** responses are capped at 2.5 MB and requests time out after 12 seconds.
- **Rate limit:** 10 reports per IP per hour, in memory. Swap to Redis or Upstash for multi-instance deployments.

`ALLOW_PRIVATE_FETCH=true` exists only for local fixture testing and is ignored in production builds.

## Local end-to-end testing

```bash
node tests/fixtures/server.mjs &              # fake competitor site on :4321
PORT=4400 node tests/fixtures/mock-llm.mjs &  # fake OpenAI-compatible LLM
PORT=4500 node tests/fixtures/mock-razorpay.mjs & # fake Razorpay Orders/Payments; GET :4500/__pay/{order_id} simulates a UPI payment
PORT=4600 node tests/fixtures/mock-resend.mjs & # fake Resend; GET :4600/__sent lists sent emails
ALLOW_PRIVATE_FETCH=true OPENAI_COMPAT_BASE_URL=http://127.0.0.1:4400/v1 \
  RAZORPAY_KEY_ID=rzp_test_x RAZORPAY_KEY_SECRET=rzp_secret_test RAZORPAY_API_BASE=http://127.0.0.1:4500 RAZORPAY_WEBHOOK_SECRET=wh_test \
  RESEND_API_KEY=re_test RESEND_API_BASE=http://127.0.0.1:4600 EMAIL_FROM="Test <t@example.com>" npm run dev
curl -X POST localhost:3000/api/analyze -H 'content-type: application/json' \
  -d '{"competitorUrl":"http://127.0.0.1:4321","tier":"pro","brandName":"Acme","domain":"acme.com"}'
```

## Known limits (MVP)

- **JavaScript-rendered sites:** sites that render with JavaScript only return little server-side HTML. The report flags this.
- **Bot blocking:** some sites (Cloudflare challenges, etc.) block automated readers.
- **No paid SEO data:** there is no traffic, keyword or backlink data. Adding Ahrefs/Semrush/DataForSEO APIs is a natural Pro upgrade.
- **No ad library or social data:** ad libraries and social engagement aren't fetched. The report points users to the public ad libraries instead.
- **Reports are not stored:** the PDF is rendered from the report the browser holds, and a copy goes out by email.

## API

- `POST /api/analyze` with `{ competitorUrl, tier: "free"|"pro", email?, stage?: "existing"|"new", brandName?, domain?, niche?, location?, budget?, audience?, goal?, accessCode?, payment?: { orderId, paymentId, signature } }` returns a report as JSON, plus `delivery: { status: "sent"|"already"|"pending"|"failed"|"none", to? }`. It returns 402 when payment is needed.
- `POST /api/checkout` with `{ competitorUrl, stage?, brandName?, domain?, niche?, audience?, location?, budget?, goal?, email? } (existing needs brandName + domain; new needs niche + audience)` returns `{ orderId, amount, currency, keyId }` for Razorpay Checkout.
- `POST /api/report` with that report JSON returns the `application/pdf`.
- `POST /api/razorpay/webhook` is the Razorpay webhook (`order.paid`). It builds and emails paid reports.
- `GET /api/config` returns `{ proFreeBeta, proGate, price, aiEnabled, emailEnabled }`.
