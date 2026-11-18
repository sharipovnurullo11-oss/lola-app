// «Окно владельца пункта»: отдельная страница /punkt, строгий CSP, ничего из кабинетов.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.NO_LISTEN = '1'; process.env.DB = 'memory'; delete process.env.COOKIE_SECURE; process.env.NODE_ENV = 'test';
const { server } = await import('../server.js');
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const ok = (n) => console.log('ok -', n);

const r = await fetch(base + '/punkt', { headers: { 'x-forwarded-for': '9.9.8.1' } });
const html = await r.text();
assert.equal(r.status, 200);
assert.match(r.headers.get('content-type'), /text\/html/);
assert.equal(r.headers.get('cache-control'), 'no-store');
assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
assert.ok(!r.headers.get('set-cookie'), 'страница не ставит куки');
ok('/punkt отдаёт страницу без входа и без куки');

const csp = r.headers.get('content-security-policy');
assert.match(csp, /default-src 'none'/);
assert.match(csp, /connect-src https:\/\/n8n\.nurullo-sharipov\.tech\/webhook\/prokat-owner;/);
assert.ok(!/unsafe-inline/.test(csp));
assert.match(csp, /img-src 'self' data: https:\/\/lh3\.googleusercontent\.com;/);
assert.equal((csp.match(/https:\/\//g) || []).length, 2, 'в CSP только два внешних адреса: миниатюры и prokat-owner');
for (const tag of ['script', 'style']) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(html);
  assert.ok(csp.includes(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`), `хеш ${tag} в CSP`);
}
ok('CSP: только свой скрипт и стиль по хешу, запросы только на prokat-owner, картинки только с lh3.googleusercontent.com');

for (const bad of ['/prokat\'', '/prokat-foto', '/buhgalter', 'ew_cab', 'ew_sid', 'localStorage', 'sessionStorage', 'document.cookie', 'console.']) assert.ok(!html.includes(bad), `в странице не должно быть ${bad}`);
// 19.11.2026: токен из адреса больше не убираем — иначе значок на главном экране телефона сохраняется без него («Ссылка недействительна»).
assert.ok(!html.includes('replaceState') && !html.includes('pushState'), 'адрес страницы не переписываем: токен остаётся после #');
assert.ok(html.includes('function hashToken()') && html.includes('var TOKEN = hashToken();'), 'токен читается из адреса при каждом открытии');
assert.ok(html.includes("window.addEventListener('hashchange'") && html.includes('location.reload()'), 'другая личная ссылка в той же вкладке открывается заново');
assert.ok(html.includes('Страница открылась без вашей личной ссылки'), 'без токена страница говорит, что делать');
assert.ok(!/blob:|createObjectURL|eval\(|new Function/.test(html), 'никаких blob: и eval — CSP не ослабляем');
assert.ok(!/style="/.test(html), 'нет встроенных style= (CSP их не пустит)');
ok('ни кабинетов, ни других вебхуков; токен в браузере не сохраняется и остаётся в адресе, чтобы работал значок на главном экране');

assert.equal((await fetch(base + '/punkt/x', { headers: { 'x-forwarded-for': '9.9.8.1' } })).status, 404);
ok('лишний хвост пути — 404');

// Этап 2: аренда с залогом и фото, возврат с проверкой и фото, «Мои деньги»
for (const need of ['accept="image/*" capture="environment"', "toDataURL('image/jpeg', ", '900, 0.6', 'Арендатор согласен на фото', 'Включил, работает', 'Повреждён', 'Мои деньги', 'min_day', "api('return'", "api('rent'", 'photo_person', 'photo_passport', 'zalog_sum', 'repair_pay', 'consent: true']) assert.ok(html.includes(need), `нет в странице: ${need}`);
assert.ok(!/Продать/.test(html), 'кнопка «Продать» — следующий этап');
ok('этап 2: формы аренды и возврата с фото, «Мои деньги»; «Продать» не добавлена');
for (const need of ['Сломался', 'Починили', "toolAct(tt, 'broken'", "toolAct(tt, 'fixed'", "status === 'сломан'", 'num(t.broken)', 'Цены для клиента', 'коротко (до 3 часов)', 'минимум за сутки']) assert.ok(html.includes(need), `нет в странице: ${need}`);
assert.ok(!/earned|share|amount/.test(/function renderPrices[\s\S]*?\n  }\n/.exec(html)[0]), '«Цены для клиента» без долей и сумм');
ok('«Сломался» / «Починили», красный по broken, «Цены для клиента» без долей');
for (const need of ["api('handover'", 'D.owed', 'D.collected', 'D.handovers', 'Вы передали ', 'Передал Нурулло ', 'К передаче Нурулло ', 'pctTxt(100 - pct())', 'function pct()']) assert.ok(html.includes(need), `нет в странице: ${need}`);
assert.ok(!/reduce\(function \(s, x\) \{ return s \+ Math\.round\(num\(x\.amount\)/.test(html), 'цифры денег — с сервера, а не пересчёт на телефоне');
ok('«Мои деньги» из collected / earned / owed, кнопка «Передал Нурулло» и список передач');
for (const need of ['loading="lazy" referrerpolicy="no-referrer"', 'function thumbs(', "hasOwnProperty.call(t, 'thumb')", 'th ph']) assert.ok(html.includes(need), `нет в странице: ${need}`);
ok('миниатюры: lazy, no-referrer, запоминаются по названию, серый квадрат с буквой');
for (const need of ['function cmpHtml(', 'cmpHtml(r.tool, S.photo)', 'Было → стало', 'THUMB[tool]']) assert.ok(html.includes(need), `нет в странице: ${need}`);
ok('«Вернули»: прошлое фото инструмента рядом с новым («было → стало»)');
for (const need of ['NEED_PIN', 'body.pin = PIN', 'Введите PIN пункта', 'data-pinform', 'r.need_pin']) assert.ok(html.includes(need), `нет в странице: ${need}`);
ok('окно владельца спрашивает PIN, держит его только в памяти страницы');
// 19.11.2026: скрипт страницы на подставном браузере — что происходит с токеном при разных адресах.
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const open = (hash) => {
    const calls = { fetch: [], reload: 0, history: 0 }, on = {};
    const app = { innerHTML: '', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    const location = { hash, pathname: '/punkt', search: '', reload() { calls.reload++; } };
    const history = new Proxy({}, { get: () => () => { calls.history++; } });
    const document = { getElementById: (id) => (id === 'app' ? app : null), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], activeElement: null, body: {} };
    const window = { addEventListener: (n, f) => { on[n] = f; }, scrollTo() {} };
    const fetch = (url, opt) => { calls.fetch.push(JSON.parse(opt.body)); return Promise.resolve({ json: () => Promise.resolve({ ok: false, error: 'ссылка не подходит' }) }); };
    new Function('window', 'document', 'location', 'history', 'fetch', 'navigator', 'setTimeout', 'clearTimeout', 'setInterval', script)(window, document, location, history, fetch, { onLine: true }, () => 0, () => {}, () => 0);
    return { calls, on, app, location };
  };
  const T = 'a'.repeat(32), tick = () => new Promise((r) => setTimeout(r, 5));
  let p = open('#t=' + T); await tick();
  assert.equal(p.calls.fetch.length, 1); assert.equal(p.calls.fetch[0].token, T);
  assert.equal(p.location.hash, '#t=' + T, 'токен остаётся в адресе'); assert.equal(p.calls.history, 0, 'адрес не переписывается');
  assert.match(p.app.innerHTML, /Ссылка недействительна, позвоните Нурулло/);
  p = open(''); await tick();
  assert.equal(p.calls.fetch.length, 0); assert.match(p.app.innerHTML, /Страница открылась без вашей личной ссылки/);
  p.location.hash = '#t=' + T; p.on.hashchange(); assert.equal(p.calls.reload, 1);
  p = open('#t=' + T); await tick();
  p.on.hashchange(); assert.equal(p.calls.reload, 0);
  p.location.hash = '#t=' + 'b'.repeat(32); p.on.hashchange(); assert.equal(p.calls.reload, 1);
  ok('токен: после открытия остаётся в адресе (значок на главном экране его сохранит); без токена — понятная надпись; другая ссылка в той же вкладке открывается заново');
}
console.log('PUNKT PASSED');
server.close(); process.exit(0);
