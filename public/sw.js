// Tabayyan service worker — works offline after the first visit.
// VERSION is replaced at build time with a hash of the release.
const VERSION = "__VERSION__";
const SHELL = `tabayyan-shell-${VERSION}`, DATA = "tabayyan-data-v1";
const SHELL_FILES = ["./", "index.html", "about.html", "app.js", "logic.js", "engine.js", "replies.js", "semantic.js", "scope.js", "binindex.js", "policy.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];

const CORE_DATA = ["db.json.gz", "index-ar.bin.gz", "phrases.json", "quran.json.gz", "tr-en.json.gz", "index-en.bin.gz"];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    // core data for offline use (served from the HTTP cache when the page already downloaded it)
    try {
      const mr = await fetch("data/manifest.json", { cache: "no-cache" }); const dc = await caches.open(DATA);
      await dc.put("data/manifest.json", mr.clone()); const m = await mr.json();
      for (const f of CORE_DATA) if (m[f] && !(await dc.match("data/" + m[f]))) await dc.add("data/" + m[f]).catch(() => {});
    } catch { }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tabayyan-shell-") && k !== SHELL) await caches.delete(k);
    // drop data files no longer referenced by the current manifest
    try {
      const m = await (await fetch("data/manifest.json", { cache: "no-cache" })).json(); const keep = new Set([...Object.values(m), "manifest.json", "meta.json"]);
      const dc = await caches.open(DATA); for (const req of await dc.keys()) { const f = new URL(req.url).pathname.split("/").pop(); if (!keep.has(f) && !/^(UthmanicHafs|uthman|azer|bukra|salawat)/i.test(f)) await dc.delete(req); }
    } catch { }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // model/CDN: browser cache
  if (u.pathname.includes("/api/")) return;                                          // live services: network only
  if (/\/(models|vendor\/ort)\//.test(u.pathname)) return;                          // AI model/runtime: cached by the AI library itself
  if (u.pathname.endsWith("/data/manifest.json") || u.pathname.endsWith("/emb/meta.json")) { // fresh, but usable offline
    e.respondWith(caches.open(DATA).then(c => fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => c.match(e.request, { ignoreSearch: true }).then(r => r || Response.json({})))));
    return;
  }
  if (/\/(data|fonts|icons)\//.test(u.pathname)) {                                   // hashed/immutable: cache-first
    e.respondWith(caches.open(DATA).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // app shell: stale-while-revalidate
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit || c.match("index.html"));
    return hit || net;
  }));
});
