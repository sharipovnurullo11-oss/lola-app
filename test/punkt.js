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
for (const tag of ['script', 'style']) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(html);
  assert.ok(csp.includes(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`), `хеш ${tag} в CSP`);
}
ok('CSP: только свой скрипт и стиль по хешу, запросы только на prokat-owner');

for (const bad of ['/prokat\'', '/prokat-foto', '/buhgalter', 'ew_cab', 'ew_sid', 'localStorage', 'sessionStorage', 'document.cookie', 'console.']) assert.ok(!html.includes(bad), `в странице не должно быть ${bad}`);
assert.ok(html.includes('history.replaceState'));
ok('ни кабинетов, ни других вебхуков, токен не сохраняется и убирается из адреса');

assert.equal((await fetch(base + '/punkt/x', { headers: { 'x-forwarded-for': '9.9.8.1' } })).status, 404);
ok('лишний хвост пути — 404');
console.log('PUNKT PASSED');
server.close(); process.exit(0);
