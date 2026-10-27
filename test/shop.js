// Магазин Шамсуло: код узлов n8n «/magazin» (n8n/magazin/*.js) на подставных данных и экран в window.html.
// Узел «Кабинет» не в репозитории (в нём код кабинета), поэтому его ответ подставляем сами.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ok = (n) => console.log('ok -', n);
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SOLVE = rd('n8n/magazin/reshit.js'), ANAL = rd('n8n/magazin/analiz.js'), PROD = rd('n8n/magazin/dlya-prodavca.js'), FOTO = rd('n8n/magazin/foto-razobrat.js'), BAR = rd('n8n/magazin/shtrihkody.js'), VOZ = rd('n8n/magazin/vozvrat.js');
const KOD = 'ktestkabinet0000000000';
const WHO = { owner: { ok: true, kod: KOD, role: 'owner', who: '' }, seller: { ok: true, kod: KOD, role: 'staff', srole: 'prodavec', who: 'Маруф' }, keeper: { ok: true, kod: KOD, role: 'staff', srole: 'kladovshchik', who: 'Али' }, seller2: { ok: true, kod: KOD, role: 'staff', srole: 'prodavec', who: 'Зоир' } };
const DB = []; let nid = 1;
function run(code, ctx, input, extra) {
  const $ = (n) => { const v = ctx[n]; return { first: () => ({ json: v[0] }), all: () => v.map((j) => ({ json: j })) }; };
  return new Function('$', '$input', '$json', code)($, { all: () => input || [] }, extra);
}
// как в автоматизации: Решить → Анализ и пересчёт → Для продавца → (по фото: ИИ → Разобрать ответ) или запись строк
function call(body, role, ai) {
  // записи одной миллисекунды неотличимы по времени («с прошлой сдачи кассы»), поэтому каждый вызов — в новую миллисекунду
  const t0 = Date.now(); while (Date.now() === t0);
  const ctx = { 'Магазин: запрос': [{ body }], 'Кабинет': [WHO[role || 'owner']], 'Сотрудники': [], 'Записи магазина': DB.slice() };
  let items = run(SOLVE, ctx); items = run(ANAL, ctx, items); items = run(VOZ, ctx, items); items = run(PROD, ctx, items);
  ctx['Для продавца'] = items.map((x) => x.json);
  items = run(BAR, ctx, items);
  if (items[0].json.vision) return run(FOTO, ctx, null, ai(items[0].json.vision))[0].json.resp;
  // узел «Записать» ставит в ssylka продаж и приёма имя сотрудника
  items.filter((x) => x.json.rows).forEach((x) => DB.push(Object.assign({ id: nid++ }, x.json.row, ['prodazha', 'prihod', 'korrekt'].includes(x.json.row.tip) ? { ssylka: WHO[role || 'owner'].who } : {})));
  return items[0].json.resp;
}
const P = (r, k) => r.products.find((x) => x.kod === k);

// старый товар без единицы — штуки
DB.push({ id: nid++, oid: 'told', kabinet_kod: KOD, tip: 'tovar', kod: 'OLD1', nazvanie: 'Гвозди', kolvo: 0, zakup: 10, marzha: 20, cena: 0, summa: 0, oplata: '', vremya: '2026-10-20T00:00:00Z', data: '2026-10-20' });
let r = call({ action: 'list' });
assert.equal(P(r, 'OLD1').unit, 'sht'); assert.equal(P(r, 'OLD1').per, 0);
ok('старые товары остаются штучными');

r = call({ action: 'product', p: { kod: 'TRUBA20', name: 'Труба ПП 20', zakup: 8, marzha: 25, unit: 'm', per: 4 } });
assert.deepEqual([P(r, 'TRUBA20').unit, P(r, 'TRUBA20').per, P(r, 'TRUBA20').price], ['m', 4, 10]);
r = call({ action: 'receive', kod: 'TRUBA20', qty: 12.345, id: 'rcv000001' });
assert.equal(P(r, 'TRUBA20').qty, 12.35);
r = call({ action: 'receive', kod: 'OLD1', qty: 2.6, id: 'rcv000002' });
assert.equal(P(r, 'OLD1').qty, 3);
call({ action: 'product', p: { kod: 'CEM', name: 'Цемент', zakup: 2, marzha: 50, unit: 'kg' } });
r = call({ action: 'receive', kod: 'CEM', qty: 50.1234, id: 'rcv000003' });
assert.equal(P(r, 'CEM').qty, 50.123);
ok('приём: метры до сантиметра, килограммы до грамма, штуки целые');

r = call({ action: 'sell', id: 'chek00001', items: [{ kod: 'TRUBA20', qty: 2.5 }, { kod: 'TRUBA20', qty: 1.25 }], pay: 'nal', date: '2026-10-24' });
assert.equal(P(r, 'TRUBA20').qty, 8.6);
assert.equal(r.report.checks[0].total, 37.5);
assert.equal(call({ action: 'sell', id: 'chek00002', items: [{ kod: 'TRUBA20', qty: 0.004 }], pay: 'nal', date: '2026-10-24' }).error, 'неверное количество');
r = call({ action: 'void', id: 'chek00001' });
assert.equal(P(r, 'TRUBA20').qty, 12.35);
ok('продажа 3,75 м = 37,50; меньше сантиметра нельзя; отмена чека сразу возвращает остаток');

r = call({ action: 'foto', kod: 'TRUBA20', foto: 'data:image/jpeg;base64,AAAA' });
assert.deepEqual([P(r, 'TRUBA20').unit, P(r, 'TRUBA20').per, P(r, 'TRUBA20').foto], ['m', 4, 1]);
r = call({ action: 'receive', kod: 'TRUBA20', qty: 1, id: 'rcv000004', zakup: 9 });
assert.deepEqual([P(r, 'TRUBA20').unit, P(r, 'TRUBA20').zakup], ['m', 9]);
assert.equal(call({ action: 'product', p: { kod: 'X', name: 'X', zakup: 1, marzha: 1, unit: 'litr' } }).error, 'неверная единица измерения');
ok('фото и новая закупка не сбрасывают единицу; неизвестная единица отклонена');

call({ action: 'count', id: 'cnt0001', items: [{ kod: 'TRUBA20', fact: 11.555 }] });
const inv = call({ action: 'inv_list' }).inv.list[0];
assert.deepEqual([inv.fact, inv.diff, inv.unit], [11.56, -1.79, 'm']);
assert.equal(call({ action: 'minset', kod: 'TRUBA20', min: 20.5 }).min, 20.5);
ok('пересчёт и минимум в метрах');

const seller = call({ action: 'list' }, 'seller');
assert.equal(P(seller, 'TRUBA20').unit, 'm'); assert.ok(!('zakup' in seller.products[0]));
const ai = (v) => { assert.match(v.catalog, /TRUBA20 — Труба ПП 20/); assert.ok(!('zakup' in v.items[0])); return { choices: [{ message: { content: '{"codes":["truba20","NETAKOGO"],"note":"труба"}' } }] }; };
const f1 = call({ action: 'find_photo', foto: 'data:image/jpeg;base64,AAAA' }, 'seller', ai);
assert.deepEqual(f1.found.map((x) => x.kod), ['TRUBA20']); assert.ok('price' in f1.found[0]);
const f2 = call({ action: 'find_photo', foto: 'data:image/jpeg;base64,AAAA' }, 'keeper', ai);
assert.ok(!('price' in f2.found[0]));
assert.equal(call({ action: 'find_photo', foto: 'data:image/png;base64,AAAA' }, 'seller', ai).error, 'фото не подошло, снимите ещё раз');
assert.equal(call({ action: 'find_photo', foto: 'data:image/jpeg;base64,AAAA' }, 'owner', () => ({ error: { message: 'x' } })).ok, false);
ok('поиск по фото: только коды из списка, без закупки, кладовщику без цены, ошибка ИИ — понятный отказ');

// цена продажи вручную: хранится ровно такой, маржа — для справки; при новой закупке цена не меняется
r = call({ action: 'product', p: { kod: 'KRAN', name: 'Кран 1/2', zakup: 3, marzha: 0, sell: 10, unit: 'sht' } });
assert.deepEqual([P(r, 'KRAN').price, P(r, 'KRAN').sell, P(r, 'KRAN').marzha], [10, 10, 233.33]);
r = call({ action: 'receive', kod: 'KRAN', qty: 5, id: 'rcv000005', zakup: 4 });
assert.deepEqual([P(r, 'KRAN').price, P(r, 'KRAN').zakup, P(r, 'KRAN').marzha], [10, 4, 150]);
r = call({ action: 'sell', id: 'chek00003', items: [{ kod: 'KRAN', qty: 2 }], pay: 'nal', date: '2026-10-24' });
assert.equal(r.report.checks.find((c) => c.id === 'chek00003').total, 20);
r = call({ action: 'product', p: { kod: 'KRAN', name: 'Кран 1/2', zakup: 4, marzha: 50 } });
assert.deepEqual([P(r, 'KRAN').price, P(r, 'KRAN').sell], [10, 10]);
r = call({ action: 'product', p: { kod: 'KRAN', name: 'Кран 1/2', zakup: 4, marzha: 50, sell: 0 } });
assert.deepEqual([P(r, 'KRAN').price, P(r, 'KRAN').sell], [6, 0]);
assert.equal(call({ action: 'product', p: { kod: 'KRAN2', name: 'К', zakup: 4, marzha: 5000 } }).error, 'маржа от 0 до 1000 процентов');
assert.ok(call({ action: 'product', p: { kod: 'KRAN3', name: 'Ниже закупки', zakup: 4, marzha: 0, sell: 3 } }).ok);
ok('цена продажи вручную: ровно 10, маржа для справки, не меняется при новой закупке; 0 — снова из маржи');

// экран: window.html собран из specialists.cjs, в кассе и приёме есть единицы и «По фото»
const src = rd('specialists.cjs'), html = rd('window.html');
const A = '/*specialists:start*/', B = '/*specialists:end*/';
assert.equal(html.slice(html.indexOf(A) + A.length, html.indexOf(B)), '\n' + src + '\n', 'window.html не пересобран: node build-specialists.js');
for (const need of ["action: 'find_photo'", 'data-cq=', 'function shRcvQty(', 'id="sh-f-unit"', "['m', 'Метры (до сантиметра)'", 'id="sh-ff-in" accept="image/*" capture="environment" hidden', 'function shSellFields(', "sell: f.fsm ? shR2(shParse(f.sell)) : 0"]) assert.ok(src.includes(need), 'нет: ' + need);
ok('экран магазина: единицы, количество в метрах, кнопка «По фото»');
// Заводские штрихкоды (узел «Штрихкоды»): привязка к товару с коротким кодом магазина, поиск кассы по штрихкоду.
const EAN = '4600000000017';
r = call({ action: 'list', bind_barcode: { kod: 'OLD1', code: EAN, id: 'bar000001' } }, 'seller');
assert.equal(r.ok, false, 'продавец штрихкод не привязывает');
r = call({ action: 'list', bind_barcode: { kod: 'OLD1', code: EAN, id: 'bar000002' } }, 'keeper');
assert.deepEqual([r.ok, P(r, 'OLD1').bar], [true, [EAN]], 'кладовщик привязал штрихкод');
r = call({ action: 'list' }, 'seller');
assert.deepEqual(P(r, 'OLD1').bar, [EAN], 'продавец видит штрихкоды товаров для поиска');
r = call({ action: 'list', bind_barcode: { kod: 'OLD1', code: EAN, id: 'bar000002' } }, 'keeper');
assert.equal(DB.filter((x) => x.tip === 'shtrih').length, 1, 'повтор не задваивает');
r = call({ action: 'list', bind_barcode: { kod: 'CEM', code: EAN, id: 'bar000003' } });
assert.ok(!r.ok && /уже привязан к товару «Гвозди»/.test(r.error), 'один штрихкод — один товар');
r = call({ action: 'list', bind_barcode: { kod: 'CEM', code: 'OLD1', id: 'bar000004' } });
assert.equal(r.ok, false, 'нельзя привязать код другого товара');
r = call({ action: 'list', bind_barcode: { kod: 'CEM', code: '12', id: 'bar000005' } });
assert.equal(r.ok, false, 'слишком короткий штрихкод');
r = call({ action: 'list', unbind_barcode: { kod: 'OLD1', code: EAN, id: 'bar000006' } });
assert.deepEqual([r.ok, P(r, 'OLD1').bar], [true, []], 'отвязать');
r = call({ action: 'list', bind_barcode: { kod: 'CEM', code: EAN, id: 'bar000007' } });
assert.deepEqual(P(r, 'CEM').bar, [EAN], 'после отвязки можно привязать к другому товару');
r = call({ action: 'sell', id: 'chekbar01', items: [{ kod: 'CEM', qty: 1 }], pay: 'nal', date: '2026-10-27' }, 'seller');
assert.equal(r.ok, true, 'обычные действия работают как раньше');
ok('заводские штрихкоды: привязка, один код — один товар, отвязка, продавец видит');
const W = rd('specialists.cjs');
for (const need of ['function shHasBar(', 'bind_barcode', 'unbind_barcode', "'code_39'", "'itf'", "'data_matrix'", 'getSupportedFormats', "mode === 'bindto'", 'function shBindBox(']) assert.ok(W.includes(need), 'нет в экране: ' + need);
ok('экран: поиск по штрихкоду, привязка при скане, больше форматов');
// Возврат по чеку (узел «Возврат»): часть позиций, по цене продажи, товар на склад, деньги тем же способом.
r = call({ action: 'list' });
const cemQ = P(r, 'CEM').qty, TODAY = '2026-10-27';
r = call({ action: 'sell', id: 'chekret001', items: [{ kod: 'CEM', qty: 3 }, { kod: 'OLD1', qty: 2 }], pay: 'nal', date: TODAY }, 'seller');
const rev0 = call({ action: 'list', month: '2026-10' }).report.revenue;
r = call({ action: 'chek_get', chek: 'chekret001' }, 'seller');
assert.deepEqual(r.chek.lines.map((l) => [l.kod, l.qty, l.left]), [['CEM', 3, 3], ['OLD1', 2, 2]], 'чек с позициями');
assert.equal(call({ action: 'chek_get', chek: 'ret001' }, 'seller').chek.id, 'chekret001', 'чек находится по последним 6 знакам');
assert.equal(call({ action: 'chek_get', chek: 'nettakogo' }, 'seller').ok, false);
assert.equal(call({ action: 'chek_get', chek: 'chekret001' }, 'keeper').ok, false, 'кладовщик возврат не оформляет');
r = call({ action: 'vozvrat', chek: 'chekret001', id: 'vozv000001', date: TODAY, items: [{ kod: 'CEM', qty: 4 }] }, 'seller');
assert.ok(!r.ok && /не больше 3/.test(r.error), 'больше купленного не вернуть');
r = call({ action: 'vozvrat', chek: 'chekret001', id: 'vozv000002', date: TODAY, items: [{ kod: 'CEM', qty: 1 }] }, 'seller');
assert.deepEqual([r.ok, r.vozvrat.total, r.vozvrat.pay, r.vozvrat.from], [true, 3, 'nal', 'chekret001'], 'вернули 1 кг цемента по цене продажи наличными');
r = call({ action: 'list', month: '2026-10' });
assert.equal(P(r, 'CEM').qty, Math.round((cemQ - 3 + 1) * 1000) / 1000, 'товар вернулся на склад');
assert.equal(r.report.revenue, Math.round((rev0 - 3) * 100) / 100, 'выручка уменьшилась на сумму возврата');
assert.ok(r.report.checks.some((c) => c.total === -3), 'в списке чеков есть возврат с минусом');
assert.equal(call({ action: 'chek_get', chek: 'chekret001' }, 'seller').chek.lines[0].left, 2, 'осталось вернуть 2');
const n0 = DB.length;
call({ action: 'vozvrat', chek: 'chekret001', id: 'vozv000002', date: TODAY, items: [{ kod: 'CEM', qty: 1 }] }, 'seller');
assert.equal(DB.length, n0, 'повтор не задваивает');
r = call({ action: 'sell', id: 'chekret002', items: [{ kod: 'OLD1', qty: 2 }], pay: 'dolg', who: 'Карим', date: TODAY }, 'seller');
const d0 = call({ action: 'list' }).debts.find((d) => d.name === 'Карим').sum;
call({ action: 'vozvrat', chek: 'chekret002', id: 'vozv000003', date: TODAY, items: [{ kod: 'OLD1', qty: 1 }] }, 'seller');
assert.equal(call({ action: 'list' }).debts.find((d) => d.name === 'Карим').sum, Math.round(d0 / 2 * 100) / 100, 'возврат долговой покупки уменьшает долг');
r = call({ action: 'void', id: DB.filter((x) => x.oid === 'vozv000002l0')[0].chek });
assert.equal(r.ok, true, 'возврат можно отменить');
assert.equal(call({ action: 'chek_get', chek: 'chekret001' }, 'seller').chek.lines[0].left, 3, 'после отмены возврата снова можно вернуть 3');
ok('возврат по чеку: часть позиций, склад, выручка, долг, повтор, отмена');
for (const need of ["action: 'chek_get'", "action: 'vozvrat'", 'function shRetBox(', 'function shCode128(', "rc = { id: SH.cid"]) assert.ok(W.includes(need), 'нет в экране: ' + need);
ok('экран возврата и номер чека со штрихкодом на печатном чеке');

// Сдача кассы (№299): должно быть только наличными, итог смены по способам оплаты, подтверждение руководителем.
for (const [id, pay, who] of [['chsd00001', 'nal'], ['chsd00002', 'alif'], ['chsd00003', 'dolg', 'Карим']]) call({ action: 'sell', id, items: [{ kod: 'OLD1', qty: 1 }], pay, who, date: TODAY }, 'seller2');
call({ action: 'sell', id: 'chsd00004', items: [{ kod: 'OLD1', qty: 2 }], pay: 'mix', parts: [{ pay: 'nal', sum: 4 }, { pay: 'dushanbe', sum: 20 }], date: TODAY }, 'seller2');
r = call({ action: 'sdacha', id: 'sdac000001', fact: 14, date: TODAY }, 'seller2');
assert.deepEqual([r.sdacha.expected, r.sdacha.fact, r.sdacha.diff], [16, 14, -2], 'должно 16 наличными (12 + 4 из смешанной), сдал 14 — недостача 2');
assert.deepEqual(r.sdacha.by, { nal: 16, alif: 12, dolg: 12, dushanbe: 20 }, 'итог смены по способам оплаты');
let sd = call({ action: 'list' }).report.sdachi.find((x) => x.id === 'sdac000001');
assert.deepEqual([sd.who, sd.by.alif, sd.ok], ['Зоир', 12, ''], 'в отчёте сдача с разбивкой, ещё не подтверждена');
assert.equal(call({ action: 'sdacha_ok', sdacha: 'sdac000001', id: 'sdok000001' }, 'seller2').ok, false, 'продавец сам не подтверждает');
assert.equal(call({ action: 'sdacha_ok', sdacha: 'netakoi01', id: 'sdok000002' }).ok, false);
r = call({ action: 'sdacha_ok', sdacha: 'sdac000001', id: 'sdok000003' });
assert.ok(r.report.sdachi.find((x) => x.id === 'sdac000001').ok, 'руководитель подтвердил смену');
const n1 = DB.length; call({ action: 'sdacha_ok', sdacha: 'sdac000001', id: 'sdok000004' }); assert.equal(DB.length, n1, 'повторное подтверждение не пишет');
r = call({ action: 'sdacha', id: 'sdac000002', fact: 0, date: TODAY }, 'seller2');
assert.deepEqual([r.sdacha.expected, r.sdacha.by], [0, {}], 'новая смена начинается с нуля');
// Внесение и изъятие наличных (№223): размен и «руководитель забрал» учитываются в «должно быть» при сдаче кассы.
call({ action: 'sell', id: 'chkop0001', items: [{ kod: 'OLD1', qty: 5 }], pay: 'nal', date: TODAY }, 'seller2');
assert.equal(call({ action: 'kassa', kind: 'in', id: 'kop0000001', amount: 50, note: 'размен', date: TODAY }, 'seller2').ok, true, 'продавец вносит размен');
assert.equal(call({ action: 'kassa', kind: 'out', id: 'kop0000002', amount: 40, who: 'Зоир', note: 'забрал', date: TODAY }).ok, true, 'руководитель забрал из кассы Зоира');
call({ action: 'kassa', kind: 'out', id: 'kop0000003', amount: 7, date: TODAY });
assert.equal(call({ action: 'kassa', kind: 'out', id: 'kop0000004', amount: 1, date: TODAY }, 'keeper').ok, false, 'кладовщик кассой не распоряжается');
assert.equal(call({ action: 'kassa', kind: 'x', id: 'kop0000005', amount: 1, date: TODAY }).error, 'выберите: внесли или взяли');
assert.equal(call({ action: 'kassa', kind: 'in', id: 'kop0000006', amount: 0, date: TODAY }).error, 'неверная сумма');
const n2 = DB.length; call({ action: 'kassa', kind: 'in', id: 'kop0000001', amount: 50, date: TODAY }, 'seller2'); assert.equal(DB.length, n2, 'повтор не задваивает');
r = call({ action: 'list' });
assert.deepEqual(r.report.kassa.filter((x) => x.who === 'Зоир').map((x) => [x.kind, x.sum]).sort(), [['in', 50], ['out', 40]], 'в отчёте внесли и взяли');
assert.ok(r.report.kassa.some((x) => x.who === 'Руководитель' && x.sum === 7), 'без имени — касса руководителя');
r = call({ action: 'void', id: 'kop0000002' });
assert.ok(r.ok && !r.report.kassa.some((x) => x.id === 'kop0000002'), 'изъятие можно отменить');
call({ action: 'kassa', kind: 'out', id: 'kop0000007', amount: 30, who: 'Зоир', date: TODAY });
r = call({ action: 'sdacha', id: 'sdac000003', fact: 80, date: TODAY }, 'seller2');
assert.deepEqual([r.sdacha.expected, r.sdacha.vnes, r.sdacha.vzyal, r.sdacha.diff], [80, 50, 30, 0], 'должно 60 продаж + 50 размен − 30 забрал = 80, всё сходится');
ok('внесение и изъятие наличных в смене');
for (const need of ['function shKopBox(', "action: 'kassa', kind: SH.kKind"]) assert.ok(W.includes(need), 'нет в экране: ' + need);
const { textFor } = await import('../push.js');
assert.deepEqual(textFor({ kind: 'sdacha', who: 'Зоир', sum: 14, exp: 16, diff: -2, by: { nal: 16, alif: 12, dolg: 12, x: 5 } }), { title: 'Касса сдана: Зоир', body: 'Сдал 14, должно 16 — недостача 2 сомони. Смена: наличные 16, Алиф 12, в долг 12' });
assert.equal(textFor({ kind: 'sdacha', who: 'Зоир', sum: 5, exp: 5, diff: 0, by: '<b>' }).body, 'Сдал 5, должно 5 — всё сходится');
ok('сдача кассы: наличные, итог смены по способам, подтверждение руководителем, push хозяину');
assert.deepEqual(textFor({ kind: 'shop_low', n: 5, items: [{ name: 'Краска бергер', qty: 2, min: 5 }, { name: '<b>Гвозди</b>', qty: 0, min: 10 }] }), { title: 'Заканчивается товар: 5', body: 'Краска бергер — 2 из 5 · bГвозди/b — 0 из 10 и ещё 3' });
assert.equal(textFor({ kind: 'shop_low', n: 0, items: [] }), null, 'нечего заказывать — не шлём');
assert.deepEqual(textFor({ kind: 'shop_low', n: 2, items: [{ name: 'Кофе', qty: 1, min: 5 }] }, 'tg'), { title: 'Мол тамом шуда истодааст: 2', body: 'Кофе — 1 аз 5 ва боз 1' });
assert.deepEqual(textFor({ kind: 'sdacha', who: 'Зоир', sum: 14, exp: 16, diff: -2, by: { nal: 16, dolg: 12 } }, 'tg'), { title: 'Касса супорида шуд: Зоир', body: 'Супорид 14, бояд 16 — камомад 2 сомонӣ. Смена: нақд 16, қарз 12' });
assert.equal(textFor({ kind: 'rashod', who: 'Зоир', sum: 50 }, 'tg').title, 'Хароҷоти шахсии фурӯшанда');
assert.equal(textFor({ kind: 'rashod', who: 'Зоир', sum: 50 }, 'uz').title, 'Личный расход продавца', 'другой язык — по-русски');
assert.ok(W.includes("lang: (window.LANG === 'tg' ? 'tg' : 'ru')"), 'телефон сообщает язык при включении уведомлений');
ok('утреннее напоминание о заканчивающемся товаре; уведомления магазина по-таджикски');
console.log('SHOP PASSED');
