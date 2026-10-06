// Runs the gold test set and prints recall / refusal accuracy / wrong verdicts.
//   npm run eval            (lexical engine only)
//   npm run eval -- --ai    (adds the on-device model; needs public/data/emb built)
import fs from "node:fs"; import zlib from "node:zlib";
import { buildIndex, fromLocal, decide } from "../public/logic.js";
import { detectLang, buildTrIndex, localMatch, vecSearch, coreOf } from "../public/engine.js";
import { AI } from "../public/policy.js";
const useAI = process.argv.includes("--ai");
const gz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const db = gz("public/data/db.json.gz"), ix = await buildIndex(db);
const phrases = JSON.parse(fs.readFileSync("public/data/phrases.json"));
const tr = {}, he = {};
const getTr = l => { if (l === "ar") return null; if (!(l in tr)) { const f = `public/data/tr-${l}.json.gz`; tr[l] = fs.existsSync(f) ? buildTrIndex(gz(f), l) : null; } return tr[l]; };
const getHe = l => { if (l in he) return he[l]; const f = `public/data/he-${l}.json.gz`; if (!fs.existsSync(f)) return he[l] = null; const items = gz(f); return he[l] = { items, tix: buildTrIndex(items.map(x => x.t), l) }; };
let embed = null, M = null, PH = null;
if (useAI) {
  const { pipeline, env } = await import("@huggingface/transformers");
  const path = await import("node:path"); env.allowRemoteModels = false; env.localModelPath = path.resolve("public/models") + "/";
  const ext = await pipeline("feature-extraction", AI.model, { dtype: AI.dtype });
  const meta = JSON.parse(fs.readFileSync("public/data/emb/meta.json")); const rd = f => fs.readFileSync("public/data/emb/" + f);
  const q = new Int8Array(meta.n * meta.dim); let o = 0; for (const f of meta.shards) { const b = rd(f); q.set(new Int8Array(b.buffer, b.byteOffset, b.length), o); o += b.length; }
  M = { ...meta, q, scale: new Float32Array(rd(meta.scale).buffer.slice(0)), ids: new Int32Array(rd(meta.ids).buffer.slice(0)) };
  const pb = rd(meta.phrases.file), pn = meta.phrases.n, ab = pb.buffer.slice(pb.byteOffset, pb.byteOffset + pb.length);
  PH = { n: pn, dim: meta.dim, q: new Int8Array(ab, 0, pn * meta.dim), scale: new Float32Array(ab.slice(pn * meta.dim)), map: meta.phrases.map };
  embed = async t => (await ext("query: " + t, { pooling: "mean", normalize: true })).data;
}
async function semSearch(t) {
  const qv = await embed(t); const best = new Map();
  for (const h of vecSearch(PH, qv, 24)) { const p = PH.map[h.d]; if (!best.has(p) || h.cos > best.get(p)) best.set(p, h.cos); }
  return { corpus: vecSearch(M, qv, 30).map(h => ({ d: M.ids[h.d], cos: h.cos })), phrases: [...best].map(([p, cos]) => ({ p, cos })).sort((a, b) => b.cos - a.cos) };
}
const G = JSON.parse(fs.readFileSync("test/gold.json")).cases;
const suggested = []; let sugOK = 0, sugBad = 0;
let ok = 0, wrongVerdict = 0, missed = 0, falseFound = 0, skipped = 0; const cosLog = [];
for (const c of G) {
  if (c.needs === "ai" && !useAI) { skipped++; continue; }
  const lang = detectLang(c.q);
  const sem = embed ? await semSearch(c.q) : null;
  const m = localMatch(ix, { text: c.q, lang, phrases, tix: getTr(lang), he: getHe(lang), sem });
  const v = decide(m.same.map(d => fromLocal(db, d)), m.partial.map(d => fromLocal(db, d)));
  const found = !!v; let pass = found === c.found;
  if (pass && c.word && v && v.word !== c.word) { pass = false; wrongVerdict++; }
  if (pass && c.not_word && v && v.word === c.not_word) { pass = false; wrongVerdict++; }
  if (!pass && c.found && !found) missed++; if (!pass && !c.found && found) falseFound++;
  if (pass) ok++;
  if (sem) cosLog.push({ q: c.q, top: Math.max(sem.corpus[0]?.cos || 0, sem.phrases[0]?.cos || 0).toFixed(3), found: c.found, via: m.via, sug: (m.suggest || []).length });
  console.log(pass ? " ✓" : " ✗", lang, (v ? v.word : (m.suggest?.length ? "هل تقصد؟" : "لم أجده")).padEnd(10), "|", (m.via || "—").padEnd(24), "|", c.q.slice(0, 55));
  if (m.suggest?.length && !v && c.found && c.ar) { const nz = s => s.replace(/[\u064B-\u0652\u0670]/g, "").replace(/[أإآ]/g, "ا"); if (nz(m.suggest[0].d >= 0 ? coreOf(m.suggest[0].anchor) : m.suggest[0].anchor).includes(nz(c.ar))) sugOK++; else sugBad++; }
  if (m.suggest?.length && !v) suggested.push({ q: c.q, found: c.found, top: (m.suggest[0].d >= 0 ? `[${db.books[db.recs[m.suggest[0].d][0]][0]} ${db.recs[m.suggest[0].d][1]}] ` + coreOf(m.suggest[0].anchor) : m.suggest[0].anchor).replace(/[\u064B-\u0652]/g, "").slice(0, 90), cos: m.suggest[0].cos.toFixed(3) });
}
const run = G.length - skipped;
console.log(`\nاقتراح صحيح أولًا ${sugOK} · اقتراح خاطئ ${sugBad}`);
console.log(`نجح ${ok}/${run}  ·  فات (لم يجده) ${missed}  ·  وجد ما لا يجب ${falseFound}  ·  حكم مختلف عن المتوقع ${wrongVerdict}${skipped ? `  ·  تُخطّي ${skipped} (تحتاج --ai)` : ""}`);
if (suggested.length) console.log("اقتراحات «هل تقصد؟» (لا حكم حتى يؤكدها المستخدم):\n" + suggested.map(s => `  ${s.cos}  ${s.found ? "حديث موجود" : "يجب ألا يوجد"}  ${s.q.slice(0, 40)} → ${s.top}`).join("\n"));
if (cosLog.length) console.log("أعلى تشابه لكل حالة (لمعايرة AI.anchorCos/partialCos):\n" + cosLog.map(x => `  ${x.top}  ${x.found ? "يجب أن يوجد" : "يجب ألا يوجد"}  ${x.q.slice(0, 50)}`).join("\n"));
