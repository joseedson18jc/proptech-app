/* PropTech copilot proxy. Holds the Anthropic key; the page never sees it.
   POST /v1/copilot with {messages}. The system prompt and tools are fixed here.
   Returns {content, stop_reason, stop_details} as JSON; the page runs the tool loop
   and appends content back unchanged (thinking blocks included). */
import { SYSTEM, TOOLS } from "./prompt.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_BODY_BYTES = 150_000;
const MAX_MESSAGES = 40;
const MAX_TEXT = 12_000;
const USER_BLOCKS = new Set(["text", "tool_result"]);
const ASSISTANT_BLOCKS = new Set(["text", "tool_use", "thinking", "redacted_thinking"]);
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    headers: {
      "Access-Control-Allow-Origin": ok ? origin : "null",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
    ok,
  };
}

const json = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

function textOk(s) {
  return typeof s === "string" && s.length > 0 && s.length <= MAX_TEXT;
}

function validBlock(b, role) {
  if (!b || typeof b !== "object") return false;
  const allowed = role === "user" ? USER_BLOCKS : ASSISTANT_BLOCKS;
  if (!allowed.has(b.type)) return false;
  if (b.type === "text") return textOk(b.text);
  if (b.type === "tool_use") return TOOL_NAMES.has(b.name) && typeof b.id === "string";
  if (b.type === "tool_result") {
    if (typeof b.tool_use_id !== "string") return false;
    if (typeof b.content === "string") return b.content.length <= MAX_TEXT;
    return Array.isArray(b.content) && b.content.every((c) => c && c.type === "text" && typeof c.text === "string" && c.text.length <= MAX_TEXT);
  }
  return true; // thinking / redacted_thinking pass through untouched
}

export function validate(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) return "Corpo inválido.";
  const msgs = body.messages;
  if (msgs.length === 0 || msgs.length > MAX_MESSAGES) return "Conversa vazia ou longa demais.";
  if (msgs[0].role !== "user" || msgs[msgs.length - 1].role !== "user") return "A conversa deve começar e terminar com o usuário.";
  for (const m of msgs) {
    if (m.role !== "user" && m.role !== "assistant") return "role inválido.";
    if (typeof m.content === "string") { if (!textOk(m.content)) return "Texto vazio ou longo demais."; continue; }
    if (!Array.isArray(m.content) || m.content.length === 0) return "content inválido.";
    if (!m.content.every((b) => validBlock(b, m.role))) return "Tipo de bloco não permitido.";
  }
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json(200, { ok: true, configured: Boolean(env.ANTHROPIC_API_KEY) }, cors.headers);
    if (request.method !== "POST" || url.pathname !== "/v1/copilot") return json(404, { error: "not_found" }, cors.headers);
    if (!cors.ok) return json(403, { error: "origin_not_allowed" }, cors.headers);

    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const [perIp, global] = await Promise.all([env.PER_IP.limit({ key: ip }), env.GLOBAL.limit({ key: "all" })]);
    if (!perIp.success || !global.success) return json(429, { error: "rate_limited" }, cors.headers);

    if (!env.ANTHROPIC_API_KEY) return json(503, { error: "not_configured" }, cors.headers);
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return json(413, { error: "too_large" }, cors.headers);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" }, cors.headers);
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "bad_json" }, cors.headers);
    }
    const problem = validate(body);
    if (problem) return json(400, { error: "invalid_request", message: problem }, cors.headers);

    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-5-5",
        max_tokens: Number(env.MAX_TOKENS) || 2000,
        output_config: { effort: env.EFFORT || "low" },
        fallbacks: "default",
        system: SYSTEM,
        tools: TOOLS,
        messages: body.messages,
      }),
    });

    if (!upstream.ok) {
      let detail = "";
      try { detail = (await upstream.json()).error?.message || ""; } catch { /* non-JSON upstream error */ }
      console.log(JSON.stringify({ upstream_status: upstream.status, detail }));
      const status = upstream.status === 429 ? 429 : upstream.status === 400 ? 400 : 502;
      return json(status, { error: "upstream_" + upstream.status }, cors.headers);
    }
    const msg = await upstream.json();
    return json(200, { content: msg.content, stop_reason: msg.stop_reason, stop_details: msg.stop_details || null }, cors.headers);
  },
};
