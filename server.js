import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDb } from './db.js';
import { pickLang, T } from './i18n.js';
import * as V from './views.js';

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
const WINDOW_HTML = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'window.html'));
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rand = () => crypto.randomBytes(32).toString('base64url');

// Пароли: scrypt из стандартной библиотеки Node (argon2 можно подключить позже)
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
function checkPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(h, 'base64');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const DUMMY = hashPassword('dummy-password'); // одинаковое время ответа, если почты нет

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
setInterval(() => db.cleanup().catch(() => {}), 3600_000).unref();

export const server = http.createServer(async (req, res) => {
  const send = (status, body, headers = {}) => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store',
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

    // статические файлы
    if (req.method === 'GET' && !p.includes('..') && /^\/[\w.-]+\.(css|js|svg|png|webmanifest)$/.test(p)) {
      const f = path.join(PUBLIC, p);
      if (fs.existsSync(f)) {
        const ext = path.extname(f);
        res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': p === '/sw.js' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
        return res.end(fs.readFileSync(f));
      }
    }

    // «Единое окно» — статичная страница на n8n-вебхуках (свой CSP: инлайн-скрипт и запросы к n8n)
    if (req.method === 'GET' && (p === '/window' || p === '/w')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https://n8n-ny7q.srv2033023.hstgr.cloud; frame-ancestors 'none'",
      });
      return res.end(WINDOW_HTML);
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
      if (p === '/') return user ? redirect('/cabinet') : html(200, V.landing(lang));
      if (p === '/demo') return html(200, V.demoPage(lang));
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
        res.writeHead(200, { 'Content-Type': r.mime, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
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
      if (req.headers['x-csrf'] !== cookies.csrf) return html(403, 'csrf');
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
          const u = await db.createUser({ email: v.email, name: v.name, passwordHash: hashPassword(form.password), lang, isOwner: !!ownerEmail() && v.email === ownerEmail() });
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
        const key = `${clientIp(req)}|${ph || login}`;
        if ((await db.recentFailures(key, FAIL_WINDOW)) >= MAX_FAILS) return html(429, V.loginPage(lang, csrf, t.errLimit, { login }));
        const u = login ? (ph ? await db.userByPhone(ph) : await db.userByEmail(login)) : null;
        const ok = !!u && !!u.password_hash && checkPassword(form.password || '', u.password_hash);
        if (!ok) { checkPassword(form.password || '', DUMMY); await db.addFailure(key); return html(401, V.loginPage(lang, csrf, t.errCreds, { login })); }
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
              await db.setPassword(target.id, hashPassword(pw));
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
        await db.setPassword(c.id, hashPassword(pw));
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
