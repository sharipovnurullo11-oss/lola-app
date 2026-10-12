import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDb } from './db.js';
import { pickLang, T } from './i18n.js';
import * as V from './views.js';

const PORT = Number(process.env.PORT || 3000);
const SECURE = process.env.COOKIE_SECURE !== '0';
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase();
const SESSION_TTL = 30 * 24 * 3600;
const MAX_FAILS = 5, FAIL_WINDOW = 15 * 60;
const PUBLIC = path.join(path.dirname(new URL(import.meta.url).pathname), 'public');
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
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
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

    const user = cookies.sid ? await db.userBySession(sha(cookies.sid)) : null;
    const lang = pickLang(user ? user.lang : cookies.lang);
    let csrf = cookies.csrf;
    if (!csrf) { csrf = rand(); setCookies.push(cookie('csrf', csrf)); }
    const html = (status, body) => send(status, body, setCookies.length ? { 'Set-Cookie': setCookies } : {});
    const redirect = (to) => send(303, '', { Location: to, ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}) });

    if (req.method === 'GET') {
      if (p === '/') return user ? redirect('/cabinet') : html(200, V.landing(lang));
      if (p === '/register') return user ? redirect('/cabinet') : html(200, V.registerPage(lang, csrf));
      if (p === '/login') return user ? redirect('/cabinet') : html(200, V.loginPage(lang, csrf));
      if (p === '/cabinet') return user ? html(200, V.cabinetPage(lang, user, csrf)) : redirect('/login');
      const m = p.match(/^\/lang\/(ru|tg|uz)$/);
      if (m) {
        setCookies.push(cookie('lang', m[1], 365 * 24 * 3600));
        if (user) await db.setLang(user.id, m[1]);
        const back = req.headers.referer ? new URL(req.headers.referer, 'http://x').pathname : '/';
        return redirect(back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/lang') ? back : '/');
      }
      return html(404, V.notFound(lang));
    }

    if (req.method === 'POST') {
      const form = await readForm(req);
      if (!form.csrf || form.csrf !== cookies.csrf) return html(403, V.notFound(lang));
      const t = T[lang];

      if (p === '/register') {
        const v = { name: (form.name || '').trim(), email: (form.email || '').trim().toLowerCase() };
        let err = '';
        if (!v.name || v.name.length > 80) err = t.errName;
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) || v.email.length > 120) err = t.errEmail;
        else if (!form.password || form.password.length < 8 || form.password.length > 200) err = t.errPass;
        else if (form.terms !== '1') err = t.errTerms;
        if (err) return html(400, V.registerPage(lang, csrf, err, v));
        try {
          const u = await db.createUser({ email: v.email, name: v.name, passwordHash: hashPassword(form.password), lang, isOwner: !!OWNER_EMAIL && v.email === OWNER_EMAIL });
          const tok = rand(); await db.createSession(sha(tok), u.id, SESSION_TTL);
          setCookies.push(cookie('sid', tok, SESSION_TTL));
          return redirect('/cabinet');
        } catch (e) {
          if (e.code === '23505') return html(409, V.registerPage(lang, csrf, t.errExists, v));
          throw e;
        }
      }

      if (p === '/login') {
        const email = (form.email || '').trim().toLowerCase();
        const key = `${clientIp(req)}|${email}`;
        if ((await db.recentFailures(key, FAIL_WINDOW)) >= MAX_FAILS) return html(429, V.loginPage(lang, csrf, t.errLimit, { email }));
        const u = await db.userByEmail(email);
        const ok = checkPassword(form.password || '', u ? u.password_hash : DUMMY) && !!u;
        if (!ok) { await db.addFailure(key); return html(401, V.loginPage(lang, csrf, t.errCreds, { email })); }
        await db.clearFailures(key);
        const tok = rand(); await db.createSession(sha(tok), u.id, SESSION_TTL);
        setCookies.push(cookie('sid', tok, SESSION_TTL));
        return redirect('/cabinet');
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
