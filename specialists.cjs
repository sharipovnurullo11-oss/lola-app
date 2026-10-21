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
    { id: 'smm', name: 'SMM-специалист', about: 'План недели, подписи к постам и разбор профиля по вашему Instagram', ready: true, ico: '📣' },
    { id: 'mkt', name: 'Маркетолог', about: 'Контент-план, где теряются клиенты, ваши цифры и тексты для возврата', ready: true, ico: '🎯' },
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
      d.addEventListener('input', function (e) { var t = e.target; if (t && t.id === 'sm-plan') SM.plan = t.value; else if (t && t.id === 'sm-cap') SM.cap = t.value; else if (t && t.id === 'mk-in') MK.draft = t.value; });
d.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.id === 'mk-in' && !/Mobi|Android|iPhone/i.test(navigator.userAgent)) { e.preventDefault(); mktClick('send'); } });
    }
    return true;
  }
  function openOne(id) {
    if (!owner()) return; ensure();
    if (id === 'buh') openBuh(); else if (id === 'smm') openSmm(); else if (id === 'mkt') openMkt(); else { S.view = id; render(); }
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
    if (S.view === 'smm') return renderSmm(el);
if (S.view === 'mkt') return renderMkt(el);
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

  /* ---------- SMM-специалист ---------- */
  var SM = { st: null, busy: false, res: '', act: '', err: '', plan: '', cap: '', copied: false };
  function openSmm() {
    S.view = 'smm'; SM.res = ''; SM.err = ''; SM.st = null; SM.copied = false; render();
    callTo('/smm', { action: 'status' }).then(function (r) {
      SM.st = r.ok ? r : { error: r.error || TX('не удалось загрузить') };
      if (S.view === 'smm') render();
    });
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
    h += '<div style="display:grid;gap:8px;margin-bottom:10px">' +
      '<b>' + esc(TX('План на неделю')) + '</b>' +
      '<textarea class="in2" id="sm-plan" rows="2" maxlength="800" placeholder="' + esc(TX('Что было на этой неделе: вопросы клиентов, события (необязательно)')) + '">' + esc(SM.plan) + '</textarea>' +
      '<button class="btn" data-smm="plan" type="button"' + dis + '>' + esc(TX('Составить план')) + '</button></div>';
    h += '<div style="display:grid;gap:8px;margin-bottom:10px">' +
      '<b>' + esc(TX('Подпись к посту или Reels')) + '</b>' +
      '<textarea class="in2" id="sm-cap" rows="2" maxlength="800" placeholder="' + esc(TX('О чём пост или ролик?')) + '">' + esc(SM.cap) + '</textarea>' +
      '<button class="btn" data-smm="caption" type="button"' + dis + '>' + esc(TX('Написать подпись')) + '</button></div>';
    h += '<div style="display:grid;gap:8px;margin-bottom:10px"><b>' + esc(TX('Разбор профиля')) + '</b>' +
      '<button class="btn sec" data-smm="profile" type="button"' + dis + '>' + esc(TX('Разобрать мой профиль')) + '</button></div>';
    if (SM.busy) h += '<p>⏳ ' + esc(TX('Готовлю ответ, это до минуты…')) + '</p>';
    if (SM.err) h += '<p class="err">' + esc(SM.err) + '</p>';
    if (SM.res) h += '<div style="white-space:pre-wrap;word-break:break-word;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;margin:8px 0;font-size:14px;line-height:1.45" id="sm-res">' + esc(SM.res) + '</div>' +
      '<button class="btn sec" data-smm="copy" type="button">' + esc(TX(SM.copied ? 'Скопировано ✓' : 'Скопировать')) + '</button>' +
      '<p><small>' + esc(TX('Я ничего не публикую сам: текст вставляете вы.')) + '</small></p>';
    el.innerHTML = h;
  }
  function runSmm(act) {
    if (SM.busy) return;
    var text = act === 'plan' ? SM.plan : act === 'caption' ? SM.cap : '';
    if (act === 'caption' && String(text).trim().length < 5) { SM.err = TX('Напишите, о чём пост или ролик'); SM.res = ''; return render(); }
    SM.busy = true; SM.err = ''; SM.res = ''; SM.copied = false; render();
    callTo('/smm', { action: act, text: String(text).trim() }).then(function (r) {
      SM.busy = false;
      if (r.ok) { SM.res = r.text || ''; if (SM.st && !SM.st.error) { SM.st.left = r.left; SM.st.connected = !!r.connected; } }
      else SM.err = r.error || TX('Не получилось');
      if (S.view === 'smm') render();
    });
  }
  function smmClick(a) {
    if (a === 'reload') return openSmm();
    if (a === 'copy') { try { navigator.clipboard.writeText(SM.res); SM.copied = true; render(); } catch (e) {} return; }
    if (a === 'plan' || a === 'caption' || a === 'profile') return runSmm(a);
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
h += '<p><small>' + esc(TX('Я ничего не публикую и никому не пишу сам. Переписок ваших клиентов я не вижу: только цифры.')) + '</small></p>';
el.innerHTML = h;
var c = $s('mk-chat'); if (c) c.scrollTop = c.scrollHeight;
}
function sendMkt(text, task) {
text = String(text || '').trim();
if (MK.busy) return;
if (text.length < 2) { MK.err = TX('Напишите вопрос маркетологу'); return render(); }
var hist = MK.msgs.slice(-8).map(function (m) { return { r: m.r, t: m.t }; });
MK.msgs.push({ r: 'u', t: text }); MK.draft = ''; MK.busy = true; MK.err = ''; MK.copied = false; mkSave(); render();
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
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><input class="in2" id="bh-text" maxlength="160" placeholder="' + esc(TX('расход 150 такси')) + '" autocomplete="off"><button class="btn" data-buh="text" type="button">' + esc(TX('Записать')) + '</button></div>' +
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
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.chip) { var nf = $s('bh-note'); if (nf) { nf.value = b.dataset.chip === 'Другое' ? '' : b.dataset.chip; nf.focus(); } return; }
    if (b.hasAttribute('data-sp-back')) { $s('m-spec').close(); return; }
    if (false) { if (b.dataset.sp === 'seller') { $s('m-spec').close(); return; } if (b.dataset.sp === 'buh') return openBuh(); S.view = b.dataset.sp; return render(); }
    if (b.dataset.onb) return onbClick(b);
if (b.dataset.smm) return smmClick(b.dataset.smm);
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
    if (a === 'text') { var p = parseText($s('bh-text').value); if (!p) return err(TX('Напишите так: расход 150 такси или приход 500 продажа')); p.date = today(); return addOp(p); }
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
