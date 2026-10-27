// Ссылка владельца пункта: показать (owner_link), выдать новую вместо старой (owner_link_new) — старая сразу перестаёт работать,
// задать или убрать PIN (owner_pin: 4 цифры или пусто; заодно снимает блокировку после 10 ошибок).
const prev = $input.first().json;
const B = $('Прокат: запрос').first().json.body || {};
const act = String(B.action || '');
if ((act !== 'owner_link' && act !== 'owner_link_new' && act !== 'owner_pin') || !$('Кабинет').first().json.ok) return [{ json: prev }];
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const out = (resp, extra) => [{ json: Object.assign({ op: 'none', resp: resp }, extra || {}) }];
const URL0 = 'https://app.nurullo-sharipov.tech/punkt#t=';
const point = String(B.name || '');
if (!R('Итоги по точкам').some(r => String(r.tochka) === point)) return out({ ok: false, error: 'пункт не найден' });
const rows = R('Владельцы пунктов').filter(r => String(r.tochka) === point).sort((a, b) => Number(b.id) - Number(a.id));
const cur = rows.find(r => r.aktivno !== false && String(r.token || '').length >= 20);
const pinOf = r => r && /^\d{4}$/.test(String(r.pin || '')) ? String(r.pin) : '';
const pinInfo = r => ({ pin: pinOf(r), locked: !!pinOf(r) && (Number(r.pin_oshibki) || 0) >= 10 });
if (act === 'owner_link') return out(Object.assign({ ok: true, point: point, link: cur ? URL0 + cur.token : '', owner: cur ? String(cur.vladelets || '') : '', since: cur ? String(cur.createdAt || '').slice(0, 10) : '' }, pinInfo(cur)));
if (act === 'owner_pin') {
  const pin = String(B.pin == null ? '' : B.pin).trim();
  if (!cur) return out({ ok: false, error: 'сначала выдайте ссылку' });
  if (pin && !/^\d{4}$/.test(pin)) return out({ ok: false, error: 'PIN — 4 цифры' });
  return out({ ok: true, point: point, link: URL0 + cur.token, owner: String(cur.vladelets || ''), since: String(cur.createdAt || '').slice(0, 10), pin: pin, locked: false }, { op: 'owner_pin', pin_row: cur.id, pin: pin });
}
const id = String(B.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
const done = rows.find(r => String(r.oid || '') === id);
if (done) return out(Object.assign({ ok: true, point: point, link: URL0 + done.token, owner: String(done.vladelets || ''), since: String(done.createdAt || '').slice(0, 10), dup: true }, pinInfo(done)));
const token = String($('Случайный ключ').first().json.rand || '').slice(0, 32);
if (!/^[0-9a-f]{32}$/.test(token)) return out({ ok: false, error: 'не получилось создать ссылку, попробуйте ещё раз' });
const owner = String((cur || rows[0] || {}).vladelets || '');
// PIN старой ссылки переходит на новую, счётчик ошибок начинается заново.
const pin = pinOf(cur);
return out({ ok: true, point: point, link: URL0 + token, owner: owner, since: new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10), pin: pin, locked: false }, { op: 'owner_link', row: { token: token, tochka: point, vladelets: owner, aktivno: true, oid: id, pin: pin, pin_oshibki: 0 } });
