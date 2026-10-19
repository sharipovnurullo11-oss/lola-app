/* Присутствие оператора за рабочим местом.
   Камера ноутбука определяет только одно: есть ли в кадре лицо. Видео не пишется,
   не сохраняется и не уходит с устройства. На сервер (вебхук /presence) уходят только события:
   «вышел» (лицо пропало на 30+ секунд), «вернулся» (с длительностью), «камера выключена»,
   «учёт приостановлен». Источник этого файла вшивается в window.html скриптом build-presence.js. */
(function (root) {
  'use strict';

  var AWAY_AFTER = 30000;   // сколько лица нет в кадре, чтобы считать «вышел»
  var TICK = 2500;          // как часто смотрим в кадр
  var QUEUE_MAX = 200;      // сколько событий храним, пока нет связи
  var MAX_TRIES = 20;       // после стольких неудачных отправок событие выбрасывается

  /* ---------- чистая логика (проверяется в Node) ---------- */

  /* observe(present, now) -> событие или null.
     «Вышел» отсчитывается от последнего момента, когда человека видели,
     поэтому длительность отсутствия при возврате включает и эти 30 секунд. */
  function createTracker(opts) {
    var awayAfter = (opts && opts.awayAfter) || AWAY_AFTER;
    var st = { away: false, lastSeen: null, awaySince: null };
    return {
      state: function () { return { away: st.away, lastSeen: st.lastSeen, awaySince: st.awaySince }; },
      observe: function (present, now) {
        var ev = null;
        if (present) {
          if (st.away) {
            ev = { type: 'operator_returned', at: now, since: st.awaySince, seconds: Math.round((now - st.awaySince) / 1000) };
            st.away = false; st.awaySince = null;
          }
          st.lastSeen = now;
        } else {
          if (st.lastSeen === null) st.lastSeen = now;
          if (!st.away && now - st.lastSeen >= awayAfter) {
            st.away = true; st.awaySince = st.lastSeen;
            ev = { type: 'operator_away', at: now, since: st.awaySince };
          }
        }
        return ev;
      },
      /* После паузы (вкладка была скрыта, камера выключалась) время паузы не считается отсутствием. */
      resume: function (now) { if (!st.away) st.lastSeen = now; }
    };
  }

  /* Очередь событий: хранится в localStorage, отправляется по одному, переживает обрыв связи. */
  function createQueue(storage, key, send, max) {
    max = max || QUEUE_MAX;
    var busy = false;
    function load() { try { var v = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function save(a) { try { storage.setItem(key, JSON.stringify(a.slice(-max))); } catch (e) {} }
    function step() {
      var a = load();
      if (!a.length) { busy = false; return Promise.resolve(); }
      var ev = a[0];
      return Promise.resolve().then(function () { return send(ev); }).then(function (ok) {
        if (ok === null) { busy = false; return; }   // сервер недоступен: событие остаётся, попытки не тратятся
        var b = load().filter(function (x) { return x.id !== ev.id; });
        if (ok) { save(b); return step(); }
        ev.tries = (ev.tries || 0) + 1;
        if (ev.tries < MAX_TRIES) { b.unshift(ev); }
        save(b);
        busy = false;
      }, function () { busy = false; });
    }
    return {
      push: function (ev) { var a = load(); a.push(ev); save(a); },
      size: function () { return load().length; },
      flush: function () { if (busy) return Promise.resolve(); busy = true; return step(); }
    };
  }

  var api = { createTracker: createTracker, createQueue: createQueue, AWAY_AFTER: AWAY_AFTER, TICK: TICK };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof isStaff !== 'function') return;

  /* ---------- работа в браузере ---------- */

  var TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  var MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  var CONSENT_KEY = 'ew_cam_ok';

  var tracker = null, queue = null, video = null, stream = null, detector = null, timer = null, badge = null;
  var running = false, starting = false, paused = false, lastDetect = 0;

  function eid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function iso(ms) { return new Date(ms).toISOString(); }

  function emit(type, extra) {
    var ev = { id: eid(), sid: store('ew_sid') || '', type: type, at: iso(Date.now()) };
    if (extra) for (var k in extra) ev[k] = extra[k];
    queue.push(ev);
    queue.flush();
  }

  /* true — записано; false — сервер ответил отказом; null — сервер недоступен (повторим позже) */
  function sendEvent(ev) {
    return post('/presence', { sid: ev.sid, event: ev.type, at: ev.at, since: ev.since || null, seconds: ev.seconds || 0, reason: ev.reason || '', eid: ev.id })
      .then(function (x) {
        if (!x || !x.j || typeof x.j.ok !== 'boolean' || x.s >= 500 || x.s === 404) return null;
        return x.j.ok;
      }, function () { return null; });
  }

  function showBadge(kind, text) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'cam-badge';
      badge.setAttribute('role', 'status');
      badge.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:50;padding:6px 12px;border-radius:999px;font:13px/1.2 system-ui,sans-serif;background:#fff;color:#222;box-shadow:0 1px 6px rgba(0,0,0,.25);display:flex;gap:8px;align-items:center;max-width:calc(100vw - 20px)';
      badge.innerHTML = '<span id="cam-dot" style="width:9px;height:9px;border-radius:50%;background:#999;flex:none"></span><span id="cam-txt"></span>';
      document.body.appendChild(badge);
    }
    badge.hidden = false;
    document.getElementById('cam-dot').style.background = kind === 'ok' ? '#1a8f3c' : kind === 'away' ? '#d98a00' : kind === 'bad' ? '#d33' : '#999';
    document.getElementById('cam-txt').textContent = text;
  }
  function hideBadge() { if (badge) badge.hidden = true; }

  /* Сотрудник должен знать, что включается и что видит руководитель, и согласиться. */
  function askConsent() {
    if (lstore(CONSENT_KEY)) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var d = document.createElement('dialog');
      d.style.cssText = 'max-width:min(420px,calc(100vw - 32px));border:0;border-radius:14px;padding:20px;font:15px/1.4 system-ui,sans-serif';
      d.innerHTML = '<h3 style="margin:0 0 10px">Учёт рабочего места</h3>' +
        '<p style="margin:0 0 8px">Пока вы в окне, камера ноутбука определяет, что вы на месте. Видео не записывается и не отправляется: всё считается на вашем устройстве.</p>' +
        '<p style="margin:0 0 14px">Руководитель видит только время, когда вас не было в кадре, и если камера выключена.</p>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-n>Не сейчас</button><button type="button" data-y style="font-weight:600">Понятно, включить</button></div>';
      document.body.appendChild(d);
      function done(v) { try { d.close(); } catch (e) {} d.remove(); resolve(v); }
      d.querySelector('[data-y]').addEventListener('click', function () { lstore(CONSENT_KEY, iso(Date.now())); done(true); });
      d.querySelector('[data-n]').addEventListener('click', function () { done(false); });
      d.addEventListener('cancel', function () { done(false); });
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    });
  }

  function loadDetector() {
    return import(TASKS + '/vision_bundle.mjs').then(function (m) {
      return m.FilesetResolver.forVisionTasks(TASKS + '/wasm').then(function (fs) {
        function make(delegate) { return m.FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: delegate }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 }); }
        return make('GPU').catch(function () { return make('CPU'); });
      });
    });
  }

  function tick() {
    if (!running || !detector || !video || video.readyState < 2) return;
    var now = Date.now();
    if (document.hidden) {
      if (!paused) { paused = true; emit('tracking_paused', { reason: 'tab_hidden' }); showBadge('off', 'Учёт приостановлен: вкладка скрыта'); }
      return;
    }
    if (paused) { paused = false; tracker.resume(now); emit('tracking_resumed', { reason: 'tab_visible' }); }
    var present = false;
    try { var r = detector.detectForVideo(video, performance.now()); present = !!(r && r.detections && r.detections.length); } catch (e) { return; }
    lastDetect = now;
    var ev = tracker.observe(present, now);
    if (ev) {
      var extra = {}; if (ev.since) extra.since = iso(ev.since); if (ev.seconds) extra.seconds = ev.seconds;
      emit(ev.type, extra);
    }
    var s = tracker.state();
    if (s.away) showBadge('away', 'Вас нет в кадре');
    else showBadge('ok', 'Камера активна, учёт рабочего места включён');
  }

  function stop(reason) {
    var was = running;
    running = false; starting = false; paused = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (stream) { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); stream = null; }
    if (video) { video.srcObject = null; video.remove(); video = null; }
    if (detector && detector.close) { try { detector.close(); } catch (e) {} }
    detector = null; tracker = null;
    hideBadge();
    if (was && reason) emit('tracking_stopped', { reason: reason });
  }

  function start() {
    if (running || starting) return;
    starting = true;
    if (!queue) queue = createQueue(window.localStorage, 'ew_pres_q', sendEvent);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { starting = false; showBadge('bad', 'Камера недоступна в этом браузере'); return; }
    askConsent().then(function (ok) {
      if (!ok) { starting = false; showBadge('off', 'Учёт места выключен'); lstore('ew_cam_declined', iso(Date.now())); return; }
      return navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false }).then(function (s) {
        if (!isStaff()) { s.getTracks().forEach(function (t) { t.stop(); }); starting = false; return; }
        stream = s;
        video = document.createElement('video');
        video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = s;
        video.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(video);
        s.getVideoTracks()[0].addEventListener('ended', function () {
          if (running) { var q = running; stop(); emit('camera_off', { reason: 'track_ended' }); showBadge('bad', 'Камера выключена'); }
        });
        showBadge('off', 'Включаю камеру…');
        return video.play().then(loadDetector).then(function (d) {
          detector = d; tracker = createTracker(); running = true; starting = false; paused = false;
          emit('tracking_started', {});
          timer = setInterval(tick, TICK);
        });
      });
    }).catch(function (e) {
      starting = false;
      var denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      var nocam = e && e.name === 'NotFoundError';
      stop();
      showBadge('bad', denied ? 'Камера не разрешена. Разрешите её в браузере.' : nocam ? 'Камера не найдена' : 'Учёт места не запустился');
      emit(denied ? 'camera_denied' : nocam ? 'camera_missing' : 'detector_failed', { reason: String((e && e.name) || 'error') });
    });
  }

  /* Экран руководителя: кто и на сколько выходил (в диалоге «Команда»). */
  var STATE = { away: ['bad', 'Отошёл'], present: ['ok', 'На месте'], off: ['off', 'Камера выключена'], paused: ['off', 'Пауза'], problem: ['bad', 'Камера не работает'] };
  function dur(sec) { sec = Math.round(sec || 0); if (sec < 60) return sec + ' с'; var m = Math.floor(sec / 60); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин'; }
  function ownerBox() {
    var dlg = document.getElementById('m-staff'), list = document.getElementById('s-list');
    if (!dlg || !list) return null;
    var b = document.getElementById('s-pres');
    if (!b) { b = document.createElement('div'); b.id = 's-pres'; b.style.cssText = 'margin-top:14px'; list.parentNode.insertBefore(b, list.nextSibling); }
    return b;
  }
  function renderOwner(r) {
    var b = ownerBox(); if (!b) return;
    if (!r || !r.ok || !r.staff) { b.innerHTML = ''; return; }
    var rows = r.staff.map(function (s) {
      var st = STATE[s.state] || STATE.off;
      var cut = s.list.slice(-5).reverse().map(function (x) {
        return '<li>' + hm(x.from) + '–' + (x.to ? hm(x.to) : '…') + ' · ' + dur(x.sec) + (x.cut ? ' (смена закрыта)' : '') + '</li>';
      }).join('');
      return '<div style="border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:10px;margin-bottom:8px">'
        + '<b>' + esc(s.name || s.phone) + '</b> · <span>' + st[1] + '</span><br>'
        + '<small>Выходов: ' + s.exits + ' · вне места: ' + dur(s.awaySec) + (s.longest ? ' · самый долгий: ' + dur(s.longest) : '') + (s.problems ? ' · сбоев камеры: ' + s.problems : '') + '</small>'
        + (s.ongoing ? '<br><small>Сейчас отсутствует с ' + hm(s.ongoing.from) + ' (' + dur(s.ongoing.sec) + ')</small>' : '')
        + (cut ? '<ul style="margin:6px 0 0;padding-left:18px"><small>' + cut + '</small></ul>' : '')
        + '</div>';
    }).join('');
    b.innerHTML = '<h4 style="margin:0 0 8px">Присутствие у компьютера</h4>' + (rows || '<p><small>Данных пока нет</small></p>');
  }
  var ownerBusy = false;
  function loadOwner() {
    var dlg = document.getElementById('m-staff');
    if (ownerBusy || !dlg || !dlg.open || document.hidden) return;
    var code = ''; try { code = store('ew_cab') || ''; } catch (e) {}
    if (!code) return;
    ownerBusy = true;
    post('/presence-report', { code: code, days: typeof SDAYS === 'number' ? SDAYS : 1 }).then(function (x) {
      ownerBusy = false; renderOwner(x && x.j);
    }, function () { ownerBusy = false; });
  }
  setInterval(loadOwner, 15000);
  setTimeout(function () {
    var d = document.getElementById('m-staff');
    if (d && window.MutationObserver) new MutationObserver(function () { if (d.open) loadOwner(); }).observe(d, { attributes: true, attributeFilter: ['open'] });
  }, 0);
  root.EWPresenceOwner = { render: renderOwner, load: loadOwner };

  /* Не трогаем остальной код окна: сами следим, вошёл ли сотрудник. */
  setInterval(function () {
    var staff = false; try { staff = isStaff(); } catch (e) {}
    if (staff && !running && !starting && !lstore('ew_cam_declined')) start();
    if (!staff && (running || starting)) stop('logout');
    if (queue && queue.size()) queue.flush();
  }, 2000);

  window.addEventListener('pagehide', function () { if (running) { try { emit('tracking_stopped', { reason: 'page_closed' }); } catch (e) {} } });
  root.EWPresence = { start: start, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
