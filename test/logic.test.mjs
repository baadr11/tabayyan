import assert from "node:assert";
import { clsOf, decide, fromDorar, toks } from "../public/logic.js";
const cases = { "إسناده صحيح": "sahih", "إسناده فيه انقطاع": "daif", "ما روى هذا إلا ذاك الكذاب أبو البختري": "mawdu", "حسن وللحديث طرق أخرى": "hasan",
  "لا يصح من قبل إسناده، فيه الحجاج بن أرطأة، وهو ضعيف مدلس": "daif", "هذا منكر تفرد به ربيعة": "vdaif", "موضوع": "mawdu", "باطل لا أصل له": "mawdu",
  "[صحيح]": "sahih", "إسناده ليس بالقوي": "daif", "Very Daif": "vdaif", "Hasan Sahih": "sahih", "لا أصل له": "noasl" };
for (const [k, v] of Object.entries(cases)) assert.equal(clsOf(k), v, k);
const d = (grade, extra = {}) => fromDorar({ text: "x", muhaddith: "م", source: "س", ref: "1", grade, ...extra }, 0);
assert.equal(decide([d("موضوع"), d("باطل")], []).word, "موضوع");
assert.equal(decide([d("إسناده ضعيف"), d("صحيح")], []).word, "مختلف فيه");
assert.equal(decide([fromDorar({ text: "x", muhaddith: "البخاري", source: "صحيح البخاري", ref: "1", grade: "[صحيح]" }, 0), d("إسناده ضعيف")], []).word, "صحيح");
assert.equal(decide([], [d("صحيح")]).word, "بلفظ آخر");
assert.equal(decide([], []), null);
assert.deepEqual(toks("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"), toks("انما الاعمال بالنيات"));
console.log("logic: OK");
