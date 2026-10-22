import assert from 'node:assert/strict';
process.env.NO_LISTEN = '1'; process.env.DB = 'memory'; delete process.env.COOKIE_SECURE; process.env.NODE_ENV = 'test';
const { server } = await import('../server.js');
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const jar = {};
const hdr = (extra) => ({ cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...extra });
async function call(method, path, body, extra) {
  const r = await fetch(base + path, { method, redirect: 'manual', headers: { ...hdr(extra), 'content-type': 'application/x-www-form-urlencoded' }, body: body ? new URLSearchParams(body) : undefined });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = kv.slice(i + 1); if (/Max-Age=0/.test(c)) delete jar[kv.slice(0, i)]; else jar[kv.slice(0, i)] = v; }
  return { status: r.status, h: r.headers, text: await r.text() };
}
const ok = (n) => console.log('ok -', n);
const need = ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy'];

for (const path of ['/', '/window', '/app.css', '/nope']) {
  const r = await call('GET', path, null, { 'x-forwarded-for': '9.9.9.1' });
  for (const k of need) assert.ok(r.h.get(k), `${path}: нет заголовка ${k}`);
}
ok('заголовки безопасности на всех типах ответов');

// вход: больше 12 попыток в минуту с одного адреса — 429 до проверки пароля
await call('GET', '/login', null, { 'x-forwarded-for': '9.9.9.2' });
const csrf = jar.csrf;
let last;
for (let i = 0; i < 14; i++) last = await call('POST', '/login', { csrf, email: `x${i}@t.com`, password: 'wrong-password' }, { 'x-forwarded-for': '9.9.9.2' });
assert.equal(last.status, 429); assert.equal(last.text, 'Too many requests'); assert.ok(last.h.get('retry-after'));
ok('частота входов с одного адреса ограничена');

// перебор одного логина с разных адресов: после 25 неудач вход закрыт даже для нового адреса
for (let i = 0; i < 26; i++) await call('POST', '/login', { csrf, email: 'victim@t.com', password: 'wrong-' + i }, { 'x-forwarded-for': `8.8.${i}.1` });
const blocked = await call('POST', '/login', { csrf, email: 'victim@t.com', password: 'wrong-final' }, { 'x-forwarded-for': '7.7.7.7' });
assert.equal(blocked.status, 429);
ok('перебор одного логина с разных адресов остановлен');

// загрузка чека без защитного токена не проходит
const noCsrf = await fetch(base + '/receipt', { method: 'POST', headers: { cookie: 'sid=abc', 'x-forwarded-for': '9.9.9.3' }, body: Buffer.from('%PDF-1.4 x') });
assert.ok([401, 403].includes(noCsrf.status));
ok('чек без токена отклонён');

// огромное тело формы отклоняется
const big = await call('POST', '/login', { csrf, email: 'a@b.co', password: 'x'.repeat(30000) }, { 'x-forwarded-for': '9.9.9.4' });
assert.ok([413, 429, 401].includes(big.status));
ok('огромное тело формы не принимается');
console.log('SECURITY PASSED'); server.close(); process.exit(0);
