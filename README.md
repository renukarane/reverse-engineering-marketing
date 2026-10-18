# MarketMirror

Paste a competitor's URL and get their reverse-engineered marketing as a PDF.
Add your brand and domain and get a full end-to-end marketing plan built from it.

| | Free teardown | Full plan (Pro, free during beta) |
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

## Paid tier

The paid tier is gated but free for now:
- `PRO_FREE_BETA=true` (the default) unlocks the full plan for everyone.
- `PRO_FREE_BETA=false` requires an access code from `PRO_ACCESS_CODES` (comma-separated). This is a stand-in until payments are added.

The paywall check lives in `src/lib/access.ts` and `src/app/api/analyze/route.ts`, where it returns HTTP 402. To add payments, have a Stripe or Lemon Squeezy checkout webhook issue codes or set a signed cookie, then check it there.

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
ALLOW_PRIVATE_FETCH=true OPENAI_COMPAT_BASE_URL=http://127.0.0.1:4400/v1 npm run dev
curl -X POST localhost:3000/api/analyze -H 'content-type: application/json' \
  -d '{"competitorUrl":"http://127.0.0.1:4321","tier":"pro","brandName":"Acme","domain":"acme.com"}'
```

## Known limits (MVP)

- **JavaScript-rendered sites:** sites that render with JavaScript only return little server-side HTML. The report flags this.
- **Bot blocking:** some sites (Cloudflare challenges, etc.) block automated readers.
- **No paid SEO data:** there is no traffic, keyword or backlink data. Adding Ahrefs/Semrush/DataForSEO APIs is a natural Pro upgrade.
- **No ad library or social data:** ad libraries and social engagement aren't fetched. The report points users to the public ad libraries instead.
- **Reports are not stored:** the PDF is rendered from the report the browser holds.

## API

- `POST /api/analyze` with `{ competitorUrl, tier: "free"|"pro", brandName?, domain?, niche?, audience?, goal?, accessCode? }` returns a report as JSON.
- `POST /api/report` with that report JSON returns the `application/pdf`.
- `GET /api/config` returns `{ proFreeBeta, aiEnabled }`.
