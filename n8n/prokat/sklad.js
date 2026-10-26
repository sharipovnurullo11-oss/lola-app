// Склад проката: всё, что начинается на stock. Остальные действия проходят дальше без изменений.
const prev = $input.first().json;
const B = $('Прокат: запрос').first().json.body || {};
const act = String(B.action || '');
if (act.indexOf('stock') !== 0 || !$('Кабинет').first().json.ok) return [{ json: prev }];
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const out = (resp, extra) => [{ json: Object.assign({ op: 'none', resp: resp }, extra || {}) }];
const st = R('Склад');
const san = (s, n) => String(s || '').replace(/[^a-zA-Z0-9а-яА-ЯёЁӣӯқғҳҷъӢӮҚҒҲҶ .,:;_()+-]/g, '').trim().slice(0, n);
const clean = s => { s = String(s || ''); const i = s.indexOf('] '); return s.indexOf('[') === 0 && i > 0 ? s.slice(i + 2) : s; };
const nn = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const SK_ST = ['сломан', 'в ремонте', 'починен', 'на запчасти'];
const skName = s => san(String(s || '').replace(/\s+/g, ' '), 60);
const skIsPhoto = r => String(r.sostoyanie || '') === 'фото';
const skPart = r => String(r.zapchast || '').trim();
const skState = r => SK_ST.indexOf(String(r.sostoyanie || '')) >= 0 ? String(r.sostoyanie) : 'починен';
const skKinds = extra => {
  const m = {};
  st.concat(extra || []).forEach(r => {
    const nm = String(r.instrument || '').trim(); if (!nm) return;
    const k = nn(nm);
    const g = m[k] || (m[k] = { name: nm, states: { 'сломан': 0, 'в ремонте': 0, 'починен': 0, 'на запчасти': 0 }, parts: {}, photo_date: '' });
    const d = Number(r.izmenenie) || 0;
    if (skIsPhoto(r)) { if (String(r.data || '') >= g.photo_date) g.photo_date = String(r.data || ''); }
    else if (skPart(r)) { const pk = nn(skPart(r)); const p = g.parts[pk] || (g.parts[pk] = { name: skPart(r), qty: 0 }); p.qty += d; }
    else g.states[skState(r)] += d;
  });
  return Object.keys(m).map(k => { const g = m[k]; const qty = SK_ST.reduce((s, x) => s + g.states[x], 0); const parts = Object.keys(g.parts).map(p => g.parts[p]).filter(p => p.qty !== 0).sort((a, b) => a.name.localeCompare(b.name, 'ru')); return { name: g.name, qty: qty, states: g.states, parts: parts, parts_qty: parts.reduce((s, p) => s + p.qty, 0), photo_date: g.photo_date }; }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};
const skCanon = nm => { const k = nn(nm); const g = skKinds(null).find(x => nn(x.name) === k); return g ? g.name : nm; };
const skOid = () => String(B.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
const skSeen = id => st.some(r => { const o = String(r.oid || ''); return o === id || o.indexOf(id + '_') === 0; });
const skDate = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const skRow = (o) => Object.assign({ instrument: '', izmenenie: 0, data: skDate(), primechanie: '', oid: '', avtor: 'приложение', sostoyanie: '', zapchast: '' }, o);
const okThumb = s => typeof s === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(s) && s.length > 200 && s.length <= 60000;

if (act === 'stock') {
  const hist = st.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)) || Number(b.id) - Number(a.id)).slice(0, 80).map(r => ({ date: String(r.data || ''), name: String(r.instrument), delta: Number(r.izmenenie) || 0, note: clean(r.primechanie), state: skIsPhoto(r) ? 'фото' : skPart(r) ? '' : skState(r), part: skPart(r) }));
  const kinds = skKinds(null), totals = {};
  SK_ST.forEach(x => { totals[x] = kinds.reduce((s, g) => s + g.states[x], 0); });
  return out({ ok: true, stock: kinds, history: hist, states: SK_ST, totals: totals, parts_total: kinds.reduce((s, g) => s + g.parts_qty, 0) });
}

if (act === 'stock_move') {
  const name = skCanon(skName(B.name)), delta = Math.round(Number(B.delta)), id = skOid();
  const part = B.part ? skName(B.part) : '';
  const state = part ? '' : (B.state == null || B.state === '' ? 'починен' : String(B.state));
  if (!name || !isFinite(delta) || delta === 0 || Math.abs(delta) > 100000) return out({ ok: false, error: 'неверное название или количество' });
  if (B.part && !part) return out({ ok: false, error: 'неверное название запчасти' });
  if (!part && SK_ST.indexOf(state) < 0) return out({ ok: false, error: 'неверное состояние' });
  if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
  if (skSeen(id)) return out({ ok: true, dup: true, stock: skKinds(null) });
  const g = skKinds(null).find(x => nn(x.name) === nn(name));
  const have = !g ? 0 : part ? (g.parts.find(p => nn(p.name) === nn(part)) || { qty: 0 }).qty : g.states[state];
  if (delta < 0 && have + delta < 0) return out({ ok: false, error: 'на складе столько нет' });
  const pc = part && g ? (g.parts.find(p => nn(p.name) === nn(part)) || { name: part }).name : part;
  const row = skRow({ instrument: name, izmenenie: delta, primechanie: san(B.note, 80), oid: id, sostoyanie: state, zapchast: pc });
  return out({ ok: true, stock: skKinds([row]) }, { op: 'stock_insert', rows: [row] });
}

if (act === 'stock_state') {
  const name = skCanon(skName(B.name)), qty = Math.round(Number(B.qty)), id = skOid();
  const from = String(B.from || ''), to = String(B.to || '');
  if (!name || !isFinite(qty) || qty <= 0 || qty > 100000) return out({ ok: false, error: 'неверное название или количество' });
  if (SK_ST.indexOf(from) < 0 || SK_ST.indexOf(to) < 0 || from === to) return out({ ok: false, error: 'неверное состояние' });
  if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
  if (skSeen(id)) return out({ ok: true, dup: true, stock: skKinds(null) });
  const g = skKinds(null).find(x => nn(x.name) === nn(name));
  if (!g || g.states[from] < qty) return out({ ok: false, error: 'на складе столько нет' });
  const note = san(B.note, 60), tag = from + ' → ' + to + (note ? ': ' + note : '');
  const rows = [skRow({ instrument: name, izmenenie: -qty, primechanie: tag, oid: id + '_a', sostoyanie: from }), skRow({ instrument: name, izmenenie: qty, primechanie: tag, oid: id + '_b', sostoyanie: to })];
  return out({ ok: true, stock: skKinds(rows) }, { op: 'stock_insert', rows: rows });
}

if (act === 'stock_photo') {
  const name = skCanon(skName(B.name)), id = skOid();
  if (!name) return out({ ok: false, error: 'введите название' });
  if (!okThumb(B.photo)) return out({ ok: false, error: 'фото не подходит' });
  if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
  if (skSeen(id)) return out({ ok: true, dup: true, name: name, stock: skKinds(null) });
  const row = skRow({ instrument: name, primechanie: 'фото', oid: id, sostoyanie: 'фото' });
  return out({ ok: true, name: name, stock: skKinds([row]) }, { op: 'stock_insert', rows: [row], foto_row: { instrument: name, foto: B.photo, data: row.data, oid: id } });
}

if (act === 'stock_photo_get') {
  const name = skName(B.name);
  const ph = R('Фото склада').filter(r => nn(r.instrument) === nn(name) && okThumb(r.foto)).sort((a, b) => Number(b.id) - Number(a.id))[0];
  return out({ ok: true, name: name, photo: ph ? String(ph.foto) : '', date: ph ? String(ph.data || '') : '' });
}
return out({ ok: false, error: 'неизвестное действие' });
