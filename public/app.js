import { DIAC, buildIndex, bm25, fromLocal, fromDorar, decide, CLS_UI } from "./logic.js";
import { detectLang, LANG_NAME, buildTrIndex, localMatch, arSim, sharesBigram, coreOf, SAME_T, PART_T } from "./engine.js";
import { buildReply } from "./replies.js";
import { decodeIndex } from "./binindex.js";
import { startAI, semSearch, onAIState, AIState } from "./semantic.js";
import { PRINCIPAL_IMAMS, CLASSICAL_IMAMS, CONTEMPORARY_SCHOLARS, FATWA_REFERRALS, CONTACT_EMAIL } from "./policy.js";
import { buildQuran, findVerse, verseRef, scopeOf } from "./scope.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Number(n).toLocaleString("ar-SA-u-nu-latn");
const sleep = ms => new Promise(r => setTimeout(r, ms));
function pl(n, one, two, few, many) { n = +n; if (n === 1) return one; if (n === 2) return two; return fmt(n) + " " + (n >= 3 && n <= 10 ? few : many); }

let IX = null, QURAN = null, PHRASES = [], DORAR = false, ctl = null, current = null;
const TR = {}; // lang -> {arr, tix}
const HE = {}; // lang -> {items, tix} HadeethEnc pack

/* ---------------- data loading (embedded in single-file build, fetched when hosted) ---------------- */
function embedded(id) { const el = document.getElementById(id); if (!el) return null; const s = el.textContent.trim(); if (!s || s.startsWith("__")) return null; const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
let MANIFEST = null; // production build maps logical data names → content-hashed files
async function resolve(url) {
  if (MANIFEST === null) { try { const r = await fetch("data/manifest.json", { cache: "no-cache" }); MANIFEST = r.ok ? await r.json() : {}; } catch { MANIFEST = {}; } }
  const name = url.replace(/^data\//, ""); return MANIFEST[name] ? "data/" + MANIFEST[name] : url;
}
async function bytes(id, url) {
  const e = embedded(id); if (e) return e;
  const name = url.replace(/^data\//, "");
  if (url.startsWith("data/") && MANIFEST && Object.keys(MANIFEST).length && !MANIFEST[name]) throw new Error("not shipped: " + name); // optional pack absent
  const r = await fetch(await resolve(url)); if (!r.ok) throw new Error("missing " + url); return new Uint8Array(await r.arrayBuffer()); }
async function gunzipBytes(u) { return (u[0] === 0x1f && u[1] === 0x8b) ? new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()) : u; }
async function gunzipJSON(u) {
  const txt = (u[0] === 0x1f && u[1] === 0x8b) ? await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(u);
  return JSON.parse(txt);
}
(function fonts() {
  for (const [fam, id, w, ur] of [["Salawat", "f-sal", "400", "U+FDFA-FDFB"], ["KFGQPC Uthmanic Script HAFS", "f-hafs", "400"], ["Uthman Taha Naskh", "f-utn", "400"], ["Azer", "f-azer", "400"], ["Bukra", "f-br", "400"], ["Bukra", "f-bb", "700"]]) {
    const u = embedded(id); if (!u) continue;
    try { new FontFace(fam, u.buffer, ur ? { weight: w, unicodeRange: ur } : { weight: w }).load().then(f => document.fonts.add(f)).catch(() => {}); } catch { }
  }
})();

async function loadDB() {
  const bar = $("#dbBar i");
  try {
    const db = await gunzipJSON(await bytes("db", "data/db.json.gz"));
    PHRASES = await gunzipJSON(await bytes("phrases", "data/phrases.json")).catch(() => []);
    $("#nRecs").textContent = fmt(db.recs.length);
    bar.style.width = "30%";
    // precomputed index (tools/build-index.mjs) loads ~30× faster than tokenising on the device
    try { IX = { db, ...decodeIndex(await gunzipBytes(await bytes("ix-ar", "data/index-ar.bin.gz"))) }; if (IX.DOCLEN.length !== db.recs.length) throw new Error("stale index"); }
    catch (e) { console.warn("index fallback:", e.message); IX = await buildIndex(db, p => bar.style.width = (30 + 65 * p).toFixed(0) + "%", () => sleep(0)); }
    try { QURAN = await buildQuran(await gunzipJSON(await bytes("quran", "data/quran.json.gz")), () => sleep(0)); } catch (e) { console.warn("quran", e); }
    bar.style.width = "100%"; $("#dbDot").classList.add("ok"); $("#dbText").textContent = "القاعدة جاهزة";
    setTimeout(() => $("#dbBar").hidden = true, 400);
    $("#go").disabled = false;
    const shared = new URLSearchParams(location.search).get("q");
    if (shared) setTimeout(() => { $("#q").value = shared.slice(0, 1500); run(); }, 50);
    (window.requestIdleCallback || setTimeout)(() => loadTr("en"));
    // Desktop: start the on-device model right away. Phones / data-saver: wait for a tap (≈120MB once, then cached).
    const light = matchMedia("(pointer: coarse)").matches || navigator.connection?.saveData;
    if (!light) startAI();
  } catch (e) { console.error(e); $("#dbText").textContent = "تعذّر تحميل القاعدة"; }
  $("#go").disabled = false;
}
async function loadTr(lang) {
  if (lang === "ar") return null;
  if (TR[lang]) return TR[lang];
  try {
    const arr = await gunzipJSON(await bytes("tr-" + lang, `data/tr-${lang}.json.gz`));
    let tix; try { tix = { arr, lang, ...decodeIndex(await gunzipBytes(await bytes("ix-" + lang, `data/index-${lang}.bin.gz`))) }; if (tix.DOCLEN.length !== arr.length) throw 0; } catch { tix = buildTrIndex(arr, lang); }
    TR[lang] = { arr, tix };
  }
  catch { TR[lang] = { arr: null, tix: null }; }
  return TR[lang];
}
async function loadHe(lang) {
  if (lang in HE) return HE[lang];
  try { const items = await gunzipJSON(await bytes("he-" + lang, `data/he-${lang}.json.gz`)); HE[lang] = { items, tix: lang === "ar" ? null : buildTrIndex(items.map(x => x.t), lang) }; }
  catch { HE[lang] = null; }
  return HE[lang];
}
function heFor(docIdx, lang) {
  for (const l of [lang, "ar"]) { const p = HE[l]; const it = p?.items.find(x => x.d === docIdx); if (it) return { ...it, lang: l }; }
  return null;
}
async function checkDorar() {
  try { const r = await fetch("api/dorar?q=" + encodeURIComponent("إنما الأعمال بالنيات")); DORAR = r.ok && Array.isArray((await r.json()).results); } catch { DORAR = false; }
  $("#dorarState").textContent = DORAR ? "+ الموسوعة الحديثية مباشرة" : "";
}
async function dorar(q) {
  try { const r = await fetch("api/dorar?q=" + encodeURIComponent(q.replace(DIAC, "").slice(0, 120)), { signal: ctl?.signal }); if (!r.ok) return []; return (await r.json()).results || []; }
  catch (e) { if (e.name === "AbortError") throw e; return []; }
}

/* ---------------- steps ---------------- */
const steps = $("#steps");
function step(k, state, detail) { const li = steps.querySelector(`[data-k="${k}"]`); li.className = state; if (detail != null) li.querySelector(".d").textContent = detail; }
function resetSteps() { steps.hidden = false; steps.querySelectorAll("li").forEach(li => { li.className = ""; li.querySelector(".d").textContent = "—"; }); }

/* ---------------- pipeline (all local rules) ---------------- */
async function run(opts = {}) {
  const text = (opts.claim ?? $("#q").value).trim();
  if (!text) { $("#q").focus(); return; }
  if (!IX) return;
  $("#go").disabled = true; $("#result").hidden = true; resetSteps(); ctl = new AbortController();
  try {
    const lang = opts.lang || detectLang(text);
    step("read", "run", "تحديد اللغة");
    const manual = opts.anchorDoc != null || !!opts.anchorText;
    const scope = !manual ? scopeOf(text) : null;
    if (scope) { ["read", "search", "match", "judge"].forEach(k => step(k, "done", k === "read" ? "اللغة: " + LANG_NAME[lang] : "—")); renderScope(scope, text, lang); return; }
    const verse = !manual ? findVerse(QURAN, text, lang) : null;
    if (verse) { step("read", "done", "اللغة: " + LANG_NAME[lang]); step("search", "done", "تطابق آية من المصحف"); step("match", "done", "آية قرآنية"); step("judge", "done", "ليست حديثًا"); renderVerse(verseRef(QURAN, verse.d), text, lang); return; }
    const [tr, he] = await Promise.all([loadTr(lang), loadHe(lang), loadHe("ar")]);
    if (lang !== "ar" && !tr?.tix) { step("read", "done", LANG_NAME[lang] + " — حزمة اللغة غير متاحة هنا"); }
    else step("read", "done", "اللغة: " + LANG_NAME[lang]);
    await sleep(60);

    step("search", "run", AIState.status === "ready" ? "الذكاء الاصطناعي يفهم المعنى…" : "بحث في " + fmt(IX.N) + " رواية");
    const sem = opts.anchorDoc == null && !opts.anchorText ? await semSearch(text) : null;
    let m;
    if (opts.anchorDoc != null) {
      const a = coreOf(IX.db.recs[opts.anchorDoc][2]);
      m = localMatch(IX, { text: a, lang: "ar", phrases: null, tix: null }); m.via = "اختيارك اليدوي"; m.anchor = a;
      if (!m.same.includes(opts.anchorDoc)) m.same.unshift(opts.anchorDoc);
    } else if (opts.anchorText) {
      m = localMatch(IX, { text: opts.anchorText, lang: "ar", phrases: null, tix: null }); m.via = "اختيارك من اقتراحات الذكاء الاصطناعي";
    } else m = localMatch(IX, { text, lang, phrases: PHRASES, tix: tr?.tix, he: HE[lang], sem });
    let drecs = [];
    const dq = m.anchor || (lang === "ar" ? text : "");
    if (DORAR && dq) {
      const items = await dorar(coreOf(dq).slice(0, 120));
      drecs = items.map((it, i) => fromDorar(it, i)).filter(Boolean);
      for (const r of drecs) { const s = Math.max(arSim(m.anchor || dq, r.matn, IX), r.truncated ? arSim(r.matn, m.anchor || dq, IX) : 0); r._sim = s; }
    }
    step("search", "done", (m.anchor ? "الأصل العربي عبر: " + m.via : "لم يُعثر على أصل عربي") + (sem ? ` · AI ${AIState.ms}ms` : "") + (DORAR ? " · " + fmt(drecs.length) + " من الدرر" : ""));
    await sleep(60);

    step("match", "run", "قواعد المطابقة");
    const same = m.same.map(d => fromLocal(IX.db, d)), partial = m.partial.map(d => fromLocal(IX.db, d));
    for (const r of drecs) { if (r._sim >= SAME_T && sharesBigram(m.anchor || dq, r.matn)) same.push(r); else if (r._sim >= PART_T && sharesBigram(m.anchor || dq, r.matn)) partial.push(r); }
    step("match", "done", same.length ? pl(same.length, "رواية مطابقة", "روايتان مطابقتان", "روايات مطابقة", "رواية مطابقة") + (partial.length ? " · " + fmt(partial.length) + " قريبة" : "") : (partial.length ? fmt(partial.length) + " قريبة، لا مطابقة تامة" : "لا مطابقة"));
    await sleep(60);

    step("judge", "run");
    // the hadith encyclopedia (Dorar) is the reference for gradings: when it returned matching
    // rulings, judge by them (plus the Sahihayn); local gradings stay visible in the ledger
    const dSame = same.filter(r => r.origin === "dorar");
    const verdict = dSame.length ? decide([...dSame, ...same.filter(r => r.kind === "sahihayn")], partial) : decide(same, partial);
    if (verdict && dSame.length) verdict.why = "وفق أحكام المحدّثين في الموسوعة الحديثية (الدرر السنية). " + verdict.why;
    const graders = new Set([...same, ...partial].flatMap(r => r.grades.map(x => x.who)));
    step("judge", "done", verdict ? "من " + pl(graders.size, "حكم واحد", "حكمين", "أحكام", "حكمًا") : "امتناع عن الحكم");
    const near = m.near.map(d => fromLocal(IX.db, d));
    current = { claim: text, lang, same, partial, verdict, near, suggest: m.suggest || [], via: m.via, conf: m.conf, manual, aiUsed: !!sem, aiLoading: AIState.status === "loading",
      dorarUrl: dq ? "https://dorar.net/hadith/search?q=" + encodeURIComponent(coreOf(dq).replace(DIAC, "").slice(0, 80)) : "" };
    verdict ? renderResult() : renderNotFound();
  } catch (e) { console.error(e); showError(e.name === "AbortError" ? "أُوقف التحقق." : "تعذّر إكمال التحقق. أعد المحاولة."); }
  finally { $("#go").disabled = false; }
}
/* ---------------- مصطلح الحديث (تعريفات مختصرة على طريقة ابن الصلاح وابن حجر) ---------------- */
const TERM = {
  "صحيح": "ما اتصل سنده بنقل العدل الضابط عن مثله إلى منتهاه، من غير شذوذ ولا علة. وكل ما رواه البخاري ومسلم مسندًا في صحيحيهما فهو صحيح عند أهل العلم.",
  "حسن": "ما اتصل سنده بنقل العدل الذي خفّ ضبطه عن رتبة الصحيح، من غير شذوذ ولا علة. وهو مقبول يُحتج به كالصحيح وإن كان دونه في الرتبة.",
  "ضعيف": "ما لم تجتمع فيه صفات الصحيح ولا الحسن؛ كانقطاع في السند أو ضعف في أحد رواته. ولا يُجزم بنسبته إلى النبي ﷺ.",
  "ضعيف جدًا": "ما اشتد ضعفه، كأن يكون في سنده راوٍ متروك أو متهم أو منكر الحديث. ولا يتقوّى بكثرة الطرق ولا يُعمل به.",
  "موضوع": "الكذب المختلق المصنوع المنسوب إلى رسول الله ﷺ. وهو شر الضعيف، ولا تحل روايته إلا مقرونًا ببيان وضعه.",
  "لا أصل له": "ما لا يُعرف له إسناد عند المحدّثين، أو نصّوا على أنه ليس بحديث. فلا تجوز نسبته إلى النبي ﷺ.",
  "ليس حديثًا": "كلام صحيح النسبة إلى غير النبي ﷺ (صحابي أو تابعي أو حكيم)، فلا يُنسب إلى النبي ﷺ.",
  "مختلف فيه": "اختلف المحققون في الحكم عليه بحسب اجتهادهم في رجال السند وطرقه. والأسلم ألا يُنشر إلا بلفظه الثابت وبعد سؤال أهل الاختصاص.",
  "بلفظ آخر": "اللفظ المنتشر لم يرد بهذه الصيغة في كتب السنة، لكن معناه ورد بلفظ آخر. والواجب نقل اللفظ الثابت كما ورد لا الصيغة المتداولة.",
  "غير محسوم": "وُجدت الرواية في كتب السنة، لكن لم نجد في قاعدتنا حكمًا لمحقق معتمد عليها. وعدم الحكم ليس تصحيحًا ولا تضعيفًا.",
};

/* ---------------- render ---------------- */
const tone = c => (CLS_UI[c] || CLS_UI.unk)[1];
const chips = r => r.grades.length ? r.grades.map(g => `<span class="chip c-${tone(g.c)}"><i>${esc(g.who)}:</i> ${esc(g.g)}</span>`).join("") : `<span class="chip c-none">لا حكم لمحقق معتمد في القاعدة</span>`;
const GROUPS = [["sahihayn", "الصحيحان"], ["dorar", "أحكام المحدّثين — الدرر السنية"], ["sunan", "السنن والموطأ"], ["musnad", "المسانيد"], ["jami", "الجوامع والمختارات"], ["nah", "كتب الموضوعات والضعيفة"]];
function ledger(recs, rel, flat) {
  const groups = flat ? [["*", "الأقرب أولًا"]] : GROUPS; let h = "";
  for (const [k, label] of groups) {
    const rs = recs.filter(r => k === "*" || r.kind === k); if (!rs.length) continue;
    h += `<div class="grp"><div class="grp-h"><span>${label}</span><span>${fmt(rs.length)}</span></div>`;
    for (const r of rs) h += `<button class="item" type="button" data-id="${r.id}"><div class="t"><span class="bk">${esc(r.book)}</span><span class="no">${esc(r.ref)}</span></div>${rel ? `<div class="rel">${rel[r.id] === "same" ? "مطابق للفظ" : "قريب المعنى"}${r.origin === "dorar" ? " · الدرر" : ""}</div>` : (r.origin === "dorar" ? `<div class="rel">الدرر السنية</div>` : "")}<div class="chips">${chips(r)}</div></button>`;
    h += `</div>`;
  }
  return h;
}
function matnHTML(r) {
  let h = `<div class="matn-head"><span>النص كما في المصدر${r.origin === "dorar" ? " (الدرر السنية)" : ""}</span><b>${esc(r.book)} · ${esc(r.ref)}</b></div><blockquote>«${esc(r.matn)}${r.truncated ? " …" : ""}»</blockquote>`;
  if (r.truncated) h += `<div class="fine" style="margin-top:6px">النص مختصر في واجهة الدرر. افتح الرابط لقراءته كاملًا.</div>`;
  if (r.rawi) h += `<div class="fine" style="margin-top:6px">الراوي: ${esc(r.rawi)}</div>`;
  if (r.full) h += `<div class="isnad"><button type="button" aria-expanded="false">عرض النص كاملًا بسنده</button><p hidden>${esc(r.full)}</p></div>`;
  if (r.comment) h += `<div class="bookcomment"><div class="h">${r.commentBy ? "قال المصنّف (" + esc(r.commentBy) + ")" : "تعليق في الكتاب"}</div><p>${esc(r.comment)}</p></div>`;
  const he = r.origin === "local" ? heFor(+r.id.slice(1), current?.lang || "ar") : null;
  if (he && he.x) h += `<div class="bookcomment"><div class="h">${he.src === "icadb" ? "القاعدة المركزية للمحتوى الإسلامي باللغات (icadb.com)" : "الشرح — موسوعة الأحاديث النبوية المترجمة (HadeethEnc.com)"}${he.g ? " · " + esc(he.g) : ""}</div><p dir="auto">${esc(he.x)}</p></div>`;
  return h;
}
function bindMatn(scope) {
  scope.querySelectorAll(".isnad button").forEach(b => b.onclick = () => { const p = b.nextElementSibling, o = p.hidden; p.hidden = !o; b.setAttribute("aria-expanded", String(o)); b.textContent = o ? "إخفاء النص الكامل" : "عرض النص كاملًا بسنده"; });
}
function bindLedger(res, recs, primaryId) {
  const items = res.querySelectorAll(".item"), map = new Map(recs.map(r => [r.id, r]));
  items.forEach(b => {
    if (b.dataset.id === primaryId) b.setAttribute("aria-current", "true");
    b.onclick = () => { items.forEach(x => x.removeAttribute("aria-current")); b.setAttribute("aria-current", "true"); $("#matn").innerHTML = matnHTML(map.get(b.dataset.id)); bindMatn($("#matn")); };
  });
}
const RANK = { sahihayn: 0, sunan: 1, nah: 2, jami: 3, musnad: 4, dorar: 5 };
function pickPrimary(rs) { return [...rs].sort((a, b) => (RANK[a.kind] - RANK[b.kind]) || (a.truncated - b.truncated) || ((b.comment || "").length - (a.comment || "").length) || ((a.origin === "local" ? 0 : 1) - (b.origin === "local" ? 0 : 1)))[0]; }
const scrollTo = el => el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

function renderResult() {
  const { claim, same, partial, verdict, lang, via, manual } = current; const note = manual ? "اعتمدنا الرواية التي اخترتها." : "";
  const S = same.length ? same : partial, all = [...same, ...partial];
  const rel = {}; same.forEach(r => rel[r.id] = "same"); partial.forEach(r => rel[r.id] = "partial");
  const primary = pickPrimary(S);
  let relAcc = "";
  if (verdict.tone !== "ok" && !verdict.partialOnly) {
    const a = partial.find(r => r.cls === "sahih" || r.cls === "hasan");
    if (a) relAcc = `<div class="related"><div class="h">ما ثبت في الباب</div><p>«${esc(a.matn)}»</p><small>${esc(a.book)} (${esc(a.ref)}) — ${esc(a.grades.map(x => x.who + ": " + x.g).join("، "))}</small></div>`;
  }
  const res = $("#result");
  res.innerHTML = `
  <div class="board">
    <article class="main">
      <div class="verdict">
        <div class="v-kicker">حكم المحدّثين على ما وجدناه</div>
        <h2 class="v-word v-${verdict.tone}">${esc(verdict.word)}</h2>
        <div class="v-line">${esc(verdict.line)}</div>
        <p class="v-why">${esc(verdict.why)}${note ? " " + esc(note) : ""}</p>
        ${TERM[verdict.word] ? `<details class="term"><summary>ما معنى «${esc(verdict.word)}» عند المحدّثين؟</summary><p>${TERM[verdict.word]}</p></details>` : ""}
        <div class="echo"><span>ما أُدخل:</span><q>${esc(claim)}</q></div>
      </div>
      <div class="matn" id="matn">${matnHTML(primary)}</div>${relAcc ? `<div class="matn">${relAcc}</div>` : ""}
      ${replyShell()}
    </article>
    <aside class="ledger">
      <h3>أين ورد، ومن حكم عليه</h3>
      <p>${same.length ? pl(same.length, "رواية واحدة مطابقة", "روايتان مطابقتان", "روايات مطابقة", "رواية مطابقة") : ""}${same.length && partial.length ? "، و" : ""}${partial.length ? pl(partial.length, "رواية واحدة قريبة المعنى", "روايتان قريبتا المعنى", "روايات قريبة المعنى", "رواية قريبة المعنى") : ""}. اختر رواية لعرض نصها.</p>
      ${ledger(all, rel)}
      ${current.dorarUrl ? `<a class="ext" href="${current.dorarUrl}" target="_blank" rel="noopener">تحقّق منه في الدرر السنية</a>` : ""}
    </aside>
  </div>
  <div class="method"><span><b>اللغة:</b> ${esc(LANG_NAME[lang])}</span><span><b>طريق الوصول:</b> ${esc(via)}${current.via === "الفهم الدلالي على الجهاز" ? " (تشابه " + current.conf.toFixed(2) + ")" : ""}</span>${current.aiUsed ? `<span><b>الذكاء الاصطناعي:</b> فهم المعنى على جهازك (${AIState.ms}ms)</span>` : current.aiLoading ? `<span><b>الذكاء الاصطناعي:</b> ما زال يُحمّل — <button class="linkbtn" type="button" id="rerun">أعد التحقق به</button></span>` : ""}<span><b>بحثنا في:</b> ${fmt(IX.N)} رواية${DORAR ? " + الموسوعة الحديثية" : ""}</span><span><b>الحكم:</b> منقول من المحدّثين</span></div>`;
  res.hidden = false; bindLedger(res, all, primary.id); bindMatn(res); bindReply(); scrollTo(res);
}

function renderNotFound() {
  const { claim, lang, near, suggest } = current;
  if (suggest.length) return renderSuggest();
  const res = $("#result");
  res.innerHTML = `
  <div class="board">
    <article class="main">
      <div class="verdict">
        <div class="v-kicker">نتيجة البحث</div>
        <h2 class="v-word v-none">لم أجده</h2>
        <div class="v-line">لم نجد هذا النص في ${fmt(IX.N)} رواية${DORAR ? " ولا في الموسوعة الحديثية" : ""}</div>
        <p class="v-why">هذا لا يعني أنه مكذوب ولا أنه صحيح. لا نصدر حكمًا دون مصدر.</p>
        <div class="echo"><span>ما أُدخل:</span><q>${esc(claim)}</q></div>
        <ul class="nf-list"><li>اطلب من الناشر اسم الكتاب ورقم الحديث.</li><li>اعرض النص على مختص في الحديث قبل نشره.</li><li>إلى أن يتبيّن، لا تنسبه إلى النبي ﷺ.</li></ul>
      </div>
      ${replyShell()}
    </article>
    <aside class="ledger"><h3>هل تقصد إحدى هذه؟</h3><p>روايات تشترك معه في الألفاظ ولم تبلغ حد المطابقة. اختر واحدة لنتحقق منها.</p>${near.length ? ledger(near, null, true) : `<p>لا توجد روايات قريبة.</p>`}</aside>
  </div>
  <div class="method"><span><b>اللغة:</b> ${esc(LANG_NAME[lang])}</span>${current.aiUsed ? `<span><b>الذكاء الاصطناعي:</b> فهم المعنى على جهازك (${AIState.ms}ms)</span>` : current.aiLoading ? `<span><b>الذكاء الاصطناعي:</b> ما زال يُحمّل — <button class="linkbtn" type="button" id="rerun">أعد التحقق به</button></span>` : ""}<span><b>القرار:</b> امتناع عن الحكم</span></div>`;
  res.hidden = false;
  res.querySelectorAll(".item").forEach(b => b.onclick = () => run({ claim: current.claim, lang: current.lang, anchorDoc: +b.dataset.id.slice(1) }));
  bindReply(); scrollTo(res);
}
function renderSuggest() {
  const { claim, lang, suggest } = current;
  const res = $("#result");
  const items = suggest.map((s, i) => {
    const r = s.d >= 0 ? IX.db.recs[s.d] : null;
    const src = r ? `${IX.db.books[r[0]][0]} · ${r[1]}` : "عبارة متداولة";
    const txt = (s.d >= 0 ? coreOf(s.anchor) : s.anchor).replace(/\s+/g, " ").trim();
    return `<button class="sug" type="button" data-i="${i}"><span class="sug-t">«${esc(txt.length > 140 ? txt.slice(0, 140) + "…" : txt)}»</span><span class="sug-m"><span>${esc(src)}</span><span>تشابه ${s.cos.toFixed(2)}</span></span><span class="sug-go">تحقّق من هذا ←</span></button>`;
  }).join("");
  res.innerHTML = `
  <div class="board" style="grid-template-columns:1fr">
    <article class="main">
      <div class="verdict">
        <div class="v-kicker">لم نجد مطابقة مؤكدة</div>
        <h2 class="v-word v-none">هل تقصد؟</h2>
        <div class="v-line">هذا أقرب ما فهمه الذكاء الاصطناعي من النص</div>
        <p class="v-why">لا نصدر حكمًا على اقتراح لم تؤكده. اختر ما يطابق قصدك لنتحقق منه في المصادر، وإن لم يكن بينها فالنص لم يُعثر عليه.</p>
        <div class="echo"><span>ما أُدخل:</span><q>${esc(claim)}</q></div>
        <div class="sugs">${items}</div>
      </div>
    </article>
  </div>
  <div class="method"><span><b>اللغة:</b> ${esc(LANG_NAME[lang])}</span><span><b>الذكاء الاصطناعي:</b> فهم المعنى على جهازك (${AIState.ms}ms)</span><span><b>القرار:</b> لا حكم قبل تأكيدك</span></div>`;
  res.hidden = false;
  res.querySelectorAll(".sug").forEach(b => b.onclick = () => { const s = suggest[+b.dataset.i]; run(s.d >= 0 ? { claim, lang, anchorDoc: s.d } : { claim, lang, anchorText: s.anchor }); });
  scrollTo(res);
}
function renderScope(kind, text, lang) {
  const res = $("#result");
  const dorarQ = "https://dorar.net/hadith/search?q=" + encodeURIComponent(text.replace(DIAC, "").slice(0, 80));
  const body = kind === "fatwa"
    ? `<h2 class="v-word v-none" style="font-size:clamp(48px,7vw,88px)">خارج النطاق</h2>
       <div class="v-line">هذا سؤال فتوى يتعلق بحالة بعينها</div>
       <p class="v-why">تبيَّن أداة للتحقق من نسبة الأحاديث، ولا تُصدر فتوى ولا حكمًا على واقعة شخصية. اسأل أهل العلم المؤهلين، ومن المنصات المعتمدة:</p>
       <div class="row">${FATWA_REFERRALS.map(r => `<a class="btn" href="${r.url}" target="_blank" rel="noopener">${esc(r.name)}</a>`).join("")}</div>`
    : `<h2 class="v-word v-none" style="font-size:clamp(48px,7vw,88px)">الصق النص</h2>
       <div class="v-line">تبيَّن يتحقق من حديث بعينه، ولا يقترح أحاديث لموضوع</div>
       <p class="v-why">حتى لا يُنسب إلى النبي ﷺ ما لم يقله، لا نولّد أحاديث ولا نختارها نيابة عنك. الصق نص الحديث الذي وصلك لنتحقق منه، أو ابحث في الموسوعة الحديثية مباشرة.</p>
       <div class="row"><a class="btn primary" href="${dorarQ}" target="_blank" rel="noopener">ابحث في الموسوعة الحديثية</a></div>`;
  res.innerHTML = `<div class="board" style="grid-template-columns:1fr"><article class="main"><div class="verdict"><div class="v-kicker">قبل التحقق</div>${body}<div class="echo"><span>ما أُدخل:</span><q>${esc(text)}</q></div></div></article></div>`;
  res.hidden = false; scrollTo(res);
}
document.fonts.load('24px "KFGQPC Uthmanic Script HAFS"').catch(() => {}); document.fonts.load('24px "Uthman Taha Naskh"').catch(() => {});
function renderVerse(v, text, lang) {
  const res = $("#result");
  // 1st choice: Uthmani rasm with the King Fahd Complex «Uthmanic Script HAFS» font (v0.09). That font predates
  // the Unicode open-tanween marks used by the v13 text (U+08F0–08F2), so they are shown as regular tanween.
  // Fallback: the vocalised standard script with «Uthman Taha Naskh» (pause marks dropped for display only).
  const hafs = [...document.fonts].some(f => /Uthmanic Script HAFS/.test(f.family) && f.status === "loaded");
  const shown = hafs
    ? v.text.replace(/\u08F0/g, "\u064B").replace(/\u08F1/g, "\u064C").replace(/\u08F2/g, "\u064D")
    : v.simple.replace(/[\u06D6-\u06DC\u06DE\u06E9]/g, "").replace(/\s{2,}/g, " ").trim();
  const reply = {
    ar: `جزاك الله خيرًا. هذا ليس حديثًا، بل آية من القرآن الكريم: ﴿${v.simple}﴾ [${v.sura}: ${v.a}].`,
    en: `Jazak Allahu khayran. This is not a hadith; it is a verse of the Qur'an (Surah ${v.s}, verse ${v.a}). Saheeh International: "${v.en}"`,
    fr: `Qu'Allah vous récompense. Ce n'est pas un hadith : c'est un verset du Coran (sourate ${v.s}, verset ${v.a}).`,
    id: `Jazakumullahu khairan. Ini bukan hadits, melainkan ayat Al-Qur'an (surah ${v.s}, ayat ${v.a}).`,
    ur: `جزاکم اللہ خیراً۔ یہ حدیث نہیں بلکہ قرآن کریم کی آیت ہے (سورہ ${v.s}، آیت ${v.a})۔`,
    sw: `Jazakumullahu khairan. Hii si hadithi; ni aya ya Qur'ani (sura ${v.s}, aya ${v.a}).`,
    zh: `愿安拉回赐您。这不是圣训，而是《古兰经》经文（第${v.s}章第${v.a}节）。`,
  }[lang] || "";
  res.innerHTML = `
  <div class="board" style="grid-template-columns:1fr">
    <article class="main">
      <div class="verdict">
        <div class="v-kicker">هذا النص ليس حديثًا</div>
        <h2 class="v-word v-ok">آية قرآنية</h2>
        <div class="v-line">سورة ${esc(v.sura)} — الآية ${v.a}</div>
        <p class="v-why">لا يُنسب كلام الله إلى النبي ﷺ على أنه حديث. نص الآية من مجمع الملك فهد لطباعة المصحف الشريف (رواية حفص)، بالرسم العثماني.</p>
        <div class="echo"><span>ما أُدخل:</span><q>${esc(text)}</q></div>
      </div>
      <div class="matn"><div class="matn-head"><span>نص الآية</span><b>${esc(v.sura)} · ${v.a}</b></div>
        <blockquote class="ayah${hafs ? " uthmani" : ""}">﴿${esc(shown)}﴾</blockquote>
        ${lang === "en" ? `<div class="bookcomment" dir="ltr" style="text-align:left"><div class="h">Saheeh International</div><p>${esc(v.en)}</p></div>` : ""}
      </div>
      ${reply ? `<div class="reply"><div class="reply-top"><h3>ردّ جاهز للإرسال</h3></div><div class="replybox ${["ar", "ur"].includes(lang) ? "" : "ltr"}" id="replybox">${esc(reply)}</div><div class="row"><button class="btn primary" type="button" id="copy">نسخ الرد</button><span class="flash" id="flash" hidden>نُسخ</span></div></div>` : ""}
    </article>
  </div>`;
  res.hidden = false;
  const c = $("#copy"); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText($("#replybox").innerText); $("#flash").hidden = false; setTimeout(() => $("#flash").hidden = true, 1500); } catch { } };
  scrollTo(res);
}
function showError(msg) {
  const res = $("#result");
  res.innerHTML = `<div class="main"><div class="verdict"><div class="v-kicker">توقف التحقق</div><div class="v-line">${esc(msg)}</div><div class="row"><button class="btn" type="button" id="retry">إعادة المحاولة</button></div></div></div>`;
  res.hidden = false; $("#retry").onclick = () => run();
}


/* ---------------- reply (templates, no model) ---------------- */
function replyShell() {
  const l = current.lang;
  return `<div class="reply"><div class="reply-top"><h3>ردّ جاهز للإرسال</h3>
  ${l !== "ar" ? `<div class="seg" role="group" aria-label="لغة الرد"><button type="button" data-l="${l}" aria-pressed="true">${esc(LANG_NAME[l])}</button><button type="button" data-l="ar" aria-pressed="false">العربية</button></div>` : ""}
  </div><div class="replybox" id="replybox"></div>
  <div class="row"><button class="btn primary" type="button" id="copy">نسخ الرد</button><button class="btn" type="button" id="share">نسخ رابط النتيجة</button>${CONTACT_EMAIL ? `<a class="btn" id="report" href="#">أبلغ عن خطأ</a>` : ""}<span class="flash" id="flash" hidden>نُسخ</span></div>
  <div class="fine" style="margin-top:10px">الرد مبني بقوالب ثابتة من البيانات المعروضة أعلاه، والترجمات المقتبسة من ترجمات معتمدة للكتب.</div></div>`;
}
function writeReply(l) {
  const box = $("#replybox"); if (!box) return;
  box.classList.toggle("ltr", !["ar", "ur"].includes(l));
  const pack = TR[l]?.arr;
  const tr = r => {
    if (r.origin !== "local" || r.kind === "nah") return "";
    const d = +r.id.slice(1); const he = HE[l]?.items.find(x => x.d === d);
    return he?.t || ""; // only approved translations (HadeethEnc) are quoted; others are for search only
  };
  box.textContent = buildReply({ lang: l, verdict: current.verdict, same: current.same, partial: current.partial, total: IX.N, tr });
}
function bindReply() {
  const rr = $("#rerun"); if (rr) rr.onclick = () => run({ claim: current.claim });
  const sh = $("#share"); if (sh) sh.onclick = async () => { const u = new URL(location.href); u.search = "?q=" + encodeURIComponent(current.claim); try { if (navigator.share) await navigator.share({ title: "تبيَّن", url: u.href }); else { await navigator.clipboard.writeText(u.href); $("#flash").textContent = "نُسخ الرابط"; $("#flash").hidden = false; setTimeout(() => { $("#flash").hidden = true; $("#flash").textContent = "نُسخ"; }, 1500); } } catch { } };
  const rp = $("#report"); if (rp) rp.href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent("تبيَّن — بلاغ عن نتيجة") + "&body=" + encodeURIComponent(`النص: ${current.claim}\nالحكم المعروض: ${current.verdict ? current.verdict.word : "لم أجده"}\nالمصادر: ${[...current.same, ...current.partial].slice(0, 5).map(r => r.book + " " + r.ref).join("، ")}\n\nملاحظتي:\n`);
  writeReply(current.lang);
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { document.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true"); writeReply(b.dataset.l); });
  $("#copy").onclick = async () => { try { await navigator.clipboard.writeText($("#replybox").innerText); $("#flash").hidden = false; setTimeout(() => $("#flash").hidden = true, 1500); } catch { } };
}

/* ---------------- events ---------------- */
const q = $("#q");
q.addEventListener("input", () => { q.style.height = "auto"; q.style.height = Math.min(q.scrollHeight, 220) + "px"; });
q.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!$("#go").disabled) run(); } });
$("#go").onclick = () => run();
$("#tries").addEventListener("click", e => { const b = e.target.closest(".try"); if (!b || $("#go").disabled) return; q.value = b.textContent; run(); });

onAIState(s => {
  const el = $("#aiChip"); if (!el) return;
  const narrow = matchMedia("(max-width: 560px)").matches;
  const T = { off: narrow ? "فعّل الذكاء الاصطناعي (≈120MB)" : "فعّل الذكاء الاصطناعي على جهازك (≈120MB مرة واحدة)", loading: `الذكاء الاصطناعي: يُحمَّل على جهازك ${s.progress}%`, ready: "الذكاء الاصطناعي: يعمل على جهازك", unavailable: "الذكاء الاصطناعي: غير مفعّل في هذه النسخة", error: "الذكاء الاصطناعي: تعذّر التحميل — البحث يعمل بدونه" };
  el.hidden = s.status === "unavailable";
  el.textContent = T[s.status] || ""; el.dataset.s = s.status; el.title = s.error || "";
  el.disabled = s.status !== "off" && s.status !== "error";
});
$("#aiChip").onclick = () => startAI();
const PRINCIPAL_SHORT = ["البخاري", "مسلم", "أحمد", "مالك", "ابن تيمية"];
$("#scholarNames").innerHTML = PRINCIPAL_IMAMS.map(n => `<span class="p">${esc(n)}</span>`).join("")
  + CONTEMPORARY_SCHOLARS.map(s => `<span class="c" title="${esc(s.note || "")}">${esc(s.name)}</span>`).join("")
  + CLASSICAL_IMAMS.filter(n => !PRINCIPAL_SHORT.includes(n)).slice(0, 12).map(n => `<span>${esc(n)}</span>`).join("") + `<span>وغيرهم من أئمة الحديث</span>`;
loadDB(); checkDorar();
if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
