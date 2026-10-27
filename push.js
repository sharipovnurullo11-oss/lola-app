// Push-уведомления владельцу кабинета (Web Push). Ключи и подписки хранятся в DATA_DIR, внешних настроек не нужно.
// Если пакет web-push не установлен или нет доступа к диску, функция вернёт null, а остальное приложение работает как раньше.
import fs from 'node:fs';
import path from 'node:path';

const CODE_RE = /^k[a-z0-9]{20,60}$/;
const MAX_SUBS = 5;
const LANGS = ['ru', 'tg'];

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
      // lang — язык, на котором открыт сайт на этом телефоне: уведомление придёт на нём (ru, tg).
      subscribe(code, sub, lang) {
        if (!CODE_RE.test(String(code || '')) || !okSub(sub)) return false;
        const list = (subs[code] || []).filter((x) => x.endpoint !== sub.endpoint);
        list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, lang: LANGS.includes(lang) ? lang : 'ru', ts: Date.now() });
        subs[code] = list.slice(-MAX_SUBS); save(); return true;
      },
      // payload — готовый текст или функция (язык → текст), чтобы каждый телефон получил уведомление на своём языке.
      async notify(code, payload) {
        if (!CODE_RE.test(String(code || ''))) return 0;
        const list = subs[code] || []; if (!list.length) return 0;
        let sent = 0, dead = [];
        await Promise.all(list.map(async (s) => {
          const p = (typeof payload === 'function' ? payload(s.lang || 'ru') : payload) || {};
          const body = JSON.stringify({ title: String(p.title || '').slice(0, 80), body: String(p.body || '').slice(0, 200), url: '/window' });
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 3600 }); sent++; }
          catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint); }
        }));
        if (dead.length) { subs[code] = list.filter((s) => !dead.includes(s.endpoint)); save(); }
        return sent;
      },
    };
  } catch { return null; }
}

// Текст уведомления по событию (события присылает n8n; неизвестные игнорируем).
// lang 'tg' — уведомления магазина по-таджикски (магазин Шамсуло); прокат пока только по-русски.
export function textFor(ev, lang) {
  const tg = lang === 'tg', t = (ru, tj) => (tg ? tj : ru);
  const money = (x) => String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+$)/g, ' ');
  const who = String(ev.who || '').slice(0, 40), sum = money(ev.sum), note = String(ev.note || '').slice(0, 60);
  const som = t(' сомони', ' сомонӣ');
  if (ev.kind === 'rashod') return { title: t('Личный расход продавца', 'Хароҷоти шахсии фурӯшанда'), body: who + ': ' + sum + som + (note ? ' (' + note + ')' : '') };
  // Сдача кассы продавцом (магазин): сколько сдал, сколько должно быть, разница и итог смены по способам оплаты.
  if (ev.kind === 'sdacha') {
    const d = Math.round((Number(ev.diff) || 0) * 100) / 100;
    const res = Math.abs(d) < 0.005 ? t('всё сходится', 'ҳама мувофиқ') : (d < 0 ? t('недостача ', 'камомад ') : t('излишек ', 'зиёдатӣ ')) + money(Math.abs(d)) + som;
    const by = ev.by && typeof ev.by === 'object' ? ev.by : {};
    const NAMES = tg ? { nal: 'нақд', alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: 'интиқол', dolg: 'қарз' } : { nal: 'наличные', alif: 'Алиф', dushanbe: 'Душанбе Сити', perevod: 'перевод', dolg: 'в долг' };
    const parts = Object.keys(NAMES).filter((k) => Number(by[k])).map((k) => NAMES[k] + ' ' + money(by[k]));
    return { title: t('Касса сдана: ', 'Касса супорида шуд: ') + who, body: t('Сдал ', 'Супорид ') + sum + t(', должно ', ', бояд ') + money(ev.exp) + ' — ' + res + (parts.length ? '. ' + t('Смена', 'Смена') + ': ' + parts.join(', ') : '') };
  }
  // Утреннее напоминание магазина: товары, остаток которых ниже заданного минимума (список «Заказать у поставщика»).
  if (ev.kind === 'shop_low') {
    const n = Math.max(0, Math.min(9999, Math.round(Number(ev.n) || 0)));
    if (!n) return null;
    const q = (x) => String(Math.round((Number(x) || 0) * 1000) / 1000);
    const items = (Array.isArray(ev.items) ? ev.items : []).slice(0, 3).map((x) => String((x && x.name) || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) + ' — ' + q(x && x.qty) + t(' из ', ' аз ') + q(x && x.min)).filter((x) => x.length > 3);
    return { title: t('Заканчивается товар: ', 'Мол тамом шуда истодааст: ') + n, body: (items.join(' · ') || t('Откройте «Анализ» → «Заказать»', '«Таҳлил» → «Фармоиш»-ро кушоед')) + (n > items.length && items.length ? t(' и ещё ', ' ва боз ') + (n - items.length) : '') };
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
