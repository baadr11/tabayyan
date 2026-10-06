// Integration test of the AI path with a stand-in vector oracle (no model weights needed).
import fs from "node:fs"; import zlib from "node:zlib"; import assert from "node:assert";
import { buildIndex, fromLocal, decide } from "../public/logic.js";
import { localMatch, quantize, vecSearch } from "../public/engine.js";
const db = JSON.parse(zlib.gunzipSync(fs.readFileSync("public/data/db.json.gz"))); const ix = await buildIndex(db);
// vecSearch math: random unit vectors, exact top-1 must be itself
const dim = 384, n = 500, M = { n, dim, q: new Int8Array(n * dim), scale: new Float32Array(n) }; const raw = [];
for (let d = 0; d < n; d++) { const v = Array.from({ length: dim }, () => Math.random() - .5); const L = Math.hypot(...v); const u = v.map(x => x / L); raw.push(u); const { q, s } = quantize(u); M.q.set(q, d * dim); M.scale[d] = s; }
for (const t of [3, 77, 499]) { const r = vecSearch(M, Float32Array.from(raw[t]), 3); assert.equal(r[0].d, t); assert.ok(r[0].cos > 0.98); }
// pipeline: Chinese query with no lexical route, AI says Bukhari 1 (cos .9) → must reach صحيح via AI
const b1 = db.recs.findIndex(r => r[0] === 0 && r[1] === 1);
const m = localMatch(ix, { text: "一切行为都以举意为准", lang: "zh", phrases: [], tix: null, sem: { corpus: [{ d: b1, cos: 0.96 }, ...Array.from({ length: 29 }, (_, i) => ({ d: i + 100, cos: 0.85 }))], phrases: [] } });
assert.equal(m.via, "الفهم الدلالي على الجهاز");
const v = decide(m.same.map(d => fromLocal(db, d)), m.partial.map(d => fromLocal(db, d)));
assert.equal(v.word, "صحيح"); console.log("zh via AI →", v.word, "| same:", m.same.length);
// low-confidence AI must NOT produce a verdict
const m2 = localMatch(ix, { text: "随便一句话", lang: "zh", phrases: [], tix: null, sem: { corpus: [{ d: b1, cos: 0.80 }], phrases: [] } });
assert.equal(m2.same.length + m2.partial.length + m2.suggest.length, 0); console.log("low-confidence AI → refuses (لم أجده)");
const m3 = localMatch(ix, { text: "某句话", lang: "zh", phrases: [], tix: null, sem: { corpus: [{ d: b1, cos: 0.87 }, ...Array.from({ length: 29 }, (_, i) => ({ d: i + 100, cos: 0.83 }))], phrases: [] } });
assert.equal(m3.same.length, 0); assert.equal(m3.suggest.length, 1); console.log("medium-confidence AI → «هل تقصد؟» suggestion, no verdict");
// intra-record disagreement (Tirmidhi 4) → مختلف فيه
const t4 = db.recs.findIndex(r => r[0] === 3 && r[1] === 4);
assert.equal(decide([fromLocal(db, t4)], []).word, "مختلف فيه"); console.log("Tirmidhi 4 → مختلف فيه");
// excluded graders never appear
assert.ok(!fromLocal(db, t4).grades.some(g => /أبو غدة|بشار|محيي الدين/.test(g.who)));
console.log("semantic: OK");
