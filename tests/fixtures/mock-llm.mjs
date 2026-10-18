// Mock OpenAI-compatible LLM for local tests. Returns canned JSON matching each prompt's schema.
import { createServer } from "node:http";
const teardown = { summary: "Mock summary — with dash.", positioning: { oneLiner: "Email for creators" }, channels: [{ channel: "SEO", status: "active", evidence: "115 URLs", role: "cold" }], whatWorks: [{ tactic: "Programmatic integrations pages", transferable: "modified" }], gaps: ["No YouTube"], quickWins: ["Comparison page"] };
const A = { executiveSummary: "Mock plan", positioning: { statement: "For coaches...", differentiators: ["Fast"] }, icp: { primary: "Solo coaches" }, strategies: [{ name: "Search moat", objective: "o" }], channelPlan: [{ channel: "SEO", priority: "P1" }], gapsToExploit: ["g"], risks: ["r"] };
const B = { executionPlan: [{ phase: "Days 1-30", focus: "f", tasks: [{ task: "t", hours: "4", metric: "m", killRule: "k" }] }], contentPlan: { pillars: [{ name: "P", topics: ["a"] }], calendar: [{ week: 1, title: "AI title" }] }, kpis: [{ metric: "x", target30: "1", target90: "2" }] };
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const u = JSON.parse(body).messages[1].content;
    // Plan C deliberately returns fenced junk to exercise per-section fallback.
    const out = u.includes("Reverse engineer this competitor") ? teardown : u.includes("strategy from the competitor") ? A : u.includes("execution plan and content plan") ? B : "```oops not json```";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: typeof out === "string" ? out : "```json\n" + JSON.stringify(out) + "\n```" } }] }));
  });
}).listen(Number(process.env.PORT) || 4400);
