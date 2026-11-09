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
// фото чека: запись помечается «есть фото»
assert.ok(call({ action: 'out', oid: 'fo1', tochka: 'Точка 1', statya: 'material', amount: '10', foto: 1 }).ok);
assert.ok(call({ action: 'out', oid: 'fo2', tochka: 'Точка 1', statya: 'material', amount: '20' }).ok);
r = call({ action: 'point', name: 'Точка 1' }).point.entries;
assert.equal(r.find(e => e.oid === 'fo1').foto, true, 'с фото'); assert.equal(r.find(e => e.oid === 'fo2').foto, false, 'без фото');
assert.ok(call({ action: 'void', oid: 'fv1', target: 'fo1' }).ok); assert.ok(call({ action: 'void', oid: 'fv2', target: 'fo2' }).ok);
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
// переименование объекта: записи и итоги переходят на новое имя; повтор, занятое и пустое имя отклоняются
assert.ok(call({ action: 'add_point', oid: 'rn0', name: 'Абду' }).ok);
assert.ok(call({ action: 'in', oid: 'rn1', tochka: 'Абду', amount: '500', note: 'аванс' }).ok);
assert.ok(call({ action: 'out', oid: 'rn2', tochka: 'Абду', statya: 'master', master: 'Фарход', amount: '200' }).ok);
assert.ok(call({ action: 'master_set', oid: 'rn3', tochka: 'Абду', master: 'Фарход', amount: '1000' }).ok);
assert.equal(call({ action: 'rename', oid: 'rn4', tochka: 'Абду', name: 'Точка 1' }).error, 'такой объект уже есть');
assert.equal(call({ action: 'rename', oid: 'rn4', tochka: 'Абду', name: '  ' }).error, 'введите имя');
assert.equal(call({ action: 'rename', oid: 'rn4', tochka: 'Нет', name: 'Х' }).error, 'нет такого объекта');
assert.ok(call({ action: 'rename', oid: 'rn5', tochka: 'Абду', name: 'Абдулло' }).ok);
assert.ok(call({ action: 'rename', oid: 'rn5', tochka: 'Абду', name: 'Абдулло' }).dup, 'повтор не дублирует');
r = call({ action: 'list' });
assert.ok(!r.points.find(p => p.name === 'Абду') && r.points.find(p => p.name === 'Абдулло'), 'старого имени нет, новое есть');
const ab = r.points.find(p => p.name === 'Абдулло'); assert.deepEqual([ab.inn, ab.out, ab.left], [500, 200, 300], 'итоги переехали');
r = call({ action: 'point', name: 'Абдулло' }).point;
assert.equal(r.entries.length, 2, 'записи объекта на новом имени'); assert.equal(r.masters[0].left, 800, 'долг мастеру сохранился');
assert.equal(call({ action: 'point', name: 'Абду' }).error, 'нет такой точки');
assert.ok(call({ action: 'in', oid: 'rn6', tochka: 'Абдулло', amount: '100' }).ok, 'после переименования пишем в новое имя');
assert.ok(call({ action: 'rename', oid: 'rn7', tochka: 'Абдулло', name: 'Абду' }).ok, 'можно вернуть прежнее имя');
r = call({ action: 'point', name: 'Абду' }).point; assert.equal(r.entries.length, 3); assert.equal(r.inn, 600);
// долги
r = call({ action: 'debts' });
assert.ok(r.ok && r.total.mastersOwe >= 800, 'долги мастерам'); assert.ok(r.points.find(p => p.name === 'Абду').masters[0].left === 800);
// корзина: объект уходит в корзину вместе с записями, не считается в итогах, возвращается целым, удаляется навсегда
assert.ok(call({ action: 'add_point', oid: 'tr0', name: 'Лишний', zakazchik: 'Тест', dogovor: '1000' }).ok);
assert.ok(call({ action: 'in', oid: 'tr1', tochka: 'Лишний', amount: '400' }).ok); assert.ok(call({ action: 'out', oid: 'tr2', tochka: 'Лишний', statya: 'material', amount: '150' }).ok);
r = call({ action: 'list' }); const tBefore = r.total, nBefore = r.points.length; assert.equal(r.trash, 0, 'корзина пуста');
assert.ok(!call({ action: 'trash_point', oid: 'trx', tochka: 'Нет такого' }).ok, 'нет такого объекта');
assert.ok(call({ action: 'trash_point', oid: 'tr3', tochka: 'Лишний' }).ok);
assert.ok(call({ action: 'trash_point', oid: 'tr3', tochka: 'Лишний' }).dup, 'повтор не удваивает');
r = call({ action: 'list' });
assert.ok(!r.points.find(p => p.name === 'Лишний') && r.points.length === nBefore - 1 && r.trash === 1, 'в корзине: нет в списке, счётчик 1');
assert.deepEqual([r.total.inn, r.total.out], [tBefore.inn - 400, tBefore.out - 150], 'итоги без объекта из корзины');
assert.ok(r.recent.every(e => e.tochka !== 'Лишний'), 'в последних записях его нет');
assert.equal(call({ action: 'point', name: 'Лишний' }).error, 'нет такой точки');
assert.ok(!call({ action: 'in', oid: 'tr4', tochka: 'Лишний', amount: '5' }).ok, 'в корзину ничего не пишем');
assert.ok(!call({ action: 'add_point', oid: 'tr5', name: 'Лишний' }).ok, 'имя занято корзиной');
assert.ok(!call({ action: 'debts' }).points.find(p => p.name === 'Лишний'), 'в долгах его нет');
r = call({ action: 'trash_list' }); assert.ok(r.ok && r.points.length === 1 && r.points[0].name === 'Лишний' && r.points[0].inn === 400 && r.points[0].left === 250, 'корзина показывает объект с итогами');
assert.ok(!call({ action: 'restore_point', oid: 'tr6', tochka: 'Абду' }).ok, 'вернуть можно только из корзины');
assert.ok(call({ action: 'restore_point', oid: 'tr7', tochka: 'Лишний' }).ok);
r = call({ action: 'list' }); assert.deepEqual([r.total.inn, r.total.out, r.points.length, r.trash], [tBefore.inn, tBefore.out, nBefore, 0], 'после возврата всё как было');
r = call({ action: 'point', name: 'Лишний' }).point; assert.equal(r.entries.length, 2, 'записи вернулись вместе с объектом'); assert.equal(r.zakazchik, 'Тест');
assert.ok(call({ action: 'trash_point', oid: 'tr8', tochka: 'Лишний' }).ok);
assert.ok(call({ action: 'purge_point', oid: 'tr9', tochka: 'Лишний' }).ok);
assert.equal(call({ action: 'trash_list' }).points.length, 0, 'удалён навсегда: в корзине нет');
assert.ok(!call({ action: 'restore_point', oid: 'tr10', tochka: 'Лишний' }).ok, 'навсегда — не вернуть');
assert.ok(!call({ action: 'add_point', oid: 'tr11', name: 'Лишний' }).ok, 'имя не используется повторно, чтобы старые записи не смешались');
r = call({ action: 'list' }); assert.deepEqual([r.total.inn, r.total.out, r.trash], [tBefore.inn - 400, tBefore.out - 150, 0]);
// переименование и корзина вместе
assert.ok(call({ action: 'add_point', oid: 'tq0', name: 'Старое' }).ok); assert.ok(call({ action: 'rename', oid: 'tq1', tochka: 'Старое', name: 'Новое' }).ok);
assert.ok(call({ action: 'trash_point', oid: 'tq2', tochka: 'Новое' }).ok); assert.equal(call({ action: 'trash_list' }).points[0].name, 'Новое');
assert.ok(call({ action: 'restore_point', oid: 'tq3', tochka: 'Новое' }).ok); assert.ok(call({ action: 'list' }).points.find(p => p.name === 'Новое'));
console.log('OBJEKTY PASSED');
