// Notenshop Service Worker: App-Hülle offline verfügbar + Push-Benachrichtigungen.
// Daten (API) werden NICHT hier gecacht – das macht die App selbst (zuletzt geladener Stand, als „offline“ markiert).
// v9: Oberfläche rechnet und zeigt Noten je Schuljahr, ohne Halbjahr-Umschalter.
const CACHE = "ns-shell-v10";
const BASE = new URL("./", self.location).pathname;
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([BASE, BASE + "index.html", BASE + "site.webmanifest", BASE + "brand/notenshop-icon-192-v1.png"]).catch(() => undefined)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ns-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === "navigate" || url.pathname.endsWith("/config.js")) {
    // Netz zuerst (immer aktuell), offline der zuletzt geladene Stand
    const key = req.mode === "navigate" ? BASE + "index.html" : BASE + "config.js";
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return r; }).catch(() => caches.match(key)));
    return;
  }
  // Gebaute Dateien (Hash im Namen), Bilder: Cache zuerst, im Hintergrund nachladen
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Notenshop", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Notenshop", { body: d.body || "", tag: d.tag, icon: BASE + "brand/notenshop-icon-192-v1.png", badge: BASE + "brand/notenshop-icon-192-v1.png", data: { url: new URL(d.url || "./", self.registration.scope).href } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) { c.navigate(url).catch(() => undefined); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
