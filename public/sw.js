// Минимальный service worker: нужен для установки; страницы кабинета не кэшируются (личные данные)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
