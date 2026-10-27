// Заводские штрихкоды товаров (магазин Шамсуло, №348–349). У товара короткий код магазина (015, 016…), а сканер читает длинный заводской код —
// поэтому к товару привязываются его заводские штрихкоды (один или несколько). Строки журнала: tip 'shtrih' (kod — товар, ssylka — штрихкод)
// и 'shtrih_del' (отвязать). Привязка приходит вместе с обычным 'list' (bind_barcode: { kod, code, id }) — так проверка доступа «Кабинета» не меняется;
// привязывать может руководитель и кладовщик, продавец — нет. К каждому товару в ответе добавляется bar: [штрихкоды].
const items = $input.all();
const B = $('Магазин: запрос').first().json.body || {};
const ID = $('Кабинет').first().json;
const first = items[0] && items[0].json;
if (!ID.ok || !first || !first.resp || !first.resp.ok || !Array.isArray(first.resp.products)) return items;
const all = $('Записи магазина').all().map(i => i.json).filter(r => r && r.id !== undefined && r.kabinet_kod === ID.kod);
const bc = s => String(s == null ? '' : s).trim().replace(/[^a-zA-Z0-9_.\-\/+]/g, '').slice(0, 64);
const cod = s => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
const idc = s => String(s || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
// штрихкод → товар (последняя запись главная)
const owner = {};
all.filter(r => r.tip === 'shtrih' || r.tip === 'shtrih_del').sort((a, b) => String(a.vremya).localeCompare(String(b.vremya)) || Number(a.id) - Number(b.id)).forEach(r => {
  const c = bc(r.ssylka); if (!c) return;
  if (r.tip === 'shtrih_del') { if (owner[c] === String(r.kod)) delete owner[c]; } else owner[c] = String(r.kod);
});
const attach = resp => { const by = {}; Object.keys(owner).forEach(c => { (by[owner[c]] = by[owner[c]] || []).push(c); }); resp.products = resp.products.map(p => Object.assign({}, p, { bar: (by[p.kod] || []).sort() })); return resp; };
const job = B.bind_barcode || B.unbind_barcode;
if (String(B.action || 'list') !== 'list' || !job || typeof job !== 'object') {
  items.forEach(it => { const r = it.json.resp; if (r && r.ok && Array.isArray(r.products)) attach(r); });
  return items;
}
const resp = first.resp;
const err = e => [{ json: { resp: Object.assign({}, resp, { ok: false, error: e }) } }];
if (!(ID.role === 'owner' || (ID.role === 'staff' && ID.srole === 'kladovshchik'))) return err('привязать штрихкод может кладовщик или руководитель');
const k = cod(job.kod), c = bc(job.code), id = idc(job.id);
if (!resp.products.some(p => p.kod === k)) return err('товар не найден');
if (c.length < 4) return err('штрихкод слишком короткий');
if (id.length < 6) return err('нет номера записи');
if (resp.products.some(p => p.kod === c && p.kod !== k)) return err('этот код уже код другого товара: ' + c);
const unbind = !!B.unbind_barcode;
if (all.some(r => String(r.oid) === id)) return [{ json: { resp: attach(resp) } }];
if (unbind ? owner[c] !== k : owner[c] === k) return [{ json: { resp: attach(resp) } }];
if (!unbind && owner[c]) { const o = resp.products.find(p => p.kod === owner[c]); return err('штрихкод уже привязан к товару «' + (o ? o.name : owner[c]) + '». Сначала отвяжите его там.'); }
const now = new Date().toISOString();
const row = { oid: id, kabinet_kod: ID.kod, tip: unbind ? 'shtrih_del' : 'shtrih', kod: k, nazvanie: '', kolvo: 0, zakup: 0, marzha: 0, cena: 0, summa: 0, oplata: '', pokupatel: String(ID.who || (ID.role === 'owner' ? 'Руководитель' : '')).slice(0, 40), chek: '', data: now.slice(0, 10), ssylka: c, vremya: now };
if (unbind) delete owner[c]; else owner[c] = k;
return [{ json: { rows: 1, row: row, resp: attach(resp) } }];
