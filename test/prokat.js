// «Финансист» проката в окне: window.html совпадает со specialists.cjs, есть пометка «к передаче» и блок аренд через окно владельца.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ok = (n) => console.log('ok -', n);
const src = fs.readFileSync(new URL('../specialists.cjs', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../window.html', import.meta.url), 'utf8');
const A = '/*specialists:start*/', B = '/*specialists:end*/';
assert.equal(html.slice(html.indexOf(A) + A.length, html.indexOf(B)), '\n' + src + '\n', 'window.html не пересобран: node build-specialists.js');
ok('window.html собран из specialists.cjs');
for (const need of ['p.rent_owed', "TX('к передаче')", 'function pkRentBlock(', "TX('Аренда через окно владельца')", 'r.owner_share', 'r.handovers', "TX('К передаче Нурулло 80%')", 'PK.cur.rent.owed']) assert.ok(src.includes(need), `нет: ${need}`);
ok('пометка «к передаче», блок «Аренда через окно владельца», сумма rent.owed в «Забрал деньги»');
for (const need of ["action: 'compare'", "TX('Сравнение пунктов')", "TX('Что стоит перевезти')", "TX('простаивает')", "action: 'reminders'", "TX('Напоминания')", "action: 'tour_point'", "action: 'tour_save'", "TX('Начать объезд')", 'PK_TOUR_BATCH = 5', 'accept="image/*" capture="environment" data-tphoto', "toDataURL('image/jpeg', ", '[900, 0.6]', "TX('объезда не было')", "TX('дн. назад')", "['на месте', 'сломан', 'нет']"]) assert.ok(src.includes(need), `нет: ${need}`);
assert.ok(!/Объезд скоро/.test(src), 'заглушка «Объезд скоро» убрана');
ok('сравнение пунктов, напоминания, объезд пачками по 5 с фото, «объезд N дн. назад»');
// Склад: код узла n8n «Склад: решить» (n8n/prokat/sklad.js) и экран.
const SK = fs.readFileSync(new URL('../n8n/prokat/sklad.js', import.meta.url), 'utf8');
const db = { st: [], ph: [] }; let nid = 1;
function sk(body, access = true) {
  const nodes = { 'Прокат: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: access } }], 'Склад': db.st.map(j => ({ json: j })), 'Фото склада': db.ph.map(j => ({ json: j })) };
  const $ = n => ({ first: () => nodes[n][0], all: () => nodes[n] });
  const r = new Function('$', '$input', SK)($, { first: () => ({ json: { op: 'none', resp: { ok: false, error: 'нет доступа' } } }) })[0].json;
  if (r.op === 'stock_insert') { r.rows.forEach(x => db.st.push(Object.assign({ id: nid++ }, x))); if (r.foto_row) db.ph.push(Object.assign({ id: nid++ }, r.foto_row)); }
  return r.resp;
}
assert.equal(sk({ action: 'stock' }, false).error, 'нет доступа', 'чужой кабинет не видит склад');
assert.equal(sk({ action: 'points' }).error, 'нет доступа', 'не складские действия проходят дальше без изменений');
assert.deepEqual(sk({ action: 'stock' }).stock, [], 'склад начинается пустым');
assert.ok(sk({ action: 'stock_move', name: '  Болгарка   большая ', state: 'сломан', delta: 3, id: 'aaaaaa1' }).ok);
assert.ok(sk({ action: 'stock_move', name: 'болгарка большая', state: 'сломан', delta: 3, id: 'aaaaaa1' }).dup, 'повтор с тем же id не задваивает');
assert.equal(sk({ action: 'stock_move', name: 'болгарка большая', state: 'починен', delta: -1, id: 'aaaaaa2' }).error, 'на складе столько нет');
assert.ok(sk({ action: 'stock_state', name: 'болгарка большая', from: 'сломан', to: 'в ремонте', qty: 2, id: 'bbbbbb1' }).ok);
assert.equal(sk({ action: 'stock_state', name: 'болгарка большая', from: 'сломан', to: 'в ремонте', qty: 2, id: 'bbbbbb2' }).error, 'на складе столько нет');
assert.ok(sk({ action: 'stock_move', name: 'Болгарка большая', part: 'Щётки', delta: 4, id: 'cccccc1' }).ok);
assert.equal(sk({ action: 'stock_move', name: 'Болгарка большая', part: 'щётки', delta: -5, id: 'cccccc2' }).error, 'на складе столько нет');
assert.equal(sk({ action: 'stock_move', name: 'Отбойный молоток', state: 'плохой', delta: 1, id: 'dddddd2' }).error, 'неверное состояние');
assert.ok(sk({ action: 'stock_move', name: 'Отбойный молоток', state: 'на запчасти', delta: 1, id: 'dddddd1' }).ok);
assert.ok(sk({ action: 'stock_photo', name: 'Перфоратор большой', photo: 'data:image/jpeg;base64,' + 'A'.repeat(500), id: 'eeeeee1' }).ok);
assert.equal(sk({ action: 'stock_photo', name: 'Перфоратор большой', photo: 'data:image/jpeg;base64,' + 'A'.repeat(70000), id: 'eeeeee2' }).error, 'фото не подходит', 'большое фото не принимается');
assert.ok(sk({ action: 'stock_move', name: 'Шуруповёрт', delta: 2, id: 'ffffff1' }).ok, 'старый вызов без состояния');
let s = sk({ action: 'stock' });
const g = s.stock.find(x => x.name === 'Болгарка большая');
assert.deepEqual(g.states, { 'сломан': 1, 'в ремонте': 2, 'починен': 0, 'на запчасти': 0 }); assert.equal(g.qty, 3);
assert.deepEqual(g.parts, [{ name: 'Щётки', qty: 4 }]);
assert.equal(s.stock.find(x => x.name === 'Шуруповёрт').states['починен'], 2);
assert.equal(s.totals['на запчасти'], 1); assert.equal(s.parts_total, 4);
assert.ok(s.stock.find(x => x.name === 'Перфоратор большой').photo_date, 'вид с фото виден и без количества');
assert.ok(sk({ action: 'stock_photo_get', name: 'перфоратор большой' }).photo.startsWith('data:image/jpeg'));
ok('сервер склада: состояния, смена состояния, запчасти, фото, защита от повтора и минуса');
for (const need of ["action: 'stock_state'", "action: 'stock_photo'", "action: 'stock_photo_get'", "['сломан', 'в ремонте', 'починен', 'на запчасти']", "TX('Запчасти')", "TX('Новый инструмент')", "TX('Сменить состояние')", 'u.length <= 58000']) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран склада: иконки видов с фото, состояния, запчасти');
console.log('PROKAT PASSED');
