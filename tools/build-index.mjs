// Precompute search indexes so phones don't tokenise ~80k narrations on every visit.
import fs from "node:fs"; import zlib from "node:zlib";
import { buildIndex } from "../public/logic.js";
import { buildTrIndex } from "../public/engine.js";
import { encodeIndex } from "../public/binindex.js";
const gz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const t0 = Date.now();
const ix = await buildIndex(gz("public/data/db.json.gz"));
fs.writeFileSync("public/data/index-ar.bin.gz", zlib.gzipSync(encodeIndex(ix), { level: 9 }));
for (const l of ["en", "fr", "ur", "id"]) {
  const f = `public/data/tr-${l}.json.gz`; if (!fs.existsSync(f)) continue;
  fs.writeFileSync(`public/data/index-${l}.bin.gz`, zlib.gzipSync(encodeIndex(buildTrIndex(gz(f), l)), { level: 9 }));
}
for (const f of fs.readdirSync("public/data").filter(f => f.startsWith("index-"))) console.log(f, (fs.statSync("public/data/" + f).size / 1e6).toFixed(2), "MB");
console.log("built in", ((Date.now() - t0) / 1000).toFixed(1), "s");
