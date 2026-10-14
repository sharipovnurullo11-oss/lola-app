import assert from 'node:assert/strict';
import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
process.env.NO_LISTEN = '1'; process.env.DB = 'memory'; process.env.COOKIE_SECURE = '0';
process.env.OWNER_EMAIL = 'owner@test.com'; process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lola-'));
delete process.env.PAYMENT_DETAILS;
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
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);

const guest = client(), owner = client(), anon = client();

// гость без входа видит пример кабинета, кнопки закрыты
let r = await anon('GET', '/'); assert.equal(r.status, 200); assert.match(r.text, /Ассистент отвечает вашим клиентам/); assert.match(r.text, /300 сомони/); ok('landing');
r = await anon('GET', '/demo'); assert.equal(r.status, 200); assert.match(r.text, /Кабинет/); assert.match(r.text, /<button class="btn primary" disabled>/); assert.match(r.text, /Зарегистрироваться за 300 сомони/); ok('guest preview has locked buttons');
assert.doesNotMatch(r.text, /<input[^>]*name="/); ok('preview has no working forms');

// регистрация по телефону
r = await guest('GET', '/register'); assert.match(r.text, /name="phone"/); const csrf = r.jar.csrf;
r = await guest('POST', '/register', { csrf: 'bad', phone: '900112233', terms: '1' }); assert.equal(r.status, 403); ok('register needs csrf');
r = await guest('POST', '/register', { csrf, phone: '12345', terms: '1' }); assert.equal(r.status, 400); assert.match(r.text, /9 цифр/); ok('bad phone rejected');
r = await guest('POST', '/register', { csrf, phone: '900 11 22 33' }); assert.equal(r.status, 400); ok('terms required');
r = await guest('POST', '/register', { csrf, phone: '+992 900 11 22 33', terms: '1' }); assert.equal(r.status, 303); assert.equal(r.loc, '/cabinet'); ok('register by phone');
r = await guest('GET', '/cabinet'); assert.match(r.text, /\+992 900 11 22 33/); assert.match(r.text, /\+992 907 52 19 86/); assert.match(r.text, /300 сомони/); assert.match(r.text, /Что откроется после оплаты/); assert.match(r.text, /disabled/); ok('guest cabinet: payment details + locked preview');

// чек и подтверждение
const tok = guest ? (await guest('GET', '/')).jar.csrf : '';
r = await guest('POST', '/receipt', null, { 'x-csrf': tok }, png); assert.equal(r.status, 200); ok('receipt uploaded');
await owner('GET', '/register');
r = await owner('POST', '/register', { csrf: (await owner('GET', '/')).jar.csrf, name: 'Владелец', email: 'owner@test.com', password: 'longenough1', terms: '1' }); assert.equal(r.status, 303);
r = await owner('GET', '/admin'); assert.match(r.text, /\+992 900 11 22 33/); const id = r.text.match(/\/admin\/receipt\/(\d+)/)[1]; ok('owner sees phone in admin');
const otok = (await owner('GET', '/')).jar.csrf;
r = await owner('POST', '/admin/decide', { csrf: otok, id, decision: 'confirm' });
assert.equal(r.status, 200); assert.match(r.text, /Оплата подтверждена/); assert.match(r.text, /wa\.me\/992900112233\?text=/);
const password = r.text.match(/<code>([a-z0-9]{8})<\/code>/)[1]; ok('confirm issues login+password with WhatsApp link');
r = await guest('GET', '/cabinet'); assert.match(r.text, /Оплата подтверждена/); assert.doesNotMatch(r.text, /Что откроется после оплаты/); ok('cabinet unlocked after confirm');

// вход по номеру и паролю
await guest('POST', '/logout', { csrf: guest ? (await guest('GET', '/')).jar.csrf : '' });
r = await guest('GET', '/login'); const lc = r.jar.csrf; assert.match(r.text, /name="login"/);
r = await guest('POST', '/login', { csrf: lc, login: '900112233', password: 'wrongwrong' }); assert.equal(r.status, 401); ok('wrong password');
r = await guest('POST', '/login', { csrf: lc, login: '0900 11 22 33', password }); assert.equal(r.status, 303); ok('login by phone + issued password');
r = await guest('GET', '/cabinet'); assert.equal(r.status, 200);
await guest('POST', '/logout', { csrf: (await guest('GET', '/')).jar.csrf });
r = await guest('POST', '/register', { csrf: lc, phone: '900112233', terms: '1' }); assert.equal(r.status, 409); ok('registered number with password must log in');

// пароль может перевыдать только владелец
const cid = (await owner('GET', '/admin/clients')).text.match(/\/admin\/client\/(\d+)/)[1];
r = await guest('POST', '/admin/password', { csrf: lc, id: cid }); assert.equal(r.status, 404); ok('client cannot reissue password');
r = await owner('GET', `/admin/client/${cid}`); assert.match(r.text, /Выдать новый пароль/);
r = await owner('POST', '/admin/password', { csrf: otok, id: cid }); assert.equal(r.status, 200); const pw2 = r.text.match(/<code>([a-z0-9]{8})<\/code>/)[1]; assert.notEqual(pw2, password);
r = await guest('POST', '/login', { csrf: lc, login: '900112233', password }); assert.equal(r.status, 401);
r = await guest('POST', '/login', { csrf: lc, login: '900112233', password: pw2 }); assert.equal(r.status, 303); ok('new password replaces old');

// гость, который зарегистрировался, но потерял сессию до оплаты, может зайти снова
const g2 = client(); await g2('GET', '/register');
r = await g2('POST', '/register', { csrf: (await g2('GET', '/')).jar.csrf, phone: '911000111', terms: '1' }); assert.equal(r.status, 303);
const g3 = client(); await g3('GET', '/register');
r = await g3('POST', '/register', { csrf: (await g3('GET', '/')).jar.csrf, phone: '911000111', terms: '1' }); assert.equal(r.status, 303); ok('unpaid guest can re-enter');
console.log('PHONE PASSED'); server.close(); process.exit(0);
