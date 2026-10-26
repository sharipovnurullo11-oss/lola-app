// Доля пункта с аренды (сейчас 20%, Нурулло — 80%): общая для всех пунктов («*») и своя для отдельного пункта.
// share_get — общая доля и пункты со своей долей; share_set — новая доля (запись добавляется, старые остаются как история);
// share_set с reset — пункт снова на общей доле (строка с dolya = -1).
const prev = $input.first().json;
const B = $('Прокат: запрос').first().json.body || {};
const act = String(B.action || '');
if ((act !== 'share_get' && act !== 'share_set') || !$('Кабинет').first().json.ok) return [{ json: prev }];
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const out = (resp, extra) => [{ json: Object.assign({ op: 'none', resp: resp }, extra || {}) }];
const rows = R('Доли пунктов').sort((a, b) => Number(a.id) - Number(b.id));
const last = {};
rows.forEach(r => { const p = Number(r.dolya), k = String(r.tochka); if (p === -1 && k !== '*') delete last[k]; else if (p >= 0 && p <= 100) last[k] = { pct: p, date: String(r.data || '') }; });
const def = last['*'] ? last['*'].pct : 20;
const own = Object.keys(last).filter(k => k !== '*').map(k => ({ name: k, pct: last[k].pct, date: last[k].date })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
const pctOf = name => last[name] ? last[name].pct : def;
const point = String(B.name || '');
if (point && !R('Итоги по точкам').some(r => String(r.tochka) === point)) return out({ ok: false, error: 'пункт не найден' });
if (act === 'share_get') return out({ ok: true, default: def, points: own, point: point ? { name: point, pct: pctOf(point), own: !!last[point] } : null });
const reset = B.reset === true && !!point;
const pct = reset ? -1 : Math.round(Number(B.pct) * 10) / 10;
const id = String(B.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
if (!reset && !(B.pct !== '' && B.pct != null && pct >= 0 && pct <= 50)) return out({ ok: false, error: 'доля пункта: от 0 до 50%' });
if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
if (rows.some(r => String(r.oid) === id)) return out({ ok: true, dup: true, default: def, points: own, point: point ? { name: point, pct: pctOf(point), own: !!last[point] } : null });
const key = point || '*';
const date = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const nd = key === '*' ? pct : def;
const nown = reset ? own.filter(x => x.name !== point) : point ? own.filter(x => x.name !== point).concat([{ name: point, pct: pct, date: date }]).sort((a, b) => a.name.localeCompare(b.name, 'ru')) : own;
return out({ ok: true, default: nd, points: nown, point: point ? { name: point, pct: reset ? nd : pct, own: !reset } : null }, { op: 'share_set', row: { tochka: key, dolya: pct, data: date, avtor: 'приложение', oid: id } });
