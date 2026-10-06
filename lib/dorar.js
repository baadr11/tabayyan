// Parser + client for the Dorar.net public hadith API (dorar_api.json).
// The API returns { ahadith: { result: "<html>" } } where each hit is:
//   <div class="hadith">N - text</div>
//   <div class="hadith-info"> <span class="info-subtitle">الراوي:</span> ... </div>
// Hits are separated by "--------------".

export const DORAR_ENDPOINT = "https://dorar.net/dorar_api.json";

const FIELDS = {
  "الراوي": "rawi",
  "المحدث": "muhaddith",
  "المصدر": "source",
  "الصفحة أو الرقم": "ref",
  "خلاصة حكم المحدث": "grade",
};

function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDorarHtml(html) {
  const out = [];
  if (!html) return out;
  const blocks = String(html).split(/-{6,}/);
  for (const block of blocks) {
    const hm = block.match(/<div class="hadith"[^>]*>([\s\S]*?)<\/div>/);
    if (!hm) continue;
    const raw = stripTags(hm[1]).replace(/^\d+\s*-\s*/, "");
    const truncated = /\.\.\.[\s.]*$/.test(raw);
    const text = raw.replace(/[\s.]+$/, "").trim();
    const im = block.match(/<div class="hadith-info">([\s\S]*?)<\/div>/);
    const info = {};
    if (im) {
      const re = /<span class="info-subtitle">\s*([^<:]+?)\s*:\s*<\/span>([\s\S]*?)(?=<span class="info-subtitle">|$)/g;
      let m;
      while ((m = re.exec(im[1]))) {
        const key = FIELDS[m[1].trim()];
        if (key) info[key] = stripTags(m[2]).replace(/^-$/, "");
      }
    }
    if (text) out.push({ text, truncated, ...info });
  }
  return out;
}

export function parseDorarResponse(json) {
  const html = json && json.ahadith && json.ahadith.result;
  return parseDorarHtml(html);
}

export async function searchDorar(query, fetchImpl = fetch) {
  const url = DORAR_ENDPOINT + "?skey=" + encodeURIComponent(query);
  const res = await fetchImpl(url, { headers: { "Accept": "application/json", "User-Agent": "Tabayyan/0.1 (+hadith verification prototype)" } });
  if (!res.ok) throw new Error("dorar_http_" + res.status);
  const json = await res.json();
  return { url, results: parseDorarResponse(json) };
}
