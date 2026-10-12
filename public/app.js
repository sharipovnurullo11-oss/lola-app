// Кнопка установки PWA: Android/Chrome — системное окно; iPhone — подсказка
(function () {
  var btn = document.getElementById('install'), hint = document.getElementById('ios-hint');
  if (!btn) return;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) return;
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; btn.hidden = false; });
  btn.addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred = null; btn.hidden = true; } });
  window.addEventListener('appinstalled', function () { btn.hidden = true; });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && hint) hint.hidden = false;
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
