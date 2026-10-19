// Free-tier LLM providers behind one OpenAI-compatible chat call. Providers are tried
// in order; a rate limit or failure on one falls through to the next. If none are
// configured, callers fall back to the rule-based engine.

interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
  jsonMode: boolean;
}

function providers(): Provider[] {
  const list: Provider[] = [
    {
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      jsonMode: true,
    },
    {
      name: "Gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      jsonMode: true,
    },
    {
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      jsonMode: false,
    },
    {
      // Any OpenAI-compatible endpoint (Ollama, Together, a local mock).
      name: "Custom",
      url: `${(process.env.OPENAI_COMPAT_BASE_URL || "").replace(/\/$/, "")}/chat/completions`,
      key: process.env.OPENAI_COMPAT_BASE_URL ? process.env.OPENAI_COMPAT_API_KEY || "none" : undefined,
      model: process.env.OPENAI_COMPAT_MODEL || "llama3.1",
      jsonMode: true,
    },
  ];
  return list.filter((p) => p.key);
}

export function aiConfigured(): boolean {
  return providers().length > 0;
}

/** Pull the first JSON object out of a model reply, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model reply");
  return JSON.parse(body.slice(start, end + 1));
}

export async function chatJson(system: string, user: string, maxTokens = 6000): Promise<{ data: unknown; engine: string }> {
  const errors: string[] = [];
  for (const p of providers()) {
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${p.key}`,
          ...(p.name === "OpenRouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://marketingscholars.com", "X-Title": "Marketing Scholars" } : {}),
        },
        body: JSON.stringify({
          model: p.model,
          temperature: 0.4,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          ...(p.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(55_000),
      });
      if (!res.ok) {
        errors.push(`${p.name} HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      return { data: extractJson(content), engine: `${p.name} (${p.model})` };
    } catch (e) {
      errors.push(`${p.name}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.length ? `All AI providers failed: ${errors.join("; ")}` : "No AI provider configured");
}
