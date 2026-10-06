// Ready-to-send replies built from templates. Every fact comes from the records;
// nothing is generated. Languages: ar, en, fr, id, ur.

const BOOK_LAT = {
  "صحيح البخاري": "Sahih al-Bukhari", "صحيح مسلم": "Sahih Muslim", "سنن أبي داود": "Sunan Abi Dawud", "جامع الترمذي": "Jami' at-Tirmidhi",
  "سنن النسائي": "Sunan an-Nasa'i", "سنن ابن ماجه": "Sunan Ibn Majah", "موطأ مالك": "Muwatta Malik",
  "الأباطيل والمناكير والصحاح والمشاهير": "al-Abatil wa'l-Manakir (al-Jawraqani)",
  "مائة حديث ضعيف وموضوع منتشرة بين الخطباء والوعاظ": "100 Weak and Fabricated Hadiths (Ihsan al-'Utaybi)",
  "اللآلئ المصنوعة في الأحاديث الموضوعة (ج1)": "al-La'ali' al-Masnu'a (as-Suyuti)", "اللآلئ المصنوعة في الأحاديث الموضوعة (ج2)": "al-La'ali' al-Masnu'a (as-Suyuti)",
  "الأحاديث الضعيفة في رياض الصالحين": "Weak Hadiths in Riyad as-Salihin (Ihsan al-'Utaybi)",
  "الجد الحثيث في بيان ما ليس بحديث": "al-Jidd al-Hathith (al-'Amiri)", "الفوائد المجموعة في الأحاديث الموضوعة": "al-Fawa'id al-Majmu'a (ash-Shawkani)",
  "مسند الإمام أحمد": "Musnad Ahmad", "سنن الدارمي": "Sunan ad-Darimi", "رياض الصالحين": "Riyad as-Salihin", "بلوغ المرام": "Bulugh al-Maram",
  "مشكاة المصابيح": "Mishkat al-Masabih", "الأدب المفرد": "al-Adab al-Mufrad", "الشمائل المحمدية": "ash-Shama'il al-Muhammadiyya", "الأربعون النووية": "an-Nawawi's Forty",
  "الأربعون القدسية": "Forty Hadith Qudsi", "أربعون ولي الله الدهلوي": "Shah Waliullah's Forty",
};
const WHO_LAT = { "الألباني": "al-Albani", "زبير علي زئي": "Zubair Ali Zai", "شعيب الأرناؤوط": "Shu'ayb al-Arna'ut", "عبد الفتاح أبو غدة": "Abu Ghuddah",
  "محمد محيي الدين عبد الحميد": "Muhyi ad-Din Abd al-Hamid", "محمد فؤاد عبد الباقي": "Fu'ad Abd al-Baqi", "أحمد شاكر": "Ahmad Shakir", "بشار عواد معروف": "Bashar Awwad Ma'ruf",
  "سليم الهلالي": "Salim al-Hilali", "الإمام البخاري": "al-Bukhari", "الإمام مسلم": "Muslim", "الشوكاني": "ash-Shawkani", "السيوطي": "as-Suyuti", "الجورقاني": "al-Jawraqani", "العامري": "al-'Amiri", "إحسان العتيبي": "Ihsan al-'Utaybi" };

const G = {
  en: { sahih: "authentic (sahih)", hasan: "good (hasan)", daif: "weak (da'if)", vdaif: "very weak", mawdu: "fabricated (mawdu')", noasl: "baseless (not a hadith)", qawl: "not a saying of the Prophet ﷺ", unk: "unclassified" },
  fr: { sahih: "authentique (sahih)", hasan: "bon (hasan)", daif: "faible (da'if)", vdaif: "très faible", mawdu: "inventé (mawdu')", noasl: "sans fondement", qawl: "pas une parole du Prophète ﷺ", unk: "non classé" },
  id: { sahih: "sahih", hasan: "hasan", daif: "dha'if (lemah)", vdaif: "sangat lemah", mawdu: "maudhu' (palsu)", noasl: "tidak ada asalnya", qawl: "bukan sabda Nabi ﷺ", unk: "belum terklasifikasi" },
  ur: { sahih: "صحیح", hasan: "حسن", daif: "ضعیف", vdaif: "بہت ضعیف", mawdu: "موضوع (من گھڑت)", noasl: "بے اصل", qawl: "نبی ﷺ کا قول نہیں", unk: "غیر واضح" },
  sw: { sahih: "sahihi", hasan: "hasan (nzuri)", daif: "dhaifu", vdaif: "dhaifu sana", mawdu: "ya kubuni (mawdu')", noasl: "haina asili", qawl: "si maneno ya Mtume ﷺ", unk: "haijapangwa" },
  zh: { sahih: "正确（萨希哈）", hasan: "良好（哈萨尼）", daif: "弱", vdaif: "非常弱", mawdu: "伪造", noasl: "毫无根据", qawl: "不是先知ﷺ的话", unk: "未分类" },
  ar: { sahih: "صحيح", hasan: "حسن", daif: "ضعيف", vdaif: "ضعيف جدًا", mawdu: "موضوع", noasl: "لا أصل له", qawl: "ليس من كلام النبي ﷺ", unk: "غير مصنّف" },
};
const LAT = l => l === "en" || l === "fr" || l === "id" || l === "sw";
const BOOK_ZH = { "صحيح البخاري": "《布哈里圣训实录》", "صحيح مسلم": "《穆斯林圣训实录》", "سنن أبي داود": "《艾布·达乌德圣训集》", "جامع الترمذي": "《提尔密济圣训集》", "سنن النسائي": "《奈萨仪圣训集》", "سنن ابن ماجه": "《伊本·马哲圣训集》", "موطأ مالك": "《穆宛塔》" };
const WHO_ZH = { "الألباني": "阿尔巴尼", "زبير علي زئي": "祖拜尔·阿里·宰", "أحمد شاكر": "艾哈迈德·沙基尔", "سليم الهلالي": "萨利姆·希拉利", "الإمام البخاري": "布哈里", "الإمام مسلم": "穆斯林", "الشوكاني": "舒卡尼", "السيوطي": "苏尤蒂", "الجورقاني": "朱尔加尼", "العامري": "阿米里", "إحسان العتيبي": "伊赫桑·乌泰比" };
const book = (r, l) => l === "zh" ? (BOOK_ZH[r.book] || BOOK_LAT[r.book] || r.book) : LAT(l) ? (BOOK_LAT[r.book] || r.book) : r.book;
const who = (n, l) => l === "zh" ? (WHO_ZH[n] || WHO_LAT[n] || n) : LAT(l) ? (WHO_LAT[n] || n) : n;

function cite(r, l) {
  const ref = r.ref ? (l === "zh" ? `第${r.ref}号` : ` (${r.ref})`) : "";
  if (r.kind === "sahihayn") return book(r, l) + ref;
  const g = r.grades.find(x => x.who === "الألباني") || r.grades[0];
  if (r.kind === "nah" && g) return `${book(r, l)}${ref}${l === "zh" ? "：" : ": "}${l === "ar" ? g.g : (G[l][r.cls] || g.g)}`;
  const by = { en: "graded", fr: "jugé", id: "dinilai", ur: "حکم:", ar: "حكم", sw: "imehukumiwa", zh: "" }[l];
  if (!g) return book(r, l) + ref;
  if (l === "ar") return `${book(r, l)}${ref}، ${who(g.who, l)}: ${g.g}`;
  if (l === "ur") return `${book(r, l)}${ref} — ${who(g.who, l)}: ${G.ur[r.cls] || g.g}`;
  if (l === "zh") return `${book(r, l)}${ref}，${who(g.who, l)}评定为${G.zh[r.cls] || g.g}`;
  if (l === "sw") return `${book(r, l)}${ref}, ${G.sw[r.cls] || g.g} kwa mujibu wa ${who(g.who, l)}`;
  return `${book(r, l)}${ref}, ${by} ${G[l][r.cls] || g.g} ${{ en: "by", fr: "par", id: "oleh" }[l]} ${who(g.who, l)}`;
}
const RRANK = { sahihayn: 0, sunan: 1, dorar: 2, nah: 3, jami: 4, musnad: 5 };
const list = (rs, l) => {
  const seen = new Set(); const out = [];
  for (const r of [...rs].sort((a, b) => RRANK[a.kind] - RRANK[b.kind])) { const k = r.book + r.ref; if (seen.has(k)) continue; seen.add(k); out.push(cite(r, l)); if (out.length === 3) break; }
  return out.join(l === "ar" || l === "ur" ? "؛ " : l === "zh" ? "；" : "; ");
};
const quo = (s, l) => (l === "fr" ? `« ${s} »` : l === "ar" || l === "ur" ? `«${s}»` : l === "zh" ? `“${s}”` : `"${s}"`);
function meaning(r, l, tr) {
  const t = l !== "ar" && tr && tr(r);
  if (!t) { if (l === "ar" || l === "ur") return quo(r.matn.length > 160 ? r.matn.slice(0, 160) + "…" : r.matn, "ar"); return ""; }
  // the Prophet's words are usually the last quoted segment of the translation
  const segs = t.split(/["«»“”]/).map(x => x.trim()).filter(x => x.length > 15);
  let s = (segs.length > 1 ? segs[segs.length - 1] : t).replace(/^["«“\s]+/, "").replace(/["»”\s]+$/, "");
  if (l === "ur") s = s.replace(/^فرمایا[:،\s]*/, "");
  if (s.length > 200) s = s.slice(0, 200).replace(/\s+\S*$/, "") + "…";
  return quo(s, l);
}

export function buildReply({ lang, verdict, same, partial, total, tr }) {
  const l = G[lang] ? lang : "en";
  const T = TPL[l];
  if (!verdict) return T.notfound(total);
  const primary = (verdict.partialOnly ? partial : same)[0];
  const acc = (verdict.partialOnly ? partial : same).filter(r => r.cls === "sahih" || r.cls === "hasan");
  const rej = (verdict.partialOnly ? partial : same).filter(r => ["daif", "vdaif", "mawdu", "noasl", "qawl"].includes(r.cls));
  const worst = rej.map(r => r.cls).sort((a, b) => ({ daif: 1, qawl: 2, vdaif: 3, noasl: 4, mawdu: 5 }[b] - { daif: 1, qawl: 2, vdaif: 3, noasl: 4, mawdu: 5 }[a]))[0];
  const relAcc = partial.find(r => r.cls === "sahih" || r.cls === "hasan");
  if (verdict.partialOnly) return acc.length ? T.otherWording(meaning(acc[0], l, tr), list(acc, l)) : T.otherWordingRej(G[l][worst] || G[l].daif, list(rej, l));
  if (verdict.tone === "ok") return T.accepted(meaning(primary, l, tr), list(acc.length ? acc : same, l));
  if (verdict.word === "مختلف فيه") return T.disputed(acc.length, rej.length, list(same, l));
  if (verdict.tone === "none") return T.unclassified(list(same, l));
  return T.rejected(G[l][worst], list(rej, l), relAcc ? T.related(meaning(relAcc, l, tr), list([relAcc], l)) : "");
}

const TPL = {
  en: {
    accepted: (m, src) => `Yes, this is an authentic hadith.${m ? ` The Prophet ﷺ said (meaning): ${m}` : ""}\n\nSource: ${src}.`,
    rejected: (g, src, rel) => `Jazakum Allahu khayran for checking before sharing. This saying is widely attributed to the Prophet ﷺ, but hadith scholars judged it ${g}.\n\nSource: ${src}.\n\nSo it should not be shared as a hadith.${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `What is authentic on this topic: ${m} (${src}).`,
    otherWording: (m, src) => `This exact wording is not found in the hadith sources we checked, but its meaning is authentically reported in another wording: ${m}\n\nSource: ${src}.\n\nIt is better to share the authentic wording with its reference.`,
    otherWordingRej: (g, src) => `This exact wording is not found in the sources we checked. Close narrations exist, but scholars judged them ${g} (${src}). It should not be attributed to the Prophet ﷺ.`,
    disputed: (a, r, src) => `Hadith scholars differed about this narration: ${a} judged it acceptable and ${r} judged it weak (${src}). Please consult a hadith specialist before sharing it as a hadith.`,
    unclassified: src => `We found this narration (${src}), but could not classify the scholars' rulings automatically. Please check with a hadith specialist before sharing it.`,
    notfound: n => `We could not find this saying in the hadith sources we checked (${n.toLocaleString("en")} narrations from the major collections and books on fabricated hadiths). This is not a ruling that it is fabricated, but it should not be attributed to the Prophet ﷺ until a hadith specialist confirms its source.`,
  },
  fr: {
    accepted: (m, src) => `Oui, c'est un hadith authentique.${m ? ` Le Prophète ﷺ a dit (sens) : ${m}` : ""}\n\nSource : ${src}.`,
    rejected: (g, src, rel) => `Qu'Allah vous récompense d'avoir vérifié avant de partager. Cette parole est souvent attribuée au Prophète ﷺ, mais les spécialistes du hadith l'ont jugée ${g}.\n\nSource : ${src}.\n\nIl ne faut donc pas la diffuser comme un hadith.${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `Ce qui est authentique à ce sujet : ${m} (${src}).`,
    otherWording: (m, src) => `Cette formulation exacte ne se trouve pas dans les sources consultées, mais son sens est rapporté de façon authentique avec une autre formulation : ${m}\n\nSource : ${src}.\n\nMieux vaut partager la formulation authentique avec sa référence.`,
    otherWordingRej: (g, src) => `Cette formulation exacte ne se trouve pas dans les sources consultées. Des récits proches existent, mais ils ont été jugés ${g} (${src}). Il ne faut pas l'attribuer au Prophète ﷺ.`,
    disputed: (a, r, src) => `Les spécialistes du hadith ont divergé : ${a} l'ont jugé acceptable et ${r} faible (${src}). Consultez un spécialiste avant de le partager comme hadith.`,
    unclassified: src => `Nous avons trouvé ce récit (${src}), mais sans pouvoir classer automatiquement les jugements. Vérifiez auprès d'un spécialiste avant de le partager.`,
    notfound: n => `Nous n'avons pas trouvé cette parole dans les sources consultées (${n.toLocaleString("fr")} récits des grands recueils et des livres sur les hadiths inventés). Ce n'est pas un jugement d'invention, mais il ne faut pas l'attribuer au Prophète ﷺ avant qu'un spécialiste n'en confirme la source.`,
  },
  id: {
    accepted: (m, src) => `Ya, ini hadits yang sahih.${m ? ` Nabi ﷺ bersabda (maknanya): ${m}` : ""}\n\nSumber: ${src}.`,
    rejected: (g, src, rel) => `Jazakumullahu khairan sudah memeriksa sebelum menyebarkan. Ucapan ini sering disandarkan kepada Nabi ﷺ, tetapi para ulama hadits menilainya ${g}.\n\nSumber: ${src}.\n\nKarena itu jangan disebarkan sebagai hadits.${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `Yang sahih dalam masalah ini: ${m} (${src}).`,
    otherWording: (m, src) => `Lafaz persis ini tidak kami temukan dalam sumber hadits yang kami periksa, tetapi maknanya diriwayatkan secara sahih dengan lafaz lain: ${m}\n\nSumber: ${src}.\n\nLebih baik sebarkan lafaz yang sahih beserta rujukannya.`,
    otherWordingRej: (g, src) => `Lafaz persis ini tidak kami temukan. Ada riwayat yang mirip, tetapi dinilai ${g} (${src}). Jangan disandarkan kepada Nabi ﷺ.`,
    disputed: (a, r, src) => `Para ulama hadits berbeda pendapat: ${a} menilainya diterima dan ${r} menilainya lemah (${src}). Tanyakan kepada ahli hadits sebelum menyebarkannya.`,
    unclassified: src => `Riwayat ini kami temukan (${src}), tetapi penilaian ulama belum dapat diklasifikasikan otomatis. Tanyakan kepada ahli hadits.`,
    notfound: n => `Ucapan ini tidak kami temukan dalam sumber hadits yang kami periksa (${n.toLocaleString("id")} riwayat dari kitab-kitab utama dan kitab hadits palsu). Ini bukan vonis bahwa ia palsu, tetapi jangan disandarkan kepada Nabi ﷺ sampai ahli hadits memastikan sumbernya.`,
  },
  ur: {
    accepted: (m, src) => `جی ہاں، یہ صحیح حدیث ہے۔ نبی ﷺ نے فرمایا (مفہوم): ${m}\n\nحوالہ: ${src}۔`,
    rejected: (g, src, rel) => `جزاکم اللہ خیراً کہ آپ نے شیئر کرنے سے پہلے تحقیق کی۔ یہ بات نبی ﷺ کی طرف منسوب کی جاتی ہے، لیکن محدثین نے اسے ${g} قرار دیا ہے۔\n\nحوالہ: ${src}۔\n\nاس لیے اسے حدیث کے طور پر شیئر نہ کریں۔${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `اس موضوع پر صحیح روایت: ${m} (${src})۔`,
    otherWording: (m, src) => `یہ الفاظ بعینہٖ ہمیں حدیث کے مصادر میں نہیں ملے، لیکن اس کا مفہوم دوسرے الفاظ میں صحیح سند سے ثابت ہے: ${m}\n\nحوالہ: ${src}۔\n\nبہتر ہے کہ صحیح الفاظ حوالے کے ساتھ شیئر کیے جائیں۔`,
    otherWordingRej: (g, src) => `یہ الفاظ بعینہٖ نہیں ملے۔ ملتی جلتی روایات موجود ہیں لیکن محدثین نے انہیں ${g} قرار دیا ہے (${src})۔ اسے نبی ﷺ کی طرف منسوب نہ کریں۔`,
    disputed: (a, r, src) => `اس روایت کے بارے میں محدثین کا اختلاف ہے: ${a} نے اسے قابلِ قبول اور ${r} نے ضعیف کہا ہے (${src})۔ شیئر کرنے سے پہلے کسی ماہرِ حدیث سے رجوع کریں۔`,
    unclassified: src => `یہ روایت ہمیں ملی (${src})، لیکن محدثین کے احکام کی خودکار درجہ بندی نہیں ہو سکی۔ کسی ماہرِ حدیث سے رجوع کریں۔`,
    notfound: n => `یہ بات ہمیں ان مصادر میں نہیں ملی جن میں ہم نے تلاش کی (${n.toLocaleString("en")} روایات)۔ اس کا مطلب یہ نہیں کہ یہ من گھڑت ہے، لیکن جب تک کوئی ماہرِ حدیث اس کا حوالہ ثابت نہ کرے، اسے نبی ﷺ کی طرف منسوب نہ کریں۔`,
  },
  sw: {
    accepted: (m, src) => `Ndiyo, hii ni hadithi sahihi.${m ? ` Mtume ﷺ alisema (maana yake): ${m}` : ""}\n\nChanzo: ${src}.`,
    rejected: (g, src, rel) => `Jazakumullahu khairan kwa kuhakikisha kabla ya kusambaza. Kauli hii husemekana kuwa ni ya Mtume ﷺ, lakini wanazuoni wa hadithi wameihukumu kuwa ${g}.\n\nChanzo: ${src}.\n\nKwa hiyo isisambazwe kama hadithi.${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `Iliyo sahihi katika maudhui haya: ${m} (${src}).`,
    otherWording: (m, src) => `Maneno haya hasa hatukuyapata katika vyanzo tulivyokagua, lakini maana yake imepokelewa kwa usahihi kwa maneno mengine: ${m}\n\nChanzo: ${src}.\n\nNi bora kusambaza maneno sahihi pamoja na rejea yake.`,
    otherWordingRej: (g, src) => `Maneno haya hasa hatukuyapata. Kuna riwaya zinazokaribiana, lakini zimehukumiwa kuwa ${g} (${src}). Isinasibishwe kwa Mtume ﷺ.`,
    disputed: (a, r, src) => `Wanazuoni wa hadithi wametofautiana kuhusu riwaya hii: ${a} wameikubali na ${r} wameidhoofisha (${src}). Muulize mtaalamu wa hadithi kabla ya kuisambaza.`,
    unclassified: src => `Tumeipata riwaya hii (${src}), lakini hatukuweza kupanga hukumu za wanazuoni kiotomatiki. Muulize mtaalamu wa hadithi.`,
    notfound: n => `Hatukuipata kauli hii katika vyanzo vya hadithi tulivyokagua (riwaya ${n.toLocaleString("en")}). Hii si hukumu kwamba ni ya kubuni, lakini isinasibishwe kwa Mtume ﷺ mpaka mtaalamu wa hadithi athibitishe chanzo chake.`,
  },
  zh: {
    accepted: (m, src) => `是的，这是一段正确的圣训。${m ? `先知ﷺ说（大意）：${m}` : ""}\n\n出处：${src}。`,
    rejected: (g, src, rel) => `愿安拉回赐您在转发前先行核实。这句话常被归于先知ﷺ，但圣训学者判定它为${g}。\n\n出处：${src}。\n\n因此不应把它当作圣训传播。${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `此主题中正确的圣训：${m}（${src}）。`,
    otherWording: (m, src) => `我们在所查的圣训典籍中没有找到这一确切措辞，但其含义以另一种措辞正确地传述：${m}\n\n出处：${src}。\n\n最好传播正确的措辞并注明出处。`,
    otherWordingRej: (g, src) => `我们没有找到这一确切措辞。有相近的传述，但被判定为${g}（${src}）。不应将其归于先知ﷺ。`,
    disputed: (a, r, src) => `圣训学者对此传述意见不一：${a}位接受，${r}位判为弱（${src}）。传播前请咨询圣训学专家。`,
    unclassified: src => `我们找到了这段传述（${src}），但无法自动归类学者的判定。请咨询圣训学专家。`,
    notfound: n => `我们在所查的圣训来源中没有找到这句话（共${n.toLocaleString("en")}段传述）。这并不等于判定它是伪造的，但在圣训学专家确认出处之前，不应将其归于先知ﷺ。`,
  },
  ar: {
    accepted: (m, src) => `نعم، هذا حديث صحيح. قال النبي ﷺ: ${m}\n\nالمصدر: ${src}.`,
    rejected: (g, src, rel) => `جزاك الله خيرًا على التثبّت قبل النشر. هذا القول منتشر منسوبًا إلى النبي ﷺ، لكن حكم عليه أهل الحديث بأنه ${g}.\n\nالمصدر: ${src}.\n\nفلا يُنشر على أنه حديث.${rel ? "\n\n" + rel : ""}`,
    related: (m, src) => `وما صحّ في الباب: ${m} (${src}).`,
    otherWording: (m, src) => `لم نجد هذا اللفظ في مصادر الحديث التي بحثنا فيها، لكن معناه ثابت بلفظ آخر: ${m}\n\nالمصدر: ${src}.\n\nالأولى نشر اللفظ الثابت مع مصدره.`,
    otherWordingRej: (g, src) => `لم نجد هذا اللفظ. وردت روايات قريبة منه، لكن حكم عليها أهل الحديث بأنها ${g} (${src}). فلا يُنسب إلى النبي ﷺ.`,
    disputed: (a, r, src) => `اختلف المحدّثون في هذه الرواية: قبلها ${a} وضعّفها ${r} (${src}). ارجع إلى مختص في الحديث قبل نشرها.`,
    unclassified: src => `وجدنا الرواية (${src})، ولم نستطع تصنيف أحكامها آليًا. ارجع إلى مختص قبل نشرها.`,
    notfound: n => `لم نجد هذا القول في مصادر الحديث التي بحثنا فيها (${n.toLocaleString("ar-SA-u-nu-latn")} رواية من الكتب الأصول وكتب الموضوعات). هذا ليس حكمًا بأنه موضوع، لكن لا يُنسب إلى النبي ﷺ حتى يثبت مصدره عند مختص في الحديث.`,
  },
};
