import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDb } from './db.js';
import { pickLang, T } from './i18n.js';
import * as V from './views.js';
import { initPush, textFor } from './push.js';

const PORT = Number(process.env.PORT || 3000);
const SECURE = process.env.COOKIE_SECURE !== '0';
const ownerEmail = () => (process.env.OWNER_EMAIL || '').toLowerCase();
const DATA_DIR = process.env.DATA_DIR || '/data';
const PAY_DETAILS = process.env.PAYMENT_DETAILS || '+992 907 52 19 86';
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://app.nurullo-sharipov.tech').replace(/\/$/, '');
const PWD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // без похожих символов (0/o, 1/l/i)
const genPassword = () => Array.from({ length: 8 }, () => PWD_ALPHABET[crypto.randomInt(PWD_ALPHABET.length)]).join('');
// телефон Таджикистана -> 992XXXXXXXXX (9 цифр после кода) либо null
function normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('992') && d.length === 12) d = d.slice(3);
  if (d.length === 10 && d.startsWith('0')) d = d.slice(1);
  return d.length === 9 ? '992' + d : null;
}
const MAX_RECEIPT = 5 * 1024 * 1024, MAX_RECEIPTS_PER_USER = 10;
const SESSION_TTL = 30 * 24 * 3600;
const MAX_FAILS = 5, FAIL_WINDOW = 15 * 60;
const PUBLIC = path.join(path.dirname(new URL(import.meta.url).pathname), 'public');
let WINDOW_HTML = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'window.html'));
// «Единое окно» обновляется само: раз в минуту забираем свежий window.html из GitHub (без пересборки сервера)
const WINDOW_URL = process.env.WINDOW_URL || 'https://raw.githubusercontent.com/sharipovnurullo11-oss/lola-app/main/window.html';
async function refreshWindow() {
  try {
    const r = await fetch(WINDOW_URL, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const t = Buffer.from(await r.arrayBuffer());
    if (t.length > 20000 && t.length < 4_000_000 && t.includes(Buffer.from('</html>'))) WINDOW_HTML = t;
  } catch { /* остаёмся на прежней версии */ }
}
if (process.env.NODE_ENV !== 'test') { refreshWindow(); setInterval(refreshWindow, 60_000).unref(); }

// «Окно владельца пункта» проката: отдельная страница без входа и без кабинетов. Встроенные стиль и скрипт разрешены только по хешу.
const PUNKT_HTML = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'punkt.html'));
const inlineHashes = (tag) => [...PUNKT_HTML.toString('utf8').matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
const PUNKT_CSP = `default-src 'none'; script-src ${inlineHashes('script')}; style-src ${inlineHashes('style')}; img-src 'self' data: https://lh3.googleusercontent.com; connect-src https://n8n-ny7q.srv2033023.hstgr.cloud/webhook/prokat-owner; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rand = () => crypto.randomBytes(32).toString('base64url');

// Пароли: scrypt из стандартной библиотеки Node (асинхронно, чтобы проверка пароля не вешала весь сервер)
const scrypt = (pw, salt) => new Promise((resolve, reject) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? reject(e) : resolve(k))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
async function checkPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const got = await scrypt(pw, Buffer.from(s, 'base64'));
  const want = Buffer.from(h, 'base64');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const DUMMY = await hashPassword('dummy-password'); // одинаковое время ответа, если почты нет

// Общие заголовки безопасности для каждого ответа
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(), payment=(), usb=()', 'Cross-Origin-Opener-Policy': 'same-origin',
  ...(SECURE ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};
// Ограничитель частоты запросов в памяти: не даёт перебирать пароли, засыпать регистрациями и грузить сервер
const HITS = new Map();
function tooMany(key, limit, windowMs) {
  const now = Date.now();
  const arr = (HITS.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); HITS.set(key, arr);
  return arr.length > limit;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of HITS) if (!v.length || now - v[v.length - 1] > 120_000) HITS.delete(k); }, 60_000).unref();

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const cookie = (name, val, maxAge) =>
  `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax${SECURE ? '; Secure' : ''}${maxAge != null ? `; Max-Age=${maxAge}` : ''}`;

function sniff(buf) {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['image/png', 'png'];
  if (buf.length > 5 && buf.slice(0, 5).toString('latin1') === '%PDF-') return ['application/pdf', 'pdf'];
  return null;
}
async function readRaw(req, max) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('big'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
async function readForm(req) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 20_000) throw Object.assign(new Error('big'), { status: 413 }); chunks.push(c); }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '?';

const db = await openDb();
const PUSH = process.env.NODE_ENV === 'test' ? null : await initPush(DATA_DIR, ownerEmail()).catch(() => null);
setInterval(() => db.cleanup().catch(() => {}), 3600_000).unref();

export const server = http.createServer(async (req, res) => {
  const send = (status, body, headers = {}) => {
    res.writeHead(status, {
      ...SEC, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'",
      ...headers,
    });
    res.end(body);
  };
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const cookies = parseCookies(req);
    const setCookies = [];

    if (req.method === 'GET' && p === '/healthz') return send(200, 'ok', { 'Content-Type': 'text/plain' });

    // Push-уведомления владельцу: открытый ключ, подписка телефона и событие от n8n (код кабинета знает только владелец)
    if (p === '/push/key' && req.method === 'GET') return PUSH ? send(200, JSON.stringify({ key: PUSH.publicKey }), { 'Content-Type': 'application/json' }) : send(503, '{"ok":false}', { 'Content-Type': 'application/json' });
    if ((p === '/push/sub' || p === '/push/send') && req.method === 'POST') {
      if (!PUSH) return send(503, '{"ok":false}', { 'Content-Type': 'application/json' });
      if (tooMany('push|' + clientIp(req), 40, 60_000)) return send(429, '{"ok":false}', { 'Content-Type': 'application/json' });
      let j = {}; try { j = JSON.parse((await readRaw(req, 4000)).toString('utf8')); } catch { return send(400, '{"ok":false}', { 'Content-Type': 'application/json' }); }
      if (p === '/push/sub') return send(200, JSON.stringify({ ok: PUSH.subscribe(j.code, j.sub) }), { 'Content-Type': 'application/json' });
      const t = textFor(j || {}); if (!t) return send(200, '{"ok":true,"sent":0}', { 'Content-Type': 'application/json' });
      return send(200, JSON.stringify({ ok: true, sent: await PUSH.notify(j.code, t) }), { 'Content-Type': 'application/json' });
    }

    // Частота запросов с одного адреса: общая, на изменения и на вход/регистрацию
    const ip = clientIp(req);
    if (tooMany('all|' + ip, 600, 60_000)) return send(429, 'Too many requests', { 'Content-Type': 'text/plain', 'Retry-After': '60' });
    if (req.method === 'POST') {
      if (tooMany('post|' + ip, 60, 60_000)) return send(429, 'Too many requests', { 'Content-Type': 'text/plain', 'Retry-After': '60' });
      if ((p === '/login' || p === '/register' || p === '/owner-register') && tooMany('auth|' + ip, 12, 60_000)) return send(429, 'Too many requests', { 'Content-Type': 'text/plain', 'Retry-After': '60' });
    }

    // статические файлы
    if (req.method === 'GET' && !p.includes('..') && /^\/[\w.-]+\.(css|js|svg|png|webmanifest)$/.test(p)) {
      const f = path.join(PUBLIC, p);
      if (fs.existsSync(f)) {
        const ext = path.extname(f);
        res.writeHead(200, { ...SEC, 'Content-Type': MIME[ext], 'Cache-Control': p === '/sw.js' ? 'no-cache' : 'public, max-age=3600' });
        return res.end(fs.readFileSync(f));
      }
    }

    // «Единое окно» — статичная страница на n8n-вебхуках (свой CSP: инлайн-скрипт и запросы к n8n)
    if (req.method === 'GET' && (p === '/window' || p === '/w')) {
      res.writeHead(200, {
        ...SEC, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https://n8n-ny7q.srv2033023.hstgr.cloud; frame-ancestors 'none'",
      });
      return res.end(WINDOW_HTML);
    }

    // Токен владельца пункта приходит после # и до сервера не доходит; сервер отдаёт только страницу.
    if (req.method === 'GET' && (p === '/punkt' || p === '/punkt/')) {
      res.writeHead(200, { ...SEC, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': PUNKT_CSP });
      return res.end(PUNKT_HTML);
    }

    const user = cookies.sid ? await db.userBySession(sha(cookies.sid)) : null;
    if (user) { // права владельца всегда совпадают с OWNER_EMAIL, а не только при регистрации
      const shouldOwn = !!ownerEmail() && String(user.email).toLowerCase() === ownerEmail();
      if (!!user.is_owner !== shouldOwn) { await db.setOwner(user.id, shouldOwn); user.is_owner = shouldOwn; }
    }
    const lang = pickLang(user ? user.lang : cookies.lang);
    let csrf = cookies.csrf;
    if (!csrf) { csrf = rand(); setCookies.push(cookie('csrf', csrf)); }
    const html = (status, body) => send(status, body, setCookies.length ? { 'Set-Cookie': setCookies } : {});
    const redirect = (to) => send(303, '', { Location: to, ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}) });

    if (req.method === 'GET') {
      // Главный адрес открывает рабочее окно. Старая страница «Лола · 300 сомони» убрана с главного адреса, но осталась в архиве: /start и /start/demo.
      if (p === '/' || p === '/demo') return redirect('/window');
      if (p === '/start') return user ? redirect('/cabinet') : html(200, V.landing(lang));
      if (p === '/start/demo') return html(200, V.demoPage(lang));
      if (p === '/owner-register') return user ? redirect('/cabinet') : html(200, V.ownerRegisterPage(lang, csrf));
      if (p === '/register') return user ? redirect('/cabinet') : html(200, V.registerPage(lang, csrf));
      if (p === '/login') return user ? redirect('/cabinet') : html(200, V.loginPage(lang, csrf));
      if (p === '/cabinet') return user ? html(200, V.cabinetPage(lang, user, csrf, { payDetails: PAY_DETAILS, profile: await db.profileByUser(user.id) })) : redirect('/login');
      if (p === '/profile') {
        if (!user) return redirect('/login');
        if (!['paid', 'profile_done'].includes(user.status)) return redirect('/cabinet');
        return html(200, V.profilePage(lang, csrf, '', await db.profileByUser(user.id) || {}));
      }
      if (p === '/admin/clients') return user && user.is_owner ? html(200, V.clientsPage(lang, await db.clients())) : html(404, V.notFound(lang));
      const cm = p.match(/^\/admin\/client\/(\d+)$/);
      if (cm) {
        if (!user || !user.is_owner) return html(404, V.notFound(lang));
        const c = await db.clientById(cm[1]);
        return c ? html(200, V.clientPage(lang, c, await db.profileByUser(c.id), csrf)) : html(404, V.notFound(lang));
      }
      if (p === '/admin') return user && user.is_owner ? html(200, V.adminPage(lang, await db.pendingReceipts(), csrf)) : html(404, V.notFound(lang));
      const rm = p.match(/^\/admin\/receipt\/(\d+)$/);
      if (rm) {
        if (!user || !user.is_owner) return html(404, V.notFound(lang));
        const r = await db.receiptById(rm[1]);
        if (!r || !/^[\w.-]+$/.test(r.file)) return html(404, V.notFound(lang));
        res.writeHead(200, { ...SEC, 'Content-Type': r.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
        return res.end(fs.readFileSync(path.join(DATA_DIR, 'receipts', r.file)));
      }
      const m = p.match(/^\/lang\/(ru|tg|uz)$/);
      if (m) {
        setCookies.push(cookie('lang', m[1], 365 * 24 * 3600));
        if (user) await db.setLang(user.id, m[1]);
        const back = req.headers.referer ? new URL(req.headers.referer, 'http://x').pathname : '/';
        return redirect(back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/lang') ? back : '/');
      }
      return html(404, V.notFound(lang));
    }

    if (req.method === 'POST' && p === '/receipt') {
      if (!user) return html(401, 'login');
      if (!cookies.csrf || req.headers['x-csrf'] !== cookies.csrf) return html(403, 'csrf');
      if (!['awaiting_payment', 'rejected'].includes(user.status)) return html(409, 'status');
      if ((await db.receiptCount(user.id)) >= MAX_RECEIPTS_PER_USER) return html(429, 'limit');
      const buf = await readRaw(req, MAX_RECEIPT);
      const kind = sniff(buf);
      if (!kind) return html(415, 'type');
      const name = `${user.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${kind[1]}`;
      fs.mkdirSync(path.join(DATA_DIR, 'receipts'), { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, 'receipts', name), buf, { mode: 0o600 });
      await db.addReceipt(user.id, name, kind[0]);
      await db.setUserStatus(user.id, 'receipt_sent');
      return html(200, 'ok');
    }

    if (req.method === 'POST') {
      const form = await readForm(req);
      if (!form.csrf || form.csrf !== cookies.csrf) return html(403, V.notFound(lang));
      const t = T[lang];

      if (p === '/register' && form.phone !== undefined) {
        // регистрация гостя только по номеру телефона; логин и пароль выдаёт владелец после подтверждения чека
        const ph = normPhone(form.phone);
        const err = !ph ? t.errPhone : form.terms !== '1' ? t.errTerms : '';
        if (err) return html(400, V.registerPage(lang, csrf, err, { phone: form.phone }));
        let u = await db.userByPhone(ph);
        if (u && u.password_hash) return html(409, V.registerPage(lang, csrf, t.errExists, { phone: form.phone }));
        if (!u) u = await db.createUser({ phone: ph, name: V.fmtPhone(ph), lang, isOwner: false });
        const tok = rand(); await db.createSession(sha(tok), u.id, SESSION_TTL);
        setCookies.push(cookie('sid', tok, SESSION_TTL));
        return redirect('/cabinet');
      }

      if (p === '/register') {
        const v = { name: (form.name || '').trim(), email: (form.email || '').trim().toLowerCase() };
        let err = '';
        if (!v.name || v.name.length > 80) err = t.errName;
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) || v.email.length > 120) err = t.errEmail;
        else if (!form.password || form.password.length < 8 || form.password.length > 200) err = t.errPass;
        else if (form.terms !== '1') err = t.errTerms;
        if (err) return html(400, V.registerPage(lang, csrf, err, v));
        try {
          const u = await db.createUser({ email: v.email, name: v.name, passwordHash: await hashPassword(form.password), lang, isOwner: !!ownerEmail() && v.email === ownerEmail() });
          const tok = rand(); await db.createSession(sha(tok), u.id, SESSION_TTL);
          setCookies.push(cookie('sid', tok, SESSION_TTL));
          return redirect('/cabinet');
        } catch (e) {
          if (e.code === '23505') return html(409, V.registerPage(lang, csrf, t.errExists, v));
          throw e;
        }
      }

      if (p === '/login') {
        const login = String(form.login || form.email || '').trim().toLowerCase();
        const ph = login.includes('@') ? null : normPhone(login);
        const key = `${ip}|${ph || login}`, keyAll = `*|${ph || login}`;
        // по адресу и логину — 5 неудач, по одному логину со всех адресов — 25 (против перебора с разных адресов)
        if ((await db.recentFailures(key, FAIL_WINDOW)) >= MAX_FAILS || (await db.recentFailures(keyAll, FAIL_WINDOW)) >= MAX_FAILS * 5) return html(429, V.loginPage(lang, csrf, t.errLimit, { login }));
        const u = login ? (ph ? await db.userByPhone(ph) : await db.userByEmail(login)) : null;
        const ok = !!u && !!u.password_hash && (await checkPassword(String(form.password || '').slice(0, 200), u.password_hash));
        if (!ok) { if (!u || !u.password_hash) await checkPassword(String(form.password || '').slice(0, 200), DUMMY); await db.addFailure(key); await db.addFailure(keyAll); return html(401, V.loginPage(lang, csrf, t.errCreds, { login })); }
        await db.clearFailures(key);
        const tok = rand(); await db.createSession(sha(tok), u.id, SESSION_TTL);
        setCookies.push(cookie('sid', tok, SESSION_TTL));
        return redirect('/cabinet');
      }

      if (p === '/profile') {
        if (!user) return redirect('/login');
        if (!['paid', 'profile_done'].includes(user.status)) return redirect('/cabinet');
        const cut = (v, n) => String(v || '').trim().slice(0, n);
        const v = {
          business_name: cut(form.business_name, 100), about: cut(form.about, 2000), services: cut(form.services, 3000),
          hours: cut(form.hours, 300), extra: cut(form.extra, 3000),
          tone: ['friendly', 'formal', 'brief'].includes(form.tone) ? form.tone : 'friendly',
          channels: ['instagram', 'telegram', 'whatsapp'].filter((c) => form['ch_' + c] === '1').join(','),
        };
        let err = '';
        if (!v.business_name) err = t.errBizName;
        else if (v.about.length < 10) err = t.errAbout;
        else if (!v.channels) err = t.errChannels;
        if (err) return html(400, V.profilePage(lang, csrf, err, v));
        await db.saveProfile(user.id, v);
        if (user.status === 'paid') await db.setUserStatus(user.id, 'profile_done');
        return redirect('/cabinet');
      }

      if (p === '/admin/decide') {
        if (!user || !user.is_owner) return html(404, V.notFound(lang));
        const r = await db.receiptById(form.id);
        if (r && r.status === 'pending' && (form.decision === 'confirm' || form.decision === 'reject')) {
          const ok = form.decision === 'confirm';
          await db.setReceiptStatus(r.id, ok ? 'confirmed' : 'rejected');
          await db.setUserStatus(r.user_id, ok ? 'paid' : 'rejected');
          if (ok) {
            // клиент без пароля (зарегистрировался по телефону): выдаём логин и пароль для отправки в WhatsApp
            const target = await db.userById(r.user_id);
            if (target && target.phone && !target.password_hash) {
              const pw = genPassword();
              await db.setPassword(target.id, await hashPassword(pw));
              return html(200, V.credentialsPage(lang, target, pw, `${PUBLIC_URL}/login`));
            }
          }
        }
        return redirect('/admin');
      }

      if (p === '/admin/password') {
        if (!user || !user.is_owner) return html(404, V.notFound(lang));
        const c = await db.userById(form.id);
        if (!c || c.is_owner || !c.phone) return html(404, V.notFound(lang));
        const pw = genPassword();
        await db.setPassword(c.id, await hashPassword(pw));
        return html(200, V.credentialsPage(lang, c, pw, `${PUBLIC_URL}/login`));
      }

      if (p === '/logout') {
        if (cookies.sid) await db.deleteSession(sha(cookies.sid));
        setCookies.push(cookie('sid', '', 0));
        return redirect('/');
      }
    }
    return html(404, V.notFound(lang));
  } catch (e) {
    console.error(e);
    return send(e.status || 500, e.status === 413 ? 'Too large' : 'Error', { 'Content-Type': 'text/plain' });
  }
});

if (process.env.NO_LISTEN !== '1') server.listen(PORT, () => console.log(`listening on ${PORT}`));
