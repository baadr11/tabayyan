// Imports HadeethEnc.com (Encyclopedia of Translated Prophetic Hadiths) for the
// languages Tabayyan supports. Terms: content is shown WITHOUT modification and with
// clear attribution to HadeethEnc.com.  Run on a machine with internet:
//   npm run import:hadeethenc
// Output: public/data/he-<lang>.json.gz  [{id, d, t, x, g, ar}]
//   d = matching row in db.json.gz (-1 if not found), t = translation, x = explanation,
//   g = grade (as published), ar = Arabic text
import fs from "node:fs"; import zlib from "node:zlib";
import { buildIndex, bm25 } from "../public/logic.js";
import { arSim, coreOf, SAME_T } from "../public/engine.js";

const API = "https://hadeethenc.com/api/v1";
const LANGS = (process.argv[2] || "en,fr,ur,id,zh,sw").split(",");
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { "User-Agent": "Tabayyan/0.2 (hadith verification; attribution to HadeethEnc.com)" } }); if (r.ok) return await r.json(); }
    catch { }
    await sleep(800 * (i + 1));
  }
  throw new Error("failed " + url);
}
const pick = (o, ...keys) => { for (const k of keys) if (o && typeof o[k] === "string" && o[k].trim()) return o[k].trim(); return ""; };

// 1) all hadith ids (Arabic category tree)
const cats = await get(`${API}/categories/list/?language=ar`);
const ids = new Set();
for (const c of cats) {
  for (let page = 1; ; page++) {
    const res = await get(`${API}/hadeeths/list/?language=ar&category_id=${c.id}&page=${page}&per_page=100`);
    const data = res.data || res; if (!data?.length) break;
    data.forEach(h => ids.add(h.id));
    const last = res.meta?.last_page; if (!last || page >= +last) break;
    await sleep(150);
  }
}
console.log("hadith ids:", ids.size);

// 2) Arabic text + match to our database
const db = JSON.parse(zlib.gunzipSync(fs.readFileSync("public/data/db.json.gz"))); const ix = await buildIndex(db);
const ar = new Map();
for (const id of ids) {
  const h = await get(`${API}/hadeeths/one/?language=ar&id=${id}`);
  const text = pick(h, "hadeeth", "hadeeth_ar");
  let d = -1, best = 0;
  for (const { d: c } of bm25(ix, text, 10)) { const s = arSim(text, coreOf(db.recs[c][2]), ix); if (s > best) { best = s; d = c; } }
  ar.set(id, { ar: text, d: best >= SAME_T ? d : -1, g: pick(h, "grade"), x: pick(h, "explanation") });
  await sleep(120);
}
fs.writeFileSync("public/data/he-ar.json.gz", zlib.gzipSync(JSON.stringify([...ar].map(([id, v]) => ({ id, d: v.d, t: v.ar, x: v.x, g: v.g, ar: v.ar })))));
console.log("ar done; matched to db:", [...ar.values()].filter(v => v.d >= 0).length);

// 3) translations
for (const lang of LANGS) {
  const out = [];
  for (const id of ids) {
    try {
      const h = await get(`${API}/hadeeths/one/?language=${lang}&id=${id}`);
      const t = pick(h, "hadeeth"); if (!t) continue;
      const a = ar.get(id);
      out.push({ id, d: a.d, t, x: pick(h, "explanation"), g: pick(h, "grade"), ar: a.ar });
    } catch { }
    await sleep(120);
  }
  fs.writeFileSync(`public/data/he-${lang}.json.gz`, zlib.gzipSync(JSON.stringify(out)));
  console.log(lang, out.length);
}
