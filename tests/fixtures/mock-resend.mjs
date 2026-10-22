// Mock Resend API: records sent emails; GET /__sent lists them (attachment sizes only).
import { createServer } from "node:http";
const sent = [];
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json" });
    if (req.method === "POST" && req.url === "/emails") {
      const e = JSON.parse(body);
      sent.push({ to: e.to, from: e.from, subject: e.subject, html: e.html.length, text: e.text, attachments: (e.attachments || []).map((a) => ({ filename: a.filename, pdfBytes: Buffer.from(a.content, "base64").length, isPdf: Buffer.from(a.content, "base64").subarray(0, 5).toString() === "%PDF-" })) });
      return res.end(JSON.stringify({ id: "email_" + sent.length }));
    }
    res.end(JSON.stringify(sent));
  });
}).listen(Number(process.env.PORT) || 4600);
