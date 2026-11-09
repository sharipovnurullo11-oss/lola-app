const B = $('Объекты: запрос').first().json.body || {};
const K = $('Кабинет').first().json;
const out = (resp, rows) => [{ json: { resp: resp, rows: rows || [] } }];
const bad = t => out({ ok: false, error: t });
if (!K.ok) return bad('нет доступа');
const kod = K.kod;
const all = $('Записи объектов').all().map(i => i.json).filter(r => r && r.id !== undefined).sort((a, b) => a.id - b.id);
const act = String(B.action || 'list');
const STAT = { master: 'Мастера', material: 'Материалы', doroga: 'Дорога', tehnika: 'Техника', prochee: 'Прочее' };
const r2 = x => Math.round(Number(x) * 100) / 100;
const num = x => { const n = Number(String(x == null ? '' : x).replace(',', '.').replace(/ /g, '')); return String(x == null ? '' : x).trim() === '' ? NaN : (isFinite(n) ? r2(n) : NaN); };
const txt = (x, n) => String(x == null ? '' : x).trim().slice(0, n);
const msk = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const when = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(B.date || '')) ? String(B.date) : msk;

// Отменённые записи не считаем (запись «void» ссылается на oid отменяемой).
const voided = {};
all.forEach(r => { if (r.tip === 'void') voided[String(r.ssylka)] = 1; });
const live = all.filter(r => r.tip !== 'void' && !voided[String(r.oid)]);

// Точки: приход (от заказчика) и расход по каждой точке отдельно; деньги аптеки сюда не попадают (другая таблица).
const P = {};
const pt = n => P[n] || (P[n] = { name: n, zakazchik: '', dogovor: null, inn: 0, out: 0, by: {}, M: {} });
const mm = (p, name) => p.M[name] || (p.M[name] = { name: name, dogovor: null, paid: 0 });
live.forEach(r => {
  const n = String(r.tochka || ''), s = Number(r.summa) || 0;
  if (r.tip === 'tochka') { const p = pt(n); if (r.zakazchik) p.zakazchik = String(r.zakazchik); if (s > 0) p.dogovor = s; }
  else if (r.tip === 'dogovor') { pt(n).dogovor = s > 0 ? s : null; }
  else if (r.tip === 'prihod') { const p = pt(n); p.inn += s; if (r.zakazchik && !p.zakazchik) p.zakazchik = String(r.zakazchik); }
  else if (r.tip === 'rashod') { const p = pt(n); p.out += s; p.by[r.statya] = (p.by[r.statya] || 0) + s; if (r.statya === 'master' && r.master) mm(p, String(r.master)).paid += s; }
  else if (r.tip === 'master_dogovor') { mm(pt(n), String(r.master)).dogovor = s > 0 ? s : null; }
});
const U = P[''] || null; delete P[''];
const names = Object.keys(P).sort((a, b) => a.localeCompare(b, 'ru'));

const mview = m => ({ name: m.name, dogovor: m.dogovor, paid: r2(m.paid), left: m.dogovor == null ? null : r2(Math.max(0, m.dogovor - m.paid)) });
const pview = (p, full) => {
  const ms = Object.keys(p.M).sort().map(k => mview(p.M[k]));
  const v = { name: p.name, zakazchik: p.zakazchik, dogovor: p.dogovor, inn: r2(p.inn), out: r2(p.out), left: r2(p.inn - p.out), owes: p.dogovor == null ? null : r2(Math.max(0, p.dogovor - p.inn)), mastersOwe: r2(ms.reduce((s, m) => s + (m.left || 0), 0)) };
  if (full) { v.by = {}; Object.keys(p.by).forEach(k => { v.by[k] = r2(p.by[k]); }); v.masters = ms; }
  return v;
};
const ent = r => ({ oid: r.oid, tip: r.tip, tochka: r.tochka || '', data: r.data, statya: r.statya, summa: Number(r.summa), master: r.master, komment: r.komment });
const recent = (name, cap) => live.filter(r => (r.tip === 'prihod' || r.tip === 'rashod') && (name === undefined || String(r.tochka || '') === name)).slice(-(cap || 40)).reverse().map(ent);

// ---------- чтение ----------
if (act === 'list') {
  const list = names.map(n => pview(P[n], false));
  const unOut = U ? r2(U.out) : 0;
  const total = { inn: r2(list.reduce((s, p) => s + p.inn, 0)), out: r2(list.reduce((s, p) => s + p.out, 0) + unOut), customersOwe: r2(list.reduce((s, p) => s + (p.owes || 0), 0)), mastersOwe: r2(list.reduce((s, p) => s + p.mastersOwe, 0)), unassigned: unOut };
  total.left = r2(total.inn - total.out);
  return out({ ok: true, role: 'owner', points: list, total: total, unassigned: U ? recent('') : [], recent: recent().slice(0, 15) });
}
if (act === 'point') {
  const n = txt(B.name, 60);
  if (!P[n]) return bad('нет такой точки');
  return out({ ok: true, point: Object.assign(pview(P[n], true), { entries: recent(n, 500) }) });
}
if (act === 'lich_list') {
  // Личные деньги Асрора: отдельный вид строк «lichnoe». В точки и их итоги не попадают.
  const L = live.filter(r => r.tip === 'lichnoe');
  const sumBy = st => r2(L.filter(r => r.statya === st).reduce((s, r) => s + (Number(r.summa) || 0), 0));
  const inn = sumBy('prihod'), outv = sumBy('rashod');
  return out({ ok: true, inn: inn, out: outv, left: r2(inn - outv), entries: L.slice(-100).reverse().map(r => ({ oid: r.oid, kind: r.statya === 'prihod' ? 'in' : 'out', data: r.data, summa: Number(r.summa), komment: r.komment || '' })) });
}

// ---------- запись (только добавление; ошибку исправляет отмена «void») ----------
const oid = txt(B.oid, 40);
const base = () => ({ kabinet_kod: kod, tip: '', oid: '', tochka: '', data: when, statya: '', summa: 0, master: '', zakazchik: '', komment: txt(B.note, 200), ssylka: '', avtor: '' });
const wr = rows => all.some(r => r.oid === rows[0].oid) ? out({ ok: true, dup: true }) : out({ ok: true }, rows);
const known = ['add_point', 'dogovor', 'in', 'out', 'master_set', 'void', 'assign', 'lich_add'];
if (known.indexOf(act) < 0) return bad('неизвестное действие');
if (!oid) return bad('нет номера записи');
const tochka = txt(B.tochka, 60);

if (act === 'add_point') {
  const n = txt(B.name, 60);
  if (!n) return bad('введите название точки');
  if (P[n]) return bad('такая точка уже есть');
  const d = (B.dogovor == null || B.dogovor === '') ? 0 : num(B.dogovor);
  if (isNaN(d) || d < 0) return bad('неверная сумма договора');
  const r = base(); r.tip = 'tochka'; r.oid = oid; r.tochka = n; r.zakazchik = txt(B.zakazchik, 60); r.summa = d;
  return wr([r]);
}
if (act === 'dogovor') {
  if (!P[tochka]) return bad('нет такой точки');
  const d = num(B.amount);
  if (isNaN(d) || d < 0) return bad('неверная сумма');
  const r = base(); r.tip = 'dogovor'; r.oid = oid; r.tochka = tochka; r.summa = d;
  return wr([r]);
}
if (act === 'in') {
  if (!P[tochka]) return bad('выберите точку');
  const s = num(B.amount);
  if (isNaN(s) || s <= 0 || s > 1000000000) return bad('неверная сумма');
  const r = base(); r.tip = 'prihod'; r.oid = oid; r.tochka = tochka; r.summa = s; r.zakazchik = txt(B.zakazchik, 60);
  return wr([r]);
}
if (act === 'out') {
  const st = String(B.statya || '');
  if (!STAT[st]) return bad('выберите статью расхода');
  const master = txt(B.master, 60);
  if (st === 'master' && !master) return bad('укажите мастера');
  const parts = Array.isArray(B.parts) && B.parts.length ? B.parts.slice(0, 12) : [{ tochka: tochka, amount: B.amount }];
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const t = txt(parts[i].tochka, 60), s = num(parts[i].amount);
    if (t && !P[t]) return bad('нет такой точки');
    if (isNaN(s) || s <= 0 || s > 1000000000) return bad('неверная сумма');
    const r = base(); r.tip = 'rashod'; r.oid = parts.length > 1 ? oid + '-' + (i + 1) : oid; r.tochka = t; r.statya = st; r.summa = s; r.master = st === 'master' ? master : '';
    rows.push(r);
  }
  return wr(rows);
}
if (act === 'master_set') {
  if (!P[tochka]) return bad('нет такой точки');
  const master = txt(B.master, 60), d = num(B.amount);
  if (!master) return bad('укажите мастера');
  if (isNaN(d) || d < 0) return bad('неверная сумма');
  const r = base(); r.tip = 'master_dogovor'; r.oid = oid; r.tochka = tochka; r.master = master; r.summa = d;
  return wr([r]);
}
if (act === 'lich_add') {
  const kind = String(B.kind || '');
  if (kind !== 'in' && kind !== 'out') return bad('выберите приход или расход');
  const s = num(B.amount);
  if (isNaN(s) || s <= 0 || s > 1000000000) return bad('неверная сумма');
  const r = base(); r.tip = 'lichnoe'; r.oid = oid; r.statya = kind === 'in' ? 'prihod' : 'rashod'; r.summa = s;
  return wr([r]);
}
if (act === 'void') {
  const target = txt(B.target, 60);
  const t = live.find(r => r.oid === target && (r.tip === 'prihod' || r.tip === 'rashod' || r.tip === 'lichnoe'));
  if (!t) return bad('запись не найдена');
  const r = base(); r.tip = 'void'; r.oid = oid; r.ssylka = target; r.tochka = String(t.tochka || ''); r.summa = Number(t.summa) || 0;
  return wr([r]);
}
if (act === 'assign') {
  // «Не распределено» → по точкам: старая запись отменяется, вместо неё новые на ту же сумму.
  const target = txt(B.target, 60);
  const t = live.find(r => r.oid === target && r.tip === 'rashod' && !String(r.tochka || ''));
  if (!t) return bad('запись не найдена');
  const parts = Array.isArray(B.parts) ? B.parts.slice(0, 12) : [];
  if (!parts.length) return bad('выберите точку');
  let sum = 0;
  const rows = [];
  const v = base(); v.tip = 'void'; v.oid = oid; v.ssylka = target; v.summa = Number(t.summa) || 0; rows.push(v);
  for (let i = 0; i < parts.length; i++) {
    const n = txt(parts[i].tochka, 60), s = num(parts[i].amount);
    if (!P[n]) return bad('нет такой точки');
    if (isNaN(s) || s <= 0) return bad('неверная сумма');
    sum = r2(sum + s);
    const r = base(); r.tip = 'rashod'; r.oid = oid + '-' + (i + 1); r.tochka = n; r.statya = t.statya; r.summa = s; r.master = t.master || ''; r.komment = t.komment || ''; r.data = t.data || when;
    rows.push(r);
  }
  if (sum !== r2(Number(t.summa))) return bad('сумма по точкам должна быть ' + r2(Number(t.summa)));
  return wr(rows);
}
return bad('неизвестное действие');
