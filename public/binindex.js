// Compact precomputed inverted index (built by tools/build-index.mjs, loaded in the browser).
// Layout (little-endian): "TBIX" | u32 N(docs) | f32 avgdl | u32 nTerms | u32 vocabBytes | u32 nDoclen | vocab(utf8, \n-joined)
//   | u16[nDoclen] doclen | per term: varint count, then count×(varint docDelta, varint tf)
// Loaded into ONE Uint32Array of interleaved (doc, tf) pairs; each term maps to a subarray view.
export function encodeIndex({ N, AVGDL, INDEX, DOCLEN }) {
  const terms = [...INDEX.keys()];
  const vocab = new TextEncoder().encode(terms.join("\n"));
  const bytes = []; const push = v => { while (v >= 0x80) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; } bytes.push(v); };
  for (const t of terms) { const p = INDEX.get(t); push(p.length / 2); let prev = 0; for (let i = 0; i < p.length; i += 2) { push(p[i] - prev); prev = p[i]; push(p[i + 1]); } }
  const H = 24, head = new ArrayBuffer(H), hv = new DataView(head);
  hv.setUint8(0, 84); hv.setUint8(1, 66); hv.setUint8(2, 73); hv.setUint8(3, 88); hv.setUint32(4, N, true); hv.setFloat32(8, AVGDL, true); hv.setUint32(12, terms.length, true); hv.setUint32(16, vocab.length, true); hv.setUint32(20, DOCLEN.length, true);
  const dl = new Uint8Array(new Uint16Array(DOCLEN).buffer);
  const out = new Uint8Array(H + vocab.length + dl.length + bytes.length);
  out.set(new Uint8Array(head), 0); out.set(vocab, H); out.set(dl, H + vocab.length); out.set(bytes, H + vocab.length + dl.length);
  return out;
}
export function decodeIndex(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== "TBIX") throw new Error("bad index");
  const N = dv.getUint32(4, true), AVGDL = dv.getFloat32(8, true), nT = dv.getUint32(12, true), vb = dv.getUint32(16, true), nDL = dv.getUint32(20, true);
  const terms = new TextDecoder().decode(u8.subarray(24, 24 + vb)).split("\n");
  let o = 24 + vb;
  const DOCLEN = new Uint16Array(nDL); for (let i = 0; i < nDL; i++) { DOCLEN[i] = u8[o] | (u8[o + 1] << 8); o += 2; }
  // first pass: total postings
  const rd = () => { let v = 0, s = 0, b; do { b = u8[o++]; v |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return v >>> 0; };
  const start = o; let total = 0;
  for (let t = 0; t < nT; t++) { const c = rd(); total += c; for (let i = 0; i < 2 * c; i++) rd(); }
  const P = new Uint32Array(total * 2); const INDEX = new Map(); o = start; let w = 0;
  for (let t = 0; t < nT; t++) { const c = rd(), s0 = w; let prev = 0; for (let i = 0; i < c; i++) { prev += rd(); P[w++] = prev; P[w++] = rd(); } INDEX.set(terms[t], P.subarray(s0, w)); }
  return { N, AVGDL, INDEX, DOCLEN };
}
// is doc d in a posting list (docs at even positions, ascending)?
export function hasDoc(p, d) { let lo = 0, hi = p.length / 2 - 1; while (lo <= hi) { const m = (lo + hi) >> 1, v = p[2 * m]; if (v === d) return true; if (v < d) lo = m + 1; else hi = m - 1; } return false; }
