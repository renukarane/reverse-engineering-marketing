# MarketMirror

Paste a competitor's URL and get their reverse-engineered marketing as a PDF.
Add your brand and domain and get a full end-to-end marketing plan built from it.

| | Free teardown | Full plan (Pro, one-time Stripe payment) |
|---|---|---|
| Input | Competitor URL | Competitor URL + your brand name + your domain (+ optional niche, audience, goal) |
| Output | ~7 page PDF | ~17 page PDF |
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
3. **Plan** (Pro): three smaller LLM calls (strategy, execution and content, then SEO/ads/email/swipe). They run one after another so they stay under free-tier tokens-per-minute limits. Any section a model skips is filled from the rule-based plan.
4. **PDF** (`src/lib/pdf.tsx`): rendered server-side with `@react-pdf/renderer`, using built-in fonts so no network is needed.

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

## Run locally

```bash
cp .env.example .env.local   # add a free AI key
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run build                # production build
```

## Deploy (free)

Vercel Hobby works out of the box:
1. Import the repo.
2. Add the env vars from `.env.example`.
3. Deploy.

The API routes set `maxDuration = 60`.

## Payments (Stripe)

The full report is a **one-time Stripe Checkout payment per report** (default $19). Stripe fully supports US businesses and customers. Cards, Apple Pay, Google Pay and Link work out of the box, and promo codes are enabled.

How it works, with no database:
1. The user fills in the Pro form. `POST /api/checkout` validates the URLs and creates a Checkout Session. The report inputs (competitor URL, brand, domain, niche, audience, goal) are stored in the session's `metadata`.
2. The user pays on Stripe's hosted page. Stripe sends them back to `/?session_id=cs_...`.
3. The page calls `/api/analyze` with that `sessionId`. The server retrieves the session from Stripe, checks `payment_status === "paid"`, and builds the report from the **metadata, not from the browser**. A session id can therefore only rebuild the report it paid for.
4. The session id is kept in the browser for 7 days, so the user can rebuild the report if they close the tab. Each paid session is limited to 5 builds an hour.

### Setup

1. Create a Stripe account at https://dashboard.stripe.com (a US business entity or sole proprietor works).
2. In test mode, copy the secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`.
3. Optional: set `PRO_PRICE_CENTS`, or create a Product and Price in the dashboard and set `STRIPE_PRICE_ID`.
4. Set `NEXT_PUBLIC_APP_URL` to your deployed URL.
5. Test with card `4242 4242 4242 4242`, any future date and any CVC.
6. When ready, complete account activation, then swap in the `sk_live_...` key.

### Gating modes (`proGate()` in `src/lib/billing.ts`)

| `PRO_FREE_BETA` | `STRIPE_SECRET_KEY` | Full report |
|---|---|---|
| unset | unset | Free (beta) |
| unset | set | Paid via Stripe |
| `true` | any | Free |
| `false` | unset | Access code only |

Access codes in `PRO_ACCESS_CODES` unlock the full report in every mode, which is useful for testers and comps.

### Sales tax

Set `STRIPE_AUTOMATIC_TAX=true` after enabling Stripe Tax in the dashboard. Whether you must collect sales tax depends on the states you have nexus in, so check with an accountant.

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
PORT=4500 node tests/fixtures/mock-stripe.mjs & # fake Stripe Checkout API
ALLOW_PRIVATE_FETCH=true OPENAI_COMPAT_BASE_URL=http://127.0.0.1:4400/v1 \
  STRIPE_SECRET_KEY=sk_test_dummy STRIPE_API_BASE=http://127.0.0.1:4500 npm run dev
curl -X POST localhost:3000/api/analyze -H 'content-type: application/json' \
  -d '{"competitorUrl":"http://127.0.0.1:4321","tier":"pro","brandName":"Acme","domain":"acme.com"}'
```

## Known limits (MVP)

- **JavaScript-rendered sites:** sites that render with JavaScript only return little server-side HTML. The report flags this.
- **Bot blocking:** some sites (Cloudflare challenges, etc.) block automated readers.
- **No paid SEO data:** there is no traffic, keyword or backlink data. Adding Ahrefs/Semrush/DataForSEO APIs is a natural Pro upgrade.
- **No ad library or social data:** ad libraries and social engagement aren't fetched. The report points users to the public ad libraries instead.
- **Reports are not stored:** the PDF is rendered from the report the browser holds. A webhook that emails the PDF after payment would be a good next step.

## API

- `POST /api/analyze` with `{ competitorUrl, tier: "free"|"pro", brandName?, domain?, niche?, audience?, goal?, accessCode?, sessionId? }` returns a report as JSON. It returns 402 when payment is needed.
- `POST /api/checkout` with `{ competitorUrl, brandName, domain, niche?, audience?, goal?, email? }` returns `{ url }` for Stripe Checkout.
- `POST /api/report` with that report JSON returns the `application/pdf`.
- `GET /api/config` returns `{ proFreeBeta, proGate, price, aiEnabled }`.
