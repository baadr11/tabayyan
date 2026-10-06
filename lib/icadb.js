// Client for the Association's Central Islamic Content DB (icadb.com) — approved translations,
// sentence-aligned to the Arabic, with semantic (embedding) retrieval.
// Docs: https://icadb.com/api/docs  (Swagger; access may require an account/token)
export const ICADB = "https://icadb.com";

export function icadbFetcher({ token = process?.env?.ICADB_TOKEN, scheme = process?.env?.ICADB_AUTH_SCHEME || "Token", fetchImpl = fetch } = {}) {
  const headers = { Accept: "application/json", "User-Agent": "Tabayyan/0.3 (hadith verification)" };
  if (token) headers.Authorization = `${scheme} ${token}`;
  return async (path, params = {}) => {
    const u = new URL(path.startsWith("http") ? path : ICADB + path);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    const r = await fetchImpl(u, { headers });
    if (!r.ok) { const e = new Error(`icadb ${r.status} ${u.pathname}`); e.status = r.status; throw e; }
    return r.json();
  };
}
// DRF-style pagination: {count, next, results} or a plain array
export async function* pages(get, path, params = {}) {
  let res = await get(path, params);
  for (;;) {
    const items = Array.isArray(res) ? res : (res.results || res.data || res.items || []);
    for (const it of items) yield it;
    const next = !Array.isArray(res) && (res.next || res.links?.next);
    if (!next) break;
    res = await get(next);
  }
}
// tolerant field pickers (the export schema is not public here; adjust after running tools/icadb-probe.mjs)
export const pick = (o, ...keys) => { for (const k of keys) { const v = k.split(".").reduce((a, p) => a?.[p], o); if (typeof v === "string" && v.trim()) return v.trim(); } return ""; };
export const joinSentences = arr => (Array.isArray(arr) ? arr : (arr?.results || [])).map(s => pick(s, "text", "translation", "content", "sentence", "value")).filter(Boolean).join(" ");
