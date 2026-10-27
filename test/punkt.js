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
assert.match(csp, /connect-src https:\/\/n8n-ny7q\.srv2033023\.hstgr\.cloud\/webhook\/prokat-owner;/);
assert.ok(!/unsafe-inline/.test(csp));
assert.match(csp, /img-src 'self' data: https:\/\/lh3\.googleusercontent\.com;/);
assert.equal((csp.match(/https:\/\//g) || []).length, 2, 'в CSP только два внешних адреса: миниатюры и prokat-owner');
for (const tag of ['script', 'style']) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(html);
  assert.ok(csp.includes(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`), `хеш ${tag} в CSP`);
}
ok('CSP: только свой скрипт и стиль по хешу, запросы только на prokat-owner, картинки только с lh3.googleusercontent.com');

for (const bad of ['/prokat\'', '/prokat-foto', '/buhgalter', 'ew_cab', 'ew_sid', 'localStorage', 'sessionStorage', 'document.cookie', 'console.']) assert.ok(!html.includes(bad), `в странице не должно быть ${bad}`);
assert.ok(html.includes('history.replaceState'));
assert.ok(!/blob:|createObjectURL|eval\(|new Function/.test(html), 'никаких blob: и eval — CSP не ослабляем');
assert.ok(!/style="/.test(html), 'нет встроенных style= (CSP их не пустит)');
ok('ни кабинетов, ни других вебхуков, токен не сохраняется и убирается из адреса');

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
console.log('PUNKT PASSED');
server.close(); process.exit(0);
