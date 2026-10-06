// Tabayyan core logic — pure functions, no DOM. Used by app.js and by tests.
import { ALLOWED_GRADERS, isExcludedScholar } from "./policy.js";
import { hasDoc } from "./binindex.js";

/* ---------- Arabic normalization & light stemming ---------- */
export const DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200c-\u200f]/g;
export function norm(s) {
  return String(s || "").replace(DIAC, "")
    .replace(/صلى الله عليه وسلم|صلي الله عليه وسلم|ﷺ|عليه السلام|رضي الله عنهما|رضي الله عنها|رضي الله عنه/g, " ")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u064A0-9a-zA-Z]+/g, " ");
}
const STOP = new Set("حدثنا اخبرنا انبانا حدثني اخبرني ثنا عن قال قالت بن ابن ابي ابو من في علي الي ان او ثم هو هي كان قد لم لن اذا اذ ذلك هذا هذه التي الذي فقال يقول سمعت وهو ما لا الا يا عليه".split(" "));
const PRE = ["وال", "بال", "كال", "فال", "لل", "ال"];
const SUF = ["هما", "كما", "هم", "هن", "كم", "نا", "ها", "ات", "ون", "ين", "ان", "ه", "ي"];
export function stem(t) {
  if (t.length > 3 && (t[0] === "و" || t[0] === "ف") && !STOP.has(t)) t = t.slice(1);
  for (const p of PRE) if (t.startsWith(p) && t.length - p.length >= 2) { t = t.slice(p.length); break; }
  for (const s of SUF) if (t.endsWith(s) && t.length - s.length >= 3) { t = t.slice(0, -s.length); break; }
  return t;
}
export function toks(s) {
  const out = [];
  for (const w of norm(s).split(" ")) { if (w.length < 2 || STOP.has(w)) continue; out.push(stem(w)); }
  return out;
}
export const isArabic = s => /[\u0600-\u06FF]/.test(s) && !/[ٹڈڑںےۓگکھ]/.test(s);
export const tidy = s => String(s || "").replace(/\s+([،,.:؛)])/g, "$1").replace(/([(])\s+/g, "$1").replace(/\s{2,}/g, " ").trim();

/* ---------- local index (BM25) ---------- */
export async function buildIndex(db, onProgress = () => {}, yieldFn = () => Promise.resolve()) {
  const N = db.recs.length, INDEX = new Map(), DOCLEN = new Uint16Array(N); let total = 0;
  const CH = 2500;
  for (let s = 0; s < N; s += CH) {
    const e = Math.min(N, s + CH);
    for (let d = s; d < e; d++) {
      const tk = toks(db.recs[d][2]);
      DOCLEN[d] = Math.min(65535, tk.length); total += tk.length;
      const tf = new Map(); for (const t of tk) tf.set(t, (tf.get(t) || 0) + 1);
      for (const [t, c] of tf) { let p = INDEX.get(t); if (!p) { p = []; INDEX.set(t, p); } p.push(d, c); }
    }
    onProgress(e / N); await yieldFn();
  }
  return { db, N, INDEX, DOCLEN, AVGDL: total / N };
}
export function bm25(ix, query, k = 12) {
  const qt = [...new Set(toks(query))]; if (!qt.length) return [];
  const sc = new Map(), K1 = 1.2, B = 0.55;
  for (const t of qt) {
    const p = ix.INDEX.get(t); if (!p) continue;
    const df = p.length / 2; if (df > ix.N * 0.25) continue;
    const idf = Math.log(1 + (ix.N - df + .5) / (df + .5));
    for (let i = 0; i < p.length; i += 2) {
      const d = p[i], f = p[i + 1];
      sc.set(d, (sc.get(d) || 0) + idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * ix.DOCLEN[d] / ix.AVGDL)));
    }
  }
  const arr = [...sc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 120);
  // coverage of the query terms, looked up in the postings (no re-tokenising of long narrations)
  const posts = qt.map(t => ix.INDEX.get(t));
  for (const e of arr) {
    let hit = 0; for (const p of posts) if (p && hasDoc(p, e[0])) hit++;
    e[1] *= 0.55 + 0.9 * (hit / qt.length);
  }
  return arr.sort((a, b) => b[1] - a[1]).slice(0, k).map(([d, s]) => ({ d, s }));
}

/* ---------- grade classification ---------- */
const GRADERS = { A: "الألباني", Z: "زبير علي زئي", S: "شعيب الأرناؤوط", G: "عبد الفتاح أبو غدة", M: "محمد محيي الدين عبد الحميد", F: "محمد فؤاد عبد الباقي", K: "أحمد شاكر", B: "بشار عواد معروف", H: "سليم الهلالي", "?": "محقق" };
const GTR = [
  [/Sahih\s*-\s*Agreed Upon|Sahih\s*-\s*Bukhari And Muslim/gi, "صحيح، متفق عليه"], [/Isnaad Sahih Agreed Upon/gi, "إسناده صحيح، متفق عليه"],
  [/Very Daif Isnaad/gi, "إسناده ضعيف جدًا"], [/Very Daif/gi, "ضعيف جدًا"], [/Hasan Sahih Isnaad/gi, "إسناده حسن صحيح"], [/Hasan Sahih/gi, "حسن صحيح"],
  [/Sahih Lighairihi/gi, "صحيح لغيره"], [/Hasan Lighairihi/gi, "حسن لغيره"], [/Isnaad Sahih|Sahih Isnaad/gi, "إسناده صحيح"],
  [/Isnaad Hasan|Hasan Isnaad/gi, "إسناده حسن"], [/Daif Isnaad|Sanad Daif/gi, "إسناده ضعيف"], [/Sahih Mutawatir/gi, "صحيح متواتر"],
  [/Sahih Bukhari/gi, "صحيح البخاري"], [/Sahih Muslim/gi, "صحيح مسلم"], [/Mauquf|Muquf/gi, "موقوف"], [/Maqtu/gi, "مقطوع"], [/Mursal/gi, "مرسل"],
  [/Mawdu|Maudu/gi, "موضوع"], [/Batil/gi, "باطل"], [/Munkar/gi, "منكر"], [/Shadh/gi, "شاذ"], [/Sahih Hadith/gi, "صحيح"], [/Sahih Matn/gi, "المتن صحيح"],
  [/Sahih/gi, "صحيح"], [/Hasan/gi, "حسن"], [/Daif/gi, "ضعيف"], [/Isnaad/gi, "الإسناد"], [/Agreed Upon/gi, "متفق عليه"], [/\bAnd\b/gi, "و"],
];
export const trGrade = s => { let t = s; for (const [r, v] of GTR) t = t.replace(r, v); return t.trim(); };

export function clsOf(s) {
  const t = String(s || "").toLowerCase().replace(DIAC, "");
  if (/لا يصح|ليس بصحيح|لم يصح|لا يثبت|ولا يثبت|ليس بثابت|ليس بالقوي|غير محفوظ/.test(t)) return "daif";
  if (/mawdu|maudu|batil|موضوع|باطل|مكذوب|مختلق|مفترى|مفتري|كذب|كذاب|وضعه|من وضع/.test(t)) return "mawdu";
  if (/لم اجد|لم أجد|لا اعرف|لا أعرف|بلا سند|لا أصل|لا اصل|ليس له أصل|ليس بحديث/.test(t)) return "noasl";
  if (/very daif|munkar|shadh|منكر|واه|تالف|مظلم|ظلمات|جدا|جدًا|ساقط|شاذ|متروك|ليس بشيء/.test(t)) return "vdaif";
  if (/daif|ضعيف|ضعف|مرسل|معضل|منقطع|انقطاع|مجهول|خطأ|مدلس|علتان|علة|اضطراب|مضطرب/.test(t)) return "daif";
  if (/كلام|قول/.test(t) && !/صحيح|حسن/.test(t)) return "qawl";
  if (/sahih|صحيح|ثابت|على شرط|اسناده جيد|إسناده جيد|جيد|قوي|اسناده قوي/.test(t)) return "sahih";
  if (/hasan|حسن|رجاله ثقات|لا بأس به/.test(t)) return "hasan";
  return "unk";
}
export const CLS_UI = { sahih: ["صحيح", "ok"], hasan: ["حسن", "ok"], daif: ["ضعيف", "warn"], vdaif: ["ضعيف جدًا", "bad"], mawdu: ["موضوع", "bad"], noasl: ["لا أصل له", "bad"], qawl: ["ليس مرفوعًا", "warn"], unk: ["غير مصنّف", "none"] };
export const ACC = c => c === "sahih" || c === "hasan";
export const REJ = c => ["daif", "vdaif", "mawdu", "noasl", "qawl"].includes(c);
const SEV = { daif: 1, qawl: 2, vdaif: 3, noasl: 4, mawdu: 5 };

/* ---------- unified record ---------- */
// {id, origin:'local'|'dorar', kind:'sahihayn'|'sunan'|'nah'|'dorar', book, author, ref, matn, full, comment, commentBy, grades:[{who,g,c}], cls, truncated, rawi}
const LKIND_OLD = b => b <= 1 ? "sahihayn" : (b <= 6 ? "sunan" : "nah");

function splitLocal(text) {
  const t = tidy(text);
  const parts = t.split('"');
  if (parts.length >= 2) {
    const segs = [];
    for (let i = 1; i < parts.length; i += 2) {
      const g = parts[i].replace(/[\u200f\u200e]/g, "").replace(/^[\s.،:]+|[\s.،:]+$/g, "").trim();
      if (g.length > 1) segs.push(g);
    }
    const closed = parts.length % 2 === 1;
    if (segs.length) return { matn: segs.join(" … "), post: closed ? parts[parts.length - 1].replace(/^[\s.\u200f]+/, "").trim() : "", full: t.replace(/[\u200f\u200e]/g, "") };
  }
  return { matn: t, post: "", full: "" };
}

// compilers' own takhrij notes, e.g. «((متفق عليه))» or «رواه مسلم» at the end of Riyad / Bulugh / Mishkat entries
function compilerNote(text) {
  const t = String(text || "").replace(DIAC, "");
  const m = t.match(/\(\(([^)]{3,80})\)\)\s*\.?\s*$/) || t.match(/((?:متفق عليه|رواه|أخرجه|اخرجه)[^.()]{0,80})\.?\s*$/)
    || t.match(/["»]\s*\.?\s*((?:البخاري|مسلم|أبو داود|الترمذي|النسائي|ابن ماجه|أحمد)\s*\(\d+\)[^"»]{0,80})$/);
  return m ? m[1].trim() : "";
}
export function fromLocal(db, d) {
  const r = db.recs[d], [book, author, btype] = db.books[r[0]], kind = btype || LKIND_OLD(r[0]);
  let grades = [];
  if (kind === "sahihayn") grades = [{ who: r[0] === 0 ? "الإمام البخاري" : "الإمام مسلم", g: "صحيح (في الصحيح)", c: "sahih" }];
  else if (kind === "nah") {
    let g = r[3].slice(2), c = clsOf(g); const cm = r[4] || "";
    const m = cm.match(/^\s*(ليس بحديث|ليس له أصل|لا أصل له)/); if (m) { g = m[1]; c = "noasl"; }
    grades = [{ who: author, g, c }];
  } else if (kind === "jami") {
    const note = compilerNote(r[2]);
    if (note) {
      const both = /متفق عليه/.test(note), bk = /رواه (البخاري|مسلم)(?![^،,]*وغير)/.test(note) && !/رواه (?!البخاري|مسلم)/.test(note.replace(/رواه (البخاري|مسلم)/, ""));
      // only unambiguous Sahihayn attributions count as «صحيح»; anything else is shown, not graded
      const SAHIHAYN = /^(متفق عليه|رواه البخاري|رواه مسلم|رواه البخاري ومسلم|أخرجه البخاري|أخرجه مسلم|البخاري \(\d+\)(،?\s*و?مسلم \(\d+\))?|مسلم \(\d+\))\s*\.?$/;
      grades = [{ code: "C", who: author + " (تخريج)", g: note, c: SAHIHAYN.test(note) ? "sahih" : "unk" }];
    }
  } else if (r[3]) grades = r[3].split(";").map(x => { const i = x.indexOf(":"); const code = x.slice(0, i), raw = x.slice(i + 1); return { code, who: GRADERS[code] || "محقق", g: trGrade(raw), c: clsOf(raw) }; })
    .filter(g => ALLOWED_GRADERS.includes(g.code));

  let cls = "unk";
  if (grades.length) {
    if (kind === "sunan") { const a = grades.find(x => x.who === "الألباني"); cls = a ? a.c : majority(grades); }
    else cls = grades[0].c;
  }
  // approved graders disagree on this very narration (accept vs reject)
  const mixed = grades.some(g => ACC(g.c)) && grades.some(g => REJ(g.c));
  const sp = kind === "nah" || kind === "jami" ? { matn: tidy(r[2]).replace(/^[\s"«]+|[\s"»]+$/g, ""), post: "", full: "" } : splitLocal(r[2]);
  const comment = kind === "nah" ? tidy(r[4]) : (sp.post.length > 18 ? sp.post : "");
  return { id: "L" + d, origin: "local", kind, book, author, ref: String(r[1]), matn: sp.matn, full: sp.full, comment, commentBy: kind === "nah" ? author : "", grades, cls, mixed, truncated: false };
}

export function fromDorar(item, i) {
  const src = item.source || "", who = item.muhaddith || "";
  if (isExcludedScholar(who)) return null;
  const sahihayn = (/صحيح البخاري/.test(src) && /البخاري/.test(who)) || (/صحيح مسلم/.test(src) && /^مسلم|الإمام مسلم/.test(who));
  const c = sahihayn ? "sahih" : clsOf(item.grade);
  return {
    id: "D" + i, origin: "dorar", kind: sahihayn ? "sahihayn" : "dorar", book: src || "—", author: who, ref: item.ref || "",
    matn: tidy(item.text), full: "", comment: "", commentBy: "", rawi: item.rawi || "",
    grades: [{ who: who || "—", g: item.grade || "—", c }], cls: c, truncated: !!item.truncated,
  };
}
function majority(gs) { const cnt = {}; gs.forEach(x => cnt[x.c] = (cnt[x.c] || 0) + 1); return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; }

/* ---------- verdict ---------- */
export function decide(same, partial) {
  if (!same.length && !partial.length) return null;
  if (!same.length) {
    const acc = partial.some(r => ACC(r.cls));
    return { word: "بلفظ آخر", tone: "warn", line: acc ? "لم نجد هذا اللفظ، وثبت معناه بلفظ آخر" : "لم نجد هذا اللفظ، ووجدنا ما يقاربه بإسناد مردود",
      why: acc ? "انشر اللفظ الثابت المعروض هنا مع مصدره، لا الصيغة المتداولة." : "لا يُنسب إلى النبي ﷺ بهذا اللفظ ولا بما يقاربه.", partialOnly: true };
  }
  const inSahih = same.filter(r => r.kind === "sahihayn");
  const acc = same.filter(r => ACC(r.cls) || (r.mixed && r.grades.some(g => ACC(g.c)))), rej = same.filter(r => REJ(r.cls) || (r.mixed && r.grades.some(g => REJ(g.c))));
  if (inSahih.length) {
    const names = [...new Set(inSahih.map(r => /مسلم/.test(r.book) ? "مسلم" : "البخاري"))].join(" و");
    return { word: "صحيح", tone: "ok", line: "حديث صحيح، رواه " + names,
      why: rej.length ? "وضعّف بعض المحدّثين طرقًا أخرى له، وهذا لا يؤثر في ثبوته من طريق الصحيح." : "ثبوته في الصحيح يكفي للحكم بصحته." };
  }
  // one route accepted by every approved grader establishes the hadith; weakness of other routes doesn't undo it
  const solid = same.filter(r => r.origin === "local" && ACC(r.cls) && !r.mixed && r.grades.length >= 2 && r.grades.every(g => !REJ(g.c)));
  if (solid.length && rej.length) {
    const word = solid.some(r => r.cls === "sahih") ? "صحيح" : "حسن";
    return { word, tone: "ok", line: "حديث ثابت عن النبي ﷺ من طريق مقبول",
      why: `ثبت من طريق لم يختلف فيه المحققون المعتمدون (${solid[0].book} ${solid[0].ref})، وضُعّفت بعض طرقه الأخرى، وضعف بعض الطرق لا يؤثر في ثبوته.` };
  }
  if (acc.length && !rej.length) {
    return { word: acc.some(r => r.cls === "sahih") ? "صحيح" : "حسن", tone: "ok", line: "حديث ثابت عن النبي ﷺ",
      why: "هذا ما عليه أحكام المحدّثين في الروايات المطابقة المعروضة إلى جانب هذه البطاقة." };
  }
  if (rej.length && !acc.length) {
    const worst = rej.map(r => r.cls).sort((a, b) => SEV[b] - SEV[a])[0];
    const M = { mawdu: ["موضوع", "bad", "لا تصح نسبته إلى النبي ﷺ"], vdaif: ["ضعيف جدًا", "bad", "لا يصح عن النبي ﷺ"], daif: ["ضعيف", "warn", "في إسناده ضعف، فلا يُجزم بنسبته"], noasl: ["لا أصل له", "bad", "لم يجد له المحدّثون إسنادًا يُعتمد"], qawl: ["ليس حديثًا", "warn", "هو من كلام غير النبي ﷺ"] }[worst];
    return { word: M[0], tone: M[1], line: M[2], why: "هذا أشد ما حكم به المحدّثون على الروايات المطابقة. تفاصيل كل حكم وقائله إلى جانب هذه البطاقة." };
  }
  if (!acc.length && !rej.length) {
    return { word: "غير محسوم", tone: "none", line: "وجدنا الرواية، ولم نستطع تصنيف أحكامها آليًا", why: "اقرأ نص الأحكام كما هو في القائمة المجاورة، أو ارجع إلى مختص." };
  }
  const nAcc = same.flatMap(r => r.grades).filter(g => ACC(g.c)).length, nRej = same.flatMap(r => r.grades).filter(g => REJ(g.c)).length;
  return { word: "مختلف فيه", tone: "warn", line: `حكم بقبوله ${nAcc} وبردّه ${nRej} من المحققين المعتمدين`,
    why: "اختلف المحدّثون فيه باختلاف الطرق والألفاظ. انشر اللفظ الثابت فقط، وارجع إلى مختص للترجيح." };
}

/* ---------- facts for the reply writer ---------- */
export function factsFor(claim, same, partial, verdict, total) {
  const pack = rs => rs.slice(0, 8).map(r => ({ source: r.book, number_or_page: r.ref, arabic: r.matn.replace(DIAC, "").slice(0, 300), grades: r.grades.map(g => g.who + ": " + g.g), author_comment: r.comment ? r.comment.slice(0, 300) : undefined }));
  return { claim, verdict: verdict ? { word: verdict.word, meaning: verdict.line } : { word: "NOT FOUND", meaning: `not found in the sources checked (Dorar.net encyclopedia and ${total} local narrations); no judgment issued` }, same: pack(same), related: pack(partial) };
}
