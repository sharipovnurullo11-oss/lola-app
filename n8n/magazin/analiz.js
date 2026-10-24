const B = $('Магазин: запрос').first().json.body || {};
const act = String(B.action || '');
const NEW = ['stats', 'minset', 'count', 'inv_list', 'inv_ok', 'inv_no'];
const inp = $input.all();
if (NEW.indexOf(act) < 0) return inp;
const ID = $('Кабинет').first().json;
const fail = e => [{ json: { resp: { ok: false, error: e } } }];
if (!ID.ok) return fail('нет доступа');
const isOwner = ID.role === 'owner';
const isKeeper = ID.role === 'staff' && ID.srole === 'kladovshchik';
if (act === 'count' ? !(isOwner || isKeeper) : !isOwner) return fail('нет доступа');
const kod = ID.kod, now = new Date().toISOString();
const all = $('Записи магазина').all().map(i => i.json).filter(r => r && r.id !== undefined && r.kabinet_kod === kod);
const r2 = x => Math.round(Number(x) * 100) / 100;
const r3 = x => Math.round(Number(x) * 1000) / 1000;
const san = (s, n) => String(s || '').replace(/[^a-zA-Z0-9а-яА-ЯёЁӣӯқғҳҷъӢӮҚҒҲҶ .,:;_()+\/-]/g, '').trim().slice(0, n);
const cod = s => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
const idc = s => String(s || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
const blank = { oid: '', kabinet_kod: kod, tip: '', kod: '', nazvanie: '', kolvo: 0, zakup: 0, marzha: 0, cena: 0, summa: 0, oplata: '', pokupatel: '', chek: '', data: now.slice(0, 10), ssylka: '', vremya: now };
const mk = o => Object.assign({}, blank, o);
const out = (resp, rows) => rows && rows.length ? rows.map(r => ({ json: { rows: 1, row: r, resp } })) : [{ json: { resp } }];
// Единица товара лежит в столбце oplata строки товара (см. узел «Решить»): метры до сантиметра, килограммы до грамма, остальное целое.
const UNITS = ['sht', 'm', 'kg', 'g', 'rulon'];
const unitOk = u => UNITS.indexOf(String(u || '')) >= 0 ? String(u) : 'sht';
const qr = (u, x) => { const f = u === 'm' ? 100 : u === 'kg' ? 1000 : 1; return Math.round(Number(x) * f) / f; };
const voided = new Set(all.filter(r => r.tip === 'void').map(r => String(r.ssylka)));
const prod = {};
all.filter(r => r.tip === 'tovar' || r.tip === 'tovar_del').sort((a, b) => String(a.vremya).localeCompare(String(b.vremya))).forEach(r => { if (r.tip === 'tovar_del') delete prod[r.kod]; else prod[r.kod] = { kod: r.kod, name: String(r.nazvanie), zakup: Number(r.zakup), marzha: Number(r.marzha), unit: unitOk(r.oplata) }; });
const stock = {};
all.forEach(r => { if (r.tip === 'prihod' || r.tip === 'korrekt') stock[r.kod] = (stock[r.kod] || 0) + Number(r.kolvo); else if (r.tip === 'prodazha' && !voided.has(String(r.chek))) stock[r.kod] = (stock[r.kod] || 0) - Number(r.kolvo); });
Object.keys(stock).forEach(k => { stock[k] = r3(stock[k]); });
const sales = all.filter(r => r.tip === 'prodazha' && !voided.has(String(r.chek)));
const done = new Set(all.filter(r => r.tip === 'pereschet_ok').map(r => String(r.ssylka)));
const pending = () => all.filter(r => r.tip === 'pereschet' && !done.has(String(r.oid)) && prod[r.kod]).sort((a, b) => String(b.vremya).localeCompare(String(a.vremya)));

if (act === 'stats') {
  const days = Math.min(365, Math.max(1, Math.round(Number(B.days)) || 30));
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const mins = {};
  all.filter(r => r.tip === 'minost').sort((a, b) => String(a.vremya).localeCompare(String(b.vremya))).forEach(r => { mins[r.kod] = Number(r.kolvo); });
  const st = {}, last = {};
  sales.forEach(r => { if (!last[r.kod] || String(r.data) > last[r.kod]) last[r.kod] = String(r.data); if (r.oplata === 'vladelec' || String(r.data) < from) return; const o = (st[r.kod] = st[r.kod] || { qty: 0, rev: 0, cost: 0 }); o.qty += Number(r.kolvo); o.rev += Number(r.summa); o.cost += Number(r.zakup) * Number(r.kolvo); });
  const ks = Object.keys(prod);
  const profit = ks.filter(k => st[k]).map(k => ({ kod: k, name: prod[k].name, unit: prod[k].unit, qty: r3(st[k].qty), rev: r2(st[k].rev), cost: r2(st[k].cost), profit: r2(st[k].rev - st[k].cost) })).sort((a, b) => b.profit - a.profit);
  const staleAll = ks.filter(k => (stock[k] || 0) > 0 && (!last[k] || last[k] < from)).map(k => ({ kod: k, name: prod[k].name, unit: prod[k].unit, qty: stock[k], frozen: r2(stock[k] * prod[k].zakup), last: last[k] || '' })).sort((a, b) => b.frozen - a.frozen);
  const order = ks.filter(k => (mins[k] || 0) > 0 && (stock[k] || 0) <= mins[k]).map(k => { const q = stock[k] || 0, perDay = st[k] ? st[k].qty / days : 0, need = Math.max(mins[k] * 2 - q, Math.ceil(perDay * 14) - q, 1); return { kod: k, name: prod[k].name, unit: prod[k].unit, qty: q, min: mins[k], suggest: Math.ceil(need) }; }).sort((a, b) => a.qty - b.qty);
  const minList = ks.filter(k => mins[k] > 0).length;
  return out({ ok: true, stats: { days, profit: profit.slice(0, 100), profitTail: profit.length > 100 ? profit.slice(-20) : [], profitN: profit.length, profitSum: r2(profit.reduce((s, x) => s + x.profit, 0)), stale: staleAll.slice(0, 100), staleN: staleAll.length, staleSum: r2(staleAll.reduce((s, x) => s + x.frozen, 0)), order: order.slice(0, 150), orderN: order.length, minN: minList } });
}

if (act === 'minset') {
  const k = cod(B.kod);
  if (!prod[k]) return fail('товар не найден');
  const m = qr(prod[k].unit, B.min);
  if (!(m >= 0 && m <= 1000000)) return fail('неверный минимум');
  const rw = [mk({ oid: ('m' + Date.now().toString(36) + k).slice(0, 40), tip: 'minost', kod: k, nazvanie: prod[k].name, kolvo: m })];
  return out({ ok: true, kod: k, min: m }, rw);
}

if (act === 'count') {
  const its = Array.isArray(B.items) ? B.items.slice(0, 100) : [], id = idc(B.id).slice(0, 14);
  if (id.length < 6) return fail('нет номера пересчёта');
  if (all.some(r => String(r.oid).indexOf('c' + id) === 0)) return out({ ok: true, saved: 0, dup: true });
  const who = san(ID.role === 'staff' ? ID.who : (B.who || 'Руководитель'), 40) || 'Кладовщик';
  const seen = {}, rw = [];
  its.forEach((it, i) => { const k = cod(it.kod); if (!prod[k] || seen[k] || it.fact === '' || it.fact == null) return; const f = qr(prod[k].unit, it.fact); if (!(f >= 0 && f <= 1000000)) return; seen[k] = 1; rw.push(mk({ oid: ('c' + id + 'n' + i).slice(0, 40), tip: 'pereschet', kod: k, nazvanie: prod[k].name, kolvo: f, summa: stock[k] || 0, zakup: prod[k].zakup, pokupatel: who })); });
  if (!rw.length) return fail('в пересчёте нет подходящих товаров');
  return out({ ok: true, saved: rw.length }, rw);
}

if (act === 'inv_list') {
  const p = pending().slice(0, 200).map(r => { const now0 = stock[r.kod] || 0, diff = r3(Number(r.kolvo) - now0); return { id: String(r.oid), kod: r.kod, name: String(r.nazvanie), unit: prod[r.kod].unit, fact: Number(r.kolvo), booked: Number(r.summa), now: now0, diff, money: r2(diff * prod[r.kod].zakup), who: String(r.pokupatel), date: String(r.data) }; });
  const short = p.filter(x => x.diff < 0), plus = p.filter(x => x.diff > 0);
  return out({ ok: true, inv: { list: p, shortPcs: r3(short.reduce((s, x) => s - x.diff, 0)), shortSum: r2(short.reduce((s, x) => s - x.money, 0)), plusPcs: r3(plus.reduce((s, x) => s + x.diff, 0)), plusSum: r2(plus.reduce((s, x) => s + x.money, 0)) } });
}

if (act === 'inv_ok' || act === 'inv_no') {
  const want = new Set((Array.isArray(B.ids) ? B.ids : []).map(x => String(x)));
  const p = pending().filter(r => B.all === true || want.has(String(r.oid))).slice(0, 100);
  if (!p.length) return fail('нечего подтверждать');
  const rw = [];
  p.forEach(r => { const delta = r3(Number(r.kolvo) - (stock[r.kod] || 0)); if (act === 'inv_ok' && delta !== 0) { rw.push(mk({ oid: ('k' + r.oid).slice(0, 40), tip: 'korrekt', kod: r.kod, nazvanie: String(r.nazvanie), kolvo: delta, zakup: prod[r.kod].zakup })); stock[r.kod] = Number(r.kolvo); } rw.push(mk({ oid: ('o' + r.oid).slice(0, 40), tip: 'pereschet_ok', kod: r.kod, ssylka: String(r.oid), oplata: act === 'inv_ok' ? 'ok' : 'no' })); });
  return out({ ok: true, applied: p.length }, rw);
}
return fail('неизвестное действие');
