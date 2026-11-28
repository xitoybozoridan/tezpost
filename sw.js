const CACHE = "tezpost-v14";
const FILES = ["./", "index.html", "app.html", "admin.html", "driver.html", "punkt.html", "tzmap.js", "config.js", "manifest.json", "admin-manifest.json", "driver-manifest.json", "punkt-manifest.json", "logo.jpg", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(FILES.map(f => c.add(new Request(f, {cache: "reload"}))))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Sahifalar (html/js/json) avval internetdan yangisini oladi (sekin yoki oflayn bo'lsa saqlangan nusxa ochiladi);
// rasmlar saqlangandan darhol ochiladi. Shuning uchun yangi html yuklanganda sw.js'ni qayta yuklash shart emas.
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const page = e.request.mode === "navigate" || /(\.html|\.js|\.json|\/)$/.test(u.pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    if (page) {
      try {
        const res = await Promise.race([fetch(e.request, {cache: "no-cache"}), new Promise((_, rj) => setTimeout(() => rj(new Error("sekin")), 4000))]);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      } catch (err) {
        return (await c.match(e.request, {ignoreSearch: true})) || (await c.match("app.html")) || Response.error();
      }
    }
    const hit = await c.match(e.request, {ignoreSearch: true});
    const net = fetch(e.request, {cache: "no-cache"}).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (await c.match("app.html")) || Response.error();
  }));
});
