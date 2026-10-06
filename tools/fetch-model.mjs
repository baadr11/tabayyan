// Downloads the AI model (multilingual-e5-small, ONNX int8 — Xenova conversion, MIT) into public/models/
// so the site serves it itself (no third-party calls at runtime). Run once: npm run fetch:model
import fs from "node:fs"; import path from "node:path";
const REPO = "Xenova/multilingual-e5-small", BASE = `https://huggingface.co/${REPO}/resolve/main/`;
const FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "onnx/model_quantized.onnx"];
const OUT = path.join("public/models", REPO);
for (const f of FILES) {
  const dest = path.join(OUT, f); if (fs.existsSync(dest)) { console.log("✓", f, "(exists)"); continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(BASE + f); if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); console.log("✓", f, (fs.statSync(dest).size / 1e6).toFixed(1), "MB");
}
