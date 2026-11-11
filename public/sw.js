// Service worker: установка, push и быстрый запуск: оболочка приложения (/window и статика) берётся из кеша телефона и обновляется в фоне. Данные кабинета (n8n и др.) не кэшируются.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== 'ew-shell-v1'; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
var CK = 'ew-shell-v1';
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== self.location.origin) return;
  if (!(u.pathname === '/window' || /^\/[\w.-]+\.(css|js|svg|png|webmanifest)$/.test(u.pathname)) || u.pathname === '/sw.js') return;
  e.respondWith(caches.open(CK).then(function (c) {
    return c.match(r).then(function (hit) {
      var net = fetch(r).then(function (res) { if (res && res.ok && res.type === 'basic') c.put(r, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ёвари Шахси', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/window' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/window';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
    for (var i = 0; i < l.length; i++) { if (l[i].url.indexOf(url) >= 0 && 'focus' in l[i]) return l[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
