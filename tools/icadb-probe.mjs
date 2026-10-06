// Step 1 — discover what this account can read from icadb.com and the exact field names.
//   ICADB_TOKEN=xxxx node tools/icadb-probe.mjs        (token optional; try without first)
import { icadbFetcher } from "../lib/icadb.js";
const get = icadbFetcher();
const tryGet = async (p, q) => { try { const j = await get(p, q); console.log(`✓ ${p}`, JSON.stringify(j).slice(0, 600), "\n"); return j; } catch (e) { console.log(`✗ ${p} → ${e.status || e.message}`); } };
for (const p of ["/api/docs/?format=openapi", "/swagger.json", "/api/swagger.json"]) {
  const s = await tryGet(p);
  if (s?.paths) { for (const [path, ops] of Object.entries(s.paths)) for (const [m, op] of Object.entries(ops)) if (op.parameters) console.log(m.toUpperCase(), path, (op.parameters || []).map(x => `${x.name}${x.required ? "*" : ""}:${x.in}`).join(", ")); break; }
}
await tryGet("/api/languages/list/");
const enc = await tryGet("/api/encyclopedias/list/");
const list = Array.isArray(enc) ? enc : enc?.results || [];
for (const e of list) console.log("encyclopedia:", e.id ?? e.external_id, "|", e.title ?? e.name ?? JSON.stringify(e).slice(0, 120));
const hadith = list.find(e => /حديث|أحاديث|hadeeth|hadith/i.test(JSON.stringify(e)));
if (hadith) {
  const id = hadith.id ?? hadith.external_id;
  await tryGet(`/api/encyclopedias/${id}/fields/`);
  await tryGet(`/api/encyclopedias/${id}/sync-status/`);
  await tryGet(`/api/encyclopedias/${id}/cards/latest/`, { page_size: 2 });
}
await tryGet("/books/api/books/relevant-examples/en/", { q: "actions are judged by intentions", text: "actions are judged by intentions", query: "actions are judged by intentions" });
