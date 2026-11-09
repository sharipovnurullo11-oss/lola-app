// Проверка кода узла «Решить» финансиста по объектам (n8n/objekty/reshit.js) на данных в памяти, без n8n.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../n8n/objekty/reshit.js', import.meta.url), 'utf8');
const fn = new Function('$', src);
let table = [], nid = 1;
function call(body, ok = true) {
  const $ = n => n === 'Объекты: запрос' ? { first: () => ({ json: { body } }) }
    : n === 'Кабинет' ? { first: () => ({ json: ok ? { ok: true, kod: 'KOD' } : { ok: false, kod: 'none' } }) }
    : { all: () => table.map(r => ({ json: r })) };
  const res = fn($)[0].json;
  (res.rows || []).forEach(r => { assert.equal(typeof r.summa, 'number'); table.push(Object.assign({ id: nid++ }, r)); });
  return res.resp;
}
let r;
assert.equal(call({ action: 'list' }, false).error, 'нет доступа');
assert.ok(call({ action: 'add_point', oid: 'a1', name: 'Точка 1', zakazchik: 'Рустам', dogovor: '10000' }).ok);
assert.ok(call({ action: 'add_point', oid: 'a2', name: 'Точка 2' }).ok);
assert.equal(call({ action: 'add_point', oid: 'a3', name: 'Точка 1' }).error, 'такая точка уже есть');
assert.ok(call({ action: 'in', oid: 'i1', tochka: 'Точка 1', amount: '3000' }).ok);
assert.ok(call({ action: 'in', oid: 'i1', tochka: 'Точка 1', amount: '3000' }).dup, 'повтор не удваивает');
assert.ok(call({ action: 'master_set', oid: 'm1', tochka: 'Точка 1', master: 'Фарход', amount: '2000' }).ok);
assert.ok(call({ action: 'out', oid: 'o1', tochka: 'Точка 1', statya: 'master', master: 'Фарход', amount: '500' }).ok);
assert.ok(!call({ action: 'out', oid: 'o2', statya: 'master', amount: '100' }).ok, 'мастер без имени');
assert.ok(call({ action: 'out', oid: 'o3', statya: 'material', parts: [{ tochka: 'Точка 1', amount: '700' }, { tochka: 'Точка 2', amount: '300' }] }).ok, 'разделить на 2 точки');
// отчёт заказчику берёт все записи объекта, не только последние 40
assert.ok(call({ action: 'add_point', oid: 'big0', name: 'Большой' }).ok);
for (let i = 0; i < 120; i++) assert.ok(call({ action: 'in', oid: 'big' + (i + 1), tochka: 'Большой', amount: '10' }).ok);
assert.equal(call({ action: 'point', name: 'Большой' }).point.entries.length, 120, 'в записях объекта все 120');
assert.ok(call({ action: 'out', oid: 'o4', statya: 'doroga', amount: '50' }).ok, 'без точки = не распределено');
assert.equal(call({ action: 'out', oid: 'o5', tochka: 'Точка 9', statya: 'doroga', amount: '50' }).error, 'нет такой точки');
assert.ok(!call({ action: 'out', oid: 'o6', tochka: 'Точка 1', statya: 'doroga', amount: '-5' }).ok, 'минус');
r = call({ action: 'list' });
const p1 = r.points.find(p => p.name === 'Точка 1'), p2 = r.points.find(p => p.name === 'Точка 2');
assert.deepEqual([p1.inn, p1.out, p1.left, p1.owes, p1.mastersOwe], [3000, 1200, 1800, 7000, 1500]);
assert.deepEqual([p2.inn, p2.out], [0, 300]);
assert.deepEqual([r.total.unassigned, r.total.out, r.total.customersOwe, r.total.mastersOwe], [50, 1550, 7000, 1500]);
assert.ok(call({ action: 'assign', oid: 'as1', target: 'o4', parts: [{ tochka: 'Точка 2', amount: '20' }, { tochka: 'Точка 1', amount: '30' }] }).ok);
assert.ok(!call({ action: 'assign', oid: 'as2', target: 'o4', parts: [{ tochka: 'Точка 2', amount: '20' }] }).ok, 'уже разнесено');
r = call({ action: 'list' }); assert.deepEqual([r.total.unassigned, r.total.out], [0, 1550]);
assert.ok(call({ action: 'void', oid: 'v1', target: 'o1' }).ok);
r = call({ action: 'point', name: 'Точка 1' });
assert.deepEqual([r.point.masters[0].paid, r.point.masters[0].left], [0, 2000]);
assert.ok(r.point.entries.every(e => e.oid !== 'o1'), 'отменённая запись не в истории');
assert.ok(!call({ action: 'void', oid: 'v2', target: 'nope' }).ok);
assert.ok(!call({ action: 'xyz', oid: 'z' }).ok);
// Личные деньги Асрора: отдельно от точек, в их итоги не попадают.
const before = JSON.stringify(call({ action: 'list' }).total);
assert.ok(call({ action: 'lich_add', oid: 'l1', kind: 'in', amount: '1000', note: 'зарплата' }).ok);
assert.ok(call({ action: 'lich_add', oid: 'l2', kind: 'out', amount: '300', note: 'заправка' }).ok);
assert.ok(call({ action: 'lich_add', oid: 'l2', kind: 'out', amount: '300' }).dup, 'повтор личной записи не удваивает');
assert.ok(!call({ action: 'lich_add', oid: 'l3', kind: 'xx', amount: '5' }).ok, 'вид только приход или расход');
assert.ok(!call({ action: 'lich_add', oid: 'l4', kind: 'out', amount: '-5' }).ok, 'минус');
assert.ok(!call({ action: 'lich_add', oid: 'l5', kind: 'out', amount: '' }).ok, 'пустая сумма');
r = call({ action: 'lich_list' });
assert.deepEqual([r.inn, r.out, r.left, r.entries.length], [1000, 300, 700, 2]);
assert.deepEqual([r.entries[0].kind, r.entries[0].komment], ['out', 'заправка'], 'новые сверху');
assert.equal(JSON.stringify(call({ action: 'list' }).total), before, 'личные деньги не меняют итоги объектов');
assert.ok(call({ action: 'point', name: 'Точка 1' }).point.entries.every(e => e.tip !== 'lichnoe'), 'в записях точки нет личных');
assert.ok(call({ action: 'void', oid: 'lv1', target: 'l2' }).ok, 'личную запись можно отменить');
r = call({ action: 'lich_list' });
assert.deepEqual([r.inn, r.out, r.left, r.entries.length], [1000, 0, 1000, 1]);
assert.equal(call({ action: 'lich_list' }, false).error, 'нет доступа', 'чужому кабинету личное не отдаётся');
assert.equal(table.filter(r => r.kabinet_kod !== 'KOD').length, 0, 'все строки с кодом кабинета');
console.log('ok - финансист по объектам: точки, приход, расход, мастера, отмена, разноска, личные деньги');
console.log('OBJEKTY PASSED');
