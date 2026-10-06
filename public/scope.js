// Scope & Quran guards (per «المرجعية والحزمة العلمية والبيانات»):
//  - a verse quoted as if it were a hadith → identify it as Quran, with sura:aya and the approved text
//  - personal fatwa questions (level د) → no ruling; refer to qualified bodies listed in the package
//  - «give me a hadith that proves X» → never fabricate; point to the hadith encyclopedia
import { buildIndex, bm25, toks } from "./logic.js";
import { arSim, sharesBigram, buildTrIndex, trSearch, ltoks } from "./engine.js";

export async function buildQuran(q, yieldFn) {
  const db = { books: [["القرآن", "", "quran"]], recs: q.v.map(v => [0, 0, v[3]]) };
  const ix = await buildIndex(db, () => {}, yieldFn);
  return { q, ix, en: buildTrIndex(q.v.map(v => v[4]), "en") };
}
export function findVerse(Q, text, lang) {
  if (!Q) return null;
  if (lang === "ar") {
    if (toks(text).length < 3) return null;
    for (const { d } of bm25(Q.ix, text, 5)) {
      const s = arSim(text, Q.q.v[d][3], Q.ix);
      if (s >= 0.85 && sharesBigram(text, Q.q.v[d][3])) return { d, score: s };
    }
    return null;
  }
  if (lang !== "en") return null;
  const h = trSearch(Q.en, text, 3)[0];
  const need = n => n >= 5 ? 0.65 : n === 4 ? 0.75 : 2;
  return h && h.cov >= need(h.nq) && (h.rev >= 0.25) ? { d: h.d, score: h.cov } : null;
}
export const verseRef = (Q, d) => ({ sura: Q.q.names[Q.q.v[d][0] - 1], s: Q.q.v[d][0], a: Q.q.v[d][1], text: Q.q.v[d][2], simple: Q.q.v[d][3], en: Q.q.v[d][4] });

const FATWA = [/^\s*(هل يجوز|ما حكم|ما الحكم|حكم\s|هل يحل|هل يحرم|هل يصح|يجوز لي|أنا في|انا في)/, /(حلال ام حرام|حلال أم حرام|هل .{0,30}حرام|هل .{0,30}حلال)/,
  /\b(is it (halal|haram|permissible|allowed|forbidden)|am i allowed|can i (marry|pray|fast|eat|drink)|what is the ruling|is .{0,40} (halal|haram))\b/i,
  /\b(est-il permis|est-ce (halal|haram)|ai-je le droit)\b/i];
const ASK_HADITH = [/^\s*(أعطني|اعطني|اذكر|هات|أريد|اريد|ابي)\s.{0,10}(حديث|أحاديث|احاديث)/, /\b(give me|find me|show me|i need) (a |some )?hadiths?\b/i, /\bhadiths? (about|on|that prove)\b/i];
export function scopeOf(text) {
  if (ASK_HADITH.some(re => re.test(text))) return "ask-hadith";
  if (FATWA.some(re => re.test(text))) return "fatwa";
  return null;
}
