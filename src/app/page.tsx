import { cookies, headers } from "next/headers";
import Generator from "@/components/Generator";
import LandingEffects from "@/components/LandingEffects";
import ScannerVisual from "@/components/ScannerVisual";
import { priceLabel, proGate } from "@/lib/billing";
import { AB_COOKIE, copyFor, parseVariant, randomVariant } from "@/lib/experiments";
import "./landing.css";

export const dynamic = "force-dynamic";

const CATEGORIES = ["D2C brands", "SaaS", "Edtech", "Fintech", "Agencies", "Coaches", "Creators", "Local services", "Marketplaces", "Health & wellness", "Travel", "B2B services"];

const BULLETS = [
  "Which ad pixels they fire, so you know exactly where they retarget your visitors",
  "How many SEO pages they have built, and the template behind hundreds of them",
  "How often they really publish, counted from their sitemap, not guessed",
  "Their entry offer, pricing model and the one feature they lock behind the paywall",
  "The email and CRM tools they use to turn visitors into buyers",
  "Their blind spots: channels and audiences they ignore that you can own",
  "What will work for you, and what only works because of their budget",
  "Quick wins a small team can ship this month",
];

const PLAN = [
  ["Positioning", "A sharper one-line position, differentiators and 3 tagline options"],
  ["Ideal customer", "Pains, buying triggers and the exact places they gather online"],
  ["Strategies", "4 to 6 plays built on what already works for your competitor, with your twist"],
  ["Channel plan", "Which channels first, the tactics, the KPI and the hours each needs"],
  ["30 / 60 / 90 days", "Tasks with hours, a metric and a stop rule, so you never waste a month"],
  ["12-week content calendar", "Titles, formats, channels and keywords, week by week"],
  ["SEO, ads and email", "15 keywords, 5 ad angles and a 6-email welcome sequence"],
  ["Swipe file", "Their best mechanisms, rewritten for your brand"],
];

const FAQ = [
  ["Is this legal and ethical?", "Yes. We only read public pages any visitor can see, like the homepage, pricing page, blog and sitemap. The report teaches you their strategy (the mechanism), never to copy their words, images or brand."],
  ["Do I need to sign up?", "No account and no card. Paste a URL, add your email, and the free PDF is yours."],
  ["How long does it take?", "Usually under a minute. The full plan takes a little longer because it writes a 30/60/90 plan and a 12-week calendar for you."],
  ["Will my competitor know?", "No. We read their public pages the way any visitor would. Nothing is sent to them."],
  ["Which websites work?", "Most public business websites: D2C, SaaS, edtech, fintech, agencies, services. Some sites block automated readers, so run the free teardown first: if it works, the full plan will too."],
  ["How do I pay for the full plan?", "One-time payment by UPI: Google Pay, PhonePe, Paytm, BHIM or any UPI app. No subscription."],
];

export default async function Home() {
  const jar = await cookies();
  const variant = parseVariant(jar.get(AB_COOKIE)?.value) ?? randomVariant();
  const c = copyFor(variant);
  const gate = proGate();
  const price = priceLabel();
  const referrer = (await headers()).get("referer") ?? "";
  const design = variant.design === "a" ? "aurora" : "editorial";

  return (
    <div className={`lp ${design}`} data-variant={`${variant.pos}${variant.hook}${variant.design}`}>
      <LandingEffects referrer={referrer} />
      {design === "aurora" && (
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}

      <header className="nav">
        <div className="nav-in">
          <a className="brand" href="#top">
            <span className="mark" aria-hidden="true" /> Market<b>Mirror</b>
          </a>
          <a className="nav-cta" href="#start" data-track="cta:nav">
            {c.cta}
          </a>
        </div>
      </header>

      {gate === "free" && (
        <div className="launch-bar">
          <span className="pulse" aria-hidden="true" /> Launch week: the full marketing plan is <b>free</b> while we are in beta.
        </div>
      )}

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker reveal">{c.kicker}</p>
            <h1 className="reveal">
              {c.headline[0]} <span className="hl">{c.headline[1]}</span> <span className="accent">{c.accent}</span>
            </h1>
            <p className="sub reveal">{c.sub}</p>
            <ul className="trust reveal">
              <li>Free PDF</li>
              <li>No signup</li>
              <li>Public pages only</li>
            </ul>
            <div className="hero-form reveal">
              <Generator copy={{ cta: c.cta, proLabel: c.proLabel }} />
            </div>
          </div>
          <div className="hero-art reveal">
            <ScannerVisual />
          </div>
        </section>

        <div className="marquee" aria-label="Works for">
          <div className="track">
            {[...CATEGORIES, ...CATEGORIES].map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </div>
        </div>

        <section className="stats">
          <div className="stat reveal">
            <b data-count="10">10</b>
            <span>report sections</span>
          </div>
          <div className="stat reveal">
            <b data-count="50" data-suffix="+">50+</b>
            <span>ad, email and analytics tools detected</span>
          </div>
          <div className="stat reveal">
            <b data-count="90" data-suffix="-day">90-day</b>
            <span>action plan in the full report</span>
          </div>
          <div className="stat reveal">
            <b>₹0</b>
            <span>for the teardown. Really.</span>
          </div>
        </section>

        <section className="pain">
          <h2 className="reveal">You are paying to learn what your competitor already knows.</h2>
          <div className="cards3">
            <article className="card-p reveal">
              <span className="emoji" aria-hidden="true">🔥</span>
              <h3>Ads that burn money</h3>
              <p>You test angles your competitor dropped months ago, because you cannot see their results.</p>
            </article>
            <article className="card-p reveal">
              <span className="emoji" aria-hidden="true">📝</span>
              <h3>Content nobody reads</h3>
              <p>You post every week and hope. They run a template that ranks for hundreds of searches.</p>
            </article>
            <article className="card-p reveal">
              <span className="emoji" aria-hidden="true">⏳</span>
              <h3>Audits that take weeks</h3>
              <p>An agency competitor audit costs weeks and real money, and still ends with a slide deck, not a plan.</p>
            </article>
          </div>
          <p className="bridge reveal">
            Here is the thing: <b>every website leaks its strategy.</b> You just need something that knows where to look.
          </p>
        </section>

        <section className="how">
          <h2 className="reveal">How it works</h2>
          <ol className="steps3">
            <li className="reveal">
              <span className="n">1</span>
              <h3>Paste their URL</h3>
              <p>Any competitor, any industry. Add your email so we can send the PDF.</p>
            </li>
            <li className="reveal">
              <span className="n">2</span>
              <h3>We read the leaks</h3>
              <p>Homepage, pricing, blog, sitemap, robots.txt and the tracking tools they run, then AI reverse-engineers the strategy.</p>
            </li>
            <li className="reveal">
              <span className="n">3</span>
              <h3>Get the playbook</h3>
              <p>A clean PDF in your inbox and on screen: what works for them, what transfers to you, and where they are weak.</p>
            </li>
          </ol>
        </section>

        <section className="inside">
          <div className="inside-copy">
            <h2 className="reveal">Inside your free teardown</h2>
            <ul className="bullets">
              {BULLETS.map((b) => (
                <li key={b} className="reveal">
                  {b}
                </li>
              ))}
            </ul>
            <a className="btn-cta reveal" href="#start" data-track="cta:inside">
              {c.cta} →
            </a>
          </div>
          <div className="pages reveal" aria-hidden="true">
            <div className="page p3" />
            <div className="page p2" />
            <div className="page p1">
              <span className="pk">FREE TEARDOWN</span>
              <span className="pt">competitor.com</span>
              <span className="pl" />
              <span className="pl s" />
              <span className="ph">Channel map</span>
              <span className="pills">
                <i className="g" />
                <i className="v" />
                <i className="v" />
                <i />
              </span>
              <span className="ph">Blind spots</span>
              <span className="pl" />
              <span className="pl s" />
            </div>
          </div>
        </section>

        <section className="offer">
          <h2 className="reveal">Want the plan, not just the teardown?</h2>
          <p className="lead reveal">
            Add your brand and domain. We turn your competitor&apos;s playbook into <b>your</b> end-to-end marketing plan.
          </p>
          <div className="plan-grid">
            {PLAN.map(([h, p]) => (
              <div key={h} className="plan-item reveal">
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
          <div className="price reveal">
            <div>
              <span className="price-tag">{gate === "free" ? "Free during launch" : price}</span>
              <span className="price-note">{gate === "free" ? "Beta pricing ends after launch week" : "One-time. Pay by UPI. No subscription."}</span>
            </div>
            <a className="btn-cta" href="#start" data-track="cta:offer">
              Get my full plan →
            </a>
          </div>
          <p className="risk reveal">Start with the free teardown. Only pay if you want the full plan for your brand.</p>
        </section>

        <section className="ethic reveal">
          <p>
            <b>Copy the mechanism, never the material.</b> We show you how their marketing works so you can build your own version. We never copy text, images or
            brands, and we only read public pages.
          </p>
        </section>

        <section className="faq">
          <h2 className="reveal">Questions</h2>
          {FAQ.map(([q, a], i) => (
            <details key={q} className="reveal">
              <summary data-track={`faq:${i + 1}`}>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        <section className="final">
          <h2 className="reveal">{c.finalHeadline}</h2>
          <a className="btn-cta big reveal" href="#start" data-track="cta:final">
            {c.cta} →
          </a>
          <p className="muted reveal">Free PDF. No signup. Under a minute.</p>
        </section>
      </main>

      <footer className="foot">
        <span>
          © {new Date().getFullYear()} MarketMirror · Made in India · Public pages only. We never state traffic or ad spend as numbers because they cannot be seen from
          outside.
        </span>
      </footer>
    </div>
  );
}
