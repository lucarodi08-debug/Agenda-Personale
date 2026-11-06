/* Service worker: l'app funziona anche senza rete. La versione cambia a ogni build, così gli aggiornamenti arrivano da soli. */
const VERSION = '4da5c79e8c';
const CACHE = 'agenda-' + VERSION;
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'privacy.html', 'terms.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

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

/* ---------- Notifiche ---------- */
function openDb() { return new Promise(function (res, rej) { var r = indexedDB.open('agenda-sw', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
function idbGet(db) { return new Promise(function (res) { var q = db.transaction('kv').objectStore('kv').get('state'); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); }
function idbPut(db, v) { return new Promise(function (res) { var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, 'state'); tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); }; }); }
const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
async function checkDue() {
  const db = await openDb(), st = await idbGet(db);
  if (!st || !st.on) return;
  const now = Date.now(); let changed = false; st.notified = st.notified || {};
  for (const i of st.items || []) {
    const p = (i.time || '08:00').split(':'), d = i.date.split('-');
    const f = new Date(+d[0], +d[1] - 1, +d[2], +p[0], +p[1]).getTime() - (st.leadMin || 0) * 60000, key = i.id + '@' + f;
    if (f <= now && now - f < 3 * 3600e3 && !st.notified[key]) {
      st.notified[key] = now; changed = true;
      const lab = i.kind === 'impegno' ? 'Impegno' : i.kind === 'scadenza' ? 'Scadenza' : 'Promemoria';
      await self.registration.showNotification(lab + ': ' + i.title, { body: (i.time ? 'Ore ' + i.time : 'Tutto il giorno') + ' · ' + (+d[2]) + ' ' + MESI[+d[1] - 1] + (i.location ? ' · ' + i.location : ''),
        tag: 'agenda-' + i.id, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', lang: 'it', data: { id: i.id, date: i.date } });
    }
  }
  if (changed) await idbPut(db, st);
}
self.addEventListener('periodicsync', function (e) { if (e.tag === 'agenda-check') e.waitUntil(checkDue()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
