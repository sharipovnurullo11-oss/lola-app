// Магазин Шамсуло: код узлов n8n «/magazin» (n8n/magazin/*.js) на подставных данных и экран в window.html.
// Узел «Кабинет» не в репозитории (в нём код кабинета), поэтому его ответ подставляем сами.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ok = (n) => console.log('ok -', n);
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SOLVE = rd('n8n/magazin/reshit.js'), ANAL = rd('n8n/magazin/analiz.js'), PROD = rd('n8n/magazin/dlya-prodavca.js'), FOTO = rd('n8n/magazin/foto-razobrat.js');
const KOD = 'ktestkabinet0000000000';
const WHO = { owner: { ok: true, kod: KOD, role: 'owner', who: '' }, seller: { ok: true, kod: KOD, role: 'staff', srole: 'prodavec', who: 'Маруф' }, keeper: { ok: true, kod: KOD, role: 'staff', srole: 'kladovshchik', who: 'Али' } };
const DB = []; let nid = 1;
function run(code, ctx, input, extra) {
  const $ = (n) => { const v = ctx[n]; return { first: () => ({ json: v[0] }), all: () => v.map((j) => ({ json: j })) }; };
  return new Function('$', '$input', '$json', code)($, { all: () => input || [] }, extra);
}
// как в автоматизации: Решить → Анализ и пересчёт → Для продавца → (по фото: ИИ → Разобрать ответ) или запись строк
function call(body, role, ai) {
  const ctx = { 'Магазин: запрос': [{ body }], 'Кабинет': [WHO[role || 'owner']], 'Сотрудники': [], 'Записи магазина': DB.slice() };
  let items = run(SOLVE, ctx); items = run(ANAL, ctx, items); items = run(PROD, ctx, items);
  ctx['Для продавца'] = items.map((x) => x.json);
  if (items[0].json.vision) return run(FOTO, ctx, null, ai(items[0].json.vision))[0].json.resp;
  items.filter((x) => x.json.rows).forEach((x) => DB.push(Object.assign({ id: nid++ }, x.json.row)));
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
console.log('SHOP PASSED');
