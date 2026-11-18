/* GIM Adrogué · service worker de la app de turnos (socios + panel).
 * HTML y data.js: primero red (para ver cambios), si no hay conexión, cache.
 * Resto de archivos propios: primero cache, y se actualiza en segundo plano. */
const VERSION = "gim-turnos-v1";
const ARCHIVOS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./admin/", "./admin/index.html", "./admin/manifest.webmanifest",
  "./css/app.css", "./css/admin.css",
  "./js/api.js", "./js/api-supabase.js", "./js/ui.js", "./js/socio.js", "./js/admin.js",
  "./vendor/qrcode.min.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/admin-192.png",
  "../data.js", "../img/favicon.svg",
  "../fonts/barlow-condensed-latin-800-italic.woff2", "../fonts/barlow-condensed-latin-700-italic.woff2",
  "../fonts/barlow-condensed-latin-600-normal.woff2", "../fonts/inter-latin-400-normal.woff2", "../fonts/inter-latin-600-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return; // Supabase, WhatsApp, etc. van directo
  const primeroRed = req.mode === "navigate" || req.url.endsWith("/data.js");
  if (primeroRed) {
    e.respondWith(fetch(req).then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(req.url.includes("/admin/") ? "./admin/index.html" : "./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const red = fetch(req).then((r) => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); } return r; }).catch(() => hit);
    return hit || red;
  }));
});
