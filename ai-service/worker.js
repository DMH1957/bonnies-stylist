// Bonnie's Stylist AI service (Cloudflare Worker).
// Secrets to set: ANTHROPIC_API_KEY, ACCESS_CODE. Optional: MODEL, ALLOWED_ORIGIN.
export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type,x-access-code", "access-control-allow-methods": "POST,OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("Not found", { status: 404, headers: cors });
    if (req.headers.get("x-access-code") !== env.ACCESS_CODE) return new Response("Forbidden", { status: 403, headers: cors });
    let body; try { body = await req.json(); } catch { return new Response("Bad request", { status: 400, headers: cors }); }
    const images = (body.images || []).slice(0, 4);
    const content = [...images.map(i => ({ type: "image", source: { type: "base64", media_type: i.type || "image/jpeg", data: i.data } })), { type: "text", text: String(body.prompt || "").slice(0, 60000) }];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env.MODEL || "claude-sonnet-5-5", max_tokens: 3000, messages: [{ role: "user", content }] })
    });
    if (r.status === 429) return new Response("Busy", { status: 429, headers: cors });
    if (!r.ok) return new Response("Upstream error", { status: 502, headers: cors });
    const j = await r.json();
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return new Response(JSON.stringify({ text }), { headers: { ...cors, "content-type": "application/json" } });
  }
};
