// GET /api/dorar?q=<arabic text>  →  { url, results:[{text,truncated,rawi,muhaddith,source,ref,grade}] }
// Proxies the public Dorar.net API server-side (no CORS/CSP issues) and caches 24h.
import { searchDorar } from "../../lib/dorar.js";

export async function onRequestGet({ request }) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 200);
  if (q.length < 2) return json({ error: "empty_query" }, 400);

  const cache = globalThis.caches?.default;
  const key = new Request("https://cache.tabayyan/dorar?q=" + encodeURIComponent(q));
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }

  try {
    const data = await searchDorar(q);
    const res = json({ ...data, attribution: "الموسوعة الحديثية — الدرر السنية (dorar.net)" }, 200, { "Cache-Control": "public, max-age=86400" });
    if (cache) await cache.put(key, res.clone());
    return res;
  } catch (e) {
    return json({ error: "dorar_unavailable", detail: String(e.message || e) }, 502);
  }
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
