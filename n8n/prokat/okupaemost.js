// Закупочные цены по видам инструмента и окупаемость пунктов.
// buy_prices — виды с ценой покупки и сколько их стоит на пунктах; buy_price_set — новая цена вида (строка добавляется, последняя главная);
// payback — окупаемость одного пункта по инструментам; payback_all — все пункты от худшего к лучшему.
// Окупилось = (доход Нурулло по пункту из таблицы + доля Нурулло с аренд в окне владельца + продажи) / стоимость инструментов на пункте.
const prev = $input.first().json;
const B = $('Прокат: запрос').first().json.body || {};
const act = String(B.action || '');
if (['buy_prices', 'buy_price_set', 'payback', 'payback_all'].indexOf(act) < 0 || !$('Кабинет').first().json.ok) return [{ json: prev }];
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const out = (resp, extra) => [{ json: Object.assign({ op: 'none', resp: resp }, extra || {}) }];
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pk = s => norm(s).slice(0, 14);
const nice = s => String(s || '').replace(/\s+/g, ' ').trim();
const num = x => Math.round((Number(x) || 0) * 100) / 100;
// Вид инструмента по словам в названии (рус. и тадж.), как в фото-истории и прайсе аренды.
const small = s => /майда|малень|мелк|малая|малый/.test(s), big = s => /калон|кадре|больш|болш|катта/.test(s);
const kindOf = nm => { const s = norm(nm);
  if (/отбо|атбо|атбй|молот/.test(s)) return 'Отбойный молоток';
  if (/перфор|перфар|парфар/.test(s)) return small(s) ? 'Маленький перфоратор' : big(s) ? 'Большой перфоратор' : '';
  if (/болгар|балгар|ушм/.test(s)) return small(s) ? 'Маленькая болгарка' : big(s) ? 'Большая болгарка' : '';
  if (/шруп|шуруп|шурув/.test(s)) return 'Шуруповёрт аккумуляторный';
  if (/утюг|утиг|паял/.test(s)) return 'Паяльник для пластиковых труб';
  if (/вибрат/.test(s)) return 'Вибратор для бетона';
  if (/лобзик/.test(s)) return 'Лобзик';
  if (/бензо/.test(s)) return 'Бензопила';
  if (/циркул/.test(s)) return 'Циркулярка';
  if (/свар/.test(s)) return 'Сварка';
  if (/краск/.test(s)) return 'Краскопульт';
  if (/пушк/.test(s)) return 'Газовая пушка';
  if (/горел/.test(s)) return 'Газовая горелка с баллоном';
  if (/фен/.test(s)) return 'Строительный фен';
  if (/миксер/.test(s)) return 'Строительный миксер';
  if (/rodex|родекс|резьб|резба/.test(s)) return 'Резьбонарезной инструмент Rodex';
  if (/дрел/.test(s)) return 'Дрель';
  if (/кафел|кафед|плитк/.test(s)) return 'Кафелерез';
  return ''; };
const KINDS = ['Отбойный молоток', 'Большой перфоратор', 'Маленький перфоратор', 'Большая болгарка', 'Маленькая болгарка', 'Шуруповёрт аккумуляторный', 'Дрель', 'Паяльник для пластиковых труб', 'Кафелерез', 'Лобзик', 'Циркулярка', 'Бензопила', 'Сварка', 'Вибратор для бетона', 'Краскопульт', 'Газовая пушка', 'Газовая горелка с баллоном', 'Строительный фен', 'Строительный миксер', 'Резьбонарезной инструмент Rodex'];
const priceRows = R('Закупочные цены').sort((a, b) => Number(a.id) - Number(b.id));
const PRICE = {};
priceRows.forEach(r => { const p = Number(r.cena); if (KINDS.indexOf(String(r.instrument)) >= 0 && p >= 0) PRICE[String(r.instrument)] = { price: num(p), date: String(r.data || '') }; });
const pts = R('Итоги по точкам');
const recs = R('Инструменты пунктов').filter(r => String(r.tip) === 'Инструмент' && nice(r.instrument) && !/без названия/i.test(String(r.instrument)));
const rents = R('Аренды').filter(r => r.status !== 'сдача' && r.status !== 'сломан');
const sales = R('Перевозки').filter(m => String(m.v) === 'Продан');
const qtyOf = r => Math.max(1, Number(r.kolvo) || 1);

if (act === 'buy_price_set') {
  const kind = String(B.kind || ''), price = Math.round(Number(B.price) * 100) / 100;
  const id = String(B.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  if (KINDS.indexOf(kind) < 0) return out({ ok: false, error: 'неизвестный вид инструмента' });
  if (!(B.price !== '' && B.price != null && price >= 0 && price <= 10000000)) return out({ ok: false, error: 'неверная цена' });
  if (id.length < 6) return out({ ok: false, error: 'нет номера записи' });
  if (priceRows.some(r => String(r.oid) === id)) return out({ ok: true, dup: true, kind: kind, price: PRICE[kind] ? PRICE[kind].price : price });
  const date = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  return out({ ok: true, kind: kind, price: price, date: date }, { op: 'buy_price_set', row: { instrument: kind, cena: price, data: date, avtor: 'приложение', oid: id } });
}
if (act === 'buy_prices') {
  const onPts = {}, unknown = {};
  recs.forEach(r => { const k = kindOf(r.instrument); if (k) onPts[k] = (onPts[k] || 0) + qtyOf(r); else { const n = nice(r.instrument); unknown[n] = (unknown[n] || 0) + qtyOf(r); } });
  return out({ ok: true, kinds: KINDS.map(k => ({ kind: k, price: PRICE[k] ? PRICE[k].price : null, date: PRICE[k] ? PRICE[k].date : '', on_points: onPts[k] || 0 })), unknown: Object.keys(unknown).sort((a, b) => a.localeCompare(b, 'ru')).map(n => ({ name: n, qty: unknown[n] })) });
}
const pointCalc = p => {
  const key = pk(p.tochka), tools = {};
  recs.filter(r => pk(r.tochka) === key).forEach(r => { const n = nice(r.instrument), k = norm(n); const t = tools[k] || (tools[k] = { name: n, kind: kindOf(n), qty: 0, income: 0 }); t.qty += qtyOf(r); });
  rents.filter(r => pk(r.tochka) === key).forEach(r => { const t = tools[norm(r.instrument)]; if (t) t.income = num(t.income + (Number(r.dolya_nurullo) || 0)); });
  const list = Object.keys(tools).map(k => { const t = tools[k]; const pr = t.kind && PRICE[t.kind] ? PRICE[t.kind].price : null; return { name: t.name, kind: t.kind, qty: t.qty, price: pr, cost: pr == null ? null : num(pr * t.qty), income: t.income }; }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const cost = num(list.reduce((s, t) => s + (t.cost || 0), 0));
  const appIncome = num(rents.filter(r => pk(r.tochka) === key).reduce((s, r) => s + (Number(r.dolya_nurullo) || 0), 0));
  const sold = num(sales.filter(m => pk(m.iz) === key).reduce((s, m) => s + (Number(m.cena) || 0), 0));
  const income = num((Number(p.dohod) || 0) + appIncome);
  return { name: String(p.tochka), tools: list, cost: cost, income: income, sold: sold, no_price: list.filter(t => t.price == null).length, percent: cost > 0 ? Math.round((income + sold) / cost * 100) : null };
};
if (act === 'payback_all') {
  const list = pts.map(p => { const c = pointCalc(p); return { name: c.name, cost: c.cost, income: c.income, sold: c.sold, no_price: c.no_price, percent: c.percent }; })
    .sort((a, b) => (a.percent == null ? 1e9 : a.percent) - (b.percent == null ? 1e9 : b.percent) || a.name.localeCompare(b.name, 'ru'));
  const cost = num(list.reduce((s, x) => s + x.cost, 0)), back = num(list.reduce((s, x) => s + x.income + x.sold, 0));
  return out({ ok: true, points: list, cost: cost, back: back, percent: cost > 0 ? Math.round(back / cost * 100) : null, prices_set: Object.keys(PRICE).length });
}
const p = pts.find(r => String(r.tochka) === String(B.name || ''));
if (!p) return out({ ok: false, error: 'пункт не найден' });
return out(Object.assign({ ok: true }, pointCalc(p)));
