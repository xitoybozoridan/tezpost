const CACHE = "tezpost-v4";
const FILES = ["./", "index.html", "admin.html", "driver.html", "tzmap.js", "config.js", "manifest.json", "admin-manifest.json", "driver-manifest.json", "logo.jpg", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(FILES.map(f => c.add(new Request(f, {cache: "reload"}))))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Tezkor: avval saqlangandan darhol ochadi, orqada yangisini yuklab qo'yadi (keyingi ochilishda yangi versiya)
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, {ignoreSearch: true});
    const net = fetch(e.request, {cache: "no-cache"}).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (await c.match("index.html")) || Response.error();
  }));
});
