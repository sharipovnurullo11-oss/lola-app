// Перевозки инструмента: с пункта на пункт, на склад и со склада (move) и журнал перевозок (moves).
// Продажа — это перевозка «в Продан» с ценой (price — сумма за всё): инструмент убывает с пункта или со склада, в журнале остаётся цена.
// Количество меняется прямо в таблице инструментов пунктов, поэтому сразу видно везде: в Финансисте, объезде и окне владельца.
const prev = $input.first().json;
const B = $('Прокат: запрос').first().json.body || {};
const act = String(B.action || '');
if ((act !== 'move' && act !== 'moves') || !$('Кабинет').first().json.ok) return [{ json: prev }];
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const out = (resp, extra) => [{ json: Object.assign({ op: 'none', resp: resp }, extra || {}) }];
const nn = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pk = s => nn(s).slice(0, 14);
const san = (s, n) => String(s || '').replace(/[^a-zA-Z0-9а-яА-ЯёЁӣӯқғҳҷъӢӮҚҒҲҶ .,:;_()+№-]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const SKLAD = 'Склад', SOLD = 'Продан', ST = ['сломан', 'в ремонте', 'починен', 'на запчасти'];
const date = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const pts = R('Итоги по точкам').map(r => ({ name: String(r.tochka), gorod: String(r.gorod || '') }));
const moves = R('Перевозки');

if (act === 'moves') {
  const point = String(B.name || ''), tool = String(B.tool || '');
  const list = moves.filter(m => (pk(m.iz) === pk(point) || pk(m.v) === pk(point)) && (!tool || nn(m.instrument) === nn(tool)))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || Number(b.id) - Number(a.id)).slice(0, 50)
    .map(m => ({ date: String(m.data || ''), tool: String(m.instrument || ''), from: String(m.iz || ''), to: String(m.v || ''), qty: Number(m.kolvo) || 0, state: String(m.sostoyanie || ''), note: String(m.primechanie || ''), price: Number(m.cena) || 0 }));
  return out({ ok: true, moves: list });
}

const from = String(B.from || ''), to = String(B.to || ''), q = Math.round(Number(B.qty));
const id = String(B.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
const place = n => n === SKLAD ? SKLAD : (pts.find(p => p.name === n) || {}).name || '';
const sold = to === SOLD, price = Math.round(Number(B.price) * 100) / 100;
if (!place(from) || (!sold && !place(to))) return out({ ok: false, error: 'выберите, откуда и куда' });
if (sold && !(price > 0 && price <= 10000000)) return out({ ok: false, error: 'укажите цену продажи' });
if (from === to) return out({ ok: false, error: 'откуда и куда — одно и то же место' });
if (!(q >= 1 && q <= 1000)) return out({ ok: false, error: 'количество — от 1' });
if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
if (moves.some(m => String(m.oid) === id)) return out({ ok: true, dup: true });
const state = String(B.state || (to === SKLAD ? 'сломан' : 'починен'));
const note = sold ? 'продан' : 'на пункт ' + san(to, 60);
if ((from === SKLAD || to === SKLAD) && ST.indexOf(state) < 0) return out({ ok: false, error: 'неверное состояние' });
let name = san(B.tool, 80), upd = null, ins = null, stock = null;
if (!name) return out({ ok: false, error: 'выберите инструмент' });
if (from === SKLAD) {
  const have = R('Склад').filter(r => nn(r.instrument) === nn(name) && !String(r.zapchast || '').trim() && String(r.sostoyanie || '') !== 'фото' && (ST.indexOf(String(r.sostoyanie || '')) >= 0 ? String(r.sostoyanie) : 'починен') === state).reduce((s, r) => s + (Number(r.izmenenie) || 0), 0);
  if (have < q) return out({ ok: false, error: 'на складе столько нет (' + state + ': ' + have + ')' });
  const any = R('Склад').find(r => nn(r.instrument) === nn(name)); if (any) name = String(any.instrument);
  stock = { instrument: name, izmenenie: -q, data: date, primechanie: note, oid: id + '_s', avtor: 'приложение', sostoyanie: state, zapchast: '' };
} else {
  const rows = R('Инструменты пунктов').filter(r => String(r.tip) === 'Инструмент' && pk(r.tochka) === pk(from) && nn(r.instrument) === nn(name));
  const have = rows.reduce((s, r) => s + Math.max(1, Number(r.kolvo) || 1), 0);
  if (have < q) return out({ ok: false, error: 'на пункте столько нет (есть ' + have + ')' });
  const row = rows.find(r => Math.max(1, Number(r.kolvo) || 1) >= q);
  if (!row) return out({ ok: false, error: 'перевозите по одному' });
  const left = Math.max(1, Number(row.kolvo) || 1) - q;
  name = String(row.instrument).replace(/\s+/g, ' ').trim();
  upd = { id: row.id, kolvo: left, tip: left > 0 ? 'Инструмент' : 'Перевезён' };
}
if (sold) {
  // продажа: никуда не добавляем
} else if (to === SKLAD) {
  const any = R('Склад').find(r => nn(r.instrument) === nn(name));
  stock = { instrument: any ? String(any.instrument) : name, izmenenie: q, data: date, primechanie: 'с пункта ' + san(from, 60), oid: id + '_s', avtor: 'приложение', sostoyanie: state, zapchast: '' };
} else {
  ins = { tip: 'Инструмент', tochka: to, gorod: (pts.find(p => p.name === to) || {}).gorod || '', instrument: name, kolvo: q, istochnik: 'перевозка', primechanie: 'из ' + san(from, 60) + ', ' + date };
}
const log = { data: date, instrument: name, iz: from, v: to, kolvo: q, sostoyanie: from === SKLAD || to === SKLAD ? state : '', primechanie: san(B.note, 80), oid: id, avtor: 'приложение', cena: sold ? price : 0 };
return out({ ok: true, moved: { date: date, tool: name, from: from, to: to, qty: q, price: sold ? price : 0 } }, { op: 'move', log: log, upd: upd, ins: ins, stock: stock });
