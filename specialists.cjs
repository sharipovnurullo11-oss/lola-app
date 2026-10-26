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
  // «Учёт магазина» включён только для кабинета Шамсуло (колхоз, Россия). Владелец приложения из списка убран по его решению 23.10; сервер тоже не пускает остальных.
  var SHOP_ALLOW = ['k17jyvxja8gfe6lrye2izmvjjasx6'];
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
    if (on && STK === null && !STKbusy) { STKbusy = true; callTo('/magazin', { action: 'list' }).then(function (r) { STK = !!(r && r.ok); STKbusy = false; if (r && r.ok && (r.role === 'seller' || r.role === 'storekeeper')) { KEEPER = r.role === 'storekeeper'; setSeller(true); } staffBtn(); }); }
    on = on && STK === true;
    // Кнопка нужна только сотрудникам кабинета, где включён учёт магазина (Шамсуло): спрашиваем сервер один раз.
    if (on && STK === null && !STKbusy) { STKbusy = true; callTo('/magazin', { action: 'list' }).then(function (r) { STK = !!(r && r.ok); STKbusy = false; if (r && r.ok && (r.role === 'seller' || r.role === 'storekeeper')) { KEEPER = r.role === 'storekeeper'; setSeller(true); } staffBtn(); }); }
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
    if (id === 'shop' && !shopOn()) return; S.fromFin = false; if (id === 'fin') { if (shopOn()) { S.view = 'fin'; render(); } else openFinOrProkat(); } else if (id === 'buh') openBuh(); else if (id === 'shop') openShop(); else if (id === 'smm') openSmm(); else if (id === 'mkt') openMkt(); else if (id === 'lawyer') openLaw(); else if (id === 'manager') openMgr(); else { S.view = id; render(); }
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
      LIST.filter(function (x) { return !x.hide; }).map(function (x) {
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
    var el = SELLER ? $s('kas-body') : $s('sp-body'); if (!el) return; try { var dl = el.closest('dialog'), full = !!(SELLER || S.view === 'shop'), dbd = dl && dl.querySelector('.dbody'); if (dl) { dl.style.width = full ? '100vw' : 'min(620px,calc(100vw - 16px))'; dl.style.maxWidth = full ? '100vw' : ''; dl.style.height = full ? '100dvh' : ''; dl.style.maxHeight = full ? '100dvh' : ''; dl.style.borderRadius = full ? '0' : ''; if (dbd) { dbd.style.maxHeight = full ? '100dvh' : 'calc(100dvh - 24px)'; dbd.style.minHeight = full ? '100dvh' : ''; } } } catch (e) {}
    if (SELLER) return renderShop(el);
    if (S.view === 'asst') return renderAsst(el);
    if (S.view === 'fin') return renderFin(el);
    if (S.view === 'prokat') return renderProkat(el);
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
    el.innerHTML = backBtn() + '<h2 style="padding-right:36px">💼 ' + esc(ui('Финансист', 'Мутахассиси молия', 'Moliyachi')) + '</h2><p>' + esc(ui('Деньги и товар в одном месте. Выберите раздел.', 'Пул ва мол дар як ҷо. Бахшро интихоб кунед.', 'Pul va tovar bir joyda. Boʻlimni tanlang.')) + '</p><div style="display:grid;gap:10px">' +
      card('buh', '📒', ui('Бухгалтерия', 'Ҳисобдорӣ', 'Buxgalteriya'), ui('Приход, расход, остатки и прибыль за месяц', 'Даромад, хароҷот, боқимонда ва фоидаи моҳ', 'Kirim, chiqim, qoldiq va oylik foyda')) +
      card('shop', '🛒', ui('Учёт магазина', 'Ҳисоби мағоза', 'Doʻkon hisobi'), ui('Продажа, приём товара, долги и итоги', 'Фурӯш, қабули мол, қарзҳо ва натиҷаҳо', 'Sotuv, tovar qabuli, qarzlar va natijalar')) +
      (shopOn() ? card('kl', '📦', ui('Кладовщик', 'Анбордор', 'Omborchi'), ui('Приём товара, товары и закупочные цены; здесь же добавить кладовщика', 'Қабули мол, молҳо ва нархи харид; дар ҳамин ҷо анбордор илова кунед', 'Tovar qabuli, tovarlar va xarid narxlari; omborchini shu yerda qoʻshing')) : '') +
      '' + '</div>' + (shopOn() && owner() ? '<p style="margin-top:12px"><button type="button" class="btn sec" data-fin="push" style="height:36px;font-size:14px">🔔 ' + esc(ui('Включить уведомления на этом телефоне', 'Огоҳиномаро дар ин телефон фаъол кунед', 'Bu telefonda bildirishnomani yoqish')) + '</button></p>' : '') + (S.pushMsg ? '<p role="status" style="margin-top:10px">' + esc(S.pushMsg) + '</p>' : '');
  }
  // Push-уведомления владельцу: разрешение, подписка телефона и отправка её серверу
  function pushKey(k) { var p = '='.repeat((4 - k.length % 4) % 4), b = (k + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(b), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function pushEnable() {
    var say = function (t) { S.pushMsg = t; if (S.view === 'fin') render(); };
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return say(ui('Этот телефон или браузер не поддерживает уведомления. На iPhone сначала добавьте приложение на экран «Домой».', 'Ин телефон ё браузер огоҳиномаро дастгирӣ намекунад.', 'Bu telefon yoki brauzer bildirishnomani qoʻllamaydi.'));
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return say(ui('Уведомления не разрешены. Разрешите их в настройках браузера для этого сайта.', 'Огоҳинома иҷозат нашуд. Дар танзимоти браузер иҷозат диҳед.', 'Bildirishnoma ruxsat etilmadi. Brauzer sozlamalarida ruxsat bering.'));
      return fetch('/push/key', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.key) return say(ui('Сервер пока не готов к уведомлениям. Попробуйте позже.', 'Сервер ҳоло омода нест.', 'Server hali tayyor emas.'));
        return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey(j.key) }); }).then(function (sub) {
          return fetch('/push/sub', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: store('ew_cab') || '', sub: sub.toJSON() }) }).then(function (r) { return r.json(); }).then(function (x) {
            say(x && x.ok ? ui('Готово: уведомления включены на этом телефоне.', 'Тайёр: огоҳинома фаъол шуд.', 'Tayyor: bildirishnoma yoqildi.') : ui('Не удалось сохранить подписку.', 'Обуна захира нашуд.', 'Obuna saqlanmadi.'));
          });
        });
      });
    }).catch(function () { say(ui('Не получилось включить уведомления.', 'Огоҳинома фаъол нашуд.', 'Bildirishnomani yoqib boʻlmadi.')); });
  }
  /* ---------- Финансист проката строительных инструментов ---------- */
  // Данные хранит n8n по адресу /prokat. Кому показывать прокат, решает сервер: чужому кабинету он отвечает «нет доступа», и тогда открывается обычная бухгалтерия.
  var PK = { pt: null, points: [], total: null, filter: 'all', cur: null, busy: false, err: '', msg: '', form: null, ride: false, folder: false, sk: null, all: null, ph: null, big: null, cmp: null, tour: null, rem: null };
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
    PK.cur = { name: name, loading: true }; PK.pt = null; PK.big = null; pkPhLoad(name); PK.err = ''; PK.msg = ''; PK.form = null; PK.ride = false; render();
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
      '<button type="button" class="btn sec" data-pk="cmp" style="display:flex;align-items:center;gap:12px;text-align:left;height:auto;padding:14px;width:100%"><span style="font-size:28px;flex:none" aria-hidden="true">📊</span><span style="flex:1;min-width:0"><b style="display:block;font-size:17px">' + esc(TX('Сравнение пунктов')) + '</b><small style="opacity:.75">' + esc(TX('Какой пункт лучше и что где простаивает')) + '</small></span></button></div>';
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
        pkBtn('sk-f:move', '🔁 ' + esc(TX('Сменить состояние')), true, 'height:auto;padding:10px') + pkBtn('sk-f:photo', '📷 ' + esc(TX(g.photo_date ? 'Сменить фото' : 'Добавить фото')), true, 'height:auto;padding:10px') + '</div>';
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
    if (k === 'sk-list') { sk.cur = ''; sk.form = null; sk.msg = ''; render(); return true; }
    if (k.indexOf('sk-k:') === 0) { var g = sk.kinds[+k.slice(5)]; if (g) { sk.cur = g.name; sk.form = null; sk.msg = ''; render(); } return true; }
    if (k === 'sk-new') { pkSkForm('new'); return true; }
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
  function pkRideNote() { return '<p style="padding:10px;border-radius:10px;background:rgba(127,127,127,.12);margin:0 0 10px">' + esc(TX('Объезд делается по пунктам: откройте пункт и нажмите «Начать объезд». Пункты, где давно не было объезда, — в «Напоминаниях» на экране Финансиста.')) + '</p>'; }
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
      pkRentBlock(p.rent);
    if (PK.msg) h += '<p style="color:#1f8a4c;margin:10px 0 0">' + esc(PK.msg) + '</p>';
    if (PK.form) h += pkForm();
    else h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">' + pkBtn('take', '💵 ' + esc(TX('Забрал деньги'))) + pkBtn('tour', '🚗 ' + esc(TX('Начать объезд')), true) + '</div>';
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
      pkRow(TX('Доля владельца 20%'), pkMoney(r.owner_share)) +
      pkRow(TX('К передаче Нурулло 80%'), '<span style="color:' + (owed > 0 ? '#b26a00' : 'inherit') + '">' + pkMoney(owed) + '</span>', true) +
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
  // Фото инструментов на пункте и «Все инструменты»: данные отдаёт n8n по адресу /prokat-foto.
  function pkSafeUrl(u) { u = String(u || ''); return /^https?:\/\//i.test(u) ? u : ''; }
  // Фото-история: в окне пункта иконки инструментов, внутри — все фото инструмента по датам, от первого до последнего объезда.
  function pkPhLoad(name) {
    var ph = PK.ph = { name: name, loading: true, tools: [], error: '' };
    callTo('/prokat-foto', { action: 'tools', name: name }).then(function (r) {
      if (PK.ph !== ph) return;
      ph.loading = false;
      if (!r || !r.ok) ph.error = (r && r.error) || TX('не удалось загрузить');
      else ph.tools = Array.isArray(r.tools) ? r.tools : [];
      if (S.view === 'prokat' && PK.cur && PK.cur.name === name) render();
    });
  }
  function pkPhBlock() {
    var ph = PK.ph, h = '<h3 style="margin:16px 0 6px">🧰 ' + esc(TX('Инструменты на пункте')) + (ph && !ph.loading && !ph.error ? ' <span style="font-size:15px;padding:2px 9px;border-radius:12px;background:rgba(127,127,127,.15)">' + esc(ph.tools.length) + '</span>' : '') + '</h3>';
    if (!ph || ph.loading) return h + '<p style="opacity:.75">' + esc(TX('Загрузка…')) + '</p>';
    if (ph.error) return h + '<p style="color:#c0392b">' + esc(ph.error) + '</p>' + pkBtn('ph-retry', esc(TX('Ещё раз')), true);
    if (!ph.tools.length) return h + '<p style="opacity:.75">' + esc(TX('Инструментов пока нет')) + '</p>';
    return h + '<p style="margin:0 0 8px;opacity:.8">' + esc(TX('Нажмите на инструмент, чтобы увидеть все его фото по датам')) + '</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px">' + ph.tools.map(function (t, i) {
      var u = pkSafeUrl(t.url), n = pkNum(t.count);
      return '<button type="button" data-pk="pt:' + i + '" style="display:block;padding:0;border:1px solid rgba(127,127,127,.3);border-radius:10px;overflow:hidden;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer">' +
        (u ? '<img src="' + esc(u) + '" loading="lazy" alt="' + esc(t.name || '') + '" style="display:block;width:100%;aspect-ratio:1;object-fit:cover">' : '<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;aspect-ratio:1;background:rgba(127,127,127,.15);font-size:30px">🧰</span>') +
        '<span style="display:block;padding:4px 6px;font-size:12px;line-height:1.3"><b style="display:block;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(t.name || '') + (pkNum(t.qty) > 1 ? ' × ' + esc(t.qty) : '') + '</b>' +
        '<span style="opacity:.75">' + (n ? '📷 ' + n + (t.last ? ' · ' + esc(pkDay(t.last)) : '') : esc(TX('фото нет'))) + '</span>' + (pkPriceMin(t.prices) ? '<span style="display:block;font-weight:600">💰 ' + esc(TX('от')) + ' ' + pkPriceMin(t.prices) + ' ' + esc(TX('смн')) + '</span>' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  // Цена аренды из прайса: «до 3 ч — 30 смн · сутки — 40 смн».
  function pkPrices(list) {
    var sr = { 'коротко': TX('до 3 ч'), 'сутки': TX('сутки'), 'день': TX('день') };
    return (Array.isArray(list) ? list : []).map(function (p) { return (sr[p.srok] || TX(p.srok || '')) + ' — ' + pkNum(p.cena) + ' ' + TX('смн'); }).join(' · ');
  }
  function pkPriceMin(list) { var c = (Array.isArray(list) ? list : []).map(function (p) { return pkNum(p.cena); }).filter(function (x) { return x > 0; }); return c.length ? Math.min.apply(null, c) : 0; }
  function pkToolOpen(i) {
    var t = PK.ph && PK.ph.tools[i]; if (!t || !PK.cur) return;
    var pt = PK.pt = { point: PK.cur.name, tool: t.name, kind: t.kind || '', prices: t.prices || [], loading: true, photos: [], total: 0, error: '' }; PK.big = null; render();
    callTo('/prokat-foto', { action: 'tool', name: pt.point, tool: pt.tool }).then(function (r) {
      if (PK.pt !== pt) return;
      pt.loading = false;
      if (!r || !r.ok) pt.error = (r && r.error) || TX('не удалось загрузить');
      else { pt.photos = Array.isArray(r.photos) ? r.photos : []; pt.total = pkNum(r.total) || pt.photos.length; if (Array.isArray(r.prices)) { pt.prices = r.prices; pt.kind = r.kind || ''; } }
      if (S.view === 'prokat') render();
    });
  }
  function renderPkToolHist(el) {
    var pt = PK.pt, h = pkBtn('pt-back', '← ' + esc(pt.point), true, 'margin-bottom:8px') + '<h2 style="padding-right:36px;margin-bottom:2px">🧰 ' + esc(pt.tool) + '</h2><p style="margin:0 0 10px;opacity:.8">' + esc(pt.point) + '</p>' +
      '<div style="margin:0 0 12px;padding:10px;border-radius:10px;background:rgba(31,138,76,.1)"><b>💰 ' + esc(TX('Цена аренды')) + (pt.kind ? ' (' + esc(TX(pt.kind)) + ')' : '') + '</b><br>' + esc(pkPrices(pt.prices) || TX('В прайсе цены для этого инструмента нет')) + '</div>';
    if (pt.loading) return void (el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>');
    if (pt.error) return void (el.innerHTML = h + '<p style="color:#c0392b">' + esc(pt.error) + '</p>' + pkBtn('pt-retry', esc(TX('Ещё раз')), true));
    if (!pt.photos.length) return void (el.innerHTML = h + '<p style="opacity:.75">' + esc(TX('Фото этого инструмента пока нет. Новое фото появится после объезда.')) + '</p>');
    h += '<p style="margin:0 0 8px">' + esc(TX('Фото по датам, от первого к последнему')) + ': <b>' + esc(pt.total) + '</b>' + (pt.total > pt.photos.length ? ' (' + esc(TX('показаны последние')) + ' ' + pt.photos.length + ')' : '') + '</p>';
    h += '<div style="display:grid;gap:12px">' + pt.photos.map(function (p, i) {
      var u = pkSafeUrl(p.url), sub = [p.src === 'объезд' ? TX('объезд') : '', p.state ? TX(p.state) : '', p.note || ''].filter(Boolean).join(' · ');
      return '<figure style="margin:0;border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden">' +
        (u ? '<button type="button" data-pk="pth:' + i + '" style="display:block;width:100%;padding:0;border:0;background:none;cursor:pointer"><img src="' + esc(u) + '" loading="lazy" alt="' + esc(pt.tool + ', ' + pkDay(p.date)) + '" style="display:block;width:100%;max-height:420px;object-fit:contain;background:rgba(127,127,127,.12)"></button>' : '<span style="display:block;padding:24px;text-align:center;opacity:.7">' + esc(TX('фото не загрузилось')) + '</span>') +
        '<figcaption style="padding:8px 10px"><b style="font-size:17px">📅 ' + esc(p.date ? pkDay(p.date) : TX('дата неизвестна')) + '</b>' + (sub ? '<small style="display:block;opacity:.8">' + esc(sub) + '</small>' : '') + '</figcaption></figure>';
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
    if (pkSkClick(k)) return;
    if (k === 'cmp') return pkCmpOpen();
    if (k.indexOf('ci:') === 0) { if (PK.cmp) { var ci = +k.slice(3); PK.cmp.open[ci] = !PK.cmp.open[ci]; render(); } return; }
    if (k === 'rem') { if (PK.rem) { PK.rem.open = !PK.rem.open; render(); } return; }
    if (k.indexOf('rp:') === 0) { var L = pkRemLists(), ra = k.split(':'), rx = L && L[{ v: 'visit', o: 'owed', b: 'broken' }[ra[1]]]; var it = rx && rx[+ra[2]]; if (it && it.name) { PK.folder = true; pkOpenPoint(it.name); } return; }
    if (k.indexOf('f:') === 0) { if (['all', 'minus', 'plus', 'idle'].indexOf(k.slice(2)) >= 0) PK.filter = k.slice(2); return render(); }
    if (k.indexOf('p:') === 0) { var p = PK.points[+k.slice(2)]; if (p) pkOpenPoint(p.name); return; }
    if (k.indexOf('m:') === 0) { if (PK.form && PK_PAY[k.slice(2)]) { pkKeep(); PK.form.method = k.slice(2); render(); } return; }
    if (k === 'folder') { PK.folder = true; PK.ride = false; return render(); }
    if (k === 'home') { PK.folder = false; PK.sk = null; PK.all = null; PK.cmp = null; PK.ride = false; return render(); }
    if (k === 'sklad') return pkSkOpen();
    if (k === 'all') return pkAllOpen();
    if (k === 'all-retry') return pkAllOpen();
    if (k.indexOf('grp:') === 0) { if (PK.all) { var gi = +k.slice(4); PK.all.open[gi] = !PK.all.open[gi]; render(); } return; }
    if (k.indexOf('pt:') === 0) return pkToolOpen(+k.slice(3));
    if (k === 'pt-back') { PK.pt = null; PK.big = null; return render(); }
    if (k === 'pt-retry') { if (PK.pt) { var ti = PK.ph ? PK.ph.tools.map(function (t) { return t.name; }).indexOf(PK.pt.tool) : -1; PK.pt = null; if (ti >= 0) pkToolOpen(ti); else render(); } return; }
    if (k.indexOf('pth:') === 0) { var tp = PK.pt && PK.pt.photos[+k.slice(4)]; if (tp && pkSafeUrl(tp.url)) { PK.big = { url: tp.url, name: PK.pt.tool, date: pkDay(tp.date) }; render(); } return; }
    if (k === 'big-close') { PK.big = null; return render(); }
    if (k === 'ph-retry') { if (PK.cur) { pkPhLoad(PK.cur.name); render(); } return; }
    if (k === 'back') { PK.cur = null; PK.ph = null; PK.pt = null; PK.big = null; PK.form = null; PK.msg = ''; PK.err = ''; PK.ride = false; return render(); }
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
  function renderBuh(el) {
    if (S.onb) return renderOnb(el);
var h = backBtn() + '<h2 style="padding-right:36px">📒 ' + esc(TX('Бухгалтер')) + '</h2>' + (S.prof ? '<button type="button" class="btn sec" data-onb="change" style="height:30px;padding:0 10px;margin:0 0 6px;font-size:13px">' + esc(TX('Изменить вид деятельности')) + '</button>' : '');
    h += shBtnsHtml();
    if (!S.buh) { el.innerHTML = h + '<p>' + esc(TX('Загрузка…')) + '</p>'; return; }
    if (S.buh.error) { el.innerHTML = h + '<p class="err">' + esc(S.buh.error) + '</p><button class="btn" data-buh="reload" type="button">' + esc(TX('Ещё раз')) + '</button>'; return; }
    writeCache();
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
  var SELLER = false, KAS_SID = '', KEEPER = false;
  var SH = { low: '', pcode: '', tab: 'kassa', d: null, cart: [], pay: '', who: '', cid: '', busy: false, err: '', ok: '', form: null, rcv: null, payf: null, delAsk: '', voidAsk: '', month: '', found: null, code: '' };
  var SH_DEBT_WARN = 100000; // порог предупреждения о большом долге: 1000 сомони, в дирамах
  function shMoney(x) { return money(cents(x)); }
  function shProd(kod) { var r = null; ((SH.d && SH.d.products) || []).forEach(function (p) { if (p.kod === kod) r = p; }); return r; }
  // Единицы измерения (24.10.2026, только магазин Шамсуло): штуки, метры до сантиметра, килограммы до грамма, граммы, рулоны.
  // per — сколько единиц в одной штуке (труба 4 м, рулон 25 м): такой товар можно принять и продать и штуками, и метрами.
  var SH_U = { sht: ['шт', 'дона', 'dona'], m: ['м', 'м', 'm'], kg: ['кг', 'кг', 'kg'], g: ['г', 'г', 'g'], rulon: ['рулон', 'рулон', 'rulon'] };
  var SH_UN = [['sht', 'Штуки', 'Дона', 'Dona'], ['m', 'Метры (до сантиметра)', 'Метр (то сантиметр)', 'Metr (santimetrgacha)'], ['kg', 'Килограммы (до грамма)', 'Килограмм (то грамм)', 'Kilogramm (grammgacha)'], ['g', 'Граммы', 'Грамм', 'Gramm'], ['rulon', 'Рулоны', 'Рулон', 'Rulon']];
  function shU(p) { return p && SH_U[p.unit] ? p.unit : 'sht'; }
  function shUL(u) { var x = SH_U[u] || SH_U.sht; return ui(x[0], x[1], x[2]); }
  function shQR(u, x) { var f = u === 'm' ? 100 : u === 'kg' ? 1000 : 1; return Math.round(Number(x) * f) / f; }
  function shNumTxt(n) { return String(n).replace('.', ','); }
  function shPer(p) { return p && Number(p.per) > 0 && shU(p) !== 'sht' ? Number(p.per) : 0; }
  function shQ(p, q) { var u = shU(p), n = shQR(u, q), per = shPer(p), t = shNumTxt(n) + ' ' + shUL(u); if (per && Math.abs(n) >= per) t += ' (≈' + shNumTxt(Math.floor(Math.abs(n) / per * 10) / 10) + ' ' + ui('шт', 'дона', 'dona') + ')'; return t; }
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
  function shFindExact(code) { var t = String(code).toLowerCase(), hit = null; ((SH.d && SH.d.products) || []).forEach(function (p) { if (String(p.kod).toLowerCase() === t) hit = p; }); return hit; }
  function shScanMsg(t) { var m = SCAN && SCAN.ov && SCAN.ov.querySelector('#sh-scan-msg'); if (m) m.textContent = t; }
  function shScanStop() {
    if (!SCAN) return; var s = SCAN; SCAN = null; clearInterval(s.timer);
    try { if (s.stream) s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (s.ov.parentNode) s.ov.parentNode.removeChild(s.ov); } catch (e) {}
  }
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
    try { if (typeof window.BarcodeDetector === 'function' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] }); } catch (e) { det = null; }
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
    var code = String(raw || '').trim().slice(0, 20); if (!code) return;
    var mode = SCAN.mode; SCAN.done = true; shScanStop();
    SH.err = ''; SH.ok = ''; SH.found = null; SH.low = '';
    var p = shFindExact(code), noAdd = ui('Товара с кодом «' + code + '» нет. Скажите кладовщику или владельцу.', 'Мол бо рамзи «' + code + '» нест. Ба анбордор ё соҳиб гӯед.', '«' + code + '» kodli tovar yoʻq. Omborchi yoki egasiga ayting.');
    var newOne = ui('Товара с кодом «' + code + '» ещё нет. Заведите его: название, закупка и маржа.', 'Мол бо рамзи «' + code + '» ҳанӯз нест. Онро ворид кунед: ном, нархи харид ва маржа.', '«' + code + '» kodli tovar hali yoʻq. Uni kiriting: nomi, xarid narxi va marja.');
    if (mode === 'sell') {
      SH.tab = 'kassa'; SH.code = '';
      if (p) shPut(p.kod);
      else if (shCanCreate()) { SH.tab = 'prihod'; SH.rcv = null; SH.pcode = ''; SH.fotoNew = ''; SH.form = { kod: code, name: '', zakup: '', marzha: '' }; SH.err = newOne; }
      else SH.err = noAdd;
      return render();
    }
    SH.tab = 'prihod'; SH.pcode = '';
    if (p) { SH.rcv = { kod: p.kod, name: p.name }; SH.form = null; }
    else if (shCanCreate()) { SH.rcv = null; SH.fotoNew = ''; SH.form = { kod: code, name: '', zakup: '', marzha: '' }; SH.err = newOne; }
    else { SH.rcv = null; SH.err = noAdd; }
    render();
  }
  function shRw() { try { return Number(lstore('ew_rw')) === 80 ? 80 : 58; } catch (e) { return 58; } }
  function shPrintReceipt() {
    var r = SH.last; if (!r) return; var w = shRw(), d = new Date(r.ts), pn = { nal: ui('наличные', 'нақд', 'naqd'), perevod: ui('перевод', 'гузаронидан', 'oʻtkazma'), alif: 'Алиф', dushanbe: 'Душанбе Сити', mix: ui('смешанная', 'омехта', 'aralash'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('владелец', 'соҳиб', 'egasi') };
    var rows = r.lines.map(function (l) { return '<tr><td colspan="2">' + esc(l.name) + '</td></tr><tr><td>' + esc(shNumTxt(l.qty)) + (l.u && l.u !== 'sht' ? ' ' + esc(shUL(l.u)) : '') + ' × ' + esc(money(l.price)) + '</td><td class="r">' + esc(money(Math.round(l.price * l.qty))) + '</td></tr>'; }).join('');
    var doc = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(ui('Чек', 'Чек', 'Chek')) + '</title><style>@page{size:' + w + 'mm auto;margin:2mm}body{font:' + (w === 80 ? 14 : 12) + 'px monospace;width:' + (w - 6) + 'mm;margin:0;color:#000}h1{font-size:1.2em;text-align:center;margin:0 0 4px}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}.r{text-align:right}hr{border:0;border-top:1px dashed #000;margin:4px 0}.c{text-align:center}</style></head><body><h1>' + esc(ui('Чек', 'Чек', 'Chek')) + '</h1><div class="c">' + esc(d.toLocaleDateString()) + ' ' + esc(d.toLocaleTimeString().slice(0, 5)) + '</div><hr><table>' + rows + '</table><hr><table><tr><td><b>' + esc(ui('Итого', 'Ҳамагӣ', 'Jami')) + '</b></td><td class="r"><b>' + esc(money(r.total)) + '</b></td></tr><tr><td>' + esc(pn[r.pay] || '') + '</td><td class="r">' + (r.pay === 'dolg' ? esc(r.who) : '') + '</td></tr></table><hr><div class="c">' + esc(ui('Спасибо за покупку!', 'Ташаккур барои харид!', 'Xaridingiz uchun rahmat!')) + '</div></body></html>';
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    var dw = f.contentWindow; dw.document.open(); dw.document.write(doc); dw.document.close();
    setTimeout(function () { try { dw.focus(); dw.print(); } catch (e) {} setTimeout(function () { try { f.remove(); } catch (e) {} }, 60000); }, 200);
  }
  function shCartSum() { var c = 0; SH.cart.forEach(function (it) { var p = shProd(it.kod); if (p) c += shLineSum(SH.pay === 'vladelec' ? p.zakup : p.price, it.qty); }); return c; }
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
    var have = line ? line.qty : 0, step = shStep(p);
    SH.low = have + step > p.qty ? ui('На складе меньше: ', 'Дар анбор камтар аст: ', 'Omborda kamroq: ') + p.name + ' (' + shQ(p, p.qty) + '). ' + ui('Продажа пройдёт, скажите кладовщику оформить приём.', 'Фурӯш мегузарад, ба анбордор бигӯед, ки қабулро расмӣ кунад.', 'Sotuv oʻtadi, ombor mudiriga qabulni rasmiylashtirishni ayting.') : '';
    if (line) line.qty = shQR(shU(p), line.qty + step); else SH.cart.push({ kod: kod, qty: step });
  }
  var SH_PAY = [['nal', 'Наличные', 'Нақд', 'Naqd'], ['alif', 'Алиф', 'Алиф', 'Alif'], ['dushanbe', 'Душанбе Сити', 'Душанбе Сити', 'Dushanbe City'], ['mix', 'Смешанная', 'Омехта', 'Aralash'], ['dolg', 'В долг', 'Қарз', 'Qarzga'], ['vladelec', 'Шеф Шамсуло взял', 'Роҳбар гирифт', 'Rahbar oldi']];
  function shBtn(a, label, extra, k) { return '<button class="btn' + (extra && extra.sec ? ' sec' : '') + '" type="button" data-shop="' + a + '"' + (k != null ? ' data-k="' + esc(k) + '"' : '') + ' style="min-height:48px;font-size:16px' + (extra && extra.st ? ';' + extra.st : '') + '">' + esc(label) + '</button>'; }
  function shIn(id, ph, val, attrs) { return '<input class="in2" id="' + id + '" placeholder="' + esc(ph) + '" value="' + esc(val == null ? '' : val) + '" autocomplete="off" ' + (attrs || '') + ' style="height:48px;font-size:16px">'; }
  function renderShop(el) {
    var st = sellerView(); if (st) SH.tab = KEEPER ? 'prihod' : 'kassa';
    var kl = !!SH.kl && !SELLER && !staffNow(); if (kl && SH.tab !== 'tovar') SH.tab = 'prihod';
    var simple = SH.tab === 'kassa', h = st ? '<div style="height:28px"></div>' : backBtn() + (simple ? '' : '<h2 style="padding-right:36px">' + (kl ? '📦 ' + esc(ui('Кладовщик', 'Анбордор', 'Omborchi')) : '🛒 ' + esc(ui('Учёт магазина', 'Ҳисоби мағоза', 'Doʻkon hisobi'))) + '</h2>');
    if (SELLER) {
      var who = ''; try { who = PREVIEW ? ui('Так видит продавец', 'Фурӯшанда чунин мебинад', 'Sotuvchi shunday koʻradi') : (store('ew_sname') || ''); } catch (e) {}
      h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><h2 style="margin:0">' + (KEEPER ? '📦 ' + esc(ui('Приём товара', 'Қабули мол', 'Tovar qabuli')) : '🛒 ' + esc(ui('Продажа', 'Фурӯш', 'Sotuv'))) + '</h2><span style="display:flex;align-items:center;gap:8px"><small>' + esc(who) + '</small>' + shBtn('selout', PREVIEW ? ui('Закрыть', 'Пӯшидан', 'Yopish') : ui('Выйти', 'Баромад', 'Chiqish'), { sec: true, st: 'min-height:40px;font-size:14px;padding:0 12px' }) + '</span></div>';
    }
    if (!SELLER && !staffNow() && kl) h += '<div style="margin:0 0 8px"><div style="display:flex;gap:6px;flex-wrap:wrap">' + shBtn('addst', '👥 ' + ui('Добавить сотрудника', 'Илова кардани корманд', 'Xodim qoʻshish'), { sec: true, st: 'min-height:40px;font-size:14px' }, 'kladovshchik') + shBtn('previewk', '👁 ' + ui('Как видит кладовщик', 'Анбордор чӣ тавр мебинад', 'Omborchi qanday koʻradi'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '</div></div>';
    if (!SELLER && !staffNow() && !kl) h += '<div style="margin:0 0 8px">' + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + shBtn('addst', '👥 ' + ui('Добавить сотрудника', 'Илова кардани корманд', 'Xodim qoʻshish'), { sec: true, st: 'min-height:40px;font-size:14px' }, 'prodavec') + shBtn('preview', '👁 ' + ui('Как видит продавец', 'Фурӯшанда чӣ тавр мебинад', 'Sotuvchi qanday koʻradi'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '</div></div>';
    var tabs = [['kassa', 'Продажа', 'Фурӯш', 'Sotuv'], ['prihod', 'Приём', 'Қабул', 'Qabul'], ['tovar', 'Товары', 'Молҳо', 'Tovarlar'], ['dolg', 'Долги', 'Қарзҳо', 'Qarzlar'], ['zp', 'Зарплата', 'Маош', 'Maosh'], ['anal', 'Анализ', 'Таҳлил', 'Tahlil'], ['otchet', 'Отчёт', 'Ҳисобот', 'Hisobot']];
    if (kl) tabs = tabs.filter(function (t) { return t[0] === 'prihod' || t[0] === 'tovar'; });
    if (!SELLER && !staffNow()) h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:6px;margin:8px 0">' + tabs.map(function (t) { return shBtn('tab', ui(t[1], t[2], t[3]), { sec: SH.tab !== t[0] }, t[0]); }).join('') + '</div>';
    if (SH.low && SH.tab === 'kassa') h += '<p role="status" id="sh-low" style="margin:8px 0;padding:8px 10px;border-radius:8px;background:#fff4d6;color:#7a5200">' + esc(SH.low) + '</p>';
    if (SH.err) h += '<p class="err" role="alert" id="sh-err">' + esc(SH.err) + '</p>';
    if (SH.ok) h += '<p id="sh-ok" style="background:#e3f6ea;color:#1f6b3d;padding:8px 10px;border-radius:8px">' + esc(SH.ok) + '</p>';
    if (SH.ok && SH.last && SH.tab === 'kassa') { var rw = shRw(); h += '<div style="display:flex;gap:6px;align-items:center;margin:0 0 8px;flex-wrap:wrap">' + shBtn('print', '🖨 ' + ui('Печать чека', 'Чопи чек', 'Chek chop etish'), { sec: true, st: 'min-height:40px;font-size:14px' }) + '<small style="opacity:.7">' + esc(ui('Лента', 'Лента', 'Lenta')) + '</small>' + shBtn('rw', '58', { sec: rw !== 58, st: 'min-height:40px;width:56px;padding:0;font-size:14px' }, 58) + shBtn('rw', '80', { sec: rw !== 80, st: 'min-height:40px;width:56px;padding:0;font-size:14px' }, 80) + '</div>'; }
    if (!SH.d) { el.innerHTML = h + '<p>' + esc(SH.err ? '' : TX('Загрузка…')) + '</p>' + (SH.err ? shBtn('reload', ui('Ещё раз', 'Боз кӯшиш кунед', 'Yana urinib koʻring'), { sec: true }) : ''); return; }
    h += SH.tab === 'kassa' ? shStaffKassa() : SH.tab === 'prihod' ? shPrihod() : SH.tab === 'tovar' ? shTovar() : SH.tab === 'dolg' ? shDolg() : SH.tab === 'zp' ? shZp() : SH.tab === 'anal' ? shAnal() : shOtchet();
    el.innerHTML = h;
  }
  // Подсказки по первым цифрам кода; когда код набран целиком, остаётся одна крупная карточка (нажатие добавляет ещё одну штуку).
  function shHintsHtml() {
    var D = SH.d, t = String(SH.code || '').trim().toLowerCase(); if (D && !t) return '<span style="opacity:.65">' + esc(ui('Подходящие товары появятся здесь', 'Молҳои мувофиқ дар ин ҷо пайдо мешаванд', 'Mos tovarlar shu yerda chiqadi')) + '</span>'; if (!D || !t) return '';
    var exact = D.products.filter(function (p) { return p.kod.toLowerCase() === t; })[0];
    if (exact) {
      var line = null; SH.cart.forEach(function (it) { if (it.kod === exact.kod) line = it; });
      return '<button type="button" class="btn sec" data-shop="put" data-k="' + esc(exact.kod) + '" style="display:block;width:100%;height:auto;text-align:left;padding:14px;margin:8px 0">' +
        '<small style="opacity:.75">' + esc(ui('Код ', 'Рамз ', 'Kod ')) + esc(exact.kod) + '</small><br><b style="font-size:20px">' + esc(exact.name) + '</b><br>' +
        '<span style="font-size:18px">' + esc(shMoney(exact.price)) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy')) + esc(shZa(exact)) + '</span><br>' +
        '<small style="opacity:.75">' + esc(ui('Осталось ', 'Боқимонда ', 'Qoldi ')) + esc(shQ(exact, exact.qty)) + ' · ' + esc(line ? ui('В корзине: ', 'Дар сабад: ', 'Savatda: ') + shQ(exact, line.qty) + '. ' + ui('Нажмите ещё раз, чтобы добавить.', 'Боз пахш кунед, то илова шавад.', 'Yana bossangiz, qoʻshiladi.') : ui('Нажмите на карточку, чтобы добавить.', 'Барои илова кардан ба корт пахш кунед.', 'Qoʻshish uchun kartani bosing.')) + '</small></button>';
    }
    var r = D.products.filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 8);
    if (!r.length) return '<p style="margin:8px 0;opacity:.75">' + esc(ui('Такого кода нет. Проверьте цифры.', 'Чунин рамз нест. Рақамҳоро санҷед.', 'Bunday kod yoʻq. Raqamlarni tekshiring.')) + '</p>';
    return '<div style="display:grid;gap:10px;margin:8px 0">' + r.map(function (p) {
      return '<button type="button" class="btn sec" data-shop="put" data-k="' + esc(p.kod) + '" style="display:flex;align-items:center;gap:12px;width:100%;height:auto;min-height:84px;text-align:left;padding:12px 14px">' + shThumb(p, 60) +
        '<span style="flex:1;min-width:0"><b style="display:block;font-size:19px;line-height:1.25;white-space:normal">' + esc(p.name) + '</b><small style="opacity:.75">' + esc(p.kod) + ' · ' + esc(ui('ост. ', 'бок. ', 'qol. ')) + esc(shQ(p, p.qty)) + '</small></span>' +
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
      shBtn('plus', '+', { sec: true, st: 'width:48px;padding:0' }, it.kod) + (per ? '<small style="opacity:.75">' + esc(ui('+ кнопка = 1 шт (', '+ тугма = 1 дона (', '+ tugma = 1 dona (') + shNumTxt(per) + ' ' + shUL(u) + ')') + '</small>' : '') + '</div>';
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
    h += shExpBox(true);
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
    h += shExpBox();
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
  function shSdBox() {
    var h = '<div style="margin-top:14px">';
    if (SH.sdRes) { var r = SH.sdRes, ok = Math.abs(r.diff) < 0.005; h += '<div role="status" style="margin:0 0 10px;padding:10px 12px;border-radius:10px;background:' + (ok ? '#e6f6ec' : '#fff4d6') + '"><b>' + esc(ui('Касса сдана', 'Касса супорида шуд', 'Kassa topshirildi')) + '</b><br>' + esc(ui('Должно быть: ', 'Бояд бошад: ', 'Boʻlishi kerak: ')) + esc(money(cents(r.expected))) + '<br>' + esc(ui('Вы сдали: ', 'Шумо супоридед: ', 'Siz topshirdingiz: ')) + esc(money(cents(r.fact))) + '<br><b>' + (ok ? esc(ui('Всё сходится', 'Ҳама мувофиқ', 'Hammasi mos')) : (r.diff < 0 ? esc(ui('Недостача: ', 'Камомад: ', 'Kamomad: ')) : esc(ui('Излишек: ', 'Зиёдатӣ: ', 'Ortiqcha: '))) + esc(money(cents(Math.abs(r.diff)))) + ' ' + esc(ui('сомони', 'сомонӣ', 'somoniy'))) + '</b></div>'; }
    if (!SH.sdOpen) return h + shBtn('sdopen', '🧾 ' + ui('Сдать кассу', 'Супоридани касса', 'Kassani topshirish'), { sec: true, st: 'width:100%' }) + '</div>';
    h += '<b>' + esc(ui('Сдать кассу', 'Супоридани касса', 'Kassani topshirish')) + '</b><p style="margin:4px 0 8px"><small>' + esc(ui('Пересчитайте наличные в кассе и впишите сумму. Программа сама сравнит с продажами.', 'Пули нақдро ҳисоб карда, маблағро нависед. Барнома худаш муқоиса мекунад.', 'Kassadagi naqd pulni sanab, summani yozing. Dastur oʻzi solishtiradi.')) + '</small></p><div style="display:grid;gap:8px">' + shIn('sh-sd-fact', ui('Наличных в кассе, сомони', 'Пули нақд дар касса, сомонӣ', 'Kassadagi naqd, somoniy'), '', 'inputmode="decimal"') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('sdsave', SH.busy ? TX('Загрузка…') : ui('Сдать', 'Супоридан', 'Topshirish')) + shBtn('sdopen', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div></div>';
    return h;
  }
  // «Личный расход» продавца: взял из кассы на себя — простая запись, не долг; итоги по продавцам видит только руководитель.
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
    return '<label for="sh-f-unit" style="font-size:15px;font-weight:600">' + esc(ui('Как продаётся (единица)', 'Чӣ тавр фурӯхта мешавад (воҳид)', 'Qanday sotiladi (birlik)')) + '</label><select class="in2" id="sh-f-unit" style="height:48px;font-size:16px">' + SH_UN.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === u ? ' selected' : '') + '>' + esc(ui(x[1], x[2], x[3])) + '</option>'; }).join('') + '</select>' +
      '<div id="sh-f-perbox"' + (u === 'sht' ? ' hidden' : '') + ' style="display:grid;gap:4px"><label for="sh-f-per" style="font-size:15px;font-weight:600" id="sh-f-perl">' + esc(shPerLabel(u)) + '</label>' + shIn('sh-f-per', ui('Например 4', 'Масалан 4', 'Masalan 4'), f.per || '', 'inputmode="decimal"') + '</div>';
  }
  function shPerLabel(u) { return ui('Сколько ' + shUL(u) + ' в одной штуке (труба, рулон) — необязательно', 'Дар як дона чанд ' + shUL(u) + ' (қубур, рулон) — ихтиёрӣ', 'Bir donada necha ' + shUL(u) + ' (quvur, rulon) — ixtiyoriy'); }
  function shZa1(p) { return ui('за 1 ', 'барои 1 ', '1 ') + shUL(shU(p)) + ui('', '', ' uchun'); }
  // Количество при приёме: в единице товара (метры до сантиметра, килограммы до грамма); если задано «в одной штуке» — можно ввести штуками.
  function shRcvQty(p) {
    var u = shU(p), per = shPer(p), dec = u === 'm' || u === 'kg';
    var h = '<label for="sh-r-qty" style="font-size:15px;font-weight:600">' + esc(u === 'sht' ? ui('Сколько штук приняли', 'Чанд дона қабул кардед', 'Necha dona qabul qildingiz') : ui('Сколько приняли, ', 'Чанд қабул кардед, ', 'Qancha qabul qildingiz, ') + shUL(u)) + '</label>' + shIn('sh-r-qty', u === 'm' ? ui('Например 12,5', 'Масалан 12,5', 'Masalan 12,5') : u === 'kg' ? ui('Например 2,350', 'Масалан 2,350', 'Masalan 2,350') : ui('Сколько пришло', 'Чанд омад', 'Qancha keldi'), '', 'inputmode="' + (dec ? 'decimal' : 'numeric') + '"');
    if (per) h += '<label for="sh-r-pcs" style="font-size:15px;font-weight:600">' + esc(ui('или штуками (1 шт = ', 'ё бо дона (1 дона = ', 'yoki dona bilan (1 dona = ') + shNumTxt(per) + ' ' + shUL(u) + ')') + '</label>' + shIn('sh-r-pcs', ui('Сколько штук', 'Чанд дона', 'Necha dona'), '', 'inputmode="numeric"');
    return h;
  }
  // «Приём товара» (кладовщик и руководитель): найти товар по коду или названию, записать приход, завести новый товар. Остаток общий с «Продажей».
  function shPHints() {
    var t = String(SH.pcode || '').trim().toLowerCase();
    if (!t) return '<span style="opacity:.65">' + esc(ui('Введите код или название товара', 'Рамз ё номи молро ворид кунед', 'Tovar kodi yoki nomini kiriting')) + '</span>';
    var r = ((SH.d && SH.d.products) || []).filter(function (p) { return p.kod.toLowerCase().indexOf(t) === 0 || p.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 8);
    if (!r.length) return '<small>' + esc(ui('Такого товара нет. Нажмите «Новый товар».', 'Чунин мол нест. «Моли нав»-ро пахш кунед.', 'Bunday tovar yoʻq. «Yangi tovar»ni bosing.')) + '</small>';
    return '<div style="display:grid;gap:6px">' + r.map(function (p) { return shBtn('rcv', p.kod + ' · ' + p.name + ' · ' + ui('ост. ', 'бок. ', 'qol. ') + shQ(p, p.qty) + ' · ' + ui('себестоимость ', 'арзиши аслӣ ', 'tannarx ') + shMoney(p.zakup) + shZa(p), { sec: true, st: 'text-align:left' }, p.kod); }).join('') + '</div>';
  }
  function shPrihod() {
    if (SH.cnt && SH.cnt.open) return shCnt();
    var D = SH.d, h = '', f = SH.form;
    if (f) {
      h += '<form data-shopform="save" style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(ui('Новый товар', 'Моли нав', 'Yangi tovar')) + '</b>' +
        shIn('sh-f-kod', ui('Код товара (буквы и цифры)', 'Рамзи мол (ҳарф ва рақам)', 'Tovar kodi (harf va raqam)'), f.kod, 'maxlength="20"') +
        shIn('sh-f-name', ui('Название', 'Ном', 'Nomi'), f.name, 'maxlength="60"') +
        shIn('sh-f-zakup', ui('Закупочная цена', 'Нархи харид', 'Xarid narxi'), f.zakup, 'inputmode="decimal"') + shSellFields(f) + shUnitFields(f) +
        shFotoBox('<div style="display:flex;gap:8px;align-items:center">' + (SH.fotoNew ? '<img alt="" src="' + SH.fotoNew + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px">' : '') + shBtn('foto', '📷 ' + (SH.fotoNew ? ui('Переснять', 'Аз нав гирифтан', 'Qayta olish') : ui('Фото товара', 'Акси мол', 'Tovar surati')), { sec: true, st: 'min-height:44px' }, 'new') + '</div>') +
        '<div id="sh-f-price" style="font-size:15px;opacity:.8">' + esc(shSellNote(f.fsm)) + '</div><div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('save', ui('Сохранить', 'Захира', 'Saqlash')) + shBtn('fcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></form>';
    } else if (SH.rcv) {
      var cur = shProd(SH.rcv.kod);
      h += '<div style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b style="font-size:18px">' + esc(ui('Приём товара', 'Қабули мол', 'Tovar qabuli')) + ': ' + esc(cur ? cur.name : SH.rcv.kod) + ' <small>(' + esc(SH.rcv.kod) + ')</small></b>' + shFotoBox('<div style="display:flex;gap:8px;align-items:center">' + shThumb(cur, 56) + shBtn('foto', '📷 ' + (cur && cur.foto ? ui('Переснять', 'Аз нав гирифтан', 'Qayta olish') : ui('Фото товара', 'Акси мол', 'Tovar surati')), { sec: true, st: 'min-height:44px' }, 'rcv') + '</div>') + '<b>' + esc(ui('Приход товара', 'Воридоти мол', 'Tovar kirimi')) + ': ' + esc(SH.rcv.name) + '</b>' + (cur ? '<small>' + esc(ui('Сейчас на складе: ', 'Ҳоло дар анбор: ', 'Hozir omborda: ')) + esc(shQ(cur, cur.qty)) + '</small>' : '') +
        '<div style="font-size:17px">' + esc(ui('Себестоимость сейчас', 'Арзиши аслии ҳозира', 'Joriy tannarx')) + ': <b>' + esc(cur ? shMoney(cur.zakup) : '') + '</b> ' + esc(shZa1(cur)) + '</div>' + shRcvQty(cur) +
        '<label for="sh-r-zakup" style="font-size:15px;font-weight:600">' + esc(ui('Цена, по которой приняли', 'Нархе, ки қабул кардед', 'Qabul qilingan narx')) + ' (' + esc(shZa1(cur)) + ')</label>' + shIn('sh-r-zakup', ui('Цена приёма', 'Нархи қабул', 'Qabul narxi'), cur ? cur.zakup : '', 'inputmode="decimal"') +
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('rok', ui('Записать приход', 'Сабти воридот', 'Kirimni yozish')) + shBtn('rcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
    } else {
      h += '<h3 style="margin:4px 0 8px">' + esc(ui('Приём товара', 'Қабули мол', 'Tovar qabuli')) + '</h3><p style="margin:0 0 8px;opacity:.8"><small>' + esc(ui('1) Введите код или название товара и выберите его. 2) Укажите, сколько приняли (штук, метров, килограммов — как у товара) и по какой цене.', '1) Рамз ё номи молро ворид карда, интихоб кунед. 2) Чанд (дона, метр, килограмм) ва бо кадом нарх қабул кардаед нависед.', '1) Tovar kodi yoki nomini kiriting va tanlang. 2) Qancha (dona, metr, kilogramm) va qaysi narxda qabul qilganingizni yozing.')) + '</small></p><div><div style="display:grid;grid-template-columns:1fr auto;gap:8px">' + shIn('sh-pcode', ui('Код или название товара', 'Рамз ё номи мол', 'Tovar kodi yoki nomi'), SH.pcode, 'inputmode="text" enterkeyhint="done"') + shScanBtn('recv') + '</div>' + '<div id="sh-phints" style="margin-top:10px;min-height:48px">' + shPHints() + '</div></div>' +
        shBtn('fnew', '＋ ' + ui('Новый товар', 'Моли нав', 'Yangi tovar'), { sec: true, st: 'width:100%;margin:10px 0' }) + shBtn('copen', '📋 ' + ui('Пересчёт товара', 'Ҳисобкунии мол', 'Tovarni qayta sanash'), { sec: true, st: 'width:100%;margin:0 0 10px' });
    }
    var rc = (D && D.receipts) || [];
    h += '<h3 style="margin-top:14px">' + esc(ui('Последние приёмы', 'Қабулҳои охирин', 'Oxirgi qabullar')) + '</h3>';
    if (!rc.length) return h + '<p style="opacity:.75">' + esc(ui('Приёмов пока нет.', 'Ҳоло қабул нест.', 'Hozircha qabul yoʻq.')) + '</p>';
    return h + rc.slice(0, 15).map(function (x) {
      return '<div style="padding:8px 0;border-bottom:1px solid #e6e6e6"><b>' + esc(x.name) + '</b> <span style="color:' + (x.qty < 0 ? '#c0392b' : '#1f8a4c') + '">' + (x.qty > 0 ? '+' : '') + esc(shQ(shProd(x.kod), x.qty)) + '</span><br><small>' + esc(x.date) + (x.who ? ' · ' + esc(x.who) : '') + (x.fix ? ' · ' + esc(ui('поправка', 'ислоҳ', 'tuzatish')) : '') + '</small></div>';
    }).join('');
  }
  function shTovar() {
    var D = SH.d, h = '', f = SH.form;
    if (f) {
      h += '<form data-shopform="save" style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(f.edit ? ui('Изменить товар', 'Тағйири мол', 'Tovarni oʻzgartirish') : ui('Новый товар', 'Моли нав', 'Yangi tovar')) + '</b>' +
        shIn('sh-f-kod', ui('Код товара (буквы и цифры)', 'Рамзи мол (ҳарф ва рақам)', 'Tovar kodi (harf va raqam)'), f.kod, (f.edit ? 'readonly ' : '') + 'maxlength="20"') +
        shIn('sh-f-name', ui('Название', 'Ном', 'Nomi'), f.name, 'maxlength="60"') +
        shIn('sh-f-zakup', ui('Закупочная цена', 'Нархи харид', 'Xarid narxi'), f.zakup, 'inputmode="decimal"') + shSellFields(f) + shUnitFields(f) +
        shFotoBox('<div style="display:flex;gap:8px;align-items:center">' + (SH.fotoNew ? '<img alt="" src="' + SH.fotoNew + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px">' : '') + shBtn('foto', '📷 ' + (SH.fotoNew ? ui('Переснять', 'Аз нав гирифтан', 'Qayta olish') : ui('Фото товара', 'Акси мол', 'Tovar surati')), { sec: true, st: 'min-height:44px' }, 'new') + '</div>') +
        '<div id="sh-f-price" style="font-size:15px;opacity:.8">' + esc(shSellNote(f.fsm)) + '</div><div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('save', ui('Сохранить', 'Захира', 'Saqlash')) + shBtn('fcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></form>';
    } else h += shBtn('fnew', '＋ ' + ui('Добавить товар', 'Илова кардани мол', 'Tovar qoʻshish'), { sec: true, st: 'width:100%;margin:8px 0' });
    if (SH.rcv) h += '<div style="display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #ddd;border-radius:10px"><b>' + esc(ui('Приход товара', 'Воридоти мол', 'Tovar kirimi')) + ': ' + esc(SH.rcv.name) + '</b>' + shRcvQty(shProd(SH.rcv.kod)) + '<label for="sh-r-zakup" style="font-size:15px;font-weight:600">' + esc(ui('Цена, по которой приняли', 'Нархе, ки қабул кардед', 'Qabul qilingan narx')) + ' (' + esc(shZa1(shProd(SH.rcv.kod))) + ')</label>' + shIn('sh-r-zakup', ui('Цена приёма', 'Нархи қабул', 'Qabul narxi'), (shProd(SH.rcv.kod) || {}).zakup || '', 'inputmode="decimal"') + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">' + shBtn('rok', ui('Записать приход', 'Сабти воридот', 'Kirimni yozish')) + shBtn('rcancel', ui('Отмена', 'Бекор', 'Bekor'), { sec: true }) + '</div></div>';
    if (!D.products.length) return h + '<p>' + esc(ui('Товаров пока нет.', 'Ҳоло мол нест.', 'Hozircha tovar yoʻq.')) + '</p>';
    h += D.products.map(function (p) {
      var ask = SH.delAsk === p.kod;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(p.name) + '</b><span style="white-space:nowrap">' + esc(shMoney(p.price)) + esc(shZa(p)) + '</span></div><small>' + esc(p.kod) + ' · ' + esc(ui('закупка', 'харид', 'xarid')) + ' ' + esc(shMoney(p.zakup)) + (Number(p.sell) > 0 ? ' · ' + esc(ui('цена задана', 'нарх муқаррар', 'narx belgilangan')) + ' (' + esc(shNumTxt(p.marzha)) + '%)' : ' + ' + esc(String(p.marzha)) + '%') + ' · <b style="' + (p.qty <= 2 ? 'color:#c0392b' : '') + '">' + esc(ui('остаток', 'боқимонда', 'qoldiq')) + ' ' + esc(shQ(p, p.qty)) + '</b></small>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' + shBtn('rcv', ui('Приход', 'Воридот', 'Kirim'), { sec: true, st: 'flex:1' }, p.kod) + shBtn('fedit', ui('Изменить', 'Тағйир', 'Oʻzgartirish'), { sec: true, st: 'flex:1' }, p.kod) + shBtn('pdel', ask ? ui('Удалить?', 'Нест кунем?', 'Oʻchiraymi?') : '×', { sec: true, st: 'width:56px;padding:0' + (ask ? ';background:#c0392b;color:#fff' : '') }, p.kod) + '</div></div>';
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
  function shDolg() {
    var D = SH.d; if (!D.debts.length) return '<p>' + esc(ui('Долгов нет.', 'Қарз нест.', 'Qarz yoʻq.')) + '</p>';
    var tot = D.debts.reduce(function (s, c) { return s + cents(c.sum); }, 0);
    return '<p><b>' + esc(ui('Всего должны', 'Ҳамагӣ қарздоранд', 'Jami qarz')) + ': ' + esc(money(tot)) + '</b></p>' + D.debts.map(function (c) {
      var open = SH.payf === c.name;
      return '<div style="padding:10px 0;border-bottom:1px solid #e6e6e6' + (c.owner ? ';background:#fff7e6;padding-left:8px' : '') + '"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(c.owner ? ui('Владелец (взял товар)', 'Соҳиб (мол гирифт)', 'Egasi (tovar oldi)') : c.name) + '</b><b>' + esc(shMoney(c.sum)) + '</b></div><small>' + esc(ui('с ', 'аз ', '')) + esc(c.since) + '</small>' +
        (open ? '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;margin-top:6px">' + shIn('sh-p-amt', ui('Сумма', 'Маблағ', 'Summa'), c.sum, 'inputmode="decimal"') + shBtn('pok', ui('Принять', 'Қабул', 'Qabul')) + shBtn('pcancel', '×', { sec: true, st: 'width:48px;padding:0' }) + '</div>' : '<div style="margin-top:6px">' + shBtn('pay-open', c.owner ? ui('Владелец рассчитался', 'Соҳиб ҳисоб кард', 'Egasi hisob qildi') : ui('Принял оплату', 'Пардохт қабул шуд', 'Toʻlov qabul qilindi'), { sec: true }, c.name) + '</div>') + '</div>';
    }).join('');
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
  function shOtchet() {
    var R = SH.d.report, h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0">' + shBtn('mprev', '‹', { sec: true, st: 'width:56px;padding:0' }) + '<b>' + esc(monthName(R.month)) + '</b>' + shBtn('mnext', '›', { sec: true, st: 'width:56px;padding:0' }) + '</div>';
    var cell = function (l, v, c) { return '<div style="padding:10px;border:1px solid #e0e0e0;border-radius:10px"><small>' + esc(l) + '</small><div style="font-size:20px;font-weight:700;' + (c ? 'color:' + c : '') + '">' + esc(money(cents(v))) + '</div></div>'; };
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
    if ((R.sdachi || []).length) h += '<h3 style="margin-top:14px">' + esc(ui('Сдача кассы', 'Супоридани касса', 'Kassa topshirish')) + '</h3>' + R.sdachi.map(function (x) { var okd = Math.abs(x.diff) < 0.005; return '<div style="padding:6px 0;border-bottom:1px solid #eee"><small>' + esc(x.date) + ' · ' + esc(x.who) + '</small><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(ui('Должно ', 'Бояд ', 'Kerak ')) + esc(money(cents(x.exp))) + ' · ' + esc(ui('сдал ', 'супорид ', 'topshirdi ')) + esc(money(cents(x.fact))) + '</span><b style="color:' + (okd ? '#1f8a4c' : '#c0392b') + '">' + (okd ? '✓' : (x.diff < 0 ? esc(ui('недостача ', 'камомад ', 'kamomad ')) : esc(ui('излишек ', 'зиёдатӣ ', 'ortiqcha '))) + esc(money(cents(Math.abs(x.diff))))) + '</b></div></div>'; }).join('');
    var dd = R.days && R.days[today()];
    if (dd && R.month === monthOf(today())) h += '<h3 style="margin-top:14px">' + esc(ui('Итоги дня', 'Натиҷаи рӯз', 'Kun yakuni')) + '</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + cell(ui('Продано на', 'Фурӯхта шуд', 'Sotildi'), dd.sold) + cell(ui('Пришло денег', 'Пул омад', 'Pul keldi'), dd.cashIn, '#1f8a4c') + cell(ui('Прибыль', 'Фоида', 'Foyda'), dd.profit, '#1f8a4c') + cell(ui('Закупка', 'Харид', 'Xarid'), dd.purchase, '#b36b00') + cell(ui('Новые долги', 'Қарзҳои нав', 'Yangi qarzlar'), dd.debtNew, '#c0392b') + '</div>';
    if (R.low.length) h += '<p style="margin-top:12px"><b>' + esc(ui('Заканчивается', 'Тамом шуда истодааст', 'Tugayapti')) + ':</b> ' + R.low.map(function (x) { return esc(x.name) + ' (' + esc(shQ(x, x.qty)) + ')'; }).join(', ') + '</p>';
    h += '<h3 style="margin-top:14px">' + esc(ui('Продажи', 'Фурӯшҳо', 'Sotuvlar')) + '</h3>';
    if (!R.checks.length) return h + '<p>' + esc(ui('За этот месяц продаж нет.', 'Дар ин моҳ фурӯш нест.', 'Bu oyda sotuv yoʻq.')) + '</p>';
    var pn = { nal: ui('наличные', 'нақд', 'naqd'), perevod: ui('перевод', 'гузаронидан', 'oʻtkazma'), alif: 'Алиф', dushanbe: 'Душанбе Сити', mix: ui('смешанная', 'омехта', 'aralash'), dolg: ui('в долг', 'қарз', 'qarzga'), vladelec: ui('владелец', 'соҳиб', 'egasi') };
    return h + R.checks.map(function (c) {
      var ask = SH.voidAsk === c.id;
      return '<div style="padding:8px 0;border-bottom:1px solid #e6e6e6;display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><b>' + esc(money(cents(c.total))) + '</b> · ' + esc(pn[c.pay] || c.pay) + (c.parts && c.parts.length ? ' (' + c.parts.map(function (q) { return esc(pn[q.pay] || q.pay) + ' ' + esc(money(cents(q.sum))); }).join(' + ') + ')' : '') + (c.pay === 'dolg' ? ' · ' + esc(c.who) : '') + (c.seller ? ' · ' + esc(c.seller) : '') + '<br><small>' + esc(c.date) + ' · ' + c.lines.map(function (l) { return esc(l.name) + ' ×' + esc(shQ(shProd(l.kod), l.qty)); }).join(', ') + '</small></div>' + shBtn('void', ask ? ui('Отменить?', 'Бекор мекунем?', 'Bekor qilinsinmi?') : '↺', { sec: true, st: 'width:' + (ask ? '110' : '48') + 'px;padding:0' + (ask ? ';background:#c0392b;color:#fff' : '') }, c.id) + '</div>';
    }).join('');
  }
  function shNum(id) { var e = $s(id); return e ? String(e.value).replace(',', '.').trim() : ''; }
  function shopClick(b) {
    var a = b.dataset.shop, k = b.dataset.k;
    if (a === 'preview' || a === 'previewk') { KEEPER = a === 'previewk'; PREVIEW = true; PREV_TAB = SH.tab; var md = $s('m-spec'); if (md && md.open) md.close(); setSeller(true); return; }
    if (a === 'selout') { if (PREVIEW) { PREVIEW = false; setSeller(false); S.view = PREV_FIN ? 'fin' : 'shop'; PREV_FIN = false; SH.tab = PREV_TAB || 'kassa'; SH.cart = []; SH.pay = ''; SH.d = null; render(); open_dlg('m-spec'); shLoad(); return; } if (typeof window.logout === 'function') window.logout(); return; }
    if (SELLER && !KEEPER && ['tab', 'fnew', 'fedit', 'rcv', 'rok', 'pdel', 'pay-open', 'pok', 'void', 'mprev', 'mnext', 'fcancel', 'save', 'rcancel'].indexOf(a) >= 0) return;
    if (KEEPER && ['tab', 'fedit', 'pdel', 'pay-open', 'pok', 'void', 'mprev', 'mnext', 'sell', 'add', 'put', 'plus', 'minus', 'rm', 'pay', 'dolgopen', 'paynow', 'who', 'preview', 'previewk'].indexOf(a) >= 0) return;
    if (a === 'tab') { SH.low = ''; SH.pcode = ''; SH.tab = k; SH.err = ''; SH.ok = ''; SH.form = null; SH.rcv = null; SH.payf = null; SH.delAsk = ''; SH.voidAsk = ''; SH.found = null; SH.code = ''; if (k === 'anal') { anLoad(); return; } return render(); }
    if (a === 'goto') { openShop(); SH.tab = k; return render(); }
    if (a === 'reload') { SH.err = ''; render(); return shLoad(); }
    if (a === 'add') { var c = $s('sh-code'); SH.code = ''; shAdd(c ? c.value : ''); render(); var c2 = $s('sh-code'); if (c2) c2.focus(); return; }
    if (a === 'put') { SH.err = ''; SH.found = null; SH.ff = null; var pc = $s('sh-code'), pt = pc ? pc.value.trim().toLowerCase() : ''; shPut(k); SH.code = pt === String(k).toLowerCase() ? k : ''; render(); var c3 = $s('sh-code'); if (c3) c3.focus(); return; }
    if (a === 'print') return shPrintReceipt();
    if (a === 'scan') return shScanOpen(k);
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
      var tot = shCartSum(), rc = { total: tot, pay: SH.pay, who: SH.who, ts: Date.now(), lines: SH.cart.map(function (it) { var pp = shProd(it.kod) || {}; return { name: pp.name || it.kod, qty: it.qty, u: shU(pp), price: cents(SH.pay === 'vladelec' ? pp.zakup : pp.price) }; }) };
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
    if (a === 'sdsave') { if (SH.busy) return; var sf = shNum('sh-sd-fact'); if (sf === '' || !(Number(sf) >= 0)) { SH.err = ui('Впишите, сколько наличных в кассе (можно 0)', 'Нависед, чанд нақд дар касса аст (0 ҳам мешавад)', 'Kassadagi naqd summani yozing (0 ham boʻladi)'); return render(); } return shAct({ action: 'sdacha', id: oid(), fact: Number(sf), date: today() }, '', function () { SH.sdOpen = false; SH.sdRes = SH.d && SH.d.sdacha || null; }); }
    if (a === 'echip') { var ew = $s('sh-e-who'); if (ew) { ew.value = k; ew.focus(); } return; }
    if (a === 'expopen') { SH.expOpen = !SH.expOpen; SH.err = ''; return render(); }
    if (a === 'expsave') {
      if (SH.busy) return; var ea = Number(shNum('sh-e-amt')), en = $s('sh-e-note'), ew = $s('sh-e-who');
      if (!(ea > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      if (!sellerView() && !(ew && ew.value.trim())) { SH.err = ui('Укажите имя продавца', 'Номи фурӯшандаро нависед', 'Sotuvchi ismini yozing'); return render(); }
      return shAct({ action: 'expense', id: oid(), amount: ea, note: en ? en.value : '', who: ew ? ew.value : '', date: today() }, ui('Расход записан', 'Хароҷот сабт шуд', 'Xarajat yozildi'), function () { SH.expOpen = false; });
    }
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
    if (a === 'fedit') { var p = shProd(k); if (p) SH.form = { kod: p.kod, name: p.name, zakup: p.zakup, marzha: p.marzha, sell: p.price, fsm: Number(p.sell) > 0, unit: shU(p), per: shPer(p) || '', edit: true }; SH.rcv = null; return render(); }
    if (a === 'fcancel') { SH.fotoNew = ''; SH.form = null; SH.err = ''; return render(); }
    if (a === 'save') return shSave();
    if (a === 'rcv') { var p2 = shProd(k); if (p2) SH.rcv = { kod: p2.kod, name: p2.name }; SH.form = null; return render(); }
    if (a === 'rcancel') { SH.rcv = null; return render(); }
    if (a === 'rok') {
      var rp = shProd(SH.rcv.kod), ru = shU(rp), rq = shNum('sh-r-qty'), rpc = shNum('sh-r-pcs'), q = rq !== '' ? shQR(ru, shParse(rq)) : (rpc !== '' && shPer(rp) ? shQR(ru, Math.round(shParse(rpc)) * shPer(rp)) : NaN);
      if (!(q > 0)) { SH.err = ru === 'sht' ? ui('Укажите, сколько штук пришло', 'Нависед, чанд дона омад', 'Necha dona kelganini yozing') : ui('Укажите, сколько пришло (', 'Нависед, чанд омад (', 'Qancha kelganini yozing (') + shUL(ru) + (shPer(rp) ? ui(' или штук)', ' ё дона)', ' yoki dona)') : ')'); return render(); }
      var zk = shNum('sh-r-zakup'), kd = SH.rcv.kod, body = { action: 'receive', kod: kd, qty: q, id: oid() }; if (zk) body.zakup = Number(zk);
      return shAct(body, ui('Приход записан', 'Воридот сабт шуд', 'Kirim yozildi'), function () { SH.rcv = null; SH.pcode = ''; });
    }
    if (a === 'pdel') { if (SH.delAsk !== k) { SH.delAsk = k; return render(); } SH.delAsk = ''; return shAct({ action: 'product_del', kod: k }, ui('Товар удалён', 'Мол нест шуд', 'Tovar oʻchirildi')); }
    if (a === 'pay-open') { SH.payf = k; SH.err = ''; return render(); }
    if (a === 'pcancel') { SH.payf = null; return render(); }
    if (a === 'pok') {
      var am = shNum('sh-p-amt'); if (!(Number(am) > 0)) { SH.err = ui('Укажите сумму', 'Маблағро нависед', 'Summani yozing'); return render(); }
      return shAct({ action: 'pay', who: SH.payf, amount: Number(am), id: oid(), date: today() }, ui('Оплата принята', 'Пардохт қабул шуд', 'Toʻlov qabul qilindi'), function () { SH.payf = null; });
    }
    if (a === 'mprev' || a === 'mnext') { SH.month = shiftMonth(SH.month, a === 'mprev' ? -1 : 1); SH.voidAsk = ''; render(); return shLoad(); }
    if (a === 'void') { if (SH.voidAsk !== k) { SH.voidAsk = k; return render(); } SH.voidAsk = ''; return shAct({ action: 'void', id: k }, ui('Продажа отменена, товар вернулся на склад', 'Фурӯш бекор шуд, мол ба анбор баргашт', 'Sotuv bekor qilindi, tovar omborga qaytdi'), function () { /* убираем чек из списка сразу, без перезагрузки */ var RR = SH.d && SH.d.report; if (RR && RR.checks) RR.checks = RR.checks.filter(function (c) { return c.id !== k; }); }); }
  }
  function shSave() {
    var fu = $s('sh-f-unit'), f = { kod: ($s('sh-f-kod').value || '').trim(), name: ($s('sh-f-name').value || '').trim(), zakup: shNum('sh-f-zakup'), marzha: shNum('sh-f-marzha'), sell: shNum('sh-f-sell'), fsm: !!(SH.form && SH.form.fsm), unit: fu && SH_U[fu.value] ? fu.value : 'sht', per: shNum('sh-f-per') };
    SH.form = Object.assign({ edit: SH.form && SH.form.edit }, f);
    if (!f.kod || !/^[A-Za-z0-9_-]+$/.test(f.kod)) { SH.err = ui('Код: только латинские буквы и цифры', 'Рамз: танҳо ҳарфҳои лотинӣ ва рақамҳо', 'Kod: faqat lotin harflari va raqamlar'); return render(); }
    if (!f.name) { SH.err = ui('Введите название', 'Номро нависед', 'Nomini yozing'); return render(); }
    if (!(Number(f.zakup) > 0)) { SH.err = ui('Закупочная цена должна быть больше нуля', 'Нархи харид аз сифр зиёд бошад', 'Xarid narxi noldan katta boʻlsin'); return render(); }
    if (f.fsm && !(shParse(f.sell) > 0)) { SH.err = ui('Цена продажи должна быть больше нуля', 'Нархи фурӯш аз сифр зиёд бошад', 'Sotuv narxi noldan katta boʻlsin'); return render(); }
    if (!f.fsm && (f.marzha === '' || !(Number(f.marzha) >= 0 && Number(f.marzha) <= 1000))) { SH.err = ui('Маржа: число от 0 до 1000', 'Маржа: адад аз 0 то 1000', 'Marja: 0 dan 1000 gacha son'); return render(); }
    if (f.unit !== 'sht' && f.per !== '' && !(shParse(f.per) > 0)) { SH.err = ui('«Сколько в одной штуке» — число больше нуля или пусто', '«Дар як дона чанд» — адади аз сифр зиёд ё холӣ', '«Bir donada qancha» — noldan katta son yoki boʻsh'); return render(); }
    if (!SH.form.edit && shProd(f.kod)) { SH.err = ui('Товар с таким кодом уже есть', 'Чунин рамзи мол аллакай ҳаст', 'Bunday kodli tovar bor'); return render(); }
    return shAct({ action: 'product', p: { kod: f.kod, name: f.name, zakup: Number(f.zakup), marzha: f.fsm ? 0 : Number(f.marzha), sell: f.fsm ? shR2(shParse(f.sell)) : 0, unit: f.unit, per: f.unit === 'sht' || f.per === '' ? 0 : shQR(f.unit, shParse(f.per)), foto: SH.fotoNew || undefined } }, ui('Товар сохранён', 'Мол захира шуд', 'Tovar saqlandi'), function () { SH.form = null; if (SH.fotoNew) SH_F[f.kod] = SH.fotoNew; SH.fotoNew = ''; });
  }
  function shLive(e) {
    var t = e.target; if (!t) return;
    if (t.id === 'sh-code' && e.type === 'keydown' && e.key === 'Enter') { e.preventDefault(); shopClick({ dataset: { shop: 'add' } }); return; }
    if (t.id === 'sh-code' && e.type === 'input') { SH.code = t.value; SH.found = null; SH.ff = null; var hb = $s('sh-hints'); if (hb) hb.innerHTML = shHintsHtml(); return; }
    if (e.type === 'input' && t.dataset && t.dataset.cq) { var cp0 = shProd(t.dataset.cq), cv = shParse(t.value); if (cp0 && cv >= 0) { SH.cart.forEach(function (it) { if (it.kod === t.dataset.cq) { it.qty = shQR(shU(cp0), cv); var ls = $s('sh-ls-' + it.kod); if (ls) ls.innerHTML = shLineTxt(cp0, SH.pay === 'vladelec' ? cp0.zakup : cp0.price, it.qty); } }); var tt = $s('sh-total'); if (tt) { var tb = tt.querySelector('b'); if (tb) tb.textContent = money(shCartSum()) + ' ' + ui('сом.', 'сом.', 'som'); } } return; }
    if (e.type === 'input' && t.id === 'sh-f-unit') { var pb2 = $s('sh-f-perbox'), pl2 = $s('sh-f-perl'); if (pb2) pb2.hidden = t.value === 'sht'; if (pl2) pl2.textContent = shPerLabel(t.value); }
    if (t.id === 'sh-pcode' && e.type === 'input') { SH.pcode = t.value; var pb = $s('sh-phints'); if (pb) pb.innerHTML = shPHints(); return; }
    if (t.id === 'shx-who' && e.type === 'input') { SH.who = t.value; var wb = $s('sh-whohint'); if (wb) wb.innerHTML = shWhoHtml(); return; }
    if (e.type === 'input' && (t.id === 'sh-f-zakup' || t.id === 'sh-f-marzha' || t.id === 'sh-f-sell')) {
      var F0 = SH.form || (SH.form = {}), z = shParse(shNum('sh-f-zakup')), fs = $s('sh-f-sell'), fm = $s('sh-f-marzha'), o = $s('sh-f-price');
      if (t.id === 'sh-f-sell') F0.fsm = shNum('sh-f-sell') !== '';
      if (t.id === 'sh-f-marzha') F0.fsm = false;
      if (F0.fsm) { var sv = shParse(shNum('sh-f-sell')); if (fm && z > 0 && sv > 0) fm.value = shNumTxt(shR2((sv / z - 1) * 100)); }
      else { var mv = shParse(shNum('sh-f-marzha')); if (fs && z > 0 && mv >= 0 && shNum('sh-f-marzha') !== '') fs.value = shNumTxt(shR2(z * (1 + mv / 100))); }
      if (o) o.textContent = shSellNote(F0.fsm);
    }
  }
  document.addEventListener('keydown', shLive); document.addEventListener('input', shLive);
  document.addEventListener('change', function (e) {
    var t = e.target;
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
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.chip) { var nf = $s('bh-note'); if (nf) { nf.value = b.dataset.chip === 'Другое' ? '' : b.dataset.chip; nf.focus(); } return; }
    if (b.hasAttribute('data-sp-back')) { if (b.getAttribute('data-sp-back') === 'fin' && shopOn()) { S.fromFin = false; S.view = 'fin'; render(); return; } S.fromFin = false; $s('m-spec').close(); return; }
    if (false) { if (b.dataset.sp === 'seller') { $s('m-spec').close(); return; } if (b.dataset.sp === 'buh') return openBuh(); S.view = b.dataset.sp; return render(); }
    if (b.dataset.asst) return asstClick(b);
    if (b.dataset.onb) return onbClick(b);
if (b.dataset.fin) { if (b.dataset.fin === 'shop') { if (shopOn()) { S.fromFin = true; openShop(); } return; } if (b.dataset.fin === 'push') { pushEnable(); return; } if (b.dataset.fin === 'team') { if (shopOn() && owner() && window.open_team) { var mst = $s('m-spec'); window.open_team('fin'); } return; }
if (b.dataset.fin === 'kl') { if (shopOn()) { S.fromFin = true; openShop(); SH.kl = true; SH.tab = 'prihod'; render(); } return; } S.fromFin = true; return openBuh(); }
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
      if (!SELLER) { SELLER = true; S.view = 'shop'; SH.tab = KEEPER ? 'prihod' : 'kassa'; SH.cart = []; SH.pay = ''; SH.who = ''; SH.cid = oid(); SH.err = ''; SH.ok = ''; SH.found = null; SH.d = null; SH.month = today().slice(0, 7); var kb = $s('sp-kassa-btn'); if (kb) kb.hidden = true; render(); shLoad(); }
    } else {
      SELLER = false; KEEPER = false; if (o) o.hidden = true;
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
