# رخص البيانات والمكوّنات الخارجية — Data & third-party licenses

رخصة MIT في `LICENSE` تغطي **الكود فقط**. البيانات والخطوط والمكوّنات أدناه لها رخصها.

| المكوّن | الملف | المصدر | الرخصة / الشرط |
|---|---|---|---|
| متون الكتب السبعة وأحكام المحققين وترجماتها | `public/data/db.json.gz`، `tr-*.json.gz` | [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) | راجعوا رخصة المستودع قبل الإطلاق العام |
| مسند الإمام أحمد | ضمن `db.json.gz` | [Open-Hadith-Data](https://github.com/mhashim6/Open-Hadith-Data) | **ODbL 1.0**: تشترط الإسناد، وإتاحة قاعدة البيانات المشتقة بالرخصة نفسها |
| الدارمي، رياض الصالحين، بلوغ المرام، المشكاة، الأدب المفرد، الشمائل، الأربعينات | ضمن `db.json.gz`، `tr-en.json.gz` | [hadith-json](https://github.com/AhmedBaset/hadith-json) (مصدره sunnah.com) | لا رخصة معلنة — يُستأذن قبل الإطلاق العام |
| الأحاديث الموضوعة والضعيفة وتعليقات مصنّفيها | ضمن `db.json.gz` | [NAH-Corpus](https://github.com/TaghreedT/NAH-Corpus)، [MAHADDAT](https://github.com/KamelGaanoun/MHDetection) | CC BY 4.0 (إسناد) |
| نص المصحف (حفص) والترجمة الإنجليزية | `quran.json.gz` | مجمع الملك فهد لطباعة المصحف الشريف عبر [quran-api](https://github.com/fawazahmed0/quran-api)؛ صحيح إنترناشيونال | بشروط المجمع: دون تحريف أو تعديل |
| خطا المصحف (حفص العثماني، عثمان طه) | `public/fonts/uthmanic-hafs.otf`، `uthman-tn*.ttf` | مجمع الملك فهد | مجاني بشروط المجمع (دون تعديل أو بيع) — غير مرفوعَين في المستودع |
| خطا 29LT Bukra و29LT Azer | `public/fonts/` | 29LT | تجاريان مرخّصان للفريق — **غير مرفوعَين في المستودع** |
| رمز ﷺ | `public/fonts/salawat.woff` | مقتطع من خط [Amiri](https://github.com/aliftype/amiri) | SIL Open Font License 1.1 |
| Transformers.js | `public/vendor/transformers.min.js` | Hugging Face | Apache-2.0 (`transformers.LICENSE`) |
| نموذج multilingual-e5-small (ONNX int8) | `public/models/` (يُنزَّل بـ `npm run fetch:model`، غير مرفوع لتجاوزه حد GitHub) | intfloat / Xenova | MIT |
| ONNX Runtime Web | `public/vendor/ort/` | Microsoft | MIT (`vendor/ort/LICENSE`) |
| الموسوعة الحديثية | عبر `/api/dorar` | الدرر السنية — dorar.net | واجهة عامة لأصحاب المواقع، مع نسبة المحتوى إليها |
| الترجمات والشروح المعتمدة | `he-*.json.gz` (بعد الاستيراد) | HadeethEnc.com / icadb.com | تُعرض دون تعديل مع ذكر المصدر |

**إشعار ODbL:** قاعدة البيانات `public/data/db.json.gz` تتضمن بيانات من Open-Hadith-Data المرخّصة بـ ODbL 1.0، وتُتاح بالرخصة نفسها.
