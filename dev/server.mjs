// Local dev server: serves /public and runs the Pages Functions in Node 18+.
//   node dev/server.mjs          (real Dorar proxy)
//   MOCK=1 node dev/server.mjs   (offline Dorar test double)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import * as dorarFn from "../functions/api/dorar.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), process.argv.includes("--dist") ? "../dist" : "../public");
const PORT = Number(process.env.PORT || 8788);
const env = {};
if (process.env.MOCK) { const { installMocks } = await import("./mocks.mjs"); installMocks(); }

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".css": "text/css", ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".gz": "application/gzip", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".bin": "application/octet-stream" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    const mod = url.pathname === "/api/dorar" ? dorarFn : null;
    const fn = mod && (req.method === "POST" ? mod.onRequestPost : mod.onRequestGet);
    if (!fn) { res.writeHead(404).end(); return; }
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
    const out = await fn({ request, env });
    res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); return;
  }
  let p = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`Tabayyan → http://localhost:${PORT}${process.env.MOCK ? "  (MOCK mode)" : ""}`));
