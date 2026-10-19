// Витрина и склад: оператор записывает продажу, приход, списание и пересчёт; руководитель видит сверку по операторам.
(function (root) {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof post !== 'function') return;
  var DATA = null, SEL = null, DAYS = 1, REPORT = null, busy = false, PENDING = {};
  var TIP = { sale: 'Продажа', receipt: 'Приход', writeoff: 'Списание', count: 'Пересчёт' };
  function $s(id) { return document.getElementById(id); }
  function auth() { var b = {}; try { if (store('ew_sid')) b.sid = store('ew_sid'); else b.code = store('ew_cab') || ''; } catch (e) {} return b; }
  function call(body) { var b = auth(); for (var k in body) b[k] = body[k]; return post('/shop', b).then(function (x) { return (x && x.j) || { ok: false, error: 'нет связи' }; }, function () { return { ok: false, error: 'нет связи' }; }); }
  function oid() { return 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function money(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+$)/g, ' '); }
  function dayHm(v) { var d = new Date(v); if (isNaN(d)) return ''; return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hm(v); }

  function ensure() {
    if (!$s('b-shop')) {
      var btn = document.createElement('button'); btn.className = 'tb'; btn.id = 'b-shop'; btn.type = 'button'; btn.hidden = true; btn.textContent = 'Витрина';
      var m = $s('b-menu'); if (!m || !m.parentNode) return false; m.parentNode.insertBefore(btn, m);
      btn.addEventListener('click', openShop);
    }
    if (!$s('m-shop')) {
      var d = document.createElement('dialog'); d.id = 'm-shop';
      d.style.cssText = 'width:min(620px,calc(100vw - 16px))';
      d.innerHTML = '<div class="dbody" style="position:relative;max-height:calc(100dvh - 24px);overflow:auto"><button class="x" data-close type="button" aria-label="Закрыть">×</button><h2 style="padding-right:36px">Витрина и склад</h2><div id="sh-who" style="color:var(--mut,#667);margin-bottom:8px"></div><div id="sh-msg" role="status" style="min-height:20px;margin:4px 0"></div><div id="sh-list"></div><div id="sh-own"></div><h3 style="margin:14px 0 6px">Последние записи</h3><div id="sh-recent"></div></div>';
      document.body.appendChild(d);
      d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
    }
    return true;
  }
  function msg(t, bad) { var e = $s('sh-msg'); if (e) { e.textContent = t || ''; e.style.color = bad ? '#c0392b' : '#1f8a4c'; } }
  function openShop() { if (!ensure()) return; msg(''); open_dlg('m-shop'); load(); }
  function load() {
    if (busy) return; busy = true;
    call({ action: 'list' }).then(function (r) {
      busy = false;
      if (!r.ok) { msg(r.error || 'не удалось загрузить', true); return; }
      DATA = r; render(); if (r.role === 'owner') loadReport();
    });
  }
  function loadReport() { call({ action: 'report', days: DAYS }).then(function (r) { if (r.ok) { REPORT = r; renderOwner(); } }); }

  function render() {
    if (!DATA) return;
    var own = DATA.role === 'owner';
    $s('sh-who').textContent = own ? 'Вы вошли как руководитель' : ('Оператор: ' + (DATA.who || ''));
    var items = DATA.items.filter(function (i) { return i.active; });
    $s('sh-list').innerHTML = items.length ? items.map(function (i) {
      var on = SEL === i.tid;
      return '<div class="shi" data-t="' + esc(i.tid) + '" style="border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:10px;margin-bottom:8px;' + (on ? 'outline:2px solid #2a6df4' : '') + '">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;cursor:pointer" data-pick="' + esc(i.tid) + '"><b>' + esc(i.name) + '</b><span>' + money(i.price) + ' · остаток <b' + (i.stock < 0 ? ' style="color:#c0392b"' : '') + '>' + i.stock + '</b></span></div>'
        + (on ? actions(i) : '') + '</div>';
    }).join('') : '<p>Товаров пока нет.' + (own ? ' Добавьте первый ниже.' : ' Руководитель добавит их.') + '</p>';
    $s('sh-list').querySelectorAll('[data-pick]').forEach(function (e) { e.addEventListener('click', function () { SEL = SEL === e.getAttribute('data-pick') ? null : e.getAttribute('data-pick'); render(); }); });
    $s('sh-list').querySelectorAll('[data-do]').forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-do')); }); });
    $s('sh-recent').innerHTML = (DATA.recent && DATA.recent.length) ? DATA.recent.map(function (o) {
      return '<div style="padding:4px 0;border-bottom:1px solid rgba(128,128,128,.2)"><small>' + dayHm(o.at) + (own ? ' · ' + esc(o.who) : '') + '</small> ' + TIP[o.tip] + ' · ' + esc(o.name) + ' · ' + (o.tip === 'count' ? ('факт ' + o.qty + (o.diff ? ', расхождение ' + (o.diff > 0 ? '+' : '') + o.diff : '')) : o.qty) + '</div>';
    }).join('') : '<small>Записей пока нет</small>';
    renderOwner();
  }
  function actions(i) {
    var bs = 'min-height:44px;padding:0 14px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:var(--soft,#eef);cursor:pointer;font-size:15px';
    return '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><label>Кол-во <input id="sh-q" type="number" inputmode="numeric" min="1" value="1" style="width:70px;min-height:44px;font-size:16px"></label>'
      + '<button type="button" data-do="sale" style="' + bs + ';background:#2a6df4;color:#fff;border-color:#2a6df4">Продажа</button>'
      + '<button type="button" data-do="receipt" style="' + bs + '">Приход</button>'
      + '<button type="button" data-do="writeoff" style="' + bs + '">Списание</button></div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><label>Пересчитал, на полке <input id="sh-c" type="number" inputmode="numeric" min="0" style="width:80px;min-height:44px;font-size:16px"></label><button type="button" data-do="count" style="' + bs + '">Сверить</button></div>';
  }
  function act(kind) {
    if (!SEL) return;
    var inp = $s(kind === 'count' ? 'sh-c' : 'sh-q'), q = inp ? inp.value : '';
    if (q === '' || isNaN(Number(q))) { msg('Введите количество', true); return; }
    var key = kind + '|' + SEL + '|' + q;
    var id = PENDING[key] || (PENDING[key] = oid());
    msg('Записываю…'); 
    call({ action: kind, tid: SEL, qty: Number(q), oid: id }).then(function (r) {
      if (!r.ok) { msg(r.error || 'не записано, повторите', true); return; }
      delete PENDING[key];
      var t = kind === 'count' ? (r.diff === 0 ? 'Сходится. На полке ' + r.stock : ('Расхождение ' + (r.diff > 0 ? '+' : '') + r.diff + ' (по учёту было ' + r.calc + ')')) : (TIP[kind] + ' записана. Остаток ' + r.stock + (r.warn ? '. ' + r.warn : ''));
      msg(t, kind === 'count' ? r.diff !== 0 : !!r.warn); SEL = null; load();
    });
  }
  function renderOwner() {
    var box = $s('sh-own'); if (!box || !DATA) return;
    if (DATA.role !== 'owner') { box.innerHTML = ''; return; }
    var h = '<h3 style="margin:14px 0 6px">Товары</h3><form id="sh-add" style="display:flex;flex-wrap:wrap;gap:8px"><input id="sh-n" placeholder="Название" style="flex:1 1 160px;min-height:44px;font-size:16px"><input id="sh-p" placeholder="Цена" inputmode="decimal" style="width:90px;min-height:44px;font-size:16px"><button type="submit" style="min-height:44px;padding:0 14px">Добавить</button></form>';
    h += DATA.items.map(function (i) { return '<div style="padding:4px 0"><small>' + esc(i.name) + ' · ' + money(i.price) + (i.active ? '' : ' · скрыт') + ' <a href="#" data-price="' + esc(i.tid) + '">цена</a> <a href="#" data-vis="' + esc(i.tid) + '">' + (i.active ? 'скрыть' : 'показать') + '</a></small></div>'; }).join('');
    h += '<h3 style="margin:14px 0 6px">Сверка по операторам</h3><div class="seg"><button type="button" data-d="1"' + (DAYS === 1 ? ' class="on"' : '') + '>Сегодня</button> <button type="button" data-d="7"' + (DAYS === 7 ? ' class="on"' : '') + '>7 дней</button></div>';
    if (REPORT) h += REPORT.staff.length ? REPORT.staff.map(function (s) {
      var bad = s.shortage > 0;
      return '<div style="border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:10px;margin:8px 0"><b>' + esc(s.name) + '</b><br><small>Продано: ' + s.sales + ' шт. на ' + money(s.salesSum) + ' · приход ' + s.receipts + ' · списано ' + s.writeoffs + ' · пересчётов ' + s.counts + '</small>'
        + (s.counts ? '<br><small style="color:' + (bad ? '#c0392b' : 'inherit') + '">Недостача: ' + s.shortage + ' шт.' + (s.surplus ? ' · излишек ' + s.surplus : '') + '</small>' : '')
        + (s.checks.length ? '<ul style="margin:6px 0 0;padding-left:18px"><small>' + s.checks.map(function (c) { return '<li>' + dayHm(c.at) + ' ' + esc(c.name) + ': учёт ' + c.calc + ', факт ' + c.actual + (c.diff ? ', ' + (c.diff > 0 ? '+' : '') + c.diff : ', сходится') + '</li>'; }).join('') + '</small></ul>' : '') + '</div>';
    }).join('') : '<p><small>За период записей нет</small></p>';
    box.innerHTML = h;
    var f = $s('sh-add');
    f.addEventListener('submit', function (e) { e.preventDefault(); call({ action: 'add_item', name: $s('sh-n').value, price: $s('sh-p').value }).then(function (r) { if (!r.ok) msg(r.error || 'не добавлено', true); else { msg('Товар добавлен'); load(); } }); });
    box.querySelectorAll('[data-price]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); var t = a.getAttribute('data-price'); var it = DATA.items.filter(function (x) { return x.tid === t; })[0]; var inp = $s('sh-p'); var v = inp && inp.value; if (v === '' || isNaN(Number(v))) { msg('Впишите новую цену в поле «Цена» и нажмите «цена» у товара «' + it.name + '»', true); return; } call({ action: 'edit_item', tid: t, price: Number(v) }).then(function (r) { if (r.ok) { msg('Цена изменена'); load(); } else msg(r.error, true); }); }); });
    box.querySelectorAll('[data-vis]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); var t = a.getAttribute('data-vis'); var it = DATA.items.filter(function (x) { return x.tid === t; })[0]; call({ action: 'edit_item', tid: t, active: !it.active }).then(function (r) { if (r.ok) load(); else msg(r.error, true); }); }); });
    box.querySelectorAll('.seg [data-d]').forEach(function (b) { b.addEventListener('click', function () { DAYS = +b.getAttribute('data-d'); loadReport(); }); });
  }
  setInterval(function () {
    ensure();
    var b = $s('b-shop'), has = false; try { has = !!(store('ew_cab') || store('ew_sid')); } catch (e) {}
    if (b) b.hidden = !has;
    var d = $s('m-shop'); if (d && d.open && !document.hidden && !SEL) load();
  }, 15000);
  setTimeout(ensure, 0);
  setTimeout(function () { var b = $s('b-shop'), has = false; try { has = !!(store('ew_cab') || store('ew_sid')); } catch (e) {} if (b) b.hidden = !has; }, 1500);
  root.EWShop = { open: openShop };
})(typeof window !== 'undefined' ? window : globalThis);
