// Раздел «Специалисты»: отдельный экран со списком специалистов (бухгалтер работает, остальные скоро).
// Главный экран кабинета владельца — ряд специалистов (у сотрудников его нет). Продавец-ассистент открывает окно переписок.
// SMM: план недели, подпись, разбор профиля по данным Instagram клиента, данные и ИИ через n8n /smm.
// Бухгалтер: приход, расход, остатки товара; данные хранит n8n по адресу /buhgalter (код кабинета, как у /kb).
(function (root) {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof post !== 'function') return;
  var TX = typeof T === 'function' ? T : function (s) { return s; };
  var LIST = [
    { id: 'seller', name: 'Продавец-ассистент', about: 'Отвечает клиентам в Instagram, WhatsApp, Telegram и Messenger', ready: true, ico: '💬' },
    { id: 'buh', name: 'Бухгалтер', about: 'Приход, расход и остатки товара. Показывает прибыль за месяц', ready: true, ico: '📒', hide: true },
    { id: 'shop', name: 'Учёт магазина', about: 'Касса, товары с кодом и маржой, склад, долги и отчёт', ready: true, ico: '🛒', hide: true },
    { id: 'fin', name: 'Финансист', about: 'Бухгалтерия, касса и учёт магазина: деньги, товар и долги', ready: true, ico: '💼' },
    { id: 'smm', name: 'SMM-специалист', about: 'План недели, подписи к постам и разбор профиля по вашему Instagram', ready: true, ico: '📣' },
    { id: 'mkt', name: 'Маркетолог', about: 'Контент-план, где теряются клиенты, ваши цифры и тексты для возврата', ready: true, ico: '🎯' },
    { id: 'manager', name: 'Менеджер по клиентам', about: 'Следит, чтобы клиенты не терялись: возвращает замолчавших, напоминает о повторных покупках', ready: true, ico: '🤝' },
    { id: 'lawyer', name: 'Юрист', about: 'Составляет договоры на русском, таджикском и узбекском', ready: true, ico: '⚖️' }
  ];
  var S = { view: 'list', buh: null, month: '', busy: false };
  // «Учёт магазина» включён только для кабинета Шамсуло. Решает сервер /magazin: чужому кабинету он отвечает «нет доступа».
  // Ответ запоминаем на устройстве для этого кода кабинета, чтобы плитка не мигала при каждом открытии.
  var SHOP_ASK = '';
  function shopOn() { try { var c = String(store('ew_cab') || ''); return !!c && lstore('ew_shop_for') === c; } catch (e) { return false; } }
  function shopCheck() {
    var c = ''; try { c = String(store('ew_cab') || ''); } catch (e) {}
    if (!c || SHOP_ASK === c) return; SHOP_ASK = c;
    callTo('/magazin', { action: 'ping' }).then(function (r) {
      if (!r || r.error === TX('нет связи')) { SHOP_ASK = ''; return; }
      if (r.error === 'as') return;
      var on = r.error !== 'нет доступа', was = shopOn();
      try { lstore('ew_shop_for', on ? c : null); } catch (e) {}
      if (on !== was) { applyHome(); render(); }
    });
  }

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
  function sellerView() { return SELLER || staffNow(); }
  var PREVIEW = false, PREV_TAB = '', PREV_FIN = false;
  function staffNow() { try { return !!isStaff(); } catch (e) { return false; } }
  function code() { var b = {}; try { if (staffNow()) b.sid = store('ew_sid') || ''; else b.code = store('ew_cab') || ''; } catch (e) {} return b; }
  function callTo(path, body) {
    var b = code(); for (var k in body) b[k] = body[k];
    return post(path, b).then(function (x) { return (x && x.j) || { ok: false, error: TX('нет связи') }; }, function () { return { ok: false, error: TX('нет связи') }; });
  }
  function call(body) { return callTo('/buhgalter', body); }
  function owner() { try { return !isStaff(); } catch (e) { return false; } }

  // «расход 150 такси», «приход 500 продажа», «+500 ...», «-150 ...»
  function parseText(s) {
    var m = /^\s*(приход|доход|расход|трата|\+|-|−)\s*(\d{1,9}(?:[.,]\d{1,2})?)\s*(.*)$/i.exec(String(s || ''));
    if (!m) return null;
    var w = m[1].toLowerCase(), type = (w === 'приход' || w === 'доход' || w === '+') ? 'in' : 'out';
    return { type: type, amount: m[2].replace(',', '.'), note: m[3].trim().slice(0, 120) };
  }

  // Голос: «потратил сто пятьдесят на такси», «пришло 500 за консультацию»
  var NW = { 'ноль': 0, 'один': 1, 'одна': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14, 'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19, 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50, 'шестьдесят': 60, 'семьдесят': 70, 'восемьдесят': 80, 'девяносто': 90, 'сто': 100, 'двести': 200, 'триста': 300, 'четыреста': 400, 'пятьсот': 500, 'шестьсот': 600, 'семьсот': 700, 'восемьсот': 800, 'девятьсот': 900 };
  function parseVoice(s) {
    var t = String(s || '').toLowerCase().replace(/[.,!?]+$/g, '').replace(/(\d)\s+(\d{3})(?!\d)/g, '$1$2'), w = t.split(/\s+/).filter(Boolean);
    var type = /(пришл|получил|получила|заработал|заработала|продал|продала|приход|доход|выручк|оплатил клиент)/.test(t) ? 'in' : 'out';
    var amount = null, used = {}, i, cur = 0, total = 0, started = false, last = -1;
    for (i = 0; i < w.length; i++) {
      var x = w[i];
      if (/^\d+([.,]\d+)?$/.test(x)) { if (amount === null && !started) { amount = x.replace(',', '.'); used[i] = 1; last = i; if (/^(тысяч|тысячи|тыс)/.test(w[i + 1] || '')) { amount = String(parseFloat(amount) * 1000); used[i + 1] = 1; } } continue; }
      if (NW.hasOwnProperty(x)) { cur += NW[x]; started = true; used[i] = 1; last = i; continue; }
      if (/^(тысяча|тысячи|тысяч|тыс)$/.test(x) && started) { total += (cur || 1) * 1000; cur = 0; used[i] = 1; continue; }
      if (started && amount === null && last < i - 1) break;
    }
    if (amount === null && started) amount = String(total + cur);
    if (amount === null || !(parseFloat(amount) > 0)) return null;
    var skip = /^(потратил|потратила|потратили|расход|трата|заплатил|заплатила|пришло|пришли|получил|получила|приход|доход|сомони|сомон|рублей|руб|на|за|от|в|и|мне|я|сегодня|добавь|запиши|запись)$/;
    var note = w.filter(function (_, k) { return !used[k]; }).filter(function (x) { return !skip.test(x); }).join(' ');
    return { type: type, amount: amount, note: note.slice(0, 120) };
  }
  var REC = null;
  function voice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return err(TX('Голос не работает в этом браузере. Напишите текстом.'));
    if (REC) { try { REC.stop(); } catch (e) {} return; }
    var r = new SR(), btn = document.querySelector('[data-buh="mic"]'), got = false;
    REC = r; r.lang = 'ru-RU'; r.interimResults = false; r.maxAlternatives = 1;
    if (btn) { btn.textContent = '⏹ ' + TX('Слушаю… нажмите, когда закончите'); btn.classList.add('rec'); }
    function done() { REC = null; var b = document.querySelector('[data-buh="mic"]'); if (b) { b.textContent = '🎤 ' + TX('Сказать голосом'); b.classList.remove('rec'); } }
    r.onresult = function (e) {
      got = true; var tx = e.results[0][0].transcript, f = $s('bh-text'); if (f) f.value = tx;
      var p = parseVoice(tx); if (!p) return err(TX('Не расслышал сумму. Скажите так: потратил 150 на такси'));
      p.date = today(); addOp(p);
    };
    r.onerror = function (e) { done(); err(e && e.error === 'not-allowed' ? TX('Разрешите микрофон в браузере') : TX('Не получилось услышать. Попробуйте ещё раз или напишите текстом.')); };
    r.onend = function () { done(); if (!got) { /* тишина */ } };
    try { r.start(); } catch (e) { done(); }
  }

  function ensure() {
    if (!$s('m-spec')) {
      var d = document.createElement('dialog'); d.id = 'm-spec';
      d.style.cssText = 'width:min(620px,calc(100vw - 16px))';
      d.innerHTML = '<div class="dbody" style="position:relative;max-height:calc(100dvh - 24px);overflow:auto"><button class="x" data-close type="button" aria-label="' + esc(TX('Закрыть')) + '">×</button><div id="sp-body"></div></div>';
      document.body.appendChild(d);
      d.querySelector('[data-close]').addEventListener('click', function () { if (S.view === 'apt' && AP.form) { AP.form = null; AP.err = ''; render(); return; } if (S.view === 'apt' && AP.polki) { AP.polki = false; AP.pq = ''; render(); return; } d.close(); }); /* крестик в форме «Новый препарат» возвращает в окно поиска, а не на главный экран (08.11.2026, кабинет Асрора) */
      d.addEventListener('click', onClick);
      d.addEventListener('submit', function (e) { e.preventDefault(); });
      d.addEventListener('input', function (e) { var t = e.target; if (t && t.dataset && t.dataset.lawF) { LW.f[t.dataset.lawF] = t.value; return; } if (t && t.id === 'law-text') { LW.text = t.value; return; } if (t && t.id === 'sm-plan') SM.plan = t.value; else if (t && t.id === 'sm-cap') SM.cap = t.value; else if (t && t.id === 'sm-ideas') SM.ideas = t.value; else if (t && t.id === 'sm-rep') SM.rep = t.value; else if (t && t.id === 'mk-in') MK.draft = t.value; else if (t && t.id === 'as-in') AS.draft = t.value; else if (t && t.id === 'bh-text') S.bhDraft = t.value; });
d.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.id === 'mk-in' && !/Mobi|Android|iPhone/i.test(navigator.userAgent)) { e.preventDefault(); mktClick('send'); } });
    }
    return true;
  }
  // Продавец (сотрудник) видит только простую кассу: код, подсказки, корзина, «Продать». Закупка, долги и отчёты ему сервер не отдаёт.
  function openStaffKassa() { ensure(); openShop(); open_dlg('m-spec'); }
  var STK = null, STKbusy = false;
  var STK = null, STKbusy = false;
  function staffBtn() {
    var on = false; try { on = mode() === 'user' && staffNow(); } catch (e) {}
    // Кнопка нужна только сотрудникам кабинета, где включён учёт магазина: спрашиваем сервер один раз.
    if (on && STK === null && !STKbusy) { STKbusy = true; callTo('/magazin', { action: 'list' }).then(function (r) { STK = !!(r && r.ok); STKbusy = false; if (r && r.ok && (r.role === 'pharmacist' || ((r.role === 'seller' || r.role === 'storekeeper') && r.polki))) { setPharm(); } else if (r && r.ok && (r.role === 'seller' || r.role === 'storekeeper')) { KEEPER = r.role === 'storekeeper'; setSeller(true); } staffBtn(); }); }
    on = on && STK === true;
    // Кнопка нужна только сотрудникам кабинета, где включён учёт магазина (Шамсуло): спрашиваем сервер один раз.
    if (on && STK === null && !STKbusy) { STKbusy = true; callTo('/magazin', { action: 'list' }).then(function (r) { STK = !!(r && r.ok); STKbusy = false; if (r && r.ok && (r.role === 'pharmacist' || ((r.role === 'seller' || r.role === 'storekeeper') && r.polki))) { setPharm(); } else if (r && r.ok && (r.role === 'seller' || r.role === 'storekeeper')) { KEEPER = r.role === 'storekeeper'; setSeller(true); } staffBtn(); }); }
    on = on && STK === true && !SELLER;
    var b = $s('sp-kassa-btn');
    if (!b && on) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'sp-kassa-btn';
      b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:20;min-height:56px;padding:0 22px;border:0;border-radius:28px;background:#4f46e5;color:#fff;font:inherit;font-size:18px;font-weight:700;box-shadow:0 6px 18px rgba(79,70,229,.4);cursor:pointer';
      b.textContent = '🛒 ' + ui('Продажа', 'Фурӯш', 'Sotuv');
      b.addEventListener('click', openStaffKassa);
      document.body.appendChild(b);
    }
    if (b) b.hidden = !on;
  }
  function openOne(id) {
    if (!owner()) return; ensure();
    if ((id === 'shop' && !shopOn()) || (id === 'obj' && !objOn())) return; S.fromFin = false; if (id === 'obj') openObj(); else if (id === 'fin') { if (objOn() && shopOn()) openApt(); else if (shopOn()) { S.view = 'fin'; render(); } else openFinOrProkat(); } else if (id === 'buh') openBuh(); else if (id === 'shop') openShop(); else if (id === 'smm') openSmm(); else if (id === 'mkt') openMkt(); else if (id === 'lawyer') openLaw(); else if (id === 'manager') openMgr(); else { S.view = id; render(); }
    open_dlg('m-spec');
  }

  /* ---------- Мой ассистент: сводка дня ---------- */
  // Один вход ко всем специалистам: по каждому коротко, что он делает, кнопка «Подробнее» и поле, чтобы поручить задачу.
  // Задача уходит нужному специалисту по ключевым словам.
  // Живые цифры: переписки берём из уже загруженного списка, деньги и остатки тем же запросом, что и бухгалтер (с записями из телефона).
  var AS = { draft: '', msg: '', rec: null, busy: false, buh: null, month: '', st: {} };
  var ASST_ROWS = [
    { id: 'seller', line: 'Отвечает клиентам в Instagram, WhatsApp, Telegram и Messenger. Ждущие ответа смотрите в переписках.' },
    { id: 'buh', line: 'Приход, расход и остатки товара. Прибыль за месяц считается сама.' },
    { id: 'shop', line: 'Касса, товары с кодом и маржой, склад, долги покупателей и отчёт.' },
    { id: 'smm', line: 'План недели, подписи к постам и разбор вашего Instagram.' },
    { id: 'mkt', line: 'Контент-план, где теряются клиенты и тексты для возврата.' },
    { id: 'manager', line: 'Возвращает замолчавших клиентов и напоминает о повторных покупках.' },
    { id: 'lawyer', line: 'Договоры на русском, таджикском и узбекском.' }
  ];
  var ASST_KEYS = [
    ['shop', /(магазин|товар|касс|продаж|долг|склад|маржа)/],
    ['buh', /(приход|расход|касс|деньг|прибыл|остат|трат|заплат|сомон|бухгалтер)/],
    ['lawyer', /(договор|юрист|аренд|соглашени|контракт|закон)/],
    ['smm', /(пост|подпис|рилс|reels|instagram|инстаграм|smm|смм|сторис|хэштег|хештег)/],
    ['mkt', /(маркетолог|контент.?план|воронк|теря|реклам|продвиж)/],
    ['manager', /(замолч|вернуть клиент|повторн|напомн|менеджер|не отвечает)/],
    ['seller', /(переписк|сообщени|ответ|директ|whatsapp|ватсап|telegram|телеграм|продавец)/]
  ];
  function asstRoute(text) {
    var t = String(text || '').toLowerCase();
    for (var i = 0; i < ASST_KEYS.length; i++) if (ASST_KEYS[i][1].test(t)) return ASST_KEYS[i][0];
    return '';
  }
  function openAsst() {
    if (!owner()) return; ensure(); S.view = 'asst'; AS.msg = ''; asstLoad(); render(); open_dlg('m-spec');
  }
  function asstLoad() {
    var m = today().slice(0, 7), my = AS.req = (AS.req || 0) + 1;
    if (AS.month !== m) { AS.month = m; AS.buh = null; }
    if (!AS.buh) AS.buh = readCache(m);
    call({ action: 'list', month: m }).then(function (r) {
      if (my !== AS.req) return;
      if (r.ok) { AS.buh = { ops: r.ops || [], stock: r.stock || [] }; try { lstore(ckey(m), JSON.stringify(AS.buh)); } catch (e) {} }
      else if (!AS.buh) AS.buh = { error: true };
      if (S.view === 'asst') render();
    });
    // остальные — те же запросы статуса, что делает каждый специалист при открытии
    [['smm', '/smm', 'status'], ['an', '/smm', 'analysis_status'], ['mkt', '/marketolog', 'status'], ['law', '/yurist', 'status']].forEach(function (q) {
      callTo(q[1], { action: q[2] }).then(function (r) { if (my !== AS.req) return; AS.st[q[0]] = r.ok ? r : null; if (S.view === 'asst') render(); });
    });
  }
  function leftOf(r, def) { return TX('Запросов сегодня осталось') + ': ' + r.left + ' ' + TX('из') + ' ' + (r.limit || def); }
  var QUIET_DAYS = 14;
  // Ждут ответа и давно молчат — по уже загруженным перепискам; null, если переписок нет
  function chatCounts() {
    try {
      if (typeof CHATS === 'undefined' || !Array.isArray(CHATS) || typeof unread_of !== 'function' || typeof MODE === 'undefined' || MODE !== 'user') return null;
      var wait = 0, quiet = 0, now = Date.now();
      CHATS.forEach(function (c) {
        if (unread_of(c) > 0) wait++;
        var last = 0; (c.messages || []).forEach(function (x) { var t = Date.parse(x && x.v); if (t > last) last = t; });
        if (last && now - last > QUIET_DAYS * 864e5) quiet++;
      });
      return { wait: wait, quiet: quiet, total: CHATS.length };
    } catch (e) { return null; }
  }
  function waitTxt(n) { return n ? ui('Ждут ответа: ', 'Мунтазири ҷавоб: ', 'Javob kutmoqda: ') + n : ui('Все клиенты получили ответ ✓', 'Ба ҳамаи мизоҷон ҷавоб дода шуд ✓', 'Barcha mijozlarga javob berildi ✓'); }
  function quietTxt(n) { return n ? ui('Молчат больше двух недель: ', 'Зиёда аз ду ҳафта хомӯшанд: ', 'Ikki haftadan ortiq jim: ') + n : ui('Никто не пропал надолго ✓', 'Ҳеҷ кас муддати дароз гум нашудааст ✓', 'Hech kim uzoq vaqt yo‘qolmagan ✓'); }
  // Подпись большой кнопки: главное из переписок, пока их нет — общее описание
  function heroSub() {
    var c = chatCounts(), sub = $s('sp-hero-sub'); if (!sub) return;
    var t = c && c.total ? waitTxt(c.wait) + (c.quiet ? ' · ' + quietTxt(c.quiet) : '') : TX('Что происходит у всех ваших специалистов, в одном окне');
    if (sub.textContent !== t) sub.textContent = t;
    var hero = sub.closest('.sp-hero'); if (hero) hero.classList.toggle('wait', !!(c && c.total && c.wait));
  }
  function asstFacts() {
    var f = {}, cc = chatCounts();
    if (cc) { f.seller = waitTxt(cc.wait); f.manager = quietTxt(cc.quiet); }
    var b = AS.buh;
    if (!b) f.buh = TX('Загрузка…');
    else if (!b.error) {
      var d = today(), ti = 0, to = 0, mi = 0, mo = 0;
      b.ops.forEach(function (p) {
        if (monthOf(p.date) !== AS.month) return;
        var c = cents(p.amount); if (p.type === 'in') { mi += c; if (p.date === d) ti += c; } else { mo += c; if (p.date === d) to += c; }
      });
      var low = b.stock.filter(function (g) { return g.qty <= 2; }).slice(0, 3).map(function (g) { return g.name + ' (' + g.qty + ')'; });
      f.buh = ui('Сегодня: пришло ', 'Имрӯз: даромад ', 'Bugun: kirim ') + money(ti) + ui(', ушло ', ', хароҷот ', ', chiqim ') + money(to) +
        ' · ' + ui('Прибыль за месяц: ', 'Фоидаи моҳ: ', 'Oylik foyda: ') + money(mi - mo) +
        (low.length ? ' · ' + ui('Заканчивается: ', 'Тамом шуда истодааст: ', 'Tugayapti: ') + low.join(', ') : '');
    }
    var st = AS.st, sm = st.smm, an = st.an, mk = st.mkt, lw = st.law, p;
    if (sm) {
      p = [sm.connected ? TX('Instagram подключён') + (sm.username ? ': @' + sm.username : '') : '⚠️ ' + ui('Instagram не подключён', 'Instagram пайваст нест', 'Instagram ulanmagan')];
      if (an && an.running) p.push('⏳ ' + ui('Идёт полный анализ Instagram', 'Таҳлили пурраи Instagram идома дорад', 'Instagramning to‘liq tahlili ketmoqda'));
      else if (an && an.status === 'done' && an.otchet) p.push(ui('Анализ готов', 'Таҳлил тайёр', 'Tahlil tayyor') + (anFmtDate(an.finished) ? ' (' + anFmtDate(an.finished) + ')' : ''));
      if (sm.left != null) p.push(leftOf(sm, 5));
      f.smm = p.join(' · ');
    }
    if (mk) {
      p = [];
      if (!(mk.channels || []).length) p.push('⚠️ ' + ui('Каналы не подключены', 'Каналҳо пайваст нестанд', 'Kanallar ulanmagan'));
      if (mk.left != null) p.push(leftOf(mk, 20));
      if (p.length) f.mkt = p.join(' · ');
    }
    if (lw && lw.left != null) f.lawyer = ui('Вопросов сегодня осталось', 'Имрӯз саволҳо монд', 'Bugun savollar qoldi') + ': ' + lw.left;
    return f;
  }
  function renderAsst(el) {
    var facts = asstFacts();
    var rows = ASST_ROWS.filter(function (r) { return r.id !== 'shop' || shopOn(); }).map(function (r) {
      var s = LIST.filter(function (x) { return x.id === r.id; })[0] || { ico: '', name: r.id };
      return '<div class="asst-row" style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line,#e5e5e5)">' +
        '<span style="font-size:24px;flex:none" aria-hidden="true">' + s.ico + '</span>' +
        '<span style="flex:1;min-width:0"><b style="display:block">' + esc(TX(s.name)) + '</b><small style="opacity:.8">' + esc(TX(r.line)) + '</small>' +
        (facts[r.id] ? '<span class="asst-fact" data-id="' + r.id + '" style="display:block;margin-top:4px;font-weight:600">' + esc(facts[r.id]) + '</span>' : '') + '</span>' +
        '<button type="button" class="btn sec" data-asst="open" data-id="' + r.id + '" style="flex:none;height:auto;padding:6px 10px">' + esc(TX('Подробнее')) + ' →</button></div>';
    }).join('');
    el.innerHTML = '<h2 style="padding-right:36px">✨ ' + esc(TX('Мой ассистент: сводка дня')) + '</h2>' +
      '<p>' + esc(TX('Все ваши специалисты в одном месте. Нажмите «Подробнее», чтобы открыть работу нужного.')) + '</p>' + rows +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line,#e5e5e5)"><label for="as-in" style="display:block;font-weight:600;margin-bottom:6px">' + esc(TX('Поручить ассистенту задачу')) + '</label>' +
      '<textarea id="as-in" rows="2" style="width:100%;box-sizing:border-box" placeholder="' + esc(TX('Напишите или скажите, что нужно. Ассистент сам выберет специалиста.')) + '">' + esc(AS.draft) + '</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn" data-asst="send"' + (AS.busy ? ' disabled' : '') + '>' + esc(TX('Передать')) + '</button>' +
      '<button type="button" class="btn sec' + (AS.rec ? ' rec' : '') + '" data-asst="mic">' + (AS.rec ? '⏹ ' + esc(TX('Слушаю… нажмите, когда закончите')) : '🎤 ' + esc(TX('Сказать голосом'))) + '</button></div>' +
      '<p id="as-msg" role="status" style="margin:8px 0 0;min-height:1.2em;opacity:.85">' + esc(AS.msg) + '</p></div>';
  }
  function asstSend() {
    var f = $s('as-in'), text = (f && f.value || AS.draft || '').trim();
    if (!text) { AS.msg = TX('Напишите задачу или скажите её голосом.'); return render(); }
    if (AS.busy) return;
    // Специалиста выбирает ИИ (n8n /assistent, лимит в сутки); нет связи, ошибка или лимит — по ключевым словам, как раньше
    AS.busy = true; AS.draft = text; AS.msg = ui('Думаю, кому передать…', 'Фикр мекунам, ба кӣ супорам…', 'Kimga topshirishni o‘ylayapman…'); render();
    callTo('/assistent', { action: 'route', text: text, lang: window.LANG || 'ru' }).then(function (r) {
      AS.busy = false;
      if (S.view !== 'asst') return;
      var id = r.ok ? r.id : asstRoute(text);
      if (!id) { AS.msg = TX('Не понял, какому специалисту передать. Выберите его в списке выше.'); return render(); }
      AS.draft = ''; AS.msg = '';
      openOne(id); asstHandoff(id, text);
    });
  }
  // Текст поручения сразу в поле специалиста: остаётся проверить и нажать кнопку. Сами специалисты ничего не отправляют.
  function asstHandoff(id, text) {
    if (id === 'lawyer') { LW.view = 'ask'; LW.text = text; }
    else if (id === 'mkt') MK.draft = text;
    else if (id === 'smm') { if (/(подпис|пост|caption)/i.test(text)) SM.cap = text; else SM.plan = text; }
    else if (id === 'buh') S.bhDraft = text;
    else return;
    render();
  }
  function asstMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { AS.msg = TX('Голос не работает в этом браузере. Напишите текстом.'); return render(); }
    if (AS.rec) { try { AS.rec.stop(); } catch (e) {} return; }
    var r = new SR(); AS.rec = r; var L = window.LANG || 'ru'; r.lang = L === 'tg' ? 'tg-TJ' : (L === 'uz' ? 'uz-UZ' : 'ru-RU'); r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = function (e) { AS.draft = (AS.draft ? AS.draft + ' ' : '') + e.results[0][0].transcript; };
    r.onerror = function (e) { AS.msg = e && e.error === 'not-allowed' ? TX('Разрешите микрофон в браузере') : TX('Не получилось услышать. Попробуйте ещё раз или напишите текстом.'); };
    r.onend = function () { AS.rec = null; if (S.view === 'asst') render(); };
    try { r.start(); render(); } catch (e) { AS.rec = null; }
  }
  function asstClick(b) {
    var a = b.dataset.asst;
    if (a === 'open') return openOne(b.dataset.id);
    if (a === 'send') return asstSend();
    if (a === 'mic') return asstMic();
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
      '#sp-home .sp-hero{display:flex;align-items:center;gap:14px;width:100%;text-align:left;margin:0 0 16px;padding:22px 18px;border:0;border-radius:20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font:inherit;cursor:pointer;box-shadow:0 6px 18px rgba(79,70,229,.35)}' +
      '#sp-home .sp-hero .ic{font-size:40px;line-height:1;flex:none}#sp-home .sp-hero b{display:block;font-size:19px}#sp-home .sp-hero small{display:block;opacity:.9;font-size:13px;margin-top:2px}' +
      '#sp-home .sp-hero:focus-visible{outline:3px solid #fff;outline-offset:2px}#sp-home .sp-hero.wait small{opacity:1;font-weight:700}' +
      '#sp-home .sp-grid{gap:8px!important}#sp-home .sp-tile{padding:10px 8px!important}#sp-home .sp-tile .ic{font-size:28px!important}#sp-home .sp-tile small{display:none}' +
      '#sp-home .sp-hero.pa{background:linear-gradient(135deg,#0f766e,#14b8a6);box-shadow:0 6px 18px rgba(15,118,110,.35)}#sp-home.pa-lock .sp-hero:not(.pa),#sp-home.pa-lock .sp-grid{opacity:.45}#sp-home .sp-lockmsg{margin:-6px 0 14px;font-size:13px;opacity:.85}' +
      '#sp-back{padding:6px 12px}#sp-back button{border:0;background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;padding:6px 0}';
    document.head.appendChild(st);
    var home = document.createElement('section'); home.id = 'sp-home'; home.hidden = true; home.setAttribute('aria-label', TX('Специалисты'));
    home.innerHTML = '<h2>' + esc(TX('Ваши специалисты')) + '</h2><p>' + esc(TX('Нажмите на специалиста, чтобы открыть его работу.')) + '</p>' +
      '<button type="button" class="sp-hero pa" data-home="pa"><span class="ic" aria-hidden="true">🤝</span><span><b>' + esc(ui('Личный ассистент', 'Ёвари шахсӣ', 'Shaxsiy yordamchi')) + '</b><small id="sp-pa-sub">' + esc(ui('Расскажите о себе, и я настрою кабинет', 'Дар бораи худ нақл кунед, кабинетро танзим мекунам', 'Oʻzingiz haqingizda ayting, kabinetni sozlayman')) + '</small></span></button><p class="sp-lockmsg" id="sp-lockmsg" hidden>' + esc(ui('Сначала познакомьтесь с личным ассистентом, остальное откроется после этого.', 'Аввал бо ёвари шахсӣ шинос шавед, боқӣ баъд кушода мешавад.', 'Avval shaxsiy yordamchi bilan tanishing, qolgani shundan keyin ochiladi.')) + '</p>' +
      '<button type="button" class="sp-hero" data-home="assistant"><span class="ic" aria-hidden="true">✨</span><span><b>' + esc(TX('Мой ассистент: сводка дня')) + '</b><small id="sp-hero-sub">' + esc(TX('Что происходит у всех ваших специалистов, в одном окне')) + '</small></span></button>' +
      '<div class="sp-grid">' +
      LIST.filter(function (x) { return !x.hide; }).map(function (x) {
        return '<button type="button" class="sp-tile' + (x.ready ? '' : ' soon') + '" data-home="' + x.id + '"><span class="ic" aria-hidden="true">' + x.ico + '</span><b>' + esc(TX(x.name)) + '</b><small>' + esc(TX(x.ready ? x.about : 'Скоро')) + '</small></button>';
      }).join('') + '<button type="button" class="sp-tile" data-home="obj" hidden><span class="ic" aria-hidden="true">🏗️</span><b>' + esc(ui('Финансист по объектам', 'Молиячӣ аз рӯи объектҳо', 'Obyektlar boʻyicha moliyachi')) + '</b><small>' + esc(ui('Точки, заказчики, мастера', 'Нуқтаҳо, фармоишгарон, устоҳо', 'Nuqtalar, buyurtmachilar, ustalar')) + '</small></button></div>';
    app.insertBefore(home, ref);
    var back = document.createElement('div'); back.id = 'sp-back'; back.hidden = true;
    back.innerHTML = '<button type="button">← ' + esc(TX('Специалисты')) + '</button>';
    app.insertBefore(back, ref);
    home.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-home]'); if (!b) return;
      if (b.dataset.home === 'pa') return openPa();
      if (!paDone()) { paCheck(); return openPa(); }
      if (b.dataset.home === 'assistant') return openAsst();
      if (b.dataset.home === 'seller') { HOME = false; return applyHome(); }
      openOne(b.dataset.home);
    });
    back.addEventListener('click', function () { HOME = true; applyHome(); });
    return true;
  }
  function applyHome() {
    if (!injectHome()) return;
    var asrorCab0 = false; try { asrorCab0 = String(store('ew_cab') || '') === 'kd6es8ycn5fa6gj43v7vlmw3nc0z5'; } catch (e) {}
    var aOn = function () { return objOn() || asrorCab0; }; // кабинет Асрора узнаём сразу, не дожидаясь ответа сервера: иначе секунду виден обычный список специалистов (личный ассистент и др.)
    var user = false; try { user = mode() === 'user' && owner(); } catch (e) {}
    if (!user) HOME = true;
    prevUser = user;
    var show = user && HOME;
    var app = document.querySelector('.app'); if (app) app.classList.toggle('sp-on', show);
    $s('sp-home').hidden = !show;
    staffBtn();
    if (user) shopCheck();
    var shopTile = document.querySelector('#sp-home [data-home="shop"]'); if (shopTile) shopTile.hidden = !shopOn();
    // Стройка: плитка «Финансист по объектам» только там, где сервер /objekty её разрешил; тогда обычный «Финансист» подписываем «Финансист аптеки».
    if (user) objCheck();
    var objTile = document.querySelector('#sp-home [data-home="obj"]'); if (objTile) objTile.hidden = !aOn();
    // Кабинет со стройкой (Асрор Холов): оставляем только продавца-ассистента и двух финансистов; SMM, маркетолог, менеджер, юрист и «Личный ассистент» скрыты.
    var onlyFin = aOn();
    ['smm', 'mkt', 'manager', 'lawyer'].forEach(function (id) { var t = document.querySelector('#sp-home [data-home="' + id + '"]'); if (t) t.hidden = onlyFin; });
    var paHero = document.querySelector('#sp-home [data-home="pa"]'); if (paHero) paHero.hidden = onlyFin;
    // По просьбе Нурулло (08.11.2026) в кабинете Асрора Холова убраны «Мой ассистент: сводка дня» и «Продавец-ассистент». Остальным кабинетам они видны как раньше.
    ['assistant', 'seller'].forEach(function (id) { var t = document.querySelector('#sp-home [data-home="' + id + '"]'); if (t) t.hidden = onlyFin; });
    var finB = document.querySelector('#sp-home [data-home="fin"] b'); if (finB) finB.textContent = aOn() ? ui('Аптека', 'Дорухона', 'Dorixona') : TX('Финансист');
    // Кабинет Асрора: плитка «Аптека» с картинкой лекарств вместо портфеля и подписью про поиск препарата.
    // 09.11.2026, Асрор: две большие кнопки с новыми иконками (аптека и объекты), без лишнего текста.
    if (onlyFin) {
      var svgA = '<svg viewBox="0 0 48 48" width="64" height="64" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="23" height="23" rx="7"/><path d="M16.5 11v11M11 16.5h11"/><g transform="rotate(-45 33 33)"><rect x="20.5" y="26" width="25" height="14" rx="7"/><path d="M33 26v14"/></g></svg>';
      var svgO = '<svg viewBox="0 0 48 48" width="64" height="64" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="19" width="17" height="24" rx="2.5"/><rect x="24" y="7" width="17" height="36" rx="2.5"/><path d="M12 25h7M12 31h7M12 37h7M29 13h7M29 19h7M29 25h7M29 31h7M29 37h7M3 43h42"/></svg>';
      [['fin', svgA], ['obj', svgO]].forEach(function (z) { var t = document.querySelector('#sp-home [data-home="' + z[0] + '"] .ic'); if (t && !t.getAttribute('data-big')) { t.innerHTML = z[1]; t.setAttribute('data-big', '1'); } });
    }
    var finT = document.querySelector('#sp-home [data-home="fin"]'); if (finT) { var fi = finT.querySelector('.ic'), fs = finT.querySelector('small'); if (fi && !fi.getAttribute('data-big')) { if (aOn()) fi.innerHTML = '<svg viewBox="0 0 48 48" width="1em" height="1em" style="vertical-align:-0.12em" aria-hidden="true"><rect x="7" y="20" width="34" height="22" rx="2" fill="#f4f1ea" stroke="#5b6770" stroke-width="2"/><path d="M4 20l4-10h32l4 10z" fill="#e8f5ee" stroke="#5b6770" stroke-width="2" stroke-linejoin="round"/><path d="M12 10l-2 10M20 10l-1 10M28 10l1 10M36 10l2 10" stroke="#1f9d62" stroke-width="3"/><rect x="19" y="29" width="10" height="13" rx="1" fill="#b9d7ea" stroke="#5b6770" stroke-width="1.5"/><path d="M24 2v8M20 6h8" stroke="#1f9d62" stroke-width="3" stroke-linecap="round" transform="translate(0 -1)"/><rect x="10" y="26" width="6" height="6" rx="1" fill="#b9d7ea"/><rect x="32" y="26" width="6" height="6" rx="1" fill="#b9d7ea"/></svg>'; else fi.textContent = '💼'; } if (fs && aOn()) fs.textContent = ui('Название препарата: полка и описание', 'Номи дору: раф ва тавсиф', 'Dori nomi: javon va tavsif'); }
    // 09.11.2026, по просьбе Нурулло: у Асрора окно поиска препарата само не открывается (раньше открывалось при каждом входе и обновлении), сразу видно главное окно с «Аптека» и «Финансист по объектам». Кнопки чата убраны: «Команда», «Свободные часы», «Развивай агента», меню.
    var asrorCab = false; try { asrorCab = String(store('ew_cab') || '') === 'kd6es8ycn5fa6gj43v7vlmw3nc0z5'; } catch (e) {}
    document.body.classList.toggle('ob-only', !!(aOn() || asrorCab));
    if (show || !(aOn() || asrorCab)) document.documentElement.classList.remove('ob-pre');
    $s('sp-back').hidden = !(user && !HOME);
    if (show) heroSub();
    var lock = show && !paDone(); if (show) paCheck();
    $s('sp-home').classList.toggle('pa-lock', lock);
    var lm = $s('sp-lockmsg'); if (lm) lm.hidden = !lock;
  }

  function render() {
    var el = SELLER ? $s('kas-body') : $s('sp-body'); if (!el) return; try { var dl = el.closest('dialog'), full = !!(SELLER || S.view === 'shop' || S.view === 'apt' || S.view === 'obj'), dbd = dl && dl.querySelector('.dbody'); if (dl) { var xb = dl.querySelector('[data-close]'); if (xb) xb.style.display = S.view === 'obj' ? 'none' : ''; dl.style.width = full ? '100vw' : 'min(620px,calc(100vw - 16px))'; dl.style.maxWidth = full ? '100vw' : ''; dl.style.height = full ? '100dvh' : ''; dl.style.maxHeight = full ? '100dvh' : ''; dl.style.borderRadius = full ? '0' : ''; if (dbd) { dbd.style.maxHeight = full ? '100dvh' : 'calc(100dvh - 24px)'; dbd.style.minHeight = full ? '100dvh' : ''; /* iPhone: верхняя строка («Назад» и название) не должна залезать под вырез/часы — опускаем её ниже (10.11.2026, Асрор: iPhone Pro) */ var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); dbd.style.paddingTop = (ios && full && (S.view === 'obj' || (S.view === 'apt' && !AP.polki))) ? 'calc(12px + max(env(safe-area-inset-top,0px),44px))' : ''; } } } catch (e) {}
    try { var obOn = !SELLER && S.view === 'obj'; el.classList.toggle('ob-v', obOn); var obDl = el.closest('dialog'), obBd = el.closest('.dbody'); if (obBd) obBd.style.background = obOn ? '#EEF1F6' : ''; if (obDl) obDl.style.background = obOn ? '#EEF1F6' : ''; } catch (e) {}
    if (SELLER) return PHARM ? renderApt(el) : renderShop(el);
    if (S.view === 'pa') return renderPa(el);
    if (S.view === 'asst') return renderAsst(el);
    if (S.view === 'apt') return renderApt(el);
    if (S.view === 'fin') return renderFin(el);
    if (S.view === 'prokat') return renderProkat(el);
    if (S.view === 'obj') return renderObj(el);
    if (S.view === 'buh') return renderBuh(el);
    if (S.view === 'shop') return renderShop(el);
    if (S.view === 'smm') return renderSmm(el);
    if (S.view === 'law') return renderLaw(el);
    if (S.view === 'mgr') return renderMgr(el);
if (S.view === 'mkt') return renderMkt(el);
    if (S.view !== 'list') return renderSoon(el, S.view);
    el.innerHTML = '<h2 style="padding-right:36px">' + esc(TX('Специалисты')) + '</h2><p>' + esc(TX('Выберите специалиста. Каждый работает в своём окне.')) + '</p><div class="sp-list" style="display:grid;gap:10px">' +
      LIST.filter(function (s) { return !s.hide; }).map(function (s) {
        return '<button type="button" class="btn sec sp-card" data-sp="' + s.id + '" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:12px">' +
          '<span style="font-size:26px;flex:none" aria-hidden="true">' + s.ico + '</span>' +
          '<span style="flex:1;min-width:0"><b style="display:block">' + esc(TX(s.name)) + '</b><small style="opacity:.75">' + esc(TX(s.about)) + '</small></span>' +
          '<span style="flex:none;font-size:12px;padding:3px 8px;border-radius:10px;background:' + (s.ready ? '#e3f6ea;color:#1f8a4c' : '#eee;color:#777') + '">' + esc(TX(s.ready ? 'работает' : 'скоро')) + '</span></button>';
      }).join('') + '</div>';
  }
  function backBtn() { var fin = S.fromFin && S.view !== 'fin'; return '<button type="button" class="btn sec" data-sp-back' + (fin ? '="fin"' : '') + ' style="margin-bottom:8px">← ' + esc(fin ? ui('Финансист', 'Мутахассиси молия', 'Moliyachi') : TX('К списку специалистов')) + '</button>'; }

  // «Финансист»: одна карточка на главном экране, внутри два раздела. «Учёт магазина» виден, только если он включён для кабинета.
  function renderFin(el) {
    function card(k, ico, name, about) {
      return '<button type="button" class="btn sec" data-fin="' + k + '" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">' + ico + '</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(name) + '</b><small style="opacity:.75">' + esc(about) + '</small></span></button>';
    }
    el.innerHTML = backBtn() + '<h2 style="padding-right:36px">💼 ' + esc(objOn() ? ui('Финансист аптеки', 'Молиячии дорухона', 'Dorixona moliyachisi') : ui('Финансист', 'Мутахассиси молия', 'Moliyachi')) + '</h2><p>' + esc(ui('Деньги и товар в одном месте. Выберите раздел.', 'Пул ва мол дар як ҷо. Бахшро интихоб кунед.', 'Pul va tovar bir joyda. Boʻlimni tanlang.')) + '</p><div style="display:grid;gap:10px">' +
      (objOn() && shopOn() ? card('apt', '🔍', ui('Поиск препарата', 'Ҷустуҷӯи дору', 'Dori qidirish'), ui('Набрать название: полка, остаток и цена', 'Номро нависед: раф, боқимонда ва нарх', 'Nomini yozing: javon, qoldiq va narx')) : '') +
      card('buh', '📒', ui('Бухгалтерия', 'Ҳисобдорӣ', 'Buxgalteriya'), ui('Приход, расход, остатки и прибыль за месяц', 'Даромад, хароҷот, боқимонда ва фоидаи моҳ', 'Kirim, chiqim, qoldiq va oylik foyda')) +
      card('shop', '🛒', ui('Учёт магазина', 'Ҳисоби мағоза', 'Doʻkon hisobi'), ui('Продажа, приём товара, долги и итоги', 'Фурӯш, қабули мол, қарзҳо ва натиҷаҳо', 'Sotuv, tovar qabuli, qarzlar va natijalar')) +
      (shopOn() ? card('kl', '📦', ui('Кладовщик', 'Анбордор', 'Omborchi'), ui('Приём товара, товары и закупочные цены; здесь же добавить кладовщика', 'Қабули мол, молҳо ва нархи харид; дар ҳамин ҷо анбордор илова кунед', 'Tovar qabuli, tovarlar va xarid narxlari; omborchini shu yerda qoʻshing')) : '') +
      '' + '</div>' + (shopOn() && owner() ? '<p style="margin-top:12px"><button type="button" class="btn sec" data-fin="push" style="height:36px;font-size:14px">🔔 ' + esc(ui('Включить уведомления на этом телефоне', 'Огоҳиномаро дар ин телефон фаъол кунед', 'Bu telefonda bildirishnomani yoqish')) + '</button></p>' : '') + (S.pushMsg ? '<p role="status" style="margin-top:10px">' + esc(S.pushMsg) + '</p>' : '');
  }
  // Push-уведомления владельцу: разрешение, подписка телефона и отправка её серверу
  function pushKey(k) { var p = '='.repeat((4 - k.length % 4) % 4), b = (k + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(b), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function pushEnable() {
    var say = function (t) { S.pushMsg = t; if (S.view === 'fin' || S.view === 'prokat') render(); };
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return say(ui('Этот телефон или браузер не поддерживает уведомления. На iPhone сначала добавьте приложение на экран «Домой».', 'Ин телефон ё браузер огоҳиномаро дастгирӣ намекунад.', 'Bu telefon yoki brauzer bildirishnomani qoʻllamaydi.'));
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return say(ui('Уведомления не разрешены. Разрешите их в настройках браузера для этого сайта.', 'Огоҳинома иҷозат нашуд. Дар танзимоти браузер иҷозат диҳед.', 'Bildirishnoma ruxsat etilmadi. Brauzer sozlamalarida ruxsat bering.'));
      return fetch('/push/key', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.key) return say(ui('Сервер пока не готов к уведомлениям. Попробуйте позже.', 'Сервер ҳоло омода нест.', 'Server hali tayyor emas.'));
        return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey(j.key) }); }).then(function (sub) {
          return fetch('/push/sub', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: store('ew_cab') || '', sub: sub.toJSON(), lang: (window.LANG === 'tg' ? 'tg' : 'ru') }) }).then(function (r) { return r.json(); }).then(function (x) {
            say(x && x.ok ? ui('Готово: уведомления включены на этом телефоне.', 'Тайёр: огоҳинома фаъол шуд.', 'Tayyor: bildirishnoma yoqildi.') : ui('Не удалось сохранить подписку.', 'Обуна захира нашуд.', 'Obuna saqlanmadi.'));
          });
        });
      });
    }).catch(function () { say(ui('Не получилось включить уведомления.', 'Огоҳинома фаъол нашуд.', 'Bildirishnomani yoqib boʻlmadi.')); });
  }
  /* ---------- Финансист по объектам (стройка): точки, заказчики, мастера ---------- */
  // Данные хранит n8n по адресу /objekty (таблица «Объекты — записи (стройка)»). Кому показывать, решает сервер:
  // чужому кабинету он отвечает «нет доступа», и плитка не появляется. Деньги стройки и аптеки не смешиваются:
  // у аптеки свой «Финансист» (учёт магазина), у стройки — этот. Записи только добавляются, ошибку исправляет отмена.
  var OB = { busy: false, err: '', msg: '', data: null, cur: null, form: null, sec: null, lich: null, rep: false, ph: null, foto: '', fbusy: false, mic: false, keep: {}, pending: {}, delAsk: null, split: false, pre: {} };
  var OB_ASK = '';
  function objOn() { try { var c = String(store('ew_cab') || ''); return !!c && lstore('ew_obj_for') === c; } catch (e) { return false; } }
  function objCheck() {
    var c = ''; try { c = String(store('ew_cab') || ''); } catch (e) {}
    if (!c || OB_ASK === c) return; OB_ASK = c;
    callTo('/objekty', { action: 'ping' }).then(function (r) {
      if (!r || r.error === TX('нет связи')) { OB_ASK = ''; return; }
      if (r.error === 'as') return; // админ в чужом кабинете: ответа сервера нет, плитку не включаем
      var on = r.error !== 'нет доступа', was = objOn();
      try { lstore('ew_obj_for', on ? c : null); } catch (e) {}
      if (on !== was) applyHome();
    });
  }
  var OB_HD = 'display:flex;align-items:center;gap:10px;margin-bottom:8px', OB_H2 = 'margin:0;font-size:18px;line-height:1.2;flex:1;min-width:0;word-break:break-word';
  function objBack() { return ui('Назад', 'Бозгашт', 'Orqaga'); }
  function objTitle() { return ui('Финансист по объектам', 'Молиячӣ аз рӯи объектҳо', 'Obyektlar boʻyicha moliyachi'); }
  function objStat(k) {
    return k === 'master' ? ui('Мастера', 'Устоҳо', 'Ustalar') : k === 'material' ? ui('Материалы', 'Масолеҳ', 'Materiallar') : k === 'doroga' ? ui('Дорога', 'Роҳ', 'Yoʻl') : k === 'tehnika' ? ui('Техника', 'Техника', 'Texnika') : ui('Прочее', 'Дигар', 'Boshqa');
  }
  function objBtn(k, text, sec, style) { return '<button type="button" class="btn' + (sec ? ' sec' : '') + '" data-obj="' + esc(k) + '"' + (OB.busy ? ' disabled' : '') + (style ? ' style="' + style + '"' : '') + '>' + text + '</button>'; }
  function objRow(label, val, color) { return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.2)"><span>' + esc(label) + '</span><b style="white-space:nowrap' + (color ? ';color:' + color : '') + '">' + val + '</b></div>'; }
  function objStatBox(label, val, color) { return '<div style="flex:1;min-width:90px;border:1px solid var(--line,#ddd);border-radius:12px;padding:8px 6px;text-align:center"><small style="opacity:.75">' + esc(label) + '</small><div style="font-size:19px;font-weight:700;color:' + color + '">' + val + '</div></div>'; }
  function objIn(id, label, attrs, val) { return '<label style="display:grid;gap:4px"><small>' + esc(label) + '</small><input class="in2" id="' + id + '" ' + attrs + ' autocomplete="off" value="' + esc(val == null ? '' : val) + '"></label>'; }
  function objSel(id, label, opts, val) { return '<label style="display:grid;gap:4px"><small>' + esc(label) + '</small><select class="in2" id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
  function objPoints() { return OB.data ? OB.data.points : []; }
  function openObj() { S.view = 'obj'; OB.mat = null; OB.trash = null; OB.ph = null; OB.foto = ''; OB.fbusy = false; OB.rep = false; OB.lich = null; OB.debts = null; OB.cur = null; OB.sec = null; OB.form = null; OB.err = ''; OB.msg = ''; OB.delAsk = null; objLoad(); render(); }
  function objLoad() {
    OB.busy = true;
    callTo('/objekty', { action: 'list' }).then(function (r) {
      OB.busy = false; if (S.view !== 'obj') return;
      if (!r || !r.ok) { OB.err = (r && r.error) || TX('не удалось загрузить'); return render(); }
      OB.data = r; if (OB.cur) objOpenPoint(OB.cur.name, true); else render();
    });
  }
  function objOpenPoint(name, quiet) {
    if (!quiet) { OB.sec = null; OB.rep = false; }
    OB.cur = { name: name, loading: !quiet }; OB.form = null; OB.err = ''; OB.delAsk = null; if (!quiet) render();
    callTo('/objekty', { action: 'point', name: name }).then(function (r) {
      if (S.view !== 'obj' || !OB.cur || OB.cur.name !== name) return;
      if (!r || !r.ok) { OB.cur = { name: name, error: (r && r.error) || TX('не удалось загрузить') }; return render(); }
      OB.cur = r.point; render();
    });
  }
  // Номер записи (oid) держим до удачного ответа: при обрыве связи повтор не создаёт вторую запись.
  function objAct(body, okMsg, onOk) {
    if (OB.busy) return;
    var key = JSON.stringify(body), ed = OB.edit && (body.action === 'in' || body.action === 'out' || body.action === 'lich_add') ? OB.edit : null;
    if (ed) { key += '|ed:' + ed.oid; okMsg = ui('Запись исправлена', 'Сабт ислоҳ шуд', 'Yozuv tuzatildi'); }
    body.oid = OB.pending[key] || (OB.pending[key] = oid());
    var send = function () {
      callTo('/objekty', body).then(function (r) {
        if (!r || !r.ok) { OB.busy = false; OB.err = (r && r.error) || TX('не записано, повторите'); return render(); }
        var fin = function (verr) {
          OB.busy = false; delete OB.pending[key]; OB.form = null; OB.keep = {}; OB.split = false; OB.foto = ''; OB.fbusy = false; OB.edit = null; OB.msg = okMsg || ''; if (onOk) onOk();
          if (verr) { OB.msg = ''; OB.err = ui('Новая запись сохранена, но старую отменить не удалось. Отмените старую кнопкой ✕.', 'Сабти нав захира шуд, аммо сабти кӯҳнаро бекор карда натавонистем. Онро бо ✕ бекор кунед.', 'Yangi yozuv saqlandi, lekin eskisini bekor qilib boʻlmadi. Eskisini ✕ bilan bekor qiling.'); }
          if (OB.lich) lichLoad(); else objLoad(); render();
        };
        if (!ed) return fin(false);
        callTo('/objekty', { action: 'void', target: ed.oid, oid: ed.vo }).then(function (v) { fin(!v || !v.ok); }, function () { fin(true); });
      });
    };
    OB.busy = true; OB.err = ''; OB.msg = ''; render();
    // Фото чека: сначала сохраняем фото под номером записи, потом саму запись с пометкой «есть фото»
    if (OB.foto && (body.action === 'in' || body.action === 'out')) {
      fbCall({ action: 'save', name: 'chek:' + body.oid, foto: OB.foto }).then(function (r) {
        if (!r || !r.ok) { OB.busy = false; OB.err = ui('Не удалось сохранить фото, повторите', 'Акс захира нашуд, боз кӯшиш кунед', 'Rasm saqlanmadi, qayta urinib koʻring'); return render(); }
        body.foto = 1; send();
      });
    } else send();
  }
  function objVal(id) { var x = $s(id); return x ? String(x.value || '').trim() : ''; }
  function objParts() {
    var parts = [];
    objPoints().forEach(function (p, i) { var v = objVal('ob-part-' + i); if (v !== '' && Number(v.replace(',', '.')) > 0) parts.push({ tochka: p.name, amount: v }); });
    return parts;
  }
  function objPointOpts(withNone) {
    var o = objPoints().map(function (p) { return [p.name, p.name]; });
    if (withNone) o.unshift(['', ui('Не распределено (точка неизвестна)', 'Тақсим нашуда (нуқта номаълум)', 'Taqsimlanmagan (nuqta nomaʼlum)')]);
    return o;
  }
  var OB_ED = 'flex:1;min-width:0;background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;text-align:left;cursor:pointer';
  function OB_EDHINT() { return '<small style="display:block;opacity:.65;margin:2px 0 4px">' + esc(ui('Чтобы исправить запись, нажмите на неё два раза.', 'Барои ислоҳ, ба сабт ду бор зер кунед.', 'Yozuvni tuzatish uchun ustiga ikki marta bosing.')) + '</small>'; }
  // Исправление записи: открываем форму с прежними данными; при «Записать» сохраняется новая запись, а старая отменяется (void).
  function objEditOpen(id) {
    var e = null, list = OB.lich ? (OB.lich.entries || []) : ((OB.cur && OB.cur.entries) || []);
    list.forEach(function (x) { if (x.oid === id) e = x; });
    if (!e || OB.busy) return;
    OB.edit = { oid: id, vo: oid() }; OB.err = ''; OB.msg = ''; OB.delAsk = null; OB.foto = ''; OB.fbusy = false; OB.split = false; OB.pre = {};
    if (OB.lich) {
      var inn = e.kind === 'in', arr = inn ? LC_IN : LC_OUT, lc = lcFind(e.komment), ci = '', rest = String(e.komment || '');
      if (lc) { ci = String(arr.indexOf(lc)); if (ci === '-1') ci = ''; rest = String(e.komment).slice(lc[0].length + 1).split(' · ').slice(1).join(' · '); }
      OB.form = inn ? 'lich_in' : 'lich_out'; OB.keep = { sum: String(e.summa), note: rest, date: e.data || today(), cat: ci };
    } else {
      OB.form = 'sec'; OB.keep = { sum: String(e.summa), note: OB.sec === 'master' ? (e.master || e.komment || '') : (e.komment || ''), date: e.data || today() };
      if (e.foto) {
        OB.fbusy = true;
        fbCall({ action: 'get', name: 'chek:' + id }).then(function (r) { if (!OB.edit || OB.edit.oid !== id) return; OB.fbusy = false; if (r && r.ok && r.foto) OB.foto = r.foto; render(); });
      }
    }
    render(); var z = $s('ob-sum'); if (z) z.focus();
  }
  function objEntries(list, showPoint) {
    if (!list || !list.length) return '<p style="opacity:.75">' + esc(ui('Записей пока нет.', 'Ҳоло сабт нест.', 'Hali yozuv yoʻq.')) + '</p>';
    return list.map(function (e) {
      var inn = e.tip === 'prihod', ask = OB.delAsk === e.oid;
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.2)"><span style="flex:1;min-width:0"><b style="color:' + (inn ? '#1f8a4c' : '#c0392b') + '">' + (inn ? '+' : '−') + pkMoney(e.summa) + '</b> · ' + esc(inn ? ui('от заказчика', 'аз фармоишгар', 'buyurtmachidan') : objStat(e.statya) + (e.master ? ': ' + e.master : '')) +
        (showPoint ? ' · ' + esc(e.tochka || ui('не распределено', 'тақсим нашуда', 'taqsimlanmagan')) : '') + '<br><small style="opacity:.7">' + esc(e.data) + (e.komment ? ' · ' + esc(e.komment) : '') + '</small></span>' +
        (!showPoint || e.tochka ? objBtn('void:' + e.oid, ask ? esc(ui('Точно отменить?', 'Бекор кунам?', 'Bekor qilaymi?')) : '✕', true, 'flex:none;height:32px;padding:0 10px;font-size:13px' + (ask ? ';color:#c0392b' : '')) : objBtn('assign:' + e.oid, esc(ui('Разнести по точкам', 'Ба нуқтаҳо тақсим', 'Nuqtalarga boʻlish')), true, 'flex:none;height:32px;padding:0 10px;font-size:13px')) + '</div>';
    }).join('');
  }
  // Личные расходы Асрора: значки-категории. Значок и название пишутся в начало комментария («⛽ Заправка · текст»), сервер менять не нужно.
  var LC_OUT = [['⛽', 'Заправка', 'Ёқилғӣ', 'Yoqilgʻi'], ['💊', 'Лекарства', 'Дору', 'Dori'], ['🛒', 'Продукты', 'Хӯрокворӣ', 'Oziq-ovqat'], ['🍴', 'Кафе', 'Қаҳвахона', 'Kafe'], ['🚕', 'Дорога', 'Роҳ', 'Yoʻl'], ['📱', 'Связь', 'Алоқа', 'Aloqa'], ['👕', 'Одежда', 'Либос', 'Kiyim'], ['🏠', 'Дом', 'Хона', 'Uy'], ['🎁', 'Подарки', 'Тӯҳфа', 'Sovgʻa'], ['📦', 'Другое', 'Дигар', 'Boshqa']];
  var LC_IN = [['💼', 'Зарплата', 'Маош', 'Maosh'], ['🤝', 'От клиента', 'Аз фармоишгар', 'Mijozdan'], ['💰', 'Другое', 'Дигар', 'Boshqa']];
  function lcName(c) { return ui(c[1], c[2], c[3]); }
  function lcFind(t) { var all = LC_OUT.concat(LC_IN); t = String(t || ''); for (var i = 0; i < all.length; i++) if (t.indexOf(all[i][0] + ' ') === 0) return all[i]; return null; }
  function objForm() {
    var f = OB.form, p = OB.pre || {}; if (!f) return '';
    var h = '<div style="border:1px solid var(--line,#ddd);border-radius:14px;padding:12px;margin:10px 0;display:grid;gap:8px">' + (OB.edit ? '<b style="color:#B26A00">✏️ ' + esc(ui('Исправление записи', 'Ислоҳи сабт', 'Yozuvni tuzatish')) + '</b>' : '');
    if (f === 'point') {
      h += '<b>' + esc(ui('Новая точка (объект)', 'Нуқтаи нав (объект)', 'Yangi nuqta (obyekt)')) + '</b>' + objIn('ob-name', ui('Название', 'Ном', 'Nomi'), 'maxlength="60" placeholder="' + esc(ui('Дом в Рудаки', 'Хона дар Рӯдакӣ', 'Rudakidagi uy')) + '"') +
        objIn('ob-zak', ui('Заказчик (по желанию)', 'Фармоишгар (ихтиёрӣ)', 'Buyurtmachi (ixtiyoriy)'), 'maxlength="60"') + objIn('ob-dog', ui('Сумма договора, сомони (если есть)', 'Маблағи шартнома, сомонӣ (агар бошад)', 'Shartnoma summasi, somoni (boʻlsa)'), 'inputmode="decimal" maxlength="12"');
    } else if (f === 'lich_in' || f === 'lich_out') {
      var li = f === 'lich_in';
      h += '<b style="color:' + (li ? '#1f8a4c' : '#c0392b') + '">' + (li ? '+ ' + esc(ui('Приход', 'Даромад', 'Kirim')) : '− ' + esc(ui('Расход', 'Хароҷот', 'Chiqim'))) + '</b>' +
        '<small style="opacity:.75">' + esc(ui('Нажмите значок', 'Нишонро пахш кунед', 'Belgini bosing')) + '</small>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px">' + (li ? LC_IN : LC_OUT).map(function (c, i) {
          var on = String(OB.keep.cat) === String(i);
          return objBtn('cat:' + i, '<span style="font-size:28px;line-height:1">' + c[0] + '</span><small style="font-size:11.5px;line-height:1.1;word-break:break-word">' + esc(lcName(c)) + '</small>', true, 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:auto;min-height:72px;padding:8px 2px;border-radius:14px' + (on ? ';border:2px solid #F5A524;background:#FFF3D6;font-weight:700' : ''));
        }).join('') + '</div>' +
        objIn('ob-sum', ui('Сумма, в сомони', 'Маблағ, сомонӣ', 'Summa, somoni'), 'inputmode="decimal" maxlength="12" placeholder="1000"', OB.keep.sum) + objIn('ob-date', ui('Дата', 'Сана', 'Sana'), 'type="date"', OB.keep.date || today()) +
        objIn('ob-note', ui('Комментарий (по желанию)', 'Эзоҳ (ихтиёрӣ)', 'Izoh (ixtiyoriy)'), 'maxlength="170"', OB.keep.note);
    } else if (f === 'client') {
      h += '<b>' + esc(ui('Новый объект', 'Объекти нав', 'Yangi obyekt')) + '</b>' + objIn('ob-name', ui('Имя клиента', 'Номи фармоишгар', 'Buyurtmachi ismi'), 'maxlength="60"', OB.keep.name);
    } else if (f === 'sec') {
      var sk = OB.sec;
      h += '<b style="color:' + (sk === 'in' ? '#1f8a4c' : '#c0392b') + '">' + (sk === 'in' ? '+ ' : '− ') + esc(objSecName(sk)) + '</b>' + objIn('ob-sum', ui('Сумма, в сомони', 'Маблағ, сомонӣ', 'Summa, somoni'), 'inputmode="decimal" maxlength="12" placeholder="1000"', OB.keep.sum) + objIn('ob-date', ui('Дата', 'Сана', 'Sana'), 'type="date"', OB.keep.date || today()) +
        objIn('ob-note', sk === 'master' ? ui('Имя мастера', 'Номи усто', 'Usta ismi') : sk === 'material' ? ui('Что куплено', 'Чӣ харида шуд', 'Nima sotib olindi') : ui('Комментарий (по желанию)', 'Эзоҳ (ихтиёрӣ)', 'Izoh (ixtiyoriy)'), 'maxlength="200"', OB.keep.note) +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><label class="btn sec" style="position:relative;display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 14px;cursor:pointer">📷 ' + esc(ui('Сфотографировать', 'Акс гирифтан', 'Suratga olish')) + '<input type="file" id="ob-foto-in" accept="image/*" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0"></label>' +
        '<label class="btn sec" style="position:relative;display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 14px;cursor:pointer">🖼️ ' + esc(ui('Из галереи', 'Аз галерея', 'Galereyadan')) + '<input type="file" id="ob-foto-gal" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0"></label>' +
        (OB.fbusy ? '<small>' + esc(ui('Обработка фото…', 'Акс коркард шуда истодааст…', 'Rasm qayta ishlanmoqda…')) + '</small>' : OB.foto ? '<small style="color:#1f8a4c">✓ ' + esc(ui('Фото добавлено', 'Акс илова шуд', 'Rasm qoʻshildi')) + '</small>' + objBtn('foto-off', '✕', true, 'height:34px;padding:0 10px;font-size:13px') : '') + '</div>' +
        (obMicOk() ? objBtn('mic', (OB.mic ? '⏹ ' + esc(ui('Слушаю… нажмите, когда закончите', 'Гӯш мекунам… пахш кунед', 'Tinglayapman… tugagach bosing')) : '🎤 ' + esc(ui('Сказать голосом', 'Бо овоз гуфтан', 'Ovoz bilan aytish'))), true, 'height:44px') : '');
    } else if (f === 'in') {
      h += '<b style="color:#1f8a4c">' + esc(ui('Деньги пришли от заказчика', 'Пул аз фармоишгар омад', 'Buyurtmachidan pul keldi')) + '</b>' + objSel('ob-pt', ui('Точка', 'Нуқта', 'Nuqta'), objPointOpts(false), p.tochka) +
        objIn('ob-sum', ui('Сколько, в сомони', 'Чӣ қадар, сомонӣ', 'Qancha, somoni'), 'inputmode="decimal" maxlength="12" placeholder="5000"') + objIn('ob-note', ui('Заметка (по желанию)', 'Эзоҳ (ихтиёрӣ)', 'Izoh (ixtiyoriy)'), 'maxlength="200"') + objIn('ob-date', ui('Дата', 'Сана', 'Sana'), 'type="date"', today());
    } else if (f === 'out') {
      var st = p.statya || 'material';
      h += '<b style="color:#c0392b">' + esc(ui('Деньги ушли', 'Пул рафт', 'Pul ketdi')) + '</b>' + objSel('ob-st', ui('На что', 'Ба чӣ', 'Nimaga'), ['material', 'master', 'doroga', 'tehnika', 'prochee'].map(function (k) { return [k, objStat(k)]; }), st) +
        objIn('ob-master', ui('Мастер (если платите мастеру)', 'Усто (агар ба усто диҳед)', 'Usta (ustaga toʻlasangiz)'), 'maxlength="60"', p.master) +
        objIn('ob-sum', ui('Сколько, в сомони', 'Чӣ қадар, сомонӣ', 'Qancha, somoni'), 'inputmode="decimal" maxlength="12" placeholder="1200"') +
        (OB.split ? '<small>' + esc(ui('Разделите сумму по точкам:', 'Маблағро ба нуқтаҳо тақсим кунед:', 'Summani nuqtalarga boʻling:')) + '</small>' + objPoints().map(function (q, i) { return objIn('ob-part-' + i, q.name, 'inputmode="decimal" maxlength="12"'); }).join('') : objSel('ob-pt', ui('Точка', 'Нуқта', 'Nuqta'), objPointOpts(true), p.tochka || '')) +
        (objPoints().length > 1 ? objBtn('split', esc(OB.split ? ui('Одна точка', 'Як нуқта', 'Bitta nuqta') : ui('Разделить между точками', 'Байни нуқтаҳо тақсим кардан', 'Nuqtalar orasida boʻlish')), true, 'height:36px;font-size:14px') : '') +
        objIn('ob-note', ui('Заметка: что купили, где (по желанию)', 'Эзоҳ: чӣ харидед, дар куҷо (ихтиёрӣ)', 'Izoh: nima, qayerda (ixtiyoriy)'), 'maxlength="200"') + objIn('ob-date', ui('Дата', 'Сана', 'Sana'), 'type="date"', today());
    } else if (f === 'assign') {
      h += '<b>' + esc(ui('Разнести расход по точкам', 'Хароҷотро ба нуқтаҳо тақсим кардан', 'Xarajatni nuqtalarga boʻlish')) + ' (' + pkMoney(p.summa) + ')</b><small>' + esc(ui('Сумма по точкам должна сойтись с расходом.', 'Ҷамъи нуқтаҳо бояд бо хароҷот баробар бошад.', 'Nuqtalar yigʻindisi xarajatga teng boʻlsin.')) + '</small>' +
        objPoints().map(function (q, i) { return objIn('ob-part-' + i, q.name, 'inputmode="decimal" maxlength="12"'); }).join('');
    } else if (f === 'master') {
      h += '<b>' + esc(ui('Договорённость с мастером', 'Созиш бо усто', 'Usta bilan kelishuv')) + '</b>' + objIn('ob-master', ui('Мастер', 'Усто', 'Usta'), 'maxlength="60"', p.master) + objIn('ob-sum', ui('Сколько за всю работу, сомони', 'Барои тамоми кор, сомонӣ', 'Butun ish uchun, somoni'), 'inputmode="decimal" maxlength="12"', p.dogovor);
    } else if (f === 'rename') {
      h += '<b>' + esc(ui('Изменить имя объекта', 'Номи объектро иваз кардан', 'Obyekt nomini oʻzgartirish')) + '</b>' + objIn('ob-name', ui('Новое имя', 'Номи нав', 'Yangi ism'), 'maxlength="60"', OB.keep.name != null ? OB.keep.name : (OB.cur && OB.cur.name));
    } else if (f === 'dogovor') {
      h += '<b>' + esc(ui('Договор с заказчиком', 'Шартнома бо фармоишгар', 'Buyurtmachi bilan shartnoma')) + '</b>' + objIn('ob-sum', ui('Общая сумма договора, сомони', 'Маблағи умумии шартнома, сомонӣ', 'Shartnomaning umumiy summasi, somoni'), 'inputmode="decimal" maxlength="12"', p.dogovor);
    }
    h += '<div style="display:flex;gap:8px;margin-top:4px">' + objBtn('save', esc(TX('Записать')), false, 'flex:1;height:46px') + objBtn('cancel', esc(ui('Отмена', 'Бекор', 'Bekor')), true, 'height:46px') + '</div></div>';
    return h;
  }
  function objSave() {
    var f = OB.form, p = OB.pre || {};
    if (f === 'point') return objAct({ action: 'add_point', name: objVal('ob-name'), zakazchik: objVal('ob-zak'), dogovor: objVal('ob-dog') }, ui('Точка добавлена', 'Нуқта илова шуд', 'Nuqta qoʻshildi'));
    if (f === 'client') { var cn = objVal('ob-name'); OB.keep = { name: cn }; return objAct({ action: 'add_point', name: cn, zakazchik: cn }, ui('Объект добавлен', 'Объект илова шуд', 'Obyekt qoʻshildi')); }
    if (f === 'lich_in' || f === 'lich_out') {
      var ls = objVal('ob-sum'), ln = objVal('ob-note'), ld = objVal('ob-date'), lc = OB.keep ? OB.keep.cat : '', lcd = (f === 'lich_in' ? LC_IN : LC_OUT)[Number(lc)]; OB.keep = { sum: ls, note: ln, date: ld, cat: lc };
      var lfull = lcd && lc !== '' && lc != null ? lcd[0] + ' ' + lcd[1] + (ln ? ' · ' + ln : '') : ln;
      return objAct({ action: 'lich_add', kind: f === 'lich_in' ? 'in' : 'out', amount: ls, note: lfull, date: ld }, ui('Записано', 'Сабт шуд', 'Yozildi'));
    }
    if (f === 'sec') {
      var sk = OB.sec, sm = objVal('ob-sum'), nt = objVal('ob-note'), dt = objVal('ob-date'); OB.keep = { sum: sm, note: nt, date: dt };
      if (sk === 'master' && !nt) { OB.err = ui('Впишите имя мастера', 'Номи усторо нависед', 'Usta ismini yozing'); return render(); }
      if (sk === 'in') return objAct({ action: 'in', tochka: OB.cur.name, amount: sm, note: nt, date: dt }, ui('Аванс записан', 'Пешпардохт сабт шуд', 'Avans yozildi'));
      return objAct({ action: 'out', tochka: OB.cur.name, statya: sk, master: sk === 'master' ? nt : '', amount: sm, note: sk === 'master' ? '' : nt, date: dt }, ui('Расход записан', 'Хароҷот сабт шуд', 'Xarajat yozildi'));
    }
    if (f === 'in') return objAct({ action: 'in', tochka: objVal('ob-pt'), amount: objVal('ob-sum'), note: objVal('ob-note'), date: objVal('ob-date') }, ui('Приход записан', 'Даромад сабт шуд', 'Kirim yozildi'));
    if (f === 'out') {
      var b = { action: 'out', statya: objVal('ob-st'), master: objVal('ob-master'), note: objVal('ob-note'), date: objVal('ob-date') };
      if (OB.split) { b.parts = objParts(); if (!b.parts.length) { OB.err = ui('Впишите суммы по точкам', 'Маблағҳоро аз рӯи нуқтаҳо нависед', 'Nuqtalar boʻyicha summalarni yozing'); return render(); } } else { b.tochka = objVal('ob-pt'); b.amount = objVal('ob-sum'); }
      return objAct(b, ui('Расход записан', 'Хароҷот сабт шуд', 'Xarajat yozildi'));
    }
    if (f === 'assign') return objAct({ action: 'assign', target: p.target, parts: objParts() }, ui('Разнесено по точкам', 'Ба нуқтаҳо тақсим шуд', 'Nuqtalarga boʻlindi'));
    if (f === 'master') return objAct({ action: 'master_set', tochka: OB.cur.name, master: objVal('ob-master'), amount: objVal('ob-sum') }, ui('Записано', 'Сабт шуд', 'Yozildi'));
    if (f === 'rename') {
      var nn = objVal('ob-name'), old = OB.cur.name; OB.keep = { name: nn };
      if (nn === old) { OB.err = ui('Имя не изменилось', 'Ном иваз нашуд', 'Ism oʻzgarmadi'); return render(); }
      return objAct({ action: 'rename', tochka: old, name: nn }, ui('Имя изменено', 'Ном иваз шуд', 'Ism oʻzgartirildi'), function () { OB.cur = { name: nn, loading: true }; });
    }
    if (f === 'dogovor') return objAct({ action: 'dogovor', tochka: OB.cur.name, amount: objVal('ob-sum') }, ui('Записано', 'Сабт шуд', 'Yozildi'));
  }
  function objClick(k) {
    if (k === 'back' && OB.mat) { if (OB.mat.busy || OB.mat.scan) return; OB.mat = null; return render(); }
    if (k === 'mat-open') { OB.mat = { rows: [matBlank(), matBlank(), matBlank()], date: today(), err: '', busy: false, scan: false, batch: '' }; OB.form = null; OB.err = ''; OB.msg = ''; return render(); }
    if (k === 'mat-add' && OB.mat) { OB.mat.rows.push(matBlank()); render(); var ni = $s('mt-n-' + (OB.mat.rows.length - 1)); if (ni) ni.focus(); return; }
    if (k.indexOf('mat-del:') === 0 && OB.mat) { var di = Number(k.slice(8)); OB.mat.rows.splice(di, 1); if (!OB.mat.rows.length) OB.mat.rows.push(matBlank()); return render(); }
    if (k === 'mat-save') return matSave();
    if (k === 'mat-clear' && OB.mat) { OB.mat.rows = [matBlank(), matBlank(), matBlank()]; OB.mat.err = ''; return render(); }
    if (k === 'back') { if (OB.ph) OB.ph = null; else if (OB.rep) OB.rep = false; else if (OB.trash) OB.trash = null; else if (OB.debts) OB.debts = null; else if (OB.lich) OB.lich = null; else if (OB.cur && OB.sec) OB.sec = null; else OB.cur = null; OB.edit = null; OB.form = null; OB.err = ''; OB.msg = ''; OB.delAsk = null; return render(); }
    if (k.indexOf('sec:') === 0) { OB.sec = k.slice(4); OB.form = null; OB.err = ''; OB.msg = ''; OB.delAsk = null; return render(); }
    if (k === 'trash-open') return openTrash();
    if (k === 'trash') {
      if (!OB.cur) return;
      if (OB.delAsk !== 'pt-trash') { OB.delAsk = 'pt-trash'; return render(); }
      var tn = OB.cur.name; OB.delAsk = null;
      return objAct({ action: 'trash_point', tochka: tn }, ui('Объект «' + tn + '» перемещён в корзину', 'Объекти «' + tn + '» ба сабад гузошта шуд', '«' + tn + '» obyekti savatga solindi'), function () { OB.cur = null; OB.sec = null; OB.rep = false; OB.form = null; });
    }
    if (k.indexOf('restore:') === 0) return objAct({ action: 'restore_point', tochka: k.slice(8) }, ui('Объект возвращён', 'Объект баргардонида шуд', 'Obyekt qaytarildi'), function () { OB.trash = { loading: true }; trashLoad(); });
    if (k.indexOf('purge:') === 0) {
      if (OB.delAsk !== k) { OB.delAsk = k; return render(); }
      OB.delAsk = null;
      return objAct({ action: 'purge_point', tochka: k.slice(6) }, ui('Объект удалён навсегда', 'Объект якбора нест карда шуд', 'Obyekt butunlay oʻchirildi'), function () { OB.trash = { loading: true }; trashLoad(); });
    }
    if (k === 'lich') return openLich();
    if (k === 'debts') return openDebts();
    if (k.indexOf('ed:') === 0) { var ei = k.slice(3), et = Date.now(); if (OB.edTap && OB.edTap.id === ei && et - OB.edTap.t < 600) { OB.edTap = null; return objEditOpen(ei); } OB.edTap = { id: ei, t: et }; return; }
    if (k === 'rn-tap') { var tn = Date.now(); if (OB.tapT && tn - OB.tapT < 600) { OB.tapT = 0; return objClick('f:rename'); } OB.tapT = tn; return; }
    if (k === 'rep') { OB.rep = true; OB.err = ''; OB.msg = ''; return render(); }
    if (k === 'xls') { return objXls(); }
    if (k === 'copy') { return objCopy(); }
    if (k === 'share') { return objShare(); }
    if (k === 'reload') return objLoad();
    if (k === 'cancel') { OB.edit = null; OB.form = null; OB.split = false; OB.foto = ''; OB.fbusy = false; OB.err = ''; return render(); }
    if (k === 'foto-off') { OB.foto = ''; objKeepForm(); return render(); }
    if (k.indexOf('cat:') === 0) { objKeepForm(); var ci = k.slice(4); OB.keep.cat = String(OB.keep.cat) === ci ? '' : ci; render(); var cz = $s('ob-sum'); if (cz) cz.focus(); return; }
    if (k === 'mic') return obMic('sec');
    if (k === 'mic-obj') return obMic('obj');
    if (k.indexOf('ph:') === 0) return objPhoto(k.slice(3));
    if (k === 'save') return objSave();
    if (k === 'split') { OB.split = !OB.split; return render(); }
    if (k.indexOf('pt:') === 0) return objOpenPoint(k.slice(3));
    if (k.indexOf('void:') === 0) { var id = k.slice(5); if (OB.delAsk !== id) { OB.delAsk = id; return render(); } OB.delAsk = null; return objAct({ action: 'void', target: id }, ui('Запись отменена', 'Сабт бекор шуд', 'Yozuv bekor qilindi')); }
    if (k.indexOf('assign:') === 0) { var t = k.slice(7), e = null; (OB.data.unassigned || []).forEach(function (x) { if (x.oid === t) e = x; }); if (!e) return; OB.form = 'assign'; OB.pre = { target: t, summa: e.summa }; OB.err = ''; return render(); }
    if (k.indexOf('f:') === 0) { var f = k.slice(2); OB.edit = null; OB.form = f; OB.keep = {}; OB.foto = ''; OB.fbusy = false; OB.split = false; OB.err = ''; OB.msg = ''; OB.pre = OB.cur && OB.cur.name ? { tochka: OB.cur.name, dogovor: OB.cur.dogovor } : {}; render(); var x = $s(f === 'point' || f === 'client' ? 'ob-name' : 'ob-sum'); if (x) x.focus(); return; }
    if (k.indexOf('fm:') === 0) { var mn = k.slice(3), md = null; (OB.cur.masters || []).forEach(function (m) { if (m.name === mn) md = m; }); OB.form = 'master'; OB.pre = { master: mn, dogovor: md && md.dogovor != null ? md.dogovor : '' }; OB.err = ''; return render(); }
    if (k.indexOf('pay:') === 0) { OB.form = 'out'; OB.split = false; OB.pre = { tochka: OB.cur.name, statya: 'master', master: k.slice(4) }; OB.err = ''; render(); var y = $s('ob-sum'); if (y) y.focus(); return; }
  }
  function objMsgs() { return (OB.err ? '<p role="alert" style="color:#c0392b;margin:8px 0">' + esc(OB.err) + '</p>' : '') + (OB.msg ? '<p role="status" style="color:#1f8a4c;margin:8px 0">' + esc(OB.msg) + '</p>' : ''); }
  // Стартовых объектов (кнопок-клиентов) шесть; пустые места называются при первом нажатии, дальше кнопка «+».
  var OB_SLOTS = 6;
  function objSecName(k) { return k === 'in' ? ui('Аванс', 'Пешпардохт', 'Avans') : k === 'master' ? ui('Мастера', 'Устоҳо', 'Ustalar') : ui('Материалы', 'Масолеҳ', 'Materiallar'); }
  function objSecIcon(k) { return k === 'in' ? '💵' : k === 'master' ? '👷' : '🧱'; }
  function objSecSum(p, k) { return k === 'in' ? Number(p.inn) || 0 : Number((p.by || {})[k]) || 0; }

  /* ---------- Таблица покупок в «Материалы» (10.11.2026, кабинет Асрора Холова) ----------
     Строки: что купил, количество, цена, сумма. Сумма строки = количество × цена (можно вписать свою). Внизу — итог и пояснение «что за что».
     «Записать» кладёт каждую строку отдельной записью расхода «Материалы» (итог раздела считается сам).
     Фото чека, накладной или рукописного списка читает ИИ (вебхук materialy-foto) и заполняет таблицу — строки можно поправить. */
  function matBlank() { return { name: '', qty: '', unit: '', price: '', sum: '', manual: false }; }
  function matNum(x) { var t = String(x == null ? '' : x).replace(',', '.').replace(/\s/g, ''); if (t === '') return NaN; var n = Number(t); return isFinite(n) ? n : NaN; }
  function matRowSum(r) { var s2 = matNum(r.sum); if (r.manual && !isNaN(s2)) return s2; var q = matNum(r.qty), pr = matNum(r.price); if (!isNaN(q) && !isNaN(pr)) return Math.round(q * pr * 100) / 100; return isNaN(s2) ? 0 : s2; }
  function matTotal() { return OB.mat.rows.reduce(function (a, r) { return a + (matRowSum(r) > 0 ? matRowSum(r) : 0); }, 0); }
  function matNote(r) { var q = matNum(r.qty), pr = matNum(r.price), nm = String(r.name || '').trim() || ui('Без названия', 'Бе ном', 'Nomsiz'); return (nm + (!isNaN(q) ? ' · ' + String(r.qty).trim() + (r.unit ? ' ' + r.unit : '') + (!isNaN(pr) ? ' × ' + String(r.price).trim() : '') : '')).slice(0, 200); }
  function matExplain() { var a = []; OB.mat.rows.forEach(function (r) { var v = matRowSum(r); if (v > 0) a.push((String(r.name || '').trim() || ui('Без названия', 'Бе ном', 'Nomsiz')) + ' ' + pkMoney(v)); }); return a.join(' · '); }
  function matCount() { return OB.mat.rows.filter(function (r) { return matRowSum(r) > 0; }).length; }
  function matView() {
    var M = OB.mat, h = '', cell = 'width:100%;min-width:0;box-sizing:border-box;padding:8px 6px;font-size:15px', grid = 'display:grid;grid-template-columns:minmax(0,1fr) 54px 64px 78px 30px;gap:4px;align-items:center';
    h += '<div style="margin:8px 0"><b>📋 ' + esc(ui('Таблица покупок', 'Ҷадвали харидҳо', 'Xaridlar jadvali')) + '</b><br><small style="opacity:.75">' + esc(ui('Впишите, что купили. Сумма строки считается сама (кол-во × цена) — можно вписать свою. Или сфотографируйте чек или список.', 'Чиро харидаед, нависед. Маблағи сатр худаш ҳисоб мешавад (миқдор × нарх). Ё чек ё рӯйхатро суратгирӣ кунед.', 'Nima sotib olganingizni yozing. Qator summasi oʻzi hisoblanadi (miqdor × narx). Yoki chek yoki roʻyxatni suratga oling.')) + '</small></div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">' +
      '<label class="btn sec" style="position:relative;display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 14px;cursor:pointer">📷 ' + esc(ui('Фото чека / списка', 'Акси чек / рӯйхат', 'Chek / roʻyxat surati')) + '<input type="file" id="mt-foto-in" accept="image/*" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0"></label>' +
      '<label class="btn sec" style="position:relative;display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 14px;cursor:pointer">🖼️ ' + esc(ui('Из галереи', 'Аз галерея', 'Galereyadan')) + '<input type="file" id="mt-foto-gal" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0"></label></div>';
    if (M.scan) h += '<p role="status" style="margin:8px 0;color:#1f8a4c">⏳ ' + esc(ui('Читаю фото… это может занять до минуты', 'Акс хонда истодааст… то як дақиқа мумкин', 'Rasm oʻqilmoqda… bir daqiqagacha vaqt ketishi mumkin')) + '</p>';
    h += (M.err ? '<p role="alert" style="color:#c0392b;margin:8px 0">' + esc(M.err) + '</p>' : '');
    h += objMsgs();
    var ln = '1px solid rgba(128,128,128,.5)', cols = '28px minmax(0,1fr) 52px 62px 76px 30px';
    var hc = 'box-sizing:border-box;padding:4px 2px;text-align:center;font-size:11px;font-weight:700;background:rgba(128,128,128,.2);border-right:' + ln + ';border-bottom:' + ln + ';overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
    var xc = 'width:100%;min-width:0;height:36px;box-sizing:border-box;padding:0 5px;font-size:15px;border:0;border-radius:0;background:transparent;color:inherit;outline-offset:-2px';
    var rc = 'box-sizing:border-box;border-right:' + ln + ';border-bottom:' + ln + ';min-width:0';
    var nc = 'display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:rgba(128,128,128,.2);border-right:' + ln + ';border-bottom:' + ln;
    h += '<div style="margin:8px 0;border:' + ln + ';border-bottom:0;border-right:0;border-radius:4px;overflow:hidden;background:rgba(128,128,128,.04)">';
    h += '<div style="display:grid;grid-template-columns:' + cols + '"><span style="' + hc + '"></span><span style="' + hc + '">' + esc(ui('Что купил', 'Чӣ харидам', 'Nima sotib oldim')) + '</span><span style="' + hc + '">' + esc(ui('Кол-во', 'Миқдор', 'Miqdor')) + '</span><span style="' + hc + '">' + esc(ui('Цена', 'Нарх', 'Narx')) + '</span><span style="' + hc + '">' + esc(ui('Сумма', 'Маблағ', 'Summa')) + '</span><span style="' + hc + '"></span></div>';
    M.rows.forEach(function (r, i) {
      var sv = r.manual ? r.sum : (matRowSum(r) > 0 ? String(matRowSum(r)) : '');
      h += '<div style="display:grid;grid-template-columns:' + cols + '"><span style="' + nc + '">' + (i + 1) + '</span>' +
        '<span style="' + rc + '"><input id="mt-n-' + i + '" data-mat="' + i + ':name" maxlength="80" autocomplete="off" style="' + xc + '" value="' + esc(r.name) + '"></span>' +
        '<span style="' + rc + '"><input id="mt-q-' + i + '" data-mat="' + i + ':qty" inputmode="decimal" maxlength="9" autocomplete="off" style="' + xc + ';text-align:right" value="' + esc(r.qty) + '"></span>' +
        '<span style="' + rc + '"><input id="mt-p-' + i + '" data-mat="' + i + ':price" inputmode="decimal" maxlength="12" autocomplete="off" style="' + xc + ';text-align:right" value="' + esc(r.price) + '"></span>' +
        '<span style="' + rc + '"><input id="mt-s-' + i + '" data-mat="' + i + ':sum" inputmode="decimal" maxlength="12" autocomplete="off" style="' + xc + ';text-align:right;font-weight:700" value="' + esc(sv) + '"></span>' +
        '<span style="' + rc + ';display:flex"><button type="button" data-obj="mat-del:' + i + '" aria-label="' + esc(ui('Убрать строку', 'Сатрро нест кун', 'Qatorni olib tashlash')) + '" style="width:100%;height:36px;padding:0;border:0;background:transparent;color:inherit;opacity:.6;font-size:14px;cursor:pointer"' + (M.busy ? ' disabled' : '') + '>✕</button></span></div>';
    });
    h += '<div style="display:grid;grid-template-columns:' + cols + '"><span style="' + nc + '"></span><span style="' + hc + ';text-align:right;font-size:13px;padding:8px 6px;grid-column:2 / 5">Σ ' + esc(ui('Итого', 'Ҷамъ', 'Jami')) + '</span><span id="mt-total2" style="' + hc + ';text-align:right;font-size:15px;padding:8px 5px;background:rgba(245,165,36,.25)">' + pkMoney(matTotal()) + '</span><span style="' + hc + '"></span></div>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">' + objBtn('mat-add', '+ ' + esc(ui('Строка', 'Сатр', 'Qator')), true, 'height:40px;padding:0 14px') + objBtn('mat-clear', esc(ui('Очистить', 'Тоза кардан', 'Tozalash')), true, 'height:40px;padding:0 14px') + '</div>';
    h += '<div style="margin:10px 0;padding:12px;border-radius:14px;border:2px solid #F5A524;background:rgba(245,165,36,.10)"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>' + esc(ui('Итого за покупку', 'Ҷамъи харид', 'Xarid jami')) + '</b><b id="mt-total" style="font-size:22px">' + pkMoney(matTotal()) + '</b></div>' +
      '<small id="mt-expl" style="display:block;margin-top:6px;opacity:.8;word-break:break-word">' + esc(matExplain()) + '</small></div>';
    h += objIn('mt-date', ui('Дата покупки', 'Санаи харид', 'Xarid sanasi'), 'type="date"', M.date);
    h += '<div style="display:grid;gap:8px;margin-top:10px">' + objBtn('mat-save', M.busy ? esc(ui('Записываю…', 'Сабт мешавад…', 'Yozilmoqda…')) : '✓ ' + esc(ui('Записать покупку', 'Харидро сабт кардан', 'Xaridni yozish')), false, 'height:50px;font-size:17px') + '</div>';
    return h;
  }
  function matLive(t) {
    var M = OB.mat, m = /^(\d+):(name|qty|price|sum)$/.exec(t.getAttribute('data-mat') || ''); if (!M || !m) return;
    var i = Number(m[1]), f = m[2], r = M.rows[i]; if (!r) return;
    r[f] = t.value;
    if (f === 'sum') r.manual = String(t.value).trim() !== '';
    else if (!r.manual) { var se = $s('mt-s-' + i); if (se) { var v = matRowSum(r); se.value = v > 0 ? String(v) : ''; } }
    var te = $s('mt-total'); if (te) te.textContent = pkMoney(matTotal()); var t2 = $s('mt-total2'); if (t2) t2.textContent = pkMoney(matTotal());
    var xe = $s('mt-expl'); if (xe) xe.textContent = matExplain();
  }
  document.addEventListener('input', function (e) { var t = e.target; if (!t || !t.getAttribute || !OB.mat) return; if (t.id === 'mt-date') { OB.mat.date = t.value; return; } if (t.getAttribute('data-mat')) matLive(t); });
  function matSave() {
    var M = OB.mat; if (!M || M.busy || M.scan) return;
    var rows = M.rows.filter(function (r) { return matRowSum(r) > 0; });
    if (!rows.length) { M.err = ui('Впишите хотя бы одну покупку с суммой', 'Ҳадди ақал як харидро бо маблағ нависед', 'Kamida bitta xaridni summa bilan yozing'); return render(); }
    if (!OB.cur || !OB.cur.name) return;
    if (!M.batch) M.batch = oid();
    var tot = matTotal(), nm = OB.cur.name, i = 0; M.busy = true; M.err = ''; render();
    (function next() {
      if (!OB.mat) return;
      if (i >= rows.length) { OB.mat = null; OB.msg = ui('Покупка записана: ' + rows.length + ' строк, итого ' + pkMoney(tot), 'Харид сабт шуд: ' + rows.length + ' сатр, ҷамъ ' + pkMoney(tot), 'Xarid yozildi: ' + rows.length + ' qator, jami ' + pkMoney(tot)); objLoad(); return render(); }
      var r = rows[i];
      callTo('/objekty', { action: 'out', tochka: nm, statya: 'material', amount: String(matRowSum(r)), note: matNote(r), date: M.date || today(), oid: M.batch + '-' + i }).then(function (x) {
        if (!OB.mat) return;
        if (!x || !x.ok) { M.busy = false; M.err = ((x && x.error) || ui('не записано', 'сабт нашуд', 'yozilmadi')) + ' · ' + ui('Нажмите «Записать» ещё раз — уже записанные строки не задвоятся', 'Боз «Сабт»-ро пахш кунед — сатрҳои сабтшуда такрор намешаванд', '«Yozish»ni yana bosing — yozilgan qatorlar takrorlanmaydi'); return render(); }
        i++; next();
      });
    })();
  }
  function matShrink(file, cb) {
    var rd = new FileReader(); rd.onerror = function () { cb(''); };
    rd.onload = function () {
      var im = new Image(); im.onerror = function () { cb(''); };
      im.onload = function () {
        var k = Math.min(1, 1800 / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), c = document.createElement('canvas'); c.width = w; c.height = h;
        var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        var qs = [0.85, 0.75, 0.65, 0.55];
        for (var i = 0; i < qs.length; i++) { var o = c.toDataURL('image/jpeg', qs[i]); if (o.length <= 2300000) return cb(o); }
        cb('');
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  }
  function matScan(file) {
    var M = OB.mat; if (!M || M.scan || M.busy) return; M.scan = true; M.err = ''; render();
    matShrink(file, function (data) {
      if (!OB.mat) return;
      if (!data) { M.scan = false; M.err = ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'); return render(); }
      callTo('/materialy-foto', { foto: data }).then(function (r) {
        if (!OB.mat) return;
        M.scan = false;
        if (!r || !r.ok || !r.items || !r.items.length) { M.err = ui('Не получилось прочитать фото. Сфотографируйте ближе и ровнее или впишите вручную.', 'Акс хонда нашуд. Наздиктар ва ҳамвортар суратгирӣ кунед ё дастӣ нависед.', 'Rasmni oʻqib boʻlmadi. Yaqinroq va tekisroq suratga oling yoki qoʻlda yozing.'); return render(); }
        var fresh = r.items.map(function (it) {
          var q = it.qty === '' || it.qty == null ? '' : String(it.qty), pr = it.price === '' || it.price == null ? '' : String(it.price), sm = it.sum === '' || it.sum == null ? '' : String(it.sum), row = { name: String(it.name || ''), qty: q, unit: String(it.unit || ''), price: pr, sum: sm, manual: false };
          // сумма строки с чека важнее нашего подсчёта, если количество × цена не сходятся
          if (sm !== '' && (isNaN(matNum(q)) || isNaN(matNum(pr)) || Math.abs(matNum(q) * matNum(pr) - matNum(sm)) > 0.01)) row.manual = true;
          return row;
        });
        var keep = M.rows.filter(function (x) { return String(x.name).trim() || String(x.sum).trim() || String(x.qty).trim() || String(x.price).trim(); });
        M.rows = keep.concat(fresh);
        M.err = '';
        OB.msg = ui('Прочитано строк: ' + fresh.length + '. Проверьте и поправьте, если что-то не так.', 'Сатрҳои хондашуда: ' + fresh.length + '. Санҷед ва агар лозим бошад, ислоҳ кунед.', 'Oʻqilgan qatorlar: ' + fresh.length + '. Tekshiring va kerak boʻlsa tuzating.');
        render();
      });
    });
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || (t.id !== 'mt-foto-in' && t.id !== 'mt-foto-gal') || !t.files || !t.files[0]) return;
    matScan(t.files[0]);
  });
  function objSecEntries(list, k) {
    var rows = (list || []).filter(function (e) { return k === 'in' ? e.tip === 'prihod' : (e.tip === 'rashod' && e.statya === k); });
    if (!rows.length) return '<p style="opacity:.75">' + esc(ui('Записей пока нет.', 'Ҳоло сабт нест.', 'Hali yozuv yoʻq.')) + '</p>';
    return OB_EDHINT() + rows.map(function (e) {
      var ask = OB.delAsk === e.oid, note = k === 'master' ? (e.master || e.komment) : e.komment;
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2)"><button type="button" data-obj="ed:' + esc(e.oid) + '" style="' + OB_ED + '"><b style="color:' + (k === 'in' ? '#1f8a4c' : '#c0392b') + '">' + pkMoney(e.summa) + '</b> · ' + esc(e.data) +
        (note ? '<br><small style="opacity:.8">' + esc(note) + '</small>' : '') + '</button>' +
        (e.foto ? objBtn('ph:' + e.oid, '📷', true, 'flex:none;height:34px;padding:0 10px;font-size:15px') : '') +
        objBtn('void:' + e.oid, ask ? esc(ui('Точно отменить?', 'Бекор кунам?', 'Bekor qilaymi?')) : '✕', true, 'flex:none;height:34px;padding:0 10px;font-size:13px' + (ask ? ';color:#c0392b' : '')) + '</div>';
    }).join('');
  }
  // Сохраняем введённое в форме перед перерисовкой
  function objKeepForm() { OB.keep = { sum: objVal('ob-sum'), note: objVal('ob-note'), date: objVal('ob-date'), cat: OB.keep ? OB.keep.cat : '' }; }
  function objPhoto(id) {
    OB.ph = { oid: id, loading: true }; render();
    fbCall({ action: 'get', name: 'chek:' + id }).then(function (r) {
      if (!OB.ph || OB.ph.oid !== id) return;
      OB.ph = { oid: id, src: r && r.ok ? r.foto || '' : '', err: !(r && r.ok && r.foto) }; render();
    });
  }
  function renderObjPhoto(el) {
    var P = OB.ph, h = '<div style="'+OB_HD+'">' + objBtn('back', '← ' + esc(objBack()), true, 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="'+OB_H2+'">📷 ' + esc(ui('Фото чека', 'Акси чек', 'Chek rasmi')) + '</h2></div>';
    if (P.loading) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    el.innerHTML = h + (P.err ? '<p style="color:#c0392b">' + esc(ui('Фото не найдено', 'Акс ёфт нашуд', 'Rasm topilmadi')) + '</p>' : '<img alt="" src="' + esc(P.src) + '" style="display:block;max-width:100%;height:auto;border-radius:12px;margin:8px 0">');
  }
  // Голос: распознавание речи самого браузера (как в аптеке). Разбираем «материалы цемент 500» и открываем форму уже заполненной: проверить и нажать «Записать».
  var OBM = null;
  function obMicOk() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function obSecOf(t) { return /аванс|получил|пришл|заказчик/.test(t) ? 'in' : /мастер|усто|рабоч|зарплат|оплат/.test(t) ? 'master' : /материал|цемент|купил|покупк|краск|плитк|гвозд|шпаклёв|шпаклев/.test(t) ? 'material' : ''; }
  function obMic(mode) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (OBM) { try { OBM.stop(); } catch (e) {} return; }
    if (mode === 'sec') objKeepForm();
    var rc = new SR(), got = '', done = false; OBM = rc; OB.mic = true; OB.err = ''; OB.msg = '';
    rc.lang = 'ru-RU'; rc.interimResults = false; rc.continuous = false; rc.maxAlternatives = 1;
    rc.onresult = function (e) { got = ''; for (var i = 0; i < e.results.length; i++) got += e.results[i][0].transcript + ' '; };
    rc.onerror = function (e) {
      var er = e && e.error;
      OB.err = er === 'not-allowed' || er === 'service-not-allowed' ? ui('Разрешите микрофон для этого сайта в настройках браузера', 'Микрофонро дар танзимоти браузер иҷозат диҳед', 'Brauzer sozlamalarida mikrofonga ruxsat bering')
        : er === 'no-speech' ? ui('Не услышал голос. Нажмите микрофон и говорите сразу, поближе к телефону.', 'Овоз нашунида шуд. Микрофонро пахш кунед ва фавран гӯед.', 'Ovoz eshitilmadi. Mikrofonni bosing va darhol gapiring.')
        : er === 'audio-capture' ? ui('Микрофон не найден или занят другим приложением', 'Микрофон ёфт нашуд ё банд аст', 'Mikrofon topilmadi yoki band')
        : er === 'network' ? ui('Нет связи с сервисом распознавания речи. Проверьте интернет.', 'Бо хидмати шинохти овоз пайваст нашуд. Интернетро санҷед.', 'Nutqni tanish xizmatiga ulanib boʻlmadi. Internetni tekshiring.')
        : er === 'language-not-supported' ? ui('Этот язык голосом не поддерживается', 'Ин забон бо овоз дастгирӣ намешавад', 'Bu til ovozda qoʻllab-quvvatlanmaydi')
        : ui('Не получилось услышать. Попробуйте ещё раз или впишите вручную.', 'Нашунида шуд. Боз кӯшиш кунед ё дастӣ нависед.', 'Eshitilmadi. Qayta urinib koʻring yoki qoʻlda yozing.');
    };
    rc.onend = function () {
      if (done) return; done = true; OBM = null; OB.mic = false;
      var t = String(got || '').trim(), low = t.toLowerCase();
      if (t) {
        var p = (typeof parseVoice === 'function') ? parseVoice(t) : null, sec = obSecOf(low) || (mode === 'sec' ? OB.sec : ''), guess = false;
        if (p && !sec) { sec = 'material'; guess = true; }
        if (!p) OB.err = ui('Услышал: «' + t + '». Не нашёл сумму. Скажите так: цемент 500', 'Шунидам: «' + t + '». Маблағ ёфт нашуд. Чунин гӯед: семент 500', 'Eshitdim: «' + t + '». Summa topilmadi. Shunday ayting: sement 500');
        else {
          var note = String(p.note || '').replace(/(аванс|получил|получила|пришло|пришли|заказчик\w*|мастер\w*|материал\w*|купил\w*|усто|рабоч\w*|зарплат\w*|оплат\w*)/gi, ' ').replace(/\s+/g, ' ').trim();
          OB.sec = sec; OB.form = 'sec'; OB.foto = ''; OB.fbusy = false; OB.keep = { sum: String(p.amount), note: note, date: today() }; OB.msg = (guess ? ui('Раздел не понял, поставил «Материалы» — если не так, нажмите «Отмена» и выберите раздел. ', 'Бахшро нафаҳмидам, «Масолеҳ» гузоштам — агар нодуруст бошад, «Бекор»-ро пахш кунед ва бахшро интихоб кунед. ', 'Boʻlimni tushunmadim, «Materiallar» qoʻydim — notoʻgʻri boʻlsa, «Bekor»ni bosing va boʻlimni tanlang. ') : '') + ui('Проверьте и нажмите «Записать»: ', 'Санҷед ва «Записать»-ро пахш кунед: ', 'Tekshiring va «Записать»ni bosing: ') + t;
        }
      } else if (!OB.err) OB.err = ui('Ничего не услышал', 'Чизе нашунидам', 'Hech narsa eshitmadim');
      render();
    };
    try { rc.start(); } catch (e) { OBM = null; OB.mic = false; }
    render();
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || (t.id !== 'ob-foto-in' && t.id !== 'ob-foto-gal') || !t.files || !t.files[0]) return;
    var fl = t.files[0]; objKeepForm(); OB.fbusy = true; OB.foto = ''; OB.err = ''; render();
    shFotoHQ(fl, function (hq) {
      OB.fbusy = false; if (!hq) OB.err = ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'); else OB.foto = hq;
      if (S.view === 'obj' && OB.form === 'sec') render();
    });
  });
  // Предупреждение: расходов больше, чем получено от заказчика
  function objWarn(p) {
    if (!(Number(p.left) < 0)) return '';
    return '<p role="alert" style="margin:10px 0;padding:10px 12px;border-radius:12px;background:rgba(192,57,43,.14);color:#c0392b"><b>' + esc(ui('Расходов больше, чем получено', 'Хароҷот аз гирифташуда зиёд аст', 'Xarajat olingandan koʻp')) + ' ' + pkMoney(-p.left) + '.</b> ' + esc(ui('Пора попросить у заказчика новую часть.', 'Вақти аз фармоишгар қисми навро хостан аст.', 'Buyurtmachidan yangi qism soʻrash vaqti.')) + '</p>';
  }
  // Мастера: договорённая сумма, выплачено, осталось доплатить
  function objMasters(p) {
    var ms = p.masters || [], h = '<div style="margin:8px 0 12px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px"><b>' + esc(ui('Долги по мастерам', 'Қарзҳо ба устоҳо', 'Ustalarga qarzlar')) + ': <span style="color:' + (p.mastersOwe > 0 ? '#c0392b' : 'inherit') + '">' + pkMoney(p.mastersOwe || 0) + '</span></b>' +
      objBtn('fm:', '+ ' + esc(ui('Договор', 'Шартнома', 'Shartnoma')), true, 'height:36px;padding:0 12px;font-size:14px') + '</div>';
    if (!ms.length) return h + '<small style="opacity:.75">' + esc(ui('Мастеров пока нет. Запишите выплату или договорённость.', 'Усто ҳоло нест. Пардохт ё шартномаро сабт кунед.', 'Ustalar hali yoʻq. Toʻlov yoki kelishuvni yozing.')) + '</small></div>';
    ms.forEach(function (m) {
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2)"><span style="flex:1;min-width:0"><b>' + esc(m.name) + '</b><br><small>' + esc(ui('выплачено', 'пардохта шуд', 'toʻlandi')) + ' ' + pkMoney(m.paid) + (m.dogovor != null ? ' · ' + esc(ui('договор', 'шартнома', 'shartnoma')) + ' ' + pkMoney(m.dogovor) + ' · <b style="color:' + (m.left > 0 ? '#c0392b' : '#1f8a4c') + '">' + esc(ui('осталось', 'монд', 'qoldi')) + ' ' + pkMoney(m.left) + '</b>' : ' · <i>' + esc(ui('договор не указан', 'шартнома нест', 'shartnoma yoʻq')) + '</i>') + '</small></span>' +
        objBtn('fm:' + m.name, esc(ui('Договор', 'Шартнома', 'Shartnoma')), true, 'flex:none;height:34px;padding:0 10px;font-size:13px') + '</div>';
    });
    return h + '</div>';
  }
  // Отчёт заказчику: на что ушли деньги по объекту; личные расходы Асрора сюда не попадают (в данных объекта их нет)
  function objReportText(p) {
    var cur = ui('сомони', 'сомонӣ', 'somoni'), L = [], en = p.entries || [];
    function money(x) { return pkMoney(x) + ' ' + cur; }
    function sum(a) { return a.reduce(function (s, e) { return s + (Number(e.summa) || 0); }, 0); }
    function line(e, note) { return '• ' + e.data + ' — ' + money(e.summa) + (note ? ' (' + note + ')' : ''); }
    var adv = en.filter(function (e) { return e.tip === 'prihod'; }).slice().reverse(),
      mas = en.filter(function (e) { return e.tip === 'rashod' && e.statya === 'master'; }).slice().reverse(),
      mat = en.filter(function (e) { return e.tip === 'rashod' && e.statya === 'material'; }).slice().reverse(),
      oth = en.filter(function (e) { return e.tip === 'rashod' && e.statya !== 'master' && e.statya !== 'material'; }).slice().reverse();
    L.push(ui('Отчёт по объекту', 'Ҳисобот аз рӯи объект', 'Obyekt boʻyicha hisobot') + ': ' + p.name, today(), '');
    L.push(ui('Получено от вас', 'Аз шумо гирифта шуд', 'Sizdan olindi') + ': ' + money(p.inn));
    adv.forEach(function (e) { L.push(line(e, e.komment)); });
    L.push('', ui('Потрачено', 'Сарф шуд', 'Sarflandi') + ': ' + money(p.out));
    if (mas.length) { L.push('', ui('Мастера', 'Устоҳо', 'Ustalar') + ': ' + money(sum(mas))); mas.forEach(function (e) { L.push(line(e, e.master || e.komment)); }); }
    if (mat.length) { L.push('', ui('Материалы', 'Масолеҳ', 'Materiallar') + ': ' + money(sum(mat))); mat.forEach(function (e) { L.push(line(e, e.komment)); }); }
    if (oth.length) { L.push('', ui('Прочее', 'Дигар', 'Boshqa') + ': ' + money(sum(oth))); oth.forEach(function (e) { L.push(line(e, e.komment)); }); }
    L.push('', ui('Остаток', 'Монда', 'Qoldiq') + ': ' + money(p.left));
    return L.join('\n');
  }
  // Данные отчёта заказчику по разделам (для таблицы на экране и для файла Excel)
  function objReportSecs(p) {
    var en = p.entries || [], rev = function (f) { return en.filter(f).slice().reverse(); }, sum = function (a) { return a.reduce(function (s, e) { return s + (Number(e.summa) || 0); }, 0); };
    var desc = function (e) { return [e.master, e.komment].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · '); };
    var S = [
      { t: ui('Получено от заказчика', 'Аз фармоишгар гирифта шуд', 'Buyurtmachidan olindi'), a: rev(function (e) { return e.tip === 'prihod'; }) },
      { t: ui('Мастера (работа)', 'Устоҳо (кор)', 'Ustalar (ish)'), a: rev(function (e) { return e.tip === 'rashod' && e.statya === 'master'; }) },
      { t: ui('Материалы', 'Масолеҳ', 'Materiallar'), a: rev(function (e) { return e.tip === 'rashod' && e.statya === 'material'; }) },
      { t: ui('Прочие расходы', 'Хароҷоти дигар', 'Boshqa xarajatlar'), a: rev(function (e) { return e.tip === 'rashod' && e.statya !== 'master' && e.statya !== 'material'; }) }
    ];
    S.forEach(function (x) { x.sum = sum(x.a); x.rows = x.a.map(function (e) { return { d: e.data, n: desc(e), v: Number(e.summa) || 0 }; }); });
    return S.filter(function (x) { return x.a.length; });
  }
  function renderObjReport(el) {
    var p = OB.cur, S = objReportSecs(p), cur = ui('сомони', 'сомонӣ', 'somoni');
    var B = '1px solid #b9c0c8', th = 'padding:7px 8px;background:#1f3a5f;color:#fff;font-size:12px;font-weight:700;text-align:left;border:' + B, td = 'padding:7px 8px;font-size:13px;border:' + B + ';vertical-align:top;word-break:break-word', tn = td + ';text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums';
    var doc = '<div id="ob-rep" style="background:#fff;color:#1b2430;border:1px solid #c9ced4;border-radius:6px;padding:14px 12px;margin:8px 0;box-shadow:0 1px 4px rgba(0,0,0,.12)">' +
      '<div style="border-bottom:3px solid #1f3a5f;padding-bottom:8px;margin-bottom:10px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5b6775">' + esc(ui('Отчёт по расходам', 'Ҳисобот оид ба хароҷот', 'Xarajatlar hisoboti')) + '</div><div style="font-size:20px;font-weight:700;margin-top:2px">' + esc(p.name) + '</div>' +
      '<div style="font-size:13px;color:#3b4654;margin-top:4px">' + (p.zakazchik ? esc(ui('Заказчик', 'Фармоишгар', 'Buyurtmachi')) + ': <b>' + esc(p.zakazchik) + '</b><br>' : '') + esc(ui('Дата отчёта', 'Санаи ҳисобот', 'Hisobot sanasi')) + ': <b>' + esc(today()) + '</b></div></div>';
    S.forEach(function (x, si) {
      doc += '<div style="font-weight:700;font-size:14px;margin:12px 0 4px">' + (si + 1) + '. ' + esc(x.t) + '</div><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:300px"><thead><tr><th style="' + th + ';width:26px;text-align:center">№</th><th style="' + th + ';width:78px">' + esc(ui('Дата', 'Сана', 'Sana')) + '</th><th style="' + th + '">' + esc(ui('Описание', 'Тавсиф', 'Tavsif')) + '</th><th style="' + th + ';text-align:right;width:84px">' + esc(ui('Сумма', 'Маблағ', 'Summa')) + '</th></tr></thead><tbody>';
      x.rows.forEach(function (r, i) { doc += '<tr style="background:' + (i % 2 ? '#f4f6f9' : '#fff') + '"><td style="' + td + ';text-align:center;color:#5b6775">' + (i + 1) + '</td><td style="' + td + ';white-space:nowrap">' + esc(r.d) + '</td><td style="' + td + '">' + esc(r.n) + '</td><td style="' + tn + '">' + pkMoney(r.v) + '</td></tr>'; });
      doc += '<tr style="background:#e6ebf2;font-weight:700"><td colspan="3" style="' + td + ';text-align:right">' + esc(ui('Итого', 'Ҷамъ', 'Jami')) + ' — ' + esc(x.t.toLowerCase()) + '</td><td style="' + tn + '">' + pkMoney(x.sum) + '</td></tr></tbody></table></div>';
    });
    if (!S.length) doc += '<p style="color:#5b6775;font-size:13px">' + esc(ui('Записей пока нет.', 'Ҳоло сабт нест.', 'Hozircha yozuv yoʻq.')) + '</p>';
    var sr = function (l, v, bold, col) { return '<tr style="' + (bold ? 'background:#1f3a5f;color:#fff;font-weight:700' : '') + '"><td style="' + td + ';border-color:#b9c0c8">' + esc(l) + '</td><td style="' + tn + (col ? ';color:' + col : '') + '">' + pkMoney(v) + ' ' + esc(cur) + '</td></tr>'; };
    doc += '<div style="font-weight:700;font-size:14px;margin:16px 0 4px">' + esc(ui('Сводка', 'Хулоса', 'Xulosa')) + '</div><table style="border-collapse:collapse;width:100%"><tbody>' +
      (Number(p.dogovor) > 0 ? sr(ui('Сумма договора', 'Маблағи шартнома', 'Shartnoma summasi'), Number(p.dogovor)) : '') +
      sr(ui('Получено от заказчика', 'Аз фармоишгар гирифта шуд', 'Buyurtmachidan olindi'), p.inn) + sr(ui('Потрачено всего', 'Ҳамагӣ сарф шуд', 'Jami sarflandi'), p.out) + sr(ui('Остаток', 'Монда', 'Qoldiq'), p.left, true) + '</tbody></table></div>';
    el.innerHTML = '<div style="'+OB_HD+'">' + objBtn('back', '← ' + esc(objBack()), true, 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="'+OB_H2+'">📄 ' + esc(ui('Отчёт для заказчика', 'Ҳисобот барои фармоишгар', 'Buyurtmachi uchun hisobot')) + '</h2></div>' + objMsgs() + doc +
      objBtn('xls', '📥 ' + esc(ui('Скачать в Excel', 'Ба Excel гирифтан', 'Excelga yuklash')), false, 'width:100%;height:48px;margin-bottom:8px') +
      '<div style="display:flex;gap:8px">' + objBtn('share', esc(ui('Отправить', 'Фиристодан', 'Yuborish')), true, 'flex:1;height:48px') + objBtn('copy', esc(ui('Копировать', 'Нусхабардорӣ', 'Nusxalash')), true, 'flex:1;height:48px') + '</div>' +
      '<small style="display:block;margin-top:8px;opacity:.75">' + esc(ui('Личные расходы в отчёт не входят.', 'Хароҷоти шахсӣ дар ҳисобот нест.', 'Shaxsiy xarajatlar hisobotga kirmaydi.')) + '</small>';
  }
  function objXls() {
    var p = OB.cur, S = objReportSecs(p), rows = [[ui('Отчёт по расходам', 'Ҳисобот оид ба хароҷот', 'Xarajatlar hisoboti')], [ui('Объект', 'Объект', 'Obyekt'), p.name], [ui('Заказчик', 'Фармоишгар', 'Buyurtmachi'), p.zakazchik || ''], [ui('Дата отчёта', 'Санаи ҳисобот', 'Hisobot sanasi'), today()], []], bold = [0];
    S.forEach(function (x) {
      bold.push(rows.length); rows.push([x.t]); bold.push(rows.length); rows.push(['№', ui('Дата', 'Сана', 'Sana'), ui('Описание', 'Тавсиф', 'Tavsif'), ui('Сумма', 'Маблағ', 'Summa')]);
      x.rows.forEach(function (r, i) { rows.push([i + 1, r.d, r.n, r.v]); });
      bold.push(rows.length); rows.push(['', '', ui('Итого', 'Ҷамъ', 'Jami'), x.sum]); rows.push([]);
    });
    bold.push(rows.length); rows.push([ui('Сводка', 'Хулоса', 'Xulosa')]);
    if (Number(p.dogovor) > 0) rows.push(['', '', ui('Сумма договора', 'Маблағи шартнома', 'Shartnoma summasi'), Number(p.dogovor)]);
    rows.push(['', '', ui('Получено от заказчика', 'Аз фармоишгар гирифта шуд', 'Buyurtmachidan olindi'), Number(p.inn) || 0], ['', '', ui('Потрачено всего', 'Ҳамагӣ сарф шуд', 'Jami sarflandi'), Number(p.out) || 0]);
    bold.push(rows.length); rows.push(['', '', ui('Остаток', 'Монда', 'Qoldiq'), Number(p.left) || 0]);
    try { saveBlob(xlsxBlob([{ name: ui('Отчёт', 'Ҳисобот', 'Hisobot'), bold: bold, rows: rows }]), 'otchet-' + String(p.name).replace(/[^\wА-Яа-яЁё]+/g, '-').slice(0, 30) + '-' + today() + '.xlsx'); OB.msg = ui('Файл Excel скачан', 'Файли Excel гирифта шуд', 'Excel fayli yuklandi'); OB.err = ''; } catch (e) { OB.err = ui('Не получилось сделать файл', 'Файл сохта нашуд', 'Fayl yaratilmadi'); }
    render();
  }
  function objCopy() {
    var t = objReportText(OB.cur), ok = function () { OB.msg = ui('Скопировано', 'Нусха шуд', 'Nusxalandi'); OB.err = ''; render(); }, no = function () { OB.err = ui('Не получилось скопировать, выделите текст вручную', 'Нусха нашуд, матнро дастӣ ҷудо кунед', 'Nusxalab boʻlmadi, matnni qoʻlda belgilang'); render(); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(ok, no); } catch (e) {}
    try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); var r = document.execCommand('copy'); document.body.removeChild(ta); return r ? ok() : no(); } catch (e) { no(); }
  }
  function objShare() {
    var t = objReportText(OB.cur);
    try { if (navigator.share) return navigator.share({ title: OB.cur.name, text: t }).catch(function () {}); } catch (e) {}
    try { window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener'); } catch (e) { objCopy(); }
  }
  function objTotals(p) {
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px">' + objStatBox(ui('Получено', 'Гирифта шуд', 'Olindi'), pkMoney(p.inn), '#1f8a4c') + objStatBox(ui('Потрачено', 'Сарф шуд', 'Sarflandi'), pkMoney(p.out), '#c0392b') + objStatBox(ui('Осталось', 'Монд', 'Qoldi'), pkMoney(p.left), p.left < 0 ? '#c0392b' : 'inherit') + '</div>';
  }
  function renderObj(el) {
    var h = '<div style="' + OB_HD + '">' + backBtn().replace(/←[^<]*/, '← ' + esc(objBack())).replace('margin-bottom:8px', 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="' + OB_H2 + '">🏗️ ' + esc(objTitle()) + '</h2></div>';
    if (OB.trash) return renderTrash(el);
    if (OB.debts) return renderDebts(el);
    if (OB.lich) return renderLich(el);
    if (OB.ph && OB.cur) return renderObjPhoto(el);
    if (OB.cur && OB.rep && !OB.cur.loading && !OB.cur.error) return renderObjReport(el);
    if (OB.cur) return renderObjPoint(el, h);
    if (!OB.data) { el.innerHTML = h + '<p>' + esc(OB.err || TX('Загрузка…')) + '</p>' + (OB.err ? objBtn('reload', esc(TX('Повторить')), true) : ''); return; }
    var pts = OB.data.points || [], tile = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:84px;height:auto;padding:10px;text-align:center;width:100%';
    h += '<p style="margin:4px 0 10px">' + esc(ui('Выберите клиента (объект):', 'Мижозро (объектро) интихоб кунед:', 'Mijozni (obyektni) tanlang:')) + '</p>' + objMsgs();
    h += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">';
    pts.forEach(function (p) {
      h += '<button type="button" class="btn sec" data-obj="pt:' + esc(p.name) + '" style="' + tile + (Number(p.left) < 0 ? ';border-color:#c0392b;background:rgba(192,57,43,.14)' : '') + '"><b style="font-size:16px;word-break:break-word">' + esc(p.name) + '</b><small>' + esc(ui('осталось', 'монд', 'qoldi')) + ' <b' + (p.left < 0 ? ' style="color:#c0392b"' : '') + '>' + pkMoney(p.left) + '</b></small></button>';
    });
    for (var i = pts.length; i < OB_SLOTS; i++) {
      h += '<button type="button" class="btn sec" data-obj="f:client" style="' + tile + ';border-style:dashed;opacity:.8"><b style="font-size:16px">' + esc(ui('Объект', 'Объект', 'Obyekt')) + ' ' + (i + 1) + '</b><small>' + esc(ui('нажмите, чтобы назвать', 'барои ном гузоштан зер кунед', 'nom berish uchun bosing')) + '</small></button>';
    }
    h += '<button type="button" class="btn" data-obj="f:client" style="' + tile + ';font-size:28px;font-weight:700"' + (OB.busy ? ' disabled' : '') + '>+<small style="font-size:13px;font-weight:400">' + esc(ui('Новый объект', 'Объекти нав', 'Yangi obyekt')) + '</small></button>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px">' +
      '<button type="button" class="btn sec" data-obj="lich" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px;height:auto;padding:8px;font-size:14px;line-height:1.2;text-align:center">👤 ' + esc(ui('Личные расходы Асрора', 'Хароҷоти шахсии Асрор', 'Asrorning shaxsiy xarajatlari')) + '</button>' +
      '<button type="button" class="btn sec" data-obj="debts" style="display:flex;align-items:center;justify-content:center;gap:6px;min-height:52px;height:auto;padding:8px;font-size:16px">💰 ' + esc(ui('Долги', 'Қарзҳо', 'Qarzlar')) + '</button></div>' +
      (OB.data.trash > 0 ? objBtn('trash-open', '🗑 ' + esc(ui('Корзина', 'Сабад', 'Savat')) + ' (' + OB.data.trash + ')', true, 'width:100%;height:46px;margin-top:10px') : '') + objForm();
    el.innerHTML = h;
  }
  // Корзина объектов: удалённый объект уходит сюда со всеми записями, в итоги не входит; его можно вернуть или удалить навсегда.
  function openTrash() { OB.trash = { loading: true }; OB.cur = null; OB.sec = null; OB.form = null; OB.err = ''; OB.msg = ''; OB.delAsk = null; trashLoad(); render(); }
  function trashLoad() {
    callTo('/objekty', { action: 'trash_list' }).then(function (r) {
      if (S.view !== 'obj' || !OB.trash) return;
      OB.trash = (!r || !r.ok) ? { error: (r && r.error) || TX('не удалось загрузить') } : r; render();
    });
  }
  function renderTrash(el) {
    var T2 = OB.trash, h = '<div style="' + OB_HD + '">' + objBtn('back', '← ' + esc(objBack()), true, 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="' + OB_H2 + '">🗑 ' + esc(ui('Корзина', 'Сабад', 'Savat')) + '</h2></div>';
    if (T2.loading) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (T2.error) { el.innerHTML = h + '<p style="color:#c0392b">' + esc(T2.error) + '</p>'; return; }
    h += objMsgs() + '<div style="margin:12px 2px;font-size:13px;opacity:.8;line-height:1.4">' + esc(ui('Объекты из корзины не считаются в итогах. Верните объект — все записи на месте. «Удалить навсегда» убирает объект из корзины, вернуть его потом нельзя.', 'Объектҳои сабад дар ҳисоб намераванд. Объектро баргардонед — ҳамаи сабтҳо ҷояшон. «Якбора нест кардан» объектро аз сабад мебарорад, баргардонидан имконнопазир аст.', 'Savatdagi obyektlar hisobga kirmaydi. Obyektni qaytaring — barcha yozuvlar joyida. «Butunlay oʻchirish» obyektni savatdan olib tashlaydi, qaytarib boʻlmaydi.')) + '</div>';
    if (!(T2.points || []).length) h += '<p style="opacity:.75">' + esc(ui('Корзина пуста.', 'Сабад холӣ аст.', 'Savat boʻsh.')) + '</p>';
    (T2.points || []).forEach(function (p) {
      var ask = OB.delAsk === 'purge:' + p.name;
      h += '<div style="border:1px solid var(--line,#ddd);border-radius:14px;padding:12px;margin:8px 0;background:#fff"><b>📍 ' + esc(p.name) + '</b>' + (p.zakazchik ? '<br><small style="opacity:.8">' + esc(p.zakazchik) + '</small>' : '') +
        '<br><small>' + esc(ui('получено', 'гирифта шуд', 'olindi')) + ' ' + pkMoney(p.inn) + ' · ' + esc(ui('потрачено', 'харҷ шуд', 'sarflandi')) + ' ' + pkMoney(p.out) + ' · ' + esc(ui('осталось', 'монд', 'qoldi')) + ' <b>' + pkMoney(p.left) + '</b></small>' +
        '<div style="display:flex;gap:8px;margin-top:10px">' + objBtn('restore:' + p.name, '↩️ ' + esc(ui('Вернуть', 'Баргардонидан', 'Qaytarish')), false, 'flex:1;height:44px') +
        objBtn('purge:' + p.name, ask ? esc(ui('Точно навсегда?', 'Якбора?', 'Butunlaymi?')) : esc(ui('Удалить навсегда', 'Якбора нест кардан', 'Butunlay oʻchirish')), true, 'flex:1;height:44px;color:#c0392b' + (ask ? ';border-color:#c0392b;font-weight:700' : '')) + '</div></div>';
    });
    el.innerHTML = h;
  }
  // Долги: кому ещё должны мы (мастера по объектам) и кто должен нам (заказчик, если задан договор).
  function openDebts() {
    OB.debts = { loading: true }; OB.lich = null; OB.cur = null; OB.form = null; OB.err = ''; OB.msg = ''; render();
    callTo('/objekty', { action: 'debts' }).then(function (r) {
      if (S.view !== 'obj' || !OB.debts) return;
      OB.debts = (!r || !r.ok) ? { error: (r && r.error) || TX('не удалось загрузить') } : r; render();
    });
  }
  function renderDebts(el) {
    var D = OB.debts, h = '<div style="' + OB_HD + '">' + objBtn('back', '← ' + esc(objBack()), true, 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="' + OB_H2 + '">💰 ' + esc(ui('Долги', 'Қарзҳо', 'Qarzlar')) + '</h2></div>';
    if (D.loading) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (D.error) { el.innerHTML = h + '<p style="color:#c0392b">' + esc(D.error) + '</p>'; return; }
    var box = 'border:1px solid var(--line,#ddd);border-radius:14px;padding:10px 12px;margin:8px 0';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">' + objStatBox(ui('Мы должны мастерам', 'Мо ба устоҳо қарздорем', 'Ustalarga qarzimiz'), pkMoney(D.total.mastersOwe), '#c0392b') + objStatBox(ui('Заказчики должны нам', 'Фармоишгарон ба мо қарздоранд', 'Buyurtmachilar qarzdor'), pkMoney(D.total.customersOwe), '#1f8a4c') + '</div>';
    if (!(D.points || []).length) h += '<p style="opacity:.75">' + esc(ui('Долгов пока нет.', 'Ҳоло қарз нест.', 'Hozircha qarz yoʻq.')) + '</p>';
    (D.points || []).forEach(function (p) {
      h += '<div style="' + box + '"><b>📍 ' + esc(p.name) + '</b>';
      (p.masters || []).forEach(function (m) {
        var has = m.dogovor != null && m.dogovor !== '';
        h += '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid rgba(127,127,127,.2);margin-top:6px"><span>👷 ' + esc(m.name) + '<br><small style="opacity:.75">' + esc(ui('выплачено', 'пардохта шуд', 'toʻlandi')) + ' ' + pkMoney(m.paid) + (has ? ' · ' + esc(ui('договор', 'шартнома', 'shartnoma')) + ' ' + pkMoney(m.dogovor) : ' · ' + esc(ui('договор не указан', 'шартнома нест', 'shartnoma yoʻq'))) + '</small></span>' + (has ? '<b style="color:' + (Number(m.left) > 0 ? '#c0392b' : '#1f8a4c') + ';white-space:nowrap">' + esc(ui('осталось', 'монд', 'qoldi')) + ' ' + pkMoney(m.left) + '</b>' : '') + '</div>';
      });
      if (Number(p.owes) > 0) h += '<div style="padding-top:6px;margin-top:6px;border-top:1px solid rgba(127,127,127,.2)">' + esc(ui('Заказчик ещё должен', 'Фармоишгар ҳанӯз қарздор', 'Buyurtmachi qarzdor')) + ': <b style="color:#1f8a4c">' + pkMoney(p.owes) + '</b></div>';
      h += '</div>';
    });
    el.innerHTML = h;
  }
  // Личные деньги Асрора: отдельная кнопка, свои записи (tip=lichnoe), с объектами не смешиваются.
  function openLich() { OB.lich = { loading: true }; OB.cur = null; OB.form = null; OB.err = ''; OB.msg = ''; OB.delAsk = null; lichLoad(); render(); }
  function lichLoad() {
    OB.busy = true;
    callTo('/objekty', { action: 'lich_list' }).then(function (r) {
      OB.busy = false; if (S.view !== 'obj' || !OB.lich) return;
      OB.lich = (!r || !r.ok) ? { error: (r && r.error) || TX('не удалось загрузить') } : r; render();
    });
  }
  function lichEntries(list) {
    if (!list || !list.length) return '<p style="opacity:.75">' + esc(ui('Записей пока нет.', 'Ҳоло сабт нест.', 'Hali yozuv yoʻq.')) + '</p>';
    return OB_EDHINT() + list.map(function (e) {
      var inn = e.kind === 'in', ask = OB.delAsk === e.oid, lc = lcFind(e.komment), lrest = lc ? String(e.komment).slice(lc[0].length + 1).split(' · ').slice(1).join(' · ') : String(e.komment || '');
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2)"><span style="flex:none;width:44px;height:44px;border-radius:14px;background:' + (inn ? '#DDF3EC' : '#FFF3D6') + ';display:flex;align-items:center;justify-content:center;font-size:24px">' + (lc ? lc[0] : inn ? '＋' : '－') + '</span><button type="button" data-obj="ed:' + esc(e.oid) + '" style="' + OB_ED + '"><b style="color:' + (inn ? '#1f8a4c' : '#c0392b') + '">' + (inn ? '+' : '−') + pkMoney(e.summa) + '</b> · ' + esc(e.data) +
        (lc || lrest ? '<br><small style="opacity:.8">' + (lc ? '<b>' + esc(lcName(lc)) + '</b>' + (lrest ? ' · ' : '') : '') + esc(lrest) + '</small>' : '') + '</button>' +
        objBtn('void:' + e.oid, ask ? esc(ui('Точно отменить?', 'Бекор кунам?', 'Bekor qilaymi?')) : '✕', true, 'flex:none;height:34px;padding:0 10px;font-size:13px' + (ask ? ';color:#c0392b' : '')) + '</div>';
    }).join('');
  }
  function renderLich(el) {
    var L = OB.lich, h = '<div style="'+OB_HD+'">' + objBtn('back', '← ' + esc(objBack()), true, 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="'+OB_H2+'">👤 ' + esc(ui('Личные расходы Асрора', 'Хароҷоти шахсии Асрор', 'Asrorning shaxsiy xarajatlari')) + '</h2></div>';
    if (L.loading) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (L.error) { el.innerHTML = h + '<p style="color:#c0392b">' + esc(L.error) + '</p>'; return; }
    h += '<div style="display:flex;gap:10px;margin:8px 0">' + objBtn('f:lich_in', '+ ' + esc(ui('Приход', 'Даромад', 'Kirim')), false, 'flex:1;height:48px') + objBtn('f:lich_out', '− ' + esc(ui('Расход', 'Хароҷот', 'Chiqim')), true, 'flex:1;height:48px') + '</div>';
    h += objMsgs() + objForm() + lichEntries(L.entries);
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px">' + objStatBox(ui('Всего приходов', 'Ҷамъи даромад', 'Jami kirim'), pkMoney(L.inn), '#1f8a4c') + objStatBox(ui('Всего расходов', 'Ҷамъи хароҷот', 'Jami chiqim'), pkMoney(L.out), '#c0392b') + objStatBox(ui('Остаток', 'Монда', 'Qoldiq'), pkMoney(L.left), L.left < 0 ? '#c0392b' : 'inherit') + '</div>';
    el.innerHTML = h;
  }
  function renderObjPoint(el, h) {
    var p = OB.cur, k = OB.sec;
    h = '<div style="'+OB_HD+'">' + objBtn('back', '← ' + esc(objBack()), true, 'margin:0;flex:none;height:38px;padding:0 12px') + '<h2 style="'+OB_H2+'">' + (k ? objSecIcon(k) + ' ' + esc(objSecName(k)) : '📍 <button type="button" data-obj="rn-tap" style="background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;text-align:left;cursor:pointer">' + esc(p.name) + '</button>') + '</h2>' + (!k && !p.loading && !p.error ? objBtn('f:rename', '✏️', true, 'flex:none;height:38px;padding:0 10px;margin:0') : '') + '</div>';
    if (p.loading) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (p.error) { el.innerHTML = h + '<p style="color:#c0392b">' + esc(p.error) + '</p>'; return; }
    if (!k) {
      h += '<div style="display:grid;gap:10px;margin:10px 0">' + ['in', 'master', 'material'].map(function (s) {
        return '<button type="button" class="btn' + (s === 'in' ? '' : ' sec') + '" data-obj="sec:' + s + '" style="' + (s === 'in' && Number(p.left) < 0 ? 'background:#c0392b;border-color:#c0392b;color:#fff;' : '') + 'display:flex;align-items:center;justify-content:space-between;gap:10px;height:auto;min-height:60px;padding:10px 14px;width:100%;font-size:18px"><span>' + objSecIcon(s) + ' ' + esc(objSecName(s)) + '</span><b>' + pkMoney(objSecSum(p, s)) + '</b></button>';
      }).join('') + '</div>' + objMsgs() + objForm() + objWarn(p) + (obMicOk() ? objBtn('mic-obj', OB.mic ? '⏹ ' + esc(ui('Слушаю…', 'Гӯш мекунам…', 'Tinglayapman…')) : '🎤 ' + esc(ui('Сказать запись голосом', 'Сабтро бо овоз гуфтан', 'Yozuvni ovoz bilan aytish')), true, 'width:100%;height:50px;margin-top:6px') : '') + objTotals(p) + objBtn('rep', '📄 ' + esc(ui('Отчёт для заказчика', 'Ҳисобот барои фармоишгар', 'Buyurtmachi uchun hisobot')), true, 'width:100%;height:50px;margin-top:10px') +
        objBtn('trash', OB.delAsk === 'pt-trash' ? '🗑 ' + esc(ui('Точно в корзину? Нажмите ещё раз', 'Ба сабад мегузорем? Боз пахш кунед', 'Savatga solamizmi? Yana bosing')) : '🗑 ' + esc(ui('Удалить объект (в корзину)', 'Нест кардани объект (ба сабад)', 'Obyektni oʻchirish (savatga)')), true, 'width:100%;height:46px;margin-top:10px;color:#c0392b' + (OB.delAsk === 'pt-trash' ? ';border-color:#c0392b;font-weight:700' : ''));
      el.innerHTML = h; return;
    }
    if (k === 'material' && OB.mat) { el.innerHTML = h + matView(); return; }
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0"><span>' + esc(ui('Всего', 'Ҷамъ', 'Jami')) + ': <b>' + pkMoney(objSecSum(p, k)) + '</b></span>' + (k === 'material' ? objBtn('mat-open', '📋 ' + esc(ui('Таблица покупок', 'Ҷадвали харидҳо', 'Xaridlar jadvali')), false, 'height:44px;padding:0 14px;margin-right:8px') : '') + objBtn('f:sec', '+ ' + esc(ui('Добавить', 'Илова', 'Qoʻshish')), false, 'height:44px;padding:0 18px') + '</div>';
    h += objMsgs() + objForm() + (k === 'master' ? objMasters(p) : '') + objSecEntries(p.entries, k) + objTotals(p);
    el.innerHTML = h;
  }

  /* ---------- Личный ассистент: обязательный первый шаг ---------- */
  // Новый арендатор сначала знакомится с личным ассистентом: рассказывает, чем занимается, есть ли товар и сотрудники, что нужно в соцсетях.
  // По ответам ассистент сохраняет профиль (его же читает «Бухгалтер») и открывает кабинет. Пока знакомства нет, остальные кнопки закрыты.
  // Кабинеты, где профиль уже есть (на этом телефоне или на сервере), и кабинет с учётом магазина не блокируются.
  var PA = { step: 0, kind: '', other: '', about: '', stock: '', staff: '', goals: [], saving: false, asked: '', ok: false, err: '' };
  var PA_GOALS = [
    ['clients', 'Больше клиентов', 'Муштариёни бештар', 'Koʻproq mijozlar'],
    ['posts', 'Подписи к постам', 'Тавсифи постҳо', 'Postlarga izohlar'],
    ['plan', 'План публикаций на неделю', 'Нақшаи ҳафтаина', 'Haftalik reja'],
    ['replies', 'Ответы клиентам в переписках', 'Ҷавоб ба муштариён', 'Mijozlarga javoblar'],
    ['none', 'Пока соцсети не нужны', 'Ҳоло шабакаҳои иҷтимоӣ лозим нест', 'Hozircha ijtimoiy tarmoq kerak emas']
  ];
  function paKey() { return 'ew_pa_' + hsh(code().code || ''); }
  function paAdminView() { try { return typeof AS_KOD !== 'undefined' && !!AS_KOD; } catch (e) { return false; } }
  function paDone() {
    return true; /* otklyucheno 30.10 */ if (paAdminView() || PA.ok) return true;
    try { if (lstore(paKey()) === '1') return true; } catch (e) {}
    if (readProf()) return true;
    if (shopOn()) return true;
    return false;
  }
  // Один раз спрашиваем сервер, нет ли у кабинета уже профиля (например, вошли с нового телефона)
  function paCheck() {
    var c = ''; try { c = String(store('ew_cab') || ''); } catch (e) {}
    if (!c || PA.asked === c) return; PA.asked = c;
    call({ action: 'profile-get' }).then(function (r) {
      if (r && r.ok && r.profile && r.profile.kind) { try { lstore(pkey(), JSON.stringify(r.profile)); lstore(paKey(), '1'); } catch (e) {} PA.ok = true; applyHome(); }
      else if (!r || !r.ok) PA.asked = '';
    });
  }
  function openPa() {
    if (!owner()) return; ensure(); S.view = 'pa'; PA.err = '';
    if (PA.step >= 4) PA.step = 0;
    var pr = readProf(); if (pr && !PA.kind) { PA.kind = pr.kind || ''; PA.other = pr.other || ''; PA.about = pr.about || ''; PA.stock = pr.stock || ''; PA.staff = pr.staff || ''; PA.goals = Array.isArray(pr.goals) ? pr.goals.slice() : []; }
    var d = $s('m-spec');
    if (!d._paIn) { d._paIn = 1; d.addEventListener('input', function (e) { var t = e.target; if (t && t.id === 'pa-about') PA.about = t.value; else if (t && t.id === 'pa-other') PA.other = t.value; }); }
    render(); open_dlg('m-spec');
  }
  function paBubble(t) { return '<div style="max-width:92%;margin:6px 0;padding:10px 14px;border-radius:16px 16px 16px 4px;background:#eef0ff;color:#26235f">' + esc(t) + '</div>'; }
  function paOpt(key, val, label, on) { return '<button type="button" class="btn' + (on ? '' : ' sec') + '" data-pa="' + key + ':' + val + '" style="height:40px;padding:0 14px">' + esc(label) + '</button>'; }
  function renderPa(el) {
    var h = '<h2 style="padding-right:36px">🤝 ' + esc(ui('Личный ассистент', 'Ёвари шахсӣ', 'Shaxsiy yordamchi')) + '</h2>';
    if (PA.step === 0) {
      h += paBubble(ui('Здравствуйте! Я ваш личный ассистент. Давайте познакомимся: расскажите, чем вы занимаетесь. Это нужно один раз, чтобы я настроил кабинет под вас.', 'Салом! Ман ёвари шахсии шумо ҳастам. Биёед шинос шавем: бигӯед, ба чӣ машғул ҳастед. Ин танҳо як бор лозим аст, то ман кабинетро барои шумо танзим кунам.', 'Salom! Men sizning shaxsiy yordamchingizman. Tanishaylik: nima bilan shugʻullanishingizni ayting. Bu faqat bir marta kerak, kabinetni sizga moslayman.'));
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:10px 0">' + KINDS.map(function (k) {
        var on = PA.kind === k.id;
        return '<button type="button" data-pa="kind:' + k.id + '" style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;padding:12px 8px;border:' + (on ? '3px solid ' + k.fg : '3px solid transparent') + ';border-radius:16px;background:' + k.bg + ';color:' + k.fg + ';font:inherit;cursor:pointer"><span aria-hidden="true" style="font-size:30px">' + k.ico + '</span><b>' + esc(TX(k.name)) + '</b><small style="opacity:.8">' + esc(TX(k.sub)) + '</small></button>';
      }).join('') + '</div>';
      if (PA.kind === 'other') h += '<input class="in2" id="pa-other" maxlength="80" placeholder="' + esc(TX('Напишите, чем вы занимаетесь')) + '" value="' + esc(PA.other) + '" style="margin:4px 0 8px">';
      h += '<label for="pa-about" style="display:block;margin:8px 0 4px"><b>' + esc(ui('Расскажите о себе своими словами (по желанию)', 'Дар бораи худ бо суханони худ нависед (ихтиёрӣ)', 'Oʻzingiz haqingizda oʻz soʻzlaringiz bilan yozing (ixtiyoriy)')) + '</b></label><textarea class="in2" id="pa-about" maxlength="600" rows="3" style="width:100%" placeholder="' + esc(ui('Например: принимаю клиентов онлайн и в кабинете, веду Instagram', 'Масалан: муштариёнро онлайн қабул мекунам', 'Masalan: mijozlarni onlayn qabul qilaman')) + '">' + esc(PA.about) + '</textarea>';
      h += '<button type="button" class="btn" data-pa="next" style="width:100%;height:46px;margin-top:12px"' + (PA.kind ? '' : ' disabled') + '>' + esc(ui('Дальше', 'Минбаъд', 'Keyingisi')) + '</button>';
    } else if (PA.step === 1) {
      h += paBubble(ui('Хорошо. Ещё два коротких вопроса о делах.', 'Хуб. Боз ду саволи кӯтоҳ.', 'Yaxshi. Yana ikkita qisqa savol.'));
      h += '<b>' + esc(TX('Есть ли у вас товар или склад?')) + '</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px">' + paOpt('stock', 'yes', TX('Да'), PA.stock === 'yes') + paOpt('stock', 'no', TX('Нет'), PA.stock === 'no') + '</div>';
      h += '<b>' + esc(TX('Сколько у вас сотрудников?')) + '</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px">' + STAFF.map(function (s) { return paOpt('staff', s[0], TX(s[1]), PA.staff === s[0]); }).join('') + '</div>';
      h += '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sec" data-pa="back" style="height:46px">← ' + esc(ui('Назад', 'Бозгашт', 'Orqaga')) + '</button><button type="button" class="btn" data-pa="next" style="flex:1;height:46px"' + (PA.stock && PA.staff ? '' : ' disabled') + '>' + esc(ui('Дальше', 'Минбаъд', 'Keyingisi')) + '</button></div>';
    } else if (PA.step === 2) {
      h += paBubble(ui('Что вам нужно в соцсетях? Отметьте всё, что подходит.', 'Дар шабакаҳои иҷтимоӣ чӣ лозим аст? Ҳамаи мувофиқро қайд кунед.', 'Ijtimoiy tarmoqlarda nima kerak? Mos hammasini belgilang.'));
      h += '<div style="display:flex;flex-direction:column;gap:8px;margin:10px 0">' + PA_GOALS.map(function (g) {
        var on = PA.goals.indexOf(g[0]) >= 0;
        return '<button type="button" class="btn' + (on ? '' : ' sec') + '" data-pa="goal:' + g[0] + '" style="height:44px;text-align:left;padding:0 14px">' + (on ? '✓ ' : '') + esc(ui(g[1], g[2], g[3])) + '</button>';
      }).join('') + '</div>';
      h += '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sec" data-pa="back" style="height:46px">← ' + esc(ui('Назад', 'Бозгашт', 'Orqaga')) + '</button><button type="button" class="btn" data-pa="next" style="flex:1;height:46px"' + (PA.goals.length ? '' : ' disabled') + '>' + esc(ui('Дальше', 'Минбаъд', 'Keyingisi')) + '</button></div>';
    } else if (PA.step === 3) {
      var tags = ['Приход и расход', 'Остаток денег', 'Прибыль', 'Наличные и переводы отдельно'];
      if (PA.stock === 'yes') tags.push('Склад');
      if (PA.staff !== '1') tags.push('Зарплаты');
      h += paBubble(ui('Спасибо, я всё понял. Вот что я включу для вас.', 'Ташаккур, ҳама чизро фаҳмидам. Инро барои шумо фаъол мекунам.', 'Rahmat, hammasini tushundim. Mana sizga nimani yoqaman.'));
      h += '<p style="margin:10px 0 6px"><b>📒 ' + esc(ui('Ваш бухгалтер', 'Ҳисобдори шумо', 'Sizning buxgalteringiz')) + '</b></p><div style="display:flex;flex-wrap:wrap;gap:6px">' + tags.map(function (t) { return '<span style="padding:5px 10px;border-radius:12px;background:#e3f6ea;color:#1f8a4c;font-size:13px">' + esc(TX(t)) + '</span>'; }).join('') + '</div>';
      h += '<p style="margin:12px 0 6px"><b>📣 ' + esc(ui('Соцсети: что я буду предлагать', 'Шабакаҳои иҷтимоӣ: чӣ пешниҳод мекунам', 'Ijtimoiy tarmoq: nimani taklif qilaman')) + '</b></p><div style="display:flex;flex-wrap:wrap;gap:6px">' + PA.goals.map(function (id) { var g = PA_GOALS.filter(function (x) { return x[0] === id; })[0]; return g ? '<span style="padding:5px 10px;border-radius:12px;background:#eef0ff;color:#3C3489;font-size:13px">' + esc(ui(g[1], g[2], g[3])) + '</span>' : ''; }).join('') + '</div>';
      if (PA.err) h += '<p role="alert" style="color:#b3261e;margin:10px 0 0">' + esc(PA.err) + '</p>';
      h += '<div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="btn sec" data-pa="back" style="height:46px">← ' + esc(ui('Назад', 'Бозгашт', 'Orqaga')) + '</button><button type="button" class="btn" data-pa="save" style="flex:1;height:46px"' + (PA.saving ? ' disabled' : '') + '>' + esc(ui('Настроить мой кабинет', 'Кабинетро танзим кунед', 'Kabinetimni sozlash')) + '</button></div>';
    } else {
      h += paBubble(ui('Готово! Кабинет настроен под вас. Теперь все специалисты открыты. Хорошей работы!', 'Тайёр! Кабинет барои шумо танзим шуд. Акнун ҳамаи мутахассисон кушодаанд. Кори хуш!', 'Tayyor! Kabinet siz uchun sozlandi. Endi barcha mutaxassislar ochiq. Ishingiz baraka topsin!'));
      h += '<button type="button" class="btn" data-pa="finish" style="width:100%;height:46px;margin-top:14px">' + esc(ui('К специалистам', 'Ба мутахассисон', 'Mutaxassislarga')) + '</button>';
    }
    el.innerHTML = h;
  }
  function paClick(b) {
    var v = b.dataset.pa, i = v.indexOf(':'), key = i < 0 ? v : v.slice(0, i), val = i < 0 ? '' : v.slice(i + 1);
    if (key === 'kind') PA.kind = val;
    else if (key === 'stock') PA.stock = val;
    else if (key === 'staff') PA.staff = val;
    else if (key === 'goal') { var k = PA.goals.indexOf(val); if (val === 'none') PA.goals = k >= 0 ? [] : ['none']; else { PA.goals = PA.goals.filter(function (x) { return x !== 'none'; }); if (k >= 0) PA.goals.splice(k, 1); else PA.goals.push(val); } }
    else if (key === 'next') { if (PA.step === 0 && !PA.kind) return; if (PA.step === 1 && !(PA.stock && PA.staff)) return; if (PA.step === 2 && !PA.goals.length) return; PA.step++; }
    else if (key === 'back') { if (PA.step > 0) PA.step--; }
    else if (key === 'save') return paSave();
    else if (key === 'finish') { var d = $s('m-spec'); if (d && d.open) d.close(); S.view = 'list'; applyHome(); return; }
    render();
  }
  function paSave() {
    if (PA.saving || !PA.kind || !PA.stock || !PA.staff) return;
    PA.saving = true; PA.err = ''; render();
    var P = { kind: PA.kind, other: String(PA.other || '').trim().slice(0, 80), stock: PA.stock, staff: PA.staff, about: String(PA.about || '').trim().slice(0, 600), goals: PA.goals.slice(), ts: Date.now() };
    callTo('/buhgalter', { action: 'profile', profile: P }).then(function (r) {
      PA.saving = false;
      if (!r || r.ok === false) { PA.err = ui('Не получилось сохранить. Проверьте интернет и нажмите ещё раз.', 'Захира нашуд. Интернетро санҷед ва боз пахш кунед.', 'Saqlab boʻlmadi. Internetni tekshirib, qayta bosing.'); return render(); }
      try { lstore(pkey(), JSON.stringify(P)); lstore(paKey(), '1'); } catch (e) {}
      S.prof = P; PA.ok = true; PA.step = 4; applyHome(); render();
    });
  }

  /* ---------- Финансист проката строительных инструментов ---------- */
  // Данные хранит n8n по адресу /prokat. Кому показывать прокат, решает сервер: чужому кабинету он отвечает «нет доступа», и тогда открывается обычная бухгалтерия.
  var PK = { mv: null, pt: null, points: [], total: null, filter: 'all', cur: null, busy: false, err: '', msg: '', form: null, ride: false, folder: false, sk: null, all: null, ph: null, phG: '', big: null, cmp: null, tour: null, rem: null, ol: null, sh: null, buy: null, pb: null, add: null };
  var PK_ST = { minus: 'В минусе', plus: 'В плюсе', idle: 'Нет движения' };
  var PK_PAY = { cash: 'Наличные', ds: 'Душанбе Сити', alif: 'Алиф' };
  function pkNum(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function pkMoney(x) { return money(cents(pkNum(x))); }
  function openFinOrProkat() {
    S.view = 'prokat'; PK.folder = false; PK.sk = null; PK.all = null; PK.cmp = null; PK.tour = null; PK.ph = null; PK.pt = null; PK.big = null; PK.busy = true; PK.err = ''; PK.msg = ''; PK.cur = null; PK.form = null; PK.ride = false; render();
    callTo('/prokat', { action: 'points' }).then(function (r) {
      PK.busy = false;
      if (S.view !== 'prokat') return;
      if (!r || !r.ok) return openBuh();
      PK.points = Array.isArray(r.points) ? r.points : []; PK.total = r.total == null ? null : r.total; render(); pkRemLoad();
    });
  }
  function pkReload() {
    return callTo('/prokat', { action: 'points' }).then(function (r) {
      if (r && r.ok) { PK.points = Array.isArray(r.points) ? r.points : []; PK.total = r.total == null ? null : r.total; }
      if (S.view === 'prokat') render();
    });
  }
  function pkOpenPoint(name) {
    PK.cur = { name: name, loading: true }; PK.add = null; PK.ol = null; pkShLoad(name); pkPbLoad(name); PK.pt = null; PK.big = null; pkPhLoad(name); PK.err = ''; PK.msg = ''; PK.form = null; PK.ride = false; render();
    callTo('/prokat', { action: 'point', name: name }).then(function (r) {
      if (S.view !== 'prokat' || !PK.cur || PK.cur.name !== name) return;
      if (!r || !r.ok || !r.point) { PK.cur = { name: name, error: (r && r.error) || TX('не удалось загрузить') }; return render(); }
      PK.cur = r.point; render();
    });
  }
  function pkStatusColor(st) { return st === PK_ST.minus ? '#c0392b' : st === PK_ST.plus ? '#1f8a4c' : '#777'; }
  function pkBadge(st) { var c = pkStatusColor(st); return '<span style="flex:none;font-size:12px;padding:3px 8px;border-radius:10px;border:1px solid ' + c + ';color:' + c + '">' + esc(st || '—') + '</span>'; }
  function pkRow(label, val, bold) { return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.2)"><span>' + esc(label) + '</span><span style="white-space:nowrap' + (bold ? ';font-weight:700' : '') + '">' + val + '</span></div>'; }
  function pkBtn(k, text, sec, style) { return '<button type="button" class="btn' + (sec ? ' sec' : '') + '" data-pk="' + esc(k) + '"' + (style ? ' style="' + style + '"' : '') + '>' + text + '</button>'; }
  function renderProkat(el) {
    if (PK.busy) { el.innerHTML = backBtn() + '<h2 style="padding-right:36px">💼 ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')) + '</h2><p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (PK.tour) return renderPkTour(el);
    if (PK.pt) return renderPkToolHist(el);
    if (PK.cur) return renderPkPoint(el);
    if (PK.sk) return renderPkSklad(el);
    if (PK.all) return renderPkAll(el);
    if (PK.cmp) return renderPkCmp(el);
    if (PK.buy) return renderPkBuy(el);
    if (!PK.folder) return renderPkHome(el);
    var pts = PK.points.slice().sort(function (a, b) { return pkNum(a.profit) - pkNum(b.profit); });
    var plus = 0, minus = 0, idle = 0, sum = 0;
    pts.forEach(function (p) { if (p.status === PK_ST.plus) plus++; else if (p.status === PK_ST.minus) minus++; else idle++; sum += pkNum(p.profit); });
    var f = PK.filter, shown = pts.filter(function (p) { return f === 'all' || p.status === PK_ST[f]; });
    function chip(k, text, n) { var on = f === k; return pkBtn('f:' + k, esc(text) + ' (' + n + ')', !on, 'height:auto;padding:6px 12px;font-size:14px'); }
    el.innerHTML = pkBtn('home', '← ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')), true, 'margin-bottom:8px') + '<h2 style="padding-right:36px">🛠 ' + esc(ui('Прокат инструментов', 'Иҷораи асбобҳо', 'Asboblar ijarasi')) + '</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0">' +
        '<div style="padding:10px;border-radius:10px;background:rgba(31,138,76,.1)"><small>' + esc(TX('В плюсе')) + '</small><b style="display:block;font-size:22px;color:#1f8a4c">' + plus + '</b></div>' +
        '<div style="padding:10px;border-radius:10px;background:rgba(192,57,43,.1)"><small>' + esc(TX('В минусе')) + '</small><b style="display:block;font-size:22px;color:#c0392b">' + minus + '</b></div>' +
        '<div style="padding:10px;border-radius:10px;background:rgba(127,127,127,.12)"><small>' + esc(TX('Прибыль')) + '</small><b style="display:block;font-size:18px;color:' + (sum < 0 ? '#c0392b' : '#1f8a4c') + '">' + pkMoney(sum) + '</b></div>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + chip('all', TX('Все'), pts.length) + chip('minus', TX('В минусе'), minus) + chip('plus', TX('В плюсе'), plus) + chip('idle', TX('Нет движения'), idle) + '</div>' +
      pkBtn('ride', '🚗 ' + esc(TX('Объезд')), true, 'width:100%;margin-bottom:10px') +
      (PK.ride ? pkRideNote() : '') +
      '<div style="display:grid;gap:8px">' + (shown.length ? shown.map(function (p) {
        var i = PK.points.indexOf(p), pr = pkNum(p.profit);
        return '<button type="button" class="btn sec" data-pk="p:' + i + '" style="display:flex;align-items:center;gap:10px;text-align:left;height:auto;padding:12px;width:100%">' +
          '<span style="flex:1;min-width:0"><b style="display:block">' + esc(p.name) + '</b><small style="opacity:.75">' + esc(p.city || '') + (p.months ? ' · ' + esc(TX('месяцев')) + ': ' + esc(p.months) : '') + '<br>' + esc(pkVisit(p)) + '</small></span>' +
          '<span style="flex:none;text-align:right"><b style="display:block;color:' + (pr < 0 ? '#c0392b' : pr > 0 ? '#1f8a4c' : 'inherit') + '">' + pkMoney(pr) + '</b>' + pkBadge(p.status) +
            (pkNum(p.rent_owed) > 0 ? '<small style="display:block;margin-top:4px;color:#b26a00;font-weight:600;white-space:nowrap">' + esc(TX('к передаче')) + ': ' + pkMoney(p.rent_owed) + '</small>' : '') + '</span></button>';
      }).join('') : '<p style="opacity:.75">' + esc(TX('Нет пунктов')) + '</p>') + '</div>';
  }
  // Экран «Финансист» проката: напоминания, папка «Пункты» (внутри список пунктов со сводкой и фильтрами), «Склад», «Все инструменты» и «Сравнение пунктов».
  function renderPkHome(el) {
    var n = PK.total == null ? PK.points.length : PK.total;
    el.innerHTML = backBtn() + '<h2 style="padding-right:36px">💼 ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')) + '</h2>' + pkRemBlock() + '<div style="display:grid;gap:10px">' +
      '<button type="button" class="btn sec" data-pk="folder" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">📍</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(TX('Пункты')) + '</b><small style="opacity:.75">' + esc(TX('Пункты проката строительных инструментов')) + '</small></span><span style="flex:none;font-size:15px;font-weight:700;padding:3px 10px;border-radius:12px;background:rgba(127,127,127,.15)">' + esc(n) + '</span></button>' +
      '<button type="button" class="btn sec" data-pk="sklad" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">🏠</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(TX('Склад')) + '</b><small style="opacity:.75">' + esc(TX('Сломанные, в ремонте, на запчасти: фото и количество')) + '</small></span></button>' +
      '<button type="button" class="btn sec" data-pk="all" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">🧰</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(TX('Все инструменты')) + '</b><small style="opacity:.75">' + esc(TX('Перфораторы, болгарки, дрели и другие: где какой стоит')) + '</small></span></button>' +
      '<button type="button" class="btn sec" data-pk="cmp" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">📊</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(TX('Сравнение пунктов')) + '</b><small style="opacity:.75">' + esc(TX('Какой пункт лучше и что где простаивает')) + '</small></span></button>' +
      '<button type="button" class="btn sec" data-pk="buy" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">💵</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(TX('Закупка и окупаемость')) + '</b><small style="opacity:.75">' + esc(TX('Цена покупки каждого вида и сколько уже вернулось по пунктам')) + '</small></span></button></div>' +
      // Утренние напоминания приходят уведомлением на телефоны, где их включили (каждый день в 8:00, если есть что напомнить).
      (owner() ? '<p style="margin-top:12px"><button type="button" class="btn sec" data-pk="push" style="height:auto;min-height:36px;font-size:14px">🔔 ' + esc(TX('Присылать напоминания на этот телефон')) + '</button><small style="display:block;opacity:.75;margin-top:4px">' + esc(TX('Каждое утро в 8:00: где давно не было объезда, кто должен деньги, что долго сломано.')) + '</small></p>' : '') +
      (S.pushMsg ? '<p role="status" style="margin-top:10px">' + esc(S.pushMsg) + '</p>' : '');
  }
  // «Склад»: инструменты не на пунктах, в основном сломанные. У каждого вида своё фото, количество по состояниям и запчасти.
  var PK_SK_ST = ['сломан', 'в ремонте', 'починен', 'на запчасти'];
  var PK_SK_COL = { 'сломан': '#c0392b', 'в ремонте': '#b26a00', 'починен': '#1f8a4c', 'на запчасти': '#6b6b6b' };
  var PK_SK_KINDS = ['Болгарка большая', 'Болгарка малая', 'Отбойный молоток', 'Перфоратор большой', 'Перфоратор малый', 'Шуруповёрт', 'Дрель', 'Лобзик', 'Циркулярка', 'Бензопила', 'Компрессор', 'Сварочный аппарат', 'Вибратор', 'Краскопульт', 'Утюг для пластиковых труб', 'Строительный миксер'];
  var PK_SK_PH = {}; // фото видов: имя -> { date, url, busy }
  function pkSkOpen() {
    PK.sk = { loading: true, error: '', kinds: [], history: [], totals: {}, parts_total: 0, msg: '', cur: '', form: null }; PK.ride = false; render();
    pkSkLoad();
  }
  function pkSkLoad() {
    var sk = PK.sk;
    callTo('/prokat', { action: 'stock' }).then(function (r) {
      if (S.view !== 'prokat' || PK.sk !== sk) return;
      sk.loading = false;
      if (!r || !r.ok) sk.error = (r && r.error) || TX('не удалось загрузить');
      else { sk.error = ''; sk.kinds = Array.isArray(r.stock) ? r.stock : []; sk.history = Array.isArray(r.history) ? r.history : []; sk.totals = r.totals || {}; sk.parts_total = pkNum(r.parts_total); }
      render();
    });
  }
  function pkSkKind(name) { var k = String(name || '').toLowerCase(); return PK.sk.kinds.filter(function (g) { return String(g.name).toLowerCase() === k; })[0] || null; }
  function pkSkSt(g, s) { return g && g.states ? pkNum(g.states[s]) : 0; }
  // Фото вида грузится отдельно и только когда оно изменилось.
  function pkSkPhoto(g) {
    if (!g || !g.photo_date) return '';
    var c = PK_SK_PH[g.name];
    if (c && c.date === g.photo_date) return c.url || '';
    if (c && c.busy) return '';
    PK_SK_PH[g.name] = { date: g.photo_date, url: c ? c.url : '', busy: true };
    callTo('/prokat', { action: 'stock_photo_get', name: g.name }).then(function (r) {
      var e = PK_SK_PH[g.name]; e.busy = false;
      if (r && r.ok && /^data:image\/jpeg;base64,/.test(r.photo || '')) e.url = r.photo; // при ошибке не повторяем до следующего нового фото
      if (S.view === 'prokat' && PK.sk) render();
    });
    return c ? c.url || '' : '';
  }
  function pkSkImg(g, size) {
    var u = pkSkPhoto(g);
    return u ? '<img src="' + esc(u) + '" alt="" style="display:block;width:' + size + ';aspect-ratio:1;object-fit:cover;border-radius:10px">' : '<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:' + size + ';aspect-ratio:1;border-radius:10px;background:rgba(127,127,127,.15);font-size:34px">🧰</span>';
  }
  function pkSkChip(k, text, on, col) { return '<button type="button" data-pk="' + esc(k) + '" style="min-height:44px;padding:6px 10px;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;border:2px solid ' + col + ';background:' + (on ? col : 'transparent') + ';color:' + (on ? '#fff' : col) + '">' + esc(text) + '</button>'; }
  function pkSkHist(list) {
    return list.length ? list.slice(0, 30).map(function (x) {
      var d = pkNum(x.delta), what = x.state === 'фото' ? '📷 ' + TX('фото') : x.part ? '🔩 ' + x.part : TX(x.state || '');
      return pkRow(pkDay(x.date) + ' · ' + (x.name || '') + ' · ' + what + (x.note && x.note !== 'фото' ? ' · ' + x.note : ''), x.state === 'фото' ? '' : '<b style="color:' + (d < 0 ? '#c0392b' : '#1f8a4c') + '">' + (d > 0 ? '+' : d < 0 ? '−' : '') + esc(Math.abs(d)) + '</b>');
    }).join('') : '<p style="opacity:.75">' + esc(TX('Пока пусто')) + '</p>';
  }
  function renderPkSklad(el) {
    var sk = PK.sk;
    var h = pkBtn(sk.cur ? 'sk-list' : 'home', '← ' + esc(sk.cur ? TX('Склад') : ui('Финансист', 'Мутахассиси молия', 'Moliyachi')), true, 'margin-bottom:8px');
    if (sk.loading) return void (el.innerHTML = h + '<h2>🏠 ' + esc(TX('Склад')) + '</h2><p>' + esc(TX('Загрузка…')) + '</p>');
    if (sk.error) return void (el.innerHTML = h + '<h2>🏠 ' + esc(TX('Склад')) + '</h2><p style="color:#c0392b">' + esc(sk.error) + '</p>' + pkBtn('sk-retry', esc(TX('Ещё раз')), true));
    if (sk.cur) return void (el.innerHTML = h + renderPkSkKind(sk, pkSkKind(sk.cur) || { name: sk.cur, qty: 0, states: {}, parts: [], parts_qty: 0, photo_date: '' }));
    h += '<h2 style="padding-right:36px;margin-bottom:4px">🏠 ' + esc(TX('Склад')) + '</h2><p style="margin-top:0;opacity:.8">' + esc(TX('Инструменты не на пунктах: сломанные, в ремонте, на запчасти')) + '</p>';
    h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0">' + PK_SK_ST.map(function (s) {
      return '<div style="padding:10px;border-radius:10px;border:1px solid ' + PK_SK_COL[s] + '"><small>' + esc(TX(s)) + '</small><b style="display:block;font-size:22px;color:' + PK_SK_COL[s] + '">' + esc(pkNum(sk.totals[s])) + '</b></div>';
    }).join('') + '</div><p style="margin:0 0 10px">🔩 ' + esc(TX('Запчастей всего')) + ': <b>' + esc(sk.parts_total) + '</b></p>';
    if (sk.msg) h += '<p role="status" style="color:#1f8a4c;margin:0 0 8px">' + esc(sk.msg) + '</p>';
    h += sk.form && sk.form.mode === 'new' ? pkSkNewForm(sk.form) : pkBtn('sk-new', '➕ ' + esc(TX('Новый инструмент')), false, 'width:100%;margin-bottom:10px');
    h += sk.kinds.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' + sk.kinds.map(function (g, i) {
      var line = PK_SK_ST.filter(function (s) { return pkSkSt(g, s); }).map(function (s) { return '<span style="color:' + PK_SK_COL[s] + '">' + esc(TX(s)) + ' ' + pkSkSt(g, s) + '</span>'; }).join(' · ');
      return '<button type="button" data-pk="sk-k:' + i + '" style="display:block;padding:8px;border:1px solid rgba(127,127,127,.35);border-radius:12px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer">' + pkSkImg(g, '100%') +
        '<b style="display:block;margin-top:6px">' + esc(g.name) + '</b><span style="display:block;font-size:20px;font-weight:700">' + esc(pkNum(g.qty)) + ' <small style="font-size:13px;font-weight:400">' + esc(TX('шт.')) + '</small></span>' +
        (line ? '<small style="display:block;line-height:1.35">' + line + '</small>' : '') + (pkNum(g.parts_qty) ? '<small style="display:block;opacity:.8">🔩 ' + esc(TX('запчастей')) + ': ' + esc(g.parts_qty) + '</small>' : '') + '</button>';
    }).join('') + '</div>' : '<p style="opacity:.75">' + esc(TX('На складе пока пусто. Нажмите «Новый инструмент»: сфотографируйте его и укажите количество.')) + '</p>';
    h += '<h3 style="margin:16px 0 6px">' + esc(TX('История')) + '</h3>' + pkSkHist(sk.history);
    el.innerHTML = h;
  }
  function pkSkPhotoBtn(F, label) {
    return '<label style="display:flex;align-items:center;gap:10px;margin:0 0 8px;min-height:48px;padding:6px 10px;border:2px ' + (F.photo ? 'solid #1f8a4c' : 'dashed rgba(127,127,127,.5)') + ';border-radius:10px;cursor:pointer;font-weight:600">' +
      (F.photo ? '<img src="' + esc(F.photo) + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px">' : '📷') +
      '<span>' + esc(F.wait ? TX('Обрабатываю фото…') : F.photo ? TX('Фото готово, нажмите, чтобы переснять') : label) + '</span>' +
      '<input type="file" accept="image/*" capture="environment" data-skphoto="1" style="position:absolute;width:1px;height:1px;opacity:0"></label>';
  }
  function pkSkFormEnd(F) {
    return (F.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(F.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('sk-save', esc(TX(F.busy ? 'Сохраняю…' : 'Сохранить')), false, F.busy ? 'opacity:.6' : '') + pkBtn('sk-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkSkQty(F) { return '<label style="display:block;margin-bottom:8px">' + esc(TX('Количество')) + '<input id="pk-sk-qty" type="text" inputmode="numeric" autocomplete="off" value="' + esc(F.qty) + '" style="display:block;width:100%;font-size:20px"></label>'; }
  function pkSkNote(F) { return '<label style="display:block;margin-bottom:8px">' + esc(TX('Заметка')) + '<input id="pk-sk-note" type="text" maxlength="80" autocomplete="off" value="' + esc(F.note) + '" style="display:block;width:100%"></label>'; }
  function pkSkStates(F, key, cur, skip) {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">' + PK_SK_ST.map(function (s, i) { return s === skip ? '' : pkSkChip('sk-' + key + ':' + i, TX(s), cur === s, PK_SK_COL[s]); }).join('') + '</div>';
  }
  function pkSkNewForm(F) {
    var names = PK_SK_KINDS.concat(PK.sk.kinds.map(function (g) { return g.name; })).filter(function (v, i, a) { return a.indexOf(v) === i; });
    return '<div style="margin:0 0 12px;padding:12px;border-radius:12px;border:1px solid rgba(127,127,127,.35)"><b style="display:block;margin-bottom:8px">' + esc(TX('Новый инструмент')) + '</b>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Название')) + '<input id="pk-sk-name" type="text" list="pk-sk-names" maxlength="60" autocomplete="off" placeholder="' + esc(TX('Например: Болгарка большая')) + '" value="' + esc(F.name) + '" style="display:block;width:100%"></label>' +
      '<datalist id="pk-sk-names">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      pkSkPhotoBtn(F, TX('Сфотографировать инструмент')) + '<b style="display:block;margin-bottom:4px">' + esc(TX('Состояние')) + '</b>' + pkSkStates(F, 'st', F.state) + pkSkQty(F) + pkSkFormEnd(F);
  }
  function renderPkSkKind(sk, g) {
    var F = sk.form, ph = pkSkPhoto(g);
    var h = '<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><div style="flex:none;width:96px">' + pkSkImg(g, '96px') + '</div><div style="min-width:0"><h2 style="margin:0">' + esc(g.name) + '</h2><b style="font-size:20px">' + esc(pkNum(g.qty)) + '</b> ' + esc(TX('шт.')) +
      (g.photo_date ? '<small style="display:block;opacity:.7">' + esc(TX('фото от')) + ' ' + esc(pkDay(g.photo_date)) + '</small>' : '') + '</div></div>';
    if (ph) h += '<img src="' + esc(ph) + '" alt="' + esc(g.name) + '" style="display:block;width:100%;max-height:320px;object-fit:contain;border-radius:12px;margin-bottom:8px">';
    if (sk.msg) h += '<p role="status" style="color:#1f8a4c;margin:0 0 8px">' + esc(sk.msg) + '</p>';
    h += PK_SK_ST.map(function (s) { return pkRow(TX(s), '<b style="color:' + PK_SK_COL[s] + '">' + pkSkSt(g, s) + '</b> ' + esc(TX('шт.'))); }).join('');
    if (F && F.mode !== 'new' && F.mode !== 'p+' && F.mode !== 'p-') {
      var title = { add: TX('Добавить на склад'), del: TX('Убрать со склада'), move: TX('Сменить состояние'), photo: TX('Фото инструмента') }[F.mode];
      h += '<div style="margin:12px 0;padding:12px;border-radius:12px;border:1px solid rgba(127,127,127,.35)"><b style="display:block;margin-bottom:8px">' + esc(title) + '</b>';
      if (F.mode === 'photo') h += pkSkPhotoBtn(F, TX('Сфотографировать инструмент'));
      else if (F.mode === 'move') h += '<b style="display:block;margin-bottom:4px">' + esc(TX('Было')) + '</b>' + pkSkStates(F, 'st', F.state) + '<b style="display:block;margin-bottom:4px">' + esc(TX('Стало')) + '</b>' + pkSkStates(F, 'to', F.to, F.state) + pkSkQty(F) + pkSkNote(F);
      else h += '<b style="display:block;margin-bottom:4px">' + esc(TX('Состояние')) + '</b>' + pkSkStates(F, 'st', F.state) + pkSkQty(F) + pkSkNote(F);
      h += pkSkFormEnd(F);
    } else if (!F) {
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0">' + pkBtn('sk-f:add', '➕ ' + esc(TX('Добавить')), false, 'height:auto;padding:10px') + pkBtn('sk-f:del', '➖ ' + esc(TX('Убрать')), true, 'height:auto;padding:10px') +
        pkBtn('sk-f:move', '🔁 ' + esc(TX('Сменить состояние')), true, 'height:auto;padding:10px') + pkBtn('sk-f:photo', '📷 ' + esc(TX(g.photo_date ? 'Сменить фото' : 'Добавить фото')), true, 'height:auto;padding:10px') + '</div>' +
        (PK.mv && PK.mv.ctx === 'sk' ? pkMoveForm() : '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:10px">' + pkBtn('sk-mv', '🚚 ' + esc(TX('Отвезти на пункт')), true) + pkBtn('sk-sell', '💰 ' + esc(TX('Продать')), true) + '</div>');
    }
    h += '<h3 style="margin:16px 0 6px">🔩 ' + esc(TX('Запчасти')) + ' <span style="font-size:15px;padding:2px 9px;border-radius:12px;background:rgba(127,127,127,.15)">' + esc(pkNum(g.parts_qty)) + '</span></h3>';
    h += (g.parts && g.parts.length ? g.parts.map(function (p) { return pkRow(p.name, '<b>' + esc(p.qty) + '</b> ' + esc(TX('шт.'))); }).join('') : '<p style="opacity:.75;margin:0">' + esc(TX('Запчастей пока нет')) + '</p>');
    if (F && (F.mode === 'p+' || F.mode === 'p-')) {
      h += '<div style="margin:12px 0;padding:12px;border-radius:12px;border:1px solid rgba(127,127,127,.35)"><b style="display:block;margin-bottom:8px">' + esc(F.mode === 'p+' ? TX('Добавить запчасть') : TX('Списать запчасть')) + '</b>' +
        '<label style="display:block;margin-bottom:8px">' + esc(TX('Запчасть')) + '<input id="pk-sk-part" type="text" list="pk-sk-parts" maxlength="60" autocomplete="off" placeholder="' + esc(TX('Например: щётки, якорь, поршень')) + '" value="' + esc(F.part) + '" style="display:block;width:100%"></label>' +
        '<datalist id="pk-sk-parts">' + (g.parts || []).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('') + '</datalist>' + pkSkQty(F) + pkSkNote(F) + pkSkFormEnd(F);
    } else if (!F) {
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0">' + pkBtn('sk-f:p+', '➕ ' + esc(TX('Запчасть')), true, 'height:auto;padding:10px') + pkBtn('sk-f:p-', '➖ ' + esc(TX('Списать')), true, 'height:auto;padding:10px') + '</div>';
    }
    h += '<h3 style="margin:16px 0 6px">' + esc(TX('История')) + '</h3>' + pkSkHist(sk.history.filter(function (x) { return String(x.name).toLowerCase() === String(g.name).toLowerCase(); }));
    return h;
  }
  function pkSkKeep() {
    var F = PK.sk && PK.sk.form; if (!F) return;
    var a = $s('pk-sk-name'), q = $s('pk-sk-qty'), n = $s('pk-sk-note'), p = $s('pk-sk-part');
    if (a) F.name = a.value; if (q) F.qty = q.value; if (n) F.note = n.value; if (p) F.part = p.value;
  }
  // Маленькое фото для склада: до 60 000 знаков, чтобы хранилось прямо в таблице.
  function pkSkThumb(file) {
    return pkShrink(file).then(function (url) {
      return new Promise(function (ok, fail) {
        var img = new Image();
        img.onerror = function () { fail(new Error(TX('Не получилось открыть фото'))); };
        img.onload = function () {
          var tries = [[480, 0.6], [400, 0.55], [340, 0.5], [280, 0.45], [220, 0.4]], W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
          for (var i = 0; i < tries.length; i++) {
            var w = Math.min(tries[i][0], W), h = Math.round(H * w / W), c = document.createElement('canvas'); c.width = w; c.height = h;
            var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
            var u = c.toDataURL('image/jpeg', tries[i][1]);
            if (/^data:image\/jpeg;base64,/.test(u) && u.length <= 58000) return ok(u);
          }
          fail(new Error(TX('Фото слишком большое. Сделайте снимок ещё раз.')));
        };
        img.src = url;
      });
    });
  }
  function pkSkForm(mode, extra) {
    var F = { mode: mode, name: '', state: mode === 'move' ? '' : 'сломан', to: '', qty: '', note: '', part: '', photo: '', wait: false, busy: false, err: '', id: oid(), pid: oid() };
    for (var k in extra || {}) F[k] = extra[k];
    PK.sk.form = F; PK.sk.msg = ''; render();
  }
  function pkSkInt(raw) { raw = String(raw || '').replace(/\s/g, ''); return /^\d{1,6}$/.test(raw) && +raw > 0 ? +raw : 0; }
  function pkSkSave() {
    var sk = PK.sk, F = sk && sk.form; if (!F || F.busy) return;
    pkSkKeep(); F.err = '';
    if (F.wait) { F.err = TX('Подождите, фото ещё обрабатывается'); return render(); }
    var name = F.mode === 'new' ? String(F.name).replace(/\s+/g, ' ').trim().slice(0, 60) : sk.cur, qty = pkSkInt(F.qty), calls = [];
    if (!name) { F.err = TX('Введите название'); return render(); }
    if (F.mode === 'photo' || (F.mode === 'new' && F.photo)) {
      if (!F.photo) { F.err = TX('Сделайте фото'); return render(); }
      calls.push({ action: 'stock_photo', name: name, photo: F.photo, id: F.pid });
    }
    if (F.mode !== 'photo') {
      var raw = String(F.qty || '').trim();
      if (!(F.mode === 'new' && !raw && F.photo)) {
        if (!qty) { F.err = TX('Количество — целое число больше нуля'); return render(); }
        var note = String(F.note || '').trim().slice(0, 80);
        if (F.mode === 'move') {
          if (!F.state || !F.to) { F.err = TX('Выберите, какое было состояние и какое стало'); return render(); }
          calls.push({ action: 'stock_state', name: name, from: F.state, to: F.to, qty: qty, note: note, id: F.id });
        } else if (F.mode === 'p+' || F.mode === 'p-') {
          var part = String(F.part || '').replace(/\s+/g, ' ').trim().slice(0, 60);
          if (!part) { F.err = TX('Введите название запчасти'); return render(); }
          calls.push({ action: 'stock_move', name: name, part: part, delta: F.mode === 'p-' ? -qty : qty, note: note, id: F.id });
        } else {
          if (PK_SK_ST.indexOf(F.state) < 0) { F.err = TX('Выберите состояние'); return render(); }
          calls.push({ action: 'stock_move', name: name, state: F.state, delta: F.mode === 'del' ? -qty : qty, note: note, id: F.id });
        }
      }
    }
    F.busy = true; render();
    // У каждой записи свой id: повтор после обрыва связи не задвоит её, а уже сохранённая часть пропускается.
    (function next(i) {
      if (PK.sk !== sk || sk.form !== F) return;
      if (i >= calls.length) {
        sk.form = null; sk.msg = TX('Записано') + ': ' + name;
        if (F.mode === 'new') sk.cur = name;
        if (F.photo) PK_SK_PH[name] = { date: '', url: F.photo, busy: false };
        render(); return pkSkLoad();
      }
      callTo('/prokat', calls[i]).then(function (r) {
        if (PK.sk !== sk || sk.form !== F) return;
        if (!r || !r.ok) {
          F.busy = false; F.err = (r && r.error) || TX('Не получилось сохранить');
          if (r && r.error && r.error !== TX('нет связи')) { if (calls[i].action === 'stock_photo') F.pid = oid(); else F.id = oid(); }
          return render();
        }
        if (r.name && F.mode === 'new') name = r.name;
        next(i + 1);
      });
    })(0);
  }
  function pkSkClick(k) {
    var sk = PK.sk; if (!sk || k.indexOf('sk-') !== 0) return false;
    if (k === 'sk-retry') { sk.loading = true; sk.error = ''; render(); pkSkLoad(); return true; }
    if (sk.form && sk.form.busy) return true;
    if (k === 'sk-list') { sk.cur = ''; sk.form = null; sk.msg = ''; PK.mv = null; render(); return true; }
    if (k.indexOf('sk-k:') === 0) { var g = sk.kinds[+k.slice(5)]; if (g) { sk.cur = g.name; sk.form = null; sk.msg = ''; render(); } return true; }
    if (k === 'sk-new') { pkSkForm('new'); return true; }
    if (k === 'sk-mv') { if (sk.cur) pkMoveOpen('Склад', sk.cur, 'sk'); return true; }
    if (k === 'sk-sell') { if (sk.cur) pkMoveOpen('Склад', sk.cur, 'sk', true); return true; }
    if (k.indexOf('sk-f:') === 0) { var m = k.slice(5); if (['add', 'del', 'move', 'photo', 'p+', 'p-'].indexOf(m) >= 0) pkSkForm(m); return true; }
    if (k === 'sk-cancel') { sk.form = null; render(); return true; }
    if (k === 'sk-save') { pkSkSave(); return true; }
    if (k.indexOf('sk-st:') === 0 || k.indexOf('sk-to:') === 0) {
      var F = sk.form, s = PK_SK_ST[+k.slice(6)]; if (!F || !s) return true;
      pkSkKeep();
      if (k.indexOf('sk-st:') === 0) { F.state = s; if (F.to === s) F.to = ''; } else F.to = s;
      F.err = ''; render(); return true;
    }
    return true;
  }
  document.addEventListener('change', function (e) {
    var t = e.target, F = PK.sk && PK.sk.form; if (!F || !t || !t.getAttribute || t.getAttribute('data-skphoto') == null) return;
    var file = t.files && t.files[0]; if (!file || F.busy) return;
    pkSkKeep(); F.wait = true; F.err = ''; render();
    pkSkThumb(file).then(function (url) { F.photo = url; F.pid = oid(); }, function (er) { F.err = er.message; }).then(function () { F.wait = false; if (PK.sk && PK.sk.form === F) render(); });
  });
  // Объезд: список пунктов, сверху те, где объезда не было или он был давно. Нажал на пункт — сразу начинается объезд.
  function pkRideDays(p) { return p && p.last_visit ? pkNum(p.visit_days) : 100000; }
  function pkRideNote() {
    var pts = PK.points.slice().sort(function (a, b) { return pkRideDays(b) - pkRideDays(a) || String(a.name).localeCompare(String(b.name), 'ru'); });
    return '<div style="margin:0 0 10px;padding:10px;border-radius:12px;background:rgba(127,127,127,.12)"><b style="display:block;margin-bottom:6px">' + esc(TX('Выберите пункт, чтобы начать объезд')) + '</b><div style="display:grid;gap:6px">' +
      (pts.length ? pts.map(function (p) {
        return pkBtn('ride-p:' + PK.points.indexOf(p), '🚗 <b>' + esc(p.name) + '</b><small style="display:block;opacity:.75">' + esc(pkVisit(p)) + '</small>', true, 'height:auto;padding:10px;text-align:left;width:100%');
      }).join('') : '<p style="opacity:.75;margin:0">' + esc(TX('Нет пунктов')) + '</p>') + '</div></div>';
  }
  function renderPkPoint(el) {
    var p = PK.cur, back = pkBtn('back', '← ' + esc(TX('К списку пунктов')), true, 'margin-bottom:8px');
    if (p.loading) { el.innerHTML = back + '<h2 style="padding-right:36px">' + esc(p.name) + '</h2><p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (p.error) { el.innerHTML = back + '<h2 style="padding-right:36px">' + esc(p.name) + '</h2><p style="color:#c0392b">' + esc(p.error) + '</p>' + pkBtn('p-retry', esc(TX('Ещё раз')), true); return; }
    var inc = pkNum(p.income), pr = pkNum(p.profit);
    var months = Array.isArray(p.months) ? p.months : [], journal = Array.isArray(p.journal) ? p.journal : [], fills = Array.isArray(p.fills) ? p.fills : [];
    var phones = Array.isArray(p.phones) ? p.phones.join(', ') : (p.phones || '');
    var h = back + '<h2 style="padding-right:36px;margin-bottom:4px">' + esc(p.name) + '</h2>' +
      '<p style="margin:0 0 8px;opacity:.8">' + esc(p.city || '') + (p.owner ? ' · ' + esc(TX('Владелец')) + ': ' + esc(p.owner) : '') + (phones ? ' · ' + esc(phones) : '') + '<br>🚗 ' + esc(pkVisit(p)) + '</p>' +
      (p.note ? '<p style="margin:0 0 8px">' + esc(p.note) + '</p>' : '') +
      '<div style="margin-bottom:8px">' + pkBadge(p.status) + '</div>' +
      pkRow(TX('Доход (наша доля 80%)'), pkMoney(inc)) +
      pkRow(TX('Закупка'), pkMoney(p.purchase)) +
      pkRow(TX('Дорога'), pkMoney(p.road)) +
      pkRow(TX('Ремонт'), pkMoney(p.repair)) +
      pkRow(TX('Чистая прибыль'), '<span style="color:' + (pr < 0 ? '#c0392b' : '#1f8a4c') + '">' + pkMoney(pr) + '</span>', true) +
      '<p style="margin:10px 0 4px;opacity:.75"><small>' + esc(TX('Расчётные цифры')) + '</small></p>' +
      pkRow(TX('Вся аренда (доход / 0,8)'), pkMoney(inc / 0.8)) +
      pkRow(TX('Доля владельца пункта (доход / 4)'), pkMoney(inc / 4)) +
      pkRow(TX('Уже забрано'), pkMoney(p.taken), true) +
      pkRentBlock(p.rent) + pkPbBlock() + pkShBlock();
    if (PK.msg) h += '<p style="color:#1f8a4c;margin:10px 0 0">' + esc(PK.msg) + '</p>';
    if (PK.form) h += pkForm();
    else h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">' + pkBtn('take', '💵 ' + esc(TX('Забрал деньги'))) + pkBtn('tour', '🚗 ' + esc(TX('Начать объезд')), true) + '</div>';
    if (!PK.form) h += PK.add ? pkAddForm() : pkBtn('add-open', '➕ ' + esc(TX('Добавить инструмент')), true, 'width:100%;margin-top:8px');
    h += pkOlBlock();
    h += pkPhBlock();
    h += '<h3 style="margin:16px 0 6px">' + esc(TX('По месяцам')) + '</h3>';
    h += months.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>' +
      [TX('Месяц'), TX('Доход'), TX('Закупка'), TX('Дорога'), TX('Ремонт'), TX('Прибыль')].map(function (t, k) { return '<th style="padding:4px 6px;text-align:' + (k ? 'right' : 'left') + '">' + esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      months.map(function (m) {
        var mp = pkNum(m.profit), td = 'padding:4px 6px;text-align:right;border-top:1px solid rgba(127,127,127,.2);white-space:nowrap';
        return '<tr><td style="padding:4px 6px;border-top:1px solid rgba(127,127,127,.2);white-space:nowrap">' + esc(/^\d{4}-\d{2}/.test(m.month || '') ? monthName(String(m.month).slice(0, 7)) : (m.month || '')) + '</td><td style="' + td + '">' + pkMoney(m.income) + '</td><td style="' + td + '">' + pkMoney(m.purchase) + '</td><td style="' + td + '">' + pkMoney(m.road) + '</td><td style="' + td + '">' + pkMoney(m.repair) + '</td><td style="' + td + ';font-weight:700;color:' + (mp < 0 ? '#c0392b' : 'inherit') + '">' + pkMoney(mp) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p style="opacity:.75">' + esc(TX('Пока нет данных')) + '</p>';
    if (fills.length) h += '<h3 style="margin:16px 0 6px">' + esc(TX('Пополнения')) + '</h3>' + fills.map(function (x) { return x && typeof x === 'object' ? pkRow((x.date || '') + (x.note ? ' · ' + x.note : ''), x.amount != null ? pkMoney(x.amount) : '') : pkRow(String(x), ''); }).join('');
    h += '<h3 style="margin:16px 0 6px">' + esc(TX('Журнал: забранные деньги')) + '</h3>';
    h += journal.length ? journal.map(function (j) { return pkRow((j.date || '') + (j.note ? ' · ' + j.note : ''), pkMoney(j.amount)); }).join('') : '<p style="opacity:.75">' + esc(TX('Пока ничего не забирали')) + '</p>';
    el.innerHTML = h + pkBigPhoto();
  }
  // Аренды, которые владелец пункта записал в своём окне (/punkt): сколько собрал и сколько должен передать Нурулло.
  function pkRentBlock(r) {
    if (!r || typeof r !== 'object') return '';
    var hos = (Array.isArray(r.handovers) ? r.handovers : []).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var owed = pkNum(r.owed);
    return '<h3 style="margin:16px 0 6px">🔑 ' + esc(TX('Аренда через окно владельца')) + '</h3>' +
      pkRow(TX('Аренд'), esc(pkNum(r.count))) +
      pkRow(TX('Собрано владельцем'), pkMoney(r.collected)) +
      pkRow(TX('Доля владельца'), pkMoney(r.owner_share)) +
      pkRow(TX('К передаче Нурулло'), '<span style="color:' + (owed > 0 ? '#b26a00' : 'inherit') + '">' + pkMoney(owed) + '</span>', true) +
      pkRow(TX('Уже передано'), pkMoney(r.handed)) +
      '<p style="margin:10px 0 4px;opacity:.75"><small>' + esc(TX('Передачи')) + '</small></p>' +
      (hos.length ? hos.map(function (x) { return pkRow(/^\d{4}-\d{2}-\d{2}/.test(x.date || '') ? String(x.date).slice(8, 10) + '.' + String(x.date).slice(5, 7) + '.' + String(x.date).slice(0, 4) : (x.date || ''), pkMoney(x.amount)); }).join('') : '<p style="opacity:.75;margin:4px 0">' + esc(TX('Передач пока не было')) + '</p>');
  }
  function pkForm() {
    var F = PK.form;
    return '<div style="margin-top:12px;padding:12px;border-radius:12px;border:1px solid rgba(127,127,127,.35)">' +
      '<b style="display:block;margin-bottom:8px">💵 ' + esc(TX('Забрал деньги')) + '</b>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Сумма')) + '<input id="pk-sum" type="text" inputmode="decimal" autocomplete="off" value="' + esc(F.sum) + '" style="display:block;width:100%;font-size:20px"></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + Object.keys(PK_PAY).map(function (k) { return pkBtn('m:' + k, esc(TX(PK_PAY[k])), F.method !== k, 'height:auto;padding:8px 12px'); }).join('') + '</div>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Заметка')) + '<input id="pk-note" type="text" maxlength="200" autocomplete="off" value="' + esc(F.note) + '" style="display:block;width:100%"></label>' +
      (PK.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(PK.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + pkBtn('save', esc(TX(F.busy ? 'Сохраняю…' : 'Сохранить')), false, F.busy ? 'opacity:.6' : '') + pkBtn('cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkKeep() { if (!PK.form) return; var s = $s('pk-sum'), n = $s('pk-note'); if (s) PK.form.sum = s.value; if (n) PK.form.note = n.value; }
  function pkSave() {
    var F = PK.form; if (!F || F.busy || !PK.cur) return;
    pkKeep();
    var amount = parseFloat(String(F.sum).replace(/\s/g, '').replace(',', '.'));
    if (!(amount > 0)) { PK.err = TX('Введите сумму'); return render(); }
    F.busy = true; PK.err = ''; render();
    var name = PK.cur.name;
    // id создан при открытии формы: повторное нажатие после обрыва связи не создаст вторую запись.
    callTo('/prokat', { action: 'collect', name: name, amount: Math.round(amount * 100) / 100, method: F.method, note: String(F.note || '').trim().slice(0, 200), id: F.id }).then(function (r) {
      if (!PK.form || PK.form.id !== F.id) return;
      F.busy = false;
      if (!r || !r.ok) { PK.err = (r && r.error) || TX('Не получилось сохранить'); return render(); }
      PK.form = null; PK.msg = TX('Записано') + ': ' + pkMoney(amount);
      if (PK.cur && PK.cur.name === name && r.taken != null) PK.cur.taken = r.taken;
      render(); pkOpenPointQuiet(name); pkReload();
    });
  }
  function pkOpenPointQuiet(name) {
    callTo('/prokat', { action: 'point', name: name }).then(function (r) {
      if (S.view !== 'prokat' || !PK.cur || PK.cur.name !== name || !r || !r.ok || !r.point) return;
      PK.cur = r.point; if (!PK.form) render();
    });
  }
  /* ---------- Закупка и окупаемость: цена покупки каждого вида, сколько вернулось по пунктам ---------- */
  function pkPctTxt(x) { return x == null ? '—' : pkNum(x) + '%'; }
  function pkPctColor(x) { return x == null ? '#777' : x >= 100 ? '#1f8a4c' : x >= 50 ? '#b7860b' : '#c0392b'; }
  function pkBuyOpen() {
    var b = PK.buy = { loading: 2, kinds: [], unknown: [], all: null, error: '', edit: null, msg: '' }; render();
    var done = function () { b.loading--; if (PK.buy === b && S.view === 'prokat') render(); };
    callTo('/prokat', { action: 'buy_prices' }).then(function (r) { if (PK.buy !== b) return; if (!r || !r.ok) b.error = (r && r.error) || TX('не удалось загрузить'); else { b.kinds = r.kinds || []; b.unknown = r.unknown || []; } done(); });
    callTo('/prokat', { action: 'payback_all' }).then(function (r) { if (PK.buy !== b) return; if (r && r.ok) b.all = r; done(); });
  }
  function renderPkBuy(el) {
    var b = PK.buy, h = pkBtn('home', '← ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')), true, 'margin-bottom:8px') + '<h2 style="padding-right:36px">💵 ' + esc(TX('Закупка и окупаемость')) + '</h2>';
    if (b.loading > 0) return void (el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>');
    if (b.error) return void (el.innerHTML = h + '<p style="color:#c0392b">' + esc(b.error) + '</p>' + pkBtn('buy', esc(TX('Ещё раз')), true));
    if (b.msg) h += '<p role="status" style="color:#1f8a4c;margin:0 0 8px">' + esc(b.msg) + '</p>';
    var A = b.all;
    if (A && A.prices_set > 0) {
      h += '<div style="padding:12px;border-radius:12px;background:rgba(127,127,127,.1);margin-bottom:12px"><b>' + esc(TX('Вся сеть')) + ': <span style="color:' + pkPctColor(A.percent) + '">' + esc(pkPctTxt(A.percent)) + '</span> ' + esc(TX('окупилось')) + '</b><br><small>' + esc(TX('Инструменты стоят')) + ' ' + pkMoney(A.cost) + ', ' + esc(TX('вернулось')) + ' ' + pkMoney(A.back) + '</small></div>';
      h += '<h3 style="margin:12px 0 6px">' + esc(TX('Пункты: от худшего к лучшему')) + '</h3>' + (A.points || []).map(function (p, i) {
        return '<button type="button" data-pk="pbp:' + i + '" style="display:flex;justify-content:space-between;gap:8px;width:100%;padding:8px 0;border:0;border-top:1px solid rgba(127,127,127,.2);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer"><span>' + esc(p.name) + (p.no_price ? ' <small style="opacity:.7">(' + esc(TX('без цены')) + ': ' + esc(p.no_price) + ')</small>' : '') + '</span><b style="color:' + pkPctColor(p.percent) + '">' + esc(pkPctTxt(p.percent)) + '</b></button>';
      }).join('');
    } else h += '<p style="padding:10px;border-radius:10px;background:rgba(183,134,11,.12)">' + esc(TX('Впишите ниже, за сколько покупали каждый вид инструмента — и здесь появится, сколько уже окупилось по каждому пункту.')) + '</p>';
    h += '<h3 style="margin:16px 0 6px">' + esc(TX('Цена покупки одного инструмента')) + '</h3>';
    h += b.kinds.map(function (k, i) {
      var E = b.edit && b.edit.i === i ? b.edit : null;
      if (E) return '<div style="padding:10px 0;border-top:1px solid rgba(127,127,127,.2)"><b>' + esc(TX(k.kind)) + '</b><input id="pk-buy-price" type="text" inputmode="decimal" autocomplete="off" value="' + esc(E.price) + '" placeholder="' + esc(TX('сомони')) + '" style="display:block;width:100%;margin:6px 0;font-size:20px">' + (E.err ? '<p style="color:#c0392b;margin:0 0 6px">' + esc(E.err) + '</p>' : '') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('buy-save', esc(TX(E.busy ? 'Сохраняю…' : 'Сохранить')), false, E.busy ? 'opacity:.6' : '') + pkBtn('buy-cancel', esc(TX('Отмена')), true) + '</div></div>';
      return '<button type="button" data-pk="buy-e:' + i + '" style="display:flex;justify-content:space-between;gap:8px;width:100%;padding:10px 0;border:0;border-top:1px solid rgba(127,127,127,.2);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer"><span>' + esc(TX(k.kind)) + (k.on_points ? ' <small style="opacity:.7">· ' + esc(TX('на пунктах')) + ': ' + esc(k.on_points) + '</small>' : '') + '</span><b>' + (k.price == null ? '<span style="color:#b7860b">' + esc(TX('вписать')) + '</span>' : pkMoney(k.price)) + '</b></button>';
    }).join('');
    if (b.unknown.length) h += '<p style="margin:12px 0 4px;opacity:.8"><small>' + esc(TX('Не понял вид — цена к ним не применится. Уточните название в фото-истории («Это другой инструмент»):')) + ' ' + esc(b.unknown.slice(0, 15).map(function (u) { return u.name + (u.qty > 1 ? ' × ' + u.qty : ''); }).join(', ')) + (b.unknown.length > 15 ? '…' : '') + '</small></p>';
    el.innerHTML = h;
  }
  function pkBuyClick(k) {
    var b = PK.buy;
    if (k === 'buy') { PK.cur = null; PK.ol = null; PK.sh = null; PK.pb = null; PK.ph = null; PK.form = null; pkBuyOpen(); return true; }
    if (!b) return false;
    if (k.indexOf('pbp:') === 0) { var pp = b.all && b.all.points[+k.slice(4)]; if (pp) pkOpenPoint(pp.name); return true; }
    if (k.indexOf('buy-e:') === 0) { var kk = b.kinds[+k.slice(6)]; if (kk && !(b.edit && b.edit.busy)) { b.edit = { i: +k.slice(6), price: kk.price == null ? '' : String(kk.price).replace('.', ','), id: oid(), busy: false, err: '' }; b.msg = ''; render(); var pi = $s('pk-buy-price'); if (pi) pi.focus(); } return true; }
    if (k === 'buy-cancel') { if (b.edit && !b.edit.busy) { b.edit = null; render(); } return true; }
    if (k === 'buy-save') {
      var E = b.edit; if (!E || E.busy) return true;
      var inp = $s('pk-buy-price'); if (inp) E.price = inp.value;
      var v = Number(String(E.price || '').replace(/\s/g, '').replace(',', '.'));
      if (String(E.price || '').trim() === '' || !(v >= 0)) { E.err = TX('Впишите цену в сомони'); render(); return true; }
      var kind = b.kinds[E.i].kind; E.busy = true; E.err = ''; render();
      callTo('/prokat', { action: 'buy_price_set', kind: kind, price: Math.round(v * 100) / 100, id: E.id }).then(function (r) {
        if (PK.buy !== b || b.edit !== E) return;
        E.busy = false;
        if (!r || !r.ok) { E.err = (r && r.error) || TX('Не получилось сохранить'); return render(); }
        var msg = TX('Сохранено') + ': ' + TX(kind) + ' — ' + pkMoney(v);
        pkBuyOpen(); PK.buy.msg = msg;
      });
      return true;
    }
    return false;
  }
  // Окупаемость в карточке пункта: стоимость инструментов по закупочным ценам против того, что пункт уже принёс.
  function pkPbLoad(name) {
    var pb = PK.pb = { name: name, loading: true, data: null };
    callTo('/prokat', { action: 'payback', name: name }).then(function (r) { if (PK.pb !== pb) return; pb.loading = false; pb.data = r && r.ok ? r : null; if (S.view === 'prokat' && PK.cur && PK.cur.name === name) render(); });
  }
  function pkPbBlock() {
    var pb = PK.pb; if (!pb || !PK.cur || pb.name !== PK.cur.name || pb.loading || !pb.data) return '';
    var d = pb.data, h = '<h3 style="margin:16px 0 6px">💵 ' + esc(TX('Окупаемость')) + '</h3>';
    if (!(d.cost > 0)) return h + '<p style="opacity:.8">' + esc(TX('Нет закупочных цен для инструментов этого пункта.')) + ' ' + pkBtn('buy', esc(TX('Вписать цены')), true, 'height:auto;padding:6px 12px;font-size:14px') + '</p>';
    h += '<p style="margin:0 0 6px;font-size:18px"><b style="color:' + pkPctColor(d.percent) + '">' + esc(pkPctTxt(d.percent)) + '</b> ' + esc(TX('окупилось')) + '</p>' +
      pkRow(TX('Инструменты стоят'), pkMoney(d.cost)) + pkRow(TX('Принёс (наша доля)'), pkMoney(d.income)) + (d.sold > 0 ? pkRow(TX('Продано'), pkMoney(d.sold)) : '') +
      (d.no_price ? '<p style="margin:4px 0;opacity:.75"><small>' + esc(TX('Без цены')) + ': ' + esc(d.no_price) + ' ' + esc(TX('шт. — в стоимость не вошли')) + '</small></p>' : '');
    var tl = (d.tools || []).filter(function (t) { return t.cost != null; });
    if (tl.length) h += '<p style="margin:8px 0 4px;opacity:.75"><small>' + esc(TX('По инструментам: цена покупки · принёс через окно владельца')) + '</small></p>' + tl.map(function (t) { return pkRow(t.name + (t.qty > 1 ? ' × ' + t.qty : ''), pkMoney(t.cost) + ' · ' + pkMoney(t.income)); }).join('');
    return h;
  }
  /* ---------- Доля пункта с аренды: общая для всех пунктов или своя у пункта ---------- */
  function pkPct(x) { return String(Math.round(pkNum(x) * 10) / 10).replace('.', ',') + '%'; }
  function pkShLoad(name) {
    var sh = PK.sh = { name: name, loading: true, error: '', pct: null, def: null, own: false, form: null, msg: '' };
    callTo('/prokat', { action: 'share_get', name: name }).then(function (r) { pkShGot(sh, r); });
  }
  function pkShGot(sh, r) {
    if (PK.sh !== sh) return;
    sh.loading = false;
    if (!r || !r.ok || !r.point) { sh.error = (r && r.error) || TX('не удалось загрузить'); }
    else { sh.pct = pkNum(r.point.pct); sh.def = pkNum(r.default); sh.own = !!r.point.own; sh.error = ''; }
    if (S.view === 'prokat' && PK.cur && PK.cur.name === sh.name) render();
  }
  function pkShBlock() {
    var sh = PK.sh, h = '<h3 style="margin:16px 0 6px">⚖️ ' + esc(TX('Доля пункта с аренды')) + '</h3>';
    if (!sh || !PK.cur || sh.name !== PK.cur.name || sh.loading) return h + '<p style="opacity:.75">' + esc(TX('Загрузка…')) + '</p>';
    if (sh.error && sh.pct == null) return h + '<p style="color:#c0392b">' + esc(sh.error) + '</p>' + pkBtn('sh-retry', esc(TX('Ещё раз')), true);
    h += pkRow(TX('Пункту'), '<b>' + esc(pkPct(sh.pct)) + '</b>') + pkRow(TX('Нурулло'), esc(pkPct(100 - sh.pct))) +
      '<p style="margin:4px 0 8px;opacity:.8"><small>' + esc(sh.own ? TX('Своя доля этого пункта. Общая для всех') + ': ' + pkPct(sh.def) : TX('Общая доля для всех пунктов')) + '. ' + esc(TX('Меняет только новые аренды, старые не пересчитываются.')) + '</small></p>';
    if (sh.msg) h += '<p style="color:#1f8a4c;margin:0 0 8px">' + esc(sh.msg) + '</p>';
    var F = sh.form;
    if (!F) return h + '<div style="display:grid;grid-template-columns:1fr' + (sh.own ? ' 1fr' : '') + ';gap:8px">' + pkBtn('sh-open', '✏️ ' + esc(TX('Изменить долю')), true) + (sh.own ? pkBtn('sh-reset', esc(TX('Вернуть общую')), true) : '') + '</div>';
    var chip = function (k, t, on) { return '<button type="button" data-pk="' + k + '" style="padding:8px 10px;border-radius:10px;font:inherit;cursor:pointer;border:2px solid #1f8a4c;background:' + (on ? '#1f8a4c' : 'transparent') + ';color:' + (on ? '#fff' : '#1f8a4c') + '">' + esc(t) + '</button>'; };
    return h + '<div style="padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.35)">' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Доля пункта, %')) + '<input id="pk-sh-pct" type="text" inputmode="decimal" maxlength="5" autocomplete="off" value="' + esc(F.pct) + '" style="display:block;width:100%"></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">' + chip('sh-one', TX('Только этот пункт'), !F.all) + chip('sh-all', TX('Все пункты'), F.all) + '</div>' +
      (F.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(F.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('sh-save', esc(TX(F.busy ? 'Сохраняю…' : 'Сохранить')), false, F.busy ? 'opacity:.6' : '') + pkBtn('sh-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkShSave(body) {
    var sh = PK.sh, F = sh && sh.form; if (!sh || (F && F.busy) || sh.busy) return;
    if (F) F.busy = true; else sh.busy = true;
    render();
    // id создан при открытии формы: повтор после обрыва связи не запишет долю второй раз.
    callTo('/prokat', Object.assign({ action: 'share_set' }, body)).then(function (r) {
      if (PK.sh !== sh) return;
      sh.busy = false;
      if (!r || !r.ok) { if (F) { F.busy = false; F.err = (r && r.error) || TX('Не получилось сохранить'); } else sh.error = (r && r.error) || TX('Не получилось сохранить'); return render(); }
      var msg = TX('Сохранено. Новая доля — для новых аренд.') + (!body.name && sh.own ? ' ' + TX('У этого пункта своя доля, она не изменилась.') : '');
      pkShLoad(sh.name); PK.sh.msg = msg; render();
    });
  }
  function pkShClick(k) {
    var sh = PK.sh; if (k.indexOf('sh-') !== 0) return false;
    if (!sh) return true;
    var keep = function () { var i = $s('pk-sh-pct'); if (i && sh.form) sh.form.pct = i.value; };
    if (k === 'sh-retry') { pkShLoad(sh.name); render(); return true; }
    if (k === 'sh-open') { sh.form = { pct: String(sh.pct).replace('.', ','), all: false, id: oid(), busy: false, err: '' }; sh.msg = ''; render(); return true; }
    if (k === 'sh-cancel') { if (sh.form && !sh.form.busy) { sh.form = null; render(); } return true; }
    if (k === 'sh-one' || k === 'sh-all') { if (sh.form && !sh.form.busy) { keep(); sh.form.all = k === 'sh-all'; render(); } return true; }
    if (k === 'sh-reset') { sh.msg = ''; pkShSave({ name: sh.name, reset: true, id: oid() }); return true; }
    if (k === 'sh-save') {
      var F = sh.form; if (!F || F.busy) return true;
      keep();
      var v = Number(String(F.pct).replace(',', '.').trim());
      if (String(F.pct).trim() === '' || !(v >= 0 && v <= 50)) { F.err = TX('Доля пункта: от 0 до 50%'); render(); return true; }
      F.err = '';
      pkShSave(F.all ? { pct: v, id: F.id } : { name: sh.name, pct: v, id: F.id });
      return true;
    }
    return true;
  }
  /* ---------- Личная ссылка владельца пункта: показать, отправить, выдать новую вместо старой ---------- */
  function pkOlLoad() {
    var name = PK.cur && PK.cur.name; if (!name) return;
    var ol = PK.ol = { name: name, loading: true, link: '', owner: '', since: '', pin: '', locked: false, pf: null, error: '', ask: false, busy: false, id: '', msg: '' }; render();
    callTo('/prokat', { action: 'owner_link', name: name }).then(function (r) {
      if (PK.ol !== ol) return;
      ol.loading = false;
      if (!r || !r.ok) ol.error = (r && r.error) || TX('не удалось загрузить');
      else { ol.link = String(r.link || ''); ol.owner = String(r.owner || ''); ol.since = String(r.since || ''); ol.pin = String(r.pin || ''); ol.locked = !!r.locked; }
      if (S.view === 'prokat') render();
    });
  }
  function pkOlNew() {
    var ol = PK.ol; if (!ol || ol.busy || !ol.id) return;
    ol.busy = true; ol.error = ''; render();
    // id создан при открытии подтверждения: повтор после обрыва связи не выдаст вторую ссылку.
    callTo('/prokat', { action: 'owner_link_new', name: ol.name, id: ol.id }).then(function (r) {
      if (PK.ol !== ol) return;
      ol.busy = false;
      if (!r || !r.ok || !r.link) { ol.error = (r && r.error) || TX('Не получилось сохранить'); return render(); }
      ol.link = String(r.link); ol.owner = String(r.owner || ol.owner); ol.since = String(r.since || ''); ol.pin = String(r.pin || ''); ol.locked = false; ol.ask = false; ol.id = ''; ol.msg = TX('Новая ссылка выдана. Старая больше не работает — отправьте владельцу новую.');
      render();
    });
  }
  function pkOlText(ol) { return TX('Ваша ссылка на пункт проката') + ' «' + ol.name + '»: ' + ol.link; }
  function pkOlBlock() {
    var ol = PK.ol, h = '<h3 style="margin:16px 0 6px">🔗 ' + esc(TX('Ссылка владельца')) + '</h3>';
    if (!ol || !PK.cur || ol.name !== PK.cur.name) return h + pkBtn('ol-open', esc(TX('Показать ссылку владельца')), true);
    if (ol.loading) return h + '<p style="opacity:.75">' + esc(TX('Загрузка…')) + '</p>';
    if (ol.error && !ol.link && !ol.ask) return h + '<p style="color:#c0392b">' + esc(ol.error) + '</p>' + pkBtn('ol-open', esc(TX('Ещё раз')), true);
    if (ol.link) h += '<p style="margin:0 0 6px;opacity:.85">' + (ol.owner ? esc(TX('Владелец')) + ': ' + esc(ol.owner) : '') + (ol.since ? (ol.owner ? ' · ' : '') + esc(TX('выдана')) + ' ' + esc(pkDay(ol.since)) : '') + '</p>' +
      '<input id="pk-ol-link" type="text" readonly value="' + esc(ol.link) + '" style="display:block;width:100%;margin-bottom:8px;font-size:14px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + pkBtn('ol-copy', '📋 ' + esc(TX(ol.copied ? 'Скопировано' : 'Скопировать')), true) +
      '<a class="btn sec" target="_blank" rel="noopener" href="https://wa.me/?text=' + esc(encodeURIComponent(pkOlText(ol))) + '" style="text-align:center;text-decoration:none">💬 WhatsApp</a></div>';
    else h += '<p style="margin:0 0 8px;opacity:.85">' + esc(TX('У этого пункта пока нет ссылки владельца.')) + '</p>';
    if (ol.link) h += pkOlPin(ol);
    if (ol.msg) h += '<p style="color:#1f8a4c;margin:8px 0 0">' + esc(ol.msg) + '</p>';
    if (!ol.ask) return h + pkBtn('ol-ask', '🔄 ' + esc(TX(ol.link ? 'Выдать новую ссылку' : 'Выдать ссылку')), true, 'margin-top:8px');
    return h + '<div style="margin-top:8px;padding:10px;border-radius:10px;border:1px solid #c0392b">' +
      (ol.link ? '<b style="display:block;margin-bottom:6px">' + esc(TX('Старая ссылка сразу перестанет работать. Владелец войдёт только по новой. Выдать новую ссылку?')) + '</b>' : '') +
      (ol.error ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(ol.error) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('ol-new', esc(TX(ol.busy ? 'Сохраняю…' : (ol.link ? 'Да, выдать новую' : 'Выдать ссылку'))), false, ol.busy ? 'opacity:.6' : '') + pkBtn('ol-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  // PIN к ссылке: 4 цифры, владелец вводит его при каждом открытии ссылки. Скажите PIN владельцу отдельно, не в одном сообщении со ссылкой.
  function pkOlPin(ol) {
    var F = ol.pf;
    var h = '<div style="margin-top:10px;padding:10px;border-radius:10px;background:rgba(127,127,127,.1)">' +
      '<b>🔒 PIN: ' + (ol.pin ? esc(ol.pin) : esc(TX('не задан'))) + '</b>' +
      (ol.locked ? '<p style="color:#c0392b;margin:6px 0 0">' + esc(TX('Заблокирован после 10 неверных PIN. Задайте PIN заново, чтобы владелец смог войти.')) + '</p>' : '') +
      '<p style="margin:6px 0 8px;opacity:.8"><small>' + esc(TX(ol.pin ? 'Владелец вводит PIN при каждом открытии ссылки. Скажите PIN владельцу отдельно, не в одном сообщении со ссылкой.' : 'Без PIN по ссылке может войти любой, у кого она есть.')) + '</small></p>';
    if (!F) return h + '<div style="display:grid;grid-template-columns:1fr' + (ol.pin ? ' 1fr' : '') + ';gap:8px">' + pkBtn('ol-pin', esc(TX(ol.pin ? 'Сменить PIN' : 'Задать PIN')), true) + (ol.pin ? pkBtn('ol-pin-off', esc(TX(ol.pbusy ? 'Сохраняю…' : 'Убрать PIN')), true) : '') + '</div>' + (ol.perr ? '<p style="color:#c0392b;margin:8px 0 0">' + esc(ol.perr) + '</p>' : '') + '</div>';
    return h + '<input id="pk-ol-pin" type="text" inputmode="numeric" maxlength="4" autocomplete="off" value="' + esc(F.pin) + '" placeholder="1234" style="display:block;width:100%;margin-bottom:8px;font-size:22px;letter-spacing:6px;text-align:center">' +
      (F.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(F.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('ol-pin-save', esc(TX(F.busy ? 'Сохраняю…' : 'Сохранить PIN')), false, F.busy ? 'opacity:.6' : '') + pkBtn('ol-pin-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkOlPinSave(pin) {
    var ol = PK.ol; if (!ol || ol.pbusy) return;
    var F = ol.pf; ol.pbusy = true; ol.perr = ''; if (F) F.busy = true; render();
    callTo('/prokat', { action: 'owner_pin', name: ol.name, pin: pin }).then(function (r) {
      if (PK.ol !== ol) return;
      ol.pbusy = false;
      if (!r || !r.ok) { var e = (r && r.error) || TX('Не получилось сохранить'); if (F) { F.busy = false; F.err = e; } else ol.perr = e; return render(); }
      ol.pf = null; ol.pin = String(r.pin || ''); ol.locked = false; ol.msg = TX(ol.pin ? 'PIN сохранён. Скажите его владельцу.' : 'PIN убран.');
      render();
    });
  }
  function pkOlClick(k) {
    var ol = PK.ol;
    if (k === 'ol-open') { pkOlLoad(); return true; }
    if (!ol) return k.indexOf('ol-') === 0;
    if (k === 'ol-copy') { copyText(ol.link, function () { if (PK.ol === ol) { ol.copied = true; render(); } }); return true; }
    if (k === 'ol-ask') { ol.ask = true; ol.id = oid(); ol.error = ''; ol.msg = ''; render(); return true; }
    if (k === 'ol-cancel') { if (!ol.busy) { ol.ask = false; ol.id = ''; ol.error = ''; render(); } return true; }
    if (k === 'ol-new') { pkOlNew(); return true; }
    if (k === 'ol-pin') { ol.pf = { pin: String(Math.floor(1000 + Math.random() * 9000)), busy: false, err: '' }; ol.msg = ''; ol.perr = ''; render(); return true; }
    if (k === 'ol-pin-cancel') { if (ol.pf && !ol.pf.busy) { ol.pf = null; render(); } return true; }
    if (k === 'ol-pin-off') { ol.msg = ''; pkOlPinSave(''); return true; }
    if (k === 'ol-pin-save') {
      var F = ol.pf; if (!F || F.busy) return true;
      var pi = $s('pk-ol-pin'); F.pin = String(pi ? pi.value : F.pin).replace(/\D/g, '');
      if (F.pin.length !== 4) { F.err = TX('PIN — 4 цифры'); render(); return true; }
      pkOlPinSave(F.pin); return true;
    }
    return false;
  }
  // Фото инструментов на пункте и «Все инструменты»: данные отдаёт n8n по адресу /prokat-foto.
  function pkSafeUrl(u) { u = String(u || ''); return /^https?:\/\//i.test(u) ? u : ''; }
  // Фото-история: в окне пункта иконки инструментов, внутри — все фото инструмента по датам, от первого до последнего объезда.
  function pkPhLoad(name) {
    var ph = PK.ph = { name: name, loading: true, tools: [], error: '' }; if (!PK.cur || PK.cur.name !== name) PK.phG = '';
    callTo('/prokat-foto', { action: 'tools', name: name }).then(function (r) {
      if (PK.ph !== ph) return;
      ph.loading = false;
      if (!r || !r.ok) ph.error = (r && r.error) || TX('не удалось загрузить');
      else ph.tools = Array.isArray(r.tools) ? r.tools : [];
      if (S.view === 'prokat' && PK.cur && PK.cur.name === name) render();
    });
  }
  // Цветной статус инструмента: 🟢 работает, 🟡 в ремонте, 🔴 сломан или потерян, ⚪ нужно забрать.
  var PK_TST = { ok: ['#1f8a4c', '🟢'], repair: ['#b7860b', '🟡'], broken: ['#c0392b', '🔴'], lost: ['#c0392b', '🔴'], pickup: ['#777', '⚪'], moved: ['#777', '↪'], sklad: ['#777', '📦'], sold: ['#777', '💰'] };
  function pkTStatus(t, big) {
    var c = PK_TST[t && t.status]; if (!c) return '';
    var txt = TX(t.status_text || '') + (pkNum(t.out) > 0 ? ' · ' + TX('в аренде') + ' ' + pkNum(t.out) : '');
    return '<span data-st="' + esc(t.status) + '" style="display:block;color:' + c[0] + ';font-weight:600' + (big ? ';font-size:17px;margin:0 0 8px' : '') + '">' + c[1] + ' ' + esc(txt) + '</span>';
  }
  function pkPhBlock() {
    var ph = PK.ph, h = '<h3 style="margin:16px 0 6px">🧰 ' + esc(TX('Инструменты на пункте')) + (ph && !ph.loading && !ph.error ? ' <span style="font-size:15px;padding:2px 9px;border-radius:12px;background:rgba(127,127,127,.15)">' + esc(ph.tools.length) + '</span>' : '') + '</h3>';
    if (!ph || ph.loading) return h + '<p style="opacity:.75">' + esc(TX('Загрузка…')) + '</p>';
    if (ph.error) return h + '<p style="color:#c0392b">' + esc(ph.error) + '</p>' + pkBtn('ph-retry', esc(TX('Ещё раз')), true);
    if (!ph.tools.length) return h + '<p style="opacity:.75">' + esc(TX('Инструментов пока нет')) + '</p>';
    var gs = pkGroups(ph.tools), cur = gs.filter(function (g) { return g.key === PK.phG; })[0];
    h += '<p style="margin:0 0 8px;opacity:.8">' + esc(TX('Нажмите на значок, чтобы увидеть фото инструментов этого вида')) + '<br><small>🟢 ' + esc(TX('работает')) + ' · 🟡 ' + esc(TX('в ремонте')) + ' · 🔴 ' + esc(TX('сломан или потерян')) + ' · ⚪ ' + esc(TX('нужно забрать')) + '</small></p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + gs.map(function (g, gi) {
        var on = g === cur;
        return '<button type="button" data-pk="ptg:' + gi + '" aria-expanded="' + on + '" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-height:96px;padding:10px 4px 8px;border-radius:12px;font:inherit;color:inherit;text-align:center;cursor:pointer;border:2px solid ' + (on ? '#1f8a4c' : 'rgba(127,127,127,.3)') + ';background:' + (on ? 'rgba(31,138,76,.12)' : 'none') + '">' +
          '<span aria-hidden="true" style="font-size:34px;line-height:1">' + g.icon + '</span>' +
          '<span style="font-size:12px;line-height:1.25;font-weight:700;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(g.label) + '</span>' +
          '<span style="position:absolute;top:4px;right:4px;min-width:20px;padding:0 5px;border-radius:10px;background:rgba(127,127,127,.2);font-size:12px;font-weight:700">' + g.items.length + '</span></button>';
      }).join('') + '</div>';
    if (cur) {
      h += '<h4 style="margin:14px 0 8px">' + cur.icon + ' ' + esc(cur.label) + '</h4><div style="display:grid;gap:10px">' + cur.items.map(function (i) {
        var t = ph.tools[i], u = pkSafeUrl(t.url), n = pkNum(t.count);
        return '<div style="border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden">' +
          (u ? '<button type="button" data-pk="pt:' + i + '" aria-label="' + esc(TX('Все фото по датам, цена')) + '" style="display:block;width:100%;padding:0;border:0;background:none;cursor:pointer"><img src="' + esc(u) + '" loading="lazy" alt="' + esc(t.name || '') + '" style="display:block;width:100%;max-height:360px;object-fit:contain;background:rgba(127,127,127,.12)"></button>' : '<p style="margin:10px 12px;opacity:.75">' + esc(TX('Фото этого инструмента пока нет. Новое фото появится после объезда.')) + '</p>') +
          '<div style="padding:8px 12px 10px"><b>' + esc(t.name || '') + (pkNum(t.qty) > 1 ? ' × ' + esc(t.qty) : '') + '</b>' + pkTStatus(t) +
          '<small style="opacity:.8">' + (n ? '📷 ' + n + (t.last ? ' · ' + esc(pkDay(t.last)) : '') : esc(TX('фото нет'))) + (pkPriceMin(t.prices) ? ' · 💰 ' + esc(TX('от')) + ' ' + pkPriceMin(t.prices) + ' ' + esc(TX('смн')) : '') + '</small>' +
          pkBtn('pt:' + i, esc(TX('Все фото по датам, цена')), true, 'margin-top:8px') + '</div></div>';
      }).join('') + '</div>';
    }
    return h;
  }
  // Вид инструмента: из прайса (kind), а если его нет — по названию (болгарка, перфоратор, фен...).
  var PK_FAM = [[/болгар|балгар|ушм/, 'болгарка', ['Большая болгарка', 'Маленькая болгарка', 'Болгарка'], '💿'], [/перфор|перфар/, 'перфоратор', ['Большой перфоратор', 'Маленький перфоратор', 'Перфоратор'], '🔨'], [/отбо[йи]|молот/, 'отбойный молоток', ['Отбойный молоток', 'Отбойный молоток', 'Отбойный молоток'], '⛏️'], [/шуруп/, 'шуруповёрт', ['Шуруповёрт аккумуляторный', 'Шуруповёрт аккумуляторный', 'Шуруповёрт аккумуляторный'], '🔧'], [/(^|[^а-яё])фен([^а-яё]|$)/, 'фен', ['Строительный фен', 'Строительный фен', 'Строительный фен'], '💨'], [/бензопил/, 'бензопила', ['Бензопила', 'Бензопила', 'Бензопила'], '⛓️'], [/паяльн|утиг|утюг/, 'паяльник', ['Паяльник для пластиковых труб', 'Паяльник для пластиковых труб', 'Паяльник для пластиковых труб'], '🔥'], [/дрел/, 'дрель', ['Дрель', 'Дрель', 'Дрель'], '🔩'], [/лобзик/, 'лобзик', ['Лобзик', 'Лобзик', 'Лобзик'], '✂️']];
  function pkKindOf(t) {
    var nm = String((t && t.name) || ''), kd = String((t && t.kind) || ''), low = (kd || nm).toLowerCase(), sz = /калон|больш|катта/.test(low) ? 0 : /майда|мал|кичик/.test(low) ? 1 : 2;
    for (var i = 0; i < PK_FAM.length; i++) if (PK_FAM[i][0].test(low)) return { label: kd || PK_FAM[i][2][sz], icon: PK_FAM[i][3] };
    return { label: kd || nm || TX('Другое'), icon: '🧰' };
  }
  function pkGroups(tools) {
    var by = {}, out = [];
    (tools || []).forEach(function (t, i) {
      var k = pkKindOf(t), key = k.label.toLowerCase();
      if (!by[key]) { by[key] = { key: key, label: k.label, icon: k.icon, items: [] }; out.push(by[key]); }
      by[key].items.push(i);
    });
    return out;
  }
  // Цена аренды из прайса: «до 3 ч — 30 смн · сутки — 40 смн».
  function pkPrices(list) {
    var sr = { 'час': TX('час'), 'коротко': TX('до 3 ч'), 'сутки': TX('сутки'), 'день': TX('день') };
    return (Array.isArray(list) ? list : []).map(function (p) { return (sr[p.srok] || TX(p.srok || '')) + ' — ' + pkNum(p.cena) + ' ' + TX('смн'); }).join(' · ');
  }
  function pkPriceMin(list) { var c = (Array.isArray(list) ? list : []).map(function (p) { return pkNum(p.cena); }).filter(function (x) { return x > 0; }); return c.length ? Math.min.apply(null, c) : 0; }
  function pkToolOpen(i) {
    var t = PK.ph && PK.ph.tools[i]; if (!t || !PK.cur) return;
    var pt = PK.pt = { point: PK.cur.name, tool: t.name, vid: pkKindOf(t).label, icon: pkKindOf(t).icon, card: { loading: true, firma: '', cena: '', kredit: '', msg: '', err: '', busy: false, id: '' }, kind: t.kind || '', prices: t.prices || [], loading: true, photos: [], total: 0, error: '', st: { status: t.status, status_text: t.status_text, out: t.out, month_income: t.month_income } }; PK.big = null; render();
    callTo('/prokat-foto', { action: 'tool', name: pt.point, tool: pt.tool }).then(function (r) {
      if (PK.pt !== pt) return;
      pt.loading = false;
      if (!r || !r.ok) pt.error = (r && r.error) || TX('не удалось загрузить');
      else { pt.photos = Array.isArray(r.photos) ? r.photos : []; pt.total = pkNum(r.total) || pt.photos.length; if (Array.isArray(r.prices)) { pt.prices = r.prices; pt.kind = r.kind || ''; } if (r.status != null) pt.st = { status: r.status, status_text: r.status_text, out: r.out, month_income: r.month_income }; }
      if (S.view === 'prokat') render();
    });
    pkMovesLoad(pt); pkCardLoad(pt);
  }
  // Карточка вида: фирма и цена покупки (в т.ч. в кредит) — хранится в n8n, вебхук /prokat-карта.
  function pkCardLoad(pt) {
    callTo('/prokat-karta', { action: 'get', vid: pt.vid }).then(function (r) {
      if (PK.pt !== pt) return;
      var c = pt.card; c.loading = false;
      if (!r || !r.ok) c.err = (r && r.error) || TX('не удалось загрузить');
      else { c.err = ''; c.firma = String(r.card.firma || ''); c.cena = String(r.card.cena || ''); c.kredit = String(r.card.kredit || ''); c.data = String(r.card.data || ''); }
      if (S.view === 'prokat') render();
    });
  }
  function pkCardKeep() { var c = PK.pt && PK.pt.card; if (!c) return; ['firma', 'cena', 'kredit'].forEach(function (k) { var el = $s('pk-cd-' + k); if (el) c[k] = el.value; }); }
  function pkCardSave() {
    var pt = PK.pt, c = pt && pt.card; if (!c || c.busy || c.loading) return;
    pkCardKeep(); c.err = ''; c.msg = ''; c.busy = true; c.id = c.id || oid(); render();
    callTo('/prokat-karta', { action: 'set', vid: pt.vid, firma: c.firma, cena: c.cena, kredit: c.kredit, id: c.id }).then(function (r) {
      if (PK.pt !== pt) return;
      c.busy = false;
      if (!r || !r.ok) { c.err = (r && r.error) || TX('Не получилось сохранить'); if (r && r.error && r.error !== TX('нет связи')) c.id = ''; }
      else { c.id = ''; c.msg = TX('Сохранено'); if (r.card) { c.firma = String(r.card.firma || ''); c.cena = String(r.card.cena || ''); c.kredit = String(r.card.kredit || ''); } }
      if (S.view === 'prokat') render();
    });
  }
  function pkCardBlock(pt) {
    var c = pt.card || {}, inp = function (k, label, ph, mode) { return '<label style="display:block;margin:0 0 8px">' + esc(label) + '<input id="pk-cd-' + k + '" type="text"' + (mode ? ' inputmode="' + mode + '"' : '') + ' maxlength="' + (k === 'kredit' ? 200 : 80) + '" autocomplete="off" placeholder="' + esc(ph) + '" value="' + esc(c[k] || '') + '" style="display:block;width:100%"' + (c.loading ? ' disabled' : '') + '></label>'; };
    return '<div style="margin:0 0 12px;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.35)"><b style="display:block;margin-bottom:8px">' + (pt.icon || '🧰') + ' ' + esc(pt.vid || pt.tool) + '</b>' +
      inp('firma', TX('Фирма (кто сделал)'), TX('например: Bosch, Makita, Total'), '') +
      inp('cena', TX('Цена покупки, смн'), TX('сколько заплатили или во сколько обошёлся'), 'decimal') +
      inp('kredit', TX('Если в кредит — запишите'), TX('например: в кредит, платёж 250 в месяц'), '') +
      (c.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(c.err) + '</p>' : '') + (c.msg ? '<p role="status" style="color:#1f8a4c;margin:0 0 8px">' + esc(c.msg) + '</p>' : '') +
      pkBtn('cd-save', esc(TX(c.busy ? 'Сохраняю…' : 'Сохранить')), false, c.busy || c.loading ? 'opacity:.6' : '') + '</div>';
  }
  document.addEventListener('input', function (e) { var t = e.target; if (PK.pt && t && t.id && t.id.indexOf('pk-cd-') === 0) pkCardKeep(); });
  // «Это другой инструмент»: перенести фото в другой инструмент этого пункта или под новым названием.
  function pkRelabel(pt, p, i) {
    var R = pt.rl;
    if (!R || R.i !== i) return '<button type="button" data-pk="rl:' + i + '" class="btn sec" style="height:auto;padding:6px 10px;margin-top:6px;font-size:14px">✏️ ' + esc(TX('Это другой инструмент')) + '</button>';
    var names = (PK.ph && PK.ph.tools || []).map(function (t) { return t.name; }).filter(function (n) { return n && n !== pt.tool && n !== 'Без названия'; });
    return '<div style="margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.35)"><b style="display:block;margin-bottom:6px">' + esc(TX('Какой инструмент на фото?')) + '</b>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + names.map(function (n, k) { return '<button type="button" data-pk="rlp:' + k + '" style="padding:6px 10px;border-radius:10px;font:inherit;cursor:pointer;border:2px solid #1f8a4c;background:' + (R.to === n ? '#1f8a4c' : 'transparent') + ';color:' + (R.to === n ? '#fff' : '#1f8a4c') + '">' + esc(n) + '</button>'; }).join('') + '</div>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('или новое название')) + '<input id="pk-rl-new" type="text" maxlength="60" autocomplete="off" value="' + esc(R.name || '') + '" style="display:block;width:100%"></label>' +
      (R.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(R.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('rl-save', esc(TX(R.busy ? 'Сохраняю…' : 'Перенести')), false, R.busy ? 'opacity:.6' : '') + pkBtn('rl-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkRelabelNames() { var pt = PK.pt; return (PK.ph && PK.ph.tools || []).map(function (t) { return t.name; }).filter(function (n) { return n && n !== pt.tool && n !== 'Без названия'; }); }
  function pkRelabelSave() {
    var pt = PK.pt, R = pt && pt.rl; if (!R || R.busy) return;
    var inp = $s('pk-rl-new'); if (inp) R.name = inp.value;
    var to = String(R.name || '').replace(/\s+/g, ' ').trim() || R.to || '';
    if (!to) { R.err = TX('Выберите инструмент или впишите название'); return render(); }
    var p = pt.photos[R.i]; if (!p) return;
    R.busy = true; R.err = ''; render();
    callTo('/prokat-foto', { action: 'relabel', name: pt.point, fid: p.id, tool: to }).then(function (r) {
      if (PK.pt !== pt || pt.rl !== R) return;
      R.busy = false;
      if (!r || !r.ok) { R.err = (r && r.error) || TX('Не получилось сохранить'); return render(); }
      pt.photos.splice(R.i, 1); pt.total = Math.max(0, pt.total - 1); pt.rl = null; pt.msg = TX('Фото перенесено в') + ' «' + (r.tool || to) + '»';
      render(); pkPhLoad(pt.point);
    });
  }
  /* ---------- Перевозки: пункт → пункт, пункт ↔ склад ---------- */
  function pkMovesLoad(pt) {
    callTo('/prokat', { action: 'moves', name: pt.point, tool: pt.tool }).then(function (r) {
      if (PK.pt !== pt) return;
      pt.moves = r && r.ok && Array.isArray(r.moves) ? r.moves : [];
      if (S.view === 'prokat') render();
    });
  }
  // Новый инструмент на пункт: на сервере это перевозка «из Куплен» с ценой покупки за 1 шт. Фото — потом в объезде.
  function pkAddOpen() { PK.add = { name: '', qty: '1', price: '', note: '', id: oid(), busy: false, err: '' }; PK.msg = ''; render(); var n = $s('pk-add-name'); if (n) n.focus(); }
  function pkAddKeep() { var A = PK.add; if (!A) return; var n = $s('pk-add-name'), q = $s('pk-add-qty'), pr = $s('pk-add-price'), no = $s('pk-add-note'); if (n) A.name = n.value; if (q) A.qty = q.value; if (pr) A.price = pr.value; if (no) A.note = no.value; }
  function pkAddForm() {
    var A = PK.add, names = PK_SK_KINDS.concat(PK.ph && Array.isArray(PK.ph.tools) ? PK.ph.tools.map(function (t) { return t.name; }) : []).filter(function (v, i, a) { return v && a.indexOf(v) === i && !/без названия/i.test(v); });
    return '<div style="margin:8px 0 12px;padding:12px;border-radius:12px;border:2px solid #1f8a4c"><b style="display:block;margin-bottom:8px">➕ ' + esc(TX('Добавить инструмент')) + ': ' + esc(PK.cur.name) + '</b>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Название')) + '<input id="pk-add-name" type="text" list="pk-add-names" maxlength="80" autocomplete="off" oninput="pkAddKeep()" placeholder="' + esc(TX('Например: Болгарка большая')) + '" value="' + esc(A.name) + '" style="display:block;width:100%"></label>' +
      '<datalist id="pk-add-names">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Количество')) + '<input id="pk-add-qty" type="text" inputmode="numeric" autocomplete="off" oninput="pkAddKeep()" value="' + esc(A.qty) + '" style="display:block;width:100%;font-size:20px"></label>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Цена покупки за 1 шт., сомони (можно пусто)')) + '<input id="pk-add-price" type="text" inputmode="decimal" autocomplete="off" oninput="pkAddKeep()" value="' + esc(A.price) + '" style="display:block;width:100%;font-size:20px"></label>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Заметка')) + '<input id="pk-add-note" type="text" maxlength="80" autocomplete="off" oninput="pkAddKeep()" value="' + esc(A.note) + '" style="display:block;width:100%"></label>' +
      '<p style="margin:0 0 8px;opacity:.75"><small>' + esc(TX('Фото инструмента сделайте в «Начать объезд» — новый инструмент там уже будет.')) + '</small></p>' +
      (A.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(A.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('add-save', esc(TX(A.busy ? 'Сохраняю…' : 'Добавить')), false, A.busy ? 'opacity:.6' : '') + pkBtn('add-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkAddSave() {
    var A = PK.add, point = PK.cur && PK.cur.name; if (!A || A.busy || !point) return;
    pkAddKeep(); A.err = '';
    var name = String(A.name || '').replace(/\s+/g, ' ').trim(), q = String(A.qty || '').replace(/\s/g, ''), ps = String(A.price || '').replace(/\s/g, '').replace(',', '.');
    if (!name) { A.err = TX('Напишите название инструмента'); return render(); }
    if (!/^\d{1,4}$/.test(q) || +q < 1) { A.err = TX('Количество — целое число больше нуля'); return render(); }
    if (ps && !(Number(ps) >= 0)) { A.err = TX('Цена — число'); return render(); }
    var body = { action: 'move', from: 'Куплен', to: point, tool: name, qty: +q, note: String(A.note || '').trim().slice(0, 80), id: A.id };
    if (ps) body.price = Math.round(Number(ps) * 100) / 100;
    A.busy = true; render();
    callTo('/prokat', body).then(function (r) {
      if (PK.add !== A) return;
      A.busy = false;
      if (!r || !r.ok) { A.err = (r && r.error) || TX('Не получилось сохранить'); if (r && r.error && r.error !== TX('нет связи')) A.id = oid(); return render(); }
      PK.add = null; PK.msg = TX('Добавлено') + ': ' + name + ', ' + q + ' ' + TX('шт.') + (body.price ? ' — ' + pkMoney(body.price) + ' ' + TX('за 1 шт.') : '');
      render(); pkPhLoad(point); pkOpenPointQuiet(point); pkReload();
    });
  }
  function pkAddClick(k) {
    if (k === 'add-open') { pkAddOpen(); return true; }
    var A = PK.add; if (!A) return false;
    if (k === 'add-cancel') { if (!A.busy) { PK.add = null; render(); } return true; }
    if (k === 'add-save') { pkAddSave(); return true; }
    return false;
  }
  // Продажа (sell) — та же перевозка, только «в Продан» и с ценой за всё.
  function pkMoveOpen(from, tool, ctx, sell) { PK.mv = { from: from, tool: tool, ctx: ctx, sell: !!sell, to: sell ? 'Продан' : '', qty: '1', price: '', state: from === 'Склад' ? (sell ? 'на запчасти' : 'починен') : 'сломан', note: '', id: oid(), busy: false, err: '' }; render(); }
  function pkMoveKeep() { var M = PK.mv; if (!M) return; var t = $s('pk-mv-to'), q = $s('pk-mv-qty'), n = $s('pk-mv-note'), pr = $s('pk-mv-price'); if (pr) M.price = pr.value; if (t) M.to = t.value; if (q) M.qty = q.value; if (n) M.note = n.value; }
  function pkMoveForm() {
    var M = PK.mv, places = ['Склад'].concat(PK.points.map(function (p) { return p.name; }).sort(function (a, b) { return a.localeCompare(b, 'ru'); })).filter(function (n) { return n !== M.from; });
    var sk = M.from === 'Склад' || M.to === 'Склад';
    return '<div style="margin:0 0 12px;padding:12px;border-radius:12px;border:2px solid ' + (M.sell ? '#b7860b' : '#1f6fb2') + '"><b style="display:block;margin-bottom:6px">' + (M.sell ? '💰 ' + esc(TX('Продать')) : '🚚 ' + esc(TX('Перевезти'))) + ': ' + esc(M.tool) + '</b>' +
      '<p style="margin:0 0 8px;opacity:.8">' + esc(TX('Откуда')) + ': <b>' + esc(M.from) + '</b></p>' +
      (M.sell ? '<label style="display:block;margin-bottom:8px">' + esc(TX('Цена продажи за всё, сомони')) + '<input id="pk-mv-price" type="text" inputmode="decimal" autocomplete="off" value="' + esc(M.price) + '" style="display:block;width:100%;font-size:20px"></label>' : '<label style="display:block;margin-bottom:8px">' + esc(TX('Куда')) + '<select id="pk-mv-to" data-mvto="1" style="display:block;width:100%;min-height:44px;font:inherit"><option value="">' + esc(TX('— выберите —')) + '</option>' + places.map(function (n) { return '<option value="' + esc(n) + '"' + (M.to === n ? ' selected' : '') + '>' + esc(n === 'Склад' ? '🏠 ' + TX('Склад') : n) + '</option>'; }).join('') + '</select></label>') +
      (sk ? '<b style="display:block;margin-bottom:4px">' + esc(M.from === 'Склад' ? TX(M.sell ? 'Какие продать со склада' : 'Какие взять со склада') : TX('В каком состоянии на склад')) + '</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">' + PK_SK_ST.map(function (st, i) { return pkSkChip('mv-st:' + i, TX(st), M.state === st, PK_SK_COL[st]); }).join('') + '</div>' : '') +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Количество')) + '<input id="pk-mv-qty" type="text" inputmode="numeric" autocomplete="off" value="' + esc(M.qty) + '" style="display:block;width:100%;font-size:20px"></label>' +
      '<label style="display:block;margin-bottom:8px">' + esc(TX('Заметка')) + '<input id="pk-mv-note" type="text" maxlength="80" autocomplete="off" value="' + esc(M.note) + '" style="display:block;width:100%"></label>' +
      (M.err ? '<p style="color:#c0392b;margin:0 0 8px">' + esc(M.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:6px">' + pkBtn('mv-save', esc(TX(M.busy ? 'Сохраняю…' : M.sell ? 'Продать' : 'Перевезти')), false, M.busy ? 'opacity:.6' : '') + pkBtn('mv-cancel', esc(TX('Отмена')), true) + '</div></div>';
  }
  function pkMovesBlock(list) {
    if (!list || !list.length) return '';
    return '<h3 style="margin:12px 0 6px">🚚 ' + esc(TX('Перевозки')) + '</h3>' + list.slice(0, 10).map(function (m) {
      return pkRow(pkDay(m.date) + ' · ' + m.from + ' → ' + (m.to === 'Продан' ? '💰 ' + TX('продан') + (pkNum(m.price) > 0 ? ' ' + TX('за') + ' ' + pkNum(m.price) + ' ' + TX('смн') : '') : m.to) + (m.state ? ' · ' + TX(m.state) : '') + (m.note ? ' · ' + m.note : ''), '<b>' + esc(m.qty) + '</b> ' + esc(TX('шт.')));
    }).join('');
  }
  function pkMoveSave() {
    var M = PK.mv; if (!M || M.busy) return;
    pkMoveKeep(); M.err = '';
    var q = String(M.qty || '').replace(/\s/g, '');
    if (!M.to) { M.err = TX('Выберите, куда перевезти'); return render(); }
    if (!/^\d{1,4}$/.test(q) || +q < 1) { M.err = TX('Количество — целое число больше нуля'); return render(); }
    var price = Number(String(M.price || '').replace(/\s/g, '').replace(',', '.'));
    if (M.sell && !(price > 0)) { M.err = TX('Укажите цену продажи'); return render(); }
    var body = { action: 'move', from: M.from, to: M.to, tool: M.tool, qty: +q, note: String(M.note || '').trim().slice(0, 80), id: M.id };
    if (M.sell) body.price = Math.round(price * 100) / 100;
    if (M.from === 'Склад' || M.to === 'Склад') body.state = M.state;
    M.busy = true; render();
    callTo('/prokat', body).then(function (r) {
      if (PK.mv !== M) return;
      M.busy = false;
      if (!r || !r.ok) { M.err = (r && r.error) || TX('Не получилось сохранить'); if (r && r.error && r.error !== TX('нет связи')) M.id = oid(); return render(); }
      var msg = M.sell ? TX('Продано') + ': ' + M.tool + ', ' + q + ' ' + TX('шт.') + ' — ' + pkMoney(body.price) : TX('Перевезено') + ': ' + M.tool + ', ' + M.from + ' → ' + M.to + ', ' + q + ' ' + TX('шт.');
      PK.mv = null;
      if (M.ctx === 'pt' && PK.pt) { PK.pt.msg = msg; pkMovesLoad(PK.pt); if (PK.cur) pkPhLoad(PK.cur.name); }
      if (M.ctx === 'sk' && PK.sk) { PK.sk.msg = msg; pkSkLoad(); }
      pkReload();
    });
  }
  function pkMoveClick(k) {
    var M = PK.mv;
    if (k === 'mv-open') { if (PK.pt) pkMoveOpen(PK.pt.point, PK.pt.tool, 'pt'); return true; }
    if (k === 'sell-open') { if (PK.pt) pkMoveOpen(PK.pt.point, PK.pt.tool, 'pt', true); return true; }
    if (!M) return false;
    if (k === 'mv-cancel') { if (!M.busy) { PK.mv = null; render(); } return true; }
    if (k === 'mv-save') { pkMoveSave(); return true; }
    if (k.indexOf('mv-st:') === 0) { var st = PK_SK_ST[+k.slice(6)]; if (st && !M.busy) { pkMoveKeep(); M.state = st; render(); } return true; }
    return false;
  }
  document.addEventListener('change', function (e) { var t = e.target; if (PK.mv && t && t.getAttribute && t.getAttribute('data-mvto') != null) { pkMoveKeep(); render(); } });
  function renderPkToolHist(el) {
    var pt = PK.pt, h = pkBtn('pt-back', '← ' + esc(pt.point), true, 'margin-bottom:8px') + '<h2 style="padding-right:36px;margin-bottom:2px">🧰 ' + esc(pt.tool) + '</h2><p style="margin:0 0 10px;opacity:.8">' + esc(pt.point) + '</p>' + pkTStatus(pt.st, true) +
      (pt.st && pkNum(pt.st.month_income) > 0 ? '<p style="margin:0 0 8px">' + esc(TX('Доход за этот месяц')) + ': <b>' + pkMoney(pt.st.month_income) + '</b></p>' : '') +
      '<div style="margin:0 0 12px;padding:10px;border-radius:10px;background:rgba(31,138,76,.1)"><b>💰 ' + esc(TX('Цена аренды')) + (pt.kind ? ' (' + esc(TX(pt.kind)) + ')' : '') + '</b><br>' + esc(pkPrices(pt.prices) || TX('В прайсе цены для этого инструмента нет')) + '</div>' + pkCardBlock(pt);
    if (pt.loading) return void (el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>');
    if (pt.error) return void (el.innerHTML = h + '<p style="color:#c0392b">' + esc(pt.error) + '</p>' + pkBtn('pt-retry', esc(TX('Ещё раз')), true));
    if (pt.msg) h += '<p role="status" style="color:#1f8a4c;margin:0 0 8px">' + esc(pt.msg) + '</p>';
    h += PK.mv && PK.mv.ctx === 'pt' ? pkMoveForm() : '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:10px">' + pkBtn('mv-open', '🚚 ' + esc(TX('Перевезти')), true) + pkBtn('sell-open', '💰 ' + esc(TX('Продать')), true) + '</div>';
    h += pkMovesBlock(pt.moves);
    if (!pt.photos.length) return void (el.innerHTML = h + '<p style="opacity:.75">' + esc(TX('Фото этого инструмента пока нет. Новое фото появится после объезда.')) + '</p>');
    h += '<p style="margin:0 0 8px">' + esc(TX('Фото по датам, от первого к последнему')) + ': <b>' + esc(pt.total) + '</b>' + (pt.total > pt.photos.length ? ' (' + esc(TX('показаны последние')) + ' ' + pt.photos.length + ')' : '') + '</p>';
    h += '<div style="display:grid;gap:12px">' + pt.photos.map(function (p, i) {
      var u = pkSafeUrl(p.url), sub = [p.src === 'объезд' ? TX('объезд') : '', p.state ? TX(p.state) : '', p.note || ''].filter(Boolean).join(' · ');
      return '<figure style="margin:0;border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden">' +
        (u ? '<button type="button" data-pk="pth:' + i + '" style="display:block;width:100%;padding:0;border:0;background:none;cursor:pointer"><img src="' + esc(u) + '" loading="lazy" alt="' + esc(pt.tool + ', ' + pkDay(p.date)) + '" style="display:block;width:100%;max-height:420px;object-fit:contain;background:rgba(127,127,127,.12)"></button>' : '<span style="display:block;padding:24px;text-align:center;opacity:.7">' + esc(TX('фото не загрузилось')) + '</span>') +
        '<figcaption style="padding:8px 10px"><b style="font-size:17px">📅 ' + esc(p.date ? pkDay(p.date) : TX('дата неизвестна')) + '</b>' + (sub ? '<small style="display:block;opacity:.8">' + esc(sub) + '</small>' : '') + pkRelabel(pt, p, i) + '</figcaption></figure>';
    }).join('') + '</div>';
    el.innerHTML = h + pkBigPhoto();
  }
  function pkBigPhoto() {
    var p = PK.big, u = p && pkSafeUrl(p.url); if (!u) return '';
    return '<div style="position:fixed;inset:0;z-index:1000;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px">' +
      '<button type="button" data-pk="big-close" aria-label="' + esc(TX('Закрыть')) + '" style="position:absolute;top:10px;right:10px;width:44px;height:44px;border:0;border-radius:22px;background:rgba(255,255,255,.2);color:#fff;font-size:26px;cursor:pointer">×</button>' +
      '<img src="' + esc(u) + '" alt="' + esc(p.name || '') + '" style="max-width:100%;max-height:calc(100dvh - 90px);object-fit:contain">' +
      '<p style="color:#fff;margin:8px 0 0;text-align:center">' + esc(p.name || '') + (p.date ? ' · ' + esc(p.date) : '') + '</p></div>';
  }
  function pkAllOpen() {
    var all = PK.all = { loading: true, total: 0, groups: [], error: '', open: {} }; PK.ride = false; render();
    callTo('/prokat-foto', { action: 'all' }).then(function (r) {
      if (PK.all !== all) return;
      all.loading = false;
      if (!r || !r.ok) all.error = (r && r.error) || TX('не удалось загрузить');
      else { all.groups = Array.isArray(r.groups) ? r.groups : []; all.total = r.total == null ? all.groups.reduce(function (s, g) { return s + pkNum(g.count); }, 0) : r.total; }
      if (S.view === 'prokat') render();
    });
  }
  function renderPkAll(el) {
    var all = PK.all, h = pkBtn('home', '← ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')), true, 'margin-bottom:8px') + '<h2 style="padding-right:36px">🧰 ' + esc(TX('Все инструменты')) + (!all.loading && !all.error ? ' <span style="font-size:16px;padding:2px 9px;border-radius:12px;background:rgba(127,127,127,.15)">' + esc(all.total) + '</span>' : '') + '</h2>';
    if (all.loading) return void (el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>');
    if (all.error) return void (el.innerHTML = h + '<p style="color:#c0392b">' + esc(all.error) + '</p>' + pkBtn('all-retry', esc(TX('Ещё раз')), true));
    h += all.groups.length ? '<div style="display:grid;gap:8px">' + all.groups.map(function (g, i) {
      var on = !!all.open[i], items = Array.isArray(g.items) ? g.items : [];
      return '<div style="border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden">' +
        '<button type="button" data-pk="grp:' + i + '" aria-expanded="' + on + '" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer"><span style="flex:none;width:14px">' + (on ? '▾' : '▸') + '</span><b style="flex:1">' + esc(g.group || TX('Другое')) + '</b><span style="flex:none;font-weight:700;padding:2px 9px;border-radius:12px;background:rgba(127,127,127,.15)">' + esc(g.count == null ? items.length : g.count) + '</span></button>' +
        (on ? '<div style="padding:0 12px 8px">' + (items.length ? items.map(function (x) {
          return '<div style="padding:6px 0;border-top:1px solid rgba(127,127,127,.2)">' + esc(x.name || '') + ' — <span style="opacity:.8">' + esc([x.point, x.city].filter(Boolean).join(', ')) + '</span></div>';
        }).join('') : '<p style="opacity:.75;margin:6px 0">' + esc(TX('Пока пусто')) + '</p>') + '</div>' : '') + '</div>';
    }).join('') + '</div>' : '<p style="opacity:.75">' + esc(TX('Пока пусто')) + '</p>';
    el.innerHTML = h;
  }
  /* ---------- Напоминания, сравнение пунктов, объезд ---------- */
  function pkDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(s || ''); }
  function pkVisit(p) {
    if (!p || !p.last_visit) return TX('объезда не было');
    var d = pkNum(p.visit_days);
    return d <= 0 ? TX('объезд сегодня') : TX('объезд') + ' ' + d + ' ' + TX('дн. назад');
  }
  // Напоминания: давно не было объезда, владелец должен передать деньги, инструмент долго сломан.
  function pkRemLoad() {
    var rem = PK.rem = { loading: true, data: null, open: PK.rem ? PK.rem.open : false };
    callTo('/prokat', { action: 'reminders' }).then(function (r) {
      if (PK.rem !== rem) return;
      rem.loading = false; rem.data = r && r.ok ? r : null;
      if (S.view === 'prokat') render();
    });
  }
  function pkRemLists() {
    var d = PK.rem && PK.rem.data; if (!d) return null;
    return { visit: Array.isArray(d.visit) ? d.visit : [], owed: Array.isArray(d.owed) ? d.owed : [], broken: Array.isArray(d.broken) ? d.broken : [] };
  }
  function pkRemBlock() {
    var L = pkRemLists(); if (!L) return '';
    var n = L.visit.length + L.owed.length + L.broken.length; if (!n) return '';
    var open = PK.rem.open, row = function (k, i, text) { return '<button type="button" data-pk="rp:' + k + ':' + i + '" style="display:block;width:100%;text-align:left;padding:8px 0;border:0;border-top:1px solid rgba(192,57,43,.25);background:none;color:inherit;font:inherit;cursor:pointer">' + text + '</button>'; };
    var h = '<div style="border:2px solid #c0392b;border-radius:12px;background:rgba(192,57,43,.08);margin-bottom:10px">' +
      '<button type="button" data-pk="rem" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:0;background:none;color:#c0392b;font:inherit;font-weight:700;text-align:left;cursor:pointer"><span style="flex:1">🔔 ' + esc(TX('Напоминания')) + '</span><span style="flex:none;min-width:28px;text-align:center;padding:2px 8px;border-radius:12px;background:#c0392b;color:#fff">' + n + '</span><span style="flex:none">' + (open ? '▾' : '▸') + '</span></button>';
    if (open) {
      h += '<div style="padding:0 12px 10px">';
      if (L.visit.length) h += '<p style="margin:6px 0 2px;font-weight:700">' + esc(TX('Давно не было объезда')) + '</p>' + L.visit.map(function (x, i) { return row('v', i, '🚗 ' + esc(x.name) + ' — ' + (x.last ? esc(pkNum(x.days)) + ' ' + esc(TX('дн.')) + ' (' + esc(TX('последний')) + ' ' + esc(pkDay(x.last)) + ')' : esc(TX('объезда не было')))); }).join('');
      if (L.owed.length) h += '<p style="margin:10px 0 2px;font-weight:700">' + esc(TX('Владелец должен передать')) + '</p>' + L.owed.map(function (x, i) { return row('o', i, '💵 ' + esc(x.name) + ' — <b>' + pkMoney(x.amount) + '</b>'); }).join('');
      if (L.broken.length) h += '<p style="margin:10px 0 2px;font-weight:700">' + esc(TX('Долго сломан')) + '</p>' + L.broken.map(function (x, i) { return row('b', i, '🔧 ' + esc(x.name) + ': ' + esc(x.tool) + ' — ' + esc(pkNum(x.days)) + ' ' + esc(TX('дн.'))); }).join('');
      h += '</div>';
    }
    return h + '</div>';
  }
  // Сравнение пунктов: сервер уже отсортировал от лучшего к худшему.
  function pkCmpOpen() {
    var c = PK.cmp = { loading: true, points: [], error: '', open: {} }; render();
    callTo('/prokat', { action: 'compare' }).then(function (r) {
      if (PK.cmp !== c) return;
      c.loading = false;
      if (!r || !r.ok) c.error = (r && r.error) || TX('не удалось загрузить'); else c.points = Array.isArray(r.points) ? r.points : [];
      if (S.view === 'prokat') render();
    });
  }
  function renderPkCmp(el) {
    var c = PK.cmp, h = pkBtn('home', '← ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')), true, 'margin-bottom:8px') + '<h2 style="padding-right:36px">📊 ' + esc(TX('Сравнение пунктов')) + '</h2>';
    if (c.loading) return void (el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>');
    if (c.error) return void (el.innerHTML = h + '<p style="color:#c0392b">' + esc(c.error) + '</p>' + pkBtn('cmp', esc(TX('Ещё раз')), true));
    h += '<p style="margin-top:0;opacity:.8">' + esc(TX('От лучшего к худшему. Нажмите на пункт, чтобы увидеть, что там простаивает.')) + '</p>';
    h += c.points.length ? '<div style="display:grid;gap:8px">' + c.points.map(function (p, i) {
      var idle = Array.isArray(p.idle) ? p.idle : [], n = p.idle_count == null ? idle.length : pkNum(p.idle_count), on = !!c.open[i];
      return '<div style="border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden">' +
        '<button type="button" data-pk="ci:' + i + '" aria-expanded="' + on + '" style="display:flex;gap:10px;width:100%;padding:12px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer">' +
          '<span style="flex:none;width:30px;height:30px;border-radius:15px;background:rgba(127,127,127,.15);display:flex;align-items:center;justify-content:center;font-weight:700">' + (i + 1) + '</span>' +
          '<span style="flex:1;min-width:0"><b style="display:block">' + esc(p.name) + '</b><small style="opacity:.75">' + esc(p.city || '') + '</small>' +
            '<span style="display:block;font-size:14px;margin-top:4px">' + esc(TX('аренд')) + ': <b>' + esc(pkNum(p.rentals)) + '</b> · ' + esc(TX('собрано')) + ': <b>' + pkMoney(p.collected) + '</b> · ' + esc(TX('доход из таблиц')) + ': <b>' + pkMoney(p.income_all) + '</b></span>' +
            '<span style="display:block;font-size:14px;margin-top:2px;font-weight:600;color:' + (n > 0 ? '#b26a00' : '#1f8a4c') + '">' + esc(TX('простаивает')) + ': ' + esc(n) + '</span></span>' +
          '<span style="flex:none">' + (on ? '▾' : '▸') + '</span></button>' +
        (on ? '<div style="padding:0 12px 10px 52px"><p style="margin:0 0 4px;font-weight:700">' + esc(TX('Что стоит перевезти')) + '</p>' + (idle.length ? idle.map(function (x) {
          var t = typeof x === 'object' && x ? (x.name || '') + (x.days != null ? ' — ' + pkNum(x.days) + ' ' + TX('дн. без аренды') : '') : String(x);
          return '<div style="padding:4px 0;border-top:1px solid rgba(127,127,127,.2)">' + esc(t) + '</div>';
        }).join('') : '<p style="opacity:.75;margin:0">' + esc(TX('Всё работает, перевозить нечего')) + '</p>') + '</div>' : '') + '</div>';
    }).join('') + '</div>' : '<p style="opacity:.75">' + esc(TX('Нет пунктов')) + '</p>';
    el.innerHTML = h;
  }
  // Объезд пункта: отметка по каждому инструменту (на месте / сломан / нет), заметка и фото. Сохраняем пачками по 5.
  var PK_STATES = ['на месте', 'сломан', 'нет'], PK_TOUR_BATCH = 5;
  function pkTourOpen(name) {
    var T = PK.tour = { name: name, loading: true, error: '', point: null, items: [], marks: [], sent: {}, plan: null, dirty: false, saving: false, prog: null, err: '' }; render();
    if (!PK.ph || PK.ph.name !== name || PK.ph.error) pkPhLoad(name);
    callTo('/prokat', { action: 'tour_point', name: name }).then(function (r) {
      if (PK.tour !== T) return;
      T.loading = false;
      if (!r || !r.ok) T.error = (r && r.error) || TX('не удалось загрузить');
      else { T.point = r.point || null; T.last_visit = r.last_visit || ''; T.items = Array.isArray(r.items) ? r.items : []; T.marks = T.items.map(function () { return { state: '', note: '', photo: '', wait: false }; }); }
      if (S.view === 'prokat') render();
    });
  }
  function pkShrink(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type || 'image/')) return fail(new Error(TX('Это не фото')));
      var fr = new FileReader();
      fr.onerror = function () { fail(new Error(TX('Не получилось открыть фото'))); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { fail(new Error(TX('Не получилось открыть фото. Сделайте снимок ещё раз.'))); };
        img.onload = function () {
          var tries = [[900, 0.6], [800, 0.5], [700, 0.45], [600, 0.4]], W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
          for (var i = 0; i < tries.length; i++) {
            var w = Math.min(tries[i][0], W), h = Math.round(H * w / W), c = document.createElement('canvas'); c.width = w; c.height = h;
            var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
            var url = c.toDataURL('image/jpeg', tries[i][1]);
            if (/^data:image\/jpeg;base64,/.test(url) && url.length * 3 / 4 < 1.5 * 1024 * 1024) return ok(url);
          }
          fail(new Error(TX('Фото слишком большое. Сделайте снимок ещё раз.')));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  // Прошлое фото инструмента для сравнения «было → стало»: берём из фото-истории пункта.
  function pkTourPrevOf(name) {
    var ph = PK.ph, k = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!ph || !PK.tour || ph.name !== PK.tour.name || !Array.isArray(ph.tools)) return null;
    return ph.tools.filter(function (t) { return String(t.name || '').toLowerCase().replace(/\s+/g, ' ').trim() === k && pkSafeUrl(t.url); })[0] || null;
  }
  function pkTourPrev(name, i) {
    var t = pkTourPrevOf(name); if (!t) return '';
    return '<button type="button" data-pk="tprev:' + i + '" style="display:flex;align-items:center;gap:10px;width:100%;margin:0 0 6px;padding:4px;border:1px solid rgba(127,127,127,.3);border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer"><img src="' + esc(t.url) + '" alt="" loading="lazy" style="width:64px;height:64px;object-fit:cover;border-radius:8px"><span><b>' + esc(TX('Прошлое фото')) + '</b><br><small>' + esc(t.last ? pkDay(t.last) : '') + ' · ' + esc(TX('сравните с новым')) + '</small></span></button>';
  }
  function renderPkTour(el) {
    var T = PK.tour, h = pkBtn('tour-back', '← ' + esc(TX('К пункту')), true, 'margin-bottom:8px' + (T.saving ? ';opacity:.5' : '')) + '<h2 style="padding-right:36px;margin-bottom:4px">🚗 ' + esc(TX('Объезд')) + ': ' + esc(T.name) + '</h2>';
    if (T.loading) return void (el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>');
    if (T.error) return void (el.innerHTML = h + '<p style="color:#c0392b">' + esc(T.error) + '</p>' + pkBtn('tour-retry', esc(TX('Ещё раз')), true));
    var marked = T.marks.filter(function (m) { return m.state; }).length;
    h += '<p style="margin:0 0 10px;opacity:.8">' + esc(T.last_visit ? TX('Прошлый объезд') + ': ' + pkDay(T.last_visit) : TX('объезда не было')) + '</p>';
    h += T.items.length ? '<div style="display:grid;gap:10px">' + T.items.map(function (it, i) {
      var m = T.marks[i], sent = !!T.sent[i];
      return '<div style="border:1px solid rgba(127,127,127,.35);border-radius:12px;padding:10px' + (sent ? ';opacity:.6' : '') + '">' +
        '<b style="display:block;font-size:17px">' + esc(it.name) + (it.qty != null ? ' <small style="font-weight:400;opacity:.75">· ' + esc(TX('шт.')) + ' ' + esc(it.qty) + '</small>' : '') + (sent ? ' ✅' : '') + '</b>' +
        '<small style="display:block;opacity:.75;margin-bottom:6px">' + (it.last_state ? esc(TX('было')) + ': ' + esc(it.last_state) + (it.last_date ? ', ' + esc(pkDay(it.last_date)) : '') + (it.last_note ? ' · ' + esc(it.last_note) : '') : esc(TX('раньше не отмечали'))) + '</small>' +
        pkTourPrev(it.name, i) +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + PK_STATES.map(function (st, k) {
          var on = m.state === st, col = k === 0 ? '#1f8a4c' : k === 1 ? '#c0392b' : '#b26a00';
          return '<button type="button" data-pk="ts:' + i + ':' + k + '" style="min-height:48px;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;border:2px solid ' + col + ';background:' + (on ? col : 'transparent') + ';color:' + (on ? '#fff' : col) + '">' + esc(TX(st)) + '</button>';
        }).join('') + '</div>' +
        '<input type="text" data-tnote="' + i + '" maxlength="200" autocomplete="off" placeholder="' + esc(TX('Заметка')) + '" value="' + esc(m.note) + '" style="display:block;width:100%;margin-top:6px">' +
        '<label style="display:flex;align-items:center;gap:10px;margin-top:6px;min-height:48px;padding:6px 10px;border:2px ' + (m.photo ? 'solid #1f8a4c' : 'dashed rgba(127,127,127,.5)') + ';border-radius:10px;cursor:pointer;font-weight:600">' +
          (m.photo ? '<img src="' + esc(m.photo) + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px">' : '📷') +
          '<span>' + esc(m.wait ? TX('Обрабатываю фото…') : m.photo ? TX('Фото готово, нажмите, чтобы переснять') : TX('Фото')) + '</span>' +
          '<input type="file" accept="image/*" capture="environment" data-tphoto="' + i + '" style="position:absolute;width:1px;height:1px;opacity:0"></label></div>';
    }).join('') + '</div>' : '<p style="opacity:.75">' + esc(TX('На пункте нет инструментов')) + '</p>';
    if (T.prog) h += '<div style="margin-top:12px"><div style="height:10px;border-radius:5px;background:rgba(127,127,127,.2);overflow:hidden"><div style="height:100%;width:' + Math.round(100 * T.prog.done / Math.max(1, T.prog.total)) + '%;background:#1f8a4c"></div></div><p style="margin:4px 0 0">' + esc(TX('Сохранено')) + ': ' + T.prog.done + ' ' + esc(TX('из')) + ' ' + T.prog.total + '</p></div>';
    if (T.err) h += '<p style="color:#c0392b;margin:10px 0 0">' + esc(T.err) + '</p>';
    h += '<p style="margin:12px 0 6px">' + esc(TX('Отмечено')) + ': ' + marked + ' ' + esc(TX('из')) + ' ' + T.items.length + '</p>' +
      pkBtn('tour-save', esc(T.saving ? TX('Сохраняю…') : TX('Сохранить объезд')), false, 'width:100%' + (T.saving ? ';opacity:.6' : ''));
    el.innerHTML = h + pkBigPhoto();
  }
  function pkTourSave() {
    var T = PK.tour; if (!T || T.saving || T.loading || T.error) return;
    if (T.marks.some(function (m) { return m.wait; })) { T.err = TX('Подождите, фото ещё обрабатывается'); return render(); }
    var todo = []; T.marks.forEach(function (m, i) { if (m.state && !T.sent[i]) todo.push(i); });
    if (!todo.length && !(T.plan && !T.dirty && T.plan.next < T.plan.batches.length)) { T.err = TX(T.marks.some(function (m) { return m.state; }) ? 'Всё отмеченное уже сохранено' : 'Отметьте хотя бы один инструмент'); return render(); }
    // Пачки по 5 инструментов, у каждой свой id. После обрыва связи повтор идёт с теми же id, если отметки не меняли.
    if (!T.plan || T.dirty || T.plan.next >= T.plan.batches.length) {
      var b = []; for (var k = 0; k < todo.length; k += PK_TOUR_BATCH) b.push({ id: oid(), idx: todo.slice(k, k + PK_TOUR_BATCH) });
      T.plan = { batches: b, next: 0 }; T.dirty = false;
    }
    var total = T.plan.batches.reduce(function (s, x) { return s + x.idx.length; }, 0), done = T.plan.batches.slice(0, T.plan.next).reduce(function (s, x) { return s + x.idx.length; }, 0);
    T.saving = true; T.err = ''; T.prog = { done: done, total: total }; render();
    (function next() {
      if (PK.tour !== T) return;
      var B = T.plan.batches[T.plan.next];
      if (!B) {
        T.saving = false;
        var cnt = Object.keys(T.sent).length;
        PK.tour = null; PK.msg = TX('Объезд сохранён') + ': ' + cnt + ' ' + TX('инстр.');
        render(); pkOpenPointQuiet(T.name); pkReload(); pkRemLoad();
        return;
      }
      var items = B.idx.map(function (i) { var m = T.marks[i], o = { name: T.items[i].name, state: m.state, note: String(m.note || '').trim().slice(0, 200) }; if (m.photo) o.photo = m.photo; return o; });
      callTo('/prokat', { action: 'tour_save', name: T.name, id: B.id, items: items }).then(function (r) {
        if (PK.tour !== T) return;
        if (!r || !r.ok) {
          T.saving = false; T.err = (r && r.error) || TX('Не получилось сохранить');
          if (r && r.error && r.error !== TX('нет связи')) B.id = oid(); // сервер отказал — следующая попытка этой пачки будет новой записью
          return render();
        }
        B.idx.forEach(function (i) { T.sent[i] = true; });
        T.plan.next++; T.prog.done += B.idx.length; render(); next();
      });
    })();
  }
  function pkTourClick(k) {
    var T = PK.tour;
    if (k === 'tour') { if (PK.cur && PK.cur.name) pkTourOpen(PK.cur.name); return true; }
    if (!T) return false;
    if (k === 'tour-back') { if (!T.saving) { PK.tour = null; render(); } return true; }
    if (k === 'tour-retry') { pkTourOpen(T.name); return true; }
    if (k === 'tour-save') { pkTourSave(); return true; }
    if (k.indexOf('tprev:') === 0) { var it = T.items[+k.slice(6)], pv = it && pkTourPrevOf(it.name); if (pv) { PK.big = { url: pv.url, name: it.name, date: pkDay(pv.last) }; render(); } return true; }
    if (k.indexOf('ts:') === 0) {
      var a = k.split(':'), i = +a[1], st = PK_STATES[+a[2]], m = T.marks[i];
      if (m && st && !T.saving && !T.sent[i]) { m.state = m.state === st ? '' : st; T.dirty = true; T.err = ''; render(); }
      return true;
    }
    return false;
  }
  document.addEventListener('input', function (e) {
    var t = e.target, T = PK.tour; if (!T || !t || !t.getAttribute) return;
    var i = t.getAttribute('data-tnote'); if (i == null || !T.marks[+i] || T.sent[+i]) return;
    T.marks[+i].note = t.value; T.dirty = true;
  });
  document.addEventListener('change', function (e) {
    var t = e.target, T = PK.tour; if (!T || !t || !t.getAttribute) return;
    var i = t.getAttribute('data-tphoto'); if (i == null) return;
    var m = T.marks[+i], file = t.files && t.files[0]; if (!m || !file || T.saving || T.sent[+i]) return;
    m.wait = true; T.err = ''; render();
    pkShrink(file).then(function (url) { m.photo = url; T.dirty = true; }, function (er) { T.err = er.message; }).then(function () { m.wait = false; if (PK.tour === T) render(); });
  });
  function pkClick(k) {
    if (pkTourClick(k)) return;
    if (pkMoveClick(k)) return;
    if (pkAddClick(k)) return;
    if (k.indexOf('ride-p:') === 0) { var rp = PK.points[+k.slice(7)]; if (rp) { pkOpenPoint(rp.name); pkTourOpen(rp.name); } return; }
    if (pkSkClick(k)) return;
    if (pkOlClick(k)) return;
    if (pkShClick(k)) return;
    if (k === 'cmp') return pkCmpOpen();
    if (k.indexOf('ci:') === 0) { if (PK.cmp) { var ci = +k.slice(3); PK.cmp.open[ci] = !PK.cmp.open[ci]; render(); } return; }
    if (k === 'rem') { if (PK.rem) { PK.rem.open = !PK.rem.open; render(); } return; }
    if (k.indexOf('rp:') === 0) { var L = pkRemLists(), ra = k.split(':'), rx = L && L[{ v: 'visit', o: 'owed', b: 'broken' }[ra[1]]]; var it = rx && rx[+ra[2]]; if (it && it.name) { PK.folder = true; pkOpenPoint(it.name); } return; }
    if (k.indexOf('f:') === 0) { if (['all', 'minus', 'plus', 'idle'].indexOf(k.slice(2)) >= 0) PK.filter = k.slice(2); return render(); }
    if (k.indexOf('p:') === 0) { var p = PK.points[+k.slice(2)]; if (p) pkOpenPoint(p.name); return; }
    if (k.indexOf('m:') === 0) { if (PK.form && PK_PAY[k.slice(2)]) { pkKeep(); PK.form.method = k.slice(2); render(); } return; }
    if (k === 'folder') { PK.folder = true; PK.ride = false; return render(); }
    if (k === 'home') { PK.buy = null; PK.mv = null; PK.folder = false; PK.sk = null; PK.all = null; PK.cmp = null; PK.ride = false; return render(); }
    if (k === 'sklad') return pkSkOpen();
    if (pkBuyClick(k)) return;
    if (k === 'push') return pushEnable();
    if (k === 'all') return pkAllOpen();
    if (k === 'all-retry') return pkAllOpen();
    if (k.indexOf('grp:') === 0) { if (PK.all) { var gi = +k.slice(4); PK.all.open[gi] = !PK.all.open[gi]; render(); } return; }
    if (k.indexOf('ptg:') === 0) { var gg = pkGroups(PK.ph && PK.ph.tools)[+k.slice(4)]; if (gg) { if (gg.items.length === 1) return pkToolOpen(gg.items[0]); PK.phG = PK.phG === gg.key ? '' : gg.key; render(); } return; }
    if (k.indexOf('pt:') === 0) return pkToolOpen(+k.slice(3));
    if (k === 'cd-save') { pkCardSave(); return; }
    if (k === 'pt-back') { PK.pt = null; PK.mv = null; PK.big = null; return render(); }
    if (k === 'pt-retry') { if (PK.pt) { var ti = PK.ph ? PK.ph.tools.map(function (t) { return t.name; }).indexOf(PK.pt.tool) : -1; PK.pt = null; if (ti >= 0) pkToolOpen(ti); else render(); } return; }
    if (k.indexOf('rl:') === 0) { if (PK.pt) { PK.pt.rl = { i: +k.slice(3), to: '', name: '', busy: false, err: '' }; PK.pt.msg = ''; render(); } return; }
    if (k.indexOf('rlp:') === 0) { var R = PK.pt && PK.pt.rl, nm = pkRelabelNames()[+k.slice(4)]; if (R && nm && !R.busy) { var ri = $s('pk-rl-new'); R.name = ''; if (ri) ri.value = ''; R.to = nm; R.err = ''; render(); } return; }
    if (k === 'rl-save') return pkRelabelSave();
    if (k === 'rl-cancel') { if (PK.pt && PK.pt.rl && !PK.pt.rl.busy) { PK.pt.rl = null; render(); } return; }
    if (k.indexOf('pth:') === 0) { var tp = PK.pt && PK.pt.photos[+k.slice(4)]; if (tp && pkSafeUrl(tp.url)) { PK.big = { url: tp.url, name: PK.pt.tool, date: pkDay(tp.date) }; render(); } return; }
    if (k === 'big-close') { PK.big = null; return render(); }
    if (k === 'ph-retry') { if (PK.cur) { pkPhLoad(PK.cur.name); render(); } return; }
    if (k === 'back') { PK.add = null; PK.cur = null; PK.ol = null; PK.sh = null; PK.pb = null; PK.ph = null; PK.pt = null; PK.big = null; PK.form = null; PK.msg = ''; PK.err = ''; PK.ride = false; return render(); }
    if (k === 'p-retry') { if (PK.cur) pkOpenPoint(PK.cur.name); return; }
    if (k === 'ride') { PK.ride = !PK.ride; return render(); }
    if (k === 'take') { var ro = PK.cur && PK.cur.rent ? pkNum(PK.cur.rent.owed) : 0; PK.form = { sum: ro > 0 ? String(Math.round(ro * 100) / 100) : '', method: 'cash', note: '', id: oid(), busy: false }; PK.err = ''; PK.msg = ''; PK.ride = false; render(); var s = $s('pk-sum'); if (s) s.focus(); return; }
    if (k === 'cancel') { PK.form = null; PK.err = ''; return render(); }
    if (k === 'save') return pkSave();
  }
  function renderSoon(el, id) {
    var s = LIST.filter(function (x) { return x.id === id; })[0]; if (!s) { S.view = 'list'; return render(); }
    el.innerHTML = backBtn() + '<h2 style="padding-right:36px">' + s.ico + ' ' + esc(TX(s.name)) + '</h2><p>' + esc(TX(s.about)) + '.</p><p><b>' + esc(TX('Скоро.')) + '</b> ' + esc(TX('Этот специалист ещё готовится. Мы сообщим, когда он заработает.')) + '</p>';
  }

  /* ---------- SMM-специалист ---------- */
  var SM = { st: null, busy: false, res: '', act: '', err: '', plan: '', cap: '', ideas: '', rep: '', copied: false, an: null, anBusy: false, anErr: '', anCopied: false, anTimer: 0 };
  function openSmm() {
    S.view = 'smm'; SM.res = ''; SM.err = ''; SM.st = null; SM.copied = false; SM.an = null; SM.anErr = ''; SM.anCopied = false; anStop(); render();
    callTo('/smm', { action: 'status' }).then(function (r) {
      SM.st = r.ok ? r : { error: r.error || TX('не удалось загрузить') };
      if (S.view === 'smm') render();
    });
    anLoad();
  }
  /* Полный анализ Instagram: n8n разбирает видео, комментарии и Директ в фоне, окно раз в несколько секунд спрашивает, как идёт. */
  function anStop() { if (SM.anTimer) { clearTimeout(SM.anTimer); SM.anTimer = 0; } }
  function anLoad() {
    return callTo('/smm', { action: 'analysis_status' }).then(function (r) {
      if (S.view !== 'smm') return;
      var prev = SM.an ? [SM.an.running, SM.an.status, SM.an.shag, SM.an.error] : null;
      if (r.ok) { SM.an = r; SM.anErr = ''; } else if (!SM.an) SM.an = { error: r.error || TX('не удалось загрузить') };
      var cur = SM.an ? [SM.an.running, SM.an.status, SM.an.shag, SM.an.error] : null;
      var ae = document.activeElement, typing = !!(ae && (ae.id === 'sm-plan' || ae.id === 'sm-cap' || ae.id === 'sm-ideas' || ae.id === 'sm-rep'));
      anSchedule();
      if (!typing || JSON.stringify(prev) !== JSON.stringify(cur)) render();
    });
  }
  function anSchedule() {
    anStop();
    if (S.view === 'smm' && SM.an && SM.an.running) SM.anTimer = setTimeout(function () { SM.anTimer = 0; if (S.view === 'smm') anLoad(); }, 8000);
  }
  function anStart() {
    if (SM.anBusy || (SM.an && SM.an.running)) return;
    SM.anBusy = true; SM.anErr = ''; SM.anCopied = false; render();
    callTo('/smm', { action: 'analysis_start' }).then(function (r) {
      SM.anBusy = false;
      if (!r.ok) { SM.anErr = r.error || TX('Не получилось запустить анализ'); if (S.view === 'smm') render(); return; }
      var left = SM.an && SM.an.left_this_month != null ? Math.max(0, SM.an.left_this_month - 1) : 0;
      SM.an = { ok: true, running: true, status: 'running', shag: TX('Запущено'), otchet: '', left_this_month: left, extra_price_somoni: SM.an && SM.an.extra_price_somoni || 50 };
      if (S.view === 'smm') { render(); anSchedule(); }
    });
  }
  // Копирование: сначала буфер обмена браузера, если не разрешён — запасной способ через скрытое поле.
  function copyText(text, done) {
    function fallback() {
      try {
        var ta = document.createElement('textarea'); ta.value = String(text || ''); ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta); ta.select(); var ok = document.execCommand && document.execCommand('copy'); document.body.removeChild(ta);
        if (ok) done();
      } catch (e) {}
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(text || '')).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function anFmtDate(s) { var d = new Date(s); if (!s || isNaN(d.getTime())) return ''; return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function anCard() {
    var a = SM.an, conn = !!(SM.st && SM.st.connected);
    var h = '<div style="display:grid;gap:8px;margin:6px 0 14px;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px">' +
      '<b>🔎 ' + esc(TX('Полный анализ Instagram')) + '</b>' +
      '<small style="opacity:.8">' + esc(TX('Разберу ваши видео (по тому, что в них сказано), комментарии и темы обращений в Директ, найду, что заходит, и дам план на неделю. Это занимает несколько минут, окно можно закрыть.')) + '</small>';
    if (!a) return h + '<p style="margin:0">' + esc(TX('Загрузка…')) + '</p></div>';
    if (a.error) return h + '<p class="err" style="margin:0">' + esc(a.error) + '</p><button class="btn sec" data-smm="an-reload" type="button">' + esc(TX('Ещё раз')) + '</button></div>';
    var left = Number(a.left_this_month || 0), price = a.extra_price_somoni || 50;
    if (a.running) {
      h += '<p style="margin:0">⏳ ' + esc(a.shag || TX('Запущено')) + '</p><small style="opacity:.75">' + esc(TX('Можно закрыть окно и вернуться позже: отчёт сохранится.')) + '</small>';
    } else {
      h += '<small>' + esc(TX('Бесплатных анализов в этом месяце осталось')) + ': <b>' + esc(left) + '</b></small>';
      if (!conn) h += '<small class="err">' + esc(TX('Сначала подключите Instagram в меню (каналы).')) + '</small>';
      if (left > 0) h += '<button class="btn" data-smm="an-start" type="button"' + (SM.anBusy || !conn ? ' disabled' : '') + '>' + esc(TX(a.status === 'done' ? 'Сделать анализ заново' : 'Сделать полный анализ')) + '</button>';
      else h += '<small>' + esc(TX('Бесплатный анализ в этом месяце уже использован. Дополнительный анализ стоит')) + ' ' + esc(price) + ' ' + esc(TX('сомони: напишите нам, и мы его включим.')) + '</small>';
    }
    if (SM.anErr) h += '<p class="err" style="margin:0">' + esc(SM.anErr) + '</p>';
    if (a.status === 'error' && !a.running) h += '<p class="err" style="margin:0">' + esc(a.shag || TX('Анализ не завершился, запустите ещё раз')) + '</p>';
    if (a.status === 'done' && a.otchet && !a.running) {
      h += '<small style="opacity:.75">' + esc(TX('Отчёт от')) + ' ' + esc(anFmtDate(a.finished)) + (a.novyh_video ? ', ' + esc(TX('новых видео разобрано')) + ': ' + esc(a.novyh_video) : '') + '</small>' +
        '<div style="white-space:pre-wrap;word-break:break-word;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;font-size:14px;line-height:1.45" id="sm-an-res">' + esc(a.otchet) + '</div>' +
        '<button class="btn sec" data-smm="an-copy" type="button">' + esc(TX(SM.anCopied ? 'Скопировано ✓' : 'Скопировать отчёт')) + '</button>';
    }
    return h + '</div>';
  }
  function renderSmm(el) {
    var h = backBtn() + '<h2 style="padding-right:36px">📣 ' + esc(TX('SMM-специалист')) + '</h2>';
    var dis = SM.busy ? ' disabled' : '';
    if (!SM.st) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (SM.st.error) { el.innerHTML = h + '<p class="err">' + esc(SM.st.error) + '</p><button class="btn" data-smm="reload" type="button">' + esc(TX('Ещё раз')) + '</button>'; return; }
    h += '<p style="margin:4px 0">' + (SM.st.connected
      ? '✅ ' + esc(TX('Instagram подключён')) + (SM.st.username ? ': @' + esc(SM.st.username) : '')
      : '⚠️ ' + esc(TX('Instagram не подключён. Подключите его в меню (каналы), тогда я буду опираться на ваши посты.'))) + '</p>' +
      '<p style="margin:4px 0 10px"><small>' + esc(TX('Запросов сегодня осталось')) + ': <b>' + esc(SM.st.left) + '</b> ' + esc(TX('из')) + ' ' + esc(SM.st.limit || 5) + '</small></p>';
    h += anCard();
    h += '<div style="display:grid;gap:8px;margin-bottom:10px">' +
      '<b>' + esc(TX('План на неделю')) + '</b>' +
      '<textarea class="in2" id="sm-plan" rows="2" maxlength="800" placeholder="' + esc(TX('Что было на этой неделе: вопросы клиентов, события (необязательно)')) + '">' + esc(SM.plan) + '</textarea>' +
      '<button class="btn" data-smm="plan" type="button"' + dis + '>' + esc(TX('Составить план')) + '</button></div>';
    h += '<div style="display:grid;gap:8px;margin-bottom:10px">' +
      '<b>' + esc(TX('Подпись к посту или Reels')) + '</b>' +
      '<textarea class="in2" id="sm-cap" rows="2" maxlength="800" placeholder="' + esc(TX('О чём пост или ролик?')) + '">' + esc(SM.cap) + '</textarea>' +
      '<button class="btn" data-smm="caption" type="button"' + dis + '>' + esc(TX('Написать подпись')) + '</button></div>';
    h += '<div style="display:grid;gap:8px;margin-bottom:10px">' +
      '<b>' + esc(TX('Идеи роликов')) + '</b>' +
      '<textarea class="in2" id="sm-ideas" rows="2" maxlength="800" placeholder="' + esc(TX('О чём хотите ролики? (необязательно)')) + '">' + esc(SM.ideas) + '</textarea>' +
      '<button class="btn" data-smm="ideas" type="button"' + dis + '>' + esc(TX('Придумать 5 идей')) + '</button></div>';
    h += '<div style="display:grid;gap:8px;margin-bottom:10px">' +
      '<b>' + esc(TX('Ответ на комментарий или сообщение')) + '</b>' +
      '<textarea class="in2" id="sm-rep" rows="3" maxlength="800" placeholder="' + esc(TX('Вставьте комментарий или сообщение, на которое нужно ответить')) + '">' + esc(SM.rep) + '</textarea>' +
      '<button class="btn" data-smm="reply" type="button"' + dis + '>' + esc(TX('Написать ответ')) + '</button></div>';
    h += '<div style="display:grid;gap:8px;margin-bottom:10px"><b>' + esc(TX('Разбор профиля')) + '</b>' +
      '<button class="btn sec" data-smm="profile" type="button"' + dis + '>' + esc(TX('Разобрать мой профиль')) + '</button></div>';
    if (SM.busy) h += '<p>⏳ ' + esc(TX('Готовлю ответ, это до минуты…')) + '</p>';
    if (SM.err) h += '<p class="err">' + esc(SM.err) + '</p>';
    if (SM.res) h += '<div style="white-space:pre-wrap;word-break:break-word;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;margin:8px 0;font-size:14px;line-height:1.45" id="sm-res">' + esc(SM.res) + '</div>' +
      '<button class="btn sec" data-smm="copy" type="button">' + esc(TX(SM.copied ? 'Скопировано ✓' : 'Скопировать')) + '</button>' +
      kbBtn('smm', SM.res ? { q: SM.q || '', a: SM.res } : null) +
      '<p><small>' + esc(TX('Я ничего не публикую сам: текст вставляете вы.')) + '</small></p>';
    else KB.last.smm = null;
    h += kbCard('smm');
    el.innerHTML = h;
  }
  function runSmm(act) {
    if (SM.busy) return;
    var text = act === 'plan' ? SM.plan : act === 'caption' ? SM.cap : act === 'ideas' ? SM.ideas : act === 'reply' ? SM.rep : '';
    if (act === 'caption' && String(text).trim().length < 5) { SM.err = TX('Напишите, о чём пост или ролик'); SM.res = ''; return render(); }
    if (act === 'reply' && String(text).trim().length < 5) { SM.err = TX('Вставьте комментарий или сообщение, на которое нужно ответить'); SM.res = ''; return render(); }
    SM.busy = true; SM.err = ''; SM.res = ''; SM.copied = false; KB.smm.saved = false; render();
    var qLabel = { plan: 'План на неделю', caption: 'Подпись', ideas: 'Идеи роликов', reply: 'Ответ на сообщение', profile: 'Разбор профиля' }[act] + (String(text).trim() ? ': ' + String(text).trim().slice(0, 200) : '');
    callTo('/smm', { action: act, text: String(text).trim() }).then(function (r) {
      SM.busy = false;
      if (r.ok) { SM.res = r.text || ''; SM.q = qLabel; if (SM.st && !SM.st.error) { SM.st.left = r.left; SM.st.connected = !!r.connected; } }
      else SM.err = r.error || TX('Не получилось');
      if (S.view === 'smm') render();
    });
  }
  function smmClick(a) {
    if (a === 'reload') return openSmm();
    if (a === 'an-reload') { SM.an = null; render(); return anLoad(); }
    if (a === 'an-start') return anStart();
    if (a === 'an-copy') return copyText((SM.an && SM.an.otchet) || '', function () { SM.anCopied = true; if (S.view === 'smm') render(); });
    if (a === 'copy') return copyText(SM.res, function () { SM.copied = true; if (S.view === 'smm') render(); });
    if (a === 'plan' || a === 'caption' || a === 'profile' || a === 'ideas' || a === 'reply') return runSmm(a);
  }

  /* ---------- База знаний специалиста: отработанные дела этого кабинета ---------- */
  var KB = { smm: { c: null, total: 0, open: false, busy: false, msg: '', saved: false }, lawyer: { c: null, total: 0, open: false, busy: false, msg: '', saved: false }, mkt: { c: null, total: 0, open: false, busy: false, msg: '', saved: false }, last: { smm: null, lawyer: null, mkt: null } };
  function kbView() { return S.view === 'law' ? 'lawyer' : S.view === 'smm' ? 'smm' : S.view === 'mkt' ? 'mkt' : ''; }
  function kbLoad(spec) {
    var k = KB[spec]; if (!k) return;
    callTo('/znaniya', { action: 'list', spec: spec }).then(function (r) {
      if (r.ok) { k.c = r.cases || []; k.total = r.total || 0; k.msg = ''; } else { k.msg = r.error || TX('не удалось загрузить'); if (!k.c) k.c = []; }
      if (kbView() === spec) render();
    });
  }
  function kbSave(spec) {
    var k = KB[spec], ln = KB.last[spec]; if (!k || k.busy || !ln) return;
    k.busy = true; k.msg = ''; render();
    callTo('/znaniya', { action: 'save', spec: spec, q: ln.q, a: ln.a }).then(function (r) {
      k.busy = false;
      if (r.ok) { k.saved = true; k.total = r.total || k.total; k.msg = r.duplicate ? ui('Это уже есть в базе знаний', 'Ин аллакай дар пойгоҳи дониш ҳаст', 'Bu allaqachon bilimlar bazasida bor') : ''; kbLoad(spec); }
      else k.msg = r.error || TX('Не получилось');
      if (kbView() === spec) render();
    });
  }
  function kbDel(spec, id) {
    var k = KB[spec]; if (!k || k.busy) return;
    if (k.ask !== id) { k.ask = id; return render(); }
    k.ask = null; k.busy = true; render();
    callTo('/znaniya', { action: 'delete', spec: spec, id: id }).then(function (r) {
      k.busy = false; if (!r.ok) k.msg = r.error || TX('Не получилось'); else kbLoad(spec);
      if (kbView() === spec) render();
    });
  }
  function kbBtn(spec, text) {
    var k = KB[spec];
    KB.last[spec] = text;
    if (!text) return '';
    return '<button class="btn sec" data-kb="save:' + spec + '" type="button"' + (k.busy || k.saved ? ' disabled' : '') + '>' + esc(k.saved ? ui('Запомнено ✓', 'Дар ёд монд ✓', 'Eslab qolindi ✓') : ui('Это подошло — запомнить', 'Ин мувофиқ омад — дар ёд нигоҳ дор', 'Bu maʼqul boʻldi — eslab qol')) + '</button>';
  }
  function kbCard(spec) {
    var k = KB[spec]; if (!k) return '';
    if (k.c === null) { k.c = []; kbLoad(spec); }
    var h = '<div style="margin-top:16px;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px;display:grid;gap:8px">' +
      '<b>📚 ' + esc(ui('База знаний', 'Пойгоҳи дониш', 'Bilimlar bazasi')) + '</b>' +
      '<small style="opacity:.8">' + esc(ui('Здесь сохраняются удачные дела. Специалист опирается на них, когда отвечает вам. Видите их только вы.', 'Дар ин ҷо корҳои хуб нигоҳ дошта мешаванд. Мутахассис ҳангоми ҷавоб ба шумо ба онҳо такя мекунад. Онҳоро танҳо шумо мебинед.', 'Bu yerda muvaffaqiyatli ishlar saqlanadi. Mutaxassis sizga javob berganda ularga tayanadi. Ularni faqat siz koʻrasiz.')) + '</small>' +
      '<small>' + esc(ui('Запомнено дел', 'Корҳои дар ёдмонда', 'Eslab qolingan ishlar')) + ': <b>' + esc(k.total) + '</b></small>';
    if (k.msg) h += '<small class="err">' + esc(k.msg) + '</small>';
    if (k.total) h += '<button class="btn sec" data-kb="toggle:' + spec + '" type="button">' + esc(k.open ? ui('Скрыть', 'Пинҳон кардан', 'Yashirish') : ui('Показать', 'Нишон додан', 'Koʻrsatish')) + '</button>';
    if (k.open && k.c.length) {
      h += '<div style="display:grid;gap:8px">' + k.c.map(function (c) {
        return '<div style="border:1px solid var(--line,#ddd);border-radius:10px;padding:8px"><b style="font-size:13px">' + esc(c.q) + '</b>' +
          '<div style="white-space:pre-wrap;word-break:break-word;font-size:13px;opacity:.85;max-height:120px;overflow:auto;margin:4px 0">' + esc(c.a) + '</div>' +
          '<button class="btn sec" data-kb="del:' + spec + ':' + c.id + '" type="button" style="padding:4px 10px;height:auto"' + (k.busy ? ' disabled' : '') + '>' + esc(k.ask === c.id ? ui('Точно удалить?', 'Ҳатман нест кунам?', 'Rostdan oʻchirilsinmi?') : ui('Удалить', 'Нест кардан', 'Oʻchirish')) + '</button></div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }
  function kbClick(a) {
    var p = a.split(':'), spec = p[1];
    if (p[0] === 'save') return kbSave(spec);
    if (p[0] === 'toggle') { KB[spec].open = !KB[spec].open; return render(); }
    if (p[0] === 'del') return kbDel(spec, Number(p[2]));
  }

  /* ---------- Менеджер по клиентам: что он делает и что уже работает ---------- */
  var MGQ = false;
  function quietList() {
    var ch = (typeof CHATS !== 'undefined' && CHATS) || [], now = Date.now(), out = [];
    ch.forEach(function (c) {
      var m = (c && c.messages) || []; if (!m.length) return;
      var l = m[m.length - 1], t = Date.parse(l.v); if (l.d !== 'out' || isNaN(t)) return;
      if (!m.some(function (x) { return x.d === 'in'; })) return;
      var days = Math.floor((now - t) / 86400000); if (days < 3 || days > 60) return;
      out.push({ name: String(c.imya || c.id || '?'), kanal: String(c.kanal || ''), days: days });
    });
    out.sort(function (x, y) { return x.days - y.days; });
    return out;
  }
  var REP = { open: false, days: 30 };
  try { var rd = Number(lstore('ew_mgr_days')); if ([14, 30, 60, 90].indexOf(rd) >= 0) REP.days = rd; } catch (e) {}
  function repeatList() {
    var ch = (typeof CHATS !== 'undefined' && CHATS) || [], now = Date.now(), out = [];
    ch.forEach(function (c) {
      var m = (c && c.messages) || []; if (!m.length) return;
      var t = Date.parse(m[m.length - 1].v); if (isNaN(t)) return;
      if (!m.some(function (x) { return x.d === 'in'; })) return;
      var days = Math.floor((now - t) / 86400000); if (days < REP.days || days > 365) return;
      var key = cardKey(c), ns = (CARD.notes || []).filter(function (n) { return n.key === key; });
      out.push({ name: String(c.imya || c.id || '?'), kanal: String(c.kanal || ''), days: days, note: ns.length ? ns[0].t : '' });
    });
    out.sort(function (x, y) { return x.days - y.days; });
    return out;
  }
  function repeatHtml() {
    if (!REP.open) return '';
    if (CARD.notes === null) { CARD.notes = []; cardLoad(); }
    var h = '<div style="margin-top:8px;display:grid;gap:6px"><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><small>' + esc(ui('Молчат дольше, дней', 'Беш аз ин рӯз хомӯшанд', 'Shuncha kundan ortiq jim')) + ':</small>' +
      [14, 30, 60, 90].map(function (d) { return '<button type="button" class="btn' + (REP.days === d ? '' : ' sec') + '" data-mgr="rd:' + d + '" style="height:auto;padding:4px 10px">' + d + '</button>'; }).join('') + '</div>';
    var l = repeatList();
    h += l.length ? l.slice(0, 50).map(function (q) {
      return '<div style="border:1px solid var(--line,#ddd);border-radius:10px;padding:8px"><div style="display:flex;justify-content:space-between;gap:8px"><b style="word-break:break-word">' + esc(q.name) + '</b><small style="flex:none;opacity:.8">' + esc(q.kanal) + ' · ' + esc(q.days) + ' ' + esc(ui('дн.', 'рӯз', 'kun')) + '</small></div>' +
        (q.note ? '<small style="opacity:.85;word-break:break-word">' + esc(ui('Заметка', 'Қайд', 'Qayd')) + ': ' + esc(q.note.slice(0, 120)) + '</small>' : '') + '</div>';
    }).join('') + '<small style="opacity:.8">' + esc(ui('Напишите им сами или возьмите текст у Маркетолога.', 'Худатон нависед ё матнро аз Маркетолог гиред.', 'Oʻzingiz yozing yoki matnni Marketologdan oling.')) + '</small>' : '<small style="opacity:.8">' + esc(ui('Сейчас таких клиентов нет.', 'Ҳоло чунин мижозон нест.', 'Hozir bunday mijozlar yoʻq.')) + '</small>';
    return h + '</div>';
  }
  var CARD = { open: false, notes: null, list: [], q: '', cur: null, busy: false, msg: '', ask: null };
  function cardKey(c) { return String(c.kanal || '') + ':' + String(c.id || ''); }
  function cardLoad() {
    callTo('/znaniya', { action: 'nlist' }).then(function (r) {
      if (r.ok) { CARD.notes = r.notes || []; CARD.msg = ''; } else { CARD.notes = CARD.notes || []; CARD.msg = r.error || TX('не удалось загрузить'); }
      if (S.view === 'mgr') render();
    });
  }
  function cardsHtml() {
    if (!CARD.open) return '';
    if (CARD.notes === null) { CARD.notes = []; cardLoad(); }
    var box = 'border:1px solid var(--line,#ddd);border-radius:10px;padding:8px';
    var h = '<div style="margin-top:12px;display:grid;gap:8px">';
    if (CARD.msg) h += '<small class="err">' + esc(CARD.msg) + '</small>';
    if (CARD.cur) {
      var c = CARD.cur, key = cardKey(c), ns = CARD.notes.filter(function (n) { return n.key === key; });
      var m = c.messages || [], last = m.length ? m[m.length - 1] : null, lt = last ? Date.parse(last.v) : NaN;
      var nin = m.filter(function (x) { return x.d === 'in'; }).length, dis = CARD.busy ? ' disabled' : '';
      h += '<button class="btn sec" data-mgr="cback" type="button">← ' + esc(ui('К списку клиентов', 'Ба рӯйхати мижозон', 'Mijozlar roʻyxatiga')) + '</button>' +
        '<div style="' + box + ';display:grid;gap:4px"><b style="word-break:break-word">' + esc(c.imya || c.id) + '</b><small style="opacity:.85">' + esc(c.kanal || '') + ' · ' + esc(ui('сообщений от клиента', 'паёмҳои мижоз', 'mijoz xabarlari')) + ': ' + esc(nin) +
        (isNaN(lt) ? '' : ' · ' + esc(ui('последнее', 'охирин', 'oxirgi')) + ': ' + esc(Math.floor((Date.now() - lt) / 86400000)) + ' ' + esc(ui('дн. назад', 'рӯз пеш', 'kun oldin'))) + '</small></div>' +
        '<textarea class="in2" id="mg-note" rows="2" maxlength="500" placeholder="' + esc(ui('Что купил, что просил, о чём договорились', 'Чӣ харид, чӣ хост, дар бораи чӣ созиш карданд', 'Nima sotib oldi, nima soradi, nimaga kelishildi')) + '"></textarea>' +
        '<button class="btn" data-mgr="cadd" type="button"' + dis + '>' + esc(ui('Добавить заметку', 'Илова кардани қайд', 'Qayd qoʻshish')) + '</button>';
      h += ns.length ? ns.map(function (n) {
        return '<div style="' + box + '"><div style="white-space:pre-wrap;word-break:break-word;font-size:14px">' + esc(n.t) + '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><small style="opacity:.7">' + esc(String(n.vremya || '').slice(0, 10)) + '</small>' +
          '<button class="btn sec" data-mgr="cdel:' + esc(Number(n.id)) + '" type="button" style="padding:4px 10px;height:auto"' + dis + '>' + esc(CARD.ask === Number(n.id) ? ui('Точно удалить?', 'Ҳатман нест кунам?', 'Rostdan oʻchiraymi?') : ui('Удалить', 'Нест кардан', 'Oʻchirish')) + '</button></div></div>';
      }).join('') : '<small style="opacity:.8">' + esc(ui('Заметок пока нет.', 'Ҳоло қайд нест.', 'Hozircha qayd yoʻq.')) + '</small>';
    } else {
      var all = ((typeof CHATS !== 'undefined' && CHATS) || []).filter(function (c) { return c && c.id !== undefined && c.id !== null; }), q = CARD.q.toLowerCase();
      CARD.list = all.filter(function (c) { return !q || String(c.imya || c.id).toLowerCase().indexOf(q) >= 0; }).slice(0, 30);
      h += '<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><input class="in2" id="mg-q" maxlength="60" value="' + esc(CARD.q) + '" placeholder="' + esc(ui('Имя клиента', 'Номи мижоз', 'Mijoz ismi')) + '"><button class="btn sec" data-mgr="csearch" type="button">' + esc(ui('Найти', 'Ёфтан', 'Qidirish')) + '</button></div>';
      h += CARD.list.length ? CARD.list.map(function (c, i) {
        var cnt = CARD.notes.filter(function (n) { return n.key === cardKey(c); }).length;
        return '<button type="button" class="btn sec" data-mgr="cpick:' + i + '" style="text-align:left;height:auto;padding:8px 10px;display:flex;justify-content:space-between;gap:8px"><b style="word-break:break-word">' + esc(c.imya || c.id) + '</b><small style="flex:none;opacity:.8">' + esc(c.kanal || '') + (cnt ? ' · ' + esc(cnt) + ' ' + esc(ui('заметок', 'қайд', 'qayd')) : '') + '</small></button>';
      }).join('') : '<small style="opacity:.8">' + esc(ui('Клиентов не найдено.', 'Мижозон ёфт нашуданд.', 'Mijozlar topilmadi.')) + '</small>';
    }
    return h + '</div>';
  }
  function cardClick(a) {
    if (a === 'cards') { CARD.open = !CARD.open; CARD.cur = null; CARD.ask = null; return render(); }
    if (a === 'csearch') { var f = $s('mg-q'); CARD.q = f ? String(f.value || '').slice(0, 60) : ''; return render(); }
    if (a === 'cback') { CARD.cur = null; CARD.ask = null; return render(); }
    if (a.indexOf('cpick:') === 0) { CARD.cur = CARD.list[Number(a.slice(6))] || null; CARD.ask = null; return render(); }
    if (a === 'cadd') {
      var t = $s('mg-note'), txt = t ? String(t.value || '').trim() : '';
      if (!CARD.cur || CARD.busy || txt.length < 2) return;
      CARD.busy = true; CARD.msg = ''; render();
      callTo('/znaniya', { action: 'nsave', key: cardKey(CARD.cur), t: txt }).then(function (r) {
        CARD.busy = false; if (!r.ok) CARD.msg = r.error || TX('Не получилось'); else cardLoad();
        if (S.view === 'mgr') render();
      });
      return;
    }
    if (a.indexOf('cdel:') === 0) {
      var id = Number(a.slice(5)); if (CARD.busy) return;
      if (CARD.ask !== id) { CARD.ask = id; return render(); }
      CARD.ask = null; CARD.busy = true; render();
      callTo('/znaniya', { action: 'ndel', id: id }).then(function (r) {
        CARD.busy = false; if (!r.ok) CARD.msg = r.error || TX('Не получилось'); else cardLoad();
        if (S.view === 'mgr') render();
      });
    }
  }
  function openMgr() { S.view = 'mgr'; MGQ = false; REP.open = false; CARD.open = false; CARD.cur = null; CARD.notes = null; render(); }
  function renderMgr(el) {
    var items = [
      { ico: '🔎', ok: true, t: ['Находит тех, кто замолчал', 'Онҳоро, ки хомӯш шудаанд, меёбад', 'Jim boʻlib qolganlarni topadi'], d: ['Смотрит ваши переписки и показывает клиентов, которые давно не писали.', 'Мукотибаҳои шуморо мебинад ва муштариёнеро нишон медиҳад, ки муддати дароз нанавиштаанд.', 'Yozishmalaringizni koʻrib, uzoq vaqt yozmagan mijozlarni koʻrsatadi.'] },
      { ico: '💌', ok: true, t: ['Пишет тексты для возврата', 'Матнҳо барои баргардонидан менависад', 'Qaytarish uchun matnlar yozadi'], d: ['Готовит мягкие сообщения для тех, кто замолчал. Отправляете вы или оператор, сам он никому не пишет. Работает сейчас через Маркетолога.', 'Паёмҳои мулоим барои хомӯшшудагон тайёр мекунад. Шумо ё оператор мефиристед, худаш ба касе наменависад. Ҳоло тавассути Маркетолог кор мекунад.', 'Jim boʻlib qolganlar uchun yumshoq xabarlar tayyorlaydi. Yuborishni siz yoki operator qilasiz, oʻzi hech kimga yozmaydi. Hozir Marketolog orqali ishlaydi.'] },
      { ico: '🔁', ok: true, t: ['Напоминает о повторной покупке или визите', 'Дар бораи харид ё ташрифи такрорӣ ёдовар мешавад', 'Qayta xarid yoki tashrif haqida eslatadi'], d: ['Подсказывает, когда пора написать клиенту снова: через месяц после услуги, когда заканчивается товар.', 'Мегӯяд, кай вақти дубора навиштан ба муштарӣ аст: баъди як моҳи хизмат, вақте ки мол тамом мешавад.', 'Mijozga qachon yana yozish vaqti kelganini aytadi: xizmatdan bir oy keyin, tovar tugaganda.'] },
      { ico: '📋', ok: true, t: ['Ведёт карточку клиента', 'Корти муштариро пеш мебарад', 'Mijoz kartochkasini yuritadi'], d: ['Помнит, что клиент покупал, что просил и когда писал последний раз, чтобы вы отвечали по делу.', 'Дар хотир медорад, ки муштарӣ чӣ харидааст, чӣ талаб кардааст ва охирин бор кай навишта буд.', 'Mijoz nima sotib olgani, nima soragani va oxirgi marta qachon yozganini eslab qoladi.'] }
    ], i = LI[window.LANG || 'ru'] || 0;
    var h = backBtn() + '<h2 style="padding-right:36px">🤝 ' + esc(TX('Менеджер по клиентам')) + '</h2>' +
      '<p>' + esc(ui('Его работа: чтобы клиенты не терялись. Он помогает вернуть тех, кто замолчал, и вовремя напомнить о себе. Сам он клиентам не пишет: тексты готовит, отправляете вы.', 'Вазифаи ӯ: муштариён гум нашаванд. Ӯ кӯмак мекунад хомӯшшудагонро баргардонед ва саривақт худро ёдовар шавед. Худаш ба муштариён наменависад: матнҳоро тайёр мекунад, шумо мефиристед.', 'Uning ishi: mijozlar yoʻqolib qolmasligi. U jim boʻlib qolganlarni qaytarishga va oʻz vaqtida eslatishga yordam beradi. Oʻzi mijozlarga yozmaydi: matnlarni tayyorlaydi, yuborishni siz qilasiz.')) + '</p><div style="display:grid;gap:10px">';
    items.forEach(function (x) {
      h += '<div style="border:1px solid var(--line,#ddd);border-radius:14px;padding:12px;display:grid;gap:4px"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:26px" aria-hidden="true">' + x.ico + '</span><b style="flex:1">' + esc(x.t[i]) + '</b>' +
        '<span style="flex:none;font-size:12px;padding:3px 8px;border-radius:10px;background:' + (x.ok ? '#e3f6ea;color:#1f8a4c' : '#eee;color:#777') + '">' + esc(x.ok ? ui('работает', 'кор мекунад', 'ishlayapti') : ui('готовится', 'омода мешавад', 'tayyorlanmoqda')) + '</span></div>' +
        '<small style="opacity:.85">' + esc(x.d[i]) + '</small></div>';
    });
    h += '</div><button class="btn sec" data-mgr="quiet" type="button" style="margin-top:12px">' + esc(MGQ ? ui('Скрыть список', 'Пинҳон кардани рӯйхат', 'Roʻyxatni yashirish') : ui('Показать, кто замолчал', 'Нишон додан, ки кӣ хомӯш шудааст', 'Kim jim boʻlib qolganini koʻrsatish')) + '</button>';
    if (MGQ) {
      var ql = quietList();
      h += ql.length ? '<div style="display:grid;gap:6px;margin-top:8px">' + ql.slice(0, 50).map(function (q) {
        return '<div style="border:1px solid var(--line,#ddd);border-radius:10px;padding:8px;display:flex;justify-content:space-between;gap:8px"><b style="word-break:break-word">' + esc(q.name) + '</b><small style="flex:none;opacity:.8">' + esc(q.kanal) + ' · ' + esc(q.days) + ' ' + esc(ui('дн. молчит', 'рӯз хомӯш аст', 'kun jim')) + '</small></div>';
      }).join('') + '</div><small style="opacity:.8">' + esc(ui('Показаны те, кому вы ответили последним и кто не отвечает от 3 до 60 дней.', 'Онҳое нишон дода шудаанд, ки шумо охирин ҷавоб додаед ва аз 3 то 60 рӯз ҷавоб намедиҳанд.', 'Oxirgi javobni siz bergan va 3 kundan 60 kungacha javob bermayotganlar koʻrsatilgan.')) + '</small>' : '<p><small>' + esc(ui('Сейчас таких клиентов нет.', 'Ҳоло чунин мижозон нест.', 'Hozir bunday mijozlar yoʻq.')) + '</small></p>';
    }
    h += '<button class="btn sec" data-mgr="repeat" type="button" style="margin-top:12px">' + esc(REP.open ? ui('Скрыть напоминания', 'Пинҳон кардани ёдоварӣ', 'Eslatmalarni yashirish') : ui('Кому пора напомнить', 'Ба кӣ ёдовар шудан лозим аст', 'Kimga eslatish vaqti keldi')) + '</button>' + repeatHtml();
    h += '<button class="btn sec" data-mgr="cards" type="button" style="margin-top:12px">' + esc(CARD.open ? ui('Скрыть карточки клиентов', 'Пинҳон кардани кортҳо', 'Kartochkalarni yashirish') : ui('Карточки клиентов', 'Кортҳои мижозон', 'Mijozlar kartochkalari')) + '</button>' + cardsHtml();
    h += '<button class="btn" data-mgr="mkt" type="button" style="margin-top:12px">' + esc(ui('Открыть тексты для возврата', 'Кушодани матнҳо барои баргардонидан', 'Qaytarish matnlarini ochish')) + '</button>' +
      '<p><small>' + esc(ui('В Маркетологе нажмите «Вернуть замолчавших».', 'Дар Маркетолог «Баргардонидани хомӯшшудагон»-ро пахш кунед.', 'Marketologda «Jim boʻlib qolganlarni qaytarish» tugmasini bosing.')) + '</small></p>';
    el.innerHTML = h;
  }

  /* ---------- Юрист: договоры на трёх языках ---------- */
  var LW = { view: 'menu', kind: '', lang: '', f: {}, res: '', err: '', copied: false, text: '', busy: false, left: null, q: '' };
  function ui(ru, tg, uz) { var l = (typeof window !== 'undefined' && window.LANG) || 'ru'; return l === 'tg' ? (tg || ru) : l === 'uz' ? (uz || ru) : ru; }
  var DKIND = {
    services: { ico: '🤝', ru: 'Договор оказания услуг', tg: 'Шартномаи хизматрасонӣ', uz: 'Xizmat koʻrsatish shartnomasi', sub: ['Исполнитель и клиент: консультации, мастера, обучение', 'Иҷрокунанда ва муштарӣ: машварат, усто, омӯзиш', 'Ijrochi va mijoz: maslahat, usta, oʻqitish'] },
    rent: { ico: '🏠', ru: 'Договор аренды', tg: 'Шартномаи иҷора', uz: 'Ijara shartnomasi', sub: ['Помещение или оборудование во временное пользование', 'Бино ё таҷҳизот барои истифодаи муваққатӣ', 'Xona yoki jihozni vaqtincha foydalanishga berish'] },
    sale: { ico: '🛒', ru: 'Договор купли-продажи', tg: 'Шартномаи хариду фурӯш', uz: 'Oldi-sotdi shartnomasi', sub: ['Продавец и покупатель: товар, цена, гарантия', 'Фурӯшанда ва харидор: мол, нарх, кафолат', 'Sotuvchi va xaridor: tovar, narx, kafolat'] }
  };
  // поля: k — ключ; п = подпись на трёх языках; t — тип (sel: варианты), ex — пример
  var DFIELDS = {
    services: [
      { k: 'a', l: ['Исполнитель (ФИО)', 'Иҷрокунанда (насаб, ном)', 'Ijrochi (F.I.Sh.)'] },
      { k: 'b', l: ['Клиент (ФИО)', 'Муштарӣ (насаб, ном)', 'Mijoz (F.I.Sh.)'] },
      { k: 'svc', l: ['Какая услуга', 'Кадом хизмат', 'Qanday xizmat'], ex: ['Например: психологическая консультация, 4 встречи в месяц', 'Масалан: машварати равонӣ, 4 вохӯрӣ дар як моҳ', 'Masalan: psixologik maslahat, oyiga 4 uchrashuv'] },
      { k: 'price', l: ['Стоимость и порядок оплаты', 'Нарх ва тартиби пардохт', 'Narx va toʻlov tartibi'], ex: ['Например: 1200 сомони за месяц, вперёд до начала месяца', 'Масалан: 1200 сомонӣ барои як моҳ, пешакӣ', 'Masalan: oyiga 1200 somoni, oldindan'] },
      { k: 'notice', l: ['За сколько часов предупреждать о переносе', 'Барои ба таъхир андохтан чанд соат пеш хабар додан', 'Koʻchirish haqida necha soat oldin ogohlantirish'], ex: ['24', '24', '24'] },
      { k: 'ref', t: 'sel', l: ['Если клиент отказался после начала месяца', 'Агар муштарӣ баъд аз оғози моҳ даст кашад', 'Mijoz oy boshlangandan keyin rad etsa'], o: [['after', 'Оплата за начатый период не возвращается', 'Пардохт барои давраи оғозшуда баргардонида намешавад', 'Boshlangan davr uchun toʻlov qaytarilmaydi'], ['prop', 'Возвращается оплата за неиспользованное время', 'Пардохт барои вақти истифоданашуда баргардонида мешавад', 'Foydalanilmagan vaqt uchun toʻlov qaytariladi']] },
      { k: 'term', l: ['Срок действия договора', 'Мӯҳлати амали шартнома', 'Shartnoma muddati'], ex: ['Например: до 30.11.2026', 'Масалан: то 30.11.2026', 'Masalan: 30.11.2026 gacha'] },
      { k: 'city', l: ['Город', 'Шаҳр', 'Shahar'], ex: ['Душанбе', 'Душанбе', 'Dushanbe'] }
    ],
    rent: [
      { k: 'a', l: ['Арендодатель (ФИО или название)', 'Иҷорадиҳанда (насаб, ном ё номи ташкилот)', 'Ijaraga beruvchi (F.I.Sh. yoki nomi)'] },
      { k: 'b', l: ['Арендатор (ФИО или название)', 'Иҷоранишин (насаб, ном ё номи ташкилот)', 'Ijarachi (F.I.Sh. yoki nomi)'] },
      { k: 'obj', l: ['Что сдаётся', 'Чӣ ба иҷора дода мешавад', 'Nima ijaraga beriladi'], ex: ['Например: помещение 30 кв. м под магазин', 'Масалан: бинои 30 м² барои мағоза', 'Masalan: doʻkon uchun 30 kv. m xona'] },
      { k: 'addr', l: ['Адрес или где находится', 'Суроға ё ҷойгиршавӣ', 'Manzil yoki joylashuvi'] },
      { k: 'price', l: ['Плата в месяц (сомони)', 'Ҳаққи иҷора дар як моҳ (сомонӣ)', 'Oylik toʻlov (somoni)'], ex: ['1500', '1500', '1500'] },
      { k: 'day', l: ['До какого числа месяца платить', 'То кадом рӯзи моҳ пардохт кардан', 'Oyning qaysi kunigacha toʻlash'], ex: ['5', '5', '5'] },
      { k: 'start', l: ['Дата начала аренды', 'Санаи оғози иҷора', 'Ijara boshlanish sanasi'], ex: ['01.11.2026', '01.11.2026', '01.11.2026'] },
      { k: 'term', l: ['На какой срок', 'Барои кадом мӯҳлат', 'Qancha muddatga'], ex: ['Например: 11 месяцев', 'Масалан: 11 моҳ', 'Masalan: 11 oy'] },
      { k: 'deposit', l: ['Залог (сомони, можно 0)', 'Гарав (сомонӣ, метавонад 0 бошад)', 'Garov (somoni, 0 boʻlishi mumkin)'], ex: ['1500', '1500', '1500'] },
      { k: 'util', t: 'sel', l: ['Коммунальные услуги', 'Хизматрасониҳои коммуналӣ', 'Kommunal xizmatlar'], o: [['tenant', 'Платит арендатор', 'Иҷоранишин пардохт мекунад', 'Ijarachi toʻlaydi'], ['landlord', 'Платит арендодатель', 'Иҷорадиҳанда пардохт мекунад', 'Ijaraga beruvchi toʻlaydi'], ['incl', 'Включены в плату', 'Дар ҳаққи иҷора дохил аст', 'Toʻlovga kiritilgan']] },
      { k: 'notice', l: ['За сколько дней предупреждать о расторжении', 'Барои бекор кардан чанд рӯз пеш хабар додан', 'Bekor qilish haqida necha kun oldin ogohlantirish'], ex: ['30', '30', '30'] },
      { k: 'city', l: ['Город', 'Шаҳр', 'Shahar'], ex: ['Душанбе', 'Душанбе', 'Dushanbe'] }
    ],
    sale: [
      { k: 'a', l: ['Продавец (ФИО или название)', 'Фурӯшанда (насаб, ном ё номи ташкилот)', 'Sotuvchi (F.I.Sh. yoki nomi)'] },
      { k: 'b', l: ['Покупатель (ФИО или название)', 'Харидор (насаб, ном ё номи ташкилот)', 'Xaridor (F.I.Sh. yoki nomi)'] },
      { k: 'item', l: ['Что продаётся и сколько', 'Чӣ ва чандто фурӯхта мешавад', 'Nima va qancha sotiladi'], ex: ['Например: диван, 1 шт.', 'Масалан: диван, 1 дона', 'Masalan: divan, 1 dona'] },
      { k: 'price', l: ['Общая цена (сомони)', 'Нархи умумӣ (сомонӣ)', 'Umumiy narx (somoni)'], ex: ['3500', '3500', '3500'] },
      { k: 'pay', t: 'sel', l: ['Когда оплата', 'Пардохт кай', 'Toʻlov qachon'], o: [['full', 'Полностью до передачи товара', 'Пурра пеш аз супоридани мол', 'Tovar topshirilguncha toʻliq'], ['half', 'Половина вперёд, остальное при получении', 'Нисфаш пешакӣ, боқӣ ҳангоми гирифтан', 'Yarmi oldindan, qolgani olishda'], ['onget', 'Всё при получении товара', 'Ҳама ҳангоми гирифтани мол', 'Hammasi tovarni olishda']] },
      { k: 'delivery', l: ['Срок передачи товара', 'Мӯҳлати супоридани мол', 'Tovarni topshirish muddati'], ex: ['Например: до 10.11.2026', 'Масалан: то 10.11.2026', 'Masalan: 10.11.2026 gacha'] },
      { k: 'warr', l: ['Гарантия (дней)', 'Кафолат (рӯз)', 'Kafolat (kun)'], ex: ['14', '14', '14'] },
      { k: 'city', l: ['Город', 'Шаҳр', 'Shahar'], ex: ['Душанбе', 'Душанбе', 'Dushanbe'] }
    ]
  };
  var LI = { ru: 0, tg: 1, uz: 2 };
  function dateStr() { var d = new Date(); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function optText(kind, k, v, lang) { var fs = DFIELDS[kind], i, j; for (i = 0; i < fs.length; i++) if (fs[i].k === k) for (j = 0; j < fs[i].o.length; j++) if (fs[i].o[j][0] === v) return fs[i].o[j][1 + LI[lang]]; return ''; }
  function fv(f, k) { var v = String(f[k] == null ? '' : f[k]).trim(); return v || '________'; }
  // Тексты договоров. В тексте {k} подставляется ответ, {ref}/{util}/{pay} — выбранный вариант.
  var DTXT = {
    services: {
      ru: { t: 'ДОГОВОР ОКАЗАНИЯ УСЛУГ', p: ['г. {city}, {date}', 'Исполнитель: {a}. Клиент: {b}. Вместе — «Стороны».',
        '1. Предмет. Исполнитель обязуется оказать Клиенту услугу: {svc}, а Клиент обязуется оплатить её.',
        '2. Стоимость и оплата. {price}. Оплата вносится до начала оплачиваемого периода.',
        '3. Порядок оказания. Время и формат встреч Стороны согласуют заранее. Перенос возможен, если Клиент предупредил не позднее чем за {notice} ч. до встречи; иначе встреча считается проведённой.',
        '4. Отказ. {ref}. Если услугу не удалось оказать по вине Исполнителя, он возвращает оплату за неоказанную часть.',
        '5. Конфиденциальность. Исполнитель не разглашает сведения о Клиенте, кроме случаев, предусмотренных законом.',
        '6. Ответственность. Исполнитель отвечает за качество услуги, но не гарантирует результата, который зависит от действий самого Клиента.',
        '7. Споры решаются переговорами, а при несогласии — в суде по законодательству Республики Таджикистан.',
        '8. Срок. Договор действует с даты подписания, срок: {term}. Составлен в двух экземплярах, по одному для каждой Стороны.',
        'Подписи: Исполнитель ______________ ({a}); Клиент ______________ ({b}).'] },
      tg: { t: 'ШАРТНОМАИ ХИЗМАТРАСОНӢ', p: ['ш. {city}, {date}', 'Иҷрокунанда: {a}. Муштарӣ: {b}. Дар маҷмӯъ — «Тарафҳо».',
        '1. Мавзӯи шартнома. Иҷрокунанда уҳдадор аст ба Муштарӣ хизмат нишон диҳад: {svc}, Муштарӣ бошад уҳдадор аст онро пардохт кунад.',
        '2. Арзиш ва пардохт. {price}. Пардохт пеш аз оғози давраи пулакӣ анҷом дода мешавад.',
        '3. Тартиби хизматрасонӣ. Вақт ва шакли вохӯриҳоро Тарафҳо пешакӣ мувофиқа мекунанд. Таъхири вохӯрӣ мумкин аст, агар Муштарӣ на дертар аз {notice} соат пеш хабар диҳад; дар акси ҳол вохӯрӣ гузаронидашуда ҳисоб мешавад.',
        '4. Даст кашидан. {ref}. Агар хизмат бо айби Иҷрокунанда нишон дода нашавад, ӯ пардохти қисми нишондодашударо бармегардонад.',
        '5. Махфият. Иҷрокунанда маълумоти Муштариро ошкор намекунад, ғайр аз ҳолатҳое, ки қонун пешбинӣ кардааст.',
        '6. Масъулият. Иҷрокунанда барои сифати хизмат ҷавобгар аст, вале натиҷаеро, ки аз амали худи Муштарӣ вобаста аст, кафолат намедиҳад.',
        '7. Баҳсҳо тавассути гуфтушунид ҳал карда мешаванд, дар сурати розӣ набудан — дар суд мутобиқи қонунгузории Ҷумҳурии Тоҷикистон.',
        '8. Мӯҳлат. Шартнома аз рӯзи имзо амал мекунад, мӯҳлат: {term}. Дар ду нусха тартиб дода шудааст, барои ҳар Тараф як нусха.',
        'Имзоҳо: Иҷрокунанда ______________ ({a}); Муштарӣ ______________ ({b}).'] },
      uz: { t: 'XIZMAT KOʻRSATISH SHARTNOMASI', p: ['{city} sh., {date}', 'Ijrochi: {a}. Mijoz: {b}. Birgalikda — «Tomonlar».',
        '1. Shartnoma predmeti. Ijrochi Mijozga xizmat koʻrsatishni zimmasiga oladi: {svc}, Mijoz esa uning uchun toʻlashni zimmasiga oladi.',
        '2. Narx va toʻlov. {price}. Toʻlov pullik davr boshlanishidan oldin amalga oshiriladi.',
        '3. Xizmat koʻrsatish tartibi. Uchrashuvlar vaqti va shaklini Tomonlar oldindan kelishadi. Mijoz uchrashuvdan kamida {notice} soat oldin ogohlantirsa, uni koʻchirish mumkin; aks holda uchrashuv oʻtkazilgan hisoblanadi.',
        '4. Rad etish. {ref}. Agar xizmat Ijrochining aybi bilan koʻrsatilmasa, u koʻrsatilmagan qism uchun toʻlovni qaytaradi.',
        '5. Maxfiylik. Ijrochi Mijoz haqidagi maʼlumotlarni, qonunda nazarda tutilgan hollardan tashqari, oshkor qilmaydi.',
        '6. Javobgarlik. Ijrochi xizmat sifati uchun javob beradi, lekin Mijozning oʻz harakatlariga bogʻliq natijani kafolatlamaydi.',
        '7. Nizolar muzokaralar yoʻli bilan, kelishilmasa — Tojikiston Respublikasi qonunchiligiga muvofiq sudda hal qilinadi.',
        '8. Muddat. Shartnoma imzolangan kundan kuchga kiradi, muddati: {term}. Ikki nusxada tuzilgan, har bir Tomon uchun bittadan.',
        'Imzolar: Ijrochi ______________ ({a}); Mijoz ______________ ({b}).'] }
    },
    rent: {
      ru: { t: 'ДОГОВОР АРЕНДЫ', p: ['г. {city}, {date}', 'Арендодатель: {a}. Арендатор: {b}.',
        '1. Предмет. Арендодатель передаёт Арендатору во временное пользование: {obj}, находящееся: {addr}. Передача оформляется актом.',
        '2. Плата. {price} сомони в месяц. Вносится не позднее {day} числа каждого месяца. Коммунальные услуги: {util}.',
        '3. Срок. Аренда начинается {start}, срок: {term}.',
        '4. Залог. Залог: {deposit} сомони. Он возвращается при возврате имущества в исправном состоянии, за вычетом сумм, которые Арендатор не оплатил или за ущерб.',
        '5. Обязанности Арендатора. Беречь имущество, использовать по назначению, не сдавать в субаренду без письменного согласия Арендодателя, возвратить по окончании срока в том состоянии, в котором принял, с учётом обычного износа.',
        '6. Расторжение. Любая Сторона вправе расторгнуть договор, предупредив другую письменно за {notice} дн.',
        '7. Споры решаются переговорами, а при несогласии — в суде по законодательству Республики Таджикистан.',
        '8. Договор составлен в двух экземплярах, по одному для каждой Стороны.',
        'Подписи: Арендодатель ______________ ({a}); Арендатор ______________ ({b}).'] },
      tg: { t: 'ШАРТНОМАИ ИҶОРА', p: ['ш. {city}, {date}', 'Иҷорадиҳанда: {a}. Иҷоранишин: {b}.',
        '1. Мавзӯи шартнома. Иҷорадиҳанда ба Иҷоранишин барои истифодаи муваққатӣ месупорад: {obj}, ки ҷойгир аст: {addr}. Супурдан бо санад расмӣ карда мешавад.',
        '2. Ҳаққи иҷора. {price} сомонӣ дар як моҳ. На дертар аз рӯзи {day}-уми ҳар моҳ пардохт мешавад. Хизматрасониҳои коммуналӣ: {util}.',
        '3. Мӯҳлат. Иҷора аз {start} оғоз мешавад, мӯҳлат: {term}.',
        '4. Гарав. Гарав: {deposit} сомонӣ. Он ҳангоми баргардонидани амвол дар ҳолати хуб баргардонида мешавад, бо тарҳи маблағҳое, ки Иҷоранишин напардохтааст ё барои зарар.',
        '5. Уҳдадориҳои Иҷоранишин. Амволро нигоҳубин кунад, мувофиқи таъинот истифода барад, бе розигии хаттии Иҷорадиҳанда ба иҷораи дуюм надиҳад, дар охири мӯҳлат ба ҳамон ҳолате, ки қабул кардааст, бо назардошти фарсудашавии оддӣ баргардонад.',
        '6. Бекор кардан. Ҳар Тараф метавонад шартномаро бекор кунад, ба Тарафи дигар хаттӣ {notice} рӯз пеш хабар диҳад.',
        '7. Баҳсҳо тавассути гуфтушунид ҳал карда мешаванд, дар сурати розӣ набудан — дар суд мутобиқи қонунгузории Ҷумҳурии Тоҷикистон.',
        '8. Шартнома дар ду нусха тартиб дода шудааст, барои ҳар Тараф як нусха.',
        'Имзоҳо: Иҷорадиҳанда ______________ ({a}); Иҷоранишин ______________ ({b}).'] },
      uz: { t: 'IJARA SHARTNOMASI', p: ['{city} sh., {date}', 'Ijaraga beruvchi: {a}. Ijarachi: {b}.',
        '1. Shartnoma predmeti. Ijaraga beruvchi Ijarachiga vaqtincha foydalanish uchun topshiradi: {obj}, joylashgan manzil: {addr}. Topshirish dalolatnoma bilan rasmiylashtiriladi.',
        '2. Ijara haqi. Oyiga {price} somoni. Har oyning {day}-sanasidan kechiktirmay toʻlanadi. Kommunal xizmatlar: {util}.',
        '3. Muddat. Ijara {start} dan boshlanadi, muddati: {term}.',
        '4. Garov. Garov: {deposit} somoni. U mulk soz holatda qaytarilganda, Ijarachi toʻlamagan summalar yoki zarar chegirib tashlangan holda qaytariladi.',
        '5. Ijarachining majburiyatlari. Mulkni asrash, maqsadiga muvofiq foydalanish, Ijaraga beruvchining yozma roziligisiz subijaraga bermaslik, muddat tugaganda oddiy eskirishni hisobga olgan holda qabul qilgan holatda qaytarish.',
        '6. Bekor qilish. Har bir Tomon shartnomani bekor qilishi mumkin, buning uchun boshqa Tomonni yozma ravishda {notice} kun oldin ogohlantiradi.',
        '7. Nizolar muzokaralar yoʻli bilan, kelishilmasa — Tojikiston Respublikasi qonunchiligiga muvofiq sudda hal qilinadi.',
        '8. Shartnoma ikki nusxada tuzilgan, har bir Tomon uchun bittadan.',
        'Imzolar: Ijaraga beruvchi ______________ ({a}); Ijarachi ______________ ({b}).'] }
    },
    sale: {
      ru: { t: 'ДОГОВОР КУПЛИ-ПРОДАЖИ', p: ['г. {city}, {date}', 'Продавец: {a}. Покупатель: {b}.',
        '1. Предмет. Продавец передаёт Покупателю в собственность товар: {item}, а Покупатель принимает его и оплачивает.',
        '2. Цена и оплата. Общая цена: {price} сомони. Оплата: {pay}.',
        '3. Передача. Срок передачи: {delivery}. Покупатель проверяет товар при получении; видимые недостатки нужно заявить сразу.',
        '4. Качество и гарантия. Товар должен соответствовать описанию. Гарантия: {warr} дн. со дня получения. Если в этот срок обнаружен недостаток, не возникший по вине Покупателя, Продавец заменяет или ремонтирует товар либо возвращает деньги.',
        '5. Право собственности переходит к Покупателю с момента передачи товара и полной оплаты.',
        '6. Споры решаются переговорами, а при несогласии — в суде по законодательству Республики Таджикистан.',
        '7. Договор составлен в двух экземплярах, по одному для каждой Стороны.',
        'Подписи: Продавец ______________ ({a}); Покупатель ______________ ({b}).'] },
      tg: { t: 'ШАРТНОМАИ ХАРИДУ ФУРӮШ', p: ['ш. {city}, {date}', 'Фурӯшанда: {a}. Харидор: {b}.',
        '1. Мавзӯи шартнома. Фурӯшанда ба Харидор мол месупорад: {item}, Харидор онро қабул мекунад ва пардохт менамояд.',
        '2. Нарх ва пардохт. Нархи умумӣ: {price} сомонӣ. Пардохт: {pay}.',
        '3. Супурдан. Мӯҳлати супурдан: {delivery}. Харидор молро ҳангоми гирифтан месанҷад; камбудиҳои намоёнро дарҳол эълон кардан лозим аст.',
        '4. Сифат ва кафолат. Мол бояд ба тавсиф мувофиқ бошад. Кафолат: {warr} рӯз аз рӯзи гирифтан. Агар дар ин мӯҳлат камбудие пайдо шавад, ки бо айби Харидор набошад, Фурӯшанда молро иваз мекунад, таъмир мекунад ё пулро бармегардонад.',
        '5. Ҳуқуқи моликият ба Харидор аз лаҳзаи супурдани мол ва пардохти пурра мегузарад.',
        '6. Баҳсҳо тавассути гуфтушунид ҳал карда мешаванд, дар сурати розӣ набудан — дар суд мутобиқи қонунгузории Ҷумҳурии Тоҷикистон.',
        '7. Шартнома дар ду нусха тартиб дода шудааст, барои ҳар Тараф як нусха.',
        'Имзоҳо: Фурӯшанда ______________ ({a}); Харидор ______________ ({b}).'] },
      uz: { t: 'OLDI-SOTDI SHARTNOMASI', p: ['{city} sh., {date}', 'Sotuvchi: {a}. Xaridor: {b}.',
        '1. Shartnoma predmeti. Sotuvchi Xaridorga mulk qilib tovarni topshiradi: {item}, Xaridor uni qabul qiladi va toʻlaydi.',
        '2. Narx va toʻlov. Umumiy narx: {price} somoni. Toʻlov: {pay}.',
        '3. Topshirish. Topshirish muddati: {delivery}. Xaridor tovarni olishda tekshiradi; koʻrinib turgan kamchiliklar darhol aytilishi kerak.',
        '4. Sifat va kafolat. Tovar tavsifga mos boʻlishi kerak. Kafolat: olingan kundan {warr} kun. Shu muddatda Xaridorning aybisiz kamchilik topilsa, Sotuvchi tovarni almashtiradi, taʼmirlaydi yoki pulni qaytaradi.',
        '5. Mulk huquqi tovar topshirilgan va toʻliq toʻlangan paytdan Xaridorga oʻtadi.',
        '6. Nizolar muzokaralar yoʻli bilan, kelishilmasa — Tojikiston Respublikasi qonunchiligiga muvofiq sudda hal qilinadi.',
        '7. Shartnoma ikki nusxada tuzilgan, har bir Tomon uchun bittadan.',
        'Imzolar: Sotuvchi ______________ ({a}); Xaridor ______________ ({b}).'] }
    }
  };
  var DNOTE = ['Образец. Перед подписанием покажите договор живому юристу в Таджикистане: я помогаю составить текст, но не заменяю юриста.', 'Намуна. Пеш аз имзо шартномаро ба ҳуқуқшиноси зинда дар Тоҷикистон нишон диҳед: ман дар навиштани матн кумак мекунам, вале ҷойи ҳуқуқшиносро намегирам.', 'Namuna. Imzolashdan oldin shartnomani Tojikistondagi tirik yuristga koʻrsating: men matn tuzishga yordam beraman, lekin yuristning oʻrnini bosmayman.'];
  function buildDoc(kind, lang, f) {
    var tpl = DTXT[kind][lang], ff = {}, k;
    for (k in f) ff[k] = f[k];
    ff.date = ff.date || dateStr();
    var sel = { ref: 1, util: 1, pay: 1 };
    return tpl.t + '\n\n' + tpl.p.map(function (line) {
      return line.replace(/\{(\w+)\}/g, function (_, key) {
        if (sel[key]) { var v = optText(kind, key, ff[key] || DFIELDS[kind].filter(function (x) { return x.k === key; })[0].o[0][0], lang); return v || '________'; }
        return fv(ff, key);
      });
    }).join('\n\n');
  }
  function lwLang() { return LW.lang || ((typeof window !== 'undefined' && window.LANG) || 'ru'); }
  function openLaw() { LW.view = 'menu'; LW.kind = ''; LW.res = ''; LW.err = ''; LW.copied = false; S.view = 'law'; render(); lawStatus(); }
  function renderLaw(el) {
    var h = backBtn() + '<h2 style="padding-right:36px">⚖️ ' + esc(TX('Юрист')) + '</h2>';
    var lang = lwLang();
    if (LW.view === 'menu') {
      h += '<p>' + esc(ui('Составлю договор за пару минут: ответьте на несколько вопросов, и текст будет готов на русском, таджикском или узбекском.', 'Шартномаро дар чанд дақиқа тартиб медиҳам: ба чанд савол ҷавоб диҳед, матн бо забони русӣ, тоҷикӣ ё узбекӣ тайёр мешавад.', 'Shartnomani bir necha daqiqada tuzaman: bir nechta savolga javob bering, matn rus, tojik yoki oʻzbek tilida tayyor boʻladi.')) + '</p><div style="display:grid;gap:10px">';
      ['services', 'rent', 'sale'].forEach(function (k) {
        var d = DKIND[k], i = LI[window.LANG || 'ru'] || 0;
        h += '<button type="button" class="btn sec" data-law="kind:' + k + '" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:12px"><span style="font-size:26px;flex:none" aria-hidden="true">' + d.ico + '</span><span style="flex:1;min-width:0"><b style="display:block">' + esc([d.ru, d.tg, d.uz][i]) + '</b><small style="opacity:.75">' + esc(d.sub[i]) + '</small></span></button>';
      });
      h += '<button type="button" class="btn sec" data-law="ask" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:12px"><span style="font-size:26px;flex:none" aria-hidden="true">❓</span><span style="flex:1;min-width:0"><b style="display:block">' + esc(ui('Задать вопрос юристу', 'Ба ҳуқуқшинос савол додан', 'Yuristga savol berish')) + '</b><small style="opacity:.75">' + esc(ui('Повседневные дела бизнеса: возврат денег, условия, порядок действий', 'Корҳои ҳаррӯзаи тиҷорат: баргардонидани пул, шартҳо, тартиби амал', 'Biznesning kundalik ishlari: pulni qaytarish, shartlar, harakat tartibi')) + '</small></span></button>' +
        '<button type="button" class="btn sec" data-law="explain" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:12px"><span style="font-size:26px;flex:none" aria-hidden="true">📄</span><span style="flex:1;min-width:0"><b style="display:block">' + esc(ui('Объяснить договор', 'Шартномаро фаҳмондан', 'Shartnomani tushuntirish')) + '</b><small style="opacity:.75">' + esc(ui('Вставьте текст договора: объясню простыми словами и покажу риски', 'Матни шартномаро гузоред: бо забони оддӣ шарҳ медиҳам ва хатарҳоро нишон медиҳам', 'Shartnoma matnini qoʻying: oddiy tilda tushuntiraman va xavflarni koʻrsataman')) + '</small></span></button>';
      h += '</div><p style="margin-top:12px"><small>' + esc(ui(DNOTE[0], DNOTE[1], DNOTE[2])) + '</small></p>';
      h += (LW.left != null ? '<p><small>' + esc(ui('Вопросов сегодня осталось', 'Имрӯз саволҳо монд', 'Bugun savollar qoldi')) + ': <b>' + esc(LW.left) + '</b></small></p>' : '');
      h += kbCard('lawyer');
      el.innerHTML = h; return;
    }
    if (LW.view === 'ask' || LW.view === 'explain') {
      var ex = LW.view === 'explain';
      h += '<p style="margin:4px 0"><b>' + esc(ex ? ui('Объяснить договор', 'Шартномаро фаҳмондан', 'Shartnomani tushuntirish') : ui('Вопрос юристу', 'Савол ба ҳуқуқшинос', 'Yuristga savol')) + '</b></p>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><small style="align-self:center">' + esc(ui('Язык ответа', 'Забони ҷавоб', 'Javob tili')) + ':</small>' +
        [['ru', 'Русский'], ['tg', 'Тоҷикӣ'], ['uz', 'Oʻzbekcha']].map(function (x) { return '<button type="button" class="btn ' + (lang === x[0] ? '' : 'sec') + '" data-law="lang:' + x[0] + '" style="padding:6px 12px;height:auto">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<textarea class="in2" id="law-text" rows="' + (ex ? 8 : 4) + '" maxlength="' + (ex ? 6000 : 1200) + '" placeholder="' + esc(ex ? ui('Вставьте сюда текст договора или нужный пункт', 'Матни шартнома ё бандро дар ин ҷо гузоред', 'Shartnoma matni yoki kerakli bandni shu yerga qoʻying') : ui('Опишите ситуацию своими словами', 'Вазъиятро бо суханони худ тавсиф кунед', 'Vaziyatni oʻz soʻzlaringiz bilan yozing')) + '">' + esc(LW.text) + '</textarea>' +
        '<div style="margin-top:8px"><button class="btn" data-law="run" type="button"' + (LW.busy ? ' disabled' : '') + '>' + esc(ui('Получить ответ', 'Ҷавоб гирифтан', 'Javob olish')) + '</button> <button class="btn sec" data-law="menu" type="button">' + esc(ui('Назад', 'Бозгашт', 'Orqaga')) + '</button></div>' +
        (LW.busy ? '<p>⏳ ' + esc(ui('Готовлю ответ, это до минуты…', 'Ҷавобро омода мекунам, то як дақиқа…', 'Javob tayyorlanmoqda, bir daqiqagacha…')) + '</p>' : '') +
        (LW.err ? '<p class="err">' + esc(LW.err) + '</p>' : '') +
        (LW.left != null ? '<p><small>' + esc(ui('Вопросов сегодня осталось', 'Имрӯз саволҳо монд', 'Bugun savollar qoldi')) + ': <b>' + esc(LW.left) + '</b></small></p>' : '');
      if (LW.res) h += '<div style="white-space:pre-wrap;word-break:break-word;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;margin:8px 0;font-size:14px;line-height:1.5" id="law-ans">' + esc(LW.res) + '</div>' +
        '<button class="btn sec" data-law="copy" type="button">' + esc(LW.copied ? ui('Скопировано ✓', 'Нусха шуд ✓', 'Nusxalandi ✓') : ui('Скопировать', 'Нусха гирифтан', 'Nusxalash')) + '</button> ' +
        kbBtn('lawyer', { q: (ex ? 'Разбор договора: ' : 'Вопрос: ') + String(LW.q).slice(0, 220), a: LW.res }) +
        '<p><small>' + esc(DNOTE[LI[lang]]) + '</small></p>';
      else KB.last.lawyer = null;
      h += kbCard('lawyer');
      el.innerHTML = h; return;
    }
    var d = DKIND[LW.kind], i2 = LI[window.LANG || 'ru'] || 0;
    h += '<p style="margin:4px 0"><b>' + esc([d.ru, d.tg, d.uz][i2]) + '</b></p>';
    if (LW.view === 'form') {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><small style="align-self:center">' + esc(ui('Язык договора', 'Забони шартнома', 'Shartnoma tili')) + ':</small>' +
        [['ru', 'Русский'], ['tg', 'Тоҷикӣ'], ['uz', 'Oʻzbekcha']].map(function (x) { return '<button type="button" class="btn ' + (lang === x[0] ? '' : 'sec') + '" data-law="lang:' + x[0] + '" style="padding:6px 12px;height:auto">' + x[1] + '</button>'; }).join('') + '</div>';
      h += '<div style="display:grid;gap:8px">';
      DFIELDS[LW.kind].forEach(function (fl) {
        var lab = esc(fl.l[i2]), val = LW.f[fl.k] == null ? '' : LW.f[fl.k];
        h += '<label style="display:grid;gap:4px"><small>' + lab + '</small>';
        if (fl.t === 'sel') {
          h += '<select class="in2" data-law-f="' + fl.k + '">' + fl.o.map(function (o, oi) { var cur = val || fl.o[0][0]; return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + esc(o[1 + i2]) + '</option>'; }).join('') + '</select>';
        } else h += '<input class="in2" data-law-f="' + fl.k + '" maxlength="200" value="' + esc(val) + '" placeholder="' + esc((fl.ex && fl.ex[i2]) || '') + '">';
        h += '</label>';
      });
      h += '</div><button class="btn" data-law="make" type="button" style="margin-top:10px">' + esc(ui('Составить договор', 'Шартномаро тартиб додан', 'Shartnomani tuzish')) + '</button>' +
        ' <button class="btn sec" data-law="menu" type="button" style="margin-top:10px">' + esc(ui('Назад', 'Бозгашт', 'Orqaga')) + '</button>';
      el.innerHTML = h; return;
    }
    h += '<div style="white-space:pre-wrap;word-break:break-word;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;margin:8px 0;font-size:14px;line-height:1.5" id="law-res">' + esc(LW.res) + '</div>' +
      '<button class="btn" data-law="copy" type="button">' + esc(LW.copied ? ui('Скопировано ✓', 'Нусха шуд ✓', 'Nusxalandi ✓') : ui('Скопировать', 'Нусха гирифтан', 'Nusxalash')) + '</button> ' +
      '<button class="btn sec" data-law="edit" type="button">' + esc(ui('Изменить ответы', 'Ҷавобҳоро тағйир додан', 'Javoblarni oʻzgartirish')) + '</button> ' +
      '<button class="btn sec" data-law="menu" type="button">' + esc(ui('Другой договор', 'Шартномаи дигар', 'Boshqa shartnoma')) + '</button>' +
      kbBtn('lawyer', { q: ('Договор: ' + [d.ru][0] + ', ' + fv(LW.f, 'a') + ' и ' + fv(LW.f, 'b')).slice(0, 300), a: LW.res }) +
      '<p><small>' + esc(DNOTE[LI[lang]]) + '</small></p>';
    h += kbCard('lawyer');
    el.innerHTML = h;
  }
  function lawStatus() { callTo('/yurist', { action: 'status' }).then(function (r) { if (r.ok) { LW.left = r.left; if (S.view === 'law') render(); } }); }
  function lawRun() {
    if (LW.busy) return;
    var ex = LW.view === 'explain', t = String(LW.text || '').trim();
    if (t.length < (ex ? 40 : 8)) { LW.err = ex ? ui('Вставьте текст договора или нужного пункта', 'Матни шартнома ё бандро гузоред', 'Shartnoma matnini yoki bandni qoʻying') : ui('Напишите вопрос подробнее', 'Саволро муфассалтар нависед', 'Savolni batafsilroq yozing'); LW.res = ''; return render(); }
    LW.busy = true; LW.err = ''; LW.res = ''; LW.copied = false; KB.lawyer.saved = false; LW.q = t; render();
    callTo('/yurist', { action: ex ? 'explain' : 'ask', text: t, lang: lwLang() }).then(function (r) {
      LW.busy = false;
      if (r.ok) { LW.res = r.text || ''; LW.left = r.left; } else LW.err = r.error || TX('Не получилось');
      if (S.view === 'law') render();
    });
  }
  function lawClick(a) {
    if (a === 'menu') { LW.view = 'menu'; LW.res = ''; LW.err = ''; return render(); }
    if (a === 'ask' || a === 'explain') { LW.view = a; LW.res = ''; LW.err = ''; LW.text = ''; LW.lang = ''; KB.lawyer.saved = false; lawStatus(); return render(); }
    if (a === 'run') return lawRun();
    if (a.indexOf('kind:') === 0) { LW.kind = a.slice(5); LW.f = { city: ui('Душанбе', 'Душанбе', 'Dushanbe') }; LW.lang = ''; LW.view = 'form'; return render(); }
    if (a.indexOf('lang:') === 0) { LW.lang = a.slice(5); return render(); }
    if (a === 'make') { LW.res = buildDoc(LW.kind, lwLang(), LW.f); LW.view = 'doc'; LW.copied = false; KB.lawyer.saved = false; return render(); }
    if (a === 'edit') { LW.view = 'form'; return render(); }
    if (a === 'copy') return copyText(LW.res, function () { LW.copied = true; if (S.view === 'law') render(); });
  }

  /* ---------- Маркетолог ---------- */
var MK = { st: null, busy: false, msgs: [], draft: '', err: '', copied: false };
var MKT = {
plan: ['📅', 'План на неделю', 'Составь контент-план на неделю'],
funnel: ['🔻', 'Где теряются клиенты', 'Разбери мою воронку: где теряются люди и что исправить'],
stats: ['📊', 'Мои цифры', 'Объясни мои цифры простыми словами'],
winback: ['💌', 'Вернуть замолчавших', 'Напиши тексты, чтобы вернуть тех, кто замолчал'],
offer: ['🏷️', 'Оффер и тексты услуг', 'Помоги с оффером, текстами услуг и ответами на «дорого» и «подумаю»'],
report: ['📝', 'Отчёт за неделю', 'Сделай отчёт за неделю: что сработало, что нет и что делать дальше']
};
var MKCH = { instagram: 'Instagram', whatsapp: 'WhatsApp', telegram: 'Telegram', messenger: 'Messenger' };
function mkKey() { return 'ew_mkt_' + hsh(code().code || ''); }
function mkLoad() { try { var v = JSON.parse(lstore(mkKey()) || 'null'); if (Array.isArray(v)) return v.filter(function (m) { return m && (m.r === 'u' || m.r === 'a') && typeof m.t === 'string'; }).slice(-30); } catch (e) {} return []; }
function mkSave() { try { lstore(mkKey(), JSON.stringify(MK.msgs.slice(-30))); } catch (e) {} }
function openMkt() {
S.view = 'mkt'; MK.st = null; MK.err = ''; MK.busy = false; MK.copied = false; MK.draft = ''; MK.msgs = mkLoad(); render();
callTo('/marketolog', { action: 'status' }).then(function (r) {
MK.st = r.ok ? r : { error: r.error || TX('не удалось загрузить') };
if (S.view === 'mkt') render();
});
}
function bubble(m) {
var u = m.r === 'u';
return '<div style="white-space:pre-wrap;word-break:break-word;border-radius:14px;padding:10px 12px;max-width:92%;font-size:14px;line-height:1.45;justify-self:' + (u ? 'end;background:#fdebc8' : 'start;border:1px solid var(--line,#ddd)') + '">' + esc(m.t) + '</div>';
}
function renderMkt(el) {
var h = backBtn() + '<h2 style="padding-right:36px">🎯 ' + esc(TX('Маркетолог')) + '</h2>';
if (!MK.st) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
if (MK.st.error) { el.innerHTML = h + '<p class="err">' + esc(MK.st.error) + '</p><button class="btn" data-mkt="reload" type="button">' + esc(TX('Ещё раз')) + '</button>'; return; }
var chs = (MK.st.channels || []).map(function (c) { return MKCH[c] || c; }), dis = MK.busy ? ' disabled' : '';
h += '<p style="margin:4px 0">' + (chs.length ? '✅ ' + esc(TX('Считаю обращения по каналам')) + ': ' + esc(chs.join(', ')) : '⚠️ ' + esc(TX('Каналы не подключены. Подключите их в меню, тогда я смогу считать обращения.'))) + '</p>' +
'<p style="margin:4px 0 10px"><small>' + esc(TX('Запросов сегодня осталось')) + ': <b>' + esc(MK.st.left) + '</b> ' + esc(TX('из')) + ' ' + esc(MK.st.limit || 20) + '</small></p>';
h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + Object.keys(MKT).map(function (k) {
return '<button type="button" class="btn sec" data-mkt="task:' + k + '" style="height:auto;min-height:34px;padding:6px 10px;font-size:13px"' + dis + '>' + MKT[k][0] + ' ' + esc(TX(MKT[k][1])) + '</button>';
}).join('') + '</div>';
var list = MK.msgs.length ? MK.msgs : [{ r: 'a', t: TX('Здравствуйте! Я маркетолог. Могу составить план публикаций, показать, где теряются клиенты, объяснить ваши цифры, написать тексты для тех, кто замолчал, и подготовить оффер. Нажмите кнопку или напишите свой вопрос.') }];
h += '<div id="mk-chat" style="display:grid;gap:8px;max-height:46dvh;overflow:auto;padding:4px 2px;margin-bottom:8px">' + list.map(bubble).join('') + (MK.busy ? '<div style="justify-self:start;opacity:.75">⏳ ' + esc(TX('Печатаю, это до минуты…')) + '</div>' : '') + '</div>';
if (MK.err) h += '<p class="err">' + esc(MK.err) + '</p>';
h += '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end"><textarea class="in2" id="mk-in" rows="2" maxlength="1500" placeholder="' + esc(TX('Напишите маркетологу…')) + '">' + esc(MK.draft) + '</textarea><button class="btn" data-mkt="send" type="button"' + dis + '>' + esc(TX('Отправить')) + '</button></div>';
h += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">' + (MK.msgs.length ? '<button class="btn sec" data-mkt="copy" type="button" style="height:32px;padding:0 10px;font-size:13px">' + esc(TX(MK.copied ? 'Скопировано ✓' : 'Скопировать последний ответ')) + '</button><button class="btn sec" data-mkt="clear" type="button" style="height:32px;padding:0 10px;font-size:13px">' + esc(TX('Очистить чат')) + '</button>' : '') + '</div>';
var mkQ = '', mkA = ''; for (var mi = MK.msgs.length - 1; mi >= 0; mi--) { if (!mkA && MK.msgs[mi].r === 'a') mkA = MK.msgs[mi].t; else if (mkA && MK.msgs[mi].r === 'u') { mkQ = MK.msgs[mi].t; break; } }
h += (mkQ && mkA && !MK.busy ? '<div style="margin:8px 0">' + kbBtn('mkt', { q: mkQ.slice(0, 300), a: mkA.slice(0, 3000) }) + '</div>' : (KB.last.mkt = null, '')) + kbCard('mkt');
h += '<p><small>' + esc(TX('Я ничего не публикую и никому не пишу сам. Переписок ваших клиентов я не вижу: только цифры.')) + '</small></p>';
el.innerHTML = h;
var c = $s('mk-chat'); if (c) c.scrollTop = c.scrollHeight;
}
function sendMkt(text, task) {
text = String(text || '').trim();
if (MK.busy) return;
if (text.length < 2) { MK.err = TX('Напишите вопрос маркетологу'); return render(); }
var hist = MK.msgs.slice(-8).map(function (m) { return { r: m.r, t: m.t }; });
KB.mkt.saved = false; MK.msgs.push({ r: 'u', t: text }); MK.draft = ''; MK.busy = true; MK.err = ''; MK.copied = false; mkSave(); render();
callTo('/marketolog', { action: 'chat', text: text, task: task || '', history: hist }).then(function (r) {
MK.busy = false;
if (r.ok) { MK.msgs.push({ r: 'a', t: r.text || '' }); if (MK.st && !MK.st.error) MK.st.left = r.left; mkSave(); }
else MK.err = r.error || TX('Не получилось');
if (S.view === 'mkt') render();
});
}
function mktClick(a) {
if (a === 'reload') return openMkt();
if (a === 'send') { var f = $s('mk-in'); return sendMkt(f ? f.value : MK.draft, ''); }
if (a.indexOf('task:') === 0) { var k = a.slice(5); if (MKT[k]) return sendMkt(MKT[k][2], k); return; }
if (a === 'copy') { var t = ''; MK.msgs.forEach(function (m) { if (m.r === 'a') t = m.t; }); try { navigator.clipboard.writeText(t); MK.copied = true; render(); } catch (e) {} return; }
if (a === 'clear') { MK.msgs = []; MK.copied = false; mkSave(); render(); return; }
}

/* ---------- Бухгалтер ---------- */
  /* Быстрое открытие: последние записи месяца хранятся в телефоне (ключ зависит от кабинета), свежие подтягиваются в фоне. */
  function hsh(x) { var h = 5381; x = String(x); for (var i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function ckey(m) { return 'ew_buh_' + hsh(code().code || '') + '_' + m; }
  function readCache(m) { try { var v = JSON.parse(lstore(ckey(m)) || 'null'); if (v && Array.isArray(v.ops) && Array.isArray(v.stock)) return { ops: v.ops, stock: v.stock, cached: true }; } catch (e) {} return null; }
  function writeCache() { try { if (S.buh && !S.buh.error) lstore(ckey(S.month), JSON.stringify({ ops: S.buh.ops, stock: S.buh.stock })); } catch (e) {} }
  function openBuh() { S.view = 'buh'; S.form = null; S.edit = null; S.pre = null; S.sell = null; S.gform = false; S.delAsk = null; S.month = S.month || today().slice(0, 7); S.prof = readProf(); S.onb = S.prof ? null : { kind: '', stock: '', staff: '', other: '' }; S.buh = readCache(S.month); if (S.onb) syncProf(); else load(); render(); }
  /* ---------- Первый вход: «Наймите себе бухгалтера» ---------- */
function pkey() { return 'ew_buhprof_' + hsh(code().code || ''); }
function readProf() { try { var v = JSON.parse(lstore(pkey()) || 'null'); if (v && v.kind && v.stock && v.staff) return v; } catch (e) {} return null; }
function chipsFor(type) { var l = CHIPS[type]; if (type === 'out' && S.prof && S.prof.staff === '1') l = l.filter(function (c) { return c !== 'Зарплата'; }); return l; }
var KINDS = [
{ id: 'health', name: 'Здоровье и психология', sub: 'психолог, врач, стоматолог', ico: '🩺', bg: '#E1F5EE', fg: '#085041' },
{ id: 'legal', name: 'Юристы и консультанты', sub: 'юрист, переводчик, консультант', ico: '⚖️', bg: '#EEEDFE', fg: '#3C3489' },
{ id: 'beauty', name: 'Красота', sub: 'салон, барбер, массаж', ico: '💇', bg: '#FBEAF0', fg: '#72243E' },
{ id: 'trade', name: 'Торговля', sub: 'магазин, ларёк, онлайн', ico: '🛍️', bg: '#FAEEDA', fg: '#633806' },
{ id: 'food', name: 'Общепит', sub: 'кафе, доставка еды, выпечка', ico: '🍽️', bg: '#FAECE7', fg: '#712B13' },
{ id: 'repair', name: 'Ремонт и стройка', sub: 'бригады, отделка', ico: '🔧', bg: '#E6F1FB', fg: '#0C447C' },
{ id: 'make', name: 'Производство', sub: 'мебель, одежда, еда', ico: '🏭', bg: '#F1EFE8', fg: '#444441' },
{ id: 'transport', name: 'Транспорт и доставка', sub: 'перевозки, курьеры', ico: '🚚', bg: '#E1F5EE', fg: '#085041' },
{ id: 'rent', name: 'Аренда и прокат', sub: 'инструменты, техника', ico: '🛠️', bg: '#EAF3DE', fg: '#27500A' },
{ id: 'edu', name: 'Образование', sub: 'репетитор, курсы, школа', ico: '🎓', bg: '#FCEBEB', fg: '#791F1F' },
{ id: 'it', name: 'IT и digital', sub: 'разработка, дизайн, SMM, монтаж', ico: '💻', bg: '#EEEDFE', fg: '#3C3489' },
{ id: 'other', name: 'Другое', sub: 'напишите сами', ico: '✨', bg: '#F1EFE8', fg: '#444441' }
];
var STAFF = [['1', 'Только я'], ['2-5', '2–5'], ['6-20', '6–20'], ['20+', 'Больше 20']];
function syncProf() {
call({ action: 'profile-get' }).then(function (r) {
if (r && r.ok && r.profile && r.profile.kind && r.profile.stock && r.profile.staff && S.onb && !S.onb.kind && S.view === 'buh') {
S.prof = r.profile; try { lstore(pkey(), JSON.stringify(r.profile)); } catch (e) {}
S.onb = null; load(); render();
}
});
}
  function shBtnsHtml() { return ''; }
function renderOnb(el) {
var o = S.onb, h = backBtn() + '<h2 style="padding-right:36px">📒 ' + esc(TX('Наймите себе бухгалтера')) + '</h2>' + shBtnsHtml();
if (!o.kind) {
h += '<p style="margin:2px 0 10px;opacity:.8">' + esc(TX('Чем вы занимаетесь? Нажмите на свою карточку. Нужно один раз.')) + '</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">' + KINDS.map(function (k) {
return '<button type="button" data-onb="kind:' + k.id + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:14px 8px;border:0;border-radius:16px;background:' + k.bg + ';color:' + k.fg + ';font:inherit;cursor:pointer"><span aria-hidden="true" style="width:56px;height:56px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:28px">' + k.ico + '</span><b style="font-size:15px">' + esc(TX(k.name)) + '</b><small style="opacity:.85;font-size:12px">' + esc(TX(k.sub)) + '</small></button>';
}).join('') + '</div>';
el.innerHTML = h; return;
}
var k = KINDS.filter(function (x) { return x.id === o.kind; })[0] || KINDS[KINDS.length - 1];
function opt(key, val, label, on) { return '<button type="button" class="btn' + (on ? '' : ' sec') + '" data-onb="' + key + ':' + val + '" style="height:38px;padding:0 14px">' + esc(TX(label)) + '</button>'; }
h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:' + k.bg + ';color:' + k.fg + ';margin:8px 0"><span aria-hidden="true" style="font-size:24px">' + k.ico + '</span><b style="flex:1">' + esc(TX(k.name)) + '</b><button type="button" class="btn sec" data-onb="back" style="height:30px;padding:0 10px">' + esc(TX('Изменить')) + '</button></div>';
if (k.id === 'other') h += '<input class="in2" id="ob-other" maxlength="80" placeholder="' + esc(TX('Напишите, чем вы занимаетесь')) + '" value="' + esc(o.other || '') + '" style="margin:4px 0 8px">';
h += '<b>' + esc(TX('Есть ли у вас товар или склад?')) + '</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px">' + opt('stock', 'yes', 'Да', o.stock === 'yes') + opt('stock', 'no', 'Нет', o.stock === 'no') + '</div>';
h += '<b>' + esc(TX('Сколько у вас сотрудников?')) + '</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px">' + STAFF.map(function (s) { return opt('staff', s[0], s[1], o.staff === s[0]); }).join('') + '</div>';
if (o.stock && o.staff) {
var tags = ['Приход и расход', 'Остаток денег', 'Прибыль', 'Наличные и переводы отдельно'];
if (o.stock === 'yes') tags.push('Склад');
if (o.staff !== '1') tags.push('Зарплаты');
h += '<p style="margin:10px 0 6px"><b>' + esc(TX('Что откроет ваш бухгалтер')) + '</b></p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + tags.map(function (t) { return '<span style="padding:5px 10px;border-radius:12px;background:#e3f6ea;color:#1f8a4c;font-size:13px">' + esc(TX(t)) + '</span>'; }).join('') + '</div>' +
'<button type="button" class="btn" data-onb="hire" style="width:100%;height:46px">' + esc(TX('Нанять бухгалтера')) + '</button>';
}
el.innerHTML = h;
}
function onbClick(b) {
var v = b.dataset.onb, o = S.onb, f = $s('ob-other');
if (v === 'change') { var p = S.prof || {}; S.onb = { kind: p.kind || '', stock: p.stock || '', staff: p.staff || '', other: p.other || '' }; return render(); }
if (!o) return;
if (f) o.other = f.value;
if (v === 'back') { o.kind = ''; return render(); }
if (v === 'hire') {
if (!o.kind || !o.stock || !o.staff) return;
var P = { kind: o.kind, other: String(o.other || '').trim().slice(0, 80), stock: o.stock, staff: o.staff, ts: Date.now() };
try { lstore(pkey(), JSON.stringify(P)); } catch (e) {}
S.prof = P; S.onb = null; callTo('/buhgalter', { action: 'profile', profile: P }); load(); return render();
}
var i = v.indexOf(':'), key = v.slice(0, i), val = v.slice(i + 1);
if (key === 'kind') o.kind = val; else if (key === 'stock') o.stock = val; else if (key === 'staff') o.staff = val;
render();
}
function load() {
    var my = S.req = (S.req || 0) + 1; S.busy = true;
    call({ action: 'list', month: S.month }).then(function (r) {
      if (my !== S.req) return;
      S.busy = false;
      if (!r.ok) { if (S.buh && S.buh.cached) S.buh.offline = true; else S.buh = { error: r.error || TX('не удалось загрузить') }; }
      else { S.buh = { ops: r.ops || [], stock: r.stock || [] }; writeCache(); }
      if (S.view === 'buh') render();
    });
    if (shopOn() && owner()) {
      var mo = S.month;
      callTo('/magazin', { action: 'list', month: mo }).then(function (r) {
        if (mo !== S.month) return;
        var ops = [], days = (r && r.ok && r.report && r.report.days) || {};
        Object.keys(days).forEach(function (d) {
          var x = days[d] || {};
          if (cents(x.cashIn) > 0) ops.push({ id: 'shop-in-' + d, type: 'in', amount: x.cashIn, date: d, note: 'Магазин: продажи и оплаты долгов', ts: 0, virt: true });
          if (cents(x.purchase) > 0) ops.push({ id: 'shop-out-' + d, type: 'out', amount: x.purchase, date: d, note: 'Магазин: закупка товара', ts: 0, virt: true });
        });
        Object.keys(days).forEach(function (d) {
          var x = days[d] || {};
          if (cents(x.salary) > 0) ops.push({ id: 'shop-sal-' + d, type: 'out', amount: x.salary, date: d, note: 'Магазин: зарплата продавцам', ts: 0, virt: true });
          if (cents(x.pers) > 0) ops.push({ id: 'shop-pers-' + d, type: 'out', amount: x.pers, date: d, note: 'Магазин: личные расходы продавцов', ts: 0, virt: true });
        });
        S.shopOps = ops; S.shopRep = (r && r.ok && r.report) || null; if (S.view === 'buh') render();
      });
    } else { S.shopOps = []; S.shopRep = null; }
  }
  function buhShopBlock() {
    var R = S.shopRep; if (!R || !shopOn() || !owner()) return '';
    var D = R.days || {}, pur = 0, i; Object.keys(D).forEach(function (d) { pur += cents(D[d].purchase); });
    var acc = 0, pd = 0, ex = 0; (R.salary || []).forEach(function (x) { acc += cents(x.accrued); pd += cents(x.avans) + cents(x.paid); ex += cents(x.exp); });
    var row = function (l, v, c, b) { return '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0' + (b ? ';border-top:1px solid #ddd;margin-top:4px;font-weight:700' : '') + '"><span>' + esc(l) + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + esc(money(v)) + '</b></div>'; };
    var h = '<h3 style="margin:14px 0 4px">🛒 ' + esc(ui('Касса магазина за месяц', 'Сандуқи мағоза дар моҳ', 'Doʻkon kassasi oy boʻyicha')) + '</h3><div style="padding:10px;border:1px solid #ddd;border-radius:12px">' +
      row(ui('Выручка', 'Даромад', 'Tushum'), cents(R.revenue)) + row(ui('Закуплено товара', 'Хариди мол', 'Xarid qilingan tovar'), pur) + row(ui('Прибыль с продаж (наценка)', 'Фоида аз фурӯш', 'Sotuvdan foyda'), cents(R.profit), '#1f8a4c') +
      row(ui('Зарплата продавцам (начислено)', 'Маош (ҳисобшуда)', 'Maosh (hisoblangan)'), -acc, '#c0392b') + row(ui('Прибыль после зарплаты', 'Фоида пас аз маош', 'Maoshdan keyingi foyda'), cents(R.profit) - acc, cents(R.profit) - acc < 0 ? '#c0392b' : '#1f8a4c', true) +
      '<div style="margin-top:6px;opacity:.8"><small>' + esc(ui('Шеф Шамсуло взял', 'Роҳбар гирифт', 'Rahbar oldi')) + ': ' + esc(money(cents(R.owner))) + ' · ' + esc(ui('Долги', 'Қарзҳо', 'Qarzlar')) + ': ' + esc(money(cents(R.debt))) + '</small></div></div>';
    if ((R.salary || []).length) {
      h += '<h3 style="margin:14px 0 4px">' + esc(ui('Зарплата продавцов', 'Маоши фурӯшандагон', 'Sotuvchilar maoshi')) + '</h3>' + R.salary.map(function (x) { return '<div style="padding:6px 0;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between"><b>' + esc(x.name) + '</b><span>' + esc(ui('к выплате', 'барои супоридан', 'toʻlash kerak')) + ' <b style="color:' + (x.rest < 0 ? '#c0392b' : '#1f8a4c') + '">' + esc(money(cents(x.rest))) + '</b></span></div><small style="opacity:.75">' + esc(ui('начислено', 'ҳисобшуда', 'hisoblangan')) + ' ' + esc(money(cents(x.accrued))) + ' · ' + esc(ui('выдано', 'додашуда', 'berilgan')) + ' ' + esc(money(cents(x.avans) + cents(x.paid))) + ' · ' + esc(ui('расходы', 'хароҷот', 'xarajat')) + ' ' + esc(money(cents(x.exp))) + '</small></div>'; }).join('') +
        '<button class="btn sec" data-buh="zp-go" type="button" style="margin-top:8px;width:100%">' + esc(ui('Оклады, авансы, выдачи', 'Маош, пеш, додан', 'Maosh, avans, berish')) + '</button>';
    }
    return h;
  }
  function allOps() { return (S.buh.ops || []).concat(S.shopOps || []); }
  function sums() {
    var i = 0, o = 0; allOps().forEach(function (p) { if (monthOf(p.date) !== S.month) return; var c = cents(p.amount); if (p.type === 'in') i += c; else o += c; });
    return { i: i, o: o, p: i - o };
  }
  var CHIPS = { in: ['Продажа', 'Консультация', 'Предоплата', 'Другое'], out: ['Закупка товара', 'Аренда', 'Реклама', 'Зарплата', 'Транспорт', 'Связь', 'Другое'] };
  var CATKEY = { 'Закупка товара': /закуп|товар|материал|сырь/, 'Аренда': /аренд/, 'Реклама': /реклам|таргет|продвиж/, 'Зарплата': /зарплат|оклад|аванс/, 'Транспорт': /такси|транспорт|бензин|топлив|проезд|доставк|машин/, 'Связь': /связь|интернет|телефон|мобильн|сим/, 'Продажа': /продаж|товар|выручк/, 'Консультация': /консульт|сеанс|приём|прием/, 'Предоплата': /предоплат|аванс|залог/ };
  function catOf(type, note) {
    var n = String(note || '').toLowerCase(), list = CHIPS[type] || [];
    for (var i = 0; i < list.length; i++) { var re = CATKEY[list[i]]; if (re && re.test(n)) return list[i]; }
    return 'Другое';
  }
  function breakdown(ops, type, total, color) {
    var m = {}, k, rows = [];
    ops.forEach(function (p) { if (p.type !== type) return; var c = catOf(type, p.note); m[c] = (m[c] || 0) + cents(p.amount); });
    for (k in m) rows.push([k, m[k]]);
    if (!rows.length || !(total > 0)) return '';
    rows.sort(function (a, b) { return b[1] - a[1]; });
    return rows.map(function (r) {
      var pc = Math.max(3, Math.round(r[1] * 100 / total));
      return '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(TX(r[0])) + '</span><b>' + money(r[1]) + ' <small style="opacity:.6">' + Math.round(r[1] * 100 / total) + '%</small></b></div><div style="height:8px;border-radius:4px;background:var(--line,#eee)"><div style="height:8px;border-radius:4px;width:' + pc + '%;background:' + color + '"></div></div></div>';
    }).join('');
  }
  function tile(label, sub, val, color) {
    return '<div style="border:1px solid var(--line,#ddd);border-radius:14px;padding:10px 6px;text-align:center"><small style="display:block;opacity:.8">' + esc(TX(label)) + '</small><b style="font-size:18px;color:' + color + '">' + val + '</b><small style="display:block;opacity:.65;font-size:11px">' + esc(TX(sub)) + '</small></div>';
  }
  /* ---------- Простые «Финансы» психолога: Приход / Расход / Итог (31.10.2026) ---------- */
  // Работает поверх той же записи (тип «приход/расход», сумма, подпись, дата), отдельной базы нет.
  var PSY = { tab: 'in', kind: 'Сеанс онлайн', okind: 'Аренда кабинета', debt: false, sum: '', name: '' };
  var PSY_IN = [['Сеанс онлайн', 'Сеанс онлайн', 'Машварати онлайн', 'Onlayn seans'], ['Сеанс в кабинете', 'Сеанс в кабинете', 'Машварат дар кабинет', 'Kabinetda seans'], ['Курс', 'Курс', 'Курс', 'Kurs']];
  var PSY_OUT = [['Аренда кабинета', 'Аренда кабинета', 'Иҷораи кабинет', 'Kabinet ijarasi'], ['Зарплата сотрудников', 'Зарплата сотрудников', 'Маоши кормандон', 'Xodimlar maoshi'], ['Аренда приложения', 'Аренда приложения', 'Иҷораи барнома', 'Ilova ijarasi'],
    ['Оплата специалистам', 'Оплата специалистам (SMM, видеограф)', 'Пардохт ба мутахассисон (SMM, видеограф)', 'Mutaxassislarga to‘lov (SMM, videograf)'], ['Таргет', 'Таргет', 'Таргет', 'Target'], ['Дорога', 'Дорога', 'Роҳ', 'Yo‘l'], ['Обед', 'Обед', 'Хӯроки нисфирӯзӣ', 'Tushlik'],
    ['Обучение и супервизия', 'Обучение и супервизия', 'Омӯзиш ва супервизия', 'O‘qish va supervizya'], ['Связь и интернет', 'Связь и интернет', 'Алоқа ва интернет', 'Aloqa va internet'], ['Налоги', 'Налоги', 'Андоз', 'Soliq'], ['Прочее', 'Прочее', 'Дигар', 'Boshqa']];
  function psyL(list, k) { for (var i = 0; i < list.length; i++) if (list[i][0] === k) return ui(list[i][1], list[i][2], list[i][3]); return k; }
  function psyDay(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function psyTot(ops, from) {
    var r = { i: 0, o: 0, ses: 0, crs: 0 };
    ops.forEach(function (p) {
      if (p.date < from) return;
      var c = cents(p.amount);
      if (p.type === 'in') { r.i += c; if (/^Курс/.test(p.note || '')) r.crs += c; else if (/^Сеанс/.test(p.note || '')) r.ses += c; } else r.o += c;
    });
    return r;
  }
  function psyBox(label, t, color) {
    var rest = t.i - t.o;
    return '<div style="border:1px solid var(--line,#ddd);border-radius:14px;padding:12px;margin:8px 0"><b>' + esc(label) + '</b>' +
      '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>' + esc(ui('Пришло', 'Омад', 'Keldi')) + '</span><b style="color:#1f8a4c">' + money(t.i) + '</b></div>' +
      '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>' + esc(ui('Ушло', 'Рафт', 'Chiqdi')) + '</span><b style="color:#c0392b">' + money(t.o) + '</b></div>' +
      '<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line,#ddd);margin-top:4px"><span>' + esc(ui('Осталось', 'Монд', 'Qoldi')) + '</span><b style="color:' + (rest < 0 ? '#c0392b' : 'inherit') + '">' + money(rest) + '</b></div>' +
      '<div style="display:flex;justify-content:space-between;padding:2px 0;opacity:.85"><small>' + esc(ui('Доход от сеансов', 'Даромад аз машваратҳо', 'Seanslardan daromad')) + '</small><small>' + money(t.ses) + '</small></div>' +
      '<div style="display:flex;justify-content:space-between;padding:2px 0;opacity:.85"><small>' + esc(ui('Доход от курсов', 'Даромад аз курсҳо', 'Kurslardan daromad')) + '</small><small>' + money(t.crs) + '</small></div></div>';
  }
  function psyRows(ops, type) {
    var td = today(), list = ops.filter(function (p) { return p.type === type && p.date === td; }).sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    if (!list.length) return '<p style="opacity:.7">' + esc(ui('Сегодня записей пока нет.', 'Имрӯз ҳанӯз сабт нест.', 'Bugun hali yozuv yo‘q.')) + '</p>';
    return '<h3 style="margin:12px 0 4px">' + esc(ui('Сегодня', 'Имрӯз', 'Bugun')) + '</h3>' + list.map(function (p) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee"><span style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(p.note || '') + '</span><b style="flex:none;color:' + (type === 'in' ? '#1f8a4c' : '#c0392b') + '">' + money(cents(p.amount)) + '</b>' +
        '<button class="btn sec" data-buh="del" data-id="' + esc(p.id) + '" type="button" aria-label="' + esc(TX('Удалить запись')) + '" style="flex:none;height:30px;padding:0 8px">' + (S.delAsk === p.id ? esc(ui('Удалить?', 'Нест кунам?', 'O‘chirilsinmi?')) : '✕') + '</button></div>';
    }).join('');
  }
  function psyRender(el, head) {
    var ops = allOps(), h = head, tabs = [['in', ui('Приход', 'Даромад', 'Kirim')], ['out', ui('Расход', 'Хароҷот', 'Chiqim')], ['sum', ui('Итог', 'Ҳисоб', 'Natija')]];
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0">' + tabs.map(function (t) {
      var on = PSY.tab === t[0];
      return '<button type="button" class="btn' + (on ? '' : ' sec') + '" data-psy="tab:' + t[0] + '" style="height:48px;font-size:16px">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    if (PSY.tab === 'in') {
      h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">' + PSY_IN.map(function (k) {
        return '<button type="button" class="btn' + (PSY.kind === k[0] ? '' : ' sec') + '" data-psy="kind:' + esc(k[0]) + '" style="height:40px;padding:0 12px">' + esc(ui(k[1], k[2], k[3])) + '</button>';
      }).join('') + '</div>' +
        '<form id="psy-form" style="display:grid;gap:8px;margin:8px 0;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px">' +
        '<label style="display:grid;gap:4px"><small>' + esc(ui('Сумма, в сомони', 'Маблағ, сомонӣ', 'Summa, somoniy')) + '</small><input class="in2" id="psy-sum" inputmode="decimal" maxlength="12" placeholder="300" autocomplete="off" value="' + esc(PSY.sum) + '"></label>' +
        '<label style="display:grid;gap:4px"><small>' + esc(ui('Имя клиента', 'Номи муштарӣ', 'Mijoz ismi')) + '</small><input class="in2" id="psy-name" maxlength="60" autocomplete="off" value="' + esc(PSY.name) + '"></label>' +
        '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="psy-debt"' + (PSY.debt ? ' checked' : '') + '> ' + esc(ui('Долг (клиент заплатил не полностью)', 'Қарз (муштарӣ пурра напардохт)', 'Qarz (mijoz to‘liq to‘lamadi)')) + '</label>' +
        '<button class="btn sec" data-buh="mic" type="button" style="height:44px">🎤 ' + esc(TX('Сказать голосом')) + '</button>' +
        '<button class="btn" data-psy="save:in" type="button" style="height:48px">' + esc(ui('Сохранить', 'Нигоҳ доштан', 'Saqlash')) + '</button></form>' + psyRows(ops, 'in');
    } else if (PSY.tab === 'out') {
      h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">' + PSY_OUT.map(function (k) {
        return '<button type="button" class="btn' + (PSY.okind === k[0] ? '' : ' sec') + '" data-psy="okind:' + esc(k[0]) + '" style="height:36px;padding:0 10px;font-size:14px">' + esc(ui(k[1], k[2], k[3])) + '</button>';
      }).join('') + '</div>' +
        '<form id="psy-form" style="display:grid;gap:8px;margin:8px 0;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px">' +
        '<label style="display:grid;gap:4px"><small>' + esc(ui('Сумма, в сомони', 'Маблағ, сомонӣ', 'Summa, somoniy')) + '</small><input class="in2" id="psy-sum" inputmode="decimal" maxlength="12" placeholder="100" autocomplete="off" value="' + esc(PSY.sum) + '"></label>' +
        '<button class="btn" data-psy="save:out" type="button" style="height:48px;background:#c0392b;color:#fff;border:0">' + esc(ui('Сохранить', 'Нигоҳ доштан', 'Saqlash')) + '</button></form>' + psyRows(ops, 'out');
    } else {
      h += psyBox(ui('За неделю', 'Дар як ҳафта', 'Hafta uchun'), psyTot(ops, psyDay(6))) + psyBox(ui('За месяц', 'Дар як моҳ', 'Oy uchun'), psyTot(ops.filter(function (p) { return monthOf(p.date) === today().slice(0, 7); }), today().slice(0, 7) + '-01'));
      var debts = ops.filter(function (p) { return p.type === 'in' && / · долг$/.test(p.note || ''); }).length;
      if (debts) h += '<p style="opacity:.85">' + esc(ui('Записей с долгом: ', 'Сабтҳо бо қарз: ', 'Qarzli yozuvlar: ')) + debts + '</p>';
    }
    h += '<p class="err" id="bh-err" hidden></p>';
    el.innerHTML = h;
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-psy]') : null; if (!b || S.view !== 'buh') return;
    var v = b.getAttribute('data-psy'), i = v.indexOf(':'), a = v.slice(0, i), x = v.slice(i + 1);
    var sf = $s('psy-sum'), nf = $s('psy-name'), df = $s('psy-debt');
    if (sf) PSY.sum = sf.value; if (nf) PSY.name = nf.value; if (df) PSY.debt = df.checked;
    if (a === 'tab') { PSY.tab = x; return render(); }
    if (a === 'kind') { PSY.kind = x; return render(); }
    if (a === 'okind') { PSY.okind = x; return render(); }
    if (a === 'save') {
      var amount = String(PSY.sum || '').replace(/\s/g, '').replace(',', '.');
      if (!(parseFloat(amount) > 0)) return err(TX('Введите сумму больше нуля'));
      var note = x === 'in' ? PSY.kind + (PSY.name.trim() ? ' · ' + PSY.name.trim() : '') + (PSY.debt ? ' · долг' : '') : PSY.okind;
      PSY.sum = ''; PSY.name = ''; PSY.debt = false;
      return addOp({ type: x, amount: amount, note: note.slice(0, 120), date: today() });
    }
  });
  function renderBuh(el) {
    if (S.onb) return renderOnb(el);
var h = backBtn() + '<h2 style="padding-right:36px">📒 ' + esc(TX('Бухгалтер')) + '</h2>' + (S.prof ? '<button type="button" class="btn sec" data-onb="change" style="height:30px;padding:0 10px;margin:0 0 6px;font-size:13px">' + esc(TX('Изменить вид деятельности')) + '</button>' : '');
    h += shBtnsHtml();
    if (!S.buh) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (S.buh.error) { el.innerHTML = h + '<p class="err">' + esc(S.buh.error) + '</p><button class="btn" data-buh="reload" type="button">' + esc(TX('Ещё раз')) + '</button>'; return; }
    writeCache();
    if (S.prof && S.prof.kind === 'health') return psyRender(el, h);
    if (S.buh.offline) h += '<p><small>' + esc(TX('Нет связи: показаны сохранённые записи.')) + '</small></p>'; else if (S.busy && S.buh.cached) h += '<p><small>' + esc(TX('Обновляем…')) + '</small></p>';
    var t = sums(), ops = allOps().filter(function (p) { return monthOf(p.date) === S.month; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.ts < b.ts ? 1 : -1); });
    h += '<p style="margin:2px 0 8px;opacity:.8">' + esc(TX('Записывайте каждый раз, когда деньги пришли или ушли. Прибыль посчитается сама. Суммы в сомони.')) + '</p>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0"><button class="btn sec" data-buh="prev" type="button" aria-label="' + esc(TX('Прошлый месяц')) + '">‹</button><b>' + esc(monthName(S.month)) + '</b><button class="btn sec" data-buh="next" type="button" aria-label="' + esc(TX('Следующий месяц')) + '">›</button></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
      tile('Приход', 'деньги пришли', money(t.i), '#1f8a4c') + tile('Расход', 'деньги ушли', money(t.o), '#c0392b') + tile('Прибыль', 'что осталось', money(t.p), t.p < 0 ? '#c0392b' : 'inherit') + '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">' +
      '<button class="btn" data-buh="open-in" type="button" style="background:#2E9E5B;color:#fff;border:0">＋ ' + esc(TX('Деньги пришли')) + '</button>' +
      '<button class="btn" data-buh="open-out" type="button" style="background:#c0392b;color:#fff;border:0">− ' + esc(TX('Деньги ушли')) + '</button></div>';
    if (S.form) {
      var inn = S.form === 'in';
      h += '<form id="bh-form" style="display:grid;gap:8px;margin:8px 0;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px">' +
        '<b>' + esc(TX(inn ? 'Деньги пришли' : 'Деньги ушли')) + '</b><input type="hidden" id="bh-type" value="' + S.form + '">' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('Сколько, в сомони')) + '</small><input class="in2" id="bh-sum" inputmode="decimal" maxlength="12" placeholder="150" autocomplete="off" value="' + esc(S.pre ? S.pre.amount : '') + '"></label>' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('За что')) + '</small><input class="in2" id="bh-note" maxlength="120" placeholder="' + esc(TX('Выберите ниже или напишите')) + '" autocomplete="off" value="' + esc(S.pre ? S.pre.note : '') + '"></label>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' + chipsFor(S.form).map(function (c) { return '<button type="button" class="btn sec" data-chip="' + esc(c) + '" style="height:32px;padding:0 10px;font-size:13px">' + esc(TX(c)) + '</button>'; }).join('') + '</div>' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('Дата')) + '</small><input class="in2" id="bh-date" type="date" value="' + (S.pre ? S.pre.date : today()) + '"></label>' +
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><button class="btn" data-buh="add" type="button">' + esc(TX('Сохранить')) + '</button><button class="btn sec" data-buh="close-form" type="button">' + esc(TX('Отмена')) + '</button></div></form>';
    } else {
      h += '<div style="display:grid;gap:6px;margin:8px 0"><small style="opacity:.8">' + esc(TX('Напишите одной строкой («расход 150 такси») или нажмите микрофон и скажите: «потратил 150 на такси»')) + '</small>' +
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><input class="in2" id="bh-text" maxlength="160" placeholder="' + esc(TX('расход 150 такси')) + '" autocomplete="off" value="' + esc(S.bhDraft || '') + '"><button class="btn" data-buh="text" type="button">' + esc(TX('Записать')) + '</button></div>' +
        '<button class="btn sec" data-buh="mic" type="button" style="height:44px">🎤 ' + esc(TX('Сказать голосом')) + '</button></div>';
    }
    h += '<p class="err" id="bh-err" hidden></p>';
    h += buhShopBlock();
    var bo = breakdown(ops, 'out', t.o, '#c0392b'), bi = breakdown(ops, 'in', t.i, '#1f8a4c');
    if (bo) h += '<h3 style="margin:14px 0 4px">' + esc(TX('Куда ушли деньги')) + '</h3>' + bo;
    if (bi) h += '<h3 style="margin:14px 0 4px">' + esc(TX('Откуда пришли деньги')) + '</h3>' + bi;
    h += '<h3 style="margin:14px 0 4px">' + esc(TX('Записи за месяц')) + '</h3>' + (ops.length ? '<div>' + ops.map(function (p) {
      var ask = S.delAsk === p.id, inn = p.type === 'in';
      return '<div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #ddd"><span aria-hidden="true" style="flex:none;color:' + (inn ? '#1f8a4c' : '#c0392b') + '">' + (inn ? '↗' : '↘') + '</span><span style="flex:none;opacity:.7;font-size:12px">' + esc(String(p.date).slice(8, 10) + '.' + String(p.date).slice(5, 7)) + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + esc(p.virt ? TX(p.note) : (p.note || (inn ? TX('Приход') : TX('Расход')))) + '</span>' +
        '<b style="flex:none;color:' + (inn ? '#1f8a4c' : '#c0392b') + '">' + (inn ? '+' : '−') + money(cents(p.amount)) + '</b>' +
        (p.virt ? '<span style="flex:none;width:30px;text-align:center" title="' + esc(TX('Из учёта магазина')) + '">🛒</span>' : '<button class="btn sec" data-buh="edit" data-id="' + esc(p.id) + '" type="button" aria-label="' + esc(TX('Исправить запись')) + '" style="flex:none;height:30px;padding:0 8px">✎</button>' +
          '<button class="btn sec" data-buh="del" data-id="' + esc(p.id) + '" type="button" aria-label="' + esc(TX('Удалить запись')) + '" style="flex:none;height:30px;padding:0 8px' + (ask ? ';background:#c0392b;color:#fff' : '') + '">' + (ask ? esc(TX('Удалить?')) : '×') + '</button>') + '</div>';
    }).join('') + '</div>' : '<p style="opacity:.8">' + esc(TX('Пока пусто. Нажмите «Деньги пришли», когда получите оплату, или «Деньги ушли», когда потратите.')) + '</p>');
    if (!(S.prof && S.prof.stock === 'no')) {
h += '<h3 style="margin:16px 0 2px">' + esc(TX('Склад')) + '</h3><p style="margin:0 0 6px;opacity:.8"><small>' + esc(TX('Сколько чего у вас есть. Нажмите + когда товар пришёл, − когда ушёл.')) + '</small></p>' +
      (S.buh.stock.length ? '<div>' + S.buh.stock.map(function (g) {
        return '<div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #ddd"><span style="flex:1;min-width:0">' + esc(g.name) + '</span><b style="flex:none">' + esc(g.qty) + ' ' + esc(TX('шт')) + '</b>' +
          '<button class="btn" data-buh="sell" data-name="' + esc(g.name) + '" type="button" style="flex:none;height:30px;padding:0 10px">' + esc(TX('Продать')) + '</button><button class="btn sec" data-buh="st-" data-name="' + esc(g.name) + '" type="button" style="flex:none;height:30px;padding:0 12px" aria-label="−1">−</button><button class="btn sec" data-buh="st+" data-name="' + esc(g.name) + '" type="button" style="flex:none;height:30px;padding:0 12px" aria-label="+1">+</button></div>';
      }).join('') + '</div>' : '<p style="opacity:.8">' + esc(TX('Товаров пока нет.')) + '</p>');
    if (S.sell) {
      h += '<div style="display:grid;gap:8px;margin:10px 0;padding:12px;border:2px solid #1f8a4c;border-radius:14px"><b>' + esc(TX('Продажа')) + ': ' + esc(S.sell) + '</b>' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('Сколько штук продали')) + '</small><input class="in2" id="bh-sqty" inputmode="numeric" maxlength="6" value="1"></label>' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('Цена за одну штуку, в сомони')) + '</small><input class="in2" id="bh-sprice" inputmode="decimal" maxlength="12" placeholder="100"></label>' +
        '<small style="opacity:.75">' + esc(TX('Склад уменьшится, а деньги запишутся в приход сами.')) + '</small>' +
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><button class="btn" data-buh="sell-ok" type="button">' + esc(TX('Продано')) + '</button><button class="btn sec" data-buh="sell-x" type="button">' + esc(TX('Отмена')) + '</button></div></div>';
    }
    if (S.gform) {
      h += '<div style="display:grid;gap:8px;margin:10px 0;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px">' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('Название товара')) + '</small><input class="in2" id="bh-gname" maxlength="60" placeholder="' + esc(TX('Например: крем')) + '"></label>' +
        '<label style="display:grid;gap:4px"><small>' + esc(TX('Сколько штук есть сейчас')) + '</small><input class="in2" id="bh-gqty" inputmode="numeric" maxlength="7" placeholder="5"></label>' +
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><button class="btn" data-buh="gadd" type="button">' + esc(TX('Добавить товар')) + '</button><button class="btn sec" data-buh="close-g" type="button">' + esc(TX('Отмена')) + '</button></div></div>';
    } else {
      h += '<button class="btn sec" data-buh="open-g" type="button" style="margin:8px 0">＋ ' + esc(TX('Добавить товар')) + '</button>';
    }
}
    el.innerHTML = h;
  }
  function err(t) { var e = $s('bh-err'); if (!e) return; e.textContent = t || ''; e.hidden = !t; }
  function addOp(op) {
    if (!(cents(op.amount) > 0) || cents(op.amount) > 100000000000) return err(TX('Введите сумму больше нуля'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date)) return err(TX('Укажите дату'));
    op.id = oid(); err('');
    call({ action: 'add', op: op }).then(function (r) {
      if (!r.ok) return err(r.error || TX('Не удалось записать'));
      op.ts = Date.now(); if (monthOf(op.date) !== S.month) { S.month = monthOf(op.date); S.buh = readCache(S.month); S.form = null; S.edit = null; S.pre = null; load(); return render(); } S.buh.ops.push(op); S.form = null; S.edit = null; S.pre = null; render();
    });
  }
  function stock(name, delta) {
    name = String(name || '').trim().slice(0, 60); delta = Math.round(Number(delta));
    if (!name || !isFinite(delta) || !delta) return err(TX('Введите название и количество'));
    err('');
    return call({ action: 'stock', name: name, delta: delta }).then(function (r) { if (!r.ok) { err(r.error || TX('Не удалось записать')); return false; } S.buh.stock = r.stock || []; S.gform = false; render(); return true; });
  }
  /* ---------- Учёт магазина: касса, товары, долги, отчёт (n8n /magazin) ---------- */
  var SELLER = false, KAS_SID = '', KEEPER = false, PHARM = false;
  var SH = { low: '', pcode: '', tab: 'kassa', d: null, cart: [], pay: '', who: '', cid: '', busy: false, err: '', ok: '', form: null, rcv: null, payf: null, delAsk: '', voidAsk: '', month: '', found: null, code: '' };
  var SH_DEBT_WARN = 100000; // порог предупреждения о большом долге: 1000 сомони, в дирамах
  function shMoney(x) { return money(cents(x)); }
  function shProd(kod) { var r = null; ((SH.d && SH.d.products) || []).forEach(function (p) { if (p.kod === kod) r = p; }); return r; }
  // Единицы измерения (24.10.2026, только магазин Шамсуло): штуки, метры до сантиметра, килограммы до грамма, граммы, рулоны.
  // per — сколько единиц в одной штуке (труба 4 м, рулон 25 м): такой товар можно принять и продать и штуками, и метрами.
  var SH_U = { sht: ['шт', 'дона', 'dona'], m: ['м', 'м', 'm'], kg: ['кг', 'кг', 'kg'], g: ['г', 'г', 'g'], rulon: ['рулон', 'рулон', 'rulon'] };
  var SH_UN = [['sht', 'Штуки', 'Дона', 'Dona'], ['m', 'Метры — для рулона (продаю по метрам)', 'Метр — барои рулон (бо метр мефурӯшам)', 'Metr — rulon uchun (metrlab sotaman)'], ['kg', 'Килограммы — для мешка (продаю на вес, до грамма)', 'Килограмм — барои халта (бо вазн, то грамм)', 'Kilogramm — qop uchun (vazn boʻyicha, grammgacha)'], ['g', 'Граммы', 'Грамм', 'Gramm'], ['rulon', 'Рулоны', 'Рулон', 'Rulon']];
  function shU(p) { if (objOn()) return 'sht'; return p && SH_U[p.unit] ? p.unit : 'sht'; } // аптека (кабинет со стройкой): всё считается только в штуках
  function shUL(u) { var x = SH_U[u] || SH_U.sht; return ui(x[0], x[1], x[2]); }
  function shQR(u, x) { var f = u === 'm' ? 100 : u === 'kg' ? 1000 : 1; return Math.round(Number(x) * f) / f; }
  function shNumTxt(n) { return String(n).replace('.', ','); }
  function shPer(p) { return p && Number(p.per) > 0 && shU(p) !== 'sht' ? Number(p.per) : 0; }
  function shQ(p, q) { var u = shU(p), n = shQR(u, q), per = shPer(p), t = shNumTxt(n) + ' ' + shUL(u); if (per && Math.abs(n) >= per) t += ' (≈' + shNumTxt(Math.floor(Math.abs(n) / per * 10) / 10) + ' ' + ui('шт', 'дона', 'dona') + ')'; return t; }
  // Рулон/штука целиком: закупка и продажа за весь рулон (цена за метр × метров в рулоне).
  // Подсказка при вводе цен: за метр (кг) и за рулон (мешок) — закупка и продажа.
  function shPrevTxt(p, z, sell) {
    var u = shU(p), per = shPer(p); if (!per) return '';
    var t = ui('За ', 'Барои ', '') + shUL(u) + ': ' + ui('закупка ', 'харид ', 'xarid ') + shMoney(shR2(z)) + (sell > 0 ? ', ' + ui('продажа ', 'фурӯш ', 'sotuv ') + shMoney(shR2(sell)) : '') + '. ' + shBoxW(u, true).replace(/^./, function (c) { return c.toUpperCase(); }) + ' (' + shNumTxt(per) + ' ' + shUL(u) + '): ' + ui('закупка ', 'харид ', 'xarid ') + shMoney(shR2(z * per)) + (sell > 0 ? ', ' + ui('продажа ', 'фурӯш ', 'sotuv ') + shMoney(shR2(sell * per)) : '') + '.';
    return t;
  }
  function shBoxW(u, gen) { return u === 'kg' ? (gen ? ui('мешок', 'халта', 'qop') : ui('мешков', 'халта', 'qop')) : (gen ? ui('рулон', 'рулон', 'rulon') : ui('рулонов', 'рулон', 'rulon')); }
  // Цена за 100 г и за кг для весового товара (мешок продают на вес).
  function shGramLine(p) {
    if (!p || shU(p) !== 'kg' || !(Number(p.price) > 0)) return '';
    return ui('1 кг = ', '1 кг = ', '1 kg = ') + shMoney(p.price) + ' · ' + ui('100 г = ', '100 г = ', '100 g = ') + shMoney(shR2(p.price / 10));
  }
  function shRollLine(p) {
    var per = shPer(p); if (!per) return '';
    return shBoxW(shU(p), true).replace(/^./, function (c) { return c.toUpperCase(); }) + ' (' + shNumTxt(per) + ' ' + shUL(shU(p)) + '): ' + ui('закупка ', 'харид ', 'xarid ') + shMoney(shR2(p.zakup * per)) + ' · ' + ui('продажа ', 'фурӯш ', 'sotuv ') + shMoney(shR2(p.price * per));
  }
  function shZa(p) { return shU(p) === 'sht' ? '' : ' ' + ui('за ', 'барои ', '') + shUL(shU(p)) + ui('', '', ' uchun'); }
  function shStep(p) { return shPer(p) || 1; }
  function shLineSum(price, q) { return Math.round(cents(price) * Number(q)); }
  function shParse(v) { return Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); }
  function openShop() { S.view = 'shop'; SH.kl = false; SH.tab = 'kassa'; SH.cart = []; SH.pay = ''; SH.who = ''; SH.cid = oid(); SH.err = ''; SH.ok = ''; SH.form = null; SH.rcv = null; SH.payf = null; SH.delAsk = ''; SH.voidAsk = ''; SH.found = null; SH.month = SH.month || today().slice(0, 7); SH.d = null; render(); shLoad(); }
  function shLoad() { SH.busy = true; callTo('/magazin', { action: 'list', month: SH.month }).then(function (r) { SH.busy = false; if (!r.ok) SH.err = r.error || TX('не удалось загрузить'); else { SH.d = r; SH.err = ''; } if (S.view === 'shop') render(); }); }
  function shAct(body, okMsg, after) {
    SH.busy = true; SH.err = ''; SH.ok = ''; body.month = SH.month; render();
    return callTo('/magazin', body).then(function (r) { SH.busy = false; if (!r.ok) SH.err = r.error || TX('Не удалось записать'); else { SH.d = r; SH.ok = okMsg || ''; if (r.warn && r.warn.length) SH.ok += ' · ' + ui('Внимание, на складе не хватало: ', 'Диққат, дар анбор намерасид: ', 'Diqqat, omborda yetmadi: ') + r.warn.map(function (w) { return w.name; }).join(', '); if (after) after(r); } if (S.view === 'shop') render(); });
  }
  var SH_F = {}, SH_FQ = {};
  function shFotoLoad(kod) {
    if (!kod || SH_F[kod] !== undefined || SH_FQ[kod]) return; SH_FQ[kod] = 1;
    callTo('/magazin', { action: 'foto_get', kod: kod }).then(function (r) { SH_FQ[kod] = 0; SH_F[kod] = (r && r.ok && r.foto) || ''; if (S.view === 'shop') render(); });
  }
  function shThumb(p, sz) {
    if (!p || !p.foto) return ''; var f = SH_F[p.kod]; sz = sz || 44;
    if (f === undefined) { shFotoLoad(p.kod); return '<span style="flex:none;width:' + sz + 'px;height:' + sz + 'px;border-radius:8px;background:#eee"></span>'; }
    return f ? '<img alt="" src="' + f + '" style="flex:none;width:' + sz + 'px;height:' + sz + 'px;object-fit:cover;border-radius:8px">' : '';
  }
  function shFotoMake(file, cb) {
    var rd = new FileReader();
    rd.onerror = function () { cb(''); };
    rd.onload = function () {
      var im = new Image(); im.onerror = function () { cb(''); };
      im.onload = function () {
        var m = 240, k = Math.min(1, m / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), c = document.createElement('canvas'), out = '', q = 0.65;
        c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
        while (q > 0.2) { out = c.toDataURL('image/jpeg', q); if (out.length <= 16000) break; q -= 0.1; }
        cb(out.length <= 20000 ? out : '');
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  }
  function shFotoBox(inner) { return '<input type="file" id="sh-foto-in" accept="image/*" capture="environment" hidden>' + inner; }
  var SCAN = null;
  function shScanBtn(mode) { return shBtn('scan', '📷 ' + ui('Скан', 'Скан', 'Skan'), { sec: true, st: 'min-height:48px;padding:0 14px' }, mode); }
  function shCanCreate() { return !sellerView() || KEEPER; }
  // Заводской штрихкод (bar) привязан к товару с коротким кодом магазина: ищем и по коду, и по штрихкоду.
  function shHasBar(p, t) { return Array.isArray(p.bar) && p.bar.some(function (b) { return String(b).toLowerCase() === t; }); }
  function shFindExact(code) { var t = String(code).toLowerCase(), hit = null, bh = null; ((SH.d && SH.d.products) || []).forEach(function (p) { if (String(p.kod).toLowerCase() === t) hit = p; else if (shHasBar(p, t)) bh = p; }); return hit || bh; }
  function shScanMsg(t) { var m = SCAN && SCAN.ov && SCAN.ov.querySelector('#sh-scan-msg'); if (m) m.textContent = t; }
  function shScanStop() {
    if (!SCAN) return; var s = SCAN; SCAN = null; clearInterval(s.timer);
    try { if (s.stream) s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (s.ov.parentNode) s.ov.parentNode.removeChild(s.ov); } catch (e) {}
  }
  var SH_FMT = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code', 'code_39', 'code_93', 'itf', 'codabar', 'data_matrix', 'pdf417', 'aztec'];
  function shScanOpen(mode) {
    if (SCAN) return;
    var host = document.querySelector('dialog[open]') || document.body;
    var ov = document.createElement('div'); ov.id = 'sh-scan';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', ui('Сканер штрихкода', 'Скануери рамзи хатч', 'Shtrix-kod skaneri'));
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box';
    ov.innerHTML = '<video id="sh-scan-v" playsinline muted style="width:min(92vw,420px);max-height:55vh;background:#000;border-radius:12px;object-fit:cover"></video>' +
      '<div id="sh-scan-msg" role="status" style="color:#fff;text-align:center;max-width:420px">' + esc(ui('Наведите камеру на штрихкод товара', 'Камераро ба рамзи мол равона кунед', 'Kamerani tovar shtrix-koduga yoʻnaltiring')) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;width:min(92vw,420px)"><input id="sh-scan-in" class="in2" autocomplete="off" inputmode="text" placeholder="' + esc(ui('Или введите код вручную', 'Ё рамзро дастӣ ворид кунед', 'Yoki kodni qoʻlda kiriting')) + '" style="height:48px;font-size:16px"><button type="button" class="btn" id="sh-scan-ok" style="height:48px">' + esc(ui('Ввести', 'Ворид', 'Kiritish')) + '</button></div>' +
      '<button type="button" class="btn sec" id="sh-scan-x" style="min-height:48px">' + esc(ui('Закрыть', 'Пӯшидан', 'Yopish')) + '</button>';
    host.appendChild(ov);
    SCAN = { ov: ov, mode: mode, stream: null, timer: null, done: false, busy: false };
    ov.querySelector('#sh-scan-x').addEventListener('click', function () { shScanStop(); render(); });
    ov.querySelector('#sh-scan-ok').addEventListener('click', function () { shScanDone(ov.querySelector('#sh-scan-in').value); });
    ov.querySelector('#sh-scan-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); shScanDone(this.value); } });
    var det = null;
    try { if (typeof window.BarcodeDetector === 'function' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) det = new window.BarcodeDetector({ formats: SH_FMT.slice(0, 6) }); } catch (e) { det = null; }
    // Заводские коды бывают разные: берём все форматы из списка, которые этот телефон умеет читать (Code39, ITF, DataMatrix и др.).
    if (det && window.BarcodeDetector.getSupportedFormats) window.BarcodeDetector.getSupportedFormats().then(function (sup) { var f = SH_FMT.filter(function (x) { return sup.indexOf(x) >= 0; }); if (f.length && SCAN && SCAN.ov === ov) try { det = new window.BarcodeDetector({ formats: f }); } catch (e) {} }, function () {});
    if (!det) { shScanMsg(ui('Сканер на этом телефоне недоступен. Введите код вручную.', 'Скануер дар ин телефон дастрас нест. Рамзро дастӣ ворид кунед.', 'Bu telefonda skaner ishlamaydi. Kodni qoʻlda kiriting.')); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (st) {
      if (!SCAN || SCAN.ov !== ov) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      SCAN.stream = st; var v = ov.querySelector('#sh-scan-v'); v.srcObject = st; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      SCAN.timer = setInterval(function () {
        if (!SCAN || SCAN.ov !== ov || SCAN.busy || SCAN.done) return; SCAN.busy = true;
        det.detect(v).then(function (res) { if (SCAN) SCAN.busy = false; if (res && res.length && res[0].rawValue) shScanDone(res[0].rawValue); }, function () { if (SCAN) SCAN.busy = false; });
      }, 250);
    }).catch(function () { shScanMsg(ui('Нет доступа к камере. Разрешите камеру в браузере или введите код вручную.', 'Ба камера дастрасӣ нест. Камераро иҷозат диҳед ё рамзро дастӣ ворид кунед.', 'Kameraga ruxsat yoʻq. Kameraga ruxsat bering yoki kodni qoʻlda kiriting.')); });
  }
  function shScanDone(raw) {
    if (!SCAN || SCAN.done) return;
    var code = String(raw || '').trim().slice(0, 64); if (!code) return;
    var mode = SCAN.mode; SCAN.done = true; shScanStop();
    SH.err = ''; SH.ok = ''; SH.found = null; SH.low = '';
    // «Привязать штрихкод» у товара в приёме: отсканированный код сразу привязывается к этому товару.
    if (mode === 'bindto') { if (SH.rcv) shBind(SH.rcv.kod, code); return render(); }
    if (mode === 'ret') { if (SH.ret) shRetFind(code); return render(); }
    var p = shFindExact(code), noAdd = ui('Товара с кодом «' + code + '» нет. Скажите кладовщику или владельцу.', 'Мол бо рамзи «' + code + '» нест. Ба анбордор ё соҳиб гӯед.', '«' + code + '» kodli tovar yoʻq. Omborchi yoki egasiga ayting.');
    if (mode === 'sell') {
      SH.tab = 'kassa'; SH.code = '';
      if (p) shPut(p.kod);
      else if (shCanCreate()) { SH.tab = 'prihod'; SH.rcv = null; SH.form = null; SH.bind = { code: code, q: '' }; }
      else SH.err = ui('Штрихкод «' + code + '» ещё не привязан к товару. Найдите товар по коду или названию и попросите кладовщика привязать этот штрихкод.', 'Штрихкоди «' + code + '» ҳанӯз ба мол пайваст нест. Молро бо рамз ё ном ёбед ва аз анбордор хоҳед, ки онро пайваст кунад.', '«' + code + '» shtrix-kodi hali tovarga bogʻlanmagan. Tovarni kod yoki nom bilan toping va omborchidan bogʻlashni soʻrang.');
      return render();
    }
    SH.tab = 'prihod'; SH.pcode = '';
    if (p) { SH.rcv = { kod: p.kod, name: p.name }; SH.form = null; SH.bind = null; }
    else if (shCanCreate()) { SH.rcv = null; SH.form = null; SH.bind = { code: code, q: '' }; }
    else { SH.rcv = null; SH.err = noAdd; }
    render();
  }
  function shRw() { try { return Number(lstore('ew_rw')) === 80 ? 80 : 58; } catch (e) { return 58; } }
  // Штрихкод Code 128 (набор B) для печатного чека: последние 8 знаков номера (по ним касса находит чек при возврате) — так полосы
  // не слишком тонкие для термопринтера 58 мм и камеры телефона.
  var SH_C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
  function shCode128(text, wmm) {
    var t = String(text || '').replace(/[^\x20-\x7e]/g, ''), vals = [104], sum = 104;
    for (var i = 0; i < t.length; i++) { var v = t.charCodeAt(i) - 32; vals.push(v); sum += v * (i + 1); }
    vals.push(sum % 103); vals.push(106);
    var bars = '', x = 10, mods = 20;
    vals.forEach(function (v) { SH_C128[v].split('').forEach(function (n) { mods += +n; }); });
    vals.forEach(function (v) { SH_C128[v].split('').forEach(function (n, j) { n = +n; if (j % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + n + '" height="40"/>'; x += n; }); });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + mods + ' 40" width="' + (wmm || 46) + 'mm" height="12mm" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="' + esc(t) + '">' + bars + '</svg>';
  }
  /* ---------- Возврат по чеку: номер чека (скан штрихкода с чека или ввод), позиции и количество ---------- */
  function shRetFind(scanned) {
    var R = SH.ret; if (!R || R.busy) return;
    var qi = $s('sh-ret-q'); if (scanned != null) R.q = scanned; else if (qi) R.q = qi.value;
    var q = String(R.q || '').replace(/[^a-zA-Z0-9]/g, '');
    if (q.length < 6) { R.err = ui('Введите номер чека (не меньше 6 знаков)', 'Рақами чекро нависед (на камтар аз 6 аломат)', 'Chek raqamini kiriting (kamida 6 belgi)'); return render(); }
    R.busy = true; R.err = ''; R.chek = null; render();
    callTo('/magazin', { action: 'chek_get', chek: q }).then(function (r) {
      if (SH.ret !== R) return; R.busy = false;
      if (!r || !r.ok || !r.chek) { R.err = (r && r.error) || TX('не удалось загрузить'); return render(); }
      R.chek = r.chek; R.sel = {}; R.id = oid(); R.pay = 'nal'; render();
    });
  }
  function shRetGo() {
    var R = SH.ret; if (!R || R.busy || !R.chek) return;
    var items = [], sum = 0, bad = '';
    R.chek.lines.forEach(function (l, i) {
      var e = $s('sh-ret-' + i), v = e ? shParse(e.value) : 0; if (e) R.sel[l.kod] = e.value;
      if (!(v > 0)) return;
      if (v > l.left + 0.0001) bad = ui('Можно вернуть не больше ', 'На зиёда аз ', 'Koʻpi bilan ') + shNumTxt(l.left) + ': ' + l.name;
      items.push({ kod: l.kod, qty: v }); sum += shLineSum(l.price, v);
    });
    if (bad) { R.err = bad; return render(); }
    if (!items.length) { R.err = ui('Впишите, сколько возвращают', 'Нависед, чанд бармегардонанд', 'Qancha qaytarilishini yozing'); return render(); }
    R.busy = true; R.err = ''; render();
    callTo('/magazin', { action: 'vozvrat', chek: R.chek.id, id: R.id, date: today(), items: items, pay: R.pay }).then(function (r) {
      if (SH.ret !== R) return; R.busy = false;
      if (!r || !r.ok) { R.err = (r && r.error) || TX('Не удалось записать'); return render(); }
      var tot = r.vozvrat ? r.vozvrat.total : sum / 100;
      SH.ret = null; SH.err = ''; SH.ok = ui('Возврат оформлен: верните покупателю ', 'Баргардонидан сабт шуд: ба харидор баргардонед ', 'Qaytarish yozildi: xaridorga qaytaring ') + money(cents(tot)) + ' ' + ui('сомони', 'сомонӣ', 'somoniy') + (r.vozvrat && r.vozvrat.pay === 'dolg' ? ' (' + ui('списано с долга', 'аз қарз кам шуд', 'qarzdan ayirildi') + ')' : '') + '. ' + ui('Товар вернулся на склад.', 'Мол ба анбор баргашт.', 'Tovar omborga qaytdi.');
      shLoad();
    });
  }
  function shRetBox() {
    var R = SH.ret;
    if (!R) return '<div style="margin-top:14px">' + shBtn('retopen', '↩ ' + ui('Возврат по чеку', 'Баргардонидан бо чек', 'Chek boʻyicha qaytarish'), { sec: true, st: 'width:100%;min-height:44px' }) + '</div>';
    var h = '<div style="margin-top:14px;padding:12px;border:2px solid #1f6fb2;border-radius:12px;display:grid;gap:8px"><b style="font-size:18px">↩ ' + esc(ui('Возврат по чеку', 'Баргардонидан бо чек', 'Chek boʻyicha qaytarish')) + '</b>';
    if (!R.chek) {
      h += '<small>' + esc(ui('Отсканируйте штрихкод на чеке покупателя или введите номер чека (можно последние 6 знаков).', 'Штрихкоди чекро скан кунед ё рақами чекро нависед.', 'Chekdagi shtrix-kodni skanerlang yoki chek raqamini kiriting.')) + '</small>' +
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px">' + shIn('sh-ret-q', ui('Номер чека', 'Рақами чек', 'Chek raqami'), R.q, 'autocomplete="off" autocapitalize="off"') + shScanBtn('ret') + '</div>' +
        (R.err ? '<p style="color:#c0392b;margin:0">' + esc(R.err) + '</p>' : '') +
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('retfind', R.busy ? TX('Загрузка…') : ui('Найти чек', 'Ёфтани чек', 'Chekni topish')) + shBtn('retcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
      return h;
    }
    var C = R.chek, pn = { nal: ui('наличными', 'нақд', 'naqd'), alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: ui('переводом', 'гузаронидан', 'oʻtkazma'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('взял шеф', 'роҳбар гирифт', 'rahbar oldi'), mix: ui('смешанная', 'омехта', 'aralash') };
    h += '<div>' + esc(ui('Чек', 'Чек', 'Chek')) + ' <b>' + esc(C.id) + '</b> · ' + esc(C.date) + ' · ' + esc(pn[C.pay] || C.pay) + (C.who ? ' · ' + esc(C.who) : '') + ' · ' + esc(ui('итого', 'ҳамагӣ', 'jami')) + ' <b>' + esc(money(cents(C.total))) + '</b></div>' +
      '<small>' + esc(ui('Впишите, сколько возвращают. Деньги — по цене продажи из чека.', 'Нависед, чанд бармегардонанд. Пул — бо нархи фурӯш аз чек.', 'Qancha qaytarilishini yozing. Pul — chekdagi sotuv narxida.')) + '</small>';
    h += C.lines.map(function (l, i) {
      var p = { unit: l.unit, per: 0 };
      return '<div style="display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #eee"><div><b>' + esc(l.name) + '</b><br><small>' + esc(money(cents(l.price))) + ' × ' + esc(shQ(p, l.qty)) + (l.returned > 0 ? ' · ' + esc(ui('уже вернули ', 'аллакай баргардонданд ', 'qaytarilgan ')) + esc(shQ(p, l.returned)) : '') + '</small></div>' +
        (l.left > 0 ? '<input class="in2" id="sh-ret-' + i + '" inputmode="decimal" autocomplete="off" placeholder="0 / ' + esc(shNumTxt(l.left)) + '" value="' + esc(R.sel[l.kod] || '') + '" aria-label="' + esc(ui('Сколько вернуть', 'Чанд баргардонидан', 'Qancha qaytarish')) + ': ' + esc(l.name) + '" style="height:48px;font-size:18px;text-align:center">' : '<small style="opacity:.7">' + esc(ui('всё вернули', 'ҳама баргашт', 'hammasi qaytdi')) + '</small>') + '</div>';
    }).join('');
    if (C.pay === 'mix') h += '<b>' + esc(ui('Как вернуть деньги', 'Пулро чӣ тавр баргардонем', 'Pulni qanday qaytarish')) + '</b><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + [['nal', ui('Наличными', 'Нақд', 'Naqd')], ['alif', 'Алиф'], ['dushanbe', 'Душанбе Сити']].map(function (x) { return shBtn('retpay', x[1], { sec: R.pay !== x[0], st: 'min-height:44px;font-size:14px' }, x[0]); }).join('') + '</div>';
    if (C.pay === 'dolg') h += '<small>' + esc(ui('Покупка была в долг: сумма возврата спишется с долга ', 'Харид бо қарз буд: маблағ аз қарзи ', 'Xarid qarzga edi: summa qarzdan ayiriladi: ')) + esc(C.who) + '.</small>';
    h += (R.err ? '<p style="color:#c0392b;margin:0">' + esc(R.err) + '</p>' : '') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('retgo', R.busy ? TX('Загрузка…') : ui('Оформить возврат', 'Сабти баргардонидан', 'Qaytarishni yozish'), { st: 'min-height:52px' }) + shBtn('retcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
    return h;
  }
  function shPrintReceipt() {
    var r = SH.last; if (!r) return; var w = shRw(), d = new Date(r.ts), pn = { nal: ui('наличные', 'нақд', 'naqd'), perevod: ui('перевод', 'гузаронидан', 'oʻtkazma'), alif: 'Алиф', dushanbe: 'Душанбе Сити', mix: ui('смешанная', 'омехта', 'aralash'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('владелец', 'соҳиб', 'egasi') };
    var rows = r.lines.map(function (l) { return '<tr><td colspan="2">' + esc(l.name) + '</td></tr><tr><td>' + esc(shNumTxt(l.qty)) + (l.u && l.u !== 'sht' ? ' ' + esc(shUL(l.u)) : '') + ' × ' + esc(money(l.price)) + '</td><td class="r">' + esc(money(Math.round(l.price * l.qty))) + '</td></tr>'; }).join('');
    var doc = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(ui('Чек', 'Чек', 'Chek')) + '</title><style>@page{size:' + w + 'mm auto;margin:2mm}body{font:' + (w === 80 ? 14 : 12) + 'px monospace;width:' + (w - 6) + 'mm;margin:0;color:#000}h1{font-size:1.2em;text-align:center;margin:0 0 4px}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}.r{text-align:right}hr{border:0;border-top:1px dashed #000;margin:4px 0}.c{text-align:center}</style></head><body><h1>' + esc(ui('Чек', 'Чек', 'Chek')) + '</h1><div class="c">' + esc(d.toLocaleDateString()) + ' ' + esc(d.toLocaleTimeString().slice(0, 5)) + '</div><hr><table>' + rows + '</table><hr><table><tr><td><b>' + esc(ui('Итого', 'Ҳамагӣ', 'Jami')) + '</b></td><td class="r"><b>' + esc(money(r.total)) + '</b></td></tr><tr><td>' + esc(pn[r.pay] || '') + '</td><td class="r">' + (r.pay === 'dolg' ? esc(r.who) : '') + '</td></tr></table><hr>' + (r.id ? '<div class="c">' + esc(ui('Чек №', 'Чек №', 'Chek №')) + ' ' + esc(r.id) + '</div><div class="c" style="margin:3px 0">' + shCode128(String(r.id).slice(-8), w === 80 ? 66 : 48) + '</div><div class="c" style="font-size:.85em">' + esc(ui('Для возврата сохраните чек', 'Барои баргардонидан чекро нигоҳ доред', 'Qaytarish uchun chekni saqlang')) + '</div><hr>' : '') + '<div class="c">' + esc(ui('Спасибо за покупку!', 'Ташаккур барои харид!', 'Xaridingiz uchun rahmat!')) + '</div></body></html>';
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    var dw = f.contentWindow; dw.document.open(); dw.document.write(doc); dw.document.close();
    setTimeout(function () { try { dw.focus(); dw.print(); } catch (e) {} setTimeout(function () { try { f.remove(); } catch (e) {} }, 60000); }, 200);
  }
  function shCartSum() { var c = 0; SH.cart.forEach(function (it) { var p = shProd(it.kod); if (p) c += shLineSum(SH.pay === 'vladelec' ? p.zakup : p.price, it.qty); }); return c; }
  function shAdd(text) {
    var t = String(text || '').trim().toLowerCase(); if (!t || !SH.d) return;
    var all = SH.d.products, hit = all.filter(function (p) { return p.kod.toLowerCase() === t; });
    if (!hit.length) hit = all.filter(function (p) { return shHasBar(p, t); });
    if (!hit.length) hit = all.filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; });
    SH.ok = ''; SH.err = '';
    if (!hit.length) { SH.found = null; SH.err = ui('Товара с таким кодом нет', 'Чунин рамзи мол нест', 'Bunday kodli tovar yoʻq'); return; }
    if (hit.length > 1 && hit[0].kod.toLowerCase() !== t) { SH.found = hit.slice(0, 8); return; }
    SH.found = null; shPut(hit[0].kod);
  }
  function shPut(kod) {
    var p = shProd(kod); if (!p) return;
    var line = null; SH.cart.forEach(function (it) { if (it.kod === kod) line = it; });
    var have = line ? line.qty : 0, step = shStep(p);
    SH.low = have + step > p.qty ? ui('На складе меньше: ', 'Дар анбор камтар аст: ', 'Omborda kamroq: ') + p.name + ' (' + shQ(p, p.qty) + '). ' + ui('Продажа пройдёт, скажите кладовщику оформить приём.', 'Фурӯш мегузарад, ба анбордор бигӯед, ки қабулро расмӣ кунад.', 'Sotuv oʻtadi, ombor mudiriga qabulni rasmiylashtirishni ayting.') : '';
    if (line) line.qty = shQR(shU(p), line.qty + step); else SH.cart.push({ kod: kod, qty: step });
  }
  var SH_PAY = [['nal', 'Наличные', 'Нақд', 'Naqd'], ['alif', 'Алиф', 'Алиф', 'Alif'], ['dushanbe', 'Душанбе Сити', 'Душанбе Сити', 'Dushanbe City'], ['mix', 'Смешанная', 'Омехта', 'Aralash'], ['dolg', 'В долг', 'Қарз', 'Qarzga'], ['vladelec', 'Шеф Шамсуло взял', 'Роҳбар гирифт', 'Rahbar oldi']];
  function shBtn(a, label, extra, k) { return '<button class="btn' + (extra && extra.sec ? ' sec' : '') + '" type="button" data-shop="' + a + '"' + (k != null ? ' data-k="' + esc(k) + '"' : '') + ' style="min-height:48px;font-size:16px' + (extra && extra.st ? ';' + extra.st : '') + '">' + esc(label) + '</button>'; }
  function shIn(id, ph, val, attrs) { return '<input class="in2" id="' + id + '" placeholder="' + esc(ph) + '" value="' + esc(val == null ? '' : val) + '" autocomplete="off" ' + (attrs || '') + ' style="height:48px;font-size:16px">'; }
  function renderShop(el) {
    var st = sellerView(); if (st) SH.tab = KEEPER ? 'prihod' : 'kassa';
    var kl = !!SH.kl && !SELLER && !staffNow(); if (kl) SH.tab = 'prihod';
    var simple = SH.tab === 'kassa', h = st ? '<div style="height:28px"></div>' : backBtn() + (simple ? '' : '<h2 style="padding-right:36px">' + (kl ? '📦 ' + esc(ui('Кладовщик', 'Анбордор', 'Omborchi')) : '🛒 ' + esc(ui('Учёт магазина', 'Ҳисоби мағоза', 'Doʻkon hisobi'))) + '</h2>');
    if (SELLER) {
      var who = ''; try { who = PREVIEW ? ui('Так видит продавец', 'Фурӯшанда чунин мебинад', 'Sotuvchi shunday koʻradi') : (store('ew_sname') || ''); } catch (e) {}
      h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><h2 style="margin:0">' + (KEEPER ? '📦 ' + esc(ui('Приём товара', 'Қабули мол', 'Tovar qabuli')) : '🛒 ' + esc(ui('Продажа', 'Фурӯш', 'Sotuv'))) + '</h2><span style="display:flex;align-items:center;gap:8px"><small>' + esc(who) + '</small>' + shBtn('selout', PREVIEW ? ui('Закрыть', 'Пӯшидан', 'Yopish') : ui('Выйти', 'Баромад', 'Chiqish'), { sec: true, st: 'min-height:40px;font-size:14px;padding:0 12px' }) + '</span></div>';
    }
    if (!SELLER && !staffNow() && kl) h += '<div style="margin:0 0 8px"><div style="display:flex;gap:6px;flex-wrap:wrap">' + shBtn('addst', '👥 ' + ui('Добавить сотрудника', 'Илова кардани корманд', 'Xodim qoʻshish'), { sec: true, st: 'min-height:40px;font-size:14px' }, 'kladovshchik') + shBtn('previewk', '👁 ' + ui('Как видит кладовщик', 'Анбордор чӣ тавр мебинад', 'Omborchi qanday koʻradi'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '</div></div>';
    if (!SELLER && !staffNow() && !kl) h += '<div style="margin:0 0 8px">' + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + shBtn('addst', '👥 ' + ui('Добавить сотрудника', 'Илова кардани корманд', 'Xodim qoʻshish'), { sec: true, st: 'min-height:40px;font-size:14px' }, 'prodavec') + shBtn('preview', '👁 ' + ui('Как видит продавец', 'Фурӯшанда чӣ тавр мебинад', 'Sotuvchi qanday koʻradi'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '</div></div>';
    var tabs = [['kassa', 'Продажа', 'Фурӯш', 'Sotuv'], ['prihod', 'Приём', 'Қабул', 'Qabul'], ['tovar', 'Товары', 'Молҳо', 'Tovarlar'], ['dolg', 'Долги', 'Қарзҳо', 'Qarzlar'], ['zp', 'Зарплата', 'Маош', 'Maosh'], ['anal', 'Анализ', 'Таҳлил', 'Tahlil'], ['otchet', 'Отчёт', 'Ҳисобот', 'Hisobot']];
    if (kl) tabs = [];
    if (!SELLER && !staffNow() && !kl) h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:6px;margin:8px 0">' + tabs.map(function (t) { return shBtn('tab', ui(t[1], t[2], t[3]), { sec: SH.tab !== t[0] }, t[0]); }).join('') + '</div>';
    if (SH.low && SH.tab === 'kassa') h += '<p role="status" id="sh-low" style="margin:8px 0;padding:8px 10px;border-radius:8px;background:#fff4d6;color:#7a5200">' + esc(SH.low) + '</p>';
    if (SH.err) h += '<p class="err" role="alert" id="sh-err">' + esc(SH.err) + '</p>';
    if (SH.ok) h += '<p id="sh-ok" style="background:#e3f6ea;color:#1f6b3d;padding:8px 10px;border-radius:8px">' + esc(SH.ok) + '</p>';
    if (SH.ok && SH.last && SH.tab === 'kassa') { var rw = shRw(); h += '<div style="display:flex;gap:6px;align-items:center;margin:0 0 8px;flex-wrap:wrap">' + shBtn('print', '🖨 ' + ui('Печать чека', 'Чопи чек', 'Chek chop etish'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '<small style="opacity:.7">' + esc(ui('Лента', 'Лента', 'Lenta')) + '</small>' + shBtn('rw', '58', { sec: rw !== 58, st: 'min-height:40px;width:56px;padding:0;font-size:14px' }, 58) + shBtn('rw', '80', { sec: rw !== 80, st: 'min-height:40px;width:56px;padding:0;font-size:14px' }, 80) + '</div>'; }
    if (!SH.d) { el.innerHTML = h + '<p>' + esc(SH.err ? '' : TX('Загрузка…')) + '</p>' + (SH.err ? shBtn('reload', ui('Ещё раз', 'Боз кӯшиш кунед', 'Yana urinib koʻring'), { sec: true }) : ''); return; }
    if (shPolkiOn() && !SH.polki) h += '<div style="margin:0 0 8px">' + shBtn('polki', '🗄 ' + ui('Полки', 'Рафҳо', 'Javonlar'), { sec: true, st: 'width:100%;min-height:44px' }) + '</div>';
    if (shPolkiOn() && SH.polki) { el.innerHTML = h + shPolki(); return; }
    h += SH.tab === 'kassa' ? shStaffKassa() : SH.tab === 'prihod' ? shPrihod() : SH.tab === 'tovar' ? shTovar() : SH.tab === 'dolg' ? shDolg() : SH.tab === 'zp' ? shZp() : SH.tab === 'anal' ? shAnal() : shOtchet();
    el.innerHTML = h;
  }
  // Подсказки по первым цифрам кода; когда код набран целиком, остаётся одна крупная карточка (нажатие добавляет ещё одну штуку).
  // Полка: номер полки пишет кладовщик при приёме; показываем рядом с названием товара.
  // «Полки» (07.11.2026, только Асрор Холов): сервер присылает d.polki = true только его кабинету. Полка у препарата — своя строка: 1, 2, 3 или любое название.
  // Полка кассиру (только Асрор): яркая метка под названием в подсказках поиска.
  function shShelfTag(p) {
    if (!shPolkiOn()) return '';
    var sh = String(p.shelf || '').trim();
    return '<span style="display:inline-block;margin:3px 0;padding:2px 8px;border-radius:8px;font-size:15px;' + (sh ? 'background:#fff4d6;color:#7a5200;font-weight:700' : 'background:#eee;color:#666') + '">📍 ' + esc(sh ? ui('Полка ', 'Раф ', 'Javon ') + sh + ((AP.pn && AP.pn[sh]) ? ' — ' + AP.pn[sh] : '') : ui('Полка не указана', 'Раф нишон дода нашудааст', 'Javon koʻrsatilmagan')) + '</span>';
  }
  /* Кнопка «Полки»: пока список не загрузился, берём запомненный ответ этого кабинета — так кнопка видна сразу, а не после нескольких обновлений */
  function shPolkiKey() { var c = ''; try { c = String(AS_KOD || ''); if (!c) c = (typeof SELLER !== 'undefined' && SELLER) ? 'staff' : String(store('ew_cab') || ''); } catch (e) {} return 'ew_polki_' + c; }
  function shPolkiOn() {
    var k = shPolkiKey();
    try { if (SH.d) { var on = !!SH.d.polki; localStorage.setItem(k, on ? '1' : '0'); return on; } return localStorage.getItem(k) === '1'; } catch (e) { return !!(SH.d && SH.d.polki); }
  }
  function shShelfField(f) {
    if (!shPolkiOn()) return '';
    var cur = f && f.kod ? (shProd(f.kod) || {}).shelf || '' : '';
    return '<label for="sh-f-shelf" style="font-size:15px;font-weight:600">' + esc(ui('Полка (1, 2, 3…)', 'Раф (1, 2, 3…)', 'Javon (1, 2, 3…)')) + '</label>' + shIn('sh-f-shelf', ui('На какой полке лежит', 'Дар кадом раф меистад', 'Qaysi javonda turadi'), f && f.shelf != null ? f.shelf : cur, 'maxlength="20"');
  }
  function shPolkiList() {
    var t = String(SH.pq || '').trim().toLowerCase(), g = {}, n = 0, add = !KEEPER && !SH.kl && (SELLER || SH.tab === 'kassa'); // в кассе нажатие на препарат кладёт его в чек
    ((SH.d && SH.d.products) || []).forEach(function (p) {
      var sh = String(p.shelf || '').trim();
      if (t && p.name.toLowerCase().indexOf(t) < 0 && p.kod.toLowerCase().indexOf(t) < 0 && sh.toLowerCase().indexOf(t) < 0) return;
      (g[sh] = g[sh] || []).push(p); n++;
    });
    var keys = Object.keys(g).sort(function (a, b) { if (!a) return 1; if (!b) return -1; var x = parseFloat(a), y = parseFloat(b); if (!isNaN(x) && !isNaN(y) && x !== y) return x - y; return a.localeCompare(b, 'ru'); });
    if (!keys.length) return '<small>' + esc(ui('Ничего не найдено', 'Чизе ёфт нашуд', 'Hech narsa topilmadi')) + '</small>';
    var left = 300;
    return keys.map(function (k) {
      var arr = g[k].sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); }), shown = arr.slice(0, Math.max(left, 0)); left -= shown.length;
      return '<div style="margin:10px 0 4px;font-weight:700;font-size:17px">' + esc(k ? ui('Полка ', 'Раф ', 'Javon ') + k : ui('Без полки', 'Бе раф', 'Javonsiz')) + ' <small style="font-weight:400;opacity:.7">· ' + arr.length + '</small></div>' +
        shown.map(function (p) {
          var inner = '<b>' + esc(p.name) + '</b> <small style="opacity:.75">' + esc(p.kod) + ' · ' + esc(ui('ост. ', 'бок. ', 'qol. ')) + esc(shQ(p, p.qty)) + (add ? ' · ' + esc(shMoney(p.price)) : '') + '</small>';
          return add ? '<button type="button" class="btn sec" data-shop="polki-put" data-k="' + esc(p.kod) + '" style="display:block;width:100%;height:auto;text-align:left;padding:10px 12px;margin:4px 0;font-size:16px">' + inner + '</button>' : '<div style="padding:6px 0;border-bottom:1px solid #e6e6e6">' + inner + '</div>';
        }).join('') +
        (arr.length > shown.length ? '<small style="opacity:.7">' + esc(ui('Ещё ' + (arr.length - shown.length) + ' — уточните поиск', 'Боз ' + (arr.length - shown.length) + ' — ҷустуҷӯро дақиқ кунед', 'Yana ' + (arr.length - shown.length) + ' — qidiruvni aniqlang')) + '</small>' : '');
    }).join('');
  }
  function shPolki() {
    return '<div style="margin:6px 0 10px;display:grid;gap:8px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h3 style="margin:0">🗄 ' + esc(ui('Полки', 'Рафҳо', 'Javonlar')) + '</h3>' + shBtn('polki-x', ui('Назад', 'Бозгашт', 'Orqaga'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '</div>' +
      shIn('sh-polki-q', ui('Название препарата или номер полки', 'Номи дору ё рақами раф', 'Dori nomi yoki javon raqami'), SH.pq || '', 'inputmode="text" enterkeyhint="done"') + '<div id="sh-polki-list">' + shPolkiList() + '</div></div>';
  }
  // «Поиск препарата» (08.11.2026, только Асрор Холов): «Финансист аптеки» открывает сразу это окно. Набрал название, увидел полку, остаток и цену.
  // Управление (бухгалтерия, учёт магазина, кладовщик) — кнопка внизу окна. Данные те же, что у «Полок»; полку сервер присылает только его кабинету.
  var AP = { pn: {}, pedit: null, fbusy: false, polki: false, pg: null, pq: '', q: '', err: '', kb: null, form: null, msg: '', info: {}, tried: {}, timer: 0 };
  function openApt() { AP.card = false; AP.delAsk = ''; AP.fbusy = false; S.view = 'apt'; S.fromFin = false; AP.polki = false; AP.pq = ''; AP.q = ''; AP.err = ''; AP.form = null; AP.msg = ''; aptN = 0; render(); aptLoad(); }
  var aptRetry = false, aptN = 0;
  /* Быстрое открытие (10.11.2026): список препаратов (название, полка, штрихкоды) запоминается на этом телефоне; при открытии поиск работает сразу из памяти, а свежий список приходит с сервера и заменяет запомненный */
  function aptCKey() { var k = shPolkiKey(); return k === 'ew_polki_' ? '' : k.replace('ew_polki_', 'ew_aptp_'); }
  function aptCRead() { try { var k = aptCKey(); if (!k) return null; var j = JSON.parse(localStorage.getItem(k) || 'null'); if (j && Array.isArray(j.p) && j.p.length && j.t && Date.now() - j.t < 7 * 864e5) return j.p; } catch (e) {} return null; }
  function aptCSave(ps) { try { var k = aptCKey(); if (!k || !Array.isArray(ps) || !ps.length) return; localStorage.setItem(k, JSON.stringify({ t: Date.now(), p: ps.map(function (p) { return { kod: p.kod, name: p.name, shelf: p.shelf || '', bar: p.bar || [] }; }) })); } catch (e) {} }
  function aptLoad() {
    if (!SH.d && !AP.cp) { AP.cp = aptCRead(); if (AP.cp && S.view === 'apt') { var l0 = $s('apt-list'); if (l0) l0.innerHTML = aptList(); } }
    /* Быстрый список (10.11.2026): название, полка, штрихкоды приходят за секунды из памяти сервера — показываем сразу, не дожидаясь полного ответа «magazin» */
    if (!SH.d) callTo('/apteka-spisok', { action: 'list' }).then(function (r) {
      if (!r || !r.ok || !Array.isArray(r.products) || !r.products.length || SH.d || S.view !== 'apt' || AP.form || AP.polki) return;
      AP.cp = r.products; aptCSave(r.products);
      var lf = $s('apt-list'); if (lf) lf.innerHTML = aptList();
    });
    callTo('/magazin', { action: 'list', month: SH.month || today().slice(0, 7) }).then(function (r) {
      if (!r.ok) { AP.err = r.error || TX('не удалось загрузить'); if (!aptRetry && aptN < 6) { aptRetry = true; aptN++; setTimeout(function () { aptRetry = false; if (S.view === 'apt' && !SH.d) aptLoad(); }, 2000); } } else { SH.d = r; AP.cp = null; aptCSave(r.products); AP.err = ''; aptN = 0; }
      if (S.view !== 'apt') return;
      /* Кнопка «Полки» рисуется только когда данные загружены — если окно открылось раньше, перерисовываем */
      if (!AP.err && shPolkiOn() && !AP.form && !AP.polki && !AP.multi && !document.querySelector('[data-apt="polki"]')) { render(); return; }
      var l = $s('apt-list'); if (l && !AP.err) l.innerHTML = aptList(); else render();
    });
    callTo('/polki-imena', { action: 'list' }).then(function (r) { if (r && r.ok && r.names) { AP.pn = r.names; if (S.view === 'apt' && !AP.polki && !AP.form) { var l2 = $s('apt-list'); if (l2 && SH.d) l2.innerHTML = aptList(); } if (S.view === 'apt' && AP.polki && !AP.form && !AP.pedit) { var pl = $s('apt-polki-list'); if (pl) pl.innerHTML = aptPolkiList(); } } });
    // Свой справочник препаратов (полка и описание, которые добавили вручную)
    callTo('/spravochnik', { action: 'list' }).then(function (r) {
      if (r && r.ok) AP.kb = r.items || []; if (S.view !== 'apt' || AP.form) return;
      var l2 = $s('apt-list'); if (l2) l2.innerHTML = aptList();
    });
  }
  function aptKb(name) { var n = String(name || '').trim().toLowerCase(), f = null; (AP.kb || []).forEach(function (k) { if (!f && String(k.name || '').trim().toLowerCase() === n) f = k; }); return f; }
  function aptFind(t) {
    var prods = (SH.d && SH.d.products) || AP.cp || [];
    var r = prods.filter(function (p) { return p.name.toLowerCase().indexOf(t) >= 0 || p.kod.toLowerCase().indexOf(t) === 0 || shHasBar(p, t); }).map(function (p) { var k = aptKb(p.name); return { name: p.name, shelf: String(p.shelf || '').trim() || (k && String(k.polka || '').trim()) || '', text: (k && k.text) || AP.info[String(p.name).trim().toLowerCase()] || '', foto: (k && k.foto) || '', shop: true, kolvo: (k && k.kolvo) || '' }; });
    (AP.kb || []).forEach(function (k) { var nm = String(k.name || ''), l = nm.toLowerCase(); if (l.indexOf(t) < 0) return; if (prods.some(function (p) { return p.name.trim().toLowerCase() === l.trim(); })) return; r.push({ name: nm, shelf: String(k.polka || '').trim(), text: k.text || AP.info[l.trim()] || '', foto: k.foto || '', kolvo: k.kolvo || '' }); });
    /* Сначала препараты с фото/картинкой, потом без; внутри — сначала те, что начинаются с набранного, затем по алфавиту */
    r.sort(function (a, b) { var f = a.foto ? 0 : 1, g = b.foto ? 0 : 1, x = a.name.toLowerCase().indexOf(t) === 0 ? 0 : 1, y = b.name.toLowerCase().indexOf(t) === 0 ? 0 : 1; return f - g || x - y || a.name.localeCompare(b.name, 'ru'); });
    return r;
  }
  // Справка из интернета (через свой сервер, ответ запоминается): спрашиваем у первых трёх найденных препаратов без описания, не чаще раза на название.
  function aptAsk(r) {
    if (AP.timer) clearTimeout(AP.timer);
    var todo = r.slice(0, 3).filter(function (x) { var k = String(x.name).trim().toLowerCase(); return !x.text && !AP.tried[k]; });
    if (!todo.length) return;
    AP.timer = setTimeout(function () {
      todo.forEach(function (x, i) {
        var k = String(x.name).trim().toLowerCase(); if (AP.tried[k]) return; AP.tried[k] = 1;
        setTimeout(function () {
          callTo('/spravochnik', { action: 'info', name: x.name }).then(function (j) {
            if (!j || !j.ok) { delete AP.tried[k]; return; }
            AP.info[k] = String(j.text || '');
            if (S.view === 'apt' && !AP.form && AP.info[k]) { var l = $s('apt-list'); if (l) l.innerHTML = aptList(); }
          });
        }, i * 1200);
      });
    }, 700);
  }
  function aptList() {
    if (!SH.d && !AP.cp) return '<p style="opacity:.7">' + esc(TX('Загрузка…')) + '</p>';
    var t = String(AP.q || '').trim().toLowerCase();
    if (!t) return '<p style="opacity:.7">' + esc(ui('Начните вводить название препарата', 'Номи доруро навишта сар кунед', 'Dori nomini yozishni boshlang')) + '</p>';
    var r = aptFind(t), like = false;
    // Не нашли точно (опечатка или голос услышал чуть иначе): ищем по началу слова, отбрасывая 1–2 последние буквы.
    for (var cut = 1; !r.length && cut <= 2 && t.length - cut >= 4; cut++) { r = aptFind(t.slice(0, t.length - cut)); like = r.length > 0; }
    if (!r.length) return '<p style="margin:8px 0;opacity:.75">' + esc(ui('Такого препарата нет. Проверьте название.', 'Чунин дору нест. Номро санҷед.', 'Bunday dori yoʻq. Nomini tekshiring.')) + '</p>';
    aptAsk(r);
    return (like ? '<p style="margin:8px 0;opacity:.8">' + esc(ui('Точно такого нет. Похожие:', 'Айнан чунин нест. Монанд:', 'Aynan shunday yoʻq. Oʻxshashlari:')) + '</p>' : '') + r.slice(0, 30).map(function (p) {
      var sh = String(p.shelf || '').trim();
      return '<div style="padding:12px 14px;margin:8px 0;border:1px solid #e0e0e0;border-radius:14px;background:#fff;color:#111">' +
        '<div style="display:flex;gap:12px;align-items:flex-start">' + (p.foto ? '<img alt="" data-zoom="1" data-nm="' + esc(p.name) + '" src="' + p.foto + '" style="width:72px;height:72px;object-fit:cover;border-radius:10px;flex:none">' : '') + '<b style="flex:1;min-width:0;font-size:20px;line-height:1.25;white-space:normal">' + esc(p.name) + '</b></div>' +
        '<span style="display:inline-block;margin:6px 0;padding:4px 12px;border-radius:10px;font-size:20px;' + (sh ? 'background:#fff4d6;color:#7a5200;font-weight:700' : 'background:#eee;color:#666;font-size:15px') + '">📍 ' + esc(sh ? ui('Полка ', 'Раф ', 'Javon ') + sh + ((AP.pn && AP.pn[sh]) ? ' — ' + AP.pn[sh] : '') : ui('Полка не указана', 'Раф нишон дода нашудааст', 'Javon koʻrsatilmagan')) + '</span>' + (p.text ? '<p style="margin:4px 0 0;font-size:16px;line-height:1.4;white-space:normal">' + esc(p.text) + '</p><small style="opacity:.6">' + esc(ui('Справочно, не замена совету врача', 'Маълумот барои огоҳӣ, на ивази маслиҳати духтур', 'Maʼlumot uchun, shifokor maslahatini oʻrnini bosmaydi')) + '</small>' : '') + '<div style="margin-top:8px"><button type="button" class="btn sec" data-apt="edit" data-n="' + esc(p.name) + '" style="min-height:36px;font-size:14px;padding:0 12px">✏️ ' + esc(ui('Изменить', 'Тағйир додан', 'Oʻzgartirish')) + '</button></div></div>';
    }).join('') + (r.length > 30 ? '<small style="opacity:.7">' + esc(ui('Показаны первые 30 — уточните название', 'Аввалин 30 нишон дода шуд — номро дақиқ кунед', 'Dastlabki 30 ta koʻrsatildi — nomini aniqlang')) + '</small>' : '');
  }
  // Голосовой ввод названия препарата (распознавание речи самого браузера; на телефоне, планшете и компьютере, где оно есть)
  var APM = null;
  function aptMicOk() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function aptMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (APM) { try { APM.stop(); } catch (e) {} return; }
    var rc = new SR(); APM = rc; AP.err = ''; AP.msg = '';
    rc.lang = 'ru-RU'; rc.interimResults = true; rc.continuous = false; rc.maxAlternatives = 1;
    rc.onresult = function (e) {
      var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      t = t.replace(/[.,!?]+$/, '').trim(); AP.q = t;
      var inp = $s('apt-q'); if (inp) inp.value = t; var l = $s('apt-list'); if (l) l.innerHTML = aptList();
    };
    rc.onerror = function (e) { AP.err = e && (e.error === 'not-allowed' || e.error === 'service-not-allowed') ? ui('Разрешите микрофон для этого сайта в настройках браузера', 'Микрофонро дар танзимоти браузер иҷозат диҳед', 'Brauzer sozlamalarida mikrofonga ruxsat bering') : ui('Не расслышал. Нажмите на микрофон и скажите ещё раз', 'Нашунидам. Микрофонро пахш кунед ва боз бигӯед', 'Eshitmadim. Mikrofonni bosib, yana ayting'); };
    rc.onend = function () { APM = null; if (S.view === 'apt' && !AP.form) render(); };
    try { rc.start(); } catch (e) { APM = null; }
    render();
  }
  // «Полки» в окне «Поиск препарата» (08.11.2026, поручение №658, только Асрор Холов): по номеру полки видно, какие препараты на ней лежат. Цену и остаток не показываем.
  function aptPolkiList() {
    var t = String(AP.pq || '').trim().toLowerCase(), g = {}, seen = {};
    function put(name, shelf) {
      var n = String(name || '').trim(), l = n.toLowerCase(), sh = String(shelf || '').trim(); if (!n || seen[l]) return;
      if (t && l.indexOf(t) < 0 && sh.toLowerCase().indexOf(t) < 0) return;
      seen[l] = 1; (g[sh] = g[sh] || []).push(n);
    }
    ((SH.d && SH.d.products) || []).forEach(function (p) { var k = aptKb(p.name); put(p.name, String(p.shelf || '').trim() || (k && k.polka)); });
    (AP.kb || []).forEach(function (k) { put(k.name, k.polka); });
    var keys = Object.keys(g).sort(function (a, b) { if (!a) return 1; if (!b) return -1; var x = parseFloat(a), y = parseFloat(b); if (!isNaN(x) && !isNaN(y) && x !== y) return x - y; return a.localeCompare(b, 'ru'); });
    if (!keys.length) return '<p style="margin:8px 0;opacity:.75">' + esc(ui('Ничего не найдено', 'Чизе ёфт нашуд', 'Hech narsa topilmadi')) + '</p>';
    // страницы по 20 номеров полок: кнопка 1 = полки 1–20, 2 = 21–40 … минимум 10 кнопок (до 200 полок); «···» = полки без номера
    var PER = 20, shelfNum = function (k) { var m = String(k).match(/\d+/), x = m ? parseInt(m[0], 10) : 0; return x > 0 ? x : 0; }, maxN = 0;
    keys.forEach(function (k) { var x = shelfNum(k); if (x > maxN) maxN = x; });
    var pages = Math.max(10, Math.ceil(maxN / PER)), hasOther = keys.some(function (k) { return !shelfNum(k); }), OTH = pages, searching = !!t;
    var has = {}; keys.forEach(function (k) { var x = shelfNum(k); has[x ? Math.floor((x - 1) / PER) : OTH] = 1; });
    var pg = AP.pg; if (pg == null || pg > pages) { pg = 0; while (pg <= pages && !has[pg]) pg++; if (pg > pages) pg = 0; } AP.pg = pg;
    var pager = '';
    if (!searching) {
      var bt = function (i, lb) { return '<button type="button" class="btn' + (i === pg ? '' : ' sec') + '" data-apt="ppage" data-p="' + i + '" style="min-width:0;width:100%;min-height:44px;font-size:16px;padding:0' + (has[i] ? '' : ';opacity:.4') + '">' + lb + '</button>'; };
      pager = '<div style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px;margin:8px 0">';
      for (var i = 0; i < pages; i++) pager += bt(i, String(i + 1));
      if (hasOther) pager += bt(OTH, '···');
      pager += '</div><small style="display:block;opacity:.7;margin-bottom:4px">' + esc(pg === OTH ? ui('Полки без номера', 'Рафҳои бе рақам', 'Raqamsiz javonlar') : ui('Полки ', 'Рафҳо ', 'Javonlar ') + (pg * PER + 1) + '–' + (pg * PER + PER)) + '</small>';
    }
    var pageKeys = searching ? keys : keys.filter(function (k) { var x = shelfNum(k); return pg === OTH ? !x : x && Math.floor((x - 1) / PER) === pg; }), left = 100000;
    if (!searching && !pageKeys.length) return pager + '<p style="margin:8px 0;opacity:.75">' + esc(ui('На этой странице полок нет', 'Дар ин саҳифа раф нест', 'Bu sahifada javon yoʻq')) + '</p>';
    return pager + pageKeys.map(function (k) {
      var arr = g[k].sort(function (a, b) { return a.localeCompare(b, 'ru'); }), shown = arr.slice(0, Math.max(left, 0)); left -= shown.length;
      if (!shown.length) return '';
      var pnm = k && AP.pn ? AP.pn[k] : '', head;
      if (k && AP.pedit === k) head = '<div style="margin:14px 0 4px;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><input class="in2" id="apt-pn-in" maxlength="80" value="' + esc(pnm || '') + '" placeholder="' + esc(ui('Название полки, например: для пищеварения', 'Номи раф, масалан: барои ҳазм', 'Javon nomi, masalan: hazm uchun')) + '" style="width:100%;height:48px;font-size:17px;box-sizing:border-box"></div><button type="button" class="btn" data-apt="pn-ok" data-k="' + esc(k) + '" style="flex:none;min-height:48px;padding:0 14px">✓</button><button type="button" class="btn sec" data-apt="pn-x" style="flex:none;min-height:48px;padding:0 14px">×</button></div>';
      else head = '<div data-pn="' + esc(k) + '" style="margin:14px 0 4px;font-weight:700;font-size:20px;' + (k ? 'cursor:pointer;user-select:none' : '') + '">📍 ' + esc(k ? ui('Полка ', 'Раф ', 'Javon ') + k : ui('Без полки', 'Бе раф', 'Javonsiz')) + (pnm ? ' — <span style="color:#7a5200">' + esc(pnm) + '</span>' : '') + ' <small style="font-weight:400;opacity:.7">· ' + arr.length + '</small></div>';
      return head +
        shown.map(function (n) { var kf = aptKb(n), ft = kf && kf.foto; return '<div style="display:flex;gap:10px;align-items:center;padding:8px 2px;border-bottom:1px solid #e6e6e6">' + (ft ? '<img alt="" data-zoom="1" data-nm="' + esc(n) + '" src="' + ft + '" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none">' : '<span style="width:56px;height:56px;border-radius:10px;background:#eee;flex:none;display:flex;align-items:center;justify-content:center;font-size:22px">💊</span>') + '<button type="button" data-apt="popen" data-n="' + esc(n) + '" style="flex:1;min-width:0;font:inherit;font-size:18px;line-height:1.3;white-space:normal;text-align:left;background:none;border:0;color:inherit;cursor:pointer;padding:8px 0">' + esc(n) + '</button>' + (kf && !(SH.d && (SH.d.products || []).some(function (pp) { return String(pp.name).trim().toLowerCase() === String(n).trim().toLowerCase(); })) ? (AP.delAsk === n ? '<button type="button" class="btn" data-apt="pdel-yes" data-n="' + esc(n) + '" style="flex:none;min-height:40px;font-size:14px;padding:0 10px;background:#b3261e;color:#fff">' + esc(ui('Да, удалить', 'Бале, нест кардан', 'Ha, oʻchirish')) + '</button><button type="button" class="btn sec" data-apt="pdel-no" style="flex:none;min-height:40px;font-size:14px;padding:0 10px">' + esc(ui('Нет', 'Не', 'Yoʻq')) + '</button>' : '<button type="button" class="btn sec" data-apt="pdel" data-n="' + esc(n) + '" style="flex:none;min-height:40px;font-size:14px;padding:0 10px">🗑 ' + esc(ui('Удалить', 'Нест кардан', 'Oʻchirish')) + '</button>') : '') + '</div>'; }).join('') +
        (arr.length > shown.length ? '<small style="opacity:.7">' + esc(ui('Ещё ' + (arr.length - shown.length) + ' — уточните поиск', 'Боз ' + (arr.length - shown.length) + ' — ҷустуҷӯро дақиқ кунед', 'Yana ' + (arr.length - shown.length) + ' — qidiruvni aniqlang')) + '</small>' : '');
    }).join('') + pager;
  }
  function renderAptPolki(el) {
    try { var dd = el.closest('dialog'); if (dd) dd.classList.add('nox'); } catch (e) {}
    el.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 44px) 4px 24px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-right:36px"><h2 style="margin:0;font-size:26px">🗄 ' + esc(ui('Полки', 'Рафҳо', 'Javonlar')) + '</h2>' +
      '</div>' +
      '<small style="display:block;margin-top:4px;opacity:.7">' + esc(ui('Тапните два раза по полке, чтобы дать ей название', 'Барои ном додан ба раф ду бор зананд', 'Nom berish uchun javonni ikki marta bosing')) + '</small>' +
      '<div style="margin-top:8px">' + shIn('apt-polki-q', ui('Номер полки или название препарата', 'Рақами раф ё номи дору', 'Javon raqami yoki dori nomi'), AP.pq, 'inputmode="text" enterkeyhint="search"') + '</div>' +
      '<div id="apt-polki-list" style="margin-top:6px">' + aptPolkiList() + '</div>' +
      '<div style="position:sticky;bottom:0;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 10px);background:var(--bg,#fff)"><button type="button" class="btn" data-apt="polki-x" style="width:100%;min-height:56px;font-size:19px">← ' + esc(ui('Назад к поиску', 'Бозгашт ба ҷустуҷӯ', 'Qidiruvga qaytish')) + '</button></div></div>';
    setTimeout(function () { var i = $s('apt-polki-q'); if (i && S.view === 'apt' && AP.polki && !AP.form) i.focus(); }, 60);
  }
  /* Фото нескольких препаратов: читаем крупный снимок, потом вырезаем каждую упаковку отдельным маленьким фото */
  function aptMultiRead(file, cb) {
    var rd = new FileReader(); rd.onerror = function () { cb(null); };
    rd.onload = function () {
      var im = new Image(); im.onerror = function () { cb(null); };
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), c = document.createElement('canvas');
        c.width = w; c.height = h; var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        var big = '', qs = [0.65, 0.5, 0.4];
        for (var i = 0; i < qs.length; i++) { big = c.toDataURL('image/jpeg', qs[i]); if (big.length <= 1500000) break; }
        if (big.length > 1500000) return cb(null);
        /* 10.11.2026: отдельное крупное полотно (до 3000 px) — вырезки препаратов с полки берутся из него, а не из уменьшенного для распознавания */
        var k2 = Math.min(1, 3000 / Math.max(im.width, im.height)), hq = document.createElement('canvas');
        hq.width = Math.max(1, Math.round(im.width * k2)); hq.height = Math.max(1, Math.round(im.height * k2));
        var cx2 = hq.getContext('2d'); cx2.fillStyle = '#fff'; cx2.fillRect(0, 0, hq.width, hq.height); cx2.drawImage(im, 0, 0, hq.width, hq.height);
        cb({ big: big, canvas: c, hq: hq });
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function aptCrop(canvas, box) {
    try {
      if (!canvas || !box) return '';
      var W = canvas.width, H = canvas.height, pw = (box[2] - box[0]) * 0.03, ph = (box[3] - box[1]) * 0.03;
      var x1 = Math.max(0, (box[0] - pw) / 1000 * W), y1 = Math.max(0, (box[1] - ph) / 1000 * H), x2 = Math.min(W, (box[2] + pw) / 1000 * W), y2 = Math.min(H, (box[3] + ph) / 1000 * H);
      var cw = x2 - x1, ch = y2 - y1; if (cw < 30 || ch < 30) return '';
      var k = Math.min(1, 240 / Math.max(cw, ch)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cw * k)); c.height = Math.max(1, Math.round(ch * k));
      var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(canvas, x1, y1, cw, ch, 0, 0, c.width, c.height);
      var qs = [0.6, 0.45, 0.35];
      for (var i = 0; i < qs.length; i++) { var o = c.toDataURL('image/jpeg', qs[i]); if (o.length <= 20000) return o; }
    } catch (e) {}
    return '';
  }
  function aptIou(a, b) {
    var x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
    var i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1), u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i;
    return u > 0 ? i / u : 0;
  }
  function aptCropSz(canvas, box, maxSide, pad) {
    try {
      var W = canvas.width, H = canvas.height, pw = (box[2] - box[0]) * pad, ph = (box[3] - box[1]) * pad;
      var x1 = Math.max(0, (box[0] - pw) / 1000 * W), y1 = Math.max(0, (box[1] - ph) / 1000 * H), x2 = Math.min(W, (box[2] + pw) / 1000 * W), y2 = Math.min(H, (box[3] + ph) / 1000 * H);
      var cw = x2 - x1, ch = y2 - y1; if (cw < 30 || ch < 30) return '';
      var k = Math.min(1, maxSide / Math.max(cw, ch)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cw * k)); c.height = Math.max(1, Math.round(ch * k));
      var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(canvas, x1, y1, cw, ch, 0, 0, c.width, c.height);
      var qs = [0.92, 0.86, 0.78, 0.68, 0.55];
      for (var i = 0; i < qs.length; i++) { var o = c.toDataURL('image/jpeg', qs[i]); if (o.length <= 1000000) return o; }
    } catch (e) {}
    return '';
  }
  function aptTiles(canvas) {
    var W = canvas.width, H = canvas.height, cols = W >= H ? 3 : 2, rows = W >= H ? 2 : 3, ov = 0.12, out = [];
    var tw = W / cols, th = H / rows;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var x1 = Math.max(0, c * tw - tw * ov), y1 = Math.max(0, r * th - th * ov), x2 = Math.min(W, (c + 1) * tw + tw * ov), y2 = Math.min(H, (r + 1) * th + th * ov);
      var w = x2 - x1, h = y2 - y1, cv = document.createElement('canvas'); cv.width = Math.round(w); cv.height = Math.round(h);
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(canvas, x1, y1, w, h, 0, 0, cv.width, cv.height);
      out.push({ data: cv.toDataURL('image/jpeg', 0.7), ox: x1, oy: y1, w: w, h: h });
    }
    return out;
  }
  function aptExact(name) { var l = String(name || '').trim().toLowerCase(); return aptFind(l).some(function (x) { return String(x.name || '').trim().toLowerCase() === l; }); }
  function renderAptMulti(el) {
    var m = AP.multi, h = '<div style="max-width:720px;margin:0 auto;padding:8px 4px 24px"><h2 style="padding-right:36px;font-size:24px">📸 ' + esc(ui('Фото нескольких препаратов', 'Акси якчанд дору', 'Bir nechta dori rasmi')) + '</h2>';
    if (m.busy) h += '<p style="font-size:18px;margin:14px 0">⏳ ' + esc(ui('Читаю упаковки… это может занять до минуты', 'Қуттиҳо хонда истодаанд… то як дақиқа мешавад', 'Qadoqlar oʻqilmoqda… bir daqiqagacha ketadi')) + ' <span id="apt-m-prog">' + esc(m.prog || '') + '</span></p>';
    else {
      if (m.err) h += '<p role="alert" style="color:#b3261e">' + esc(m.err) + '</p>';
      var n = 0; (m.items || []).forEach(function (x) { if (x.sel) n++; });
      if ((m.items || []).length) {
        h += '<label style="display:block;margin:10px 0 4px;font-weight:600">' + esc(ui('Полка для всех выбранных', 'Раф барои ҳамаи интихобшудаҳо', 'Tanlanganlar uchun javon')) + '</label>' + shIn('apt-m-polka', ui('Номер или название полки', 'Рақам ё номи раф', 'Javon raqami yoki nomi'), m.polka || '', 'inputmode="text"');
        h += '<p style="margin:10px 0 4px;opacity:.75">' + esc(ui('Нажмите на препарат, чтобы убрать или вернуть его.', 'Барои гирифтан ё баргардонидан ба дору пахш кунед.', 'Olib tashlash yoki qaytarish uchun dori ustiga bosing.')) + '</p>';
        h += m.items.map(function (x, i) {
          return '<button type="button" data-apt="mtoggle" data-i="' + i + '" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;margin:8px 0;padding:10px;border:2px solid ' + (x.sel ? '#1f8a4c' : '#ddd') + ';border-radius:14px;background:' + (x.sel ? '#eefaf2' : '#f5f5f5') + ';color:#111;opacity:' + (x.sel ? 1 : 0.6) + '">' +
            (x.foto ? '<img alt="" src="' + x.foto + '" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex:none">' : '<span style="width:64px;height:64px;border-radius:10px;background:#e8e8e8;flex:none;display:flex;align-items:center;justify-content:center;font-size:26px">💊</span>') +
            '<span style="flex:1;min-width:0;white-space:normal"><b style="font-size:18px">' + esc(x.full) + '</b>' + (x.dup ? '<br><small style="color:#7a5200">' + esc(ui('Уже есть в базе', 'Дар база ҳаст', 'Bazada bor')) + '</small>' : '') + (x.doza ? '' : '<br><small style="opacity:.7">' + esc(ui('Доза не прочиталась', 'Миқдор хонда нашуд', 'Doza oʻqilmadi')) + '</small>') + '</span>' +
            '<span style="flex:none;font-size:24px">' + (x.sel ? '✅' : '⬜') + '</span></button>';
        }).join('');
        h += '<p style="margin:14px 0 0;display:grid;gap:10px"><button type="button" class="btn" data-apt="msave" style="min-height:52px;font-size:18px;width:100%"' + (n ? '' : ' disabled') + '>' + esc(ui('Добавить выбранные', 'Илова кардани интихобшуда', 'Tanlanganlarni qoʻshish')) + ' (' + n + ')</button>';
      } else {
        h += '<p style="font-size:17px;margin:14px 0">' + esc(ui('Препараты не найдены. Снимите ближе и при хорошем свете.', 'Дору ёфт нашуд. Наздиктар ва дар равшанӣ аксбардорӣ кунед.', 'Dori topilmadi. Yaqinroqdan va yorugʻda suratga oling.')) + '</p><p style="margin:14px 0 0;display:grid;gap:10px">';
      }
      h += '<button type="button" class="btn sec" data-apt="multi" style="min-height:48px;font-size:16px;width:100%">📸 ' + esc(ui('Снять ещё раз', 'Боз аксбардорӣ', 'Yana suratga olish')) + '</button><button type="button" class="btn sec" data-apt="mcancel" style="min-height:48px;font-size:16px;width:100%">' + esc(ui('Назад к поиску', 'Бозгашт ба ҷустуҷӯ', 'Qidiruvga qaytish')) + '</button></p>';
    }
    el.innerHTML = h + '<input type="file" id="apt-multi-in" accept="image/*" capture="environment" hidden></div>';
  }
  function renderApt(el) {
    try { var dd2 = el.closest('dialog'); if (dd2) dd2.classList.remove('nox'); } catch (e) {}
    if (AP.form) return renderAptForm(el);
    if (AP.polki) return renderAptPolki(el);
    if (AP.multi) return renderAptMulti(el);
    el.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:8px 4px 24px;' + 'display:flex;flex-direction:column;min-height:calc(100dvh - 110px)' + '"><h2 style="padding-right:36px;font-size:26px">🔍 ' + esc(ui('Поиск препарата', 'Ҷустуҷӯи дору', 'Dori qidirish')) + '</h2>' +
      '<div style="display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0">' + shIn('apt-q', ui('Название препарата', 'Номи дору', 'Dori nomi'), AP.q, 'inputmode="text" enterkeyhint="search"') + '</div>' +
      (aptMicOk() ? '<button type="button" class="btn ' + (APM ? '' : 'sec') + '" data-apt="mic" aria-label="' + esc(ui('Голосовой ввод', 'Воридкунии овозӣ', 'Ovozli kiritish')) + '" style="flex:none;width:56px;height:48px;min-height:48px;font-size:24px;padding:0">' + (APM ? '⏹' : '🎤') + '</button>' : '') + (shPolkiOn() ? '<button type="button" class="btn sec" data-apt="polki" style="flex:none;height:48px;min-height:48px;font-size:17px;padding:0 12px">🗄 ' + esc(ui('Полки', 'Рафҳо', 'Javonlar')) + '</button>' : '') + '</div>' +
      (AP.msg ? '<p role="status" style="color:#1f8a4c;margin:8px 0 0">' + esc(AP.msg) + '</p>' : '') +
      (AP.err ? '<p role="alert" style="color:#b3261e">' + esc(AP.err) + '</p>' : '') +
      ('<p style="margin:10px 0 0"><button type="button" class="btn" data-apt="new" style="min-height:48px;font-size:17px;width:100%">➕ ' + esc(ui('Добавить новый препарат', 'Доруи нав илова кардан', 'Yangi dori qoʻshish')) + '</button></p>') +
      '<input type="file" id="apt-cfoto-in" accept="image/*" capture="environment" hidden>' +
      '<div id="apt-list" style="margin-top:6px">' + aptList() + '</div>' +
      (AP.card ? '<p style="margin-top:auto;padding-top:72px;margin-bottom:0"><button type="button" class="btn sec" data-apt="cback" style="min-height:48px;font-size:17px;width:100%">← ' + esc(ui('Назад', 'Бозгашт', 'Orqaga')) + '</button></p>' : PHARM ? '<p style="margin-top:auto;padding-top:72px;margin-bottom:0;text-align:left"><button type="button" class="btn sec" data-apt="exit-ask" style="min-height:36px;font-size:13px;padding:0 12px;width:auto;opacity:.8">' + esc(ui('Выйти', 'Баромадан', 'Chiqish')) + '</button></p>' + (AP.exitAsk ? '<div role="dialog" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px"><div style="background:Canvas;color:CanvasText;border-radius:16px;padding:20px;max-width:340px;width:100%;text-align:center"><p style="font-size:19px;margin:0 0 16px">' + esc(ui('Вы действительно хотите выйти?', 'Шумо воқеан баромадан мехоҳед?', 'Rostdan ham chiqmoqchimisiz?')) + '</p><div style="display:grid;gap:10px"><button type="button" class="btn" data-shop="selout" style="min-height:48px;font-size:17px">' + esc(ui('Да, выйти', 'Бале, баромадан', 'Ha, chiqish')) + '</button><button type="button" class="btn sec" data-apt="exit-no" style="min-height:48px;font-size:17px">' + esc(ui('Нет, остаться', 'Не, мондан', 'Yoʻq, qolish')) + '</button></div></div></div>' : '') : '<p style="margin-top:auto;padding-top:72px;margin-bottom:0"><button type="button" class="btn sec" data-apt="manage" style="min-height:48px;font-size:16px;width:100%">💼 ' + esc(ui('Финансист: бухгалтерия, касса, кладовщик', 'Мутахассиси молия: ҳисобдорӣ, касса, анбордор', 'Moliyachi: buxgalteriya, kassa, omborchi')) + '</button></p>' + '<p style="margin-top:8px"><button type="button" class="btn sec" data-apt="team" style="min-height:48px;font-size:16px;width:100%">👥 ' + esc(ui('Сотрудники аптеки: добавить', 'Кормандони дорухона: илова', 'Dorixona xodimlari: qoʻshish')) + '</button></p>') + '</div>';
    setTimeout(function () { var i = $s('apt-q'); if (i && S.view === 'apt' && !AP.form && !APM) i.focus(); }, 60);
  }
  // Подсказки в форме «Новый препарат»: пока пишешь название, показываем уже существующие препараты (из базы магазина и из справочника).
  function aptNames(t) {
    t = String(t || '').trim().toLowerCase(); if (!t) return [];
    var seen = {}, out = [];
    function add(n, sh, tx, qt, kq) { var l = String(n || '').trim().toLowerCase(); if (!l || l.indexOf(t) < 0 || seen[l]) return; seen[l] = 1; out.push({ n: String(n).trim(), sh: String(sh || '').trim(), tx: String(tx || ''), qt: qt || (kq ? kq + ' ' + ui('шт', 'дона', 'dona') : ''), kq: kq || '' }); }
    ((SH.d && SH.d.products) || []).forEach(function (p) { var k = aptKb(p.name); var qs = ''; try { qs = shQ(p, p.qty); } catch (e) { qs = String(p.qty); } add(p.name, p.shelf || (k && k.polka), k && k.text, qs, k && k.kolvo); });
    (AP.kb || []).forEach(function (k) { add(k.name, k.polka, k.text, '', k.kolvo); });
    out.sort(function (a, b) { var x = a.n.toLowerCase().indexOf(t) === 0 ? 0 : 1, y = b.n.toLowerCase().indexOf(t) === 0 ? 0 : 1; return x - y || a.n.localeCompare(b.n, 'ru'); });
    return out.slice(0, 8);
  }
  function aptSugHtml(t) {
    var a = aptNames(t); AP.sug = a; if (!a.length) return '';
    return '<small style="display:block;margin:8px 0 4px;opacity:.7">' + esc(ui('Уже есть в базе. Нажмите, чтобы выбрать:', 'Дар база ҳаст. Барои интихоб пахш кунед:', 'Bazada bor. Tanlash uchun bosing:')) + '</small><div style="display:grid;gap:6px">' + a.map(function (x, i) {
      return '<button type="button" class="btn sec" data-apt="pick" data-i="' + i + '" style="text-align:left;height:auto;min-height:44px;padding:8px 12px;white-space:normal;font-size:16px">' + esc(x.n) + (x.sh ? ' <small style="opacity:.75">· ' + esc(ui('полка ', 'раф ', 'javon ') + x.sh) + '</small>' : '') + (x.qt !== '' ? ' <b style="float:right;margin-left:8px;white-space:nowrap">' + esc(ui('ост. ', 'бок. ', 'qol. ') + x.qt) + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }
  // Форма «Добавить новый препарат»: название, полка, описание. Работает на телефоне, планшете и компьютере.
  function renderAptForm(el) {
    try { var dd3 = el.closest('dialog'); if (dd3) dd3.classList.remove('nox'); } catch (e) {}
    var f = AP.form || {};
    el.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:8px 4px 24px"><h2 style="padding-right:36px;font-size:26px">➕ ' + esc(f.old ? ui('Изменить препарат', 'Тағйир додани дору', 'Dorini oʻzgartirish') : ui('Новый препарат', 'Доруи нав', 'Yangi dori')) + '</h2>' +
      '<label style="display:block;margin:10px 0 4px;font-weight:600">' + esc(ui('Название', 'Ном', 'Nomi')) + '</label>' + shIn('apt-f-name', ui('Например: Парацетамол 500 мг', 'Масалан: Парацетамол 500 мг', 'Masalan: Paratsetamol 500 mg'), f.name, 'inputmode="text" enterkeyhint="next"' + (f.old && f.shop ? ' readonly' : '')) + (f.old && f.shop ? '<small style="opacity:.7">' + esc(ui('Название берётся из учёта магазина — здесь его не меняют', 'Ном аз ҳисоби мағоза гирифта мешавад — дар ин ҷо тағйир намеёбад', 'Nom doʻkon hisobidan olinadi — bu yerda oʻzgartirilmaydi')) + '</small>' : '') + '<div style="display:flex;align-items:center;gap:10px;margin-top:8px">' + (f.foto ? '<img alt="" data-zoom="1" data-nm="' + esc(f.old || f.name || '') + '" src="' + f.foto + '" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex:none">' : '') + '<button type="button" class="btn sec" data-apt="foto" ' + (AP.fbusy ? 'disabled ' : '') + 'style="flex:1;min-height:48px;font-size:17px">📷 ' + esc(AP.fbusy ? ui('Читаю название…', 'Ном хонда истодааст…', 'Nomini oʻqiyapman…') : (f.foto ? ui('Переснять фото', 'Аксро аз нав гирифтан', 'Rasmni qayta olish') : ui('Сфотографировать препарат', 'Акси доруро гирифтан', 'Dorini suratga olish'))) + '</button></div><input type="file" id="apt-foto-in" accept="image/*" capture="environment" hidden><div id="apt-f-sug">' + (f.old ? '' : aptSugHtml(f.name)) + '</div>' +
      '<label style="display:block;margin:12px 0 4px;font-weight:600">' + esc(ui('Полка', 'Раф', 'Javon')) + '</label>' + shIn('apt-f-polka', ui('Номер или название полки', 'Рақам ё номи раф', 'Javon raqami yoki nomi'), f.polka, 'inputmode="text" enterkeyhint="next"') +
      '<label style="display:block;margin:12px 0 4px;font-weight:600">' + esc(ui('Сколько штук добавить', 'Чанд дона илова кунед', 'Necha dona qoʻshiladi')) + '</label>' + shIn('apt-f-kolvo', ui('Например: 20', 'Масалан: 20', 'Masalan: 20'), f.kolvo, 'inputmode="decimal" enterkeyhint="next"') +
      '<label style="display:block;margin:12px 0 4px;font-weight:600">' + esc(ui('Описание: для чего препарат', 'Тавсиф: дору барои чӣ', 'Tavsif: dori nima uchun')) + '</label>' +
      '<textarea class="in2" id="apt-f-text" rows="5" maxlength="600" placeholder="' + esc(ui('Коротко: от чего помогает', 'Кӯтоҳ: аз чӣ кӯмак мекунад', 'Qisqacha: nimaga yordam beradi')) + '" style="width:100%;min-height:120px;font-size:16px;padding:10px;box-sizing:border-box">' + esc(f.opisanie || '') + '</textarea>' +
      (AP.err ? '<p role="alert" style="color:#b3261e;margin:8px 0 0">' + esc(AP.err) + '</p>' : '') +
      '<p style="margin:14px 0 0;display:grid;gap:10px"><button type="button" class="btn" data-apt="fsave" style="min-height:52px;font-size:18px;width:100%">' + esc(ui('Сохранить', 'Захира кардан', 'Saqlash')) + '</button>' +
      '<button type="button" class="btn sec" data-apt="fcancel" style="min-height:48px;font-size:16px;width:100%">' + esc(ui('Назад к поиску', 'Бозгашт ба ҷустуҷӯ', 'Qidiruvga qaytish')) + '</button></p></div>';
    setTimeout(function () { var i = $s('apt-f-name'); if (i && AP.form && S.view === 'apt') i.focus(); }, 60);
  }
  function shNm(p) { return String(p.name) + (p.shelf ? ' · ' + ui('полка ', 'раф ', 'javon ') + p.shelf : ''); }
  function shHintsHtml() {
    var D = SH.d, t = String(SH.code || '').trim().toLowerCase(); if (D && !t) return '<span style="opacity:.65">' + esc(ui('Подходящие товары появятся здесь', 'Молҳои мувофиқ дар ин ҷо пайдо мешаванд', 'Mos tovarlar shu yerda chiqadi')) + '</span>'; if (!D || !t) return '';
    var exact = D.products.filter(function (p) { return p.kod.toLowerCase() === t; })[0] || D.products.filter(function (p) { return shHasBar(p, t); })[0];
    if (exact) {
      var line = null; SH.cart.forEach(function (it) { if (it.kod === exact.kod) line = it; });
      return '<button type="button" class="btn sec" data-shop="put" data-k="' + esc(exact.kod) + '" style="display:block;width:100%;height:auto;text-align:left;padding:14px;margin:8px 0">' +
        '<small style="opacity:.75">' + esc(ui('Код ', 'Рамз ', 'Kod ')) + esc(exact.kod) + '</small><br><b style="font-size:20px">' + esc(shPolkiOn() ? exact.name : shNm(exact)) + '</b><br>' + (shPolkiOn() ? shShelfTag(exact) + '<br>' : '') +
        '<span style="font-size:18px">' + esc(shMoney(exact.price)) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy')) + esc(shZa(exact)) + '</span><br>' + (shPer(exact) ? '<small>' + esc(shBoxW(shU(exact), true).replace(/^./, function (c) { return c.toUpperCase(); }) + ' (' + shNumTxt(shPer(exact)) + ' ' + shUL(shU(exact)) + '): ' + shMoney(shR2(exact.price * shPer(exact)))) + '</small><br>' : '') + (shGramLine(exact) ? '<small>' + esc(shGramLine(exact)) + '</small><br>' : '') +
        '<small style="opacity:.75">' + esc(ui('Осталось ', 'Боқимонда ', 'Qoldi ')) + esc(shQ(exact, exact.qty)) + ' · ' + esc(line ? ui('В корзине: ', 'Дар сабад: ', 'Savatda: ') + shQ(exact, line.qty) + '. ' + ui('Нажмите ещё раз, чтобы добавить.', 'Боз пахш кунед, то илова шавад.', 'Yana bossangiz, qoʻshiladi.') : ui('Нажмите на карточку, чтобы добавить.', 'Барои илова кардан ба корт пахш кунед.', 'Qoʻshish uchun kartani bosing.')) + '</small></button>';
    }
    var r = D.products.filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 8);
    if (!r.length) return '<p style="margin:8px 0;opacity:.75">' + esc(ui('Такого кода нет. Проверьте цифры.', 'Чунин рамз нест. Рақамҳоро санҷед.', 'Bunday kod yoʻq. Raqamlarni tekshiring.')) + '</p>';
    return '<div style="display:grid;gap:10px;margin:8px 0">' + r.map(function (p) {
      return '<button type="button" class="btn sec" data-shop="put" data-k="' + esc(p.kod) + '" style="display:flex;align-items:center;gap:12px;width:100%;height:auto;min-height:84px;text-align:left;padding:12px 14px">' + shThumb(p, 60) +
        '<span style="flex:1;min-width:0"><b style="display:block;font-size:19px;line-height:1.25;white-space:normal">' + esc(shPolkiOn() ? p.name : shNm(p)) + '</b>' + shShelfTag(p) + '<small style="opacity:.75">' + esc(p.kod) + ' · ' + esc(ui('ост. ', 'бок. ', 'qol. ')) + esc(shQ(p, p.qty)) + '</small></span>' +
        '<b style="font-size:20px;white-space:nowrap">' + esc(shMoney(p.price)) + '<small style="font-weight:400;font-size:13px">' + esc(shZa(p)) + '</small></b></button>';
    }).join('') + '</div>';
  }
  // Покупатель для долга: список знакомых с их долгом и жёлтое предупреждение, если долг уже большой. Продажу не блокирует.
  function shWhoHtml() {
    var D = SH.d, w = String(SH.who || '').trim().toLowerCase(); if (!D) return '';
    var all = D.debts.filter(function (c) { return !c.owner; });
    var r = all.filter(function (c) { return !w || c.name.toLowerCase().indexOf(w) >= 0; }).slice(0, 5), h = '';
    if (r.length) h += '<div style="display:grid;gap:6px;margin-top:6px">' + r.map(function (c) {
      return shBtn('who', sellerView() ? c.name : c.name + ' · ' + ui('долг ', 'қарз ', 'qarz ') + shMoney(c.sum), { sec: String(SH.who || '').trim().toLowerCase() !== c.name.toLowerCase(), st: 'text-align:left' }, c.name);
    }).join('') + '</div>';
    var cur = all.filter(function (c) { return c.name.toLowerCase() === w; })[0];
    if (cur && (cur.warn || cents(cur.sum) >= SH_DEBT_WARN)) h += '<p role="status" style="margin:8px 0;padding:8px 10px;border-radius:8px;background:#fff4d6;color:#7a5200">' + esc(sellerView() ? ui('У этого покупателя уже большой долг', 'Ин харидор аллакай қарзи калон дорад', 'Bu xaridorning qarzi allaqachon katta') : ui('У этого покупателя уже долг ', 'Ин харидор аллакай қарз дорад: ', 'Bu xaridorning qarzi allaqachon ') + shMoney(cur.sum)) + esc(ui('. Решаете вы.', '. Қарор аз они шумост.', '. Qaror sizniki.')) + '</p>';
    else if (w && !cur) h += '<p style="margin:6px 0"><small>' + esc(ui('Нового покупателя запишем под этим именем.', 'Харидори навро бо ҳамин ном сабт мекунем.', 'Yangi xaridorni shu nom bilan yozamiz.')) + '</small></p>';
    return h;
  }
  // Строка корзины: штучный товар — кнопки − и +; метры и килограммы — поле с количеством (можно 2,5 м) и кнопки по метру или по штуке трубы.
  function shLineTxt(p, price, q) { return esc(shMoney(price)) + esc(shZa(p)) + ' × ' + esc(shQ(p, q)) + ' = ' + esc(money(shLineSum(price, q))); }
  function shQtyRow(p, it) {
    var u = shU(p), per = shPer(p);
    if (u === 'sht') return '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:6px">' + shBtn('minus', '−', { sec: true, st: 'width:48px;padding:0' }, it.kod) + '<b style="min-width:20px;text-align:center">' + it.qty + '</b>' + shBtn('plus', '+', { sec: true, st: 'width:48px;padding:0' }, it.kod) + '</div>';
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">' + shBtn('minus', '−', { sec: true, st: 'width:48px;padding:0' }, it.kod) +
      '<input class="in2" data-cq="' + esc(it.kod) + '" inputmode="decimal" autocomplete="off" value="' + esc(shNumTxt(it.qty)) + '" aria-label="' + esc(ui('Количество, ', 'Миқдор, ', 'Miqdor, ') + shUL(u)) + '" style="width:96px;height:48px;font-size:18px;text-align:center"><b>' + esc(shUL(u)) + '</b>' +
      shBtn('plus', '+', { sec: true, st: 'width:48px;padding:0' }, it.kod) + (u === 'kg' ? '<small style="opacity:.75;flex-basis:100%">' + esc(shGramLine(p) + ' · ' + ui('100 г пишите как 0,1', '100 г-ро 0,1 нависед', '100 g ni 0,1 deb yozing')) + '</small>' : '') + (per ? '<small style="opacity:.75">' + esc(ui('+ кнопка = 1 шт (', '+ тугма = 1 дона (', '+ tugma = 1 dona (') + shNumTxt(per) + ' ' + shUL(u) + ')') + '</small>' : '') + '</div>';
  }
  // Поиск товара по фото: касса не нашла код — продавец фотографирует товар, сервер через ИИ сравнивает снимок со списком товаров.
  function shFotoBig(file, cb) {
    var rd = new FileReader(); rd.onerror = function () { cb(''); };
    rd.onload = function () {
      var im = new Image(); im.onerror = function () { cb(''); };
      im.onload = function () {
        var sizes = [[900, 0.6], [700, 0.5], [500, 0.45]];
        for (var i = 0; i < sizes.length; i++) {
          var k = Math.min(1, sizes[i][0] / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), c = document.createElement('canvas');
          c.width = w; c.height = h; var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
          var out = c.toDataURL('image/jpeg', sizes[i][1]); if (out.length <= 600000) return cb(out);
        }
        cb('');
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  }
  function shFfHtml() {
    var F = SH.ff, h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><b>📷 ' + esc(ui('Поиск по фото', 'Ҷустуҷӯ аз рӯи акс', 'Rasm boʻyicha qidiruv')) + '</b>' + shBtn('ffclose', '×', { sec: true, st: 'width:44px;padding:0;min-height:40px' }) + '</div>';
    if (F.img) h += '<img alt="" src="' + F.img + '" style="display:block;max-width:100%;max-height:160px;border-radius:10px;margin:0 0 8px">';
    if (F.busy) return h + '<p role="status">' + esc(ui('Ищу товар по фото…', 'Молро аз рӯи акс меҷӯям…', 'Tovarni rasm boʻyicha qidiryapman…')) + '</p>';
    if (F.err) return h + '<p class="err" role="alert">' + esc(F.err) + '</p>' + shBtn('ffind', '📷 ' + ui('Сфотографировать ещё раз', 'Боз акс гирифтан', 'Qayta suratga olish'), { sec: true, st: 'width:100%' });
    if (!F.list.length) return h + '<p>' + esc(ui('Похожего товара в списке не нашлось. Введите код вручную или сфотографируйте ещё раз (этикетку или товар крупнее).', 'Моли монанд ёфт нашуд. Рамзро дастӣ ворид кунед ё боз акс гиред.', 'Oʻxshash tovar topilmadi. Kodni qoʻlda kiriting yoki qayta suratga oling.')) + '</p>' + (F.note ? '<p style="opacity:.7"><small>' + esc(F.note) + '</small></p>' : '') + shBtn('ffind', '📷 ' + ui('Сфотографировать ещё раз', 'Боз акс гирифтан', 'Qayta suratga olish'), { sec: true, st: 'width:100%' });
    return h + '<p style="margin:0 0 8px"><small>' + esc(ui('Нажмите на нужный товар — он добавится в корзину.', 'Ба моли лозимӣ пахш кунед — ба сабад илова мешавад.', 'Kerakli tovarni bosing — savatga qoʻshiladi.')) + '</small></p><div style="display:grid;gap:10px">' + F.list.map(function (p) {
      var pp = shProd(p.kod) || p;
      return '<button type="button" class="btn sec" data-shop="put" data-k="' + esc(pp.kod) + '" style="display:flex;align-items:center;gap:12px;width:100%;height:auto;min-height:84px;text-align:left;padding:12px 14px">' + shThumb(pp, 60) +
        '<span style="flex:1;min-width:0"><b style="display:block;font-size:19px;line-height:1.25;white-space:normal">' + esc(pp.name) + '</b><small style="opacity:.75">' + esc(ui('Код ', 'Рамз ', 'Kod ')) + esc(pp.kod) + ' · ' + esc(ui('ост. ', 'бок. ', 'qol. ')) + esc(shQ(pp, pp.qty)) + '</small></span>' +
        (pp.price != null ? '<b style="font-size:20px;white-space:nowrap">' + esc(shMoney(pp.price)) + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function shFfSend(img) {
    var F = SH.ff = { busy: true, list: [], note: '', err: '', img: img }; render();
    callTo('/magazin', { action: 'find_photo', foto: img }).then(function (r) {
      if (SH.ff !== F) return; F.busy = false;
      if (!r || !r.ok) F.err = (r && r.error) || TX('Не удалось'); else { F.list = Array.isArray(r.found) ? r.found : []; F.note = r.note || ''; }
      if (S.view === 'shop') render();
    });
  }
  // Самый простой экран продавца: код, подсказки, корзина, «В долг» и «Оплатить». Больше ничего.
  function shStaffKassa() {
    var D = SH.d, h = '', box = 'border:1px solid #d6d6d6;border-radius:16px;background:#fff;padding:16px';
    var cart = !SH.cart.length ? '<div style="opacity:.6;margin-top:8px">' + esc(ui('Пока пусто', 'Ҳоло холӣ', 'Hozircha boʻsh')) + '</div>' : '<div style="margin-top:6px">' + SH.cart.map(function (it) {
      var p = shProd(it.kod); if (!p) return '';
      return '<div style="padding:8px 0;border-bottom:1px solid #eee"><div style="display:flex;align-items:center;gap:8px">' + shThumb(p) + '<div style="flex:1;min-width:0"><b>' + esc(p.name) + '</b><br><small id="sh-ls-' + esc(it.kod) + '">' + shLineTxt(p, p.price, it.qty) + '</small></div></div>' + shQtyRow(p, it) + '</div>';
    }).join('') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:start">' +
      '<div><div style="display:flex;flex-wrap:wrap;gap:8px"><div style="flex:1 1 220px;display:grid">' + shIn('sh-code', ui('Введите код товара', 'Рамзи молро ворид кунед', 'Tovar kodini kiriting'), SH.code, 'inputmode="text" enterkeyhint="done"') + '</div><div style="flex:1 1 auto;display:grid;grid-template-columns:1fr 1fr;gap:8px">' + shScanBtn('sell') + shBtn('ffind', '📷 ' + ui('По фото', 'Аз рӯи акс', 'Rasm boʻyicha'), { sec: true, st: 'min-height:48px;padding:0 12px' }) + '</div></div>' +
      '<input type="file" id="sh-ff-in" accept="image/*" capture="environment" hidden>' +
      '<div id="sh-hints" style="margin-top:12px;min-height:min(46vh,420px);' + box + '">' + (SH.ff ? shFfHtml() : shHintsHtml()) + '</div></div>' +
      '<div style="' + box + ';display:flex;flex-direction:column;min-height:200px"><div style="opacity:.75">' + esc(ui('Корзина', 'Сабад', 'Savat')) + '</div><div style="flex:1">' + cart + '</div>' +
      '<div id="sh-total" style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #e3e3e3;margin-top:12px;padding-top:10px"><span style="opacity:.75">' + esc(ui('Итого', 'Ҳамагӣ', 'Jami')) + '</span><b style="font-size:30px">' + esc(money(shCartSum())) + ' ' + esc(ui('сом.', 'сом.', 'som')) + '</b></div></div></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-top:16px">' + shBtn('dolgopen', ui('В долг', 'Қарз', 'Qarzga'), { sec: SH.pay !== 'dolg', st: 'height:64px;font-size:20px;font-weight:700' }) + shBtn('paynow', SH.busy ? TX('Загрузка…') : ui('Оплатить', 'Пардохт', 'Toʻlash'), { st: 'height:64px;font-size:20px;font-weight:700;background:#0b0b0b;color:#fff' }) + '</div>';
    if (SH.payPick && SH.pay !== 'dolg') { h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">' + [['nal', 'Наличные', 'Нақд', 'Naqd'], ['alif', 'Алиф', 'Алиф', 'Alif'], ['dushanbe', 'Душанбе Сити', 'Душанбе Сити', 'Dushanbe City'], ['mix', 'Смешанная', 'Омехта', 'Aralash']].map(function (x) { return shBtn(x[0] === 'mix' ? 'pmix' : 'pm', ui(x[1], x[2], x[3]), { sec: SH.pay !== x[0], st: 'height:60px;font-size:18px' }, x[0]); }).join('') + '</div>'; if (SH.pay === 'mix') h += shMixBox() + shBtn('sell', SH.busy ? TX('Загрузка…') : ui('Продать', 'Фурӯхтан', 'Sotish'), { st: 'width:100%;height:56px;margin-top:8px' }); }
    if (SH.pay === 'dolg') h += '<div style="margin-top:12px">' + shIn('shx-who', ui('Кто покупатель (имя)', 'Харидор кист (ном)', 'Xaridor kim (ism)'), SH.who, 'maxlength="40"') + '<div id="sh-whohint">' + shWhoHtml() + '</div>' + shBtn('sell', ui('Записать в долг', 'Ба қарз сабт кардан', 'Qarzga yozish'), { st: 'width:100%;height:56px;margin-top:8px' }) + '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:28px;padding-top:14px;border-top:2px dashed #cfcfcf">' + shBtn('shef', '👑 ' + ui('Шеф Шамсуло взял', 'Сардор Шамсуло гирифт', 'Boshliq Shamsulo oldi'), { sec: true, st: 'min-height:44px;font-size:13px;line-height:1.2;padding:4px 6px;border:2px dashed #b36b00' }) + shBtn('expopen', '💸 ' + ui('Личный расход Маруф и Абду Ташкили', 'Хароҷоти шахсӣ Маруф ва Абду Ташкили', 'Shaxsiy xarajat Maruf va Abdu Tashkili'), { sec: true, st: 'min-height:44px;font-size:13px;line-height:1.2;padding:4px 6px' }) + '</div>';
    h += shBtn('kopen', '💵 ' + ui('Внёс / взял наличные из кассы', 'Ба касса гузошт / аз касса гирифт', 'Kassaga qoʻydi / kassadan oldi'), { sec: true, st: 'width:100%;min-height:44px;font-size:13px;margin-top:8px' });
    h += shRetBox();
    h += shExpBox(true);
    h += shKopBox(true);
    h += shSdBox();
    return h;
  }
  function shKassa() {
    var D = SH.d, h = '';
    /* Касса открывается всегда; при пустом списке товаров — подсказка сверху, чек пустой */
    if (!D.products.length) h += '<p style="opacity:.8;margin:0 0 10px">' + esc(sellerView() ? ui('Товаров пока нет. Скажите владельцу.', 'Ҳоло мол нест. Ба соҳиб гӯед.', 'Hozircha tovar yoʻq. Egasiga ayting.') : ui('Товаров пока нет. Добавьте их во вкладке «Товары».', 'Ҳоло мол нест. Онҳоро дар бахши «Молҳо» илова кунед.', 'Hozircha tovar yoʻq. «Tovarlar» boʻlimida qoʻshing.')) + '</p>';
    h += '<div style="display:grid;grid-template-columns:1fr auto;gap:8px">' + shIn('sh-code', ui('Код товара или название', 'Рамз ё номи мол', 'Tovar kodi yoki nomi'), SH.code, 'inputmode="text" enterkeyhint="done"') + shBtn('add', ui('Добавить', 'Илова', 'Qoʻshish'), { st: 'padding:0 18px' }) + '</div>';
    h += '<div id="sh-hints">' + shHintsHtml() + '</div>';
    if (SH.found) h += '<div style="display:grid;gap:6px;margin:8px 0">' + SH.found.map(function (p) { return shBtn('put', p.kod + ' · ' + p.name + ' · ' + shMoney(p.price), { sec: true, st: 'text-align:left' }, p.kod); }).join('') + '</div>';
    if (!SH.cart.length) h += '<p style="opacity:.75;margin:14px 0">' + esc(ui('Чек пуст. Введите код товара и нажмите «Добавить».', 'Чек холӣ аст. Рамзи молро ворид карда, «Илова»-ро пахш кунед.', 'Chek boʻsh. Tovar kodini kiriting va «Qoʻshish»ni bosing.')) + '</p>';
    else {
      h += '<div style="margin:10px 0">' + SH.cart.map(function (it) {
        var p = shProd(it.kod); if (!p) return ''; var pr = SH.pay === 'vladelec' ? p.zakup : p.price;
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e6e6e6">' + shThumb(p) + '<div style="flex:1;min-width:0"><b>' + esc(p.name) + '</b><br><small>' + esc(p.kod) + ' · ' + esc(shMoney(pr)) + ' × ' + it.qty + ' = ' + esc(money(cents(pr) * it.qty)) + '</small></div>' +
          shBtn('minus', '−', { sec: true, st: 'width:48px;padding:0' }, it.kod) + '<b style="min-width:22px;text-align:center">' + it.qty + '</b>' + shBtn('plus', '+', { sec: true, st: 'width:48px;padding:0' }, it.kod) + shBtn('rm', '×', { sec: true, st: 'width:44px;padding:0' }, it.kod) + '</div>';
      }).join('') + '</div>';
      h += '<div style="font-size:22px;font-weight:700;margin:8px 0" id="sh-total">' + esc(ui('Итого', 'Ҳамагӣ', 'Jami')) + ': ' + esc(money(shCartSum())) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy')) + '</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + SH_PAY.map(function (x) { return shBtn('pay', ui(x[1], x[2], x[3]), { sec: SH.pay !== x[0], st: x[0] === 'vladelec' ? 'border:2px dashed #b36b00' : '' }, x[0]); }).join('') + '</div>';
      if (SH.pay === 'dolg') h += '<div style="margin-top:8px">' + shIn('shx-who', ui('Кто покупатель (имя)', 'Харидор кист (ном)', 'Xaridor kim (ism)'), SH.who, 'maxlength="40"') + '<div id="sh-whohint">' + shWhoHtml() + '</div></div>';
      if (SH.pay === 'mix') h += shMixBox();
      if (SH.pay === 'vladelec') h += '<p style="margin:8px 0"><small>' + esc(ui('Товар, который взял руководитель: спишется со склада по закупочной цене и запишется отдельной строкой «Шеф Шамсуло взял». В выручку не входит. Смотрите вкладку «Долги».', 'Мол аз анбор бо нархи харид хориҷ ва ба номи соҳиб сабт мешавад. Охири моҳ ӯ ҳисоб мекунад: бахши «Қарзҳо».', 'Tovar ombordan xarid narxida chiqariladi va egasiga yoziladi. Oy oxirida u hisob-kitob qiladi: «Qarzlar» boʻlimi.')) + '</small></p>';
      h += '<div style="margin-top:10px">' + shBtn('sell', SH.busy ? TX('Загрузка…') : ui('Продать', 'Фурӯхтан', 'Sotish'), { st: 'width:100%;height:56px;font-size:18px' }) + '</div>';
    }
    h += shRetBox();
    h += shExpBox();
    h += shKopBox();
    h += shSdBox();
    return h;
  }
  // Смешанная оплата: суммы по способам (часть наличными, часть переводом). Сумма частей должна равняться итогу чека.
  function shMixBox() {
    var L = [['nal', ui('Наличными', 'Нақд', 'Naqd')], ['alif', 'Алиф'], ['dushanbe', 'Душанбе Сити']], h = '<div style="margin-top:10px;padding:10px;border:1px solid #d6d6d6;border-radius:12px"><p style="margin:0 0 8px"><small>' + esc(ui('Итого чека: ', 'Ҳамагӣ: ', 'Chek jami: ')) + '<b>' + esc(money(shCartSum())) + '</b> ' + esc(ui('сомони. Впишите, сколько оплатили каждым способом — сумма должна совпасть.', 'сомонӣ. Нависед, бо кадом роҳ чанд пардохт шуд — маблағ бояд мувофиқ шавад.', 'somoniy. Har usul bilan qancha toʻlanganini yozing — summa mos kelishi kerak.')) + '</small></p><div style="display:grid;gap:8px">';
    L.forEach(function (x) { h += shIn('sh-mx-' + x[0], x[1] + ', ' + ui('сомони', 'сомонӣ', 'somoniy'), SH.mx && SH.mx[x[0]] || '', 'inputmode="decimal"'); });
    return h + '</div></div>';
  }
  // Сдача кассы: в конце смены продавец вводит, сколько наличных в кассе; программа сверяет с продажами наличными минус личные расходы.
  // Итог смены по способам оплаты одной строкой: «Наличные 120 · Алиф 40 · В долг 30».
  function shByLine(o) {
    var PL = { nal: ui('Наличные', 'Нақд', 'Naqd'), alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: ui('Перевод', 'Гузаронидан', 'Oʻtkazma'), dolg: ui('В долг', 'Қарз', 'Qarzga') };
    return Object.keys(PL).filter(function (m) { return o && Number(o[m]) > 0; }).map(function (m) { return PL[m] + ' ' + money(cents(o[m])); }).join(' · ');
  }
  function shSdBox() {
    var h = '<div style="margin-top:14px">';
    if (SH.sdRes) { var r = SH.sdRes, ok = Math.abs(r.diff) < 0.005; h += '<div role="status" style="margin:0 0 10px;padding:10px 12px;border-radius:10px;background:' + (ok ? '#e6f6ec' : '#fff4d6') + '"><b>' + esc(ui('Касса сдана', 'Касса супорида шуд', 'Kassa topshirildi')) + '</b><br>' + esc(ui('Должно быть: ', 'Бояд бошад: ', 'Boʻlishi kerak: ')) + esc(money(cents(r.expected))) + '<br>' + esc(ui('Вы сдали: ', 'Шумо супоридед: ', 'Siz topshirdingiz: ')) + esc(money(cents(r.fact))) + '<br><b>' + (ok ? esc(ui('Всё сходится', 'Ҳама мувофиқ', 'Hammasi mos')) : (r.diff < 0 ? esc(ui('Недостача: ', 'Камомад: ', 'Kamomad: ')) : esc(ui('Излишек: ', 'Зиёдатӣ: ', 'Ortiqcha: '))) + esc(money(cents(Math.abs(r.diff)))) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy'))) + '</b>' + (r.vnes || r.vzyal ? '<br><small>' + (r.vnes ? esc(ui('Внесли: ', 'Гузоштанд: ', 'Qoʻyildi: ')) + esc(money(cents(r.vnes))) + ' ' : '') + (r.vzyal ? esc(ui('Взяли: ', 'Гирифтанд: ', 'Olindi: ')) + esc(money(cents(r.vzyal))) : '') + '</small>' : '') + (shByLine(r.by) ? '<br><small>' + esc(ui('Смена: ', 'Смена: ', 'Smena: ')) + esc(shByLine(r.by)) + '</small>' : '') + '</div>'; }
    if (!SH.sdOpen) return h + shBtn('sdopen', '🧾 ' + ui('Сдать кассу', 'Супоридани касса', 'Kassani topshirish'), { sec: true, st: 'width:100%' }) + '</div>';
    h += '<b>' + esc(ui('Сдать кассу', 'Супоридани касса', 'Kassani topshirish')) + '</b><p style="margin:4px 0 8px"><small>' + esc(ui('Пересчитайте наличные в кассе и впишите сумму. Программа сама сравнит с продажами.', 'Пули нақдро ҳисоб карда, маблағро нависед. Барнома худаш муқоиса мекунад.', 'Kassadagi naqd pulni sanab, summani yozing. Dastur oʻzi solishtiradi.')) + '</small></p><div style="display:grid;gap:8px">' + shIn('sh-sd-fact', ui('Наличных в кассе, сомони', 'Пули нақд дар касса, сомонӣ', 'Kassadagi naqd, somoniy'), '', 'inputmode="decimal"') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('sdsave', SH.busy ? TX('Загрузка…') : ui('Сдать', 'Супоридан', 'Topshirish')) + shBtn('sdopen', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div></div>';
    return h;
  }
  // «Личный расход» продавца: взял из кассы на себя — простая запись, не долг; итоги по продавцам видит только руководитель.
  // Внесение и изъятие наличных в смене: размен в кассу или руководитель забрал деньги — при сдаче кассы это не недостача и не излишек.
  function shKopBox(nb) {
    var h = '<div style="margin-top:18px;padding-top:12px;border-top:1px dashed #cfcfcf">';
    if (!SH.kOpen && nb) return '';
    var V = SH.kv || { amt: '', note: '', who: '' };
    if (!SH.kOpen) return h + shBtn('kopen', '💵 ' + ui('Внёс / взял наличные из кассы', 'Ба касса гузошт / аз касса гирифт', 'Kassaga qoʻydi / kassadan oldi'), { sec: true, st: 'width:100%' }) + '</div>';
    h += '<b>' + esc(ui('Наличные в кассе: внесли или взяли', 'Пули нақд дар касса: гузоштанд ё гирифтанд', 'Kassadagi naqd: qoʻyildi yoki olindi')) + '</b><p style="margin:4px 0 8px"><small>' + esc(ui('Например, положили размен или руководитель забрал деньги. При сдаче кассы это учтётся, недостачи не будет.', 'Масалан, майда гузоштанд ё роҳбар пул гирифт. Ҳангоми супоридани касса ба ҳисоб гирифта мешавад.', 'Masalan, mayda pul qoʻyildi yoki rahbar pul oldi. Kassani topshirishda hisobga olinadi.')) + '</small></p>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">' + shBtn('kkind', '➕ ' + ui('Внёс в кассу', 'Ба касса гузошт', 'Kassaga qoʻydi'), { sec: SH.kKind !== 'in' }, 'in') + shBtn('kkind', '➖ ' + ui('Взял из кассы', 'Аз касса гирифт', 'Kassadan oldi'), { sec: SH.kKind !== 'out' }, 'out') + '</div><div style="display:grid;gap:8px">';
    if (!sellerView()) { var nm = ['Маруф', 'Абду']; try { ((SH.d && SH.d.report && SH.d.report.salary) || []).forEach(function (z) { if (z.name && nm.indexOf(z.name) < 0) nm.push(z.name); }); } catch (e) {} h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' + nm.map(function (n) { return shBtn('kchip', n, { sec: true, st: 'min-height:40px;padding:0 16px' }, n); }).join('') + '</div>' + shIn('sh-k-who', ui('Чья касса (имя продавца; пусто — ваша)', 'Кассаи кӣ (номи фурӯшанда; холӣ — аз шумо)', 'Kimning kassasi (boʻsh — sizniki)'), V.who, 'maxlength="40"'); }
    h += shIn('sh-k-amt', ui('Сумма, сомони', 'Маблағ, сомонӣ', 'Summa, somoniy'), V.amt, 'inputmode="decimal"') + shIn('sh-k-note', ui('Пояснение (необязательно)', 'Шарҳ (ихтиёрӣ)', 'Izoh (ixtiyoriy)'), V.note, 'maxlength="60"') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('ksave', SH.busy ? TX('Загрузка…') : ui('Записать', 'Сабт', 'Yozish')) + shBtn('kopen', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div></div>';
    return h;
  }
  function shExpBox(nb) {
    var h = '<div style="margin-top:18px;padding-top:12px;border-top:1px dashed #cfcfcf">';
    if (!SH.expOpen && nb) return '';
    if (!SH.expOpen) return h + shBtn('expopen', '💸 ' + ui('Личный расход', 'Хароҷоти шахсӣ', 'Shaxsiy xarajat'), { sec: true, st: 'width:100%' }) + '</div>';
    h += '<b>' + esc(ui('Личный расход', 'Хароҷоти шахсӣ', 'Shaxsiy xarajat')) + '</b><p style="margin:4px 0 8px"><small>' + esc(ui('Взяли деньги на себя (обед, проезд и т.п.). Это запись, а не долг: руководитель увидит её в отчёте.', 'Пул барои худ гирифта шуд (хӯрок, роҳкиро). Ин сабт аст, на қарз: роҳбар дар ҳисобот мебинад.', 'Oʻzingiz uchun pul oldingiz (ovqat, yoʻl haqi). Bu yozuv, qarz emas: rahbar hisobotda koʻradi.')) + '</small></p><div style="display:grid;gap:8px">';
    if (!sellerView()) { var nm = ['Маруф', 'Абду']; try { ((SH.d && SH.d.report && SH.d.report.salary) || []).forEach(function (z) { if (z.name && nm.indexOf(z.name) < 0) nm.push(z.name); }); } catch (e) {} h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px">' + nm.map(function (n) { return shBtn('echip', n, { sec: true, st: 'min-height:40px;padding:0 16px' }, n); }).join('') + '</div>'; }
    if (!sellerView()) h += shIn('sh-e-who', ui('Чей расход (имя продавца)', 'Хароҷоти кӣ (номи фурӯшанда)', 'Kimning xarajati (sotuvchi ismi)'), '', 'maxlength="40"');
    h += shIn('sh-e-amt', ui('Сумма, сомони', 'Маблағ, сомонӣ', 'Summa, somoniy'), '', 'inputmode="decimal"') + shIn('sh-e-note', ui('На что (необязательно)', 'Барои чӣ (ихтиёрӣ)', 'Nimaga (ixtiyoriy)'), '', 'maxlength="60"') +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('expsave', SH.busy ? TX('Загрузка…') : ui('Записать расход', 'Сабти хароҷот', 'Xarajatni yozish')) + shBtn('expopen', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div></div>';
    return h;
  }

  // Цена продажи и маржа связаны: вписали цену — маржа считается сама (цена хранится ровно такой); вписали маржу — считается цена.
  function shSellFields(f) {
    return '<label for="sh-f-sell" style="font-size:15px;font-weight:600">' + esc(ui('Цена продажи', 'Нархи фурӯш', 'Sotuv narxi')) + '</label>' + shIn('sh-f-sell', ui('Цена продажи', 'Нархи фурӯш', 'Sotuv narxi'), f.sell == null ? '' : f.sell, 'inputmode="decimal"') +
      '<label for="sh-f-marzha" style="font-size:15px;font-weight:600">' + esc(ui('Маржа, %', 'Маржа, %', 'Marja, %')) + '</label>' + shIn('sh-f-marzha', ui('Маржа, %', 'Маржа, %', 'Marja, %'), f.marzha, 'inputmode="decimal"');
  }
  function shSellNote(fsm) { return fsm ? ui('Цена продажи задана вручную: она не изменится при новой закупке, маржа посчитается сама.', 'Нархи фурӯш дастӣ муқаррар шуд: ҳангоми хариди нав тағйир намеёбад.', 'Sotuv narxi qoʻlda belgilandi: yangi xaridda oʻzgarmaydi.') : ui('Впишите цену продажи или маржу — второе посчитается само.', 'Нархи фурӯш ё маржаро нависед — дигараш худ ҳисоб мешавад.', 'Sotuv narxi yoki marjani yozing — ikkinchisi oʻzi hisoblanadi.'); }
  function shR2(x) { return Math.round(Number(x) * 100) / 100; }
  // Поля единицы измерения в форме товара: единица и «сколько в одной штуке» (для труб и рулонов, необязательно).
  function shUnitFields(f) {
    var u = SH_U[f.unit] ? f.unit : 'sht';
    if (objOn()) return '';
    return '<label for="sh-f-unit" style="font-size:15px;font-weight:600">' + esc(ui('Как продаётся (единица)', 'Чӣ тавр фурӯхта мешавад (воҳид)', 'Qanday sotiladi (birlik)')) + '</label><select class="in2" id="sh-f-unit" style="height:48px;font-size:16px">' + SH_UN.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === u ? ' selected' : '') + '>' + esc(ui(x[1], x[2], x[3])) + '</option>'; }).join('') + '</select><small style="opacity:.8">' + esc(ui('Рулон продаёте по метрам — выберите «Метры». Мешок продаёте на вес — выберите «Килограммы». Впишите, сколько метров (кг) в рулоне (мешке), и цену рулона (мешка). Программа сама посчитает цену за метр, за кг и за 100 г, а продавец в кассе пишет метры или кг.', 'Рулон, ки бо метр мефурӯшед: «Метр»-ро интихоб кунед, дар як рулон чанд метр ва нархи рулонро нависед. Барнома нархи як метрро худ ҳисоб мекунад.', 'Metrlab sotiladigan rulon: «Metr»ni tanlang, bir rulonda necha metr va rulon narxini yozing. Dastur bir metr narxini oʻzi hisoblaydi.')) + '</small>' +
      '<div id="sh-f-perbox"' + (u === 'sht' ? ' hidden' : '') + ' style="display:grid;gap:4px"><label for="sh-f-per" style="font-size:15px;font-weight:600" id="sh-f-perl">' + esc(shPerLabel(u)) + '</label>' + shIn('sh-f-per', ui('Например 4', 'Масалан 4', 'Masalan 4'), f.per || '', 'inputmode="decimal"') +
      '<div id="sh-f-rollbox"' + (u === 'm' || u === 'kg' ? '' : ' hidden') + ' style="display:grid;gap:4px"><label for="sh-f-zroll" style="font-size:15px;font-weight:600">' + esc(ui('Закупка за 1 рулон или мешок (необязательно)', 'Харид барои 1 рулон ё халта (ихтиёрӣ)', '1 rulon yoki qop xaridi (ixtiyoriy)')) + '</label>' + shIn('sh-f-zroll', ui('Цена за рулон или мешок', 'Нарх барои рулон ё халта', 'Rulon yoki qop narxi'), f.zroll || '', 'inputmode="decimal"') +
      '<label for="sh-f-sroll" style="font-size:15px;font-weight:600">' + esc(ui('Продажа за 1 рулон или мешок (необязательно)', 'Фурӯш барои 1 рулон ё халта (ихтиёрӣ)', '1 rulon yoki qop sotuvi (ixtiyoriy)')) + '</label>' + shIn('sh-f-sroll', ui('Цена за рулон или мешок', 'Нарх барои рулон ё халта', 'Rulon yoki qop narxi'), f.sroll || '', 'inputmode="decimal"') +
      '<small style="opacity:.75">' + esc(ui('Если заполнить, цена за метр (кг) посчитается сама: цена рулона или мешка ÷ сколько в нём.', 'Агар пур кунед, нархи як метр (кг) худ ҳисоб мешавад.', 'Toʻldirsangiz, bir metr (kg) narxi oʻzi hisoblanadi.')) + '</small></div></div>';
  }
  // Цена за рулон/штуку: кладовщик пишет цену рулона, программа сама считает цену за метр (кг) = цена / сколько в рулоне.
  function shRollNote(u) { return ui('Если заполнить, цену за 1 ' + shUL(u) + ' программа посчитает сама (цена рулона ÷ сколько ' + shUL(u) + ' в рулоне).', 'Агар пур кунед, нархи 1 ' + shUL(u) + '-ро барнома худаш ҳисоб мекунад.', 'Toʻldirsangiz, 1 ' + shUL(u) + ' narxini dastur oʻzi hisoblaydi.'); }
  function shZRoll(p) {
    var u = shU(p), per = shPer(p); if (!per || u === 'sht') return '';
    return '<label for="sh-r-zroll" style="font-size:15px;font-weight:600">' + esc(ui('или цена за 1 ' + shBoxW(u, true) + ' (в нём ', 'ё нархи 1 ' + shBoxW(u, true) + ' (дар он ', 'yoki 1 ' + shBoxW(u, true) + ' narxi (unda ') + shNumTxt(per) + ' ' + shUL(u) + ')') + '</label>' + shIn('sh-r-zroll', ui('Цена за ' + shBoxW(u, true), 'Нарх', 'Narx'), '', 'inputmode="decimal"') + '<small style="opacity:.75">' + esc(shRollNote(u)) + '</small>';
  }
  function shPerLabel(u) { if (u === 'rulon') return ui('Сколько метров в одном рулоне — необязательно (если не нужно, оставьте пустым)', 'Дар як рулон чанд метр — ихтиёрӣ (лозим набошад, холӣ монед)', 'Bir rulonda necha metr — ixtiyoriy (kerak boʻlmasa, boʻsh qoldiring)'); if (u === 'kg') return ui('Сколько кг в одном мешке — необязательно', 'Дар як халта чанд кг — ихтиёрӣ', 'Bir qopda necha kg — ixtiyoriy'); return ui('Сколько ' + shUL(u) + ' в одном рулоне или одной штуке (труба, рулон) — необязательно', 'Дар як рулон ё як дона чанд ' + shUL(u) + ' (қубур, рулон) — ихтиёрӣ', 'Bir rulon yoki bir donada necha ' + shUL(u) + ' (quvur, rulon) — ixtiyoriy'); }
  function shZa1(p) { return ui('за 1 ', 'барои 1 ', '1 ') + shUL(shU(p)) + ui('', '', ' uchun'); }
  // Количество при приёме: в единице товара (метры до сантиметра, килограммы до грамма); если задано «в одной штуке» — можно ввести штуками.
  // Приём в упаковках и штуках (08.11.2026, поручение Нурулло, только Асрор Холов): упаковок × штук в упаковке + отдельные штуки = итого штук. Склад ведётся в штуках. Размер упаковки запоминается на этом устройстве для препарата.
  function shPackOn(p) { return shPolkiOn() && shU(p) === 'sht'; }
  function shPackSum() { var pk = Math.round(shParse(shNum('sh-r-pk')) || 0), ps = Math.round(shParse(shNum('sh-r-pks')) || 0), pc = Math.round(shParse(shNum('sh-r-qty')) || 0); return { pk: pk, ps: ps, pc: pc, total: (pk > 0 && ps > 0 ? pk * ps : 0) + (pc > 0 ? pc : 0) }; }
  function shPackTxt() { var x = shPackSum(); if (!(x.total > 0)) return ''; return ui('Итого: ', 'Ҳамагӣ: ', 'Jami: ') + x.total + ' ' + ui('шт', 'дона', 'dona') + (x.pk > 0 && x.ps > 0 ? ' (' + x.pk + ' ' + ui('уп.', 'бастабандӣ', 'qadoq') + ' × ' + x.ps + (x.pc > 0 ? ' + ' + x.pc : '') + ')' : ''); }
  function shRcvQty(p) {
    var u = shU(p), per = shPer(p), dec = u === 'm' || u === 'kg';
    if (shPackOn(p)) {
      var rem = ''; try { rem = p ? (lstore('ap_pack_' + p.kod) || '') : ''; } catch (e) {}
      return '<label for="sh-r-pk" style="font-size:15px;font-weight:600">' + esc(ui('Сколько упаковок приняли', 'Чанд бастабандӣ қабул кардед', 'Necha qadoq qabul qildingiz')) + '</label>' + shIn('sh-r-pk', ui('Например 3', 'Масалан 3', 'Masalan 3'), '', 'inputmode="numeric"') +
        '<label for="sh-r-pks" style="font-size:15px;font-weight:600">' + esc(ui('Сколько штук в одной упаковке', 'Дар як бастабандӣ чанд дона', 'Bitta qadoqda necha dona')) + '</label>' + shIn('sh-r-pks', ui('Например 10', 'Масалан 10', 'Masalan 10'), rem, 'inputmode="numeric"') +
        '<label for="sh-r-qty" style="font-size:15px;font-weight:600">' + esc(ui('Отдельных штук (без упаковки)', 'Донаҳои ҷудо (бе бастабандӣ)', 'Alohida donalar (qadoqsiz)')) + '</label>' + shIn('sh-r-qty', ui('Например 4', 'Масалан 4', 'Masalan 4'), '', 'inputmode="numeric"') +
        '<div id="sh-r-pktot" style="font-size:17px;font-weight:700;min-height:22px"></div>' +
        '<label for="sh-r-shelf" style="font-size:15px;font-weight:600">' + esc(ui('Номер полки', 'Рақами раф', 'Javon raqami')) + '</label>' + shIn('sh-r-shelf', ui('На какую полку положили', 'Ба кадом раф гузоштед', 'Qaysi javonga qoʻydingiz'), p && p.shelf ? p.shelf : '', 'maxlength="20"');
    }
    var h = '<label for="sh-r-qty" style="font-size:15px;font-weight:600">' + esc(u === 'sht' ? ui('Сколько штук приняли', 'Чанд дона қабул кардед', 'Necha dona qabul qildingiz') : ui('Сколько приняли, ', 'Чанд қабул кардед, ', 'Qancha qabul qildingiz, ') + shUL(u)) + '</label>' + shIn('sh-r-qty', u === 'm' ? ui('Например 12,5', 'Масалан 12,5', 'Masalan 12,5') : u === 'kg' ? ui('Например 2,350', 'Масалан 2,350', 'Masalan 2,350') : ui('Сколько пришло', 'Чанд омад', 'Qancha keldi'), '', 'inputmode="' + (dec ? 'decimal' : 'numeric') + '"');
    if (per) h += '<label for="sh-r-pcs" style="font-size:15px;font-weight:600">' + esc(ui('или штуками (1 шт = ', 'ё бо дона (1 дона = ', 'yoki dona bilan (1 dona = ') + shNumTxt(per) + ' ' + shUL(u) + ')') + '</label>' + shIn('sh-r-pcs', ui('Сколько штук', 'Чанд дона', 'Necha dona'), '', 'inputmode="numeric"');
    // Рулоны: кроме метров/килограммов кладовщик может записать, сколько рулонов и сколько весят (или длина) — необязательно.
    if (u === 'm' || u === 'kg') {
      var fl = 'font-size:15px;font-weight:600';
      h += '<label for="sh-r-rul" style="' + fl + '">' + esc(ui('Сколько ' + shBoxW(u) + ' (необязательно)', 'Чанд ' + shBoxW(u) + ' (ихтиёрӣ)', 'Necha ' + shBoxW(u) + ' (ixtiyoriy)')) + '</label>' + shIn('sh-r-rul', ui('Например 3', 'Масалан 3', 'Masalan 3'), '', 'inputmode="numeric"');
      if (u === 'm') h += '<label for="sh-r-kg" style="' + fl + '">' + esc(ui('Сколько килограммов (необязательно)', 'Чанд килограмм (ихтиёрӣ)', 'Necha kilogramm (ixtiyoriy)')) + '</label>' + shIn('sh-r-kg', ui('Например 45,5', 'Масалан 45,5', 'Masalan 45,5'), '', 'inputmode="decimal"');
      else if (false) h += '<label for="sh-r-m" style="' + fl + '">' + esc(ui('Сколько метров (необязательно)', 'Чанд метр (ихтиёрӣ)', 'Necha metr (ixtiyoriy)')) + '</label>' + shIn('sh-r-m', ui('Например 120', 'Масалан 120', 'Masalan 120'), '', 'inputmode="decimal"');
    }
    h += '<label for="sh-r-shelf" style="font-size:15px;font-weight:600">' + esc(ui('Номер полки', 'Рақами раф', 'Javon raqami')) + '</label>' + shIn('sh-r-shelf', ui('На какую полку положили', 'Ба кадом раф гузоштед', 'Qaysi javonga qoʻydingiz'), p && p.shelf ? p.shelf : '', 'maxlength="20"');
    return h;
  }
  function shDopTxt(x) {
    var a = [];
    if (x && x.rolls > 0) a.push(x.rolls + ' ' + (shU(shProd(x.kod)) === 'kg' ? ui('меш.', 'халта', 'qop') : ui('рул.', 'рулон', 'rulon')));
    if (x && x.kg > 0) a.push(shNumTxt(x.kg) + ' ' + ui('кг', 'кг', 'kg'));
    if (x && x.m > 0) a.push(shNumTxt(x.m) + ' ' + ui('м', 'м', 'm'));
    return a.join(', ');
  }
  // «Приём товара» (кладовщик и руководитель): найти товар по коду или названию, записать приход, завести новый товар. Остаток общий с «Продажей».
  function shPHints() {
    var t = String(SH.pcode || '').trim().toLowerCase();
    if (!t) return '<span style="opacity:.65">' + esc(ui('Введите код или название товара', 'Рамз ё номи молро ворид кунед', 'Tovar kodi yoki nomini kiriting')) + '</span>';
    var r = ((SH.d && SH.d.products) || []).filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 8);
    if (!r.length) return '<small>' + esc(ui('Такого товара нет. Нажмите «Новый товар».', 'Чунин мол нест. «Моли нав»-ро пахш кунед.', 'Bunday tovar yoʻq. «Yangi tovar»ni bosing.')) + '</small>';
    return '<div style="display:grid;gap:6px">' + r.map(function (p) { return shBtn('rcv', p.kod + ' · ' + shNm(p) + ' · ' + ui('ост. ', 'бок. ', 'qol. ') + shQ(p, p.qty) + ' · ' + ui('себестоимость ', 'арзиши аслӣ ', 'tannarx ') + shMoney(p.zakup) + shZa(p), { sec: true, st: 'text-align:left' }, p.kod); }).join('') + '</div>';
  }
  // Привязка заводского штрихкода к товару: код из сканера → товар, который выбрал кладовщик.
  function shBind(kod, code) {
    var p = shProd(kod); if (!p) return;
    shAct({ action: 'list', bind_barcode: { kod: kod, code: code, id: oid() } }, ui('Штрихкод привязан', 'Штрихкод пайваст шуд', 'Shtrix-kod bogʻlandi') + ': ' + code + ' → ' + p.name, function () { SH.bind = null; });
  }
  function shBindHints() {
    var B = SH.bind, t = String(B && B.q || '').trim().toLowerCase();
    if (!t) return '<small style="opacity:.75">' + esc(ui('Введите код магазина или название товара', 'Рамзи мағоза ё номи молро нависед', 'Doʻkon kodi yoki tovar nomini yozing')) + '</small>';
    var r = ((SH.d && SH.d.products) || []).filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 8);
    if (!r.length) return '<small>' + esc(ui('Такого товара нет — заведите новый с этим штрихкодом.', 'Чунин мол нест — бо ҳамин штрихкод моли нав ворид кунед.', 'Bunday tovar yoʻq — shu shtrix-kod bilan yangi tovar kiriting.')) + '</small>';
    return '<div style="display:grid;gap:6px">' + r.map(function (p) { return shBtn('bind', p.kod + ' · ' + p.name, { sec: true, st: 'text-align:left' }, p.kod); }).join('') + '</div>';
  }
  function shBindBox() {
    var B = SH.bind, okKod = /^[a-zA-Z0-9_-]{1,20}$/.test(B.code);
    return '<div style="display:grid;gap:8px;margin:8px 0;padding:12px;border:2px solid #b7860b;border-radius:10px"><b style="font-size:17px">' + esc(ui('Штрихкод', 'Штрихкод', 'Shtrix-kod')) + ' «' + esc(B.code) + '» ' + esc(ui('ещё не привязан', 'ҳанӯз пайваст нест', 'hali bogʻlanmagan')) + '</b>' +
      '<small>' + esc(ui('Какой это товар? Найдите его и нажмите — штрихкод привяжется, и касса будет находить товар по нему.', 'Ин кадом мол аст? Онро ёбед ва пахш кунед — штрихкод пайваст мешавад.', 'Bu qaysi tovar? Uni toping va bosing — shtrix-kod bogʻlanadi.')) + '</small>' +
      shIn('sh-b-q', ui('Код магазина или название', 'Рамз ё ном', 'Kod yoki nom'), B.q) + '<div id="sh-bhints">' + shBindHints() + '</div>' +
      '<div style="display:grid;grid-template-columns:' + (okKod ? '2fr ' : '') + '1fr;gap:8px">' + (okKod ? shBtn('bnew', '＋ ' + ui('Новый товар с этим кодом', 'Моли нав бо ин рамз', 'Shu kod bilan yangi tovar'), { sec: true }) : '') + shBtn('bcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
  }
  function shBarsHtml(p) {
    if (!p) return '';
    var bars = Array.isArray(p.bar) ? p.bar : [];
    return '<div style="font-size:15px"><b>' + esc(ui('Штрихкоды', 'Штрихкодҳо', 'Shtrix-kodlar')) + ':</b> ' + (bars.length ? bars.map(function (b) { return esc(b) + ' <button type="button" data-shop="unbind" data-k="' + esc(b) + '" aria-label="' + esc(ui('Отвязать', 'Ҷудо кардан', 'Ajratish')) + ' ' + esc(b) + '" style="border:0;background:none;color:#c0392b;cursor:pointer;font:inherit">✕</button>'; }).join(' · ') : '<span style="opacity:.7">' + esc(ui('не привязаны', 'пайваст нестанд', 'bogʻlanmagan')) + '</span>') + '</div>' +
      shBtn('scan', '📷 ' + ui('Привязать заводской штрихкод', 'Пайваст кардани штрихкоди заводӣ', 'Zavod shtrix-kodini bogʻlash'), { sec: true, st: 'min-height:44px' }, 'bindto');
  }
  // Поставщик и оплата при приёме (№223, №224): наличными / переводом / в долг. В долг — поставщик попадает в «Кому должен магазин».
  function shPostPayName(p) { return p === 'nal' ? ui('оплачено наличными', 'нақд пардохт шуд', 'naqd toʻlandi') : p === 'perevod' ? ui('оплачено переводом', 'бо интиқол пардохт шуд', 'oʻtkazma bilan toʻlandi') : p === 'dolg' ? ui('в долг у поставщика', 'қарз аз таъминкунанда', 'taʼminotchidan qarzga') : ''; }
  // Список поставщиков, который открывается по нажатию на строку «Поставщик» при приёме. Основной список заполняет хозяин (впишите сюда имена),
  // дальше идут поставщики, которых уже вводили раньше.
  var SH_SUPPLIERS = [];
  document.addEventListener('click', function (e) { var t = e.target; if (t && t.id === 'sh-r-post' && typeof t.showPicker === 'function') { try { t.showPicker(); } catch (x) {} } });
  document.addEventListener('focusin', function (e) { var t = e.target; if (t && t.id === 'sh-r-post' && typeof t.showPicker === 'function') { try { t.showPicker(); } catch (x) {} } });
  function shPostNames() {
    var n = [], add = function (x) { x = String(x || '').trim(); if (x && n.indexOf(x) < 0) n.push(x); };
    SH_SUPPLIERS.forEach(add);
    try { ((SH.d && SH.d.report && SH.d.report.postDebts) || []).forEach(function (c) { add(c.name); }); ((SH.d && SH.d.receipts) || []).forEach(function (r) { add(r.post); }); } catch (e) {}
    return n.slice(0, 60);
  }
  function shPostFields() {
    return '<label for="sh-r-post" style="font-size:15px;font-weight:600">' + esc(ui('Поставщик (необязательно)', 'Таъминкунанда (ихтиёрӣ)', 'Taʼminotchi (ixtiyoriy)')) + '</label>' + shIn('sh-r-post', ui('Имя или магазин поставщика', 'Ном ё мағозаи таъминкунанда', 'Taʼminotchi nomi'), '', 'maxlength="40" list="sh-posts"') +
      '<datalist id="sh-posts">' + shPostNames().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<label for="sh-r-pay" style="font-size:15px;font-weight:600">' + esc(ui('Как заплатили поставщику', 'Ба таъминкунанда чӣ тавр пардохтанд', 'Taʼminotchiga qanday toʻlandi')) + '</label><select id="sh-r-pay" class="in2" style="height:48px;font-size:16px"><option value="">' + esc(ui('— не отмечать —', '— қайд накардан —', '— belgilamaslik —')) + '</option><option value="nal">' + esc(ui('Наличными', 'Нақд', 'Naqd')) + '</option><option value="perevod">' + esc(ui('Переводом', 'Интиқол', 'Oʻtkazma')) + '</option><option value="dolg">' + esc(ui('В долг (заплатим потом)', 'Қарз (баъд пардохт мекунем)', 'Qarzga (keyin toʻlaymiz)')) + '</option></select>';
  }
  // Подсказки названий при добавлении товара: список товаров, которые уже продаются (из прайса). Выбор подставляет название в строку.
  function shNamesList() { var P = (SH.d && SH.d.products) || [], seen = {}, o = ''; P.forEach(function (p) { if (p && p.name && !seen[p.name]) { seen[p.name] = 1; o += '<option value="' + esc(p.name) + '">'; } }); return '<datalist id="sh-names">' + o + '</datalist>'; }
  function shPrihod() {
    if (SH.cnt && SH.cnt.open) return shCnt();
    var D = SH.d, h = '', f = SH.form;
    if (SH.bind && !f) h += shBindBox();
    if (f) {
      h += '<form data-shopform="save" style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(ui('Новый товар', 'Моли нав', 'Yangi tovar')) + '</b>' +
        shIn('sh-f-kod', ui('Код товара (буквы и цифры)', 'Рамзи мол (ҳарф ва рақам)', 'Tovar kodi (harf va raqam)'), f.kod, 'maxlength="20"') +
        shIn('sh-f-name', ui('Название', 'Ном', 'Nomi'), f.name, 'maxlength="60" list="sh-names"') + shNamesList() + shShelfField(f) +
        shIn('sh-f-zakup', ui('Закупочная цена', 'Нархи харид', 'Xarid narxi'), f.zakup, 'inputmode="decimal"') + shSellFields(f) + shUnitFields(f) +
        shFotoBox('<div style="display:flex;gap:8px;align-items:center">' + (SH.fotoNew ? '<img alt="" src="' + SH.fotoNew + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px">' : '') + shBtn('foto', '📷 ' + (SH.fotoNew ? ui('Переснять', 'Аз нав гирифтан', 'Qayta olish') : ui('Фото товара', 'Акси мол', 'Tovar surati')), { sec: true, st: 'min-height:44px' }, 'new') + '</div>') +
        '<div id="sh-f-price" style="font-size:15px;opacity:.8">' + esc(shSellNote(f.fsm)) + '</div><div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('save', ui('Сохранить', 'Захира', 'Saqlash')) + shBtn('fcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></form>';
    } else if (SH.rcv) {
      var cur = shProd(SH.rcv.kod);
      // Порядок (07.11.2026): название → сколько штук → полка, дальше необязательное: цена, поставщик, оплата, фото, штрихкод.
      h += '<div style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b style="font-size:18px">' + esc(ui('Приём товара', 'Қабули мол', 'Tovar qabuli')) + ': ' + esc(cur ? shNm(cur) : SH.rcv.kod) + ' <small>(' + esc(SH.rcv.kod) + ')</small></b>' + (cur ? '<small>' + esc(ui('Сейчас на складе: ', 'Ҳоло дар анбор: ', 'Hozir omborda: ')) + esc(shQ(cur, cur.qty)) + '</small>' : '') + shRcvQty(cur) +
        '<div style="margin-top:6px;padding-top:8px;border-top:1px solid #e6e6e6;font-size:15px;opacity:.8">' + esc(ui('Дальше — по желанию', 'Минбаъд — ихтиёрӣ', 'Keyingisi — xohishga koʻra')) + '</div>' +
        '<div style="font-size:17px">' + esc(ui('Себестоимость сейчас', 'Арзиши аслии ҳозира', 'Joriy tannarx')) + ': <b>' + esc(cur ? shMoney(cur.zakup) : '') + '</b> ' + esc(shZa1(cur)) + '</div>' + (cur && shRollLine(cur) ? '<div style="font-size:16px"><b>' + esc(shRollLine(cur)) + '</b></div>' : '') +
        '<label for="sh-r-zakup" style="font-size:15px;font-weight:600">' + esc(ui('Цена, по которой приняли', 'Нархе, ки қабул кардед', 'Qabul qilingan narx')) + ' (' + esc(shZa1(cur)) + ')</label>' + shIn('sh-r-zakup', ui('Цена приёма', 'Нархи қабул', 'Qabul narxi'), cur ? cur.zakup : '', 'inputmode="decimal"') + shZRoll(cur) + '<div id="sh-r-prev" style="font-size:15px;opacity:.85"></div>' + shPostFields() +
        shFotoBox('<div style="display:flex;gap:8px;align-items:center">' + shThumb(cur, 56) + shBtn('foto', '📷 ' + (cur && cur.foto ? ui('Переснять', 'Аз нав гирифтан', 'Qayta olish') : ui('Фото товара', 'Акси мол', 'Tovar surati')), { sec: true, st: 'min-height:44px' }, 'rcv') + '</div>') + shBarsHtml(cur) +
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('rok', ui('Записать приход', 'Сабти воридот', 'Kirimni yozish')) + shBtn('rcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
    } else {
      h += '<h3 style="margin:4px 0 8px">' + esc(ui('Приём товара', 'Қабули мол', 'Tovar qabuli')) + '</h3><p style="margin:0 0 8px;opacity:.8"><small>' + esc(ui('1) Введите код или название товара и выберите его. 2) Укажите, сколько приняли (штук, метров, килограммов — как у товара) и по какой цене.', '1) Рамз ё номи молро ворид карда, интихоб кунед. 2) Чанд (дона, метр, килограмм) ва бо кадом нарх қабул кардаед нависед.', '1) Tovar kodi yoki nomini kiriting va tanlang. 2) Qancha (dona, metr, kilogramm) va qaysi narxda qabul qilganingizni yozing.')) + '</small></p><div><div style="display:grid;grid-template-columns:1fr auto;gap:8px">' + shIn('sh-pcode', ui('Код или название товара', 'Рамз ё номи мол', 'Tovar kodi yoki nomi'), SH.pcode, 'inputmode="text" enterkeyhint="done"') + shScanBtn('recv') + '</div>' + '<div id="sh-phints" style="margin-top:10px;min-height:48px">' + shPHints() + '</div></div>' +
        shBtn('fnew', '＋ ' + ui('Новый товар', 'Моли нав', 'Yangi tovar'), { sec: true, st: 'width:100%;margin:10px 0' }) + shBtn('copen', '📋 ' + ui('Пересчёт товара', 'Ҳисобкунии мол', 'Tovarni qayta sanash'), { sec: true, st: 'width:100%;margin:0 0 10px' });
    }
    var rc = (D && D.receipts) || [];
    h += '<h3 style="margin-top:14px">' + esc(ui('Последние приёмы', 'Қабулҳои охирин', 'Oxirgi qabullar')) + '</h3>';
    if (!rc.length) return h + '<p style="opacity:.75">' + esc(ui('Приёмов пока нет.', 'Ҳоло қабул нест.', 'Hozircha qabul yoʻq.')) + '</p>';
    return h + rc.slice(0, 15).map(function (x) {
      return '<div style="padding:8px 0;border-bottom:1px solid #e6e6e6"><b>' + esc(shNm({ name: x.name, shelf: (shProd(x.kod) || {}).shelf })) + '</b> <span style="color:' + (x.qty < 0 ? '#c0392b' : '#1f8a4c') + '">' + (x.qty > 0 ? '+' : '') + esc(shQ(shProd(x.kod), x.qty)) + '</span><br><small>' + esc(x.date) + (x.who ? ' · ' + esc(x.who) : '') + (shDopTxt(x) ? ' · ' + esc(shDopTxt(x)) : '') + (x.fix ? ' · ' + esc(ui('поправка', 'ислоҳ', 'tuzatish')) : '') + (x.post ? ' · ' + esc(x.post) : '') + (x.pay ? ' · ' + esc(shPostPayName(x.pay)) : '') + '</small></div>';
    }).join('');
  }
  function shTovar() {
    var D = SH.d, h = '', f = SH.form;
    if (f) {
      h += '<form data-shopform="save" style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(f.edit ? ui('Изменить товар', 'Тағйири мол', 'Tovarni oʻzgartirish') : ui('Новый товар', 'Моли нав', 'Yangi tovar')) + '</b>' +
        shIn('sh-f-kod', ui('Код товара (буквы и цифры)', 'Рамзи мол (ҳарф ва рақам)', 'Tovar kodi (harf va raqam)'), f.kod, (f.edit ? 'readonly ' : '') + 'maxlength="20"') +
        shIn('sh-f-name', ui('Название', 'Ном', 'Nomi'), f.name, 'maxlength="60" list="sh-names"') + shNamesList() + shShelfField(f) +
        shIn('sh-f-zakup', ui('Закупочная цена', 'Нархи харид', 'Xarid narxi'), f.zakup, 'inputmode="decimal"') + shSellFields(f) + shUnitFields(f) +
        shFotoBox('<div style="display:flex;gap:8px;align-items:center">' + (SH.fotoNew ? '<img alt="" src="' + SH.fotoNew + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px">' : '') + shBtn('foto', '📷 ' + (SH.fotoNew ? ui('Переснять', 'Аз нав гирифтан', 'Qayta olish') : ui('Фото товара', 'Акси мол', 'Tovar surati')), { sec: true, st: 'min-height:44px' }, 'new') + '</div>') +
        '<div id="sh-f-price" style="font-size:15px;opacity:.8">' + esc(shSellNote(f.fsm)) + '</div><div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('save', ui('Сохранить', 'Захира', 'Saqlash')) + shBtn('fcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></form>';
    } else h += shBtn('fnew', '＋ ' + ui('Добавить товар', 'Илова кардани мол', 'Tovar qoʻshish'), { sec: true, st: 'width:100%;margin:8px 0' });
    if (SH.rcv) h += '<div style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(ui('Приход товара', 'Воридоти мол', 'Tovar kirimi')) + ': ' + esc(SH.rcv.name) + '</b>' + shRcvQty(shProd(SH.rcv.kod)) + '<label for="sh-r-zakup" style="font-size:15px;font-weight:600">' + esc(ui('Цена, по которой приняли', 'Нархе, ки қабул кардед', 'Qabul qilingan narx')) + ' (' + esc(shZa1(shProd(SH.rcv.kod))) + ')</label>' + shIn('sh-r-zakup', ui('Цена приёма', 'Нархи қабул', 'Qabul narxi'), (shProd(SH.rcv.kod) || {}).zakup || '', 'inputmode="decimal"') + shZRoll(shProd(SH.rcv.kod)) + '<div id="sh-r-prev" style="font-size:15px;opacity:.85"></div>' + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('rok', ui('Записать приход', 'Сабти воридот', 'Kirimni yozish')) + shBtn('rcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
    if (!D.products.length) return h + '<p>' + esc(ui('Товаров пока нет.', 'Ҳоло мол нест.', 'Hozircha tovar yoʻq.')) + '</p>';
    h += D.products.map(function (p) {
      var ask = SH.delAsk === p.kod;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(shNm(p)) + '</b><span style="white-space:nowrap">' + esc(shMoney(p.price)) + esc(shZa(p)) + '</span></div><small>' + esc(p.kod) + ' · ' + esc(ui('закупка', 'харид', 'xarid')) + ' ' + esc(shMoney(p.zakup)) + (Number(p.sell) > 0 ? ' · ' + esc(ui('цена задана', 'нарх муқаррар', 'narx belgilangan')) + ' (' + esc(shNumTxt(p.marzha)) + '%)' : ' + ' + esc(String(p.marzha)) + '%') + ' · <b style="' + (p.qty <= 2 ? 'color:#c0392b' : '') + '">' + esc(ui('остаток', 'боқимонда', 'qoldiq')) + ' ' + esc(shQ(p, p.qty)) + '</b></small>' +
        (shRollLine(p) ? '<div style="margin-top:4px;font-size:15px"><b>' + esc(shRollLine(p)) + '</b></div>' : '') + '<div style="display:flex;gap:6px;margin-top:6px">' + shBtn('rcv', ui('Приход', 'Воридот', 'Kirim'), { sec: true, st: 'flex:1' }, p.kod) + shBtn('fedit', ui('Изменить', 'Тағйир', 'Oʻzgartirish'), { sec: true, st: 'flex:1' }, p.kod) + shBtn('pdel', ask ? ui('Удалить?', 'Нест кунем?', 'Oʻchiraymi?') : '×', { sec: true, st: 'width:56px;padding:0' + (ask ? ';background:#c0392b;color:#fff' : '') }, p.kod) + '</div></div>';
    }).join('');
    return h;
  }
  // «Анализ» (руководитель): прибыль по товарам, залежавшийся товар, подсказка для заказа, подтверждение пересчёта. Данные считает сервер (действия stats, minset, inv_list, inv_ok, inv_no).
  function anState() { return SH.an || (SH.an = { sec: 'profit', days: 30, data: null, busy: false, err: '', inv: null, msg: '' }); }
  function anLoad() {
    var A = anState(); A.busy = true; A.err = '';
    var p = A.sec === 'inv' ? callTo('/magazin', { action: 'inv_list' }) : callTo('/magazin', { action: 'stats', days: A.days });
    p.then(function (r) { A.busy = false; if (!r || !r.ok) A.err = (r && r.error) || TX('Не удалось загрузить'); else if (A.sec === 'inv') A.inv = r.inv; else A.data = r.stats; if (S.view === 'shop') render(); });
    render();
  }
  function anRow(l, r, neg) { return '<div style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #e6e6e6"><span style="min-width:0">' + l + '</span><span style="text-align:right;white-space:nowrap;' + (neg ? 'color:#c0392b' : '') + '">' + r + '</span></div>'; }
  function shAnal() {
    var A = anState(), h = '', T3 = [['profit', 'Прибыль', 'Фоида', 'Foyda'], ['stale', 'Залежался', 'Мондашуда', 'Eskirgan'], ['order', 'Заказать', 'Фармоиш', 'Buyurtma'], ['inv', 'Пересчёт', 'Ҳисобкунӣ', 'Qayta sanash']];
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin:6px 0">' + T3.map(function (t) { return shBtn('ansec', ui(t[1], t[2], t[3]), { sec: A.sec !== t[0] }, t[0]); }).join('') + '</div>';
    if (A.sec !== 'inv') h += '<div style="display:flex;gap:6px;align-items:center;margin:6px 0"><small>' + esc(ui('За период:', 'Давра:', 'Davr:')) + '</small>' + [7, 30, 90].map(function (d) { return shBtn('andays', d + ' ' + ui('дн.', 'рӯз', 'kun'), { sec: A.days !== d, st: 'min-height:40px;padding:0 14px' }, d); }).join('') + '</div>';
    if (A.err) h += '<p class="err" role="alert">' + esc(A.err) + '</p>';
    if (A.msg) h += '<p style="background:#e3f6ea;color:#1f6b3d;padding:8px 10px;border-radius:8px">' + esc(A.msg) + '</p>';
    if (A.busy) return h + '<p>' + esc(TX('Загрузка…')) + '</p>';
    var D = A.data;
    if (A.sec === 'inv') {
      var I = A.inv; if (!I) return h + '<p>' + esc(TX('Загрузка…')) + '</p>';
      h += '<p><small>' + esc(ui('Кладовщик пересчитал товар и отправил цифры. Остаток в учёте меняется только после вашего подтверждения.', 'Анбордор мол шумурд. Боқимонда танҳо пас аз тасдиқи шумо тағйир меёбад.', 'Omborchi tovarni sanadi. Qoldiq faqat sizning tasdigʻingizdan keyin oʻzgaradi.')) + '</small></p>';
      h += shBtn('copen', '📋 ' + ui('Пересчитать самому', 'Худам мешуморам', 'Oʻzim sanayman'), { sec: true, st: 'width:100%;margin:6px 0' });
      if (!I.list.length) return h + '<p style="opacity:.75">' + esc(ui('Пересчётов на подтверждение нет.', 'Ҳисобкунии интизор нест.', 'Tasdiqlash uchun sanoq yoʻq.')) + '</p>';
      h += '<div style="padding:10px;border-radius:10px;background:#fff4d6;margin:8px 0">' + esc(ui('Недостача на сумму: ', 'Камомад ба маблағи: ', 'Yetishmovchilik summasi: ')) + '<b>' + esc(shMoney(I.shortSum)) + '</b><br>' + esc(ui('Излишек на сумму: ', 'Зиёдатӣ ба маблағи: ', 'Ortiqcha summasi: ')) + '<b>' + esc(shMoney(I.plusSum)) + '</b></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">' + shBtn('invok', ui('Подтвердить все', 'Ҳамаро тасдиқ', 'Hammasini tasdiqlash')) + shBtn('invno', ui('Отклонить все', 'Ҳамаро рад', 'Hammasini rad etish'), { sec: true }) + '</div>';
      return h + I.list.map(function (x) {
        return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(x.name) + '</b><b style="color:' + (x.diff < 0 ? '#c0392b' : x.diff > 0 ? '#1f8a4c' : '#555') + '">' + (x.diff > 0 ? '+' : '') + esc(shQ(x, x.diff)) + '</b></div><small>' + esc(x.kod) + ' · ' + esc(ui('в учёте ', 'дар ҳисоб ', 'hisobda ')) + esc(shQ(x, x.now)) + ' · ' + esc(ui('насчитано ', 'шумурда шуд ', 'sanaldi ')) + esc(shQ(x, x.fact)) + ' · ' + esc(shMoney(x.money)) + ' · ' + esc(x.who) + '</small>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">' + shBtn('invok1', ui('Принять', 'Қабул', 'Qabul'), { sec: true, st: 'min-height:40px' }, x.id) + shBtn('invno1', ui('Отклонить', 'Рад', 'Rad etish'), { sec: true, st: 'min-height:40px' }, x.id) + '</div></div>';
      }).join('');
    }
    if (!D) return h + '<p>' + esc(TX('Загрузка…')) + '</p>';
    if (A.sec === 'profit') {
      h += '<p><b>' + esc(ui('Прибыль за ' + D.days + ' дн.: ', 'Фоида барои ' + D.days + ' рӯз: ', D.days + ' kunlik foyda: ')) + esc(shMoney(D.profitSum)) + '</b><br><small>' + esc(ui('Продано товаров: ', 'Моли фурӯхташуда: ', 'Sotilgan tovar: ')) + D.profitN + '</small></p>';
      if (!D.profit.length) return h + '<p style="opacity:.75">' + esc(ui('Продаж за период нет.', 'Дар ин давра фурӯш нест.', 'Bu davrda sotuv yoʻq.')) + '</p>';
      h += D.profit.map(function (x) { return anRow('<b>' + esc(x.name) + '</b><br><small>' + esc(x.kod) + ' · ' + esc(shQ(x, x.qty)) + ' · ' + esc(ui('выручка ', 'даромад ', 'tushum ')) + esc(shMoney(x.rev)) + '</small>', '<b>' + esc(shMoney(x.profit)) + '</b>', x.profit < 0); }).join('');
      if (D.profitTail && D.profitTail.length) h += '<h4 style="margin:14px 0 4px">' + esc(ui('Самые невыгодные', 'Бесамартарин', 'Eng foydasiz')) + '</h4>' + D.profitTail.map(function (x) { return anRow('<b>' + esc(x.name) + '</b><br><small>' + esc(x.kod) + '</small>', '<b>' + esc(shMoney(x.profit)) + '</b>', x.profit < 0); }).join('');
      return h;
    }
    if (A.sec === 'stale') {
      h += '<div style="padding:10px;border-radius:10px;background:#fff4d6;margin:8px 0">' + esc(ui('Без продаж ' + D.days + ' дней и больше: ', 'Бе фурӯш ' + D.days + ' рӯз ва зиёд: ', D.days + ' kun va undan koʻp sotilmagan: ')) + '<b>' + D.staleN + ' ' + esc(ui('товаров', 'мол', 'tovar')) + '</b><br>' + esc(ui('Заморожено денег (по закупке): ', 'Пули яхкарда (бо нархи харид): ', 'Muzlatilgan pul (xarid narxida): ')) + '<b>' + esc(shMoney(D.staleSum)) + '</b></div><p><small>' + esc(ui('Подумайте о скидке и не закупайте эти товары снова.', 'Дар бораи тахфиф фикр кунед ва ин молҳоро дубора нахаред.', 'Chegirma haqida oʻylang va bu tovarlarni qayta xarid qilmang.')) + '</small></p>';
      return h + D.stale.map(function (x) { return anRow('<b>' + esc(x.name) + '</b><br><small>' + esc(x.kod) + ' · ' + esc(shQ(x, x.qty)) + ' · ' + esc(x.last ? ui('последняя продажа ', 'фурӯши охирин ', 'oxirgi sotuv ') + x.last : ui('ни разу не продавался', 'ягон бор нафурӯхта', 'hech sotilmagan')) + '</small>', '<b>' + esc(shMoney(x.frozen)) + '</b>'); }).join('');
    }
    h += '<form data-shopform="minset" style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin:8px 0;align-items:center">' + shIn('sh-m-kod', ui('Код товара', 'Рамзи мол', 'Tovar kodi'), '', 'maxlength="20"') + shIn('sh-m-min', ui('Минимум (шт, м, кг)', 'Ҳадди ақал', 'Minimum'), '', 'inputmode="decimal"') + shBtn('minset', ui('Задать', 'Таъин', 'Belgilash'), { st: 'padding:0 14px' }) + '</form>';
    h += '<p><small>' + esc(ui('Задано минимальных остатков: ', 'Ҳадди ақалҳо таъин шуд: ', 'Minimal qoldiqlar belgilangan: ')) + D.minN + '. ' + esc(ui('Когда остаток ниже минимума, товар попадает сюда с предложением, сколько заказать.', 'Вақте боқимонда аз ҳадди ақал кам шавад, мол дар ин ҷо пайдо мешавад.', 'Qoldiq minimumdan kam boʻlsa, tovar bu yerga tushadi.')) + '</small></p>';
    if (!D.order.length) return h + '<p style="opacity:.75">' + esc(D.minN ? ui('Всё в достатке, заказывать пока нечего.', 'Ҳама чиз кофист.', 'Hammasi yetarli.') : ui('Минимумы ещё не заданы: введите код товара и минимум выше.', 'Ҳадди ақалҳо ҳоло таъин нашудаанд.', 'Minimumlar hali belgilanmagan.')) + '</p>';
    h += shBtn('copyorder', '📄 ' + ui('Скопировать список для поставщика', 'Нусхаи рӯйхат барои таъминкунанда', 'Taʼminotchi uchun roʻyxatni nusxalash'), { sec: true, st: 'width:100%;margin:8px 0' });
    return h + D.order.map(function (x) { return anRow('<b>' + esc(x.name) + '</b><br><small>' + esc(x.kod) + ' · ' + esc(ui('остаток ', 'боқимонда ', 'qoldiq ')) + esc(shQ(x, x.qty)) + ' / ' + esc(ui('минимум ', 'ҳадди ақал ', 'minimum ')) + esc(shQ(x, x.min)) + '</small>', '<b>' + esc(ui('заказать ', 'фармоиш ', 'buyurtma ')) + esc(shQ(x, x.suggest)) + '</b>'); }).join('');
  }
  // Пересчёт (кладовщик и руководитель): вводит код и фактическое количество, список уходит руководителю на подтверждение.
  function cntState() { return SH.cnt || (SH.cnt = { open: false, list: [], msg: '', err: '' }); }
  function shCnt() {
    var C = cntState(), h = '<h3 style="margin:4px 0 8px">' + esc(ui('Пересчёт товара', 'Ҳисобкунии мол', 'Tovarni qayta sanash')) + '</h3><p style="margin:0 0 8px;opacity:.8"><small>' + esc(ui('Введите код товара и сколько по факту лежит (штук, метров или килограммов — как у товара). Остаток в учёте поменяет руководитель после проверки.', 'Рамзи мол ва миқдори воқеиро (дона, метр, кг) нависед. Боқимондаро роҳбар пас аз санҷиш иваз мекунад.', 'Tovar kodi va haqiqiy miqdorini (dona, metr, kg) yozing. Qoldiqni rahbar tekshirgach oʻzgartiradi.')) + '</small></p>';
    if (C.err) h += '<p class="err" role="alert">' + esc(C.err) + '</p>';
    if (C.msg) h += '<p style="background:#e3f6ea;color:#1f6b3d;padding:8px 10px;border-radius:8px">' + esc(C.msg) + '</p>';
    h += '<div style="display:grid;grid-template-columns:2fr 1fr auto;gap:6px;align-items:center">' + shIn('sh-c-kod', ui('Код товара', 'Рамзи мол', 'Tovar kodi'), '', 'maxlength="20"') + shIn('sh-c-fact', ui('Фактически', 'Воқеӣ', 'Haqiqiy'), '', 'inputmode="decimal"') + shBtn('cadd', '＋', { st: 'width:56px;padding:0' }) + '</div>';
    h += C.list.length ? C.list.map(function (x, i) { return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e6e6e6"><span><b>' + esc(x.name) + '</b><br><small>' + esc(x.kod) + '</small></span><span style="display:flex;align-items:center;gap:8px"><b style="font-size:18px">' + esc(shQ(shProd(x.kod), x.fact)) + '</b>' + shBtn('crm', '×', { sec: true, st: 'width:44px;padding:0;min-height:40px' }, i) + '</span></div>'; }).join('') : '<p style="opacity:.7">' + esc(ui('Список пуст.', 'Рӯйхат холӣ.', 'Roʻyxat boʻsh.')) + '</p>';
    return h + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:10px">' + shBtn('csend', ui('Отправить на проверку', 'Барои санҷиш фиристодан', 'Tekshirishga yuborish')) + shBtn('cclose', ui('Закрыть', 'Пӯшидан', 'Yopish'), { sec: true }) + '</div>';
  }
  // «Кому должен магазин» (поставщики, только руководитель): долг от приёма «в долг», кнопка «Оплатил поставщику» — частями или целиком.
  function shPostDolg() {
    var R = SH.d && SH.d.report; if (!R) return '';
    var L = R.postDebts || [], h = '<h3 style="margin-top:18px">' + esc(ui('Кому должен магазин (поставщики)', 'Мағоза ба кӣ қарздор аст (таъминкунандагон)', 'Doʻkon kimga qarzdor (taʼminotchilar)')) + '</h3>';
    if (!L.length) return h + '<p style="opacity:.75">' + esc(ui('Магазин никому не должен.', 'Мағоза ба касе қарздор нест.', 'Doʻkon hech kimga qarzdor emas.')) + '</p>';
    return h + L.map(function (c) {
      var open = SH.ppf === c.name;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(c.name) + '</b><b style="color:#c0392b">' + esc(shMoney(c.sum)) + '</b></div><small>' + esc(ui('с ', 'аз ', '')) + esc(c.since) + '</small>' +
        (open ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">' + shIn('sh-pp-amt', ui('Сумма', 'Маблағ', 'Summa'), c.sum, 'inputmode="decimal"') + '<select id="sh-pp-pay" class="in2" style="height:48px;font-size:16px"><option value="nal">' + esc(ui('Наличными', 'Нақд', 'Naqd')) + '</option><option value="perevod">' + esc(ui('Переводом', 'Интиқол', 'Oʻtkazma')) + '</option></select>' + shBtn('ppok', ui('Записать оплату', 'Сабти пардохт', 'Toʻlovni yozish')) + shBtn('ppcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div>'
          : '<div style="margin-top:6px">' + shBtn('ppopen', ui('Оплатил поставщику', 'Ба таъминкунанда пардохтам', 'Taʼminotchiga toʻladim'), { sec: true }, c.name) + '</div>') + '</div>';
    }).join('');
  }
  function shDolg() {
    var D = SH.d, R = D.report, mine = D.debts.reduce(function (s, c) { return s + cents(c.sum); }, 0), theirs = R ? (R.postDebts || []).reduce(function (s, c) { return s + cents(c.sum); }, 0) : 0;
    var top = R ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:6px 0 10px">' + [[ui('Нам должны', 'Ба мо қарздоранд', 'Bizga qarz'), mine, '#1f8a4c'], [ui('Мы должны', 'Мо қарздорем', 'Biz qarzdormiz'), theirs, '#c0392b'], [ui('Разница', 'Фарқ', 'Farq'), mine - theirs, '']].map(function (x) { return '<div style="padding:8px;border:1px solid #e0e0e0;border-radius:10px"><small>' + esc(x[0]) + '</small><div style="font-weight:700;' + (x[2] ? 'color:' + x[2] : '') + '">' + esc(money(x[1])) + '</div></div>'; }).join('') + '</div>' : '';
    if (!D.debts.length) return top + '<p>' + esc(ui('Покупатели магазину не должны.', 'Харидорон ба мағоза қарздор нестанд.', 'Xaridorlar doʻkonga qarzdor emas.')) + '</p>' + shPostDolg();
    var tot = mine;
    return top + '<p><b>' + esc(ui('Всего должны', 'Ҳамагӣ қарздоранд', 'Jami qarz')) + ': ' + esc(money(tot)) + '</b></p>' + D.debts.map(function (c) {
      var open = SH.payf === c.name;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6' + (c.owner ? ';background:#fff7e6;padding-left:8px' : '') + '"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(c.owner ? ui('Владелец (взял товар)', 'Соҳиб (мол гирифт)', 'Egasi (tovar oldi)') : c.name) + '</b><b>' + esc(shMoney(c.sum)) + '</b></div><small>' + esc(ui('с ', 'аз ', '')) + esc(c.since) + '</small>' +
        (open ? '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;margin-top:6px">' + shIn('sh-p-amt', ui('Сумма', 'Маблағ', 'Summa'), c.sum, 'inputmode="decimal"') + shBtn('pok', ui('Принять', 'Қабул', 'Qabul')) + shBtn('pcancel', '×', { sec: true, st: 'width:48px;padding:0' }) + '</div>' : '<div style="margin-top:6px">' + shBtn('pay-open', c.owner ? ui('Владелец рассчитался', 'Соҳиб ҳисоб кард', 'Egasi hisob qildi') : ui('Принял оплату', 'Пардохт қабул шуд', 'Toʻlov qabul qilindi'), { sec: true }, c.name) + '</div>') + '</div>';
    }).join('') + shPostDolg();
  }
  // «Зарплата» (только руководитель): оклад + процент от выручки собственных чеков продавца − авансы − выдачи − личные расходы.
  function shZp() {
    var R = SH.d.report, h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0">' + shBtn('mprev', '‹', { sec: true, st: 'width:56px;padding:0' }) + '<b>' + esc(monthName(R.month)) + '</b>' + shBtn('mnext', '›', { sec: true, st: 'width:56px;padding:0' }) + '</div>';
    var L = R.salary || [], kn = { avans: ui('аванс', 'пеш', 'avans'), zp: ui('зарплата', 'маош', 'maosh') };
    h += '<p style="margin:0 0 8px"><small>' + esc(ui('Начислено = оклад + процент от выручки чеков продавца (товар «Шеф Шамсуло взял» не считается). Остаток = начислено − авансы − выдачи − личные расходы.', 'Ҳисобшуда = маош + фоиз аз даромади чекҳо. Боқимонда = ҳисобшуда − пеш − супорида − хароҷоти шахсӣ.', 'Hisoblangan = maosh + chek tushumidan foiz. Qoldiq = hisoblangan − avans − toʻlangan − shaxsiy xarajat.')) + '</small></p>';
    if (!L.length) return h + '<p>' + esc(ui('Продавцов пока нет. Добавьте их в «Команде».', 'Ҳоло фурӯшанда нест. Дар «Даста» илова кунед.', 'Hozircha sotuvchi yoʻq. «Jamoa»da qoʻshing.')) + '</p>';
    h += L.map(function (x) {
      var open = SH.zpf && SH.zpf.who === x.name, mode = open ? SH.zpf.mode : '';
      var row = function (l, v, c) { return '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="opacity:.8">' + esc(l) + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + esc(money(cents(v))) + '</b></div>'; };
      var b = '<div style="padding:10px;border:1px solid #e0e0e0;border-radius:10px;margin:8px 0"><div style="font-size:17px"><b>' + esc(x.name) + '</b> <small>· ' + esc(money(cents(x.oklad))) + ' + ' + esc(String(x.pct)) + '%</small></div>' +
        row(ui('Выручка продавца', 'Даромади фурӯшанда', 'Sotuvchi tushumi'), x.rev) + row(ui('Начислено', 'Ҳисобшуда', 'Hisoblangan'), x.accrued) + row(ui('Авансы', 'Пеш', 'Avans'), x.avans) + row(ui('Выдано', 'Супорида шуд', 'Toʻlangan'), x.paid) + row(ui('Личные расходы', 'Хароҷоти шахсӣ', 'Shaxsiy xarajat'), x.exp) + row(ui('К выплате', 'Барои супоридан', 'Toʻlash kerak'), x.rest, x.rest < 0 ? '#c0392b' : '#1f8a4c');
      if (!open) b += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px">' + shBtn('zpopen', ui('Оклад и %', 'Маош ва %', 'Maosh va %'), { sec: true, st: 'min-height:40px;font-size:14px' }, x.name + '|set') + shBtn('zpopen', ui('Аванс', 'Пеш', 'Avans'), { sec: true, st: 'min-height:40px;font-size:14px' }, x.name + '|avans') + shBtn('zpopen', ui('Выдать', 'Додан', 'Berish'), { sec: true, st: 'min-height:40px;font-size:14px' }, x.name + '|zp') + '</div>';
      else if (mode === 'set') b += '<div style="display:grid;gap:8px;margin-top:8px">' + shIn('sh-z-oklad', ui('Оклад в месяц, сомони', 'Маоши моҳона, сомонӣ', 'Oylik maosh, somoniy'), x.oklad, 'inputmode="decimal"') + shIn('sh-z-pct', ui('Процент от выручки', 'Фоиз аз даромад', 'Tushumdan foiz'), x.pct, 'inputmode="decimal"') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('zpsave', ui('Сохранить', 'Захира', 'Saqlash'), {}, x.name + '|set') + shBtn('zpcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
      else b += '<div style="display:grid;gap:8px;margin-top:8px">' + shIn('sh-z-amt', (mode === 'avans' ? ui('Сумма аванса', 'Маблағи пеш', 'Avans summasi') : ui('Сумма выдачи', 'Маблағи додан', 'Berilgan summa')), mode === 'zp' && x.rest > 0 ? x.rest : '', 'inputmode="decimal"') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('zpsave', ui('Записать', 'Сабт', 'Yozish'), {}, x.name + '|' + mode) + shBtn('zpcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
      return b + '</div>';
    }).join('');
    var pl = R.payList || [];
    if (pl.length) h += '<h3 style="margin-top:14px">' + esc(ui('Выплаты', 'Супоришҳо', 'Toʻlovlar')) + '</h3>' + pl.map(function (x) { var ask = SH.voidAsk === x.id; return '<div style="padding:6px 0;border-bottom:1px solid #eee;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><small>' + esc(x.date) + ' · ' + esc(x.who) + ' · ' + esc(kn[x.kind] || x.kind) + '</small></div><b>' + esc(money(cents(x.sum))) + '</b>' + shBtn('void', ask ? ui('Точно?', 'Боварӣ?', 'Aniqmi?') : '×', { sec: true, st: 'width:56px;padding:0' }, x.id) + '</div>'; }).join('');
    return h;
  }
  // Файл Excel (.xlsx) без сторонних библиотек: несколько листов, первая строка жирная. Zip без сжатия (stored) с CRC32.
  // sheets = [{ name, rows: [[ячейка, …], …] }]; число — числовая ячейка, остальное — текст.
  function xlsxBlob(sheets) {
    var enc = new TextEncoder(), xe = function (v) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var col = function (i) { var c = ''; i++; while (i > 0) { var m = (i - 1) % 26; c = String.fromCharCode(65 + m) + c; i = Math.floor((i - 1) / 26); } return c; };
    var files = [];
    var add = function (name, text) { files.push({ name: name, data: enc.encode(text) }); };
    var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    add('[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>');
    add('_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    add('xl/workbook.xml', X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + xe(String(s.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>');
    add('xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    add('xl/styles.xml', X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
    sheets.forEach(function (s, i) {
      var w = [];
      s.rows.forEach(function (r) { r.forEach(function (v, j) { w[j] = Math.max(w[j] || 8, Math.min(50, String(v == null ? '' : v).length + 2)); }); });
      var cols = w.length ? '<cols>' + w.map(function (x, j) { return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + x + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
      var data = s.rows.map(function (r, ri) {
        return '<row r="' + (ri + 1) + '">' + r.map(function (v, j) {
          var ref = col(j) + (ri + 1), st = s.bold && s.bold.indexOf(ri) >= 0 ? ' s="1"' : '';
          if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
          if (v == null || v === '') return '';
          return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>';
        }).join('') + '</row>';
      }).join('');
      add('xl/worksheets/sheet' + (i + 1) + '.xml', X + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + data + '</sheetData></worksheet>');
    });
    var T = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
    var crc = function (b) { var c = 0xFFFFFFFF; for (var q = 0; q < b.length; q++) c = T[(c ^ b[q]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    var parts = [], central = [], off = 0;
    var u16 = function (v) { return [v & 255, (v >>> 8) & 255]; }, u32 = function (v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; };
    files.forEach(function (f) {
      var nm = enc.encode(f.name), c = crc(f.data), sz = f.data.length;
      var head = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(c), u32(sz), u32(sz), u16(nm.length), u16(0));
      parts.push(new Uint8Array(head), nm, f.data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(c), u32(sz), u32(sz), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += head.length + nm.length + sz;
    });
    var csz = central.reduce(function (s, b) { return s + b.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csz), u32(off), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function saveBlob(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
  }
  // Отчёт магазина за месяц в Excel (№251): по дням, продажи, приём товара, долги, касса.
  function shExportXlsx(r) {
    var E = r.export, R = r.report || {}, num = function (x) { return Math.round((Number(x) || 0) * 100) / 100; };
    var PN = { nal: ui('наличные', 'нақд', 'naqd'), alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: ui('перевод', 'интиқол', 'oʻtkazma'), mix: ui('смешанная', 'омехта', 'aralash'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('шеф взял', 'роҳбар гирифт', 'rahbar oldi'), 'in': ui('внесли', 'гузоштанд', 'qoʻyildi'), out: ui('взяли', 'гирифтанд', 'olindi') };
    var pn = function (p) { return PN[p] || p || ''; };
    var D = R.days || {}, dk = Object.keys(D).sort(), tot = [0, 0, 0, 0, 0, 0, 0];
    var dayRows = dk.map(function (d) { var x = D[d], v = [x.sold, x.cashIn, x.debtNew, x.profit, x.purchase, x.salary, x.pers].map(num); v.forEach(function (n, i) { tot[i] += n; }); return [d].concat(v); });
    var days = { name: ui('По дням', 'Аз рӯи рӯз', 'Kunlar'), bold: [0, dayRows.length + 1], rows: [[ui('Дата', 'Сана', 'Sana'), ui('Продано', 'Фурӯхта шуд', 'Sotildi'), ui('Пришло денег', 'Пул омад', 'Pul keldi'), ui('Новые долги', 'Қарзи нав', 'Yangi qarz'), ui('Прибыль', 'Фоида', 'Foyda'), ui('Закупка', 'Харид', 'Xarid'), ui('Зарплата', 'Маош', 'Maosh'), ui('Личные расходы', 'Хароҷоти шахсӣ', 'Shaxsiy xarajat')]].concat(dayRows, [[ui('Итого', 'Ҳамагӣ', 'Jami')].concat(tot.map(num))]) };
    var sales = { name: ui('Продажи', 'Фурӯш', 'Sotuv'), bold: [0], rows: [[ui('Дата', 'Сана', 'Sana'), ui('Чек', 'Чек', 'Chek'), ui('Код', 'Рамз', 'Kod'), ui('Товар', 'Мол', 'Tovar'), ui('Кол-во', 'Миқдор', 'Miqdor'), ui('Цена', 'Нарх', 'Narx'), ui('Сумма', 'Маблағ', 'Summa'), ui('Закупка', 'Харид', 'Xarid'), ui('Оплата', 'Пардохт', 'Toʻlov'), ui('Покупатель', 'Харидор', 'Xaridor'), ui('Продавец', 'Фурӯшанда', 'Sotuvchi')]].concat((E.sales || []).map(function (x) { return [x.date, String(x.chek).slice(-8), x.kod, x.name, x.qty, num(x.price), num(x.sum), num(x.zakup), pn(x.pay) + (x.parts ? ' (' + String(x.parts).split(', ').map(function (t) { var m = t.split(' '); return pn(m[0]) + ' ' + (m[1] || ''); }).join(', ') + ')' : '') + (x.qty < 0 ? ' · ' + ui('возврат', 'баргардон', 'qaytarish') : ''), x.who, x.seller || ui('руководитель', 'роҳбар', 'rahbar')]; })) };
    var rec = { name: ui('Приём товара', 'Қабули мол', 'Tovar qabuli'), bold: [0], rows: [[ui('Дата', 'Сана', 'Sana'), ui('Код', 'Рамз', 'Kod'), ui('Товар', 'Мол', 'Tovar'), ui('Кол-во', 'Миқдор', 'Miqdor'), ui('Цена приёма', 'Нархи қабул', 'Qabul narxi'), ui('Сумма', 'Маблағ', 'Summa'), ui('Поставщик', 'Таъминкунанда', 'Taʼminotchi'), ui('Оплата', 'Пардохт', 'Toʻlov'), ui('Принял', 'Қабул кард', 'Qabul qildi'), ui('Поправка', 'Ислоҳ', 'Tuzatish'), ui('Рулонов', 'Рулон', 'Rulon'), ui('Кг', 'Кг', 'Kg'), ui('Метров (доп.)', 'Метр (илова)', 'Metr (qoʻshimcha)')]].concat((E.receipts || []).map(function (x) { return [x.date, x.kod, x.name, x.qty, num(x.zakup), num(x.sum), x.post, pn(x.pay), x.who, x.fix ? ui('да', 'ҳа', 'ha') : '', x.rolls || '', x.kg || '', x.m || '']; })) };
    var dr = [[ui('Нам должны (покупатели)', 'Ба мо қарздоранд (харидорон)', 'Bizga qarz (xaridorlar)'), '', ''], [ui('Кто', 'Кӣ', 'Kim'), ui('Сумма', 'Маблағ', 'Summa'), ui('С какого числа', 'Аз кадом сана', 'Qaysi sanadan')]], bold = [0, 1];
    (r.debts || []).forEach(function (c) { dr.push([c.owner ? ui('Владелец', 'Соҳиб', 'Egasi') : c.name, num(c.sum), c.since]); });
    dr.push([]); bold.push(dr.length); dr.push([ui('Магазин должен (поставщики)', 'Мағоза қарздор (таъминкунандагон)', 'Doʻkon qarzdor (taʼminotchilar)'), '', '']); bold.push(dr.length); dr.push([ui('Кому', 'Ба кӣ', 'Kimga'), ui('Сумма', 'Маблағ', 'Summa'), ui('С какого числа', 'Аз кадом сана', 'Qaysi sanadan')]);
    (R.postDebts || []).forEach(function (c) { dr.push([c.name, num(c.sum), c.since]); });
    dr.push([]); bold.push(dr.length); dr.push([ui('Оплаты долгов за месяц', 'Пардохти қарзҳо дар моҳ', 'Oy davomida qarz toʻlovlari'), '', '']); bold.push(dr.length); dr.push([ui('Дата', 'Сана', 'Sana'), ui('Кто', 'Кӣ', 'Kim'), ui('Сумма', 'Маблағ', 'Summa')]);
    (E.debtPays || []).forEach(function (x) { dr.push([x.date, x.who, num(x.sum)]); });
    (R.postPays || []).forEach(function (x) { dr.push([x.date, ui('поставщику ', 'ба таъминкунанда ', 'taʼminotchiga ') + x.who + ' (' + pn(x.pay) + ')', -num(x.sum)]); });
    var kr = [[ui('Сдача кассы', 'Супоридани касса', 'Kassa topshirish'), '', '', '', ''], [ui('Дата', 'Сана', 'Sana'), ui('Кто', 'Кӣ', 'Kim'), ui('Должно быть', 'Бояд бошад', 'Boʻlishi kerak'), ui('Сдал', 'Супорид', 'Topshirdi'), ui('Разница', 'Фарқ', 'Farq')]], kb = [0, 1];
    (R.sdachi || []).slice().reverse().forEach(function (x) { kr.push([x.date, x.who, num(x.exp), num(x.fact), num(x.diff)]); });
    kr.push([]); kb.push(kr.length); kr.push([ui('Внесли и взяли из кассы', 'Ба касса гузоштанд ва гирифтанд', 'Kassaga qoʻyildi va olindi'), '', '', '', '']); kb.push(kr.length); kr.push([ui('Дата', 'Сана', 'Sana'), ui('Чья касса', 'Кассаи кӣ', 'Kimning kassasi'), ui('Что', 'Чӣ', 'Nima'), ui('Сумма', 'Маблағ', 'Summa'), ui('Пояснение', 'Шарҳ', 'Izoh')]);
    (R.kassa || []).slice().reverse().forEach(function (x) { kr.push([x.date, x.who, pn(x.kind), x.kind === 'out' ? -num(x.sum) : num(x.sum), x.note]); });
    kr.push([]); kb.push(kr.length); kr.push([ui('Личные расходы продавцов', 'Хароҷоти шахсии фурӯшандагон', 'Sotuvchilarning shaxsiy xarajatlari'), '', '', '', '']); kb.push(kr.length); kr.push([ui('Дата', 'Сана', 'Sana'), ui('Кто', 'Кӣ', 'Kim'), ui('На что', 'Барои чӣ', 'Nimaga'), ui('Сумма', 'Маблағ', 'Summa'), '']);
    (R.expList || []).slice().reverse().forEach(function (x) { kr.push([x.date, x.who, x.note, num(x.sum), '']); });
    return xlsxBlob([days, sales, rec, { name: ui('Долги', 'Қарзҳо', 'Qarzlar'), bold: bold, rows: dr }, { name: ui('Касса', 'Касса', 'Kassa'), bold: kb, rows: kr }]);
  }
  function shOtchet() {
    var R = SH.d.report, h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0">' + shBtn('mprev', '‹', { sec: true, st: 'width:56px;padding:0' }) + '<b>' + esc(monthName(R.month)) + '</b>' + shBtn('mnext', '›', { sec: true, st: 'width:56px;padding:0' }) + '</div>';
    var cell = function (l, v, c) { return '<div style="padding:10px;border:1px solid #e0e0e0;border-radius:10px"><small>' + esc(l) + '</small><div style="font-size:20px;font-weight:700;' + (c ? 'color:' + c : '') + '">' + esc(money(cents(v))) + '</div></div>'; };
    h += shBtn('xlsx', '📥 ' + (SH.xBusy ? TX('Загрузка…') : ui('Скачать отчёт за месяц в Excel', 'Ҳисоботи моҳро ба Excel гирифтан', 'Oylik hisobotni Excel’ga yuklash')), { sec: true, st: 'width:100%;margin:0 0 10px' });
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + cell(ui('Выручка', 'Даромад', 'Tushum'), R.revenue) + cell(ui('Прибыль', 'Фоида', 'Foyda'), R.profit, '#1f8a4c') + cell(ui('Шеф Шамсуло взял', 'Роҳбар гирифт', 'Rahbar oldi'), R.owner, '#b36b00') + cell(ui('Долги всего', 'Қарзҳо ҳамагӣ', 'Jami qarz'), R.debt, '#c0392b') + '</div>';
    if (R.expenses > 0) {
      h += '<h3 style="margin-top:14px">' + esc(ui('Личные расходы продавцов', 'Хароҷоти шахсии фурӯшандагон', 'Sotuvchilarning shaxsiy xarajatlari')) + ': ' + esc(money(cents(R.expenses))) + '</h3>';
      h += Object.keys(R.expBy || {}).map(function (n) { return '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>' + esc(n) + '</span><b>' + esc(money(cents(R.expBy[n]))) + '</b></div>'; }).join('');
      h += (R.expList || []).map(function (x) { var ask = SH.voidAsk === x.id; return '<div style="padding:6px 0;border-bottom:1px solid #eee;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><small>' + esc(x.date) + ' · ' + esc(x.who) + (x.note ? ' · ' + esc(x.note) : '') + '</small></div><b>' + esc(money(cents(x.sum))) + '</b>' + shBtn('void', ask ? ui('Точно?', 'Боварӣ?', 'Aniqmi?') : '×', { sec: true, st: 'width:56px;padding:0' }, x.id) + '</div>'; }).join('');
    }
    var PL = { nal: ui('Наличные', 'Нақд', 'Naqd'), alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: ui('Перевод', 'Гузаронидан', 'Oʻtkazma') };
    var pbRow = function (o) { return Object.keys(o || {}).filter(function (m) { return o[m] > 0; }).map(function (m) { return '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>' + esc(PL[m] || m) + '</span><b>' + esc(money(cents(o[m]))) + '</b></div>'; }).join(''); };
    if (R.month === monthOf(today()) && pbRow(R.payToday)) h += '<h3 style="margin-top:14px">' + esc(ui('Сегодня по способам оплаты', 'Имрӯз аз рӯи роҳи пардохт', 'Bugun toʻlov usullari boʻyicha')) + '</h3>' + pbRow(R.payToday);
    if (pbRow(R.payBy)) h += '<h3 style="margin-top:14px">' + esc(ui('За месяц по способам оплаты', 'Дар моҳ аз рӯи роҳи пардохт', 'Oy boʻyicha toʻlov usullari')) + '</h3>' + pbRow(R.payBy);
    if (R.month === monthOf(today())) { var ih = R.itogiHour || 21; h += '<h3 style="margin-top:14px">' + esc(ui('Итоги дня на телефон', 'Ҷамъбасти рӯз ба телефон', 'Kun yakuni telefonga')) + '</h3><p style="margin:0 0 6px"><small>' + esc(ui('Придут, когда продавцы сдадут кассу. Если смену не закрыли — в это время, с пометкой «смена не закрыта»:', 'Вақте фурӯшандагон кассаро супоранд меояд. Агар смена пӯшида нашавад — дар ин вақт:', 'Sotuvchilar kassani topshirganda keladi. Smena yopilmasa — shu vaqtda:')) + '</small></p><div style="display:flex;gap:6px;flex-wrap:wrap">' + [18, 19, 20, 21, 22, 23].map(function (x) { return shBtn('ihour', x + ':00', { sec: ih !== x, st: 'min-height:40px;padding:0 12px;font-size:14px' }, x); }).join('') + '</div>'; }
    if ((R.kassa || []).length) h += '<h3 style="margin-top:14px">' + esc(ui('Внесли и взяли из кассы', 'Ба касса гузоштанд ва гирифтанд', 'Kassaga qoʻyildi va olindi')) + '</h3>' + R.kassa.map(function (x) { var ask = SH.voidAsk === x.id, inn = x.kind === 'in'; return '<div style="padding:6px 0;border-bottom:1px solid #eee;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><small>' + esc(x.date) + ' · ' + esc(x.who) + (x.note ? ' · ' + esc(x.note) : '') + '</small><br>' + esc(inn ? ui('внесли', 'гузоштанд', 'qoʻyildi') : ui('взяли', 'гирифтанд', 'olindi')) + '</div><b style="color:' + (inn ? '#1f8a4c' : '#b36b00') + '">' + (inn ? '+' : '−') + esc(money(cents(x.sum))) + '</b>' + shBtn('void', ask ? ui('Точно?', 'Боварӣ?', 'Aniqmi?') : '×', { sec: true, st: 'width:56px;padding:0' }, x.id) + '</div>'; }).join('');
    if ((R.sdachi || []).length) h += '<h3 style="margin-top:14px">' + esc(ui('Сдача кассы', 'Супоридани касса', 'Kassa topshirish')) + '</h3>' + R.sdachi.map(function (x) { var okd = Math.abs(x.diff) < 0.005; return '<div style="padding:6px 0;border-bottom:1px solid #eee"><small>' + esc(x.date) + ' · ' + esc(x.who) + '</small><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(ui('Должно ', 'Бояд ', 'Kerak ')) + esc(money(cents(x.exp))) + ' · ' + esc(ui('сдал ', 'супорид ', 'topshirdi ')) + esc(money(cents(x.fact))) + '</span><b style="color:' + (okd ? '#1f8a4c' : '#c0392b') + '">' + (okd ? '✓' : (x.diff < 0 ? esc(ui('недостача ', 'камомад ', 'kamomad ')) : esc(ui('излишек ', 'зиёдатӣ ', 'ortiqcha '))) + esc(money(cents(Math.abs(x.diff))))) + '</b></div>' + (shByLine(x.by) ? '<small>' + esc(shByLine(x.by)) + '</small>' : '') + '<div style="margin-top:4px">' + (x.ok ? '<small style="color:#1f8a4c">✓ ' + esc(ui('Смена подтверждена', 'Смена тасдиқ шуд', 'Smena tasdiqlandi')) + '</small>' : shBtn('sdok', ui('Подтвердить смену', 'Тасдиқи смена', 'Smenani tasdiqlash'), { sec: true, st: 'min-height:40px;font-size:14px;padding:4px 12px' }, x.id)) + '</div></div>'; }).join('');
    var dd = R.days && R.days[today()];
    if (dd && R.month === monthOf(today())) h += '<h3 style="margin-top:14px">' + esc(ui('Итоги дня', 'Натиҷаи рӯз', 'Kun yakuni')) + '</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + cell(ui('Продано на', 'Фурӯхта шуд', 'Sotildi'), dd.sold) + cell(ui('Пришло денег', 'Пул омад', 'Pul keldi'), dd.cashIn, '#1f8a4c') + cell(ui('Прибыль', 'Фоида', 'Foyda'), dd.profit, '#1f8a4c') + cell(ui('Закупка', 'Харид', 'Xarid'), dd.purchase, '#b36b00') + cell(ui('Новые долги', 'Қарзҳои нав', 'Yangi qarzlar'), dd.debtNew, '#c0392b') + '</div>';
    if (R.low.length) h += '<p style="margin-top:12px"><b>' + esc(ui('Заканчивается', 'Тамом шуда истодааст', 'Tugayapti')) + ':</b> ' + R.low.map(function (x) { return esc(x.name) + ' (' + esc(shQ(x, x.qty)) + ')'; }).join(', ') + '</p>';
    h += '<h3 style="margin-top:14px">' + esc(ui('Продажи', 'Фурӯшҳо', 'Sotuvlar')) + '</h3>';
    if (!R.checks.length) return h + '<p>' + esc(ui('За этот месяц продаж нет.', 'Дар ин моҳ фурӯш нест.', 'Bu oyda sotuv yoʻq.')) + '</p>';
    var pn = { nal: ui('наличные', 'нақд', 'naqd'), perevod: ui('перевод', 'гузаронидан', 'oʻtkazma'), alif: 'Алиф', dushanbe: 'Душанбе Сити', mix: ui('смешанная', 'омехта', 'aralash'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('владелец', 'соҳиб', 'egasi') };
    return h + R.checks.map(function (c) {
      var ask = SH.voidAsk === c.id;
      return '<div style="padding:8px 0;border-bottom:1px solid #e6e6e6;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0">' + (c.total < 0 ? '<b style="color:#1f6fb2">↩ ' + esc(ui('Возврат', 'Баргардонидан', 'Qaytarish')) + '</b> ' : '') + '<b>' + esc(money(cents(c.total))) + '</b> · ' + esc(pn[c.pay] || c.pay) + (c.parts && c.parts.length ? ' (' + c.parts.map(function (q) { return esc(pn[q.pay] || q.pay) + ' ' + esc(money(cents(q.sum))); }).join(' + ') + ')' : '') + (c.pay === 'dolg' ? ' · ' + esc(c.who) : '') + (c.seller ? ' · ' + esc(c.seller) : '') + '<br><small>' + esc(c.date) + ' · ' + c.lines.map(function (l) { return esc(l.name) + ' ×' + esc(shQ(shProd(l.kod), l.qty)); }).join(', ') + '</small></div>' + shBtn('void', ask ? ui('Отменить?', 'Бекор мекунем?', 'Bekor qilinsinmi?') : '↺', { sec: true, st: 'width:' + (ask ? '110' : '48') + 'px;padding:0' + (ask ? ';background:#c0392b;color:#fff' : '') }, c.id) + '</div>';
    }).join('');
  }
  function shNum(id) { var e = $s(id); return e ? String(e.value).replace(',', '.').trim() : ''; }
  function shopClick(b) {
    var a = b.dataset.shop, k = b.dataset.k;
    if (a === 'preview' || a === 'previewk') { KEEPER = a === 'previewk'; PREVIEW = true; PREV_TAB = SH.tab; var md = $s('m-spec'); if (md && md.open) md.close(); if (shPolkiOn()) { KEEPER = false; setPharm(); return; } /* аптека Асрора: продавец видит только поиск и добавление препарата */ setSeller(true); return; }
    if (a === 'selout') { if (PREVIEW) { PREVIEW = false; setSeller(false); S.view = PREV_FIN ? 'fin' : 'shop'; PREV_FIN = false; SH.tab = PREV_TAB || 'kassa'; SH.cart = []; SH.pay = ''; SH.d = null; render(); open_dlg('m-spec'); shLoad(); return; } if (typeof window.logout === 'function') window.logout(); return; }
    if (SELLER && !KEEPER && ['tab', 'fnew', 'fedit', 'rcv', 'rok', 'pdel', 'pay-open', 'pok', 'void', 'mprev', 'mnext', 'fcancel', 'save', 'rcancel'].indexOf(a) >= 0) return;
    if (KEEPER && ['tab', 'fedit', 'pdel', 'pay-open', 'pok', 'void', 'mprev', 'mnext', 'sell', 'add', 'put', 'plus', 'minus', 'rm', 'pay', 'dolgopen', 'paynow', 'who', 'preview', 'previewk'].indexOf(a) >= 0) return;
    if (a === 'tab') { SH.polki = false; SH.low = ''; SH.pcode = ''; SH.tab = k; SH.err = ''; SH.ok = ''; SH.form = null; SH.rcv = null; SH.payf = null; SH.delAsk = ''; SH.voidAsk = ''; SH.found = null; SH.code = ''; if (k === 'anal') { anLoad(); return; } return render(); }
    if (a === 'goto') { openShop(); SH.tab = k; return render(); }
    if (a === 'reload') { SH.err = ''; render(); return shLoad(); }
    if (a === 'add') { var c = $s('sh-code'); SH.code = ''; shAdd(c ? c.value : ''); render(); var c2 = $s('sh-code'); if (c2) c2.focus(); return; }
    if (a === 'put') { SH.err = ''; SH.found = null; SH.ff = null; var pc = $s('sh-code'), pt = pc ? pc.value.trim().toLowerCase() : ''; shPut(k); SH.code = pt === String(k).toLowerCase() ? k : ''; render(); var c3 = $s('sh-code'); if (c3) c3.focus(); return; }
    if (a === 'print') return shPrintReceipt();
    if (a === 'scan') return shScanOpen(k);
    if (a === 'retopen') { SH.ret = { q: '', busy: false, err: '', chek: null, sel: {}, pay: 'nal' }; SH.ok = ''; return render(); }
    if (a === 'retcancel') { if (!SH.ret || !SH.ret.busy) { SH.ret = null; render(); } return; }
    if (a === 'retfind') return shRetFind();
    if (a === 'retgo') return shRetGo();
    if (a === 'retpay') { if (SH.ret && !SH.ret.busy) { SH.ret.chek.lines.forEach(function (l, i) { var e = $s('sh-ret-' + i); if (e) SH.ret.sel[l.kod] = e.value; }); SH.ret.pay = k; render(); } return; }
    if (a === 'bind') { if (SH.bind) shBind(k, SH.bind.code); return; }
    if (a === 'bcancel') { SH.bind = null; return render(); }
    if (a === 'bnew') { var bc0 = SH.bind && SH.bind.code; SH.bind = null; SH.fotoNew = ''; SH.rcv = null; SH.form = { kod: bc0 || '', name: '', zakup: '', marzha: '', sell: '', fsm: false }; return render(); }
    if (a === 'unbind') { if (SH.rcv) shAct({ action: 'list', unbind_barcode: { kod: SH.rcv.kod, code: k, id: oid() } }, ui('Штрихкод отвязан', 'Штрихкод ҷудо шуд', 'Shtrix-kod ajratildi') + ': ' + k); return; }
    if (a === 'foto') { var fi = $s('sh-foto-in'); if (fi) { fi.dataset.k = k; fi.value = ''; fi.click(); } return; }
    if (a === 'rw') { try { lstore('ew_rw', String(k)); } catch (e) {} return render(); }
    if (a === 'who') { SH.who = k; SH.err = ''; render(); return; }
    if (a === 'plus') { SH.err = ''; shPut(k); return render(); }
    if (a === 'minus') { SH.cart.forEach(function (it) { if (it.kod === k) { var pm = shProd(k); it.qty = shQR(shU(pm), it.qty - shStep(pm)); } }); SH.cart = SH.cart.filter(function (it) { return it.qty > 0; }); return render(); }
    if (a === 'ffind') { var ffi = $s('sh-ff-in'); if (ffi) { ffi.value = ''; ffi.click(); } return; }
    if (a === 'ffclose') { SH.ff = null; return render(); }
    if (a === 'rm') { SH.cart = SH.cart.filter(function (it) { return it.kod !== k; }); return render(); }
    if (a === 'pay') { var w = $s('shx-who'); if (w) SH.who = w.value; SH.pay = k; SH.err = ''; return render(); }
    if (a === 'pmix') { SH.pay = 'mix'; SH.err = ''; return render(); }
    if (a === 'pm') { SH.pay = k; SH.err = ''; a = 'sell'; }
    if (a === 'dolgopen') { SH.payPick = false; if (!SH.cart.length) { SH.err = ui('Сначала добавьте товар', 'Аввал мол илова кунед', 'Avval tovar qoʻshing'); return render(); } SH.err = ''; SH.pay = SH.pay === 'dolg' ? '' : 'dolg'; return render(); }
    if (a === 'paynow') { if (!SH.cart.length) { SH.err = ui('Сначала добавьте товар', 'Аввал мол илова кунед', 'Avval tovar qoʻshing'); return render(); } if (SH.pay === 'dolg') SH.pay = ''; SH.payPick = !SH.payPick; if (SH.payPick) SH.pay = ''; SH.err = ''; return render(); }
    if (a === 'shef') { if (!SH.cart.length) { SH.err = ui('Сначала добавьте в корзину товар, который взял шеф (введите код), потом нажмите «Шеф Шамсуло взял»', 'Аввал моли гирифтаи сардорро ба сабад илова кунед, баъд «Сардор гирифт»-ро пахш кунед', 'Avval boshliq olgan tovarni savatga qoʻshing, keyin «Boshliq oldi»ni bosing'); return render(); } SH.pay = 'vladelec'; SH.err = ''; a = 'sell'; }
    if (a === 'sell' || a === 'paynow') {
      if (SH.busy) return; if (!SH.cart.length) { SH.err = ui('Сначала добавьте товар', 'Аввал мол илова кунед', 'Avval tovar qoʻshing'); return render(); } var w2 = $s('shx-who'); if (w2) SH.who = w2.value;
      if (!SH.pay) { SH.err = ui('Выберите, как заплатили', 'Интихоб кунед, чӣ тавр пардохт шуд', 'Qanday toʻlanganini tanlang'); return render(); }
      if (SH.pay === 'dolg' && !SH.who.trim()) { SH.err = ui('Для долга укажите покупателя', 'Барои қарз харидорро нависед', 'Qarz uchun xaridorni yozing'); return render(); }
      var tot = shCartSum(), rc = { id: SH.cid, total: tot, pay: SH.pay, who: SH.who, ts: Date.now(), lines: SH.cart.map(function (it) { var pp = shProd(it.kod) || {}; return { name: pp.name || it.kod, qty: it.qty, u: shU(pp), price: cents(SH.pay === 'vladelec' ? pp.zakup : pp.price) }; }) };
      var parts = null; if (SH.pay === 'mix') { parts = []; var psum = 0; SH.mx = {}; ['nal', 'alif', 'dushanbe'].forEach(function (m) { var v = shNum('sh-mx-' + m); SH.mx[m] = v; var n = Number(v); if (n > 0) { parts.push({ pay: m, sum: n }); psum += cents(n); } }); if (parts.length < 2 || psum !== tot) { SH.err = ui('Сумма частей должна быть равна итогу чека (' + money(tot) + ') и частей не меньше двух', 'Маблағи қисмҳо бояд ба ҳамагӣ (' + money(tot) + ') баробар бошад, ақалан ду қисм', 'Qismlar yigʻindisi chek jamiga (' + money(tot) + ') teng boʻlishi va kamida ikkita boʻlishi kerak'); return render(); } rc.parts = parts; }
      return shAct({ action: 'sell', id: SH.cid, items: SH.cart.map(function (it) { return { kod: it.kod, qty: it.qty }; }), pay: SH.pay, who: SH.who, parts: parts, date: today() }, ui('Продано на ', 'Фурӯхта шуд ба ', 'Sotildi: ') + money(tot) + ' ' + ui('сомони', 'сомонӣ', 'somoniy'), function () { SH.last = rc; SH.payPick = false; SH.mx = null; SH.cart = []; SH.pay = ''; SH.who = ''; SH.code = ''; SH.low = ''; SH.cid = oid(); });
    }
    if (a === 'zpopen') { var zp = String(k).split('|'); SH.zpf = { who: zp[0], mode: zp[1] }; SH.err = ''; return render(); }
    if (a === 'zpcancel') { SH.zpf = null; SH.err = ''; return render(); }
    if (a === 'zpsave') {
      if (SH.busy) return; var zq = String(k).split('|'), zw = zq[0], zm = zq[1];
      if (zm === 'set') {
        var zo = Number(shNum('sh-z-oklad') || 0), zc = Number(shNum('sh-z-pct') || 0);
        if (!(zo >= 0) || !(zc >= 0 && zc <= 100)) { SH.err = ui('Оклад не меньше 0, процент от 0 до 100', 'Маош аз 0 кам не, фоиз аз 0 то 100', 'Maosh 0 dan kam emas, foiz 0 dan 100 gacha'); return render(); }
        return shAct({ action: 'sal_set', who: zw, oklad: zo, pct: zc }, ui('Оклад и процент сохранены', 'Маош ва фоиз захира шуд', 'Maosh va foiz saqlandi'), function () { SH.zpf = null; });
      }
      var za = Number(shNum('sh-z-amt'));
      if (!(za > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      return shAct({ action: 'sal_pay', who: zw, kind: zm, amount: za, id: oid(), date: today() }, ui('Записано', 'Сабт шуд', 'Yozildi'), function () { SH.zpf = null; });
    }
    if (a === 'sdopen') { SH.sdOpen = !SH.sdOpen; SH.sdRes = null; SH.err = ''; return render(); }
    if (a === 'sdok') { if (SH.busy) return; return shAct({ action: 'sdacha_ok', sdacha: k, id: oid() }, ui('Смена подтверждена', 'Смена тасдиқ шуд', 'Smena tasdiqlandi')); }
    if (a === 'sdsave') { if (SH.busy) return; var sf = shNum('sh-sd-fact'); if (sf === '' || !(Number(sf) >= 0)) { SH.err = ui('Впишите, сколько наличных в кассе (можно 0)', 'Нависед, чанд нақд дар касса аст (0 ҳам мешавад)', 'Kassadagi naqd summani yozing (0 ham boʻladi)'); return render(); } return shAct({ action: 'sdacha', id: oid(), fact: Number(sf), date: today() }, '', function () { SH.sdOpen = false; SH.sdRes = SH.d && SH.d.sdacha || null; }); }
    if (a === 'echip') { var ew = $s('sh-e-who'); if (ew) { ew.value = k; ew.focus(); } return; }
    // введённое в форме «внёс / взял» не теряется, когда экран перерисовывается
    var kKeep = function () { var g = function (id) { var e = $s(id); return e ? e.value : ''; }; SH.kv = { amt: g('sh-k-amt'), note: g('sh-k-note'), who: g('sh-k-who') }; };
    if (a === 'xlsx') {
      if (SH.xBusy) return; SH.xBusy = true; SH.err = ''; SH.ok = ''; render();
      var xm = (SH.d && SH.d.report && SH.d.report.month) || SH.month;
      return callTo('/magazin', { action: 'export', month: xm }).then(function (r) {
        SH.xBusy = false;
        if (!r || !r.ok || !r.export) { SH.err = (r && r.error) || TX('Не удалось записать'); return render(); }
        try { saveBlob(shExportXlsx(r), 'otchet-' + r.export.month + '.xlsx'); SH.ok = ui('Файл отчёта скачан', 'Файли ҳисобот гирифта шуд', 'Hisobot fayli yuklandi'); } catch (e) { SH.err = ui('Не получилось сделать файл', 'Файл сохта нашуд', 'Fayl yaratilmadi'); }
        render();
      }).catch(function () { SH.xBusy = false; SH.err = TX('нет связи'); render(); });
    }
    if (a === 'ihour') { if (SH.busy) return; return shAct({ action: 'itogi_time', hour: Number(k) }, ui('Запасное время итогов: ', 'Вақти эҳтиётии ҷамъбаст: ', 'Zaxira vaqti: ') + k + ':00'); }
    if (a === 'kopen') { SH.kOpen = !SH.kOpen; SH.kKind = ''; SH.kv = null; SH.err = ''; return render(); }
    if (a === 'kkind') { kKeep(); SH.kKind = k; SH.err = ''; return render(); }
    if (a === 'kchip') { var kw = $s('sh-k-who'); if (kw) { kw.value = k; kw.focus(); } return; }
    if (a === 'ksave') {
      if (SH.busy) return; kKeep(); var kam = Number(shNum('sh-k-amt')), kn = $s('sh-k-note'), kw2 = $s('sh-k-who');
      if (SH.kKind !== 'in' && SH.kKind !== 'out') { SH.err = ui('Выберите: внесли или взяли', 'Интихоб кунед: гузоштанд ё гирифтанд', 'Tanlang: qoʻyildi yoki olindi'); return render(); }
      if (!(kam > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      var kin = SH.kKind === 'in';
      return shAct({ action: 'kassa', kind: SH.kKind, id: oid(), amount: kam, note: kn ? kn.value : '', who: kw2 ? kw2.value : '', date: today() }, kin ? ui('Записано: внесли в кассу', 'Сабт шуд: ба касса гузоштанд', 'Yozildi: kassaga qoʻyildi') : ui('Записано: взяли из кассы', 'Сабт шуд: аз касса гирифтанд', 'Yozildi: kassadan olindi'), function () { SH.kOpen = false; SH.kKind = ''; SH.kv = null; });
    }
    if (a === 'expopen') { SH.expOpen = !SH.expOpen; SH.err = ''; return render(); }
    if (a === 'expsave') {
      if (SH.busy) return; var ea = Number(shNum('sh-e-amt')), en = $s('sh-e-note'), ew = $s('sh-e-who');
      if (!(ea > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      if (!sellerView() && !(ew && ew.value.trim())) { SH.err = ui('Укажите имя продавца', 'Номи фурӯшандаро нависед', 'Sotuvchi ismini yozing'); return render(); }
      return shAct({ action: 'expense', id: oid(), amount: ea, note: en ? en.value : '', who: ew ? ew.value : '', date: today() }, ui('Расход записан', 'Хароҷот сабт шуд', 'Xarajat yozildi'), function () { SH.expOpen = false; });
    }
    if (a === 'polki') { SH.polki = true; SH.pq = ''; return render(); }
    if (a === 'polki-put') { SH.polki = false; SH.pq = ''; SH.err = ''; SH.found = null; SH.ff = null; shPut(k); SH.code = ''; return render(); }
    if (a === 'polki-x') { SH.polki = false; SH.pq = ''; return render(); }
    if (a === 'fnew') { SH.fotoNew = ''; SH.form = { kod: '', name: '', zakup: '', marzha: '', sell: '', fsm: false }; SH.rcv = null; return render(); }
    if (a === 'addst') { if (window.open_team) window.open_team(k); return; }
    if (a === 'ansec') { var A1 = anState(); A1.sec = k; A1.msg = ''; return anLoad(); }
    if (a === 'andays') { var A2 = anState(); A2.days = Number(k); return anLoad(); }
    if (a === 'minset') { var mk0 = String(shNum('sh-m-kod') || '').trim(), mn = shNum('sh-m-min'); var A3 = anState(); if (!mk0 || mn === '') { A3.err = ui('Укажите код товара и минимум', 'Рамз ва ҳадди ақалро нависед', 'Kod va minimumni yozing'); return render(); } return callTo('/magazin', { action: 'minset', kod: mk0, min: Number(mn) }).then(function (r) { if (!r || !r.ok) A3.err = (r && r.error) || TX('Не удалось записать'); else { A3.err = ''; A3.msg = ui('Минимум сохранён', 'Ҳадди ақал захира шуд', 'Minimum saqlandi'); } anLoad(); }); }
    if (a === 'copyorder') { var A4 = anState(), txt = ((A4.data && A4.data.order) || []).map(function (x) { return x.kod + ' ' + x.name + ' — ' + shQ(x, x.suggest); }).join('\n'); try { navigator.clipboard.writeText(txt); A4.msg = ui('Список скопирован', 'Рӯйхат нусха шуд', 'Roʻyxat nusxalandi'); } catch (e) { A4.err = ui('Не удалось скопировать', 'Нусха нашуд', 'Nusxalab boʻlmadi'); } return render(); }
    if (a === 'invok' || a === 'invno' || a === 'invok1' || a === 'invno1') { var A5 = anState(), ok1 = a.indexOf('ok') === 3 || a === 'invok1', one = a.slice(-1) === '1', bd = { action: ok1 ? 'inv_ok' : 'inv_no' }; if (one) bd.ids = [k]; else bd.all = true; return callTo('/magazin', bd).then(function (r) { if (!r || !r.ok) A5.err = (r && r.error) || TX('Не удалось записать'); else { A5.err = ''; A5.msg = ok1 ? ui('Остатки исправлены по пересчёту', 'Боқимонда ислоҳ шуд', 'Qoldiqlar tuzatildi') : ui('Пересчёт отклонён', 'Ҳисобкунӣ рад шуд', 'Sanoq rad etildi'); } shLoad(); anLoad(); }); }
    if (a === 'copen') { var C1 = cntState(); C1.open = true; C1.msg = ''; C1.err = ''; if (SH.tab !== 'prihod' && SH.tab !== 'anal') SH.tab = 'prihod'; if (SH.tab === 'anal') SH.tab = 'prihod'; return render(); }
    if (a === 'cclose') { cntState().open = false; return render(); }
    if (a === 'cadd') { var C2 = cntState(), ck = String(shNum('sh-c-kod') || '').trim().toLowerCase(), cp = SH.d && SH.d.products.filter(function (p) { return p.kod.toLowerCase() === ck; })[0], cf = cp ? shQR(shU(cp), shParse(shNum('sh-c-fact'))) : NaN; if (!cp) { C2.err = ui('Товара с таким кодом нет', 'Чунин рамзи мол нест', 'Bunday kodli tovar yoʻq'); return render(); } if (!(cf >= 0) || shNum('sh-c-fact') === '') { C2.err = ui('Укажите, сколько штук по факту', 'Миқдори воқеиро нависед', 'Haqiqiy sonini yozing'); return render(); } C2.err = ''; C2.list = C2.list.filter(function (x) { return x.kod !== cp.kod; }); C2.list.unshift({ kod: cp.kod, name: cp.name, fact: cf }); return render(); }
    if (a === 'crm') { var C3 = cntState(); C3.list.splice(Number(k), 1); return render(); }
    if (a === 'csend') { var C4 = cntState(); if (!C4.list.length) { C4.err = ui('Сначала добавьте товары в список', 'Аввал молҳоро илова кунед', 'Avval tovarlarni qoʻshing'); return render(); } return callTo('/magazin', { action: 'count', id: oid(), items: C4.list.map(function (x) { return { kod: x.kod, fact: x.fact }; }) }).then(function (r) { if (!r || !r.ok) C4.err = (r && r.error) || TX('Не удалось отправить'); else { C4.err = ''; C4.list = []; C4.msg = ui('Пересчёт отправлен руководителю', 'Ҳисобкунӣ ба роҳбар фиристода шуд', 'Sanoq rahbarga yuborildi'); } render(); }); }
    if (a === 'fedit') { var p = shProd(k); if (p) SH.form = { kod: p.kod, name: p.name, zakup: p.zakup, marzha: p.marzha, sell: p.price, fsm: Number(p.sell) > 0, unit: shU(p), per: shPer(p) || '', edit: true }; if (p && shPer(p)) { SH.form.zroll = SH.form.zroll0 = String(shR2(p.zakup * shPer(p))); SH.form.sroll = SH.form.sroll0 = String(shR2(p.price * shPer(p))); } SH.rcv = null; return render(); }
    if (a === 'fcancel') { SH.fotoNew = ''; SH.form = null; SH.err = ''; return render(); }
    if (a === 'save') return shSave();
    if (a === 'rcv') { var p2 = shProd(k); if (p2) SH.rcv = { kod: p2.kod, name: p2.name }; SH.form = null; return render(); }
    if (a === 'rcancel') { SH.rcv = null; return render(); }
    if (a === 'rok') {
      var rp = shProd(SH.rcv.kod), ru = shU(rp), rq = shNum('sh-r-qty'), rpc = shNum('sh-r-pcs'), q = rq !== '' ? shQR(ru, shParse(rq)) : (rpc !== '' && shPer(rp) ? shQR(ru, Math.round(shParse(rpc)) * shPer(rp)) : NaN);
      if (shPackOn(rp)) { var pks = shPackSum(); if (pks.pk > 0 && !(pks.ps > 0)) { SH.err = ui('Укажите, сколько штук в одной упаковке', 'Нависед, дар як бастабандӣ чанд дона', 'Bitta qadoqda necha dona ekanini yozing'); return render(); } q = pks.total > 0 ? pks.total : NaN; if (pks.pk > 0 && pks.ps > 0) { try { lstore('ap_pack_' + rp.kod, String(pks.ps)); } catch (e) {} } }
      if (!(q > 0)) { SH.err = ru === 'sht' ? ui('Укажите, сколько штук пришло', 'Нависед, чанд дона омад', 'Necha dona kelganini yozing') : ui('Укажите, сколько пришло (', 'Нависед, чанд омад (', 'Qancha kelganini yozing (') + shUL(ru) + (shPer(rp) ? ui(' или штук)', ' ё дона)', ' yoki dona)') : ')'); return render(); }
      var zk = shNum('sh-r-zakup'), zrl = shNum('sh-r-zroll'), kd = SH.rcv.kod, body = { action: 'receive', kod: kd, qty: q, id: oid() }; if ($s('sh-r-shelf')) body.shelf = ($s('sh-r-shelf').value || '').trim(); if (zrl !== '' && shPer(rp) > 0) { if (!(shParse(zrl) > 0)) { SH.err = ui('Цена рулона должна быть больше нуля', 'Нархи рулон аз сифр зиёд бошад', 'Rulon narxi noldan katta boʻlsin'); return render(); } zk = String(Math.round(shParse(zrl) / shPer(rp) * 10000) / 10000); }
      if (zk) body.zakup = Number(zk);
      var dr_ = shNum('sh-r-rul'), dk_ = shNum('sh-r-kg'), dm_ = shNum('sh-r-m');
      if (dr_ !== '' && !(Math.round(shParse(dr_)) >= 0 && Math.round(shParse(dr_)) <= 100000)) { SH.err = ui('Рулонов: введите целое число', 'Рулон: рақами бутун нависед', 'Rulon: butun son kiriting'); return render(); }
      if (dr_ !== '' && Math.round(shParse(dr_)) > 0) body.rulonov = Math.round(shParse(dr_));
      if (dk_ !== '' && shParse(dk_) > 0) body.kg = shParse(dk_);
      if (dm_ !== '' && shParse(dm_) > 0) body.metry = shParse(dm_);
      var rpo = $s('sh-r-post'), rpy = $s('sh-r-pay'); body.post = rpo ? rpo.value.trim() : ''; body.post_pay = rpy ? rpy.value : '';
      if (body.post_pay === 'dolg' && !body.post) { SH.err = ui('Для долга укажите поставщика', 'Барои қарз таъминкунандаро нависед', 'Qarz uchun taʼminotchini yozing'); return render(); }
      return shAct(body, ui('Приход записан', 'Воридот сабт шуд', 'Kirim yozildi'), function () { SH.rcv = null; SH.pcode = ''; });
    }
    if (a === 'pdel') { if (SH.delAsk !== k) { SH.delAsk = k; return render(); } SH.delAsk = ''; return shAct({ action: 'product_del', kod: k }, ui('Товар удалён', 'Мол нест шуд', 'Tovar oʻchirildi')); }
    if (a === 'ppopen') { SH.ppf = k; SH.err = ''; return render(); }
    if (a === 'ppcancel') { SH.ppf = null; return render(); }
    if (a === 'ppok') {
      var pam = shNum('sh-pp-amt'), ppy = $s('sh-pp-pay'); if (!(Number(pam) > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      return shAct({ action: 'post_pay', who: SH.ppf, amount: Number(pam), pay: ppy ? ppy.value : 'nal', id: oid(), date: today() }, ui('Оплата поставщику записана', 'Пардохт ба таъминкунанда сабт шуд', 'Taʼminotchiga toʻlov yozildi'), function () { SH.ppf = null; });
    }
    if (a === 'pay-open') { SH.payf = k; SH.err = ''; return render(); }
    if (a === 'pcancel') { SH.payf = null; return render(); }
    if (a === 'pok') {
      var am = shNum('sh-p-amt'); if (!(Number(am) > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      return shAct({ action: 'pay', who: SH.payf, amount: Number(am), id: oid(), date: today() }, ui('Оплата принята', 'Пардохт қабул шуд', 'Toʻlov qabul qilindi'), function () { SH.payf = null; });
    }
    if (a === 'mprev' || a === 'mnext') { SH.month = shiftMonth(SH.month, a === 'mprev' ? -1 : 1); SH.voidAsk = ''; render(); return shLoad(); }
    if (a === 'void') { if (SH.voidAsk !== k) { SH.voidAsk = k; return render(); } SH.voidAsk = ''; var isChk = !!(SH.d && SH.d.report && (SH.d.report.checks || []).some(function (c) { return c.id === k; })); return shAct({ action: 'void', id: k }, isChk ? ui('Продажа отменена, товар вернулся на склад', 'Фурӯш бекор шуд, мол ба анбор баргашт', 'Sotuv bekor qilindi, tovar omborga qaytdi') : ui('Запись отменена', 'Сабт бекор шуд', 'Yozuv bekor qilindi'), function () { /* убираем чек из списка сразу, без перезагрузки */ var RR = SH.d && SH.d.report; if (RR && RR.checks) RR.checks = RR.checks.filter(function (c) { return c.id !== k; }); }); }
  }
  function shSave() {
    var fu = $s('sh-f-unit'), f = { kod: ($s('sh-f-kod').value || '').trim(), name: ($s('sh-f-name').value || '').trim(), zakup: shNum('sh-f-zakup'), marzha: shNum('sh-f-marzha'), sell: shNum('sh-f-sell'), fsm: !!(SH.form && SH.form.fsm), unit: fu && SH_U[fu.value] ? fu.value : 'sht', per: shNum('sh-f-per') };
    var zrl2 = SH.form && SH.form.zrTyped ? shNum('sh-f-zroll') : '', srl2 = SH.form && SH.form.srTyped ? shNum('sh-f-sroll') : '', per2 = shParse(f.per);
    if ((zrl2 !== '' || srl2 !== '') && !(f.unit !== 'sht' && per2 > 0)) { SH.form = Object.assign({ edit: SH.form && SH.form.edit }, f); SH.err = ui('Чтобы считать по рулону, впишите, сколько ' + shUL(f.unit) + ' в одном рулоне', 'Барои ҳисоб аз рӯи рулон нависед, ки дар як рулон чанд ' + shUL(f.unit) + ' аст', 'Rulon boʻyicha hisoblash uchun bir rulonda necha ' + shUL(f.unit) + ' borligini yozing'); return render(); }
    if (zrl2 !== '') f.zakup = String(Math.round(shParse(zrl2) / per2 * 10000) / 10000);
    if (srl2 !== '') { f.sell = String(Math.round(shParse(srl2) / per2 * 10000) / 10000); f.fsm = true; }
    SH.form = Object.assign({ edit: SH.form && SH.form.edit }, f);
    if (!f.kod || !/^[A-Za-z0-9_-]+$/.test(f.kod)) { SH.err = ui('Код: только латинские буквы и цифры', 'Рамз: танҳо ҳарфҳои лотинӣ ва рақамҳо', 'Kod: faqat lotin harflari va raqamlar'); return render(); }
    if (!f.name) { SH.err = ui('Введите название', 'Номро нависед', 'Nomini yozing'); return render(); }
    if (!(Number(f.zakup) > 0)) { SH.err = ui('Закупочная цена должна быть больше нуля', 'Нархи харид аз сифр зиёд бошад', 'Xarid narxi noldan katta boʻlsin'); return render(); }
    if (f.fsm && !(shParse(f.sell) > 0)) { SH.err = ui('Цена продажи должна быть больше нуля', 'Нархи фурӯш аз сифр зиёд бошад', 'Sotuv narxi noldan katta boʻlsin'); return render(); }
    if (!f.fsm && (f.marzha === '' || !(Number(f.marzha) >= 0 && Number(f.marzha) <= 1000))) { SH.err = ui('Маржа: число от 0 до 1000', 'Маржа: адад аз 0 то 1000', 'Marja: 0 dan 1000 gacha son'); return render(); }
    if (f.unit !== 'sht' && f.per !== '' && !(shParse(f.per) > 0)) { SH.err = ui('«Сколько в одной штуке» — число больше нуля или пусто', '«Дар як дона чанд» — адади аз сифр зиёд ё холӣ', '«Bir donada qancha» — noldan katta son yoki boʻsh'); return render(); }
    if (!SH.form.edit && shProd(f.kod)) { SH.err = ui('Товар с таким кодом уже есть', 'Чунин рамзи мол аллакай ҳаст', 'Bunday kodli tovar bor'); return render(); }
    return shAct({ action: 'product', shelf: $s('sh-f-shelf') ? String($s('sh-f-shelf').value || '').trim() : undefined, p: { kod: f.kod, name: f.name, zakup: Number(f.zakup), marzha: f.fsm ? 0 : Number(f.marzha), sell: f.fsm ? shR2(shParse(f.sell)) : 0, unit: f.unit, per: f.unit === 'sht' || f.per === '' ? 0 : shQR(f.unit, shParse(f.per)), foto: SH.fotoNew || undefined } }, ui('Товар сохранён', 'Мол захира шуд', 'Tovar saqlandi'), function () { SH.form = null; if (SH.fotoNew) SH_F[f.kod] = SH.fotoNew; SH.fotoNew = ''; });
  }
  function shLive(e) {
    var t = e.target; if (!t) return;
    if (t.id === 'sh-code' && e.type === 'keydown' && e.key === 'Enter') { e.preventDefault(); shopClick({ dataset: { shop: 'add' } }); return; }
    if (t.id === 'sh-code' && e.type === 'input') { SH.code = t.value; SH.found = null; SH.ff = null; var hb = $s('sh-hints'); if (hb) hb.innerHTML = shHintsHtml(); return; }
    if (e.type === 'input' && t.dataset && t.dataset.cq) { var cp0 = shProd(t.dataset.cq), cv = shParse(t.value); if (cp0 && cv >= 0) { SH.cart.forEach(function (it) { if (it.kod === t.dataset.cq) { it.qty = shQR(shU(cp0), cv); var ls = $s('sh-ls-' + it.kod); if (ls) ls.innerHTML = shLineTxt(cp0, SH.pay === 'vladelec' ? cp0.zakup : cp0.price, it.qty); } }); var tt = $s('sh-total'); if (tt) { var tb = tt.querySelector('b'); if (tb) tb.textContent = money(shCartSum()) + ' ' + ui('сом.', 'сом.', 'som'); } } return; }
    if (e.type === 'input' && t.id === 'sh-f-unit') { var pb2 = $s('sh-f-perbox'), pl2 = $s('sh-f-perl'); if (pb2) pb2.hidden = t.value === 'sht'; if (pl2) pl2.textContent = shPerLabel(t.value); var rb2 = $s('sh-f-rollbox'); if (rb2) rb2.hidden = !(t.value === 'm' || t.value === 'kg'); }
    if (t.id === 'sh-b-q' && e.type === 'input' && SH.bind) { SH.bind.q = t.value; var bh = $s('sh-bhints'); if (bh) bh.innerHTML = shBindHints(); return; }
    if (t.id === 'apt-f-name' && e.type === 'input') { var sg0 = $s('apt-f-sug'); if (sg0) sg0.innerHTML = (AP.form && AP.form.old) ? '' : aptSugHtml(t.value); return; }
    if (t.id === 'apt-polki-q' && e.type === 'input') { AP.pq = t.value; AP.pg = null; var apq = $s('apt-polki-list'); if (apq) apq.innerHTML = aptPolkiList(); return; }
    if (t.id === 'apt-q' && e.type === 'input') { AP.q = t.value; AP.msg = ''; var apl = $s('apt-list'); if (apl) apl.innerHTML = aptList(); return; }
    if (t.id === 'sh-polki-q' && e.type === 'input') { SH.pq = t.value; var plb = $s('sh-polki-list'); if (plb) plb.innerHTML = shPolkiList(); return; }
    if (t.id === 'sh-pcode' && e.type === 'input') { SH.pcode = t.value; var pb = $s('sh-phints'); if (pb) pb.innerHTML = shPHints(); return; }
    if (t.id === 'shx-who' && e.type === 'input') { SH.who = t.value; var wb = $s('sh-whohint'); if (wb) wb.innerHTML = shWhoHtml(); return; }
    if (e.type === 'input' && (t.id === 'sh-r-pk' || t.id === 'sh-r-pks' || t.id === 'sh-r-qty')) { var pkt = $s('sh-r-pktot'); if (pkt) pkt.textContent = shPackTxt(); }
    if (e.type === 'input' && (t.id === 'sh-r-zroll' || t.id === 'sh-r-zakup')) {
      var rpv = shProd(SH.rcv && SH.rcv.kod), rvo = $s('sh-r-prev');
      if (rpv && rvo) {
        var rper = shPer(rpv), rz = shParse(shNum('sh-r-zakup')), rzr = shParse(shNum('sh-r-zroll'));
        if (t.id === 'sh-r-zroll' && rper > 0 && rzr > 0) { var rzi = $s('sh-r-zakup'); if (rzi) { rz = rzr / rper; rzi.value = shNumTxt(Math.round(rz * 10000) / 10000); } }
        else if (t.id === 'sh-r-zakup' && rper > 0) { var rzx = $s('sh-r-zroll'); if (rzx) rzx.value = rz > 0 ? shNumTxt(shR2(rz * rper)) : ''; }
        rvo.textContent = rz > 0 ? shPrevTxt(rpv, rz, Number(rpv.sell) > 0 ? Number(rpv.price) : rz * (1 + Number(rpv.marzha) / 100)) : '';
      }
      return;
    }
    if (e.type === 'input' && (t.id === 'sh-f-zakup' || t.id === 'sh-f-marzha' || t.id === 'sh-f-sell' || t.id === 'sh-f-zroll' || t.id === 'sh-f-sroll' || t.id === 'sh-f-per')) {
      var F0 = SH.form || (SH.form = {}), fper = shParse(shNum('sh-f-per')), fu0 = $s('sh-f-unit'), rollOk = fper > 0 && fu0 && (fu0.value === 'm' || fu0.value === 'kg');
      if (t.id === 'sh-f-zroll') { F0.zrTyped = shNum('sh-f-zroll') !== ''; if (rollOk && F0.zrTyped) { var zi = $s('sh-f-zakup'); if (zi) zi.value = shNumTxt(Math.round(shParse(shNum('sh-f-zroll')) / fper * 10000) / 10000); } }
      if (t.id === 'sh-f-sroll') { F0.srTyped = shNum('sh-f-sroll') !== ''; if (rollOk && F0.srTyped) { var si = $s('sh-f-sell'); if (si) si.value = shNumTxt(Math.round(shParse(shNum('sh-f-sroll')) / fper * 10000) / 10000); F0.fsm = true; } }
      if (t.id === 'sh-f-per' && rollOk) { if (F0.zrTyped) { var zi2 = $s('sh-f-zakup'); if (zi2) zi2.value = shNumTxt(Math.round(shParse(shNum('sh-f-zroll')) / fper * 10000) / 10000); } if (F0.srTyped) { var si2 = $s('sh-f-sell'); if (si2) si2.value = shNumTxt(Math.round(shParse(shNum('sh-f-sroll')) / fper * 10000) / 10000); } }
      if (t.id === 'sh-f-zakup') F0.zrTyped = false;
      if (t.id === 'sh-f-sell') F0.srTyped = false;
      var z = shParse(shNum('sh-f-zakup')), fs = $s('sh-f-sell'), fm = $s('sh-f-marzha'), o = $s('sh-f-price');
      if (t.id === 'sh-f-sell') F0.fsm = shNum('sh-f-sell') !== '';
      if (t.id === 'sh-f-sroll') F0.fsm = true;
      if (t.id === 'sh-f-marzha') F0.fsm = false;
      if (F0.fsm) { var sv = shParse(shNum('sh-f-sell')); if (fm && z > 0 && sv > 0) fm.value = shNumTxt(shR2((sv / z - 1) * 100)); }
      else { var mv = shParse(shNum('sh-f-marzha')); if (fs && z > 0 && mv >= 0 && shNum('sh-f-marzha') !== '') fs.value = shNumTxt(shR2(z * (1 + mv / 100))); }
      if (rollOk) {
        var zz = shParse(shNum('sh-f-zakup')), ss = shParse(shNum('sh-f-sell')), zr = $s('sh-f-zroll'), sr = $s('sh-f-sroll');
        if (zr && t.id !== 'sh-f-zroll') zr.value = zz > 0 ? shNumTxt(shR2(zz * fper)) : '';
        if (sr && t.id !== 'sh-f-sroll') sr.value = ss > 0 ? shNumTxt(shR2(ss * fper)) : '';
      }
      if (o) o.textContent = shSellNote(F0.fsm) + (rollOk && shParse(shNum('sh-f-zakup')) > 0 ? ' ' + shPrevTxt({ unit: fu0.value, per: fper }, shParse(shNum('sh-f-zakup')), shParse(shNum('sh-f-sell'))) : '');
    }
  }
  document.addEventListener('keydown', shLive); document.addEventListener('input', shLive);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.id === 'apt-cfoto-in' && t.files && t.files[0]) {
      var cn = String(t.dataset.n || '').trim(); if (!cn) return; var cfile = t.files[0];
      shFotoMake(t.files[0], function (img) {
        if (!img) { AP.err = ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'); if (S.view === 'apt') render(); return; }
        var ck = aptKb(cn), cf = aptFind(cn.toLowerCase()).filter(function (x) { return x.name === cn; })[0] || {};
        var cp = (ck && ck.polka) || cf.shelf || '', ct = (ck && ck.text) || cf.text || '', cq = (ck && ck.kolvo) || '';
        callTo('/spravochnik', { action: 'add', name: cn, polka: cp, opisanie: ct, kolvo: cq, foto: img }).then(function (r) {
          if (!r || !r.ok) { AP.err = (r && r.error) || TX('Не удалось записать'); if (S.view === 'apt') render(); return; }
          if (ck) ck.foto = img; else (AP.kb = AP.kb || []).push({ name: cn, polka: cp, text: ct, kolvo: cq, foto: img });
          delete FB[cn.toLowerCase()]; shFotoHQ(cfile, function (hq) { if (hq) { FB[cn.toLowerCase()] = hq; fbCall({ action: 'save', name: cn, foto: hq }); } });
          AP.err = ''; AP.msg = ui('Фото сохранено', 'Акс захира шуд', 'Rasm saqlandi'); if (S.view === 'apt') render();
        });
      });
      return;
    }
    if (t && t.id === 'apt-multi-in' && t.files && t.files[0]) {
      AP.multi = { busy: true, items: [], err: '', polka: '' }; render();
      aptMultiRead(t.files[0], function (rd) {
        if (!AP.multi) return;
        if (!rd) { AP.multi = { busy: false, items: [], err: ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'), polka: '' }; if (S.view === 'apt') render(); return; }
        /* Снимок режем на части с перекрытием и читаем каждую отдельно — так находятся все упаковки, а не одна-две */
        var tileFlow = function () {
        var tiles = aptTiles(rd.canvas), all = [], seenK = {}, okAny = false, errMsg = '', ti = 0, run = 0, fin = 0;
        var finish = function () {
          if (!AP.multi) return;
          all.forEach(function (x) { x.dup = aptExact(x.full); x.sel = !x.dup; });
          AP.multi = { busy: false, prog: '', items: all, err: (!okAny && errMsg) ? errMsg : '', polka: '' };
          if (S.view === 'apt') render();
        };
        var next = function () {
          if (!AP.multi) return;
          if (ti >= tiles.length) { if (run === 0) finish(); return; }
          var tl = tiles[ti++]; run++;
          callTo('/preparat-spisok', { foto: tl.data }).then(function (r) {
            run--; fin++;
            if (r && r.ok) {
              okAny = true;
              (r.items || []).forEach(function (x) {
                var key = String(x.full || '').toLowerCase(); if (seenK[key]) return; seenK[key] = 1;
                var bx = null; if (x.box) bx = [(tl.ox + x.box[0] / 1000 * tl.w) / rd.canvas.width * 1000, (tl.oy + x.box[1] / 1000 * tl.h) / rd.canvas.height * 1000, (tl.ox + x.box[2] / 1000 * tl.w) / rd.canvas.width * 1000, (tl.oy + x.box[3] / 1000 * tl.h) / rd.canvas.height * 1000];
                all.push({ full: x.full, doza: x.doza || '', foto: aptCrop(rd.canvas, bx), dup: false, sel: true });
              });
            } else errMsg = (r && r.error) || ui('Не удалось прочитать, попробуйте ещё раз', 'Хонда нашуд, боз кӯшиш кунед', 'Oʻqib boʻlmadi, qayta urinib koʻring');
            if (AP.multi) { AP.multi.prog = fin + '/' + tiles.length; var pe = $s('apt-m-prog'); if (pe) pe.textContent = AP.multi.prog; }
            next();
          });
        };
        next(); next();
        };
        /* Сначала находим рамку каждой упаковки, вырезаем её целиком и читаем отдельно — у каждого препарата своё фото */
        callTo('/preparat-spisok', { foto: rd.big, mode: 'boxes' }).then(function (r) {
          if (!AP.multi) return;
          var bs = (r && r.ok && r.items) ? r.items.map(function (x) { return x.box; }).filter(Boolean) : [], keep = [];
          bs.forEach(function (b) { if (!keep.some(function (k) { return aptIou(k, b) > 0.5; })) keep.push(b); });
          if (keep.length < 2) return tileFlow();
          keep = keep.slice(0, 20);
          var res = [], idx = 0, running = 0, doneN = 0, unread = 0;
          var fin2 = function () {
            if (!AP.multi) return;
            var all = res.filter(Boolean);
            all.forEach(function (x) { x.dup = aptExact(x.full); x.sel = !x.dup; });
            AP.multi = { busy: false, prog: '', items: all, err: unread ? ui('Не прочиталось упаковок: ', 'Қуттиҳои хонда нашуда: ', 'Oʻqilmagan qadoqlar: ') + unread + ui('. Снимите их ближе.', '. Наздиктар аксбардорӣ кунед.', '. Yaqinroqdan suratga oling.') : '', polka: '' };
            if (S.view === 'apt') render();
          };
          var go = function () {
            if (!AP.multi) return;
            if (idx >= keep.length) { if (running === 0) fin2(); return; }
            var i = idx++, bx = keep[i]; running++;
            var big = aptCropSz(rd.hq || rd.canvas, bx, 1600, 0.06), th = aptCrop(rd.canvas, bx);
            var after = function (rr) {
              running--; doneN++;
              if (rr && rr.ok && (rr.full || rr.name)) res[i] = { full: rr.full || rr.name, doza: rr.doza || '', foto: th, dup: false, sel: true }; else unread++;
              if (AP.multi) { AP.multi.prog = doneN + '/' + keep.length; var pe = $s('apt-m-prog'); if (pe) pe.textContent = AP.multi.prog; }
              go();
            };
            if (!big) return after(null);
            callTo('/preparat-foto', { foto: big, thumb: th }).then(after);
          };
          go(); go();
        });
      });
      return;
    }
    if (t && t.id === 'apt-foto-in' && t.files && t.files[0]) {
      var gv2 = function (id) { var e2 = $s(id); return e2 ? (e2.value || '').trim() : ''; };
      var keep = { name: gv2('apt-f-name'), polka: gv2('apt-f-polka'), kolvo: gv2('apt-f-kolvo'), opisanie: gv2('apt-f-text'), foto: (AP.form && AP.form.foto) || '', old: AP.form && AP.form.old, shop: AP.form && AP.form.shop };
      var fl = t.files[0];
      shFotoMake(fl, function (img) {
        if (!AP.form) return;
        AP.form = keep;
        if (!img) { AP.err = ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'); if (S.view === 'apt') render(); return; }
        AP.form.foto = img; AP.form.fotob = ''; AP.err = ''; AP.fbusy = true; if (S.view === 'apt') render();
        shFotoHQ(fl, function (hq) { if (AP.form && AP.form.foto === img) AP.form.fotob = hq; });
        /* Название читает ИИ (Groq, запасной OpenAI) и вписывает в строку; фото при этом всё равно сохранится */
        var done = function (nm, er) {
          AP.fbusy = false;
          if (AP.form) { if (nm) AP.form.name = nm; AP.err = er || ''; }
          if (S.view === 'apt' && AP.form) render();
        };
        if (keep.old) return done('', '');
        shFotoBig(fl, function (big) {
          if (!big) return done('', '');
          callTo('/preparat-foto', { foto: big, thumb: img }).then(function (r) {
            var nm = r && r.ok ? (r.full || r.name || '') : '';
            if (nm && !r.doza) return done(nm, ui('Доза не прочиталась — выберите из списка ниже или допишите сами. Фото сохранится.', 'Миқдор хонда нашуд — аз рӯйхати поён интихоб кунед ё дастӣ нависед. Акс захира мешавад.', 'Doza oʻqilmadi — pastdagi roʻyxatdan tanlang yoki yozing. Rasm saqlanadi.'));
            if (nm) return done(nm, '');
            done('', ui('Название не прочиталось — впишите его вручную. Фото сохранится.', 'Ном хонда нашуд — дастӣ нависед. Акс захира мешавад.', 'Nom oʻqilmadi — qoʻlda yozing. Rasm saqlanadi.'));
          });
        });
      });
      return;
    }
    if (t && t.id === 'sh-ff-in' && t.files && t.files[0]) { SH.ff = { busy: true, list: [], note: '', err: '', img: '' }; render(); shFotoBig(t.files[0], function (img) { if (!img) { SH.ff = { busy: false, list: [], note: '', err: ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'), img: '' }; return render(); } shFfSend(img); }); return; }
    if (!t || t.id !== 'sh-foto-in' || !t.files || !t.files[0]) return; var mode = t.dataset.k, file = t.files[0];
    shFotoMake(file, function (img) {
      if (!img) { SH.err = ui('Не удалось обработать фото, попробуйте ещё раз', 'Акс коркард нашуд, боз кӯшиш кунед', 'Rasmni qayta ishlab boʻlmadi, qayta urinib koʻring'); return render(); }
      if (mode === 'new') {
        var g = function (id) { var x = $s(id); return x ? x.value : ''; }, ff = SH.form || {}; SH.form = Object.assign(ff, { kod: g('sh-f-kod'), name: g('sh-f-name'), zakup: g('sh-f-zakup'), marzha: g('sh-f-marzha'), sell: g('sh-f-sell'), unit: g('sh-f-unit') || ff.unit || 'sht', per: g('sh-f-per') });
        SH.fotoNew = img; SH.err = ''; return render();
      }
      if (mode === 'rcv' && SH.rcv) { var kd = SH.rcv.kod; return shAct({ action: 'foto', kod: kd, foto: img }, ui('Фото сохранено', 'Акс захира шуд', 'Rasm saqlandi'), function () { SH_F[kd] = img; }); }
    });
  });
  /* Двойной тап по названию полки — можно дать ей имя */
  (function () {
    var lastP = 0, lastK = '';
    function startEdit(k) { if (!k || !AP.polki) return; AP.pedit = k; render(); setTimeout(function () { var i = $s('apt-pn-in'); if (i) { i.focus(); i.select(); } }, 60); }
    document.addEventListener('touchend', function (e) {
      var h = e.target && e.target.closest ? e.target.closest('[data-pn]') : null; if (!h) return;
      var k = h.getAttribute('data-pn'), t = Date.now();
      if (k === lastK && t - lastP < 350) { lastP = 0; e.preventDefault(); startEdit(k); } else { lastP = t; lastK = k; }
    }, { passive: false });
    document.addEventListener('dblclick', function (e) { var h = e.target && e.target.closest ? e.target.closest('[data-pn]') : null; if (h) startEdit(h.getAttribute('data-pn')); });
  })();
  /* Полноразмерные фото препаратов: в списке лежит маленькое, крупное хранится отдельно и подгружается при увеличении */
  var FB = {};
  function shFotoHQ(file, cb) {
    var rd = new FileReader(); rd.onerror = function () { cb(''); };
    rd.onload = function () {
      var im = new Image(); im.onerror = function () { cb(''); };
      im.onload = function () {
        var sides = [2000, 1600, 1280, 1000], qs = [0.92, 0.86, 0.78, 0.7, 0.6];
        for (var a = 0; a < sides.length; a++) {
          var k = Math.min(1, sides[a] / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), c = document.createElement('canvas');
          c.width = w; c.height = h; var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
          for (var i = 0; i < qs.length; i++) { var o = c.toDataURL('image/jpeg', qs[i]); if (o.length <= 1000000) return cb(o); }
        }
        cb('');
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  }
  function fbCall(body) { try { return callTo('/foto-big', body).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
  /* Тап по маленькому фото препарата — открывается крупно; тап по тёмному фону закрывает */
  (function () {
    var last = 0;
    function zoomFoto(src, from) {
      /* окно сотрудника — отдельный слой, а не m-spec: показываем фото в том же окне, где нажали */
      var d = (from && from.closest && (from.closest('dialog') || (from.closest('#kas-body') && from.closest('#kas-body').parentNode))) || $s('m-spec') || document.body; if (!d || !src || $s('apt-zoom')) return;
      var o = document.createElement('div'); o.id = 'apt-zoom';
      o.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out';
      o.innerHTML = '<img alt="" src="' + src + '" style="width:min(96vw,900px);max-height:92vh;object-fit:contain;border-radius:12px;background:#fff"><span style="position:absolute;top:12px;right:18px;color:#fff;font-size:34px;line-height:1">×</span>';
      o.addEventListener('click', function () { o.remove(); });
      d.appendChild(o);
      /* подгружаем крупное фото (если оно есть) и подменяем маленькое */
      var nm = from && from.getAttribute ? String(from.getAttribute('data-nm') || '').trim().toLowerCase() : '';
      if (nm) {
        var put = function (big) { var zi = o.querySelector('img'); if (big && zi && o.parentNode) zi.src = big; };
        if (FB[nm]) put(FB[nm]);
        else if (FB[nm] === undefined) fbCall({ action: 'get', name: nm }).then(function (r) { var big = r && r.ok && r.foto || ''; FB[nm] = big; put(big); });
      }
    }
    /* Одно касание по фото — сразу открывается крупно (телефон и компьютер дают click) */
    /* iPhone (Safari): двойное касание часто превращается в масштаб страницы или не даёт touchend — ловим ещё и по click и отключаем масштаб страницы на фото */
    try { var zs = document.createElement('style'); zs.textContent = 'img[data-zoom]{touch-action:manipulation;cursor:pointer;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}'; document.head.appendChild(zs); } catch (er) {}
    document.addEventListener('click', function (e) {
      var im = e.target && e.target.closest ? e.target.closest('img[data-zoom]') : null; if (!im) return;
      e.preventDefault(); zoomFoto(im.src, im);
    });
  })();
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.chip) { var nf = $s('bh-note'); if (nf) { nf.value = b.dataset.chip === 'Другое' ? '' : b.dataset.chip; nf.focus(); } return; }
    if (b.dataset.apt === 'mic') { aptMic(); return; }
    if (b.dataset.apt === 'polki') { if (shPolkiOn()) { AP.polki = true; AP.pq = ''; render(); } return; }
    if (b.dataset.apt === 'pn-x') { AP.pedit = null; render(); return; }
    if (b.dataset.apt === 'pn-ok') {
      var pk = b.dataset.k, pv = ($s('apt-pn-in') && $s('apt-pn-in').value || '').trim();
      b.disabled = true;
      callTo('/polki-imena', { action: 'set', polka: pk, imya: pv }).then(function (r) {
        b.disabled = false;
        if (!r || !r.ok) { AP.err = (r && r.error) || TX('Не удалось записать'); render(); return; }
        AP.pn = AP.pn || {}; if (pv) AP.pn[pk] = pv; else delete AP.pn[pk];
        AP.pedit = null; AP.err = ''; render();
      });
      return;
    }
    if (b.dataset.apt === 'popen') { AP.polki = false; AP.pq = ''; AP.q = String(b.dataset.n || ''); AP.msg = ''; AP.err = ''; AP.card = true; AP.delAsk = ''; render(); return; }
    if (b.dataset.apt === 'cback') { AP.card = false; AP.q = ''; AP.msg = ''; AP.err = ''; if (shPolkiOn()) { AP.polki = true; AP.pq = ''; } render(); return; }
    if (b.dataset.apt === 'pdel' || b.dataset.apt === 'pdel-no') { AP.delAsk = b.dataset.apt === 'pdel' ? String(b.dataset.n || '') : ''; var pl2 = $s('apt-polki-list'); if (pl2) pl2.innerHTML = aptPolkiList(); return; }
    if (b.dataset.apt === 'pdel-yes') {
      var dn = String(b.dataset.n || ''); if (!dn) return; b.disabled = true;
      callTo('/spravochnik', { action: 'delete', name: dn }).then(function (r) {
        AP.delAsk = '';
        if (r && r.ok) { fbCall({ action: 'delete', name: dn }); delete FB[dn.trim().toLowerCase()]; AP.kb = (AP.kb || []).filter(function (x) { return String(x.name || '').trim().toLowerCase() !== dn.trim().toLowerCase(); }); AP.msg = ui('Препарат удалён', 'Дору нест карда шуд', 'Dori oʻchirildi'); AP.err = ''; }
        else AP.err = (r && r.error) || TX('Не удалось удалить');
        if (S.view === 'apt') render();
      });
      return;
    }

    if (b.dataset.apt === 'exit-ask') { AP.exitAsk = true; render(); return; }
    if (b.dataset.apt === 'exit-no') { AP.exitAsk = false; render(); return; }
    if (b.dataset.apt === 'ppage') { AP.pg = parseInt(b.dataset.p, 10) || 0; var apl = $s('apt-polki-list'); if (apl) { apl.innerHTML = aptPolkiList(); try { apl.scrollIntoView({ block: 'start' }); } catch (e) {} } return; }
    if (b.dataset.apt === 'polki-x') { AP.polki = false; AP.pq = ''; render(); return; }
    if (b.dataset.apt === 'multi') { var mi = $s('apt-multi-in'); if (mi && !(AP.multi && AP.multi.busy)) { mi.value = ''; mi.click(); } return; }
    if (b.dataset.apt === 'mcancel') { AP.multi = null; render(); return; }
    if (b.dataset.apt === 'mtoggle') { if (!AP.multi) return; var mp = $s('apt-m-polka'); if (mp) AP.multi.polka = mp.value; var mx = AP.multi.items[Number(b.dataset.i)]; if (mx) mx.sel = !mx.sel; render(); return; }
    if (b.dataset.apt === 'msave') {
      if (!AP.multi) return; var mpp = $s('apt-m-polka'); if (mpp) AP.multi.polka = (mpp.value || '').trim();
      var todo = AP.multi.items.filter(function (x) { return x.sel; }), mpol = AP.multi.polka || '', done = 0, bad = 0;
      if (!todo.length) return; b.disabled = true; b.textContent = '⏳ 0/' + todo.length;
      var step = function (i) {
        if (i >= todo.length) {
          AP.multi = null; AP.q = ''; AP.err = bad ? ui('Не записалось: ', 'Сабт нашуд: ', 'Yozilmadi: ') + bad : ''; AP.msg = ui('Добавлено препаратов: ', 'Доруҳо илова шуд: ', 'Qoʻshilgan dorilar: ') + done; if (S.view === 'apt') render(); return;
        }
        var x = todo[i];
        callTo('/spravochnik', { action: 'add', name: x.full, polka: mpol, opisanie: '', kolvo: '', foto: x.foto || '', old: '' }).then(function (r) {
          if (r && r.ok) { done++; var k = aptKb(x.full); if (k) { k.polka = mpol; k.foto = x.foto || k.foto; } else (AP.kb = AP.kb || []).push({ name: x.full, polka: mpol, text: '', kolvo: '', foto: x.foto || '' }); } else bad++;
          b.textContent = '⏳ ' + (i + 1) + '/' + todo.length; step(i + 1);
        });
      };
      step(0); return;
    }
    if (b.dataset.apt === 'pick') {
      var px = (AP.sug || [])[Number(b.dataset.i)]; if (!px || !AP.form) return;
      var gv = function (id) { var e1 = $s(id); return e1 ? (e1.value || '').trim() : ''; };
      var pf = AP.form; AP.form = { name: px.n, polka: px.sh || gv('apt-f-polka'), opisanie: px.tx || gv('apt-f-text'), kolvo: px.kq || gv('apt-f-kolvo'), foto: pf.foto || '', fotob: pf.fotob || '', old: pf.old, shop: pf.shop }; AP.err = ''; render(); return;
    }
    if (b.dataset.apt === 'team') { if (window.open_team && objOn()) window.open_team('apteka'); return; }
    if (b.dataset.apt === 'edit') {
      var en = String(b.dataset.n || ''), ec = aptFind(en.toLowerCase()).filter(function (x) { return x.name === en; })[0];
      if (!ec) return; var ek = aptKb(en) || {};
      AP.form = { name: ec.name, polka: ec.shelf || '', kolvo: ek.kolvo || ec.kolvo || '', opisanie: ec.text || '', foto: ec.foto || '', old: ec.name, shop: !!ec.shop }; AP.err = ''; AP.msg = ''; render(); return;
    }
    if (b.dataset.apt === 'cfoto') { var cfi = $s('apt-cfoto-in'); if (cfi) { cfi.dataset.n = b.dataset.n || ''; cfi.value = ''; cfi.click(); } return; }
    if (b.dataset.apt === 'foto') { var afi = $s('apt-foto-in'); if (afi && !AP.fbusy) { afi.value = ''; afi.click(); } return; }
    if (b.dataset.apt === 'new') { AP.form = { name: AP.q || '' }; AP.err = ''; AP.msg = ''; render(); return; }
    if (b.dataset.apt === 'fcancel') { AP.form = null; AP.err = ''; render(); return; }
    if (b.dataset.apt === 'fsave') {
      var an = ($s('apt-f-name').value || '').trim(), ap = ($s('apt-f-polka').value || '').trim(), at = ($s('apt-f-text').value || '').trim(), ak = ($s('apt-f-kolvo').value || '').trim();
      var af = (AP.form && AP.form.foto) || '', ao = (AP.form && AP.form.old) || '', ash = AP.form && AP.form.shop, afb = (AP.form && AP.form.fotob) || '';
      AP.form = { name: an, polka: ap, opisanie: at, kolvo: ak, foto: af, old: ao, shop: ash, fotob: afb };
      if (an.length < 2) { AP.err = ui('Впишите название препарата', 'Номи доруро нависед', 'Dori nomini yozing'); render(); return; }
      b.disabled = true;
      callTo('/spravochnik', { action: 'add', name: an, polka: ap, opisanie: at, kolvo: ak, foto: af, old: ao }).then(function (r) {
        if (!r || !r.ok) { AP.err = (r && r.error) || TX('Не удалось записать'); b.disabled = false; if (S.view === 'apt') render(); return; }
        if (ao && ao.toLowerCase() !== an.toLowerCase()) AP.kb = (AP.kb || []).filter(function (x) { return String(x.name || '').toLowerCase() !== ao.toLowerCase(); });
        var k = aptKb(an); if (k) { k.polka = ap; k.text = at; k.kolvo = ak; k.foto = af; } else (AP.kb = AP.kb || []).push({ name: an, polka: ap, text: at, kolvo: ak, foto: af });
        var fbp = Promise.resolve(); if (ao && ao.toLowerCase() !== an.toLowerCase()) { fbp = fbCall({ action: 'move', name: an, old: ao }); delete FB[ao.trim().toLowerCase()]; }
        delete FB[an.trim().toLowerCase()]; if (afb) { fbp = fbp.then(function () { return fbCall({ action: 'save', name: an, foto: afb }); }); FB[an.trim().toLowerCase()] = afb; }
        AP.form = null; AP.err = ''; AP.q = an; AP.msg = ao ? ui('Изменения сохранены', 'Тағйирот захира шуд', 'Oʻzgarishlar saqlandi') : ui('Препарат добавлен', 'Дору илова шуд', 'Dori qoʻshildi'); if (S.view === 'apt') render();
      });
      return;
    }
    if (b.dataset.apt === 'manage') { if (objOn() && shopOn()) { S.view = 'fin'; render(); } return; }
    if (b.hasAttribute('data-sp-back')) { if (b.getAttribute('data-sp-back') === 'fin' && shopOn()) { S.fromFin = false; S.view = 'fin'; render(); return; } S.fromFin = false; $s('m-spec').close(); return; }
    if (false) { if (b.dataset.sp === 'seller') { $s('m-spec').close(); return; } if (b.dataset.sp === 'buh') return openBuh(); S.view = b.dataset.sp; return render(); }
    if (b.dataset.pa) return paClick(b);
    if (b.dataset.asst) return asstClick(b);
    if (b.dataset.onb) return onbClick(b);
if (b.dataset.fin) { if (b.dataset.fin === 'apt') { if (objOn() && shopOn()) openApt(); return; } if (b.dataset.fin === 'shop') { if (shopOn()) { S.fromFin = true; openShop(); } return; } if (b.dataset.fin === 'push') { pushEnable(); return; } if (b.dataset.fin === 'team') { if (shopOn() && owner() && window.open_team) { var mst = $s('m-spec'); window.open_team('fin'); } return; }
if (b.dataset.fin === 'kl') { if (shopOn()) { S.fromFin = true; openShop(); SH.kl = true; SH.tab = 'prihod'; render(); } return; } S.fromFin = true; return openBuh(); }
if (b.dataset.obj) return objClick(b.dataset.obj);
if (b.dataset.pk) return pkClick(b.dataset.pk);
if (b.dataset.shop) return shopClick(b);
if (b.dataset.smm) return smmClick(b.dataset.smm);
if (b.dataset.law) return lawClick(b.dataset.law);
if (b.dataset.mgr === 'quiet') { MGQ = !MGQ; return render(); }
    if (b.dataset.mgr === 'repeat') { REP.open = !REP.open; return render(); }
    if (b.dataset.mgr && b.dataset.mgr.indexOf('rd:') === 0) { var nd = Number(b.dataset.mgr.slice(3)); if ([14, 30, 60, 90].indexOf(nd) >= 0) { REP.days = nd; try { lstore('ew_mgr_days', String(nd)); } catch (e) {} } return render(); }
    if (/^(cards|csearch|cback|cpick:|cadd|cdel:)/.test(b.dataset.mgr)) return cardClick(b.dataset.mgr);
    if (b.dataset.mgr) return openMkt();
if (b.dataset.kb) return kbClick(b.dataset.kb);
if (b.dataset.mkt) return mktClick(b.dataset.mkt);
    var a = b.dataset.buh; if (!a) return;
    if (a === 'zp-go') { if (shopOn()) { openShop(); SH.tab = 'zp'; SH.month = S.month; render(); shLoad(); } return; }
    if (a === 'reload') { S.buh = readCache(S.month); load(); return render(); }
    if (a === 'prev' || a === 'next') { S.month = shiftMonth(S.month, a === 'prev' ? -1 : 1); S.buh = readCache(S.month); load(); return render(); }
    if (a === 'open-in' || a === 'open-out') { S.edit = null; S.pre = null; S.form = a === 'open-in' ? 'in' : 'out'; S.delAsk = null; render(); var sf = $s('bh-sum'); if (sf) sf.focus(); return; }
    if (a === 'close-form') { S.form = null; S.edit = null; S.pre = null; render(); return; }
    if (a === 'open-g') { S.gform = true; render(); var gf = $s('bh-gname'); if (gf) gf.focus(); return; }
    if (a === 'close-g') { S.gform = false; render(); return; }
    if (a === 'mic') return voice();
    if (a === 'sell') { S.sell = b.dataset.name; S.gform = false; render(); var sp = $s('bh-sprice'); if (sp) sp.focus(); return; }
    if (a === 'sell-x') { S.sell = null; render(); return; }
    if (a === 'sell-ok') {
      var q = Math.round(Number($s('bh-sqty').value)), pr = $s('bh-sprice').value.trim().replace(',', '.'), nm = S.sell;
      if (!(q > 0) || !(cents(pr) > 0)) return err(TX('Укажите сколько штук и цену'));
      var have = 0; S.buh.stock.forEach(function (g) { if (g.name === nm) have = g.qty; });
      if (q > have) return err(TX('На складе столько нет'));
      return stock(nm, -q).then(function (ok) { if (!ok) return; S.sell = null; addOp({ type: 'in', amount: (cents(pr) * q / 100).toFixed(2), note: 'Продажа: ' + nm + ' × ' + q, date: today() }); });
    }
    if (a === 'edit') {
      var old = null; S.buh.ops.forEach(function (p) { if (p.id === b.dataset.id) old = p; }); if (!old) return;
      S.edit = old.id; S.pre = { amount: String(cents(old.amount) / 100).replace('.', ','), note: old.note || '', date: old.date }; S.form = old.type; S.delAsk = null; render(); return;
    }
    if (a === 'text') { var p = parseText($s('bh-text').value); if (!p) return err(TX('Напишите так: расход 150 такси или приход 500 продажа')); S.bhDraft = ''; p.date = today(); return addOp(p); }
    if (a === 'add' && S.edit) {
      var eid = S.edit, np = { type: $s('bh-type').value === 'in' ? 'in' : 'out', amount: $s('bh-sum').value.trim().replace(',', '.'), note: $s('bh-note').value.trim(), date: $s('bh-date').value };
      if (!(cents(np.amount) > 0)) return err(TX('Введите сумму больше нуля'));
      return call({ action: 'del', id: eid }).then(function (r) { if (!r.ok) return err(r.error || TX('Не удалось исправить')); S.buh.ops = S.buh.ops.filter(function (p) { return p.id !== eid; }); S.edit = null; S.pre = null; addOp(np); });
    }
    if (a === 'add') return addOp({ type: $s('bh-type').value === 'in' ? 'in' : 'out', amount: $s('bh-sum').value.trim().replace(',', '.'), note: $s('bh-note').value.trim(), date: $s('bh-date').value });
    if (a === 'del') { var id = b.dataset.id; if (S.delAsk !== id) { S.delAsk = id; render(); return; } S.delAsk = null; return call({ action: 'del', id: id }).then(function (r) { if (!r.ok) return err(r.error || TX('Не удалось удалить')); S.buh.ops = S.buh.ops.filter(function (p) { return p.id !== id; }); render(); }); }
    if (a === 'st+' || a === 'st-') return stock(b.dataset.name, a === 'st+' ? 1 : -1);
    if (a === 'gadd') return stock($s('bh-gname').value, $s('bh-gqty').value || 1);
  }

  /* ---------- Продавец: сотрудник с ролью «продавец» видит только кассу на весь экран ---------- */
  // Сотрудник-аптекарь (rol=apteka, только кабинет Асрора): после входа видит одно окно, поиск препарата (название, полка, описание). Больше ничего.
  function setPharm() {
    var o = $s('kas-root');
    if (!o) {
      o = document.createElement('div'); o.id = 'kas-root';
      o.style.cssText = 'position:fixed;inset:0;z-index:40;overflow:auto;background:Canvas;color:CanvasText;padding:12px';
      o.innerHTML = '<div id="kas-body" style="max-width:720px;margin:0 auto"></div>';
      document.body.appendChild(o);
      o.addEventListener('click', onClick);
    }
    o.hidden = false;
    if (!SELLER) { SELLER = true; PHARM = true; S.view = 'apt'; AP.exitAsk = false; AP.card = false; AP.delAsk = ''; AP.q = ''; AP.err = ''; AP.form = null; AP.msg = ''; SH.d = null; SH.month = today().slice(0, 7); var kb = $s('sp-kassa-btn'); if (kb) kb.hidden = true; render(); aptLoad(); }
  }
  function setSeller(on) {
    var o = $s('kas-root');
    if (on) {
      if (!o) {
        o = document.createElement('div'); o.id = 'kas-root';
        o.style.cssText = 'position:fixed;inset:0;z-index:40;overflow:auto;background:Canvas;color:CanvasText;padding:12px';
        o.innerHTML = '<div id="kas-body" style="max-width:640px;margin:0 auto"></div>';
        document.body.appendChild(o);
        o.addEventListener('click', onClick);
      }
      o.hidden = false;
      if (!SELLER) { var spb = $s('sp-body'), cab0 = ''; try { cab0 = String(AS_KOD || store('ew_cab') || ''); } catch (e) {} /* 07.11.2026, только кабинет Асрора Холова: скрытая копия окна «Учёт магазина» дублировала id полей, и подсказки писались в неё, а не в видимое окно кладовщика */ if (spb && cab0 === 'kd6es8ycn5fa6gj43v7vlmw3nc0z5') spb.innerHTML = ''; SELLER = true; S.view = 'shop'; SH.tab = KEEPER ? 'prihod' : 'kassa'; SH.cart = []; SH.pay = ''; SH.who = ''; SH.cid = oid(); SH.err = ''; SH.ok = ''; SH.found = null; SH.d = null; SH.month = today().slice(0, 7); var kb = $s('sp-kassa-btn'); if (kb) kb.hidden = true; render(); shLoad(); }
    } else {
      SELLER = false; KEEPER = false; PHARM = false; if (o) o.hidden = true;
    }
  }
  setInterval(function () { var sid = ''; try { sid = staffNow() ? (store('ew_sid') || '') : ''; } catch (e) {} if (!sid && !PREVIEW && (SELLER || STK !== null)) { STK = null; setSeller(false); } }, 1500);

  var tries = 0;
  (function wait() {
    if (ensure() && injectHome()) {
      if (typeof render_top === 'function') { var o = render_top; render_top = function () { var r = o.apply(this, arguments); applyHome(); return r; }; }
      // список каналов перерисовывается после каждой загрузки переписок — тогда же обновляем подпись большой кнопки
      if (typeof render_channels === 'function') { var oc = render_channels; render_channels = function () { var r = oc.apply(this, arguments); heroSub(); return r; }; }
      applyHome(); return;
    }
    if (++tries < 50) setTimeout(wait, 200);
  })();
  root.EWSpecialists = { parseText: parseText, money: money, cents: cents };
})(typeof window !== 'undefined' ? window : globalThis);
