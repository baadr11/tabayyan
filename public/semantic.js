// On-device AI for Tabayyan — multilingual-e5-small (MIT) running in the visitor's browser
// through ONNX Runtime Web (WebAssembly). The model, tokenizer, runtime and all vectors are
// served from this site: no third-party calls, works offline once cached.
import { AI } from "./policy.js";
import { vecSearch } from "./engine.js";

export const AIState = { status: "off", progress: 0, error: "", ms: 0 };
let extractor = null, M = null, PH = null, listeners = [];
const emit = () => listeners.forEach(f => f({ ...AIState }));
export const onAIState = f => { listeners.push(f); f({ ...AIState }); };
const abs = p => new URL(p, location.href).href;

// Files larger than the host's per-file limit are split at build time (tools/build.mjs) and listed in
// models/chunks.json; this fetch streams the parts back together so the library sees one file.
let CHUNKS = null;
async function chunkAwareFetch(input, init) {
  if (CHUNKS === null) { try { const r = await fetch(abs("models/chunks.json")); CHUNKS = r.ok ? await r.json() : {}; } catch { CHUNKS = {}; } }
  const url = typeof input === "string" ? input : input.url; const u = new URL(url, location.href);
  const key = Object.keys(CHUNKS).find(k => u.pathname.endsWith("/" + k));
  if (!key) return fetch(input, init);
  const { parts, size } = CHUNKS[key], base = u.href.slice(0, u.href.length - key.length); // site root
  const stream = new ReadableStream({
    async start(ctrl) {
      try { for (const p of parts) { const r = await fetch(base + p); if (!r.ok) throw new Error("chunk " + p); const rd = r.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; ctrl.enqueue(value); } } ctrl.close(); }
      catch (e) { ctrl.error(e); }
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Length": String(size), "Content-Type": "application/octet-stream" } });
}

async function loadVectors() {
  const meta = await (await fetch("data/emb/meta.json", { cache: "no-cache" })).json();
  if (meta.model !== AI.model) throw new Error("vectors were built with a different model");
  const v = encodeURIComponent(meta.built || "1"), get = async f => new Uint8Array(await (await fetch(`data/emb/${f}?v=${v}`)).arrayBuffer());
  const parts = await Promise.all(meta.shards.map(get));
  const q = new Int8Array(meta.n * meta.dim); let o = 0; for (const p of parts) { q.set(new Int8Array(p.buffer, p.byteOffset, p.byteLength), o); o += p.byteLength; }
  const scale = new Float32Array((await get(meta.scale)).buffer), ids = new Int32Array((await get(meta.ids)).buffer);
  const pb = await get(meta.phrases.file), pn = meta.phrases.n;
  PH = { n: pn, dim: meta.dim, q: new Int8Array(pb.buffer, 0, pn * meta.dim), scale: new Float32Array(pb.buffer.slice(pn * meta.dim)), map: meta.phrases.map };
  return { ...meta, q, scale, ids };
}

export async function startAI() {
  if (AIState.status !== "off" && AIState.status !== "error") return;
  AIState.status = "loading"; AIState.progress = 0; emit();
  try {
    let ok = false; try { ok = (await fetch("data/emb/meta.json", { method: "HEAD", cache: "no-cache" })).ok; } catch { }
    if (!ok) { AIState.status = "unavailable"; AIState.error = "متجهات الأحاديث غير مبنية (npm run build:ai)"; emit(); return; }
    const vecP = loadVectors();
    const T = await import("./vendor/transformers.min.js");
    T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.localModelPath = new URL("models/", location.href).pathname; // path, not URL (the library joins paths)
    T.env.fetch = chunkAwareFetch;
    // Pin the plain WebAssembly build of ONNX Runtime (14 MB, CPU only): it fits the host's per-file limit
    // and behaves the same on every browser (no WebGPU/JSPI variant selection).
    T.env.backends.onnx.wasm.wasmPaths = { mjs: abs("vendor/ort/ort-wasm-simd-threaded.mjs"), wasm: abs("vendor/ort/ort-wasm-simd-threaded.wasm") };
    const files = {};
    extractor = await T.pipeline("feature-extraction", AI.model, {
      dtype: AI.dtype, device: "wasm",
      progress_callback: p => {
        if (p.status === "progress" && p.total) files[p.file] = [p.loaded, p.total];
        const v = Object.values(files); if (v.length) { AIState.progress = Math.round(100 * v.reduce((a, [l]) => a + l, 0) / v.reduce((a, [, t]) => a + t, 0)); emit(); }
      },
    });
    M = await vecP;
    await extractor("query: warmup", { pooling: "mean", normalize: true });
    AIState.status = "ready"; AIState.progress = 100; emit();
  } catch (e) { console.error(e); AIState.status = "error"; AIState.error = String(e.message || e); emit(); }
}

// returns { corpus: [{d, cos}], phrases: [{p, cos}] } — d = row in db, p = index in phrases.json
export async function semSearch(text, k = 30) {
  if (AIState.status !== "ready") return null;
  const t0 = performance.now();
  const qv = (await extractor("query: " + text, { pooling: "mean", normalize: true })).data;
  const corpus = vecSearch(M, qv, k).map(h => ({ d: M.ids[h.d], cos: h.cos }));
  const best = new Map();
  for (const h of vecSearch(PH, qv, 24)) { const p = PH.map[h.d]; if (!best.has(p) || h.cos > best.get(p)) best.set(p, h.cos); }
  const phrases = [...best].map(([p, cos]) => ({ p, cos })).sort((a, b) => b.cos - a.cos);
  AIState.ms = Math.round(performance.now() - t0);
  return { corpus, phrases };
}
