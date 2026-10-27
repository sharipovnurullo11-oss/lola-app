const B = $('Магазин: запрос').first().json.body || {};
const ID = $('Кабинет').first().json;
const R = $('Записи магазина').all().map(i => i.json).filter(r => r && r.id !== undefined);
const fail = e => [{ json: { resp: { ok: false, error: e } } }];
if (!ID.ok) return fail('нет доступа');
const kod = ID.kod, now = new Date().toISOString();
const all = R.filter(r => r.kabinet_kod === kod);
if (all.length >= 50000 && String(B.action || 'list') !== 'list') return fail('слишком много записей');
const r2 = x => Math.round(Number(x) * 100) / 100;
const r3 = x => Math.round(Number(x) * 1000) / 1000;
const san = (s, n) => String(s || '').replace(/[^a-zA-Z0-9а-яА-ЯёЁӣӯқғҳҷъӢӮҚҒҲҶ .,:;_()+\/-]/g, '').trim().slice(0, n);
const cod = s => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
const idc = s => String(s || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2020-01-01' && d < '2100-01-01' && !isNaN(Date.parse(d));
const okFoto = f => typeof f === 'string' && f.length <= 20000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(f);
const blank = { oid: '', kabinet_kod: kod, tip: '', kod: '', nazvanie: '', kolvo: 0, zakup: 0, marzha: 0, cena: 0, summa: 0, oplata: '', pokupatel: '', chek: '', data: now.slice(0, 10), ssylka: '', vremya: now };
const mk = o => Object.assign({}, blank, o);
const PAYS = ['nal', 'perevod', 'alif', 'dushanbe', 'mix', 'dolg', 'vladelec'];
const PARTS = ['nal', 'alif', 'dushanbe', 'perevod'];
// Единицы измерения товара (24.10.2026, магазин Шамсуло): штуки, метры (до сантиметра), килограммы (до грамма), граммы, рулоны.
// В строке товара (tip=tovar) единица лежит в столбце oplata, а «сколько единиц в одной штуке» (труба 4 м, рулон 25 м) — в столбце summa.
// Цена продажи, заданная вручную (24.10.2026), лежит в столбце cena строки товара; 0 — цену считаем из закупки и маржи.
const UNITS = ['sht', 'm', 'kg', 'g', 'rulon'];
const unitOk = u => UNITS.indexOf(String(u || '')) >= 0 ? String(u) : 'sht';
const qr = (u, x) => { const f = u === 'm' ? 100 : u === 'kg' ? 1000 : 1; return Math.round(Number(x) * f) / f; };
const prodOf = r => { const u = unitOk(r.oplata), per = Number(r.summa) > 0 && u !== 'sht' ? qr(u, r.summa) : 0; return { kod: r.kod, name: String(r.nazvanie), zakup: Number(r.zakup), marzha: Number(r.marzha), unit: u, per, sell: Number(r.cena) > 0 ? r2(r.cena) : 0 }; };
// строка товара с теми же единицей, «в штуке» и фото, если их не меняют
const tovRow = (p, o) => mk(Object.assign({ tip: 'tovar', kod: p.kod, nazvanie: p.name, zakup: p.zakup, marzha: p.marzha, oplata: p.unit, summa: p.per, cena: p.sell, ssylka: fotoOf[p.kod] || '' }, o));

// ---- состояние из журнала ----
const voided = new Set(all.filter(r => r.tip === 'void').map(r => String(r.ssylka)));
const prod = {}, fotoOf = {};
all.filter(r => r.tip === 'tovar' || r.tip === 'tovar_del').sort((a, b) => String(a.vremya).localeCompare(String(b.vremya))).forEach(r => {
  if (r.tip === 'tovar_del') { delete prod[r.kod]; delete fotoOf[r.kod]; } else { prod[r.kod] = prodOf(r); if (r.ssylka) fotoOf[r.kod] = String(r.ssylka); }
});
const stock = {};
all.forEach(r => {
  if (r.tip === 'prihod' || r.tip === 'korrekt') stock[r.kod] = (stock[r.kod] || 0) + Number(r.kolvo);
  else if (r.tip === 'prodazha' && !voided.has(String(r.chek))) stock[r.kod] = (stock[r.kod] || 0) - Number(r.kolvo);
});
const priceOf = p => p.sell > 0 ? p.sell : r2(p.zakup * (1 + p.marzha / 100));
const products = () => Object.keys(prod).sort().map(k => ({ kod: k, name: prod[k].name, zakup: prod[k].zakup, marzha: prod[k].marzha, price: priceOf(prod[k]), qty: r3(stock[k] || 0), unit: prod[k].unit, per: prod[k].per, sell: prod[k].sell, foto: fotoOf[k] ? 1 : 0 }));
const sales = all.filter(r => r.tip === 'prodazha' && !voided.has(String(r.chek)));
const pays = all.filter(r => r.tip === 'oplata' && !voided.has(String(r.oid)));
const chastOf = () => { const m = {}; all.filter(r => r.tip === 'chast' && !voided.has(String(r.chek))).forEach(r => { (m[String(r.chek)] = m[String(r.chek)] || []).push(r); }); return m; };
// деньги по способам оплаты для набора строк продаж (смешанная оплата раскладывается по частям, чек считается один раз)
const payBreak = rows => { const cb = chastOf(), by = {}, seen = new Set(); const add = (m, s) => { by[m] = r2((by[m] || 0) + Number(s)); }; rows.forEach(r => { if (r.oplata === 'mix') { if (seen.has(String(r.chek))) return; seen.add(String(r.chek)); (cb[String(r.chek)] || []).forEach(c => add(c.oplata, c.summa)); } else add(r.oplata, r.summa); }); return by; };
const debts = () => {
  const m = {};
  const get = (name, d) => (m[name.toLowerCase()] = m[name.toLowerCase()] || { name, sum: 0, since: d, owner: name === 'Владелец' });
  sales.filter(r => r.oplata === 'dolg' || r.oplata === 'vladelec').forEach(r => { const c = get(String(r.pokupatel), r.data); c.sum += Number(r.summa); if (String(r.data) < c.since) c.since = String(r.data); });
  pays.forEach(r => { const c = get(String(r.pokupatel), r.data); c.sum -= Number(r.summa); });
  return Object.keys(m).map(k => ({ name: m[k].name, sum: r2(m[k].sum), since: m[k].since, owner: m[k].owner })).filter(c => c.sum > 0.004).sort((a, b) => String(a.since).localeCompare(String(b.since)));
};
const debtOf = name => { const d = debts().filter(c => c.name.toLowerCase() === String(name).toLowerCase())[0]; return d ? d.sum : 0; };
const view = month => {
  const ms = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : now.slice(0, 7);
  const inM = r => String(r.data).startsWith(ms);
  const real = sales.filter(r => inM(r) && r.oplata !== 'vladelec');
  const rev = r2(real.reduce((s, r) => s + Number(r.summa), 0));
  const profit = r2(real.reduce((s, r) => s + (Number(r.cena) - Number(r.zakup)) * Number(r.kolvo), 0));
  const owner = r2(sales.filter(r => inM(r) && r.oplata === 'vladelec').reduce((s, r) => s + Number(r.summa), 0));
  const byDay = {}; real.forEach(r => { byDay[r.data] = r2((byDay[r.data] || 0) + Number(r.summa)); });
  const checks = {};
  sales.filter(inM).forEach(r => { const c = (checks[r.chek] = checks[r.chek] || { id: String(r.chek), date: String(r.data), ts: Date.parse(r.vremya) || 0, pay: r.oplata, who: String(r.pokupatel), total: 0, lines: [] }); c.total = r2(c.total + Number(r.summa)); c.lines.push({ kod: r.kod, name: String(r.nazvanie), qty: Number(r.kolvo), price: Number(r.cena) }); });
  const cb = chastOf();
  const list = Object.keys(checks).map(k => checks[k]).sort((a, b) => b.ts - a.ts).slice(0, 40);
  list.forEach(c => { if (c.pay === 'mix') c.parts = (cb[c.id] || []).map(p => ({ pay: p.oplata, sum: Number(p.summa) })); });
  const low = products().filter(p => p.qty <= 2).map(p => ({ kod: p.kod, name: p.name, qty: p.qty, unit: p.unit }));
  const exps = all.filter(r => r.tip === 'rashod' && inM(r) && !voided.has(String(r.oid)));
  const expBy = {}; exps.forEach(r => { const n = String(r.pokupatel || '—'); expBy[n] = r2((expBy[n] || 0) + Number(r.summa)); });
  const expList = exps.slice().sort((a, b) => String(b.vremya).localeCompare(String(a.vremya))).slice(0, 30).map(r => ({ id: String(r.oid), date: String(r.data), who: String(r.pokupatel), note: String(r.nazvanie), sum: Number(r.summa) }));
  const payBy = payBreak(real);
  const td = now.slice(0, 10);
  const payToday = payBreak(real.filter(r => String(r.data) === td));
  // Сдача кассы: разбивка смены по способам оплаты лежит в ssylka (JSON), подтверждение руководителя — строкой sdacha_ok (ssylka = номер сдачи).
  const sdOk = {}; all.filter(r => r.tip === 'sdacha_ok').forEach(r => { sdOk[String(r.ssylka)] = String(r.data); });
  const byOf = s => { try { const o = JSON.parse(String(s || '')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  const sdachi = all.filter(r => r.tip === 'sdacha' && inM(r)).sort((a, b) => String(b.vremya).localeCompare(String(a.vremya))).slice(0, 30).map(r => ({ id: String(r.oid), date: String(r.data), who: String(r.pokupatel), fact: Number(r.summa), exp: Number(r.cena), diff: Number(r.kolvo), by: byOf(r.ssylka), ok: sdOk[String(r.oid)] || '' }));
  // Внесение и изъятие наличных в смене (tip 'kassa', oplata 'in' / 'out'): в отчёте отдельно, чтобы изъятие не выглядело недостачей.
  const kassa = all.filter(r => r.tip === 'kassa' && inM(r) && !voided.has(String(r.oid))).sort((a, b) => String(b.vremya).localeCompare(String(a.vremya))).slice(0, 30).map(r => ({ id: String(r.oid), date: String(r.data), who: String(r.pokupatel), kind: String(r.oplata), sum: Number(r.summa), note: String(r.nazvanie) }));
  return { month: ms, revenue: rev, profit, owner, debt: r2(debts().reduce((s, c) => s + c.sum, 0)), byDay, checks: list, low, expenses: r2(exps.reduce((s, r) => s + Number(r.summa), 0)), expBy, expList, payBy, payToday, sdachi, kassa };
};
const respond = (extra) => ({ ok: true, products: products(), debts: debts(), report: view(B.month) });
const out = (resp, rowsArr) => rowsArr && rowsArr.length ? rowsArr.map(r => ({ json: { rows: 1, row: r, resp } })) : [{ json: { resp } }];
// после записи состояние пересчитывается с новыми строками
const withRows = (rowsArr) => { all.push.apply(all, rowsArr); rowsArr.forEach(r => { if (r.tip === 'tovar') { prod[r.kod] = prodOf(r); if (r.ssylka) fotoOf[r.kod] = String(r.ssylka); } else if (r.tip === 'tovar_del') { delete prod[r.kod]; delete fotoOf[r.kod]; } else if (r.tip === 'prihod' || r.tip === 'korrekt') stock[r.kod] = (stock[r.kod] || 0) + Number(r.kolvo); else if (r.tip === 'prodazha') { sales.push(r); stock[r.kod] = (stock[r.kod] || 0) - Number(r.kolvo); } else if (r.tip === 'oplata') pays.push(r); else if (r.tip === 'void') { const v = String(r.ssylka); voided.add(v); for (let i = sales.length - 1; i >= 0; i--) if (String(sales[i].chek) === v) { stock[sales[i].kod] = (stock[sales[i].kod] || 0) + Number(sales[i].kolvo); sales.splice(i, 1); } for (let i = pays.length - 1; i >= 0; i--) if (String(pays[i].oid) === v) pays.splice(i, 1); } }); };
const act = String(B.action || 'list');

if (act === 'list') return out(respond());

if (act === 'foto_get') {
  const k = cod(B.kod);
  return out({ ok: true, kod: k, foto: fotoOf[k] || '' });
}

// Поиск товара по фото (24.10.2026): касса не нашла код — продавец фотографирует товар, ИИ сравнивает снимок со списком товаров.
// Здесь только проверка и подготовка; сам запрос к ИИ и ответ — в узлах «ИИ: товар по фото» и «Ответ по фото».
if (act === 'find_photo') {
  const f = B.foto;
  if (!(typeof f === 'string' && f.length <= 700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(f))) return fail('фото не подошло, снимите ещё раз');
  const list = products();
  if (!list.length) return fail('товаров пока нет');
  const cat = list.slice(0, 1500).map(p => ({ kod: p.kod, name: p.name, price: p.price, qty: p.qty, unit: p.unit, per: p.per, foto: p.foto }));
  return [{ json: { resp: { ok: true }, vision: { foto: f, catalog: cat.map(p => p.kod + ' — ' + p.name).join('\n'), items: cat } } }];
}

if (act === 'foto') {
  const k = cod(B.kod), f = B.foto;
  if (!prod[k]) return fail('товар не найден');
  if (!okFoto(f)) return fail('фото не подошло, снимите ещё раз');
  const rw = [tovRow(prod[k], { oid: ('f' + Date.now().toString(36) + k).slice(0, 40), ssylka: f })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'product') {
  const p = B.p || {}, k = cod(p.kod), name = san(p.name, 60), z = r2(p.zakup), m = r2(p.marzha);
  if (!k) return fail('нужен код товара (буквы и цифры)');
  if (ID.role === 'staff' && prod[k]) return fail('товар уже есть — цену меняет руководитель, а приход оформляйте вкладкой «Приём товара»');
  if (!name) return fail('нужно название товара');
  if (!(z > 0 && z <= 1000000000)) return fail('закупочная цена должна быть больше нуля');
  // цена продажи: если не прислали — остаётся прежняя; 0 или пусто — считаем из закупки и маржи
  const sell = p.sell === undefined ? (prod[k] ? prod[k].sell : 0) : (p.sell === '' || p.sell === null || Number(p.sell) === 0 ? 0 : r2(p.sell));
  if (!(sell >= 0 && sell <= 1000000000)) return fail('неверная цена продажи');
  if (!sell && !(m >= 0 && m <= 1000)) return fail('маржа от 0 до 1000 процентов');
  // единица: если не прислали — остаётся прежняя (или «штуки» у нового товара)
  const u = p.unit === undefined && prod[k] ? prod[k].unit : unitOk(p.unit);
  if (p.unit !== undefined && UNITS.indexOf(String(p.unit)) < 0) return fail('неверная единица измерения');
  let per = p.per === undefined && prod[k] && prod[k].unit === u ? prod[k].per : (Number(p.per) > 0 ? qr(u, p.per) : 0);
  if (u === 'sht') per = 0;
  if (!(per >= 0 && per <= 100000)) return fail('неверное количество в одной штуке');
  const f = okFoto(p.foto) ? p.foto : (fotoOf[k] || '');
  // при заданной цене маржа — для справки: сколько процентов цена выше закупки
  const rw = [mk({ oid: ('t' + Date.now().toString(36) + k).slice(0, 40), tip: 'tovar', kod: k, nazvanie: name, zakup: z, marzha: sell ? r2((sell / z - 1) * 100) : m, oplata: u, summa: per, cena: sell, ssylka: f })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'product_del') {
  const k = cod(B.kod);
  if (!prod[k]) return fail('товар не найден');
  const rw = [mk({ oid: ('d' + Date.now().toString(36) + k).slice(0, 40), tip: 'tovar_del', kod: k })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'receive') {
  const k = cod(B.kod), id = idc(B.id);
  if (!prod[k]) return fail('товар с таким кодом не найден');
  const q = qr(prod[k].unit, B.qty);
  if (!(q !== 0 && Math.abs(q) <= 1000000)) return fail('неверное количество');
  if (id.length < 6) return fail('нет номера записи');
  if (all.some(r => String(r.oid) === id)) return out(respond());
  const rw = [mk({ oid: id, tip: B.fix ? 'korrekt' : 'prihod', kod: k, nazvanie: prod[k].name, kolvo: q, zakup: prod[k].zakup })];
  const z = r2(B.zakup);
  if (!B.fix && z > 0 && z !== prod[k].zakup) rw.push(tovRow(prod[k], { oid: ('t' + id).slice(0, 40), zakup: z, marzha: prod[k].sell ? r2((prod[k].sell / z - 1) * 100) : prod[k].marzha }));
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'sell') {
  const chek = idc(B.id), items = Array.isArray(B.items) ? B.items.slice(0, 60) : [], pay = String(B.pay || '');
  const date = String(B.date || '');
  if (chek.length < 6) return fail('нет номера продажи');
  if (!items.length) return fail('чек пустой');
  if (PAYS.indexOf(pay) < 0) return fail('выберите способ оплаты');
  if (!okDate(date)) return fail('неверная дата');
  if (sales.some(r => String(r.chek) === chek) || voided.has(chek)) return out(respond());
  const who = pay === 'vladelec' ? 'Владелец' : san(B.who, 40);
  if (pay === 'dolg' && !who) return fail('для долга укажите, кто покупатель');
  if (pay === 'dolg' && who.toLowerCase() === 'владелец') return fail('для владельца выберите «Взял владелец»');
  const need = {};
  for (const it of items) { const k = cod(it.kod); if (!prod[k]) return fail('товара с кодом ' + san(it.kod, 20) + ' нет'); const q = qr(prod[k].unit, it.qty); if (!(q > 0 && q <= 100000)) return fail('неверное количество'); need[k] = qr(prod[k].unit, (need[k] || 0) + q); }
  // Нехватка остатка не блокирует продажу: продавец получает предупреждение (warn), кладовщику нужно оформить приём.
  const warn = Object.keys(need).filter(k => r3(stock[k] || 0) < need[k]).map(k => ({ kod: k, name: prod[k].name, have: r3(stock[k] || 0), need: need[k], unit: prod[k].unit }));
  const rw = Object.keys(need).map((k, i) => { const p = prod[k], cena = pay === 'vladelec' ? p.zakup : priceOf(p); return mk({ oid: (chek + 'l' + i).slice(0, 40), tip: 'prodazha', kod: k, nazvanie: p.name, kolvo: need[k], zakup: p.zakup, marzha: p.marzha, cena, summa: r2(cena * need[k]), oplata: pay, pokupatel: who, chek, data: date }); });
  if (pay === 'mix') {
    // Смешанная оплата: части по способам (наличные / Алиф / Душанбе Сити / перевод), сумма частей = сумме чека. Долг в смешанной оплате не допускается.
    const total = r2(rw.reduce((s, r) => s + Number(r.summa), 0));
    const parts = (Array.isArray(B.parts) ? B.parts : []).slice(0, 6).map(p => ({ pay: String(p.pay || ''), sum: r2(p.sum) })).filter(p => p.sum > 0);
    if (parts.length < 2) return fail('для смешанной оплаты укажите минимум две части');
    if (parts.some(p => PARTS.indexOf(p.pay) < 0)) return fail('неверный способ в части оплаты');
    if (Math.abs(r2(parts.reduce((s, p) => s + p.sum, 0)) - total) > 0.011) return fail('сумма частей оплаты должна быть равна итогу чека: ' + total);
    parts.forEach((p, i) => rw.push(mk({ oid: (chek + 'p' + i).slice(0, 40), tip: 'chast', chek, oplata: p.pay, summa: p.sum, data: date })));
  }
  withRows(rw);
  const rs = respond();
  if (warn.length) rs.warn = warn;
  return out(rs, rw);
}

if (act === 'sdacha') {
  // Сдача кассы (закрытие смены): продавец вслепую вводит фактические наличные, программа считает, сколько должно быть: наличные продажи (включая наличную часть смешанной оплаты) минус личные расходы с момента прошлой сдачи этого сотрудника.
  const who = ID.role === 'staff' ? san(ID.who, 40) : 'Руководитель';
  const id = idc(B.id), fact = r2(B.fact), date = String(B.date || '');
  if (id.length < 6) return fail('нет номера записи');
  if (!(fact >= 0 && fact <= 1000000000) || B.fact === '' || B.fact == null) return fail('введите сумму наличных в кассе');
  if (!okDate(date)) return fail('неверная дата');
  const dup = all.find(r => r.tip === 'sdacha' && String(r.oid) === id);
  if (dup) return out(Object.assign(respond(), { sdacha: { expected: Number(dup.cena), fact: Number(dup.summa), diff: Number(dup.kolvo), dup: true } }));
  const mySeller = ID.role === 'staff' ? String(ID.who) : '';
  const lastS = all.filter(r => r.tip === 'sdacha' && String(r.pokupatel) === who).sort((a, b) => String(b.vremya).localeCompare(String(a.vremya)))[0];
  const since = lastS ? String(lastS.vremya) : '';
  const mine = sales.filter(r => r.oplata !== 'vladelec' && String(r.ssylka || '') === mySeller && String(r.vremya) > since);
  const cash = payBreak(mine).nal || 0;
  const spent = r2(all.filter(r => r.tip === 'rashod' && !voided.has(String(r.oid)) && String(r.pokupatel) === who && String(r.vremya) > since).reduce((s, r) => s + Number(r.summa), 0));
  // Внёс в кассу (размен) — наличных больше, взял из кассы (руководитель забрал) — меньше.
  const ops = all.filter(r => r.tip === 'kassa' && !voided.has(String(r.oid)) && String(r.pokupatel) === who && String(r.vremya) > since);
  const vnes = r2(ops.filter(r => r.oplata === 'in').reduce((s, r) => s + Number(r.summa), 0)), vzyal = r2(ops.filter(r => r.oplata === 'out').reduce((s, r) => s + Number(r.summa), 0));
  const expected = r2(cash - spent + vnes - vzyal), diff = r2(fact - expected);
  // Итог смены по способам оплаты (наличные, Алиф, Душанбе Сити, перевод, в долг): сверяются только наличные, остальное — для отчёта хозяину.
  const by = payBreak(mine);
  const rw = [mk({ oid: id, tip: 'sdacha', pokupatel: who, summa: fact, cena: expected, kolvo: diff, data: date, ssylka: JSON.stringify(by) })];
  withRows(rw);
  return out(Object.assign(respond(), { sdacha: { expected, fact, diff, cash: r2(cash), spent, vnes, vzyal, by } }), rw);
}

if (act === 'sdacha_ok') {
  // Подтверждение смены руководителем: отмечает сдачу кассы как проверенную.
  if (ID.role !== 'owner') return fail('подтверждает руководитель');
  const sid = idc(B.sdacha), id = idc(B.id);
  if (id.length < 6) return fail('нет номера записи');
  if (!all.some(r => r.tip === 'sdacha' && String(r.oid) === sid)) return fail('сдача кассы не найдена');
  if (all.some(r => r.tip === 'sdacha_ok' && String(r.ssylka) === sid)) return out(respond());
  const rw = [mk({ oid: id, tip: 'sdacha_ok', ssylka: sid, data: now.slice(0, 10) })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'kassa') {
  // Внесение (in) и изъятие (out) наличных в смене: размен в кассу или руководитель забрал деньги. Запись попадает в смену того, чья касса.
  if (ID.role === 'staff' && ID.srole !== 'prodavec') return fail('нет доступа');
  const kind = B.kind === 'in' || B.kind === 'out' ? B.kind : '';
  const id = idc(B.id), s = r2(B.amount), date = String(B.date || ''), note = san(B.note, 60);
  const who = ID.role === 'staff' ? san(ID.who, 40) : (san(B.who, 40) || 'Руководитель');
  if (!kind) return fail('выберите: внесли или взяли');
  if (id.length < 6) return fail('нет номера записи');
  if (!(s > 0 && s <= 1000000000)) return fail('неверная сумма');
  if (!okDate(date)) return fail('неверная дата');
  if (all.some(r => String(r.oid) === id)) return out(respond());
  const rw = [mk({ oid: id, tip: 'kassa', oplata: kind, summa: s, pokupatel: who, nazvanie: note, data: date })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'expense') {
  // Личный расход продавца (взял из кассы на себя): простая запись, не долг.
  const id = idc(B.id), s = r2(B.amount), date = String(B.date || ''), note = san(B.note, 60);
  const who = ID.role === 'staff' ? san(ID.who, 40) : san(B.who, 40);
  if (id.length < 6) return fail('нет номера записи');
  if (!who) return fail('не указан продавец');
  if (!(s > 0 && s <= 1000000000)) return fail('неверная сумма');
  if (!okDate(date)) return fail('неверная дата');
  if (all.some(r => String(r.oid) === id)) return out(respond());
  const rw = [mk({ oid: id, tip: 'rashod', summa: s, pokupatel: who, nazvanie: note, data: date })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'sal_set') {
  // Зарплата продавца: оклад + процент от его продаж (только руководитель).
  if (ID.role !== 'owner') return fail('нет доступа');
  const who = san(B.who, 40), ok = r2(B.oklad), pc = r2(B.pct);
  if (!who) return fail('укажите продавца');
  if (!(ok >= 0 && ok <= 1000000000)) return fail('неверный оклад');
  if (!(pc >= 0 && pc <= 100)) return fail('процент от 0 до 100');
  const rw = [mk({ oid: ('z' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)).slice(0, 40), tip: 'zp_set', pokupatel: who, summa: ok, marzha: pc })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'sal_pay') {
  if (ID.role !== 'owner') return fail('нет доступа');
  const who = san(B.who, 40), s = r2(B.amount), id = idc(B.id), date = String(B.date || ''), kind = B.kind === 'avans' ? 'avans' : 'zp';
  if (!who) return fail('укажите продавца');
  if (id.length < 6) return fail('нет номера записи');
  if (!(s > 0 && s <= 1000000000)) return fail('неверная сумма');
  if (!okDate(date)) return fail('неверная дата');
  if (all.some(r => String(r.oid) === id)) return out(respond());
  const rw = [mk({ oid: id, tip: 'vyplata', oplata: kind, summa: s, pokupatel: who, data: date })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'pay') {
  const who = san(B.who, 40), s = r2(B.amount), id = idc(B.id), date = String(B.date || '');
  if (!who) return fail('укажите, кто платит');
  if (id.length < 6) return fail('нет номера записи');
  if (!okDate(date)) return fail('неверная дата');
  if (all.some(r => String(r.oid) === id)) return out(respond());
  const d = debtOf(who);
  if (!(s > 0)) return fail('неверная сумма');
  if (s > d + 0.004) return fail('долг только ' + d + ' сомони');
  const rw = [mk({ oid: id, tip: 'oplata', summa: s, pokupatel: who, data: date })];
  withRows(rw);
  return out(respond(), rw);
}

if (act === 'void') {
  const id = idc(B.id);
  const isCheck = sales.some(r => String(r.chek) === id);
  const isPay = pays.some(r => String(r.oid) === id);
  const isExp = all.some(r => (r.tip === 'rashod' || r.tip === 'vyplata' || r.tip === 'kassa') && String(r.oid) === id) && !voided.has(id);
  if (!isCheck && !isPay && !isExp) return fail('запись не найдена');
  const rw = [mk({ oid: ('v' + id).slice(0, 40), tip: 'void', ssylka: id })];
  withRows(rw);
  return out(respond(), rw);
}
return fail('неизвестное действие');
