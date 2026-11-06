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
assert.equal(table.filter(r => r.kabinet_kod !== 'KOD').length, 0, 'все строки с кодом кабинета');
console.log('ok - финансист по объектам: точки, приход, расход, мастера, отмена, разноска');
console.log('OBJEKTY PASSED');
