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
    { id: 'buh', name: 'Бухгалтер', about: 'Приход, расход и остатки товара. Показывает прибыль за месяц', ready: true, ico: '📒' },
    { id: 'shop', name: 'Учёт магазина', about: 'Касса, товары с кодом и маржой, склад, долги и отчёт', ready: true, ico: '🛒' },
    { id: 'smm', name: 'SMM-специалист', about: 'План недели, подписи к постам и разбор профиля по вашему Instagram', ready: true, ico: '📣' },
    { id: 'mkt', name: 'Маркетолог', about: 'Контент-план, где теряются клиенты, ваши цифры и тексты для возврата', ready: true, ico: '🎯' },
    { id: 'manager', name: 'Менеджер по клиентам', about: 'Следит, чтобы клиенты не терялись: возвращает замолчавших, напоминает о повторных покупках', ready: true, ico: '🤝' },
    { id: 'lawyer', name: 'Юрист', about: 'Составляет договоры на русском, таджикском и узбекском', ready: true, ico: '⚖️' }
  ];
  var S = { view: 'list', buh: null, month: '', busy: false };
  // «Учёт магазина» пока включён только для двух кабинетов: Шамсуло (колхоз, Россия) и владельца приложения. Остальным он не виден, сервер тоже не пускает.
  var SHOP_ALLOW = ['k17jyvxja8gfe6lrye2izmvjjasx6', 'ktfsozy4lpr8llrzfdaym0nmvak4lb9'];
  function shopOn() { try { return SHOP_ALLOW.indexOf(String(store('ew_cab') || '')) >= 0; } catch (e) { return false; } }

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
      d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
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
    if (on && STK === null && !STKbusy) { STKbusy = true; callTo('/magazin', { action: 'list' }).then(function (r) { STK = !!(r && r.ok); STKbusy = false; if (r && r.ok && r.role === 'seller') setSeller(true); staffBtn(); }); }
    on = on && STK === true;
    // Кнопка нужна только сотрудникам кабинета, где включён учёт магазина (Шамсуло): спрашиваем сервер один раз.
    if (on && STK === null && !STKbusy) { STKbusy = true; callTo('/magazin', { action: 'list' }).then(function (r) { STK = !!(r && r.ok); STKbusy = false; if (r && r.ok && r.role === 'seller') setSeller(true); staffBtn(); }); }
    on = on && STK === true && !SELLER;
    var b = $s('sp-kassa-btn');
    if (!b && on) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'sp-kassa-btn';
      b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:20;min-height:56px;padding:0 22px;border:0;border-radius:28px;background:#4f46e5;color:#fff;font:inherit;font-size:18px;font-weight:700;box-shadow:0 6px 18px rgba(79,70,229,.4);cursor:pointer';
      b.textContent = '🛒 ' + ui('Касса', 'Касса', 'Kassa');
      b.addEventListener('click', openStaffKassa);
      document.body.appendChild(b);
    }
    if (b) b.hidden = !on;
  }
  function openOne(id) {
    if (!owner()) return; ensure();
    if (id === 'shop' && !shopOn()) return; if (id === 'buh') openBuh(); else if (id === 'shop') openShop(); else if (id === 'smm') openSmm(); else if (id === 'mkt') openMkt(); else if (id === 'lawyer') openLaw(); else if (id === 'manager') openMgr(); else { S.view = id; render(); }
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
      '#sp-back{padding:6px 12px}#sp-back button{border:0;background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;padding:6px 0}';
    document.head.appendChild(st);
    var home = document.createElement('section'); home.id = 'sp-home'; home.hidden = true; home.setAttribute('aria-label', TX('Специалисты'));
    home.innerHTML = '<h2>' + esc(TX('Ваши специалисты')) + '</h2><p>' + esc(TX('Нажмите на специалиста, чтобы открыть его работу.')) + '</p>' +
      '<button type="button" class="sp-hero" data-home="assistant"><span class="ic" aria-hidden="true">✨</span><span><b>' + esc(TX('Мой ассистент: сводка дня')) + '</b><small id="sp-hero-sub">' + esc(TX('Что происходит у всех ваших специалистов, в одном окне')) + '</small></span></button>' +
      '<div class="sp-grid">' +
      LIST.map(function (x) {
        return '<button type="button" class="sp-tile' + (x.ready ? '' : ' soon') + '" data-home="' + x.id + '"><span class="ic" aria-hidden="true">' + x.ico + '</span><b>' + esc(TX(x.name)) + '</b><small>' + esc(TX(x.ready ? x.about : 'Скоро')) + '</small></button>';
      }).join('') + '</div>';
    app.insertBefore(home, ref);
    var back = document.createElement('div'); back.id = 'sp-back'; back.hidden = true;
    back.innerHTML = '<button type="button">← ' + esc(TX('Специалисты')) + '</button>';
    app.insertBefore(back, ref);
    home.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-home]'); if (!b) return;
      if (b.dataset.home === 'assistant') return openAsst();
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
    staffBtn();
    var shopTile = document.querySelector('#sp-home [data-home="shop"]'); if (shopTile) shopTile.hidden = !shopOn();
    $s('sp-back').hidden = !(user && !HOME);
    if (show) heroSub();
  }

  function render() {
    var el = SELLER ? $s('kas-body') : $s('sp-body'); if (!el) return;
    if (SELLER) return renderShop(el);
    if (S.view === 'asst') return renderAsst(el);
    if (S.view === 'buh') return renderBuh(el);
    if (S.view === 'shop') return renderShop(el);
    if (S.view === 'smm') return renderSmm(el);
    if (S.view === 'law') return renderLaw(el);
    if (S.view === 'mgr') return renderMgr(el);
if (S.view === 'mkt') return renderMkt(el);
    if (S.view !== 'list') return renderSoon(el, S.view);
    el.innerHTML = '<h2 style="padding-right:36px">' + esc(TX('Специалисты')) + '</h2><p>' + esc(TX('Выберите специалиста. Каждый работает в своём окне.')) + '</p><div class="sp-list" style="display:grid;gap:10px">' +
      LIST.filter(function (s) { return s.id !== 'shop' || shopOn(); }).map(function (s) {
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
function renderOnb(el) {
var o = S.onb, h = backBtn() + '<h2 style="padding-right:36px">📒 ' + esc(TX('Наймите себе бухгалтера')) + '</h2>';
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
  }
  function sums() {
    var i = 0, o = 0; (S.buh.ops || []).forEach(function (p) { if (monthOf(p.date) !== S.month) return; var c = cents(p.amount); if (p.type === 'in') i += c; else o += c; });
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
  function renderBuh(el) {
    if (S.onb) return renderOnb(el);
var h = backBtn() + '<h2 style="padding-right:36px">📒 ' + esc(TX('Бухгалтер')) + '</h2>' + (S.prof ? '<button type="button" class="btn sec" data-onb="change" style="height:30px;padding:0 10px;margin:0 0 6px;font-size:13px">' + esc(TX('Изменить вид деятельности')) + '</button>' : '');
    if (shopOn()) h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px"><button type="button" class="btn" data-shop="goto" data-k="kassa" style="min-height:56px;font-size:17px">🛒 ' + esc(ui('Касса', 'Касса', 'Kassa')) + '</button><button type="button" class="btn sec" data-shop="goto" data-k="tovar" style="min-height:56px;font-size:17px">📦 ' + esc(ui('Учёт', 'Ҳисоб', 'Hisob')) + '</button></div>';
    if (!S.buh) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (S.buh.error) { el.innerHTML = h + '<p class="err">' + esc(S.buh.error) + '</p><button class="btn" data-buh="reload" type="button">' + esc(TX('Ещё раз')) + '</button>'; return; }
    writeCache();
    if (S.buh.offline) h += '<p><small>' + esc(TX('Нет связи: показаны сохранённые записи.')) + '</small></p>'; else if (S.busy && S.buh.cached) h += '<p><small>' + esc(TX('Обновляем…')) + '</small></p>';
    var t = sums(), ops = S.buh.ops.filter(function (p) { return monthOf(p.date) === S.month; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.ts < b.ts ? 1 : -1); });
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
    var bo = breakdown(ops, 'out', t.o, '#c0392b'), bi = breakdown(ops, 'in', t.i, '#1f8a4c');
    if (bo) h += '<h3 style="margin:14px 0 4px">' + esc(TX('Куда ушли деньги')) + '</h3>' + bo;
    if (bi) h += '<h3 style="margin:14px 0 4px">' + esc(TX('Откуда пришли деньги')) + '</h3>' + bi;
    h += '<h3 style="margin:14px 0 4px">' + esc(TX('Записи за месяц')) + '</h3>' + (ops.length ? '<div>' + ops.map(function (p) {
      var ask = S.delAsk === p.id, inn = p.type === 'in';
      return '<div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #ddd"><span aria-hidden="true" style="flex:none;color:' + (inn ? '#1f8a4c' : '#c0392b') + '">' + (inn ? '↗' : '↘') + '</span><span style="flex:none;opacity:.7;font-size:12px">' + esc(String(p.date).slice(8, 10) + '.' + String(p.date).slice(5, 7)) + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + esc(p.note || (inn ? TX('Приход') : TX('Расход'))) + '</span>' +
        '<b style="flex:none;color:' + (inn ? '#1f8a4c' : '#c0392b') + '">' + (inn ? '+' : '−') + money(cents(p.amount)) + '</b>' +
        '<button class="btn sec" data-buh="edit" data-id="' + esc(p.id) + '" type="button" aria-label="' + esc(TX('Исправить запись')) + '" style="flex:none;height:30px;padding:0 8px">✎</button>' +
          '<button class="btn sec" data-buh="del" data-id="' + esc(p.id) + '" type="button" aria-label="' + esc(TX('Удалить запись')) + '" style="flex:none;height:30px;padding:0 8px' + (ask ? ';background:#c0392b;color:#fff' : '') + '">' + (ask ? esc(TX('Удалить?')) : '×') + '</button></div>';
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
  var SELLER = false, KAS_SID = '';
  var SH = { tab: 'kassa', d: null, cart: [], pay: '', who: '', cid: '', busy: false, err: '', ok: '', form: null, rcv: null, payf: null, delAsk: '', voidAsk: '', month: '', found: null, code: '' };
  var SH_DEBT_WARN = 100000; // порог предупреждения о большом долге: 1000 сомони, в дирамах
  function shMoney(x) { return money(cents(x)); }
  function shProd(kod) { var r = null; ((SH.d && SH.d.products) || []).forEach(function (p) { if (p.kod === kod) r = p; }); return r; }
  function openShop() { S.view = 'shop'; SH.tab = 'kassa'; SH.cart = []; SH.pay = ''; SH.who = ''; SH.cid = oid(); SH.err = ''; SH.ok = ''; SH.form = null; SH.rcv = null; SH.payf = null; SH.delAsk = ''; SH.voidAsk = ''; SH.found = null; SH.month = SH.month || today().slice(0, 7); SH.d = null; render(); shLoad(); }
  function shLoad() { SH.busy = true; callTo('/magazin', { action: 'list', month: SH.month }).then(function (r) { SH.busy = false; if (!r.ok) SH.err = r.error || TX('не удалось загрузить'); else { SH.d = r; SH.err = ''; } if (S.view === 'shop') render(); }); }
  function shAct(body, okMsg, after) {
    SH.busy = true; SH.err = ''; SH.ok = ''; body.month = SH.month; render();
    return callTo('/magazin', body).then(function (r) { SH.busy = false; if (!r.ok) SH.err = r.error || TX('Не удалось записать'); else { SH.d = r; SH.ok = okMsg || ''; if (after) after(r); } if (S.view === 'shop') render(); });
  }
  function shCartSum() { var c = 0; SH.cart.forEach(function (it) { var p = shProd(it.kod); if (p) c += cents(SH.pay === 'vladelec' ? p.zakup : p.price) * it.qty; }); return c; }
  function shAdd(text) {
    var t = String(text || '').trim().toLowerCase(); if (!t || !SH.d) return;
    var all = SH.d.products, hit = all.filter(function (p) { return p.kod.toLowerCase() === t; });
    if (!hit.length) hit = all.filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; });
    SH.ok = ''; SH.err = '';
    if (!hit.length) { SH.found = null; SH.err = ui('Товара с таким кодом нет', 'Чунин рамзи мол нест', 'Bunday kodli tovar yoʻq'); return; }
    if (hit.length > 1 && hit[0].kod.toLowerCase() !== t) { SH.found = hit.slice(0, 8); return; }
    SH.found = null; shPut(hit[0].kod);
  }
  function shPut(kod) {
    var p = shProd(kod); if (!p) return;
    var line = null; SH.cart.forEach(function (it) { if (it.kod === kod) line = it; });
    var have = line ? line.qty : 0;
    if (have + 1 > p.qty) { SH.err = ui('На складе мало: ', 'Дар анбор кам аст: ', 'Omborda kam: ') + p.name + ' (' + p.qty + ')'; return; }
    if (line) line.qty++; else SH.cart.push({ kod: kod, qty: 1 });
  }
  var SH_PAY = [['nal', 'Наличные', 'Нақд', 'Naqd'], ['perevod', 'Перевод', 'Гузаронидан', 'Oʻtkazma'], ['dolg', 'В долг', 'Қарз', 'Qarzga'], ['vladelec', 'Взял владелец', 'Соҳиб гирифт', 'Egasi oldi']];
  function shBtn(a, label, extra, k) { return '<button class="btn' + (extra && extra.sec ? ' sec' : '') + '" type="button" data-shop="' + a + '"' + (k != null ? ' data-k="' + esc(k) + '"' : '') + ' style="min-height:48px;font-size:16px' + (extra && extra.st ? ';' + extra.st : '') + '">' + esc(label) + '</button>'; }
  function shIn(id, ph, val, attrs) { return '<input class="in2" id="' + id + '" placeholder="' + esc(ph) + '" value="' + esc(val == null ? '' : val) + '" autocomplete="off" ' + (attrs || '') + ' style="height:48px;font-size:16px">'; }
  function renderShop(el) {
    var st = staffNow(); if (st) SH.tab = 'kassa';
    var simple = SH.tab === 'kassa', h = st ? '<div style="height:28px"></div>' : backBtn() + (simple ? '' : '<h2 style="padding-right:36px">🛒 ' + esc(ui('Учёт магазина', 'Ҳисоби мағоза', 'Doʻkon hisobi')) + '</h2>');
    if (SELLER) {
      var who = ''; try { who = store('ew_sname') || ''; } catch (e) {}
      h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><h2 style="margin:0">🛒 ' + esc(ui('Касса', 'Касса', 'Kassa')) + '</h2><span style="display:flex;align-items:center;gap:8px"><small>' + esc(who) + '</small>' + shBtn('selout', ui('Выйти', 'Баромад', 'Chiqish'), { sec: true, st: 'min-height:40px;font-size:14px;padding:0 12px' }) + '</span></div>';
    }
    var tabs = [['kassa', 'Касса', 'Касса', 'Kassa'], ['tovar', 'Товары', 'Молҳо', 'Tovarlar'], ['dolg', 'Долги', 'Қарзҳо', 'Qarzlar'], ['otchet', 'Отчёт', 'Ҳисобот', 'Hisobot']];
    if (!simple) h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0">' + tabs.map(function (t) { return shBtn('tab', ui(t[1], t[2], t[3]), { sec: SH.tab !== t[0] }, t[0]); }).join('') + '</div>';
    if (SH.err) h += '<p class="err" role="alert" id="sh-err">' + esc(SH.err) + '</p>';
    if (SH.ok) h += '<p id="sh-ok" style="background:#e3f6ea;color:#1f6b3d;padding:8px 10px;border-radius:8px">' + esc(SH.ok) + '</p>';
    if (!SH.d) { el.innerHTML = h + '<p>' + esc(SH.err ? '' : TX('Загрузка…')) + '</p>' + (SH.err ? shBtn('reload', ui('Ещё раз', 'Боз кӯшиш кунед', 'Yana urinib koʻring'), { sec: true }) : ''); return; }
    h += SH.tab === 'kassa' ? shStaffKassa() : SH.tab === 'tovar' ? shTovar() : SH.tab === 'dolg' ? shDolg() : shOtchet();
    el.innerHTML = h;
  }
  // Подсказки по первым цифрам кода; когда код набран целиком, остаётся одна крупная карточка (нажатие добавляет ещё одну штуку).
  function shHintsHtml() {
    var D = SH.d, t = String(SH.code || '').trim().toLowerCase(); if (D && !t && staffNow()) return '<span style="opacity:.65">' + esc(ui('Подходящие товары появятся здесь', 'Молҳои мувофиқ дар ин ҷо пайдо мешаванд', 'Mos tovarlar shu yerda chiqadi')) + '</span>'; if (!D || !t) return '';
    var exact = D.products.filter(function (p) { return p.kod.toLowerCase() === t; })[0];
    if (exact) {
      var line = null; SH.cart.forEach(function (it) { if (it.kod === exact.kod) line = it; });
      return '<button type="button" class="btn sec" data-shop="put" data-k="' + esc(exact.kod) + '" style="display:block;width:100%;height:auto;text-align:left;padding:14px;margin:8px 0">' +
        '<small style="opacity:.75">' + esc(ui('Код ', 'Рамз ', 'Kod ')) + esc(exact.kod) + '</small><br><b style="font-size:20px">' + esc(exact.name) + '</b><br>' +
        '<span style="font-size:18px">' + esc(shMoney(exact.price)) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy')) + '</span><br>' +
        '<small style="opacity:.75">' + esc(ui('Осталось ', 'Боқимонда ', 'Qoldi ')) + exact.qty + ' · ' + esc(line ? ui('В корзине: ', 'Дар сабад: ', 'Savatda: ') + line.qty + ui(' шт. Нажмите ещё раз, чтобы добавить.', ' дона. Боз пахш кунед, то илова шавад.', ' dona. Yana bossangiz, qoʻshiladi.') : ui('Нажмите на карточку, чтобы добавить.', 'Барои илова кардан ба корт пахш кунед.', 'Qoʻshish uchun kartani bosing.')) + '</small></button>';
    }
    var r = D.products.filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 5);
    if (!r.length) return '<p style="margin:8px 0;opacity:.75">' + esc(ui('Такого кода нет. Проверьте цифры.', 'Чунин рамз нест. Рақамҳоро санҷед.', 'Bunday kod yoʻq. Raqamlarni tekshiring.')) + '</p>';
    return '<div style="display:grid;gap:6px;margin:8px 0">' + r.map(function (p) {
      return shBtn('put', p.kod + ' · ' + p.name + ' · ' + shMoney(p.price) + ' · ' + ui('ост. ', 'бок. ', 'qol. ') + p.qty, { sec: true, st: 'text-align:left' }, p.kod);
    }).join('') + '</div>';
  }
  // Покупатель для долга: список знакомых с их долгом и жёлтое предупреждение, если долг уже большой. Продажу не блокирует.
  function shWhoHtml() {
    var D = SH.d, w = String(SH.who || '').trim().toLowerCase(); if (!D) return '';
    var all = D.debts.filter(function (c) { return !c.owner; });
    var r = all.filter(function (c) { return !w || c.name.toLowerCase().indexOf(w) >= 0; }).slice(0, 5), h = '';
    if (r.length) h += '<div style="display:grid;gap:6px;margin-top:6px">' + r.map(function (c) {
      return shBtn('who', staffNow() ? c.name : c.name + ' · ' + ui('долг ', 'қарз ', 'qarz ') + shMoney(c.sum), { sec: String(SH.who || '').trim().toLowerCase() !== c.name.toLowerCase(), st: 'text-align:left' }, c.name);
    }).join('') + '</div>';
    var cur = all.filter(function (c) { return c.name.toLowerCase() === w; })[0];
    if (cur && (cur.warn || cents(cur.sum) >= SH_DEBT_WARN)) h += '<p role="status" style="margin:8px 0;padding:8px 10px;border-radius:8px;background:#fff4d6;color:#7a5200">' + esc(staffNow() ? ui('У этого покупателя уже большой долг', 'Ин харидор аллакай қарзи калон дорад', 'Bu xaridorning qarzi allaqachon katta') : ui('У этого покупателя уже долг ', 'Ин харидор аллакай қарз дорад: ', 'Bu xaridorning qarzi allaqachon ') + shMoney(cur.sum)) + esc(ui('. Решаете вы.', '. Қарор аз они шумост.', '. Qaror sizniki.')) + '</p>';
    else if (w && !cur) h += '<p style="margin:6px 0"><small>' + esc(ui('Нового покупателя запишем под этим именем.', 'Харидори навро бо ҳамин ном сабт мекунем.', 'Yangi xaridorni shu nom bilan yozamiz.')) + '</small></p>';
    return h;
  }
  // Самый простой экран продавца: код, подсказки, корзина, «В долг» и «Оплатить». Больше ничего.
  function shStaffKassa() {
    var D = SH.d, h = '', box = 'border:1px solid #d6d6d6;border-radius:16px;background:#fff;padding:16px';
    if (!D.products.length) return '<p>' + esc(staffNow() ? ui('Товаров пока нет. Скажите руководителю.', 'Ҳоло мол нест. Ба роҳбар гӯед.', 'Hozircha tovar yoʻq. Rahbarga ayting.') : ui('Сначала добавьте товары: кнопка «Учёт».', 'Аввал молҳоро илова кунед: тугмаи «Ҳисоб».', 'Avval tovar qoʻshing: «Hisob» tugmasi.')) + '</p>' + (staffNow() ? '' : shBtn('tab', ui('Учёт', 'Ҳисоб', 'Hisob'), null, 'tovar'));
    var cart = !SH.cart.length ? '<div style="opacity:.6;margin-top:8px">' + esc(ui('Пока пусто', 'Ҳоло холӣ', 'Hozircha boʻsh')) + '</div>' : '<div style="margin-top:6px">' + SH.cart.map(function (it) {
      var p = shProd(it.kod); if (!p) return '';
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee"><div style="flex:1;min-width:0"><b>' + esc(p.name) + '</b><br><small>' + esc(shMoney(p.price)) + ' × ' + it.qty + ' = ' + esc(money(cents(p.price) * it.qty)) + '</small></div>' +
        shBtn('minus', '−', { sec: true, st: 'width:48px;padding:0' }, it.kod) + '<b style="min-width:20px;text-align:center">' + it.qty + '</b>' + shBtn('plus', '+', { sec: true, st: 'width:48px;padding:0' }, it.kod) + '</div>';
    }).join('') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:start">' +
      '<div>' + shIn('sh-code', ui('Введите код товара', 'Рамзи молро ворид кунед', 'Tovar kodini kiriting'), SH.code, 'inputmode="text" enterkeyhint="done"') +
      '<div id="sh-hints" style="margin-top:12px;min-height:56px;' + box + '">' + shHintsHtml() + '</div></div>' +
      '<div style="' + box + ';display:flex;flex-direction:column;min-height:200px"><div style="opacity:.75">' + esc(ui('Корзина', 'Сабад', 'Savat')) + '</div><div style="flex:1">' + cart + '</div>' +
      '<div id="sh-total" style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #e3e3e3;margin-top:12px;padding-top:10px"><span style="opacity:.75">' + esc(ui('Итого', 'Ҳамагӣ', 'Jami')) + '</span><b style="font-size:30px">' + esc(money(shCartSum())) + ' ' + esc(ui('сом.', 'сом.', 'som')) + '</b></div></div></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-top:16px">' + shBtn('dolgopen', ui('В долг', 'Қарз', 'Qarzga'), { sec: SH.pay !== 'dolg', st: 'height:64px;font-size:20px;font-weight:700' }) + shBtn('paynow', SH.busy ? TX('Загрузка…') : ui('Оплатить', 'Пардохт', 'Toʻlash'), { st: 'height:64px;font-size:20px;font-weight:700;background:#0b0b0b' }) + '</div>';
    if (SH.pay === 'dolg') h += '<div style="margin-top:12px">' + shIn('shx-who', ui('Кто покупатель (имя)', 'Харидор кист (ном)', 'Xaridor kim (ism)'), SH.who, 'maxlength="40"') + '<div id="sh-whohint">' + shWhoHtml() + '</div>' + shBtn('sell', ui('Записать в долг', 'Ба қарз сабт кардан', 'Qarzga yozish'), { st: 'width:100%;height:56px;margin-top:8px' }) + '</div>';
    return h;
  }
  function shKassa() {
    var D = SH.d, h = '';
    if (!D.products.length && staffNow()) return '<p>' + esc(ui('Товаров пока нет. Скажите владельцу.', 'Ҳоло мол нест. Ба соҳиб гӯед.', 'Hozircha tovar yoʻq. Egasiga ayting.')) + '</p>';
    if (!D.products.length) return '<p>' + esc(ui('Сначала добавьте товары: вкладка «Товары».', 'Аввал молҳоро илова кунед: бахши «Молҳо».', 'Avval tovar qoʻshing: «Tovarlar» boʻlimi.')) + '</p>' + shBtn('tab', ui('Товары', 'Молҳо', 'Tovarlar'), null, 'tovar');
    h += '<div style="display:grid;grid-template-columns:1fr auto;gap:8px">' + shIn('sh-code', ui('Код товара или название', 'Рамз ё номи мол', 'Tovar kodi yoki nomi'), SH.code, 'inputmode="text" enterkeyhint="done"') + shBtn('add', ui('Добавить', 'Илова', 'Qoʻshish'), { st: 'padding:0 18px' }) + '</div>';
    h += '<div id="sh-hints">' + shHintsHtml() + '</div>';
    if (SH.found) h += '<div style="display:grid;gap:6px;margin:8px 0">' + SH.found.map(function (p) { return shBtn('put', p.kod + ' · ' + p.name + ' · ' + shMoney(p.price), { sec: true, st: 'text-align:left' }, p.kod); }).join('') + '</div>';
    if (!SH.cart.length) h += '<p style="opacity:.75;margin:14px 0">' + esc(ui('Чек пуст. Введите код товара и нажмите «Добавить».', 'Чек холӣ аст. Рамзи молро ворид карда, «Илова»-ро пахш кунед.', 'Chek boʻsh. Tovar kodini kiriting va «Qoʻshish»ni bosing.')) + '</p>';
    else {
      h += '<div style="margin:10px 0">' + SH.cart.map(function (it) {
        var p = shProd(it.kod); if (!p) return ''; var pr = SH.pay === 'vladelec' ? p.zakup : p.price;
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e6e6e6"><div style="flex:1;min-width:0"><b>' + esc(p.name) + '</b><br><small>' + esc(p.kod) + ' · ' + esc(shMoney(pr)) + ' × ' + it.qty + ' = ' + esc(money(cents(pr) * it.qty)) + '</small></div>' +
          shBtn('minus', '−', { sec: true, st: 'width:48px;padding:0' }, it.kod) + '<b style="min-width:22px;text-align:center">' + it.qty + '</b>' + shBtn('plus', '+', { sec: true, st: 'width:48px;padding:0' }, it.kod) + shBtn('rm', '×', { sec: true, st: 'width:44px;padding:0' }, it.kod) + '</div>';
      }).join('') + '</div>';
      h += '<div style="font-size:22px;font-weight:700;margin:8px 0" id="sh-total">' + esc(ui('Итого', 'Ҳамагӣ', 'Jami')) + ': ' + esc(money(shCartSum())) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy')) + '</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + SH_PAY.filter(function (x) { return x[0] !== 'vladelec' || !staffNow(); }).map(function (x) { return shBtn('pay', ui(x[1], x[2], x[3]), { sec: SH.pay !== x[0], st: x[0] === 'vladelec' ? 'border:2px dashed #b36b00' : '' }, x[0]); }).join('') + '</div>';
      if (SH.pay === 'dolg') h += '<div style="margin-top:8px">' + shIn('shx-who', ui('Кто покупатель (имя)', 'Харидор кист (ном)', 'Xaridor kim (ism)'), SH.who, 'maxlength="40"') + '<div id="sh-whohint">' + shWhoHtml() + '</div></div>';
      if (SH.pay === 'vladelec') h += '<p style="margin:8px 0"><small>' + esc(ui('Товар спишется со склада по закупочной цене и запишется на владельца. В конце месяца он рассчитается: смотрите вкладку «Долги».', 'Мол аз анбор бо нархи харид хориҷ ва ба номи соҳиб сабт мешавад. Охири моҳ ӯ ҳисоб мекунад: бахши «Қарзҳо».', 'Tovar ombordan xarid narxida chiqariladi va egasiga yoziladi. Oy oxirida u hisob-kitob qiladi: «Qarzlar» boʻlimi.')) + '</small></p>';
      h += '<div style="margin-top:10px">' + shBtn('sell', SH.busy ? TX('Загрузка…') : ui('Продать', 'Фурӯхтан', 'Sotish'), { st: 'width:100%;height:56px;font-size:18px' }) + '</div>';
    }
    return h;
  }
  function shTovar() {
    var D = SH.d, h = '', f = SH.form;
    if (f) {
      h += '<form data-shopform="save" style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(f.edit ? ui('Изменить товар', 'Тағйири мол', 'Tovarni oʻzgartirish') : ui('Новый товар', 'Моли нав', 'Yangi tovar')) + '</b>' +
        shIn('sh-f-kod', ui('Код товара (буквы и цифры)', 'Рамзи мол (ҳарф ва рақам)', 'Tovar kodi (harf va raqam)'), f.kod, (f.edit ? 'readonly ' : '') + 'maxlength="20"') +
        shIn('sh-f-name', ui('Название', 'Ном', 'Nomi'), f.name, 'maxlength="60"') +
        shIn('sh-f-zakup', ui('Закупочная цена', 'Нархи харид', 'Xarid narxi'), f.zakup, 'inputmode="decimal"') +
        shIn('sh-f-marzha', ui('Маржа, %', 'Маржа, %', 'Marja, %'), f.marzha, 'inputmode="decimal"') +
        '<div id="sh-f-price" style="font-size:18px"></div><div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('save', ui('Сохранить', 'Захира', 'Saqlash')) + shBtn('fcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></form>';
    } else h += shBtn('fnew', '＋ ' + ui('Добавить товар', 'Илова кардани мол', 'Tovar qoʻshish'), { sec: true, st: 'width:100%;margin:8px 0' });
    if (SH.rcv) h += '<div style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(ui('Приход товара', 'Воридоти мол', 'Tovar kirimi')) + ': ' + esc(SH.rcv.name) + '</b>' + shIn('sh-r-qty', ui('Сколько штук пришло', 'Чанд дона омад', 'Necha dona keldi'), '', 'inputmode="numeric"') + shIn('sh-r-zakup', ui('Новая закупочная цена (если изменилась)', 'Нархи нави харид (агар тағйир ёфт)', 'Yangi xarid narxi (oʻzgargan boʻlsa)'), '', 'inputmode="decimal"') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('rok', ui('Записать приход', 'Сабти воридот', 'Kirimni yozish')) + shBtn('rcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
    if (!D.products.length) return h + '<p>' + esc(ui('Товаров пока нет.', 'Ҳоло мол нест.', 'Hozircha tovar yoʻq.')) + '</p>';
    h += D.products.map(function (p) {
      var ask = SH.delAsk === p.kod;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(p.name) + '</b><span style="white-space:nowrap">' + esc(shMoney(p.price)) + '</span></div><small>' + esc(p.kod) + ' · ' + esc(ui('закупка', 'харид', 'xarid')) + ' ' + esc(shMoney(p.zakup)) + ' + ' + esc(String(p.marzha)) + '% · <b style="' + (p.qty <= 2 ? 'color:#c0392b' : '') + '">' + esc(ui('остаток', 'боқимонда', 'qoldiq')) + ' ' + p.qty + '</b></small>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' + shBtn('rcv', ui('Приход', 'Воридот', 'Kirim'), { sec: true, st: 'flex:1' }, p.kod) + shBtn('fedit', ui('Изменить', 'Тағйир', 'Oʻzgartirish'), { sec: true, st: 'flex:1' }, p.kod) + shBtn('pdel', ask ? ui('Удалить?', 'Нест кунем?', 'Oʻchiraymi?') : '×', { sec: true, st: 'width:56px;padding:0' + (ask ? ';background:#c0392b;color:#fff' : '') }, p.kod) + '</div></div>';
    }).join('');
    return h;
  }
  function shDolg() {
    var D = SH.d; if (!D.debts.length) return '<p>' + esc(ui('Долгов нет.', 'Қарз нест.', 'Qarz yoʻq.')) + '</p>';
    var tot = D.debts.reduce(function (s, c) { return s + cents(c.sum); }, 0);
    return '<p><b>' + esc(ui('Всего должны', 'Ҳамагӣ қарздоранд', 'Jami qarz')) + ': ' + esc(money(tot)) + '</b></p>' + D.debts.map(function (c) {
      var open = SH.payf === c.name;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6' + (c.owner ? ';background:#fff7e6;padding-left:8px' : '') + '"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(c.owner ? ui('Владелец (взял товар)', 'Соҳиб (мол гирифт)', 'Egasi (tovar oldi)') : c.name) + '</b><b>' + esc(shMoney(c.sum)) + '</b></div><small>' + esc(ui('с ', 'аз ', '')) + esc(c.since) + '</small>' +
        (open ? '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;margin-top:6px">' + shIn('sh-p-amt', ui('Сумма', 'Маблағ', 'Summa'), c.sum, 'inputmode="decimal"') + shBtn('pok', ui('Принять', 'Қабул', 'Qabul')) + shBtn('pcancel', '×', { sec: true, st: 'width:48px;padding:0' }) + '</div>' : '<div style="margin-top:6px">' + shBtn('pay-open', c.owner ? ui('Владелец рассчитался', 'Соҳиб ҳисоб кард', 'Egasi hisob qildi') : ui('Принял оплату', 'Пардохт қабул шуд', 'Toʻlov qabul qilindi'), { sec: true }, c.name) + '</div>') + '</div>';
    }).join('');
  }
  function shOtchet() {
    var R = SH.d.report, h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0">' + shBtn('mprev', '‹', { sec: true, st: 'width:56px;padding:0' }) + '<b>' + esc(monthName(R.month)) + '</b>' + shBtn('mnext', '›', { sec: true, st: 'width:56px;padding:0' }) + '</div>';
    var cell = function (l, v, c) { return '<div style="padding:10px;border:1px solid #e0e0e0;border-radius:10px"><small>' + esc(l) + '</small><div style="font-size:20px;font-weight:700;' + (c ? 'color:' + c : '') + '">' + esc(money(cents(v))) + '</div></div>'; };
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + cell(ui('Выручка', 'Даромад', 'Tushum'), R.revenue) + cell(ui('Прибыль', 'Фоида', 'Foyda'), R.profit, '#1f8a4c') + cell(ui('Взял владелец', 'Соҳиб гирифт', 'Egasi oldi'), R.owner, '#b36b00') + cell(ui('Долги всего', 'Қарзҳо ҳамагӣ', 'Jami qarz'), R.debt, '#c0392b') + '</div>';
    if (R.low.length) h += '<p style="margin-top:12px"><b>' + esc(ui('Заканчивается', 'Тамом шуда истодааст', 'Tugayapti')) + ':</b> ' + R.low.map(function (x) { return esc(x.name) + ' (' + x.qty + ')'; }).join(', ') + '</p>';
    h += '<h3 style="margin-top:14px">' + esc(ui('Продажи', 'Фурӯшҳо', 'Sotuvlar')) + '</h3>';
    if (!R.checks.length) return h + '<p>' + esc(ui('За этот месяц продаж нет.', 'Дар ин моҳ фурӯш нест.', 'Bu oyda sotuv yoʻq.')) + '</p>';
    var pn = { nal: ui('наличные', 'нақд', 'naqd'), perevod: ui('перевод', 'гузаронидан', 'oʻtkazma'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('владелец', 'соҳиб', 'egasi') };
    return h + R.checks.map(function (c) {
      var ask = SH.voidAsk === c.id;
      return '<div style="padding:8px 0;border-bottom:1px solid #e6e6e6;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><b>' + esc(money(cents(c.total))) + '</b> · ' + esc(pn[c.pay] || c.pay) + (c.pay === 'dolg' ? ' · ' + esc(c.who) : '') + (c.seller ? ' · ' + esc(c.seller) : '') + '<br><small>' + esc(c.date) + ' · ' + c.lines.map(function (l) { return esc(l.name) + ' ×' + l.qty; }).join(', ') + '</small></div>' + shBtn('void', ask ? ui('Отменить?', 'Бекор мекунем?', 'Bekor qilinsinmi?') : '↺', { sec: true, st: 'width:' + (ask ? '110' : '48') + 'px;padding:0' + (ask ? ';background:#c0392b;color:#fff' : '') }, c.id) + '</div>';
    }).join('');
  }
  function shNum(id) { var e = $s(id); return e ? String(e.value).replace(',', '.').trim() : ''; }
  function shopClick(b) {
    var a = b.dataset.shop, k = b.dataset.k;
    if (a === 'selout') { if (typeof window.logout === 'function') window.logout(); return; }
    if (SELLER && ['tab', 'fnew', 'fedit', 'rcv', 'rok', 'pdel', 'pay-open', 'pok', 'void', 'mprev', 'mnext'].indexOf(a) >= 0) return;
    if (a === 'tab') { SH.tab = k; SH.err = ''; SH.ok = ''; SH.form = null; SH.rcv = null; SH.payf = null; SH.delAsk = ''; SH.voidAsk = ''; SH.found = null; SH.code = ''; return render(); }
    if (a === 'goto') { openShop(); SH.tab = k; return render(); }
    if (a === 'reload') { SH.err = ''; render(); return shLoad(); }
    if (a === 'add') { var c = $s('sh-code'); SH.code = ''; shAdd(c ? c.value : ''); render(); var c2 = $s('sh-code'); if (c2) c2.focus(); return; }
    if (a === 'put') { SH.err = ''; SH.found = null; var pc = $s('sh-code'), pt = pc ? pc.value.trim().toLowerCase() : ''; shPut(k); SH.code = pt === String(k).toLowerCase() ? k : ''; render(); var c3 = $s('sh-code'); if (c3) c3.focus(); return; }
    if (a === 'who') { SH.who = k; SH.err = ''; render(); return; }
    if (a === 'plus') { SH.err = ''; shPut(k); return render(); }
    if (a === 'minus') { SH.cart.forEach(function (it) { if (it.kod === k) it.qty--; }); SH.cart = SH.cart.filter(function (it) { return it.qty > 0; }); return render(); }
    if (a === 'rm') { SH.cart = SH.cart.filter(function (it) { return it.kod !== k; }); return render(); }
    if (a === 'pay') { var w = $s('shx-who'); if (w) SH.who = w.value; SH.pay = k; SH.err = ''; return render(); }
    if (a === 'dolgopen') { if (!SH.cart.length) { SH.err = ui('Сначала добавьте товар', 'Аввал мол илова кунед', 'Avval tovar qoʻshing'); return render(); } SH.err = ''; SH.pay = SH.pay === 'dolg' ? '' : 'dolg'; return render(); }
    if (a === 'paynow') SH.pay = 'nal';
    if (a === 'sell' || a === 'paynow') {
      if (SH.busy) return; if (!SH.cart.length) { SH.err = ui('Сначала добавьте товар', 'Аввал мол илова кунед', 'Avval tovar qoʻshing'); return render(); } var w2 = $s('shx-who'); if (w2) SH.who = w2.value;
      if (!SH.pay) { SH.err = ui('Выберите, как заплатили', 'Интихоб кунед, чӣ тавр пардохт шуд', 'Qanday toʻlanganini tanlang'); return render(); }
      if (SH.pay === 'dolg' && !SH.who.trim()) { SH.err = ui('Для долга укажите покупателя', 'Барои қарз харидорро нависед', 'Qarz uchun xaridorni yozing'); return render(); }
      var tot = shCartSum();
      return shAct({ action: 'sell', id: SH.cid, items: SH.cart.map(function (it) { return { kod: it.kod, qty: it.qty }; }), pay: SH.pay, who: SH.who, date: today() }, ui('Продано на ', 'Фурӯхта шуд ба ', 'Sotildi: ') + money(tot) + ' ' + ui('сомони', 'сомонӣ', 'somoniy'), function () { SH.cart = []; SH.pay = ''; SH.who = ''; SH.code = ''; SH.cid = oid(); });
    }
    if (a === 'fnew') { SH.form = { kod: '', name: '', zakup: '', marzha: '' }; SH.rcv = null; return render(); }
    if (a === 'fedit') { var p = shProd(k); if (p) SH.form = { kod: p.kod, name: p.name, zakup: p.zakup, marzha: p.marzha, edit: true }; SH.rcv = null; return render(); }
    if (a === 'fcancel') { SH.form = null; SH.err = ''; return render(); }
    if (a === 'save') return shSave();
    if (a === 'rcv') { var p2 = shProd(k); if (p2) SH.rcv = { kod: p2.kod, name: p2.name }; SH.form = null; return render(); }
    if (a === 'rcancel') { SH.rcv = null; return render(); }
    if (a === 'rok') {
      var q = Math.round(Number(shNum('sh-r-qty'))); if (!(q > 0)) { SH.err = ui('Укажите, сколько штук пришло', 'Нависед, чанд дона омад', 'Necha dona kelganini yozing'); return render(); }
      var zk = shNum('sh-r-zakup'), kd = SH.rcv.kod, body = { action: 'receive', kod: kd, qty: q, id: oid() }; if (zk) body.zakup = Number(zk);
      return shAct(body, ui('Приход записан', 'Воридот сабт шуд', 'Kirim yozildi'), function () { SH.rcv = null; });
    }
    if (a === 'pdel') { if (SH.delAsk !== k) { SH.delAsk = k; return render(); } SH.delAsk = ''; return shAct({ action: 'product_del', kod: k }, ui('Товар удалён', 'Мол нест шуд', 'Tovar oʻchirildi')); }
    if (a === 'pay-open') { SH.payf = k; SH.err = ''; return render(); }
    if (a === 'pcancel') { SH.payf = null; return render(); }
    if (a === 'pok') {
      var am = shNum('sh-p-amt'); if (!(Number(am) > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      return shAct({ action: 'pay', who: SH.payf, amount: Number(am), id: oid(), date: today() }, ui('Оплата принята', 'Пардохт қабул шуд', 'Toʻlov qabul qilindi'), function () { SH.payf = null; });
    }
    if (a === 'mprev' || a === 'mnext') { SH.month = shiftMonth(SH.month, a === 'mprev' ? -1 : 1); SH.voidAsk = ''; render(); return shLoad(); }
    if (a === 'void') { if (SH.voidAsk !== k) { SH.voidAsk = k; return render(); } SH.voidAsk = ''; return shAct({ action: 'void', id: k }, ui('Продажа отменена, товар вернулся на склад', 'Фурӯш бекор шуд, мол ба анбор баргашт', 'Sotuv bekor qilindi, tovar omborga qaytdi')); }
  }
  function shSave() {
    var f = { kod: ($s('sh-f-kod').value || '').trim(), name: ($s('sh-f-name').value || '').trim(), zakup: shNum('sh-f-zakup'), marzha: shNum('sh-f-marzha') };
    SH.form = Object.assign({ edit: SH.form && SH.form.edit }, f);
    if (!f.kod || !/^[A-Za-z0-9_-]+$/.test(f.kod)) { SH.err = ui('Код: только латинские буквы и цифры', 'Рамз: танҳо ҳарфҳои лотинӣ ва рақамҳо', 'Kod: faqat lotin harflari va raqamlar'); return render(); }
    if (!f.name) { SH.err = ui('Введите название', 'Номро нависед', 'Nomini yozing'); return render(); }
    if (!(Number(f.zakup) > 0)) { SH.err = ui('Закупочная цена должна быть больше нуля', 'Нархи харид аз сифр зиёд бошад', 'Xarid narxi noldan katta boʻlsin'); return render(); }
    if (f.marzha === '' || !(Number(f.marzha) >= 0 && Number(f.marzha) <= 1000)) { SH.err = ui('Маржа: число от 0 до 1000', 'Маржа: адад аз 0 то 1000', 'Marja: 0 dan 1000 gacha son'); return render(); }
    if (!SH.form.edit && shProd(f.kod)) { SH.err = ui('Товар с таким кодом уже есть', 'Чунин рамзи мол аллакай ҳаст', 'Bunday kodli tovar bor'); return render(); }
    return shAct({ action: 'product', p: { kod: f.kod, name: f.name, zakup: Number(f.zakup), marzha: Number(f.marzha) } }, ui('Товар сохранён', 'Мол захира шуд', 'Tovar saqlandi'), function () { SH.form = null; });
  }
  function shLive(e) {
    var t = e.target; if (!t) return;
    if (t.id === 'sh-code' && e.type === 'keydown' && e.key === 'Enter') { e.preventDefault(); shopClick({ dataset: { shop: 'add' } }); return; }
    if (t.id === 'sh-code' && e.type === 'input') { SH.code = t.value; SH.found = null; var hb = $s('sh-hints'); if (hb) hb.innerHTML = shHintsHtml(); return; }
    if (t.id === 'shx-who' && e.type === 'input') { SH.who = t.value; var wb = $s('sh-whohint'); if (wb) wb.innerHTML = shWhoHtml(); return; }
    if (e.type === 'input' && (t.id === 'sh-f-zakup' || t.id === 'sh-f-marzha')) { var z = Number(shNum('sh-f-zakup')), m = Number(shNum('sh-f-marzha')), o = $s('sh-f-price'); if (o) o.textContent = z > 0 && m >= 0 ? ui('Цена продажи: ', 'Нархи фурӯш: ', 'Sotuv narxi: ') + money(cents(Math.round(z * (1 + m / 100) * 100) / 100)) : ''; }
  }
  document.addEventListener('keydown', shLive); document.addEventListener('input', shLive);
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.chip) { var nf = $s('bh-note'); if (nf) { nf.value = b.dataset.chip === 'Другое' ? '' : b.dataset.chip; nf.focus(); } return; }
    if (b.hasAttribute('data-sp-back')) { $s('m-spec').close(); return; }
    if (false) { if (b.dataset.sp === 'seller') { $s('m-spec').close(); return; } if (b.dataset.sp === 'buh') return openBuh(); S.view = b.dataset.sp; return render(); }
    if (b.dataset.asst) return asstClick(b);
    if (b.dataset.onb) return onbClick(b);
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
      if (!SELLER) { SELLER = true; S.view = 'shop'; SH.tab = 'kassa'; SH.cart = []; SH.pay = ''; SH.who = ''; SH.cid = oid(); SH.err = ''; SH.ok = ''; SH.found = null; SH.d = null; SH.month = today().slice(0, 7); var kb = $s('sp-kassa-btn'); if (kb) kb.hidden = true; render(); shLoad(); }
    } else {
      SELLER = false; if (o) o.hidden = true;
    }
  }
  setInterval(function () { var sid = ''; try { sid = staffNow() ? (store('ew_sid') || '') : ''; } catch (e) {} if (!sid && (SELLER || STK !== null)) { STK = null; setSeller(false); } }, 1500);

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
