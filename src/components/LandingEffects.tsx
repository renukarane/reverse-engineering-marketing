"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// Small client island for the otherwise server-rendered landing page:
// reveal-on-scroll, animated counters, and conversion events.
export default function LandingEffects({ referrer }: { referrer: string }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    track("lp_view", {
      ref: q.get("ref") || q.get("utm_source") || referrer || "direct",
      campaign: q.get("utm_campaign") || "",
      mobile: window.matchMedia("(max-width: 640px)").matches,
    });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reveal sections as they enter the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
          const el = e.target as HTMLElement;
          if (el.dataset.count) countUp(el, Number(el.dataset.count), reduce);
        }
      },
      { threshold: 0.18 },
    );
    document.querySelectorAll(".reveal, [data-count]").forEach((el) => io.observe(el));

    // One scroll-depth event at 50%.
    let sent = false;
    const onScroll = () => {
      if (sent) return;
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth >= 0.5) {
        sent = true;
        track("scroll_50");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Any element with data-track="cta:<where>" reports a click.
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-track]");
      if (!el) return;
      const [event, where] = (el.dataset.track ?? "").split(":");
      if (event === "cta") track("cta_click", { where: where || "unknown" });
      if (event === "faq") track("faq_open", { q: where || "" });
    };
    document.addEventListener("click", onClick);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, [referrer]);
  return null;
}

function countUp(el: HTMLElement, to: number, reduce: boolean) {
  const suffix = el.dataset.suffix ?? "";
  if (reduce) {
    el.textContent = `${to}${suffix}`;
    return;
  }
  const start = performance.now();
  const dur = 1200;
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${Math.round(to * eased)}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
