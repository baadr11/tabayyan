import fs from "node:fs"; import zlib from "node:zlib"; import assert from "node:assert";
import { buildIndex, fromLocal, decide } from "../public/logic.js";
import { detectLang, buildTrIndex, localMatch } from "../public/engine.js";
const db = JSON.parse(zlib.gunzipSync(fs.readFileSync("public/data/db.json.gz")));
const phrases = JSON.parse(fs.readFileSync("public/data/phrases.json"));
const ix = await buildIndex(db);
const tr = {}; for (const l of ["en", "fr", "ur", "id"]) tr[l] = buildTrIndex(JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/data/tr-${l}.json.gz`))), l);
const cases = [
  ["The Prophet said: seek knowledge even if you have to go to China", "موضوع"],
  ["Paradise lies under the feet of mothers", "بلفظ آخر"],
  ["Actions are judged by intentions", "صحيح"],
  ["Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne", "صحيح"],
  ["صفائی نصف ایمان ہے", "صحيح"],
  ["Cleanliness is next to godliness", null],
  ["حب الوطن من الإيمان", "لا أصل له"],
  ["The strong man is not the one who wrestles, but the one who controls himself when angry", "صحيح"],
  ["Whoever believes in Allah and the Last Day should visit his neighbour", null],
  ["A Muslim is the one from whose tongue and hand the Muslims are safe", "صحيح"],
  ["Kebersihan sebagian dari iman", "صحيح"],
  ["The best of you are those who are best to their wives", null],
  ["Difference of opinion in my ummah is a mercy", null],
];
let pass = 0;
for (const [q, want] of cases) {
  const lang = detectLang(q);
  const m = localMatch(ix, { text: q, lang, phrases, tix: tr[lang] });
  const v = decide(m.same.map(d => fromLocal(db, d)), m.partial.map(d => fromLocal(db, d)));
  const got = v ? v.word : null;
  const ok = want === undefined || want === got || (want === null);
  console.log((want === null ? "  ? " : ok ? " OK " : "FAIL"), lang, "|", q.slice(0, 50), "→", got, "| via:", m.via, "conf", m.conf.toFixed(2), "same", m.same.length, "part", m.partial.length, m.same.slice(0,3).map(d=>db.books[db.recs[d][0]][0]+" "+db.recs[d][1]).join(", "));
  if (ok) pass++;
}
console.log(pass + "/" + cases.length);
