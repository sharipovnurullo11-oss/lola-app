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

// Загрузка чека
(function () {
  var f = document.getElementById('receipt-form');
  if (!f) return;
  var msg = document.getElementById('receipt-msg'), inp = document.getElementById('receipt-file');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var file = inp.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { msg.textContent = f.dataset.err; return; }
    msg.textContent = f.dataset.uploading;
    fetch('/receipt', { method: 'POST', headers: { 'x-csrf': f.dataset.csrf }, body: file, credentials: 'same-origin' })
      .then(function (r) { if (r.ok) { msg.textContent = f.dataset.sent; setTimeout(function () { location.reload(); }, 800); } else { msg.textContent = f.dataset.err; } })
      .catch(function () { msg.textContent = f.dataset.err; });
  });
})();
