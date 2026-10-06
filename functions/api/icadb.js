// GET /api/icadb/relevant?iso=en&<params>  → proxies icadb «Find relevant examples by embeddings»
// (semantic retrieval over the Association's approved, sentence-aligned translations).
// Token stays on the server: set ICADB_TOKEN (and ICADB_AUTH_SCHEME if not "Token") in Pages settings.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url); const iso = (u.searchParams.get("iso") || "en").replace(/[^a-z-]/gi, "");
  const target = new URL(`https://icadb.com/books/api/books/relevant-examples/${iso}/`);
  for (const [k, v] of u.searchParams) if (k !== "iso") target.searchParams.set(k, v.slice(0, 500));
  const headers = { Accept: "application/json" }; if (env.ICADB_TOKEN) headers.Authorization = `${env.ICADB_AUTH_SCHEME || "Token"} ${env.ICADB_TOKEN}`;
  try {
    const r = await fetch(target, { headers });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
  } catch (e) { return new Response(JSON.stringify({ error: "icadb_unavailable" }), { status: 502, headers: { "content-type": "application/json" } }); }
}
