import assert from 'node:assert/strict';
process.env.NO_LISTEN = '1'; process.env.DB = 'memory'; process.env.COOKIE_SECURE = '0';
const { server } = await import('../server.js');
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const jar = {};
const hdr = () => ({ cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') });
async function call(method, path, body) {
  const r = await fetch(base + path, { method, redirect: 'manual', headers: { ...hdr(), 'content-type': 'application/x-www-form-urlencoded' }, body: body ? new URLSearchParams(body) : undefined });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = kv.slice(i + 1); if (/Max-Age=0/.test(c)) delete jar[kv.slice(0, i)]; else jar[kv.slice(0, i)] = v; }
  return { status: r.status, loc: r.headers.get('location'), text: await r.text() };
}
const ok = (n) => console.log('ok -', n);

let r = await call('GET', '/'); assert.equal(r.status, 200); assert.match(r.text, /Лола/); ok('landing ru');
r = await call('GET', '/lang/tg'); assert.equal(r.status, 303);
r = await call('GET', '/register'); assert.match(r.text, /Сабти ном/); ok('tajik');
r = await call('GET', '/lang/uz'); r = await call('GET', '/register'); assert.match(r.text, /Roʻyxatdan/); ok('uzbek');
await call('GET', '/lang/ru'); r = await call('GET', '/register');

r = await call('POST', '/register', { csrf: 'bad', name: 'A', email: 'a@b.co', password: '12345678', terms: '1' }); assert.equal(r.status, 403); ok('csrf blocks');
const csrf = jar.csrf;
r = await call('POST', '/register', { csrf, name: 'Малохат', email: 'm@test.com', password: 'short', terms: '1' }); assert.equal(r.status, 400); ok('short password rejected');
r = await call('POST', '/register', { csrf, name: 'Малохат', email: 'm@test.com', password: 'longenough1' }); assert.equal(r.status, 400); ok('terms required');
r = await call('POST', '/register', { csrf, name: '<b>Малохат</b>', email: 'M@Test.com', password: 'longenough1', terms: '1' }); assert.equal(r.status, 303); assert.equal(r.loc, '/cabinet'); ok('register');
r = await call('GET', '/cabinet'); assert.equal(r.status, 200); assert.match(r.text, /&lt;b&gt;Малохат/); assert.doesNotMatch(r.text, /<b>Малохат/); assert.match(r.text, /Ожидает оплаты/); ok('cabinet + xss escaped');
r = await call('POST', '/logout', { csrf: jar.csrf }); assert.equal(r.status, 303);
r = await call('GET', '/cabinet'); assert.equal(r.status, 303); assert.equal(r.loc, '/login'); ok('logout');
r = await call('POST', '/register', { csrf: jar.csrf, name: 'X', email: 'm@test.com', password: 'longenough1', terms: '1' }); assert.equal(r.status, 409); ok('duplicate email');
r = await call('POST', '/login', { csrf: jar.csrf, email: 'm@test.com', password: 'wrongwrong' }); assert.equal(r.status, 401);
r = await call('POST', '/login', { csrf: jar.csrf, email: 'm@test.com', password: 'longenough1' }); assert.equal(r.status, 303); ok('login');
await call('POST', '/logout', { csrf: jar.csrf });
for (let i = 0; i < 5; i++) await call('POST', '/login', { csrf: jar.csrf, email: 'm@test.com', password: 'bad' + i });
r = await call('POST', '/login', { csrf: jar.csrf, email: 'm@test.com', password: 'longenough1' }); assert.equal(r.status, 429); ok('login rate limit');
r = await call('GET', '/manifest.webmanifest'); assert.equal(r.status, 200); assert.ok(JSON.parse(r.text).icons.length); ok('manifest');
r = await call('GET', '/sw.js'); assert.equal(r.status, 200); r = await call('GET', '/healthz'); assert.equal(r.text, 'ok'); ok('sw + health');
r = await call('GET', '/..%2fserver.js'); assert.equal(r.status, 404); ok('no path traversal');
console.log('ALL PASSED'); server.close(); process.exit(0);
