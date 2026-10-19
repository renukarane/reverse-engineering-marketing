# Marketing Scholars: landing page A/B tests and Product Hunt launch kit

## 1. What's live on the landing page

One squeeze page with one job: get a visitor to paste a competitor URL. The form sits in the hero, and every other button scrolls back to it.

Section order follows the copywriting-secrets landing page recipe:
1. Hero: outcome headline, mechanism subheadline, form.
2. Animated "scanner" visual and a category marquee.
3. Stats.
4. Problem and agitation: the cost of guessing.
5. How it works, in 3 steps.
6. Fascination bullets: what's inside the free teardown.
7. Full-plan value stack, price, and risk reversal ("start free, only pay if you want the plan").
8. Ethics strip.
9. FAQ that handles objections.
10. Final CTA.

Motion is pure CSS, with no animation library:
- aurora light (design A)
- URL typing, scan beam, detected-signal chips, and the PDF sliding out
- scroll reveals, count-up stats and a CTA shimmer
- a marquee and fanned report pages
- an animated highlighter (design B)

All motion turns off for visitors who set "reduce motion".

## 2. The A/B tests

Two independent 50/50 experiments run at the same time (a factorial design). Every visitor is in both, so each test gets 100% of traffic. The design test is **closed**: the light **Editorial** design was chosen and is now everyone's default. You can still preview the old dark design with `?design=a`.

| Experiment | Arm A | Arm B | What we learn |
|---|---|---|---|
| `pos` positioning | **Reverse + build**: "Reverse-engineer your competitors' marketing strategies. Then build yours." | **Strategy → plan**: "Your competitor's marketing strategy, reverse-engineered. Your plan, built from it." | Which framing of the same promise pulls harder? |
| `hook` opener | **Founder authority**: "18 years of brand building, in one tool… Every brand transformation starts the same way: studying what already works." | **Curiosity**: "Every website leaks its marketing… The pixels it fires, the pages it builds…" | Does founder credibility or curiosity get more people into the form? |

**How assignment works:**
- `src/middleware.ts` gives each visitor a random variant on their first visit. It's stored in the `mm_ab` cookie for 90 days, so they always see the same page.
- The server renders that variant directly, so the page never flickers between versions.
- Preview any combination with `/?pos=a&hook=b&design=b`. Use `/?ab=reset` to re-roll.
- All copy lives in `src/lib/experiments.ts`. Edit the words there.

### Events tracked

Every event carries `exp_pos`, `exp_hook`, `exp_design` and `variant`:

| Event | Fires when |
|---|---|
| `lp_view` | page view, with `ref` from `?ref=`/`utm_source` (use `?ref=producthunt` on the PH link) |
| `cta_click` | any CTA, with `where`: nav, inside, offer, final |
| `report_started` / `report_completed` / `report_failed` | the generator runs; `tier` is free or pro |
| `pdf_download`, `html_view` | report delivered |
| `upgrade_click`, `checkout_started`, `payment_success` | money funnel |
| `scroll_50`, `faq_open` | engagement |

**Where events go:**
- Events go to our own `/api/track` endpoint, so ad blockers can't drop them.
- Every event is written to Vercel logs. Search for `ab_event`.
- If `POSTHOG_KEY` is set, events are also forwarded to PostHog.

### Setting up PostHog (free, 1M events a month)
1. Sign up at **https://posthog.com** (choose the US or EU cloud).
2. Go to **Project settings** and copy the **Project API key** (it starts with `phc_`).
3. In Vercel, go to **Settings → Environment Variables** and add:
   - `POSTHOG_KEY` = your key
   - `POSTHOG_HOST` = `https://us.i.posthog.com`, or `https://eu.i.posthog.com` if you chose the EU cloud
4. Redeploy.
5. In PostHog, create **Insights → Funnel**: `lp_view` → `report_started` → `report_completed`.
6. Set **Breakdown** to `exp_pos`. Duplicate the funnel for `exp_hook`.

### How to call a winner
- **Primary metric:** `report_completed / lp_view`, which is visitors who got a teardown. Once email is on, that's also your lead capture.
- **Secondary metrics:**
  - `cta_click / lp_view` (intent)
  - `upgrade_click` and `payment_success` (revenue)
- **Sample size:** at a 10% baseline, detecting a 2-point absolute lift (10% → 12%) needs about **3,800 visitors per arm** at 95% confidence and 80% power. Because the tests are factorial, that's about 7,600 total visitors for both tests. A Product Hunt launch day can deliver that.
- **Read only once each arm has its full sample.** Don't stop early because one arm "looks" ahead after 200 visits.
- **Ship winners one at a time.** Hard-code the winner in `src/lib/experiments.ts` (for example, always return `pos: "b"`), then start the next test in its place. Good next tests:
  - CTA wording
  - price anchor
  - form with or without the email field
  - hero visual vs a 30-second demo video

## 3. Product Hunt research (what top launches do)

The sources are mostly third-party guides and recaps, not Product Hunt itself, so treat the numbers as heuristics.

- **Competition is dense.** Twenty-plus new AI tools ship on Product Hunt every day, and the Marketing topic has about 460k followers. ([Dupple](https://dupple.com/learn/how-to-promote-your-ai-tool), [hunted.space](https://hunted.space/product/marsx/launches/ai-startups))
- **A closely comparable launch did well.** A "Competitor Analysis" tool got **666 votes and 146 comments** on its September 2024 Product Hunt launch, so the category has demand. ([Innolope PULSE](https://innolope.com/pulse/startups/691682271c4a6b1baf15b65b))
- **Recent winners share three traits.** In 2025 recaps (Lovable, PostHog, Framer AI, Replit Agent), the top launches won on:
  - vote and comment velocity in the first 4 hours
  - a narrow, shareable scope
  - trust signals
  - a launch-only offer that creates real scarcity

  ([FlowJam](https://www.flowjam.com/blog/top-product-hunt-launches-2025-the-12-that-broke-the-internet))
- **Rough targets for a top-5 finish:** 600–900+ upvotes, 120+ comments and about 1,500 launch-day signups. Launch Tuesday to Thursday, never Monday or Friday. Never ask for upvotes directly or use upvote-exchange groups. ([launch skill benchmarks](https://skillselion.com/skills/chadboyda/agent-gtm-skills/multi-platform-launch), [Ampliz checklist](https://www.ampliz.com/resources/?p=2587))
- **Assets** ([LaunchList guide](https://app.getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026), [Tessl skill](https://tessl.io/registry/skills/github/kostja94/marketing-skills/product-hunt-launch)):
  - Tagline: 60 characters or fewer, benefit-led, no emoji.
  - Gallery: images at 1270×760 (check the current spec when uploading) plus a demo video under 2 minutes.
  - Maker comment: post it in the first 2 minutes. It should tell a story, mention the launch offer, and end with a question.
- **Build a supporter list first.** Create the Product Hunt "upcoming" teaser page about 2 months ahead, so people can click Notify. Aim for 200–400 people who will show up on launch day. ([saner.ai](https://saner.ai/grind-to-get-product-of-the-day-on-product-hunt))
- **Featured status matters.** Products Product Hunt doesn't feature can't win Product of the Day, whatever their upvotes. ([gracker.ai](https://gracker.ai/b2b-saas-growth-tools/tool/product-hunt-ai))

## 4. Our launch plan

**One decision to make first.** Product Hunt's audience is global, but payment is UPI-only (India). For launch week, set `PRO_FREE_BETA=true` so the full plan is free for everyone. The site then shows a true "Launch week: the full plan is free" bar. That's honest scarcity, which recent winners used. It also collects global emails and gives a reason to comment. Switch payments on after launch week.

### Tagline options (60 characters or fewer)
1. `Reverse-engineer competitors' marketing, then build yours` (59)
2. `Your competitor's marketing strategy, reverse-engineered` (56)
3. `Study what works for competitors, build your strategy` (53)

Pick the one matching the winning `pos` arm, if you have data by then.

### Description (260 characters or fewer)
> Paste a competitor's URL. Marketing Scholars reverse-engineers their marketing strategy from their public site (ad pixels, SEO pages, pricing, funnel) into a free PDF. Add your brand and build your own 90-day plan from what already works for them.

### Maker first comment (post within 2 minutes)
> Hey Product Hunt 👋 I'm Renuka.
>
> For 18 years I've done the same homework before every big campaign: study what's already working. At Atlas Copco I marketed four industrial brands across the Middle East, and before that I ran channel marketing across 400+ partners in India. The brands that grew fastest never started from a blank page. They took apart the best players in their market, understood *why* their marketing worked, then built something better.
>
> That homework takes weeks. Marketing Scholars does it in a minute.
>
> Paste any competitor's URL and get their strategy as a PDF: which ad and email tools they run, how many SEO pages they've built (and the template behind them), their entry offer and pricing model, and the blind spots you can own. Add your own brand and it builds yours: positioning, a 30/60/90 plan with stop rules, a 12-week content calendar, SEO keywords, ad angles and a welcome email sequence.
>
> Two promises: we only read public pages, and the report teaches the *mechanism*, never to copy anyone's words or design.
>
> **Launch week: the full plan is free for the Product Hunt community.**
>
> I'd love your honest take: whose site did you run, and what did it get wrong? Every comment goes straight into the next version.

### Gallery (1270×760, 5 images and 1 video)
1. The hero with its headline, and the scanner animation mid-scan.
2. The free teardown PDF: channel map and blind spots.
3. "What works and whether it transfers": the table page.
4. The full plan's 30/60/90 table and 12-week calendar.
5. "Public pages only. Mechanism, not material." This is the trust slide.
6. Video, 30–45 seconds: paste URL → chips pop → PDF opens → scroll the plan. No voice-over needed; use captions.

### Timeline
| When | What |
|---|---|
| T-8 weeks | Create the Product Hunt "upcoming" page and share it everywhere you have an audience. Goal: 300+ Notify. |
| T-4 weeks | Run the A/B tests on non-Product Hunt traffic (LinkedIn, X, communities), ship the winners, add the Groq and Resend keys. |
| T-1 week | Line up a hunter (optional), finish the gallery and video, and personally message supporters to tell them launch day. Ask for feedback, not votes. |
| Launch day, Tue–Thu, 12:01am PT (12:31pm IST) | Post the maker comment immediately, answer every comment within 15 minutes for the first 6 hours, and share with `?ref=producthunt`. |
| T+1 day | Post a "what we learned" thread with real numbers, then switch the paid plan on. |

## 5. Before this goes public: checklist
- [ ] `GROQ_API_KEY` set (otherwise reports are rule-based)
- [ ] `RESEND_API_KEY`, `EMAIL_FROM` with a verified domain (so the free PDF is emailed and leads are captured)
- [ ] `POSTHOG_KEY` (so the A/B results are readable)
- [ ] `PRO_FREE_BETA=true` for launch week
- [ ] Run 5 real competitor sites and read each PDF yourself
- [ ] Add real testimonials only once you have them. The page deliberately shows no fake social proof.
