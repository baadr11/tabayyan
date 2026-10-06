// Tabayyan local engine: cross-lingual retrieval + matching rules. No paid API.
import { DIAC, toks, bm25, fromLocal, REJ } from "./logic.js";
import { AI } from "./policy.js";

/* ---------- language detection (rules) ---------- */
export function detectLang(s) {
  const t = String(s || "");
  if (/[\u4e00-\u9fff]/.test(t)) return "zh";
  if (/[ٹڈڑںےۓگھ]/.test(t) || /\b(ہے|کے|کی|میں)\b/.test(t)) return "ur";
  if (/[\u0600-\u06FF]/.test(t)) return "ar";
  const l = " " + t.toLowerCase() + " ";
  if (/[éèêàçùœ]/.test(l) || /\s(le|la|les|est|des|du|qui|que|celui|d'entre|jusqu)\s/.test(l)) return "fr";
  if (/\s(kwa|mtume|mwenyezi|alisema|nusu|katika|yeyote|wake|hakika|matendo|nia|ya|wa|ni)\s/.test(l) && !/\s(yang|adalah|bersabda|sebagian)\s/.test(l)) return "sw";
  if (/\s(yang|dan|adalah|dari|kepada|sebagian|iman|bersabda|nabi)\s/.test(l)) return "id";
  return "en";
}
export const LANG_NAME = { ar: "العربية", en: "الإنجليزية", fr: "الفرنسية", ur: "الأردية", id: "الإندونيسية", zh: "الصينية", sw: "السواحيلية" };

/* ---------- latin/urdu tokenization with synonym folding ---------- */
const LSTOP = {
  en: "is the a an of are was were be been to in into and or he she it they you your yours his her their them who whom which that this these those for on with as by at from said say says saying prophet messenger allahs allah's pbuh saw peace upon him muhammad hadith sallallahu alaihi wasallam will shall has have had do does did not no so if then there than also its it's i we us our me my one all any al el".split(" "),
  fr: "le la les l de des du d un une et est sont que qui dans en a à au aux par pour sur ne pas il elle ils vous nous ce cet cette son sa ses leur prophète messager dit a dieu allah se qu y ou".split(" "),
  ur: "کا کی کے میں ہے ہیں نے کو سے اور یہ وہ جو تو پر تھا تھی فرمایا نبی اللہ رسول کہ بھی ہی ایک".split(" "),
  id: "yang dan di ke dari itu ini adalah dengan untuk nabi bersabda rasulullah allah tidak akan atau pada dalam kami kalian ia dia saw".split(" "),
  sw: "na ya wa za la kwa ni katika kuwa hii huu hiyo yule ile mtume nabii alisema amesema mwenyezi mungu allah kwamba si au lakini pia hata yake wake kama rehema amani juu yake swalla".split(" "),
  zh: "的 了 是 在 和 与 他 她 它 你 我 们 说 曰 先知 使者 安拉 真主 愿主福安之 这 那 之 也 就 都 而 及".split(" "),
};
const LSTOPSET = Object.fromEntries(Object.entries(LSTOP).map(([k, v]) => [k, new Set(v)]));
const SYN = [
  [/^(deed|action|act|work)s?$/, "act"], [/^(intention|intent|niyyah|niyya)s?$/, "intent"], [/^(paradise|heaven|jannah|garden)s?$/, "paradis"],
  [/^(hell|hellfire|fire)$/, "hell"], [/^(mother|mom|mum)s?$/, "mother"], [/^(knowledge|learning|ilm)$/, "knowledg"], [/^(faith|belief|iman|eeman)$/, "faith"],
  [/^(religion|deen|din)$/, "religion"], [/^(charity|sadaqa|sadaqah|alms)$/, "charity"], [/^(prayer|salat|salah)s?$/, "prayer"], [/^(believer|mumin|mu'min)s?$/, "believer"],
  [/^(purity|cleanliness|purification|tahara|tahur|clean)$/, "pure"], [/^(foot|feet)$/, "foot"], [/^(half|part)$/, "half"], [/^(angry|anger)$/, "anger"], [/^(under|beneath|below|underneath)$/, "under"], [/^(burden|charge|charges|burdens|task)$/, "burden"], [/^(capacity|ability|bear)$/, "capacity"], [/^(lie|lies|lay|located)$/, "is"],
];
function latinStem(w) {
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}
function zhToks(s) {
  // Chinese has no spaces: index overlapping character bigrams of Han runs
  const out = []; const stop = LSTOPSET.zh;
  for (const run of String(s || "").match(/[\u4e00-\u9fff]+/g) || []) {
    let r = run; for (const w of stop) if (w.length > 1) r = r.split(w).join("|");
    for (const seg of r.split("|")) {
      if (seg.length === 1) { if (!stop.has(seg)) out.push(seg); continue; }
      for (let i = 0; i + 1 < seg.length; i++) out.push(seg.slice(i, i + 2));
    }
  }
  return out;
}
export function ltoks(s, lang) {
  if (lang === "zh") return zhToks(s);
  const stop = LSTOPSET[lang] || LSTOPSET.en;
  const raw = String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\(ﷺ\)|ﷺ|\(pbuh\)|\(saw\)|\(s\.a\.w\)|\(s\)|\(may peace be upon him\)/g, " ")
    .replace(/[^a-z\u0600-\u06FF0-9']+/g, " ").split(" ");
  const out = [];
  for (let w of raw) {
    w = w.replace(/^'+|'+$/g, "");
    if (w.length < 2 || stop.has(w)) continue;
    let hit = false; for (const [re, v] of SYN) if (re.test(w)) { out.push(v); hit = true; break; }
    if (!hit) out.push(lang === "ur" ? w : latinStem(w));
  }
  return out;
}

/* ---------- translation index (same BM25 shape as the Arabic one) ---------- */
export function buildTrIndex(arr, lang) {
  const N = arr.length, INDEX = new Map(), DOCLEN = new Uint16Array(N); let total = 0, docs = 0;
  for (let d = 0; d < N; d++) {
    if (!arr[d]) continue;
    const tk = ltoks(arr[d], lang); DOCLEN[d] = tk.length; total += tk.length; docs++;
    const tf = new Map(); for (const t of tk) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, c] of tf) { let p = INDEX.get(t); if (!p) { p = []; INDEX.set(t, p); } p.push(d, c); }
  }
  return { arr, lang, N: docs, INDEX, DOCLEN, AVGDL: total / Math.max(1, docs) };
}
export function trSearch(tix, query, k = 10) {
  const qt = [...new Set(ltoks(query, tix.lang))]; if (!qt.length) return [];
  const sc = new Map(), K1 = 1.2, B = 0.5;
  for (const t of qt) {
    const p = tix.INDEX.get(t); if (!p) continue;
    const df = p.length / 2; const idf = Math.log(1 + (tix.N - df + .5) / (df + .5));
    for (let i = 0; i < p.length; i += 2) { const d = p[i], f = p[i + 1]; sc.set(d, (sc.get(d) || 0) + idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * tix.DOCLEN[d] / tix.AVGDL))); }
  }
  // weighted coverage: share of the query's information (idf) present in the doc
  const idfOf = t => { const p = tix.INDEX.get(t); const df = p ? p.length / 2 : 0.5; return Math.log(1 + (tix.N - df + .5) / (df + .5)); };
  const wsum = qt.reduce((a, t) => a + idfOf(t), 0);
  const top = [...sc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([d, s]) => {
    const dl = ltoks(tix.arr[d], tix.lang), dt = new Set(dl);
    const hit = qt.filter(t => dt.has(t)).length;
    let cov = qt.reduce((a, t) => a + (dt.has(t) ? idfOf(t) : 0), 0) / wsum;
    // precision guard: a short query (1–2 content words) must also cover a real share of the narration,
    // otherwise «best + families» would match any text that happens to contain both words
    const rev = hit / Math.max(1, new Set(dl).size);
    // proximity: smallest window of the translation holding all matched query words
    const want = new Set(qt.filter(t => dt.has(t))); let win = Infinity;
    if (want.size) { const last = new Map(); for (let i = 0; i < dl.length; i++) { if (want.has(dl[i])) { last.set(dl[i], i); if (last.size === want.size) win = Math.min(win, i - Math.min(...last.values()) + 1); } } }
    if (win > Math.max(8, 3 * want.size)) cov *= 0.6;
    if (qt.length < 3 && rev < 0.4) cov *= 0.5;
    return { d, s: s * (0.4 + cov), cov, rev, nq: qt.length };
  });
  // final order: information covered × how focused the narration is on it
  return top.sort((a, b) => b.s - a.s).slice(0, Math.max(k, 10)).sort((a, b) => (b.cov * (0.5 + b.rev)) - (a.cov * (0.5 + a.rev))).slice(0, k);
}

/* ---------- curated circulating phrases (search aliases, never grades) ---------- */
export function phraseHit(phrases, text, lang) {
  const q = new Set(ltoks(text, lang)); if (q.size < 2) return null;
  let best = null;
  for (const p of phrases) for (const v of p.v) {
    const vl = detectLang(v); if (vl !== lang && !(lang === "en" && vl === "en")) continue;
    const vt = [...new Set(ltoks(v, vl))]; if (!vt.length) continue;
    const inter = vt.filter(t => q.has(t)).length;
    const score = inter / Math.max(vt.length, q.size * 0.8);
    if (!best || score > best.score) best = { ar: p.ar, variant: v, score };
  }
  return best && best.score >= 0.7 ? best : null;
}

/* ---------- Arabic similarity rules ---------- */
export function arSim(anchor, text, ix) {
  const A = [...new Set(toks(anchor))], Cl = toks(text), C = new Set(Cl);
  if (!A.length) return 0;
  if (!ix) return A.filter(t => C.has(t)).length / A.length;
  const w = t => { const p = ix.INDEX.get(t); const df = p ? p.length / 2 : 0.5; return Math.log(1 + (ix.N - df + .5) / (df + .5)); };
  const tot = A.reduce((a, t) => a + w(t), 0);
  return A.reduce((a, t) => a + (C.has(t) ? w(t) : 0), 0) / tot;
}
// do two consecutive anchor words appear consecutively in the text?
export function sharesBigram(anchor, text) {
  const A = toks(anchor), C = toks(text); if (A.length < 2) return true;
  const bg = new Set(); for (let i = 0; i + 1 < C.length; i++) bg.add(C[i] + " " + C[i + 1]);
  for (let i = 0; i + 1 < A.length; i++) if (bg.has(A[i] + " " + A[i + 1])) return true;
  return false;
}
export const SAME_T = 0.8, PART_T = 0.55;

/* ---------- matching pipeline: lexical + translations + on-device AI ---------- */
// inputs:
//   tix   : translation index for the query language (major collections, aligned to db rows)
//   he    : {tix, items:[{d, ar}]} HadeethEnc pack for the language (optional)
//   sem   : [{d, cos}] on-device semantic hits against the Arabic rows (optional)
// returns {anchor, via, conf, same:[docIdx], partial:[docIdx], near:[docIdx], trHits, heHit}
export function localMatch(ix, { text, lang, phrases, tix, he, sem }) {
  let anchor = "", via = "", conf = 0, trHits = [], heHit = null, anchorDoc = -1;
  if (lang === "ar") { anchor = text; via = "نص عربي"; conf = 1; }
  else {
    const ph = phrases ? phraseHit(phrases, text, lang) : null;
    if (ph) { anchor = ph.ar; via = "عبارة متداولة معروفة"; conf = ph.score; }
    if (tix) {
      trHits = trSearch(tix, text, 8);
      const graded = d => { const t = ix.db.books[ix.db.recs[d][0]][2]; return t === "sahihayn" || t === "sunan" || t === "nah"; };
      if (trHits[0] && !graded(trHits[0].d)) {
        const alt = trHits.find(h => graded(h.d) && h.cov >= trHits[0].cov - 0.05);
        if (alt) trHits = [alt, ...trHits.filter(h => h !== alt)];
      }
    }
    if (he?.tix) { const h = trSearch(he.tix, text, 3)[0]; if (h) heHit = { ...h, item: he.items[h.d] }; }
    if (!anchor) {
      const t = trHits[0], h = heHit;
      const best = [t && { kind: "tr", cov: t.cov }, h && { kind: "he", cov: h.cov }].filter(Boolean).sort((a, b) => b.cov - a.cov)[0];
      // the fewer words the user gave, the more of them must match (precision before recall)
      const need = n => n >= 5 ? 0.6 : n === 4 ? 0.75 : n >= 2 ? 0.9 : 2;
      const nq = (t || h)?.nq ?? 0;
      if (best && best.cov >= need(nq) && (best.kind === "he" || (t.nq >= 3 || t.rev >= 0.4))) {
        if (best.kind === "tr") { anchorDoc = t.d; anchor = ix.db.recs[t.d][2]; via = "ترجمة معتمدة للحديث"; conf = t.cov; }
        else { anchor = h.item.ar; anchorDoc = h.item.d ?? -1; via = "موسوعة الأحاديث المترجمة"; conf = h.cov; }
      }
    }
  }
  // on-device AI: understands meaning across languages when the wording differs. It only proposes an Arabic
  // anchor; the verdict still comes from the narrations found from that anchor. Low-confidence → suggestions only.
  const ai = sem ? aiDecide(ix, sem, phrases, lang) : null;
  const useAI = () => { anchor = ai.auto.anchor; anchorDoc = ai.auto.d ?? -1; via = "الفهم الدلالي على الجهاز"; conf = ai.auto.cos; };
  const semStrong = !!ai?.auto;
  if (!anchor && semStrong) useAI();
  if (!anchor) return { anchor: "", via: "", conf: 0, same: [], partial: [], near: trHits.map(h => h.d).slice(0, 5), suggest: ai?.suggest || [], trHits, heHit };

  const fromRecord = () => anchorDoc >= 0 || via === "ترجمة معتمدة للحديث";
  const stage = core0 => {
    const hits = bm25(ix, core0, 30), same = [], partial = [], sim = new Map();
    for (const { d } of hits) {
      const core = coreOf(ix.db.recs[d][2]);
      let s2 = arSim(core0, core, ix);
      // anchor is a whole narration (may carry narrator/compiler notes): also accept when the
      // candidate's saying is fully inside it and the overlap is substantial both ways
      if (fromRecord()) { const back = arSim(core, core0, ix); if (back >= 0.85 && s2 >= 0.5) s2 = Math.max(s2, back * 0.95); }
      sim.set(d, s2);
      // a weak/fabricated LONGER narration that merely contains the phrase does not judge the phrase itself
      // (e.g. «اطلبوا العلم ولو بالصين، فإن طلب العلم فريضة…»): acceptance transfers to parts, rejection doesn't
      const A0 = new Set(toks(core0)), extra = new Set(toks(core).filter(t => !A0.has(t))).size;
      const longer = extra >= 3 && extra >= 0.4 * A0.size;
      if (s2 >= SAME_T && longer && REJ(fromLocal(ix.db, d).cls)) { if (sharesBigram(core0, core)) partial.push(d); continue; }
      if (s2 >= SAME_T && sharesBigram(core0, core)) same.push(d);
      else if (s2 >= PART_T && sharesBigram(core0, core)) partial.push(d);
    }
    same.sort((a, b) => sim.get(b) - sim.get(a)); partial.sort((a, b) => sim.get(b) - sim.get(a));
    return { hits, same, partial };
  };
  let anchorCore = anchorDoc >= 0 || via === "ترجمة معتمدة للحديث" ? coreOf(anchor) : anchor;
  let { hits, same, partial } = stage(anchorCore);
  // lexical route found nothing exact (e.g. paraphrased Arabic): let the AI re-anchor
  if (!same.length && semStrong && via !== "الفهم الدلالي على الجهاز" && via !== "عبارة متداولة معروفة") {
    useAI(); anchorCore = anchorDoc >= 0 ? coreOf(anchor) : anchor; ({ hits, same, partial } = stage(anchorCore));
  }
  const put = (arr, d, front) => { if (d < 0 || same.includes(d) || partial.includes(d)) return; front ? arr.unshift(d) : arr.push(d); };

  if (via === "ترجمة معتمدة للحديث") {
    put(trHits[0].cov >= 0.8 ? same : partial, trHits[0].d, true);
    for (const h of trHits.slice(1, 4)) if (h.cov >= 0.75) put(partial, h.d);
  } else if (via === "الفهم الدلالي على الجهاز" && anchorDoc >= 0) {
    put(same, anchorDoc, true);
  } else if (via === "موسوعة الأحاديث المترجمة" && anchorDoc >= 0) {
    put(heHit.cov >= 0.8 ? same : partial, anchorDoc, true);
  } else if (trHits.length && !same.length) {
    trHits.slice(0, 3).filter((h, i) => h.cov >= (i === 0 ? 0.6 : 0.75)).reverse().forEach(h => put(partial, h.d, true));
  }

  const near = hits.map(h => h.d).filter(d => !same.includes(d) && !partial.includes(d)).slice(0, 5);
  return { anchor: anchorCore, via, conf, same: same.slice(0, 12), partial: partial.slice(0, 8), near, suggest: same.length || partial.length ? [] : (ai?.suggest || []), trHits, heHit };
}

/* ---------- AI decision: auto-anchor only when confident and clearly ahead; otherwise suggest ---------- */
// sem = { corpus: [{d, cos}], phrases: [{p, cos}] }
export function aiDecide(ix, sem, phrases, lang = "en") {
  const T = AI, corpus = sem.corpus || [];
  // "peak": how far the best narration stands out from the background of the top 30 (flat = no real match)
  const bg = corpus.slice(10, 30), base = bg.length ? bg.reduce((a, h) => a + h.cos, 0) / bg.length : 0;
  const peak = corpus[0] ? corpus[0].cos - base : 0;
  // corpus hits that are the same hadith (same Arabic saying) form one group
  const groups = [];
  for (const h of corpus.slice(0, 12)) {
    const core = coreOf(ix.db.recs[h.d][2]);
    const g = groups.find(g => arSim(g.core, core, ix) >= 0.8 || arSim(core, g.core, ix) >= 0.8);
    if (!g) groups.push({ d: h.d, cos: h.cos, core });
  }
  const ph = (sem.phrases || []).filter(x => phrases?.[x.p]);
  let auto = null;
  if (ph[0] && ph[0].cos >= T.phraseAuto && (!ph[1] || ph[0].cos - ph[1].cos >= T.phraseGap)) auto = { kind: "phrase", cos: ph[0].cos, anchor: phrases[ph[0].p].ar, d: -1 };
  else if (groups[0] && groups[0].cos >= T.corpusAuto && peak >= T.corpusPeak) auto = { kind: "doc", cos: groups[0].cos, anchor: ix.db.recs[groups[0].d][2], d: groups[0].d };
  if (auto) return { auto, suggest: [], peak };
  const need = T.suggest[lang] ?? T.suggest.default;
  const cands = [
    ...ph.filter(x => x.cos >= need).map(x => ({ kind: "phrase", cos: x.cos, anchor: phrases[x.p].ar, d: -1 })),
    ...(peak >= T.suggestPeak ? groups.filter(g => g.cos >= need).map(g => ({ kind: "doc", cos: g.cos, anchor: ix.db.recs[g.d][2], d: g.d })) : []),
  ].sort((a, b) => (b.cos + (b.kind === "phrase" ? 0.012 : 0)) - (a.cos + (a.kind === "phrase" ? 0.012 : 0))); // curated sayings first on near-ties
  const uniq = [];
  for (const c of cands) { const core = c.kind === "doc" ? coreOf(c.anchor) : c.anchor; if (!uniq.some(u => arSim(u.core, core, ix) >= 0.8 || arSim(core, u.core, ix) >= 0.8)) uniq.push({ ...c, core }); }
  return { auto: null, suggest: uniq.slice(0, 3), peak };
}

/* ---------- int8 vector search (doc vectors precomputed by tools/build-embeddings.mjs) ---------- */
export function quantize(vec) {
  let m = 0; for (const v of vec) m = Math.max(m, Math.abs(v));
  const s = m / 127 || 1, q = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) q[i] = Math.round(vec[i] / s);
  return { q, s };
}
export function vecSearch(M, qv, k = 10) {
  const { n, dim, q, scale } = M; const top = [];
  let minTop = -Infinity;
  for (let d = 0; d < n; d++) {
    let acc = 0; const o = d * dim;
    for (let i = 0; i < dim; i++) acc += q[o + i] * qv[i];
    const cos = acc * scale[d];
    if (top.length < k || cos > minTop) {
      top.push({ d, cos }); top.sort((a, b) => b.cos - a.cos); if (top.length > k) top.pop();
      minTop = top[top.length - 1].cos;
    }
  }
  return top;
}

// the Prophet's words inside an English translation: the last quoted segment (used for the AI "English bridge")
export function englishCore(t) {
  const segs = String(t || "").split(/["“”«»]/).map(x => x.trim()).filter(x => x.length > 15);
  return (segs.length > 1 ? segs[segs.length - 1] : String(t || "")).slice(0, 300);
}
// the prophetic words inside a narration: text between quotes if present
export function coreOf(t) {
  const s = String(t || "").replace(DIAC, "");
  const parts = s.split('"');
  if (parts.length >= 2) { const seg = []; for (let i = 1; i < parts.length; i += 2) if (parts[i].trim().length > 2) seg.push(parts[i]); if (seg.length) return seg.join(" "); }
  return s;
}
