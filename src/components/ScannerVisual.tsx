// Hero motion graphic, pure CSS: a competitor's site is scanned, the signals we
// detect pop out as chips, and a PDF report slides out. Loops every 9 seconds.
// Decorative only, so it is hidden from screen readers.
export default function ScannerVisual() {
  const chips = [
    { label: "Meta Pixel + Google Ads", kind: "ads" },
    { label: "412 SEO pages", kind: "seo" },
    { label: "Free-trial funnel", kind: "funnel" },
    { label: "HubSpot nurture", kind: "email" },
    { label: "Gap: no YouTube", kind: "gap" },
  ];
  return (
    <div className="scanner" aria-hidden="true">
      <div className="browser">
        <div className="browser-bar">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span className="url">
            <span className="typed">competitor.com</span>
          </span>
        </div>
        <div className="site">
          <div className="sk sk-nav" />
          <div className="sk sk-h1" />
          <div className="sk sk-p" />
          <div className="sk sk-btn" />
          <div className="sk-grid">
            <div className="sk sk-card" />
            <div className="sk sk-card" />
            <div className="sk sk-card" />
          </div>
          <div className="beam" />
        </div>
      </div>
      <ul className="chips-out">
        {chips.map((c, i) => (
          <li key={c.label} className={`chip-out ${c.kind}`} style={{ animationDelay: `${1.6 + i * 0.45}s` }}>
            <span className="tick">{c.kind === "gap" ? "!" : "✓"}</span>
            {c.label}
          </li>
        ))}
      </ul>
      <div className="pdf">
        <div className="pdf-head">PDF</div>
        <div className="pdf-title">Their marketing playbook</div>
        <div className="pdf-line" />
        <div className="pdf-line short" />
        <div className="pdf-line" />
        <div className="pdf-bars">
          <i style={{ height: "40%" }} />
          <i style={{ height: "75%" }} />
          <i style={{ height: "55%" }} />
          <i style={{ height: "90%" }} />
        </div>
      </div>
    </div>
  );
}
