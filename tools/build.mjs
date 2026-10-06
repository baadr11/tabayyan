// Production build: public/ → dist/ with content-hashed data files, a data manifest,
// a versioned service worker, and a size report. Fails on anything that would ship broken.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import zlib from "node:zlib";
const SRC = "public", OUT = "dist";
fs.rmSync(OUT, { recursive: true, force: true }); fs.cpSync(SRC, OUT, { recursive: true });
const must = ["db.json.gz", "index-ar.bin.gz", "phrases.json", "quran.json.gz", "tr-en.json.gz", "index-en.bin.gz"];
for (const f of must) if (!fs.existsSync(path.join(SRC, "data", f))) { console.error("✗ missing data/" + f + (f.startsWith("index") ? " — run: npm run build:index" : "")); process.exit(1); }
// stale index guard
const recs = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(SRC, "data/db.json.gz")))).recs.length;
const ix = zlib.gunzipSync(fs.readFileSync(path.join(SRC, "data/index-ar.bin.gz")));
if (ix.readUInt32LE(20) !== recs) { console.error("✗ index-ar is stale (db changed) — run: npm run build:index"); process.exit(1); }

const manifest = {}; const hashAll = crypto.createHash("sha256");
for (const f of fs.readdirSync(path.join(OUT, "data"))) {
  const p = path.join(OUT, "data", f); if (fs.statSync(p).isDirectory() || f === "manifest.json") continue;
  const buf = fs.readFileSync(p); const h = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10); hashAll.update(h);
  const ext = f.match(/(\.[a-z]+)*$/)[0], base = f.slice(0, f.length - ext.length), name = `${base}.${h}${ext}`;
  fs.renameSync(p, path.join(OUT, "data", name)); manifest[f] = name;
}
fs.writeFileSync(path.join(OUT, "data/manifest.json"), JSON.stringify(manifest, null, 1));
for (const f of fs.readdirSync(OUT).filter(f => /\.(js|html|webmanifest)$/.test(f))) hashAll.update(fs.readFileSync(path.join(OUT, f)));
const version = hashAll.digest("hex").slice(0, 12);
fs.writeFileSync(path.join(OUT, "sw.js"), fs.readFileSync(path.join(OUT, "sw.js"), "utf8").replace("__VERSION__", version));
// dev-only files out of the release
for (const f of ["emb/_progress.bin", "emb/_progress.bin.s"]) fs.rmSync(path.join(OUT, "data", f), { force: true });
for (const f of ["vendor/ort/LICENSE"]) if (!fs.existsSync(path.join(OUT, f))) {}

// split files above the host's per-file limit (Cloudflare: 25 MB); semantic.js streams the parts back together
const LIMIT = 24e6, PART = 20e6, chunks = {}, rel = p => path.relative(OUT, p).split(path.sep).join("/");
for (const root of ["models", "vendor"]) {
  const base = path.join(OUT, root); if (!fs.existsSync(base)) continue;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name); if (e.isDirectory()) { walk(p); continue; }
      const st = fs.statSync(p); if (st.size <= LIMIT) continue;
      const buf = fs.readFileSync(p), parts = [];
      for (let o = 0, i = 0; o < buf.length; o += PART, i++) { const f = `${p}.part${String(i).padStart(2, "0")}`; fs.writeFileSync(f, buf.subarray(o, o + PART)); parts.push(rel(f)); }
      fs.rmSync(p); chunks[rel(p)] = { parts, size: st.size };
    }
  })(base);
}
fs.mkdirSync(path.join(OUT, "models"), { recursive: true });
fs.writeFileSync(path.join(OUT, "models/chunks.json"), JSON.stringify(chunks, null, 1));

const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
const big = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (fs.statSync(p).size > 25e6) big.push(p); } })(OUT);
if (big.length) { console.error("✗ files over Cloudflare Pages' 25 MB limit:", big); process.exit(1); }
const warn = [];
if (!fs.existsSync(path.join(SRC, "data/emb/meta.json"))) { console.error("✗ AI vectors missing — run: npm run build:ai"); process.exit(1); }
if (!fs.existsSync(path.join(SRC, "models/Xenova/multilingual-e5-small/onnx/model_quantized.onnx"))) { console.error("✗ AI model missing — run: npm run fetch:model"); process.exit(1); }
{ const meta = JSON.parse(fs.readFileSync(path.join(SRC, "data/emb/meta.json"))); if (meta.dbRecs !== recs) { console.error("✗ AI vectors are stale (db changed) — run: npm run build:ai"); process.exit(1); } }
if (!fs.readdirSync(path.join(SRC, "data")).some(f => f.startsWith("he-"))) warn.push("no approved translation packs (npm run import:icadb / import:hadeethenc) — replies won't quote translations");
for (const f of ["azer.ttf", "bukra-regular.ttf", "bukra-bold.ttf", "uthmanic-hafs.otf", "uthman-tn.ttf"]) if (!fs.existsSync(path.join(SRC, "fonts", f))) warn.push("font missing: fonts/" + f + " (falls back gracefully)");
console.log(`✓ dist/ built · version ${version} · ${(size(OUT) / 1e6).toFixed(1)} MB · ${Object.keys(manifest).length} data files hashed`);
warn.forEach(w => console.log("! " + w));
