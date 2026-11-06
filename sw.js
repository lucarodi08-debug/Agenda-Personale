/* Service worker: l'app funziona anche senza rete. La versione cambia a ogni build, così gli aggiornamenti arrivano da soli. */
const VERSION = '96bdc445c8';
const CACHE = 'agenda-' + VERSION;
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('agenda-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Google, pdf.js ecc. passano direttamente dalla rete
  const fresh = req.mode === 'navigate' || /\/(config\.js|index\.html|manifest\.webmanifest)$/.test(url.pathname);
  if (fresh) { // prima la rete (versione aggiornata), poi la copia salvata se sei offline
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
      return r;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('index.html'); }); }));
  } else {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
        return r;
      });
    }));
  }
});
