// Builds the on-device AI index with multilingual-e5-small (MIT).
//
// Two vector sets:
//   1) corpus  — one vector per narration. Where an English translation exists we embed the Prophet's words
//                from it (the "English bridge": e5 aligns Chinese/Swahili/French/Urdu/Indonesian with English far
//                better than with classical Arabic); otherwise the Arabic core text. Musnad Ahmad rows without a
//                translation are skipped (long isnads, rarely circulated) and stay searchable lexically.
//   2) phrases — short canonical forms of widely-circulated sayings (Arabic + every variant in phrases.json).
//
// The model is read from public/models (npm run fetch:model downloads it once). Output: public/data/emb/
import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
import { pipeline, env } from "@huggingface/transformers";
import { AI } from "../public/policy.js";
import { quantize, coreOf, englishCore } from "../public/engine.js";

env.allowRemoteModels = false; env.localModelPath = path.resolve("public/models") + "/";
const OUT = "public/data/emb", DIM = 384, BATCH = 48, SHARD = 8000;
fs.mkdirSync(OUT, { recursive: true });
const gz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const db = gz("public/data/db.json.gz"), en = gz("public/data/tr-en.json.gz");
const phrases = JSON.parse(fs.readFileSync("public/data/phrases.json"));

const ids = [], texts = [];
db.recs.forEach((r, d) => {
  const kind = db.books[r[0]][2];
  if (en[d]) { ids.push(d); texts.push("passage: " + englishCore(en[d])); }
  else if (kind !== "musnad") { ids.push(d); texts.push("passage: " + coreOf(r[2]).replace(/\s+/g, " ").slice(0, 300)); }
});
const ptexts = [], pmap = [];
phrases.forEach((p, i) => { for (const v of [p.ar, ...p.v]) { ptexts.push("passage: " + v); pmap.push(i); } });

console.log(`${AI.model} (${AI.dtype}) — corpus ${ids.length} narrations, ${ptexts.length} phrase forms`);
const ext = await pipeline("feature-extraction", AI.model, { dtype: AI.dtype });
async function embedAll(list, label) {
  const Q = new Int8Array(list.length * DIM), S = new Float32Array(list.length); const t0 = Date.now();
  for (let i = 0; i < list.length; i += BATCH) {
    const out = await ext(list.slice(i, i + BATCH), { pooling: "mean", normalize: true });
    for (let j = 0; j < Math.min(BATCH, list.length - i); j++) { const { q, s } = quantize(out.data.subarray(j * DIM, (j + 1) * DIM)); Q.set(q, (i + j) * DIM); S[i + j] = s; }
    if ((i / BATCH) % 40 === 0) { const done = Math.min(list.length, i + BATCH), rate = done / ((Date.now() - t0) / 1000); console.log(`${label} ${done}/${list.length} · ${rate.toFixed(0)}/s · ETA ${((list.length - done) / rate / 60).toFixed(1)} min`); }
  }
  return { Q, S };
}
const P = await embedAll(ptexts, "phrases");
const C = await embedAll(texts, "corpus");
const shards = [];
for (let r = 0, k = 0; r < ids.length; r += SHARD, k++) { const f = `v${k}.bin`; fs.writeFileSync(path.join(OUT, f), Buffer.from(C.Q.buffer, r * DIM, Math.min(SHARD, ids.length - r) * DIM)); shards.push(f); }
fs.writeFileSync(path.join(OUT, "scale.bin"), Buffer.from(C.S.buffer));
fs.writeFileSync(path.join(OUT, "ids.bin"), Buffer.from(new Int32Array(ids).buffer));
fs.writeFileSync(path.join(OUT, "phrases.bin"), Buffer.concat([Buffer.from(P.Q.buffer), Buffer.from(P.S.buffer)]));
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ model: AI.model, dtype: AI.dtype, dim: DIM, n: ids.length, shards, scale: "scale.bin", ids: "ids.bin", phrases: { file: "phrases.bin", n: ptexts.length, map: pmap }, dbRecs: db.recs.length, built: new Date().toISOString() }));
console.log("done →", OUT);
