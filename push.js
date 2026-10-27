// Push-уведомления владельцу кабинета (Web Push). Ключи и подписки хранятся в DATA_DIR, внешних настроек не нужно.
// Если пакет web-push не установлен или нет доступа к диску, функция вернёт null, а остальное приложение работает как раньше.
import fs from 'node:fs';
import path from 'node:path';

const CODE_RE = /^k[a-z0-9]{20,60}$/;
const MAX_SUBS = 5;

export async function initPush(dataDir, contact) {
  let webpush;
  try { webpush = (await import('web-push')).default; } catch { return null; }
  let vapid, subs = {};
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const kf = path.join(dataDir, 'vapid.json'), sf = path.join(dataDir, 'push-subs.json');
    try { vapid = JSON.parse(fs.readFileSync(kf, 'utf8')); } catch { /* первый запуск */ }
    if (!vapid || !vapid.publicKey || !vapid.privateKey) { vapid = webpush.generateVAPIDKeys(); fs.writeFileSync(kf, JSON.stringify(vapid), { mode: 0o600 }); }
    try { subs = JSON.parse(fs.readFileSync(sf, 'utf8')) || {}; } catch { subs = {}; }
    webpush.setVapidDetails('mailto:' + (contact || 'admin@nurullo-sharipov.tech'), vapid.publicKey, vapid.privateKey);
    const save = () => { try { fs.writeFileSync(sf, JSON.stringify(subs), { mode: 0o600 }); } catch { /* не критично */ } };
    const okSub = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 600 && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
    return {
      publicKey: vapid.publicKey,
      subscribe(code, sub) {
        if (!CODE_RE.test(String(code || '')) || !okSub(sub)) return false;
        const list = (subs[code] || []).filter((x) => x.endpoint !== sub.endpoint);
        list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, ts: Date.now() });
        subs[code] = list.slice(-MAX_SUBS); save(); return true;
      },
      async notify(code, payload) {
        if (!CODE_RE.test(String(code || ''))) return 0;
        const list = subs[code] || []; if (!list.length) return 0;
        const body = JSON.stringify({ title: String(payload.title || '').slice(0, 80), body: String(payload.body || '').slice(0, 200), url: '/window' });
        let sent = 0, dead = [];
        await Promise.all(list.map(async (s) => {
          try { await webpush.sendNotification(s, body, { TTL: 3600 }); sent++; }
          catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint); }
        }));
        if (dead.length) { subs[code] = list.filter((s) => !dead.includes(s.endpoint)); save(); }
        return sent;
      },
    };
  } catch { return null; }
}

// Текст уведомления по событию (события присылает n8n; неизвестные игнорируем)
export function textFor(ev) {
  const money = (x) => String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+$)/g, ' ');
  const who = String(ev.who || '').slice(0, 40), sum = money(ev.sum), note = String(ev.note || '').slice(0, 60);
  if (ev.kind === 'rashod') return { title: 'Личный расход продавца', body: who + ': ' + sum + ' сомони' + (note ? ' (' + note + ')' : '') };
  // Сдача кассы продавцом (магазин): сколько сдал, сколько должно быть, разница и итог смены по способам оплаты.
  if (ev.kind === 'sdacha') {
    const d = Math.round((Number(ev.diff) || 0) * 100) / 100;
    const res = Math.abs(d) < 0.005 ? 'всё сходится' : (d < 0 ? 'недостача ' : 'излишек ') + money(Math.abs(d)) + ' сомони';
    const by = ev.by && typeof ev.by === 'object' ? ev.by : {};
    const NAMES = { nal: 'наличные', alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: 'перевод', dolg: 'в долг' };
    const parts = Object.keys(NAMES).filter((k) => Number(by[k])).map((k) => NAMES[k] + ' ' + money(by[k]));
    return { title: 'Касса сдана: ' + who, body: 'Сдал ' + sum + ', должно ' + money(ev.exp) + ' — ' + res + (parts.length ? '. Смена: ' + parts.join(', ') : '') };
  }
  // Утренние напоминания проката: только числа, текст собирает сервер.
  if (ev.kind === 'prokat_remind') {
    const n = (x) => Math.max(0, Math.min(999, Math.round(Number(x) || 0)));
    const parts = [];
    if (n(ev.visit)) parts.push('объезд: ' + n(ev.visit) + ' пункт. давно не было');
    if (n(ev.owed)) parts.push('долг: ' + n(ev.owed) + ' пункт. на ' + money(ev.owed_sum) + ' сомони');
    if (n(ev.broken)) parts.push('сломано больше 14 дн.: ' + n(ev.broken));
    return parts.length ? { title: 'Прокат: напоминания', body: parts.join(' · ') } : null;
  }
  return null;
}
