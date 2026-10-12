import assert from 'node:assert/strict';
import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
process.env.NO_LISTEN = '1'; process.env.DB = 'memory'; process.env.COOKIE_SECURE = '0';
process.env.OWNER_EMAIL = 'owner@test.com'; process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lola-'));
process.env.PAYMENT_DETAILS = 'Карта 0000 Тест';
const { server } = await import('../server.js');
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
function client() {
  const jar = {};
  return async (method, p, body, headers = {}, raw) => {
    const r = await fetch(base + p, { method, redirect: 'manual', headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(raw ? {} : { 'content-type': 'application/x-www-form-urlencoded' }), ...headers }, body: raw ? raw : body ? new URLSearchParams(body) : undefined });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (/Max-Age=0/.test(c)) delete jar[kv.slice(0, i)]; else jar[kv.slice(0, i)] = kv.slice(i + 1); }
    return { status: r.status, loc: r.headers.get('location'), text: await r.text(), jar };
  };
}
const ok = (n) => console.log('ok -', n);
async function register(c, email, name) { await c('GET', '/register'); return c('POST', '/register', { csrf: (await c('GET', '/')).jar.csrf, name, email, password: 'longenough1', terms: '1' }); }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);

const user = client(), owner = client();
let r = await register(user, 'u@test.com', 'Клиент'); assert.equal(r.status, 303);
r = await register(owner, 'owner@test.com', 'Владелец'); assert.equal(r.status, 303);

r = await user('GET', '/cabinet'); assert.match(r.text, /300 сомони/); assert.match(r.text, /Карта 0000 Тест/); ok('cabinet shows payment instructions');
r = await user('GET', '/admin'); assert.equal(r.status, 404); ok('non-owner has no admin');
r = await owner('GET', '/admin'); assert.equal(r.status, 200); assert.match(r.text, /Новых чеков нет/); ok('owner admin empty');

const csrf = user('GET', '/').then((x) => x.jar.csrf); const tok = await csrf;
r = await user('POST', '/receipt', null, { 'x-csrf': 'bad' }, png); assert.equal(r.status, 403); ok('upload needs csrf');
r = await user('POST', '/receipt', null, { 'x-csrf': tok }, Buffer.from('<html>evil</html>')); assert.equal(r.status, 415); ok('non-image rejected');
r = await user('POST', '/receipt', null, { 'x-csrf': tok }, Buffer.alloc(5 * 1024 * 1024 + 10, 0)); assert.ok([413, 415].includes(r.status) || r.status === 0); ok('too big rejected');
r = await user('POST', '/receipt', null, { 'x-csrf': tok }, png); assert.equal(r.status, 200); ok('png upload');
r = await user('GET', '/cabinet'); assert.match(r.text, /Чек на проверке/); ok('status receipt_sent');
r = await user('POST', '/receipt', null, { 'x-csrf': tok }, png); assert.equal(r.status, 409); ok('no upload while pending');

r = await owner('GET', '/admin'); assert.match(r.text, /Клиент/); assert.match(r.text, /u@test.com/);
const id = r.text.match(/\/admin\/receipt\/(\d+)/)[1];
r = await user('GET', `/admin/receipt/${id}`); assert.equal(r.status, 404); ok('receipt hidden from client');
r = await owner('GET', `/admin/receipt/${id}`); assert.equal(r.status, 200); assert.equal(r.text.length > 0, true); ok('owner sees receipt');
const otok = (await owner('GET', '/')).jar.csrf;
r = await owner('POST', '/admin/decide', { csrf: 'bad', id, decision: 'confirm' }); assert.equal(r.status, 403);
r = await owner('POST', '/admin/decide', { csrf: otok, id, decision: 'reject' }); assert.equal(r.status, 303);
r = await user('GET', '/cabinet'); assert.match(r.text, /Чек не принят/); assert.match(r.text, /Пришлите новый/); ok('reject -> client sees rejected');
r = await user('POST', '/receipt', null, { 'x-csrf': tok }, png); assert.equal(r.status, 200);
r = await owner('GET', '/admin'); const id2 = r.text.match(/\/admin\/receipt\/(\d+)/)[1];
r = await user('POST', '/admin/decide', { csrf: tok, id: id2, decision: 'confirm' }); assert.equal(r.status, 404); ok('client cannot decide');
r = await owner('POST', '/admin/decide', { csrf: otok, id: id2, decision: 'confirm' }); assert.equal(r.status, 303);
r = await user('GET', '/cabinet'); assert.match(r.text, /Оплата подтверждена/); ok('confirm -> paid');
console.log('PAYMENTS PASSED'); server.close(); process.exit(0);
