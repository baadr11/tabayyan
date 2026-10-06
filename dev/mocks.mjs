// Offline test double for the Dorar API. Test data only — never shipped.
const realFetch = globalThis.fetch;
const entry = (n, text, rawi, who, src, ref, grade) => `<div class="hadith" style="text-align:justify;">${n} -  ${text}  .</div>\n<div class="hadith-info">\n<span class="info-subtitle">الراوي:</span> ${rawi}</span>\n<span class="info-subtitle">المحدث:</span> ${who}\n<span class="info-subtitle">المصدر:</span>  ${src}\n<span class="info-subtitle">الصفحة أو الرقم:</span>  ${ref}\n<span class="info-subtitle">خلاصة حكم المحدث:</span>  <span >${grade}</span>\n</div>\n--------------\n`;
const DORAR = {
  "الصين": [entry(1, "[MOCK] اطلبوا العلمَ ولو بالصِّينِ", "أنس بن مالك", "محدث تجريبي أ", "مصدر تجريبي", "1/1", "موضوع"), entry(2, "[MOCK] اطلبوا العلمَ ولو بالصِّينِ ، فإنَّ طلبَ العلمِ فريضةٌ ...", "أنس بن مالك", "محدث تجريبي ب", "مصدر تجريبي آخر", "2/2", "باطل لا أصل له")],
  "الاعمال": [entry(1, "[MOCK] إنَّما الأعمالُ بالنِّيَّاتِ", "عمر بن الخطاب", "البخاري", "صحيح البخاري", "1", "[صحيح]"), entry(2, "[MOCK] إنَّما الأعمالُ بالنِّيَّةِ ...", "عمر بن الخطاب", "محدث تجريبي", "مصدر تجريبي", "3", "إسناده ضعيف")],
};
export function installMocks() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.startsWith("https://dorar.net/")) {
      const q = decodeURIComponent(u.split("skey=")[1] || "").replace(/[\u064B-\u0652]/g, "").replace(/[أإآ]/g, "ا");
      const key = Object.keys(DORAR).find(k => q.includes(k));
      return new Response(JSON.stringify({ ahadith: { result: key ? DORAR[key].join("<br/>") : "" } }), { headers: { "content-type": "application/json" } });
    }
    return realFetch(url, opts);
  };
}
