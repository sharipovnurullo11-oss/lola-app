// Раздел «Специалисты»: отдельный экран со списком специалистов (бухгалтер работает, остальные скоро).
// Главный экран кабинета владельца — ряд специалистов (у сотрудников его нет). Продавец-ассистент открывает окно переписок.
// Бухгалтер: приход, расход, остатки товара; данные хранит n8n по адресу /buhgalter (код кабинета, как у /kb).
(function (root) {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof post !== 'function') return;
  var TX = typeof T === 'function' ? T : function (s) { return s; };
  var LIST = [
    { id: 'seller', name: 'Продавец-ассистент', about: 'Отвечает клиентам в Instagram, WhatsApp, Telegram и Messenger', ready: true, ico: '💬' },
    { id: 'buh', name: 'Бухгалтер', about: 'Приход, расход и остатки товара. Показывает прибыль за месяц', ready: true, ico: '📒' },
    { id: 'smm', name: 'SMM-специалист', about: 'Идеи постов и Reels, подписи, план публикаций', ready: false, ico: '📣' },
    { id: 'target', name: 'Маркетолог-таргетолог', about: 'Куда вложить деньги в рекламу и какой оффер сделать', ready: false, ico: '🎯' },
    { id: 'manager', name: 'Менеджер по клиентам', about: 'Напоминает о повторных покупках и возвращает пропавших клиентов', ready: false, ico: '🤝' },
    { id: 'lawyer', name: 'Юрист', about: 'Договоры, условия и ответы на юридические вопросы бизнеса', ready: false, ico: '⚖️' }
  ];
  var S = { view: 'list', buh: null, month: '', busy: false };

  function $s(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return ('0' + n).slice(-2); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthOf(date) { return String(date).slice(0, 7); }
  function shiftMonth(m, k) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + k; var d = new Date(y, mo, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  var MN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  function monthName(m) { return TX(MN[+m.slice(5, 7) - 1]) + ' ' + m.slice(0, 4); }
  // Деньги считаем в дирамах (целые числа), чтобы не копились ошибки дробных чисел.
  function cents(x) { return Math.round(Number(x) * 100); }
  function money(c) { var neg = c < 0; c = Math.abs(c); var s = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+$)/g, ' '), r = c % 100; return (neg ? '−' : '') + s + (r ? ',' + pad(r) : ''); }
  function oid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function code() { var b = {}; try { b.code = store('ew_cab') || ''; } catch (e) {} return b; }
  function call(body) {
    var b = code(); for (var k in body) b[k] = body[k];
    return post('/buhgalter', b).then(function (x) { return (x && x.j) || { ok: false, error: TX('нет связи') }; }, function () { return { ok: false, error: TX('нет связи') }; });
  }
  function owner() { try { return !isStaff(); } catch (e) { return false; } }

  // «расход 150 такси», «приход 500 продажа», «+500 ...», «-150 ...»
  function parseText(s) {
    var m = /^\s*(приход|доход|расход|трата|\+|-|−)\s*(\d{1,9}(?:[.,]\d{1,2})?)\s*(.*)$/i.exec(String(s || ''));
    if (!m) return null;
    var w = m[1].toLowerCase(), type = (w === 'приход' || w === 'доход' || w === '+') ? 'in' : 'out';
    return { type: type, amount: m[2].replace(',', '.'), note: m[3].trim().slice(0, 120) };
  }

  function ensure() {
    if (!$s('m-spec')) {
      var d = document.createElement('dialog'); d.id = 'm-spec';
      d.style.cssText = 'width:min(620px,calc(100vw - 16px))';
      d.innerHTML = '<div class="dbody" style="position:relative;max-height:calc(100dvh - 24px);overflow:auto"><button class="x" data-close type="button" aria-label="' + esc(TX('Закрыть')) + '">×</button><div id="sp-body"></div></div>';
      document.body.appendChild(d);
      d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
      d.addEventListener('click', onClick);
      d.addEventListener('submit', function (e) { e.preventDefault(); });
    }
    return true;
  }
  function openOne(id) {
    if (!owner()) return; ensure();
    if (id === 'buh') openBuh(); else { S.view = id; render(); }
    open_dlg('m-spec');
  }

  /* ---------- Главный экран: ряд специалистов ---------- */
  var HOME = true, prevUser = false;
  function injectHome() {
    if ($s('sp-home')) return true;
    var app = document.querySelector('.app'), ref = $s('chs'); if (!app || !ref) return false;
    var st = document.createElement('style');
    st.textContent = '.app.sp-on>.chs,.app.sp-on>.lbar,.app.sp-on>.work,.app.sp-on>.alertbar,.app.sp-on>.hint{display:none!important}' +
      '#sp-home{padding:16px;overflow:auto;flex:1;min-height:0}#sp-home h2{margin:0 0 4px;font-size:20px}#sp-home p{margin:0 0 14px;opacity:.75}' +
      '#sp-home .sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}' +
      '#sp-home .sp-tile{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:16px 10px;border:1px solid var(--line,#ddd);border-radius:16px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer}' +
      '#sp-home .sp-tile.soon{opacity:.6}#sp-home .sp-tile .ic{font-size:36px;line-height:1}#sp-home .sp-tile b{font-size:15px}#sp-home .sp-tile small{opacity:.75;font-size:12px}' +
      '#sp-back{padding:6px 12px}#sp-back button{border:0;background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;padding:6px 0}';
    document.head.appendChild(st);
    var home = document.createElement('section'); home.id = 'sp-home'; home.hidden = true; home.setAttribute('aria-label', TX('Специалисты'));
    home.innerHTML = '<h2>' + esc(TX('Ваши специалисты')) + '</h2><p>' + esc(TX('Нажмите на специалиста, чтобы открыть его работу.')) + '</p><div class="sp-grid">' +
      LIST.map(function (x) {
        return '<button type="button" class="sp-tile' + (x.ready ? '' : ' soon') + '" data-home="' + x.id + '"><span class="ic" aria-hidden="true">' + x.ico + '</span><b>' + esc(TX(x.name)) + '</b><small>' + esc(TX(x.ready ? x.about : 'Скоро')) + '</small></button>';
      }).join('') + '</div>';
    app.insertBefore(home, ref);
    var back = document.createElement('div'); back.id = 'sp-back'; back.hidden = true;
    back.innerHTML = '<button type="button">← ' + esc(TX('Специалисты')) + '</button>';
    app.insertBefore(back, ref);
    home.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-home]'); if (!b) return;
      if (b.dataset.home === 'seller') { HOME = false; return applyHome(); }
      openOne(b.dataset.home);
    });
    back.addEventListener('click', function () { HOME = true; applyHome(); });
    return true;
  }
  function applyHome() {
    if (!injectHome()) return;
    var user = false; try { user = mode() === 'user' && owner(); } catch (e) {}
    if (!user) HOME = true;
    prevUser = user;
    var show = user && HOME;
    var app = document.querySelector('.app'); if (app) app.classList.toggle('sp-on', show);
    $s('sp-home').hidden = !show;
    $s('sp-back').hidden = !(user && !HOME);
  }

  function render() {
    var el = $s('sp-body'); if (!el) return;
    if (S.view === 'buh') return renderBuh(el);
    if (S.view !== 'list') return renderSoon(el, S.view);
    el.innerHTML = '<h2 style="padding-right:36px">' + esc(TX('Специалисты')) + '</h2><p>' + esc(TX('Выберите специалиста. Каждый работает в своём окне.')) + '</p><div class="sp-list" style="display:grid;gap:10px">' +
      LIST.map(function (s) {
        return '<button type="button" class="btn sec sp-card" data-sp="' + s.id + '" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:12px">' +
          '<span style="font-size:26px;flex:none" aria-hidden="true">' + s.ico + '</span>' +
          '<span style="flex:1;min-width:0"><b style="display:block">' + esc(TX(s.name)) + '</b><small style="opacity:.75">' + esc(TX(s.about)) + '</small></span>' +
          '<span style="flex:none;font-size:12px;padding:3px 8px;border-radius:10px;background:' + (s.ready ? '#e3f6ea;color:#1f8a4c' : '#eee;color:#777') + '">' + esc(TX(s.ready ? 'работает' : 'скоро')) + '</span></button>';
      }).join('') + '</div>';
  }
  function backBtn() { return '<button type="button" class="btn sec" data-sp-back style="margin-bottom:8px">← ' + esc(TX('К списку специалистов')) + '</button>'; }
  function renderSoon(el, id) {
    var s = LIST.filter(function (x) { return x.id === id; })[0]; if (!s) { S.view = 'list'; return render(); }
    el.innerHTML = backBtn() + '<h2 style="padding-right:36px">' + s.ico + ' ' + esc(TX(s.name)) + '</h2><p>' + esc(TX(s.about)) + '.</p><p><b>' + esc(TX('Скоро.')) + '</b> ' + esc(TX('Этот специалист ещё готовится. Мы сообщим, когда он заработает.')) + '</p>';
  }

  /* ---------- Бухгалтер ---------- */
  function openBuh() { S.view = 'buh'; S.month = S.month || today().slice(0, 7); S.buh = null; render(); load(); }
  function load() {
    if (S.busy) return; S.busy = true;
    call({ action: 'list', month: S.month }).then(function (r) {
      S.busy = false;
      if (!r.ok) { S.buh = { error: r.error || TX('не удалось загрузить') }; } else { S.buh = { ops: r.ops || [], stock: r.stock || [] }; }
      if (S.view === 'buh') render();
    });
  }
  function sums() {
    var i = 0, o = 0; (S.buh.ops || []).forEach(function (p) { if (monthOf(p.date) !== S.month) return; var c = cents(p.amount); if (p.type === 'in') i += c; else o += c; });
    return { i: i, o: o, p: i - o };
  }
  function renderBuh(el) {
    var h = backBtn() + '<h2 style="padding-right:36px">📒 ' + esc(TX('Бухгалтер')) + '</h2>';
    if (!S.buh) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (S.buh.error) { el.innerHTML = h + '<p class="err">' + esc(S.buh.error) + '</p><button class="btn" data-buh="reload" type="button">' + esc(TX('Ещё раз')) + '</button>'; return; }
    var t = sums(), ops = S.buh.ops.filter(function (p) { return monthOf(p.date) === S.month; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.ts < b.ts ? 1 : -1); });
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0"><button class="btn sec" data-buh="prev" type="button" aria-label="' + esc(TX('Прошлый месяц')) + '">‹</button><b>' + esc(monthName(S.month)) + '</b><button class="btn sec" data-buh="next" type="button" aria-label="' + esc(TX('Следующий месяц')) + '">›</button></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin-bottom:10px">' +
      '<div><small>' + esc(TX('Приход')) + '</small><br><b style="color:#1f8a4c">' + money(t.i) + '</b></div>' +
      '<div><small>' + esc(TX('Расход')) + '</small><br><b style="color:#c0392b">' + money(t.o) + '</b></div>' +
      '<div><small>' + esc(TX('Прибыль')) + '</small><br><b>' + money(t.p) + '</b></div></div><small>' + esc(TX('Все суммы в сомони.')) + '</small>';
    h += '<form id="bh-form" style="display:grid;gap:8px;margin:10px 0"><input class="in2" id="bh-text" maxlength="160" placeholder="' + esc(TX('Например: расход 150 такси')) + '" autocomplete="off">' +
      '<div class="row2"><button class="btn" data-buh="text" type="button">' + esc(TX('Записать')) + '</button></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><select class="in2" id="bh-type"><option value="in">' + esc(TX('Приход')) + '</option><option value="out">' + esc(TX('Расход')) + '</option></select>' +
      '<input class="in2" id="bh-sum" inputmode="decimal" maxlength="12" placeholder="' + esc(TX('Сумма')) + '"></div>' +
      '<input class="in2" id="bh-note" maxlength="120" placeholder="' + esc(TX('За что')) + '">' +
      '<input class="in2" id="bh-date" type="date" value="' + today() + '">' +
      '<button class="btn" data-buh="add" type="button">' + esc(TX('Добавить запись')) + '</button></form><p class="err" id="bh-err" hidden></p>';
    h += '<h3>' + esc(TX('Записи за месяц')) + '</h3>' + (ops.length ? '<div>' + ops.map(function (p) {
      return '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #ddd"><span style="flex:none;opacity:.7;font-size:12px">' + esc(String(p.date).slice(8, 10) + '.' + String(p.date).slice(5, 7)) + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + esc(p.note || '') + '</span>' +
        '<b style="flex:none;color:' + (p.type === 'in' ? '#1f8a4c' : '#c0392b') + '">' + (p.type === 'in' ? '+' : '−') + money(cents(p.amount)) + '</b>' +
        '<button class="btn sec" data-buh="del" data-id="' + esc(p.id) + '" type="button" aria-label="' + esc(TX('Удалить запись')) + '" style="flex:none;height:30px;padding:0 8px">×</button></div>';
    }).join('') + '</div>' : '<p>' + esc(TX('Записей за этот месяц нет.')) + '</p>');
    h += '<h3>' + esc(TX('Остатки товара')) + '</h3>' + (S.buh.stock.length ? '<div>' + S.buh.stock.map(function (g) {
      return '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #ddd"><span style="flex:1;min-width:0">' + esc(g.name) + '</span><b style="flex:none">' + esc(g.qty) + '</b>' +
        '<button class="btn sec" data-buh="st-" data-name="' + esc(g.name) + '" type="button" style="flex:none;height:30px;padding:0 10px" aria-label="−1">−</button><button class="btn sec" data-buh="st+" data-name="' + esc(g.name) + '" type="button" style="flex:none;height:30px;padding:0 10px" aria-label="+1">+</button></div>';
    }).join('') + '</div>' : '<p>' + esc(TX('Товаров пока нет.')) + '</p>');
    h += '<div style="display:grid;grid-template-columns:1fr 90px auto;gap:8px;margin:10px 0"><input class="in2" id="bh-gname" maxlength="60" placeholder="' + esc(TX('Название товара')) + '"><input class="in2" id="bh-gqty" inputmode="numeric" maxlength="7" placeholder="' + esc(TX('Сколько')) + '"><button class="btn" data-buh="gadd" type="button">' + esc(TX('Добавить')) + '</button></div>';
    el.innerHTML = h;
  }
  function err(t) { var e = $s('bh-err'); if (!e) return; e.textContent = t || ''; e.hidden = !t; }
  function addOp(op) {
    if (!(cents(op.amount) > 0) || cents(op.amount) > 100000000000) return err(TX('Введите сумму больше нуля'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date)) return err(TX('Укажите дату'));
    op.id = oid(); err('');
    call({ action: 'add', op: op }).then(function (r) {
      if (!r.ok) return err(r.error || TX('Не удалось записать'));
      op.ts = Date.now(); if (monthOf(op.date) !== S.month) { S.month = monthOf(op.date); S.buh = null; render(); return load(); } S.buh.ops.push(op); render();
    });
  }
  function stock(name, delta) {
    name = String(name || '').trim().slice(0, 60); delta = Math.round(Number(delta));
    if (!name || !isFinite(delta) || !delta) return err(TX('Введите название и количество'));
    err('');
    call({ action: 'stock', name: name, delta: delta }).then(function (r) { if (!r.ok) return err(r.error || TX('Не удалось записать')); S.buh.stock = r.stock || []; render(); });
  }
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-sp-back')) { $s('m-spec').close(); return; }
    if (false) { if (b.dataset.sp === 'seller') { $s('m-spec').close(); return; } if (b.dataset.sp === 'buh') return openBuh(); S.view = b.dataset.sp; return render(); }
    var a = b.dataset.buh; if (!a) return;
    if (a === 'reload') { S.buh = null; render(); return load(); }
    if (a === 'prev' || a === 'next') { S.month = shiftMonth(S.month, a === 'prev' ? -1 : 1); S.buh = null; render(); return load(); }
    if (a === 'text') { var p = parseText($s('bh-text').value); if (!p) return err(TX('Напишите так: расход 150 такси или приход 500 продажа')); p.date = today(); return addOp(p); }
    if (a === 'add') return addOp({ type: $s('bh-type').value === 'in' ? 'in' : 'out', amount: $s('bh-sum').value.trim().replace(',', '.'), note: $s('bh-note').value.trim(), date: $s('bh-date').value });
    if (a === 'del') { var id = b.dataset.id; return call({ action: 'del', id: id }).then(function (r) { if (!r.ok) return err(r.error || TX('Не удалось удалить')); S.buh.ops = S.buh.ops.filter(function (p) { return p.id !== id; }); render(); }); }
    if (a === 'st+' || a === 'st-') return stock(b.dataset.name, a === 'st+' ? 1 : -1);
    if (a === 'gadd') return stock($s('bh-gname').value, $s('bh-gqty').value || 1);
  }

  var tries = 0;
  (function wait() {
    if (ensure() && injectHome()) {
      if (typeof render_top === 'function') { var o = render_top; render_top = function () { var r = o.apply(this, arguments); applyHome(); return r; }; }
      applyHome(); return;
    }
    if (++tries < 50) setTimeout(wait, 200);
  })();
  root.EWSpecialists = { parseText: parseText, money: money, cents: cents };
})(typeof window !== 'undefined' ? window : globalThis);
