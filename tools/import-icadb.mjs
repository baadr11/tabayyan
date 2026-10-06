// Step 2 — import the hadith encyclopedia from the Association's central DB (approved translations)
// into the same pack format the app already reads (public/data/he-<lang>.json.gz), so replies quote
// approved translations and Chinese / Swahili get full coverage.
//   ICADB_TOKEN=xxxx node tools/import-icadb.mjs [encyclopedia_id] [langs]
import fs from "node:fs"; import zlib from "node:zlib";
import { icadbFetcher, pages, pick, joinSentences } from "../lib/icadb.js";
import { buildIndex, bm25 } from "../public/logic.js";
import { arSim, coreOf, SAME_T } from "../public/engine.js";

const get = icadbFetcher();
const LANGS = (process.argv[3] || "en,fr,ur,id,zh,sw").split(",");
let encId = process.argv[2];
if (!encId) {
  const enc = await get("/api/encyclopedias/list/"); const list = Array.isArray(enc) ? enc : enc.results || [];
  const h = list.find(e => /حديث|أحاديث|hadeeth|hadith/i.test(JSON.stringify(e)));
  if (!h) throw new Error("hadith encyclopedia not found — pass its id: node tools/import-icadb.mjs <id>");
  encId = h.id ?? h.external_id; console.log("hadith encyclopedia:", encId, pick(h, "title", "name"));
}
const db = JSON.parse(zlib.gunzipSync(fs.readFileSync("public/data/db.json.gz"))); const ix = await buildIndex(db);
const cards = [];
for await (const c of pages(get, `/api/encyclopedias/${encId}/cards/latest/`, { page_size: 200 })) {
  const ar = pick(c, "text", "composed_text", "latest_version.text", "latest_version.composed_text", "hadeeth", "body");
  const ext = c.external_id ?? c.id; if (!ar || ext == null) continue;
  let d = -1, best = 0;
  for (const { d: k } of bm25(ix, ar, 10)) { const s = arSim(ar, coreOf(db.recs[k][2]), ix); if (s > best) { best = s; d = k; } }
  cards.push({ ext, ar, d: best >= SAME_T ? d : -1, g: pick(c, "grade", "latest_version.grade", "properties.grade"), x: pick(c, "explanation", "latest_version.explanation") });
  if (cards.length % 200 === 0) console.log("cards", cards.length);
}
console.log("cards:", cards.length, "matched to db:", cards.filter(c => c.d >= 0).length);
fs.writeFileSync("public/data/he-ar.json.gz", zlib.gzipSync(JSON.stringify(cards.map(c => ({ id: c.ext, d: c.d, t: c.ar, x: c.x, g: c.g, ar: c.ar, src: "icadb" })))));
for (const lang of LANGS) {
  const out = [];
  for (const c of cards) {
    try { const t = joinSentences(await get(`/api/encyclopedias/cards/${c.ext}/translations/${lang}/`)); if (t) out.push({ id: c.ext, d: c.d, t, x: "", g: c.g, ar: c.ar, src: "icadb" }); } catch (e) { if (e.status === 401 || e.status === 403) throw e; }
  }
  fs.writeFileSync(`public/data/he-${lang}.json.gz`, zlib.gzipSync(JSON.stringify(out))); console.log(lang, out.length);
}
