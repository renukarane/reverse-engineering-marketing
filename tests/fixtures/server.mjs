// Tiny static server for the fixture competitor site used in local end-to-end tests.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// SITE=own-site serves the smaller "your brand" fixture used for comparisons.
const root = join(dirname(fileURLToPath(import.meta.url)), process.env.SITE || "site");
const map = { "/": "index.html", "/pricing": "pricing.html", "/blog": "blog.html", "/robots.txt": "robots.txt", "/sitemap.xml": "sitemap.xml" };
createServer(async (req, res) => {
  const f = map[new URL(req.url, "http://x").pathname];
  if (f && !(await readFile(join(root, f)).then(() => true, () => false))) { res.writeHead(404); return res.end("not found"); }
  if (!f) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": f.endsWith(".xml") ? "application/xml" : f.endsWith(".txt") ? "text/plain" : "text/html" });
  res.end(await readFile(join(root, f)));
}).listen(Number(process.env.PORT) || 4321);
