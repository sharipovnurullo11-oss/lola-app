// «Финансист» проката в окне: window.html совпадает со specialists.cjs, есть пометка «к передаче» и блок аренд через окно владельца.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ok = (n) => console.log('ok -', n);
const src = fs.readFileSync(new URL('../specialists.cjs', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../window.html', import.meta.url), 'utf8');
const A = '/*specialists:start*/', B = '/*specialists:end*/';
assert.equal(html.slice(html.indexOf(A) + A.length, html.indexOf(B)), '\n' + src + '\n', 'window.html не пересобран: node build-specialists.js');
ok('window.html собран из specialists.cjs');
for (const need of ['p.rent_owed', "TX('к передаче')", 'function pkRentBlock(', "TX('Аренда через окно владельца')", 'r.owner_share', 'r.handovers', "TX('К передаче Нурулло')", 'PK.cur.rent.owed']) assert.ok(src.includes(need), `нет: ${need}`);
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
// Фото-история инструментов пункта: узлы n8n «История фото» и «Собрать ответ» (вебхук /prokat-foto).
const HIST = fs.readFileSync(new URL('../n8n/prokat/istoriya-foto.js', import.meta.url), 'utf8'), SOBR = fs.readFileSync(new URL('../n8n/prokat/sobrat-otvet.js', import.meta.url), 'utf8');
const PT = 'Зарафшон сити';
const HD = {
  'Фото по точкам': [
    { id: 1, tochka: PT, instrument: 'Перфаратори майда 1 Тотал 950 вата', data_foto: '24.04.2026', mesyac: '2026-04', drive_file_id: 'f2', stroka_lista: 4 },
    { id: 2, tochka: PT, instrument: 'Перфаратори майда 1 Тотал 950 вата', data_foto: '22.02.2026', mesyac: '2026-02', drive_file_id: 'f1', stroka_lista: 4 },
    { id: 3, tochka: PT, instrument: '', data_foto: '22.02.2026', mesyac: '2026-02', drive_file_id: 'f3', stroka_lista: 4 },
    { id: 4, tochka: PT, instrument: '', data_foto: '', mesyac: '2026-03', drive_file_id: 'f4', stroka_lista: 11 },
    { id: 5, tochka: 'Другой', instrument: 'Лобзик', data_foto: '01.01.2026', drive_file_id: 'x' }],
  'Записи инструментов': [{ id: 1, tip: 'Инструмент', tochka: PT, instrument: 'Перфаратори майда 1 Тотал 950 вата', kolvo: 1 }, { id: 2, tip: 'Инструмент', tochka: PT, instrument: 'Лобзик', kolvo: 2 }],
  'Подписи фото': [],
  'Цены': [{ id: 1, instrument: 'Маленький перфоратор', srok: 'сутки', cena: 40, primechanie: 'ровно 24 часа' }, { id: 2, instrument: 'Маленький перфоратор', srok: 'коротко', cena: 30, primechanie: 'до 3 часов' }, { id: 3, instrument: 'Лобзик', srok: 'сутки', cena: 40, primechanie: '' }],
  'Визиты': [{ id: 1, tochka: PT, instrument: 'Перфаратори майда 1  Тотал 950 вата', data_vizita: '2026-10-20', foto_ssylka: 'v1', sostoyanie: 'на месте', zametka: '' }]
};
function hist(body, access = true) {
  const nodes = Object.assign({ 'Фото: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: access } }] }, Object.fromEntries(Object.entries(HD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
  const $ = n => ({ first: () => nodes[n][0], all: () => nodes[n] });
  const items = new Function('$', '$input', HIST)($, { all: () => [{ json: { fid: 'old', instrument: 'старое', date: '01.01.2026', total: 1 } }] });
  nodes['История фото'] = items;
  nodes['Аренды'] = []; nodes['Перевозки'] = [];
  nodes['Статус инструментов'] = new Function('$', '$input', fs.readFileSync(new URL('../n8n/prokat/status.js', import.meta.url), 'utf8'))($, { all: () => items });
  nodes['Миниатюра Drive'] = items.map(i => ({ json: { thumbnailLink: i.json.fid ? 'https://lh3.googleusercontent.com/' + i.json.fid + '=s220' : undefined } }));
  return new Function('$', SOBR)($)[0].json.resp;
}
assert.equal(hist({ action: 'tools', name: PT }, false).error, 'нет доступа');
assert.deepEqual(hist({ name: PT }).photos.map(p => p.id), ['old'], 'старый запрос фото пункта работает как раньше');
let hr = hist({ action: 'tools', name: PT });
assert.deepEqual(hr.tools.map(t => [t.name, t.count, t.qty]), [['Лобзик', 0, 2], ['Перфаратори майда 1 Тотал 950 вата', 4, 1], ['Без названия', 1, 0]], 'инструменты пункта; фото без названия берёт имя из своей строки таблицы');
assert.equal(hr.tools[1].url, 'https://lh3.googleusercontent.com/v1=s900', 'на иконке последнее фото'); assert.equal(hr.tools[0].url, '');
hr = hist({ action: 'tool', name: PT, tool: 'перфаратори майда 1 тотал 950 вата' });
assert.deepEqual(hr.photos.map(p => [p.date, p.src]), [['2026-02-22', 'таблица'], ['2026-02-22', 'таблица'], ['2026-04-24', 'таблица'], ['2026-10-20', 'объезд']], 'все фото инструмента по датам, со старых до объезда');
assert.equal(hist({ action: 'tool', name: PT, tool: 'нет такого' }).error, 'инструмент не найден');
assert.deepEqual([hr.kind, hr.prices.map(p => [p.srok, p.cena])], ['Маленький перфоратор', [['коротко', 30], ['сутки', 40]]], 'цена из прайса: «Перфаратори майда» = маленький перфоратор');
assert.equal(hist({ action: 'tools', name: PT }).tools[0].prices[0].cena, 40, 'цена на иконке лобзика');
assert.equal(hist({ action: 'tools', name: PT }).tools[2].kind, '', 'без названия — без цены');
HD['Записи инструментов'].push({ id: 3, tip: 'Инструмент', tochka: PT, instrument: 'Кафедорез', kolvo: 1 }); HD['Цены'].push({ id: 4, instrument: 'Кафелерез', srok: 'час', cena: 30, primechanie: 'за час' });
assert.deepEqual(hist({ action: 'tools', name: PT }).tools.find(t => t.name === 'Кафедорез').prices.map(p => [p.srok, p.cena]), [['час', 30]], 'кафедорез = кафелерез, цена за час');
ok('фото-история: инструменты пункта, фото по датам, фото объездов, цены из прайса');
// Подписи фото: ИИ подписал фото без названия, владелец переносит фото кнопкой «Это другой инструмент».
HD['Подписи фото'].push({ id: 1, drive_file_id: 'f4', tochka: PT, instrument: 'Болгарка №1' });
hr = hist({ action: 'tools', name: PT });
assert.ok(hr.tools.some(t => t.name === 'Болгарка №1' && t.count === 1) && !hr.tools.some(t => t.name === 'Без названия'), 'фото без названия ушло в «Болгарка №1» по подписи');
function histRaw(body) {
  const nodes = Object.assign({ 'Фото: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: true } }] }, Object.fromEntries(Object.entries(HD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
  return new Function('$', '$input', HIST)(n => ({ first: () => nodes[n][0], all: () => nodes[n] }), { all: () => [] })[0].json;
}
let rl = histRaw({ action: 'relabel', name: PT, fid: 'f2', tool: 'Лобзик' });
assert.deepEqual([rl.resp.ok, rl.label_row.drive_file_id, rl.label_row.instrument, rl.label_row.tochka], [true, 'f2', 'Лобзик', PT]);
assert.equal(histRaw({ action: 'relabel', name: PT, fid: 'чужое', tool: 'Лобзик' }).resp.error, 'фото не найдено на этом пункте', 'чужое фото не переподписать');
assert.equal(histRaw({ action: 'relabel', name: PT, fid: 'f2', tool: '  ' }).resp.error, 'выберите инструмент');
HD['Подписи фото'].push(Object.assign({ id: 2 }, rl.label_row));
assert.equal(hist({ action: 'tool', name: PT, tool: 'Лобзик' }).photos[0].id, 'f2', 'после переноса фото в истории лобзика');
ok('подписи фото: ИИ-подписи и «Это другой инструмент»');

for (const need of ["action: 'tools'", "action: 'tool'", 'function renderPkToolHist(', "TX('Фото по датам, от первого к последнему')", '📅 ']) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран фото-истории: иконки инструментов в пункте, фото с датой');
// Перевозки (узел «Перевозки: решить») и окно владельца (узлы «Решить», «Свежее фото»).
const MV = fs.readFileSync(new URL('../n8n/prokat/perevozki.js', import.meta.url), 'utf8');
const MD = { 'Итоги по точкам': [{ id: 1, tochka: 'Зарафшон сити', gorod: 'Душанбе' }, { id: 2, tochka: 'Ховарон', gorod: 'Душанбе' }],
  'Инструменты пунктов': [{ id: 10, tip: 'Инструмент', tochka: 'Зарафшон сити', instrument: 'Фен', kolvo: 1 }, { id: 11, tip: 'Инструмент', tochka: 'Зарафшон сити', instrument: 'Шрупаверт', kolvo: 2 }],
  'Склад': [{ id: 1, instrument: 'Болгарка большая', izmenenie: 2, sostoyanie: 'починен', zapchast: '' }], 'Перевозки': [] };
function mv(body, access = true) {
  const nodes = Object.assign({ 'Прокат: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: access } }] }, Object.fromEntries(Object.entries(MD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
  return new Function('$', '$input', MV)(n => ({ first: () => nodes[n][0], all: () => nodes[n] }), { first: () => ({ json: { op: 'none', resp: { pass: 1 } } }) })[0].json;
}
assert.equal(mv({ action: 'move' }, false).resp.pass, 1, 'чужой кабинет — дальше без изменений');
let m = mv({ action: 'move', from: 'Зарафшон сити', to: 'Ховарон', tool: 'фен', qty: 1, id: 'mmmmmm1' });
assert.deepEqual([m.op, m.upd, m.ins.tochka, m.stock], ['move', { id: 10, kolvo: 0, tip: 'Перевезён' }, 'Ховарон', null], 'пункт → пункт: убавить там, добавить здесь');
m = mv({ action: 'move', from: 'Зарафшон сити', to: 'Склад', tool: 'Шрупаверт', qty: 1, state: 'в ремонте', id: 'mmmmmm2' });
assert.deepEqual([m.upd.kolvo, m.ins, m.stock.izmenenie, m.stock.sostoyanie], [1, null, 1, 'в ремонте'], 'пункт → склад: со состоянием');
m = mv({ action: 'move', from: 'Склад', to: 'Ховарон', tool: 'болгарка большая', qty: 2, id: 'mmmmmm3' });
assert.deepEqual([m.stock.izmenenie, m.ins.kolvo], [-2, 2], 'склад → пункт');
assert.equal(mv({ action: 'move', from: 'Склад', to: 'Ховарон', tool: 'Болгарка большая', qty: 3, id: 'mmmmmm4' }).resp.ok, false, 'со склада не больше, чем есть');
assert.equal(mv({ action: 'move', from: 'Зарафшон сити', to: 'Ховарон', tool: 'Фен', qty: 2, id: 'mmmmmm6' }).resp.ok, false, 'с пункта не больше, чем есть');
MD['Перевозки'].push({ id: 1, oid: 'mmmmmm1', data: '2026-10-26', instrument: 'Фен', iz: 'Зарафшон сити', v: 'Ховарон', kolvo: 1 });
assert.equal(mv({ action: 'move', from: 'Зарафшон сити', to: 'Ховарон', tool: 'фен', qty: 1, id: 'mmmmmm1' }).resp.dup, true, 'повтор не задваивает');
assert.equal(mv({ action: 'moves', name: 'Ховарон', tool: 'Фен' }).resp.moves[0].from, 'Зарафшон сити');
ok('перевозки: пункт ↔ пункт, пункт ↔ склад, журнал, защита от повтора и минуса');
m = mv({ action: 'move', from: 'Куплен', to: 'Ховарон', tool: '  Болгарка   большая ', qty: 2, price: 850, id: 'buy0001' });
assert.deepEqual([m.op, m.upd, m.stock, m.ins.tochka, m.ins.gorod, m.ins.kolvo, m.ins.istochnik, m.log.iz, m.log.cena, m.resp.moved.price], ['move', null, null, 'Ховарон', 'Душанбе', 2, 'покупка', 'Куплен', 1700, 1700], 'покупка: добавить на пункт, в журнале цена за всё');
m = mv({ action: 'move', from: 'Куплен', to: 'Ховарон', tool: 'Лобзик', qty: 1, id: 'buy0002' });
assert.deepEqual([m.resp.ok, m.log.cena, m.ins.instrument], [true, 0, 'Лобзик'], 'покупка без цены');
assert.equal(mv({ action: 'move', from: 'Куплен', to: 'Склад', tool: 'Лобзик', qty: 1, id: 'buy0003' }).resp.error, 'выберите пункт', 'покупка только на пункт');
assert.equal(mv({ action: 'move', from: 'Куплен', to: 'Нет такого', tool: 'Лобзик', qty: 1, id: 'buy0004' }).resp.error, 'выберите пункт');
assert.equal(mv({ action: 'move', from: 'Куплен', to: 'Ховарон', tool: '', qty: 1, id: 'buy0005' }).resp.error, 'выберите инструмент');
assert.equal(mv({ action: 'move', from: 'Куплен', to: 'Ховарон', tool: 'Лобзик', qty: 1, price: -5, id: 'buy0006' }).resp.error, 'неверная цена покупки');
assert.equal(mv({ action: 'move', from: 'Куплен', to: 'Ховарон', tool: 'Лобзик', qty: 1, price: 'abc', id: 'buy0007' }).resp.error, 'неверная цена покупки');
assert.equal(mv({ action: 'move', from: 'Нет такого', to: 'Ховарон', tool: 'Лобзик', qty: 1, id: 'buy0008' }).resp.error, 'выберите, откуда и куда', 'выдуманное «откуда» не проходит');
ok('новый инструмент на пункт: покупка с ценой и без, только на пункт');
const OW = fs.readFileSync(new URL('../n8n/prokat/vladelets-reshit.js', import.meta.url), 'utf8'), SV = fs.readFileSync(new URL('../n8n/prokat/svezhee-foto.js', import.meta.url), 'utf8');
const TK = 'tttttttttttttttttttttttttttttttt';
const OD = { 'Владелец по ссылке': [{ id: 1, token: TK, tochka: 'Зарафшон сити', aktivno: true }],
  'Записи инструментов': [{ id: 1, tip: 'Инструмент', tochka: 'Зарафшон сити', instrument: 'Фен', kolvo: 1 }, { id: 2, tip: 'Перевезён', tochka: 'Зарафшон сити', instrument: 'Лобзик', kolvo: 0 }],
  'Фото по точкам': [{ id: 1, tochka: 'Зарафшон сити', instrument: 'Лобзик', drive_file_id: 'L' }, { id: 3, tochka: 'Зарафшон сити', instrument: 'Фен', drive_file_id: 'F1', data_foto: '22.02.2026' }, { id: 4, tochka: 'Зарафшон сити', instrument: 'Фен', drive_file_id: 'F2', data_foto: '19.05.2026' }],
  'Визиты': [], 'Аренды': [], 'Цены': [], 'Доли пунктов': [] };
const onodes = body => Object.assign({ 'Владелец: запрос': [{ json: { body } }] }, Object.fromEntries(Object.entries(OD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
let on = onodes({ token: TK });
let ow = new Function('$', OW)(n => ({ first: () => on[n][0], all: () => on[n] }))[0].json;
assert.deepEqual(ow.resp.tools.map(t => t.name), ['Фен'], 'окно владельца: перевезённый лобзик не возвращается по старому фото');
ow = new Function('$', '$input', SV)(n => ({ all: () => on[n] }), { first: () => ({ json: ow }) })[0].json;
assert.equal(ow.resp.tools[0].photo_id, 'F2', 'окно владельца: на карточке самое свежее фото');
ok('окно владельца: перевезённый инструмент не показывается, свежее фото для «было → стало»');
for (const need of ["action: 'move'", "action: 'moves'", 'function pkMoveForm(', "TX('Продать')", "TX('Отвезти на пункт')"]) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран перевозок: из истории инструмента и со склада');
// Ссылка владельца (узел «Ссылки: решить»).
const SL = fs.readFileSync(new URL('../n8n/prokat/ssylki.js', import.meta.url), 'utf8');
const SD = { 'Итоги по точкам': [{ id: 1, tochka: 'Зарафшон сити' }], 'Владельцы пунктов': [{ id: 1, token: 'a'.repeat(32), tochka: 'Зарафшон сити', vladelets: 'Суҳроб', aktivno: false }, { id: 2, token: 'b'.repeat(32), tochka: 'Зарафшон сити', vladelets: 'Суҳроб', aktivno: true, createdAt: '2026-10-23T10:00:00Z' }], 'Случайный ключ': [{ id: 0, rand: 'c'.repeat(64) }] };
function sl(body, access = true) {
  const nodes = Object.assign({ 'Прокат: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: access } }] }, Object.fromEntries(Object.entries(SD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
  return new Function('$', '$input', SL)(n => ({ first: () => nodes[n][0], all: () => nodes[n] }), { first: () => ({ json: { op: 'none', resp: { pass: 1 } } }) })[0].json;
}
assert.equal(sl({ action: 'owner_link', name: 'Зарафшон сити' }, false).resp.pass, 1, 'чужой кабинет — дальше без изменений');
assert.equal(sl({ action: 'points' }).resp.pass, 1, 'другие действия — дальше без изменений');
let s1 = sl({ action: 'owner_link', name: 'Зарафшон сити' });
assert.deepEqual([s1.op, s1.resp.link, s1.resp.owner, s1.resp.since], ['none', 'https://app.nurullo-sharipov.tech/punkt#t=' + 'b'.repeat(32), 'Суҳроб', '2026-10-23'], 'показ: действующая ссылка, отключённая не берётся');
assert.equal(sl({ action: 'owner_link', name: 'Нет такого' }).resp.ok, false);
assert.equal(sl({ action: 'owner_link_new', name: 'Зарафшон сити', id: 'x' }).resp.ok, false, 'без номера записи не выдаём');
s1 = sl({ action: 'owner_link_new', name: 'Зарафшон сити', id: 'olnew01' });
assert.deepEqual([s1.op, s1.row.token, s1.row.tochka, s1.row.vladelets, s1.row.aktivno, s1.row.oid], ['owner_link', 'c'.repeat(32), 'Зарафшон сити', 'Суҳроб', true, 'olnew01'], 'новая ссылка: запись строки, владелец тот же');
SD['Владельцы пунктов'].push({ id: 3, token: 'c'.repeat(32), tochka: 'Зарафшон сити', vladelets: 'Суҳроб', aktivno: true, oid: 'olnew01' });
s1 = sl({ action: 'owner_link_new', name: 'Зарафшон сити', id: 'olnew01' });
assert.deepEqual([s1.op, s1.resp.dup, s1.resp.link.slice(-32)], ['none', true, 'c'.repeat(32)], 'повтор не выдаёт вторую ссылку');
ok('ссылка владельца: показ, новая вместо старой, защита от повтора');
for (const need of ["action: 'owner_link'", "action: 'owner_link_new'", 'function pkOlBlock(', "TX('Ссылка владельца')", "TX('Старая ссылка сразу перестанет работать. Владелец войдёт только по новой. Выдать новую ссылку?')", 'https://wa.me/?text=']) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран ссылки владельца: копировать, WhatsApp, новая ссылка с подтверждением');
// Цветной статус инструмента (узел «Статус инструментов» в /prokat-foto).
const ST = fs.readFileSync(new URL('../n8n/prokat/status.js', import.meta.url), 'utf8');
const day = n => new Date(Date.now() + 5 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
const TD = { 'Аренды': [{ id: 1, tochka: 'Ховарон', instrument: 'Фен', status: 'в аренде', nachalo: day(0), summa: 80 }, { id: 2, tochka: 'Ховарон', instrument: 'Лобзик', status: 'сломан', nachalo: day(20), summa: 0 }],
  'Визиты': [{ id: 1, tochka: 'Ховарон', instrument: 'Миксер', sostoyanie: 'сломан', data_vizita: day(3) }, { id: 2, tochka: 'Ховарон', instrument: 'Дрель', sostoyanie: 'нет', data_vizita: day(5) }],
  'Перевозки': [{ id: 1, data: day(2), instrument: 'Болгарка', iz: 'Ховарон', v: 'Склад', kolvo: 1, sostoyanie: 'в ремонте' }, { id: 2, data: day(2), instrument: 'Пила', iz: 'Ховарон', v: 'Зарнисор', kolvo: 1 }],
  'Записи инструментов': [{ id: 1, tip: 'Инструмент', tochka: 'Ховарон', instrument: 'Фен', kolvo: 1 }] };
function stat(items) {
  const nodes = Object.fromEntries(Object.entries(TD).map(([k, v]) => [k, v.map(j => ({ json: j }))]));
  return new Function('$', '$input', ST)(n => ({ all: () => nodes[n] }), { all: () => items.map(j => ({ json: j })) }).map(i => i.json);
}
const tl = stat(['Фен', 'Лобзик', 'Миксер', 'Дрель', 'Болгарка', 'Пила', 'Старое'].map((n, i) => ({ mode: 'tools', point: 'Ховарон', name: n, qty: i < 4 ? 1 : 0 })));
assert.deepEqual(tl.map(t => t.status), ['ok', 'pickup', 'broken', 'lost', 'repair', 'moved', ''], 'статусы: работает, забрать, сломан, потерян, в ремонте, перевезён, нет данных');
assert.deepEqual([tl[0].out, tl[0].month_income], [1, 80], 'в аренде и доход за месяц');
assert.ok(/^сломан 20 дн/.test(tl[1].status_text) && tl[5].status_text === 'перевезён: Зарнисор');
assert.equal(stat([{ skip: true, resp: { ok: true, point: 'Ховарон', tool: 'Фен', photos: [] } }])[0].resp.status, 'ok', 'инструмент без фото тоже со статусом');
assert.equal(stat([{ skip: true, resp: { ok: false, error: 'нет доступа' } }])[0].resp.status, undefined, 'ошибки проходят без изменений');
ok('цветной статус инструмента и доход за месяц');
for (const need of ['function pkTStatus(', "TX('нужно забрать')", "TX('Доход за этот месяц')", 'pkTStatus(pt.st, true)']) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран: статус на иконке и в карточке инструмента');
// Доля пункта с аренды (узел «Доля: решить» в /prokat и «Решить» в окне владельца).
const DL = fs.readFileSync(new URL('../n8n/prokat/dolya.js', import.meta.url), 'utf8');
const DD = { 'Итоги по точкам': [{ id: 1, tochka: 'Ховарон' }, { id: 2, tochka: 'Зарнисор' }], 'Доли пунктов': [{ id: 1, tochka: '*', dolya: 20, oid: 'init' }] };
function dl(body, access = true) {
  const nodes = Object.assign({ 'Прокат: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: access } }] }, Object.fromEntries(Object.entries(DD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
  return new Function('$', '$input', DL)(n => ({ first: () => nodes[n][0], all: () => nodes[n] }), { first: () => ({ json: { op: 'none', resp: { pass: 1 } } }) })[0].json;
}
assert.equal(dl({ action: 'share_get' }, false).resp.pass, 1, 'чужой кабинет — дальше без изменений');
assert.deepEqual(dl({ action: 'share_get', name: 'Ховарон' }).resp.point, { name: 'Ховарон', pct: 20, own: false }, 'по умолчанию общая 20%');
let d1 = dl({ action: 'share_set', name: 'Ховарон', pct: 25, id: 'shshsh1' });
assert.deepEqual([d1.op, d1.row.tochka, d1.row.dolya, d1.resp.point.pct, d1.resp.point.own], ['share_set', 'Ховарон', 25, 25, true], 'своя доля пункта');
assert.equal(dl({ action: 'share_set', pct: 60, id: 'shshsh2' }).resp.ok, false, 'больше 50% нельзя');
assert.equal(dl({ action: 'share_set', name: 'Нет', pct: 10, id: 'shshsh3' }).resp.ok, false, 'чужой пункт');
DD['Доли пунктов'].push({ id: 2, tochka: 'Ховарон', dolya: 25, oid: 'shshsh1' }, { id: 3, tochka: '*', dolya: 15, oid: 'shshsh4' });
assert.deepEqual([dl({ action: 'share_get', name: 'Ховарон' }).resp.point.pct, dl({ action: 'share_get', name: 'Зарнисор' }).resp.point.pct], [25, 15], 'своя доля важнее общей');
assert.equal(dl({ action: 'share_set', name: 'Ховарон', pct: 25, id: 'shshsh1' }).resp.dup, true, 'повтор не записывается');
d1 = dl({ action: 'share_set', name: 'Ховарон', reset: true, id: 'shshsh5' });
assert.deepEqual([d1.row.dolya, d1.resp.point.pct, d1.resp.point.own], [-1, 15, false], 'вернуть общую');
DD['Доли пунктов'].push({ id: 4, tochka: 'Ховарон', dolya: -1, oid: 'shshsh5' });
assert.equal(dl({ action: 'share_get', name: 'Ховарон' }).resp.point.pct, 15);
ok('доля пункта: общая, своя, вернуть общую, защита от повтора');
on = onodes({ token: TK }); on['Доли пунктов'] = [{ json: { id: 1, tochka: '*', dolya: 20 } }, { json: { id: 2, tochka: 'Зарафшон сити', dolya: 30 } }];
ow = new Function('$', OW)(n => ({ first: () => on[n][0], all: () => on[n] }))[0].json;
assert.equal(ow.resp.pct, 30, 'окно владельца получает свою долю пункта');
for (const need of ["action: 'share_get'", "action: 'share_set'", 'function pkShBlock(', "TX('Доля пункта с аренды')", "TX('Вернуть общую')"]) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран доли пункта в карточке');
// PIN к ссылке владельца: задать в Финансисте (owner_pin), проверка в окне владельца, блокировка после 10 ошибок.
s1 = sl({ action: 'owner_pin', name: 'Зарафшон сити', pin: '12a4' });
assert.equal(s1.resp.ok, false, 'PIN только 4 цифры');
s1 = sl({ action: 'owner_pin', name: 'Зарафшон сити', pin: '4321' });
assert.deepEqual([s1.op, s1.pin, s1.pin_row, s1.resp.pin], ['owner_pin', '4321', 3, '4321'], 'PIN пишется в действующую ссылку');
assert.equal(sl({ action: 'owner_pin', name: 'Зарафшон сити', pin: '' }).pin, '', 'PIN можно убрать');
SD['Владельцы пунктов'][2].pin = '4321';
s1 = sl({ action: 'owner_link', name: 'Зарафшон сити' });
assert.deepEqual([s1.resp.pin, s1.resp.locked], ['4321', false], 'Финансист видит PIN');
s1 = sl({ action: 'owner_link_new', name: 'Зарафшон сити', id: 'olnew02' });
assert.deepEqual([s1.row.pin, s1.row.pin_oshibki], ['4321', 0], 'новая ссылка сохраняет PIN');
const pinRun = (pin, row) => { const n = onodes(Object.assign({ token: TK }, pin == null ? {} : { pin: pin })); n['Доли пунктов'] = []; n['Владелец по ссылке'] = [{ json: Object.assign({ id: 1, token: TK, tochka: 'Зарафшон сити', aktivno: true }, row) }]; return new Function('$', OW)(x => ({ first: () => n[x][0], all: () => n[x] }))[0].json; };
assert.equal(pinRun(null, {}).resp.ok, true, 'без PIN входит как раньше');
let pr = pinRun(null, { pin: '4321' });
assert.deepEqual([pr.resp.ok, pr.resp.need_pin, pr.op], [false, true, 'none'], 'с PIN — сначала спросить PIN');
pr = pinRun('1111', { pin: '4321', pin_oshibki: 3 });
assert.deepEqual([pr.resp.need_pin, pr.op, pr.fails, pr.pin_row], [true, 'pin_fail', 4, 1], 'неверный PIN считается');
assert.ok(/Осталось попыток: 6/.test(pr.resp.error));
assert.equal(pinRun('4321', { pin: '4321', pin_oshibki: 3 }).resp.ok, true, 'верный PIN пускает');
pr = pinRun('4321', { pin: '4321', pin_oshibki: 10 });
assert.deepEqual([pr.resp.ok, pr.resp.locked], [false, true], 'после 10 ошибок заблокировано даже с верным PIN');
ok('PIN к ссылке владельца: задать, убрать, проверка, блокировка после 10 ошибок');
for (const need of ["action: 'owner_pin'", 'function pkOlPin(', "'Задать PIN'", "'Убрать PIN'"]) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран PIN в карточке пункта');
// Утренние напоминания: текст уведомления собирает сервер приложения только из чисел.
const { textFor } = await import('../push.js');
assert.deepEqual(textFor({ kind: 'prokat_remind', visit: 3, owed: 2, owed_sum: 1234.5, broken: 1 }), { title: 'Прокат: напоминания', body: 'объезд: 3 пункт. давно не было · долг: 2 пункт. на 1 235 сомони · сломано больше 14 дн.: 1' });
assert.equal(textFor({ kind: 'prokat_remind', visit: 0 }), null, 'нечего напоминать — не шлём');
assert.ok(!/<|script/.test(textFor({ kind: 'prokat_remind', visit: '<script>', owed: 1, owed_sum: 'x' }).body), 'в текст попадают только числа');
for (const need of ["data-pk=\"push\"", "TX('Присылать напоминания на этот телефон')", "S.view === 'prokat'"]) assert.ok(src.includes(need), `нет: ${need}`);
ok('утренние напоминания проката на телефон');
// Продажа = перевозка «в Продан» с ценой.
assert.equal(mv({ action: 'move', from: 'Зарафшон сити', to: 'Продан', tool: 'Шрупаверт', qty: 1, id: 'sell001' }).resp.error, 'укажите цену продажи', 'без цены не продаём');
m = mv({ action: 'move', from: 'Зарафшон сити', to: 'Продан', tool: 'Шрупаверт', qty: 1, price: 350, id: 'sell002' });
assert.deepEqual([m.op, m.upd.kolvo, m.ins, m.stock, m.log.v, m.log.cena, m.resp.moved.price], ['move', 1, null, null, 'Продан', 350, 350], 'продажа с пункта: убавить, никуда не добавлять, цена в журнале');
m = mv({ action: 'move', from: 'Склад', to: 'Продан', tool: 'Болгарка большая', qty: 1, price: 200, state: 'починен', id: 'sell003' });
assert.deepEqual([m.stock.izmenenie, m.stock.primechanie, m.ins], [-1, 'продан', null], 'продажа со склада');
TD['Перевозки'].push({ id: 3, data: day(1), instrument: 'Рубанок', iz: 'Ховарон', v: 'Продан', kolvo: 1, cena: 300 });
assert.deepEqual(stat([{ mode: 'tools', point: 'Ховарон', name: 'Рубанок', qty: 0 }]).map(t => [t.status, t.status_text]), [['sold', 'продан за 300 смн']], 'статус «продан»');
ok('продажа инструмента с пункта и со склада');
// Закупочные цены и окупаемость (узел «Окупаемость: решить» в /prokat).
const OK = fs.readFileSync(new URL('../n8n/prokat/okupaemost.js', import.meta.url), 'utf8');
const OKD = { 'Итоги по точкам': [{ id: 1, tochka: 'Ховарон', dohod: 300 }, { id: 2, tochka: 'Зарнисор', dohod: 0 }],
  'Инструменты пунктов': [{ id: 1, tip: 'Инструмент', tochka: 'Ховарон', instrument: 'Балгаркаи калон', kolvo: 2 }, { id: 2, tip: 'Инструмент', tochka: 'Ховарон', instrument: 'Фен', kolvo: 1 }, { id: 3, tip: 'Инструмент', tochka: 'Ховарон', instrument: 'Непонятное', kolvo: 1 }, { id: 4, tip: 'Перевезён', tochka: 'Ховарон', instrument: 'Лобзик', kolvo: 0 }, { id: 5, tip: 'Инструмент', tochka: 'Зарнисор', instrument: 'Фен', kolvo: 1 }],
  'Аренды': [{ id: 1, tochka: 'Ховарон', instrument: 'Фен', status: 'вернули', dolya_nurullo: 64 }, { id: 2, tochka: 'Ховарон', instrument: 'Фен', status: 'сдача', dolya_nurullo: 64 }],
  'Перевозки': [{ id: 1, iz: 'Ховарон', v: 'Продан', instrument: 'Лобзик', cena: 100 }],
  'Закупочные цены': [{ id: 1, instrument: 'Большая болгарка', cena: 500, data: '2026-10-27' }, { id: 2, instrument: 'Строительный фен', cena: 200 }, { id: 3, instrument: 'Строительный фен', cena: 300 }] };
function okp(body) {
  const nodes = Object.assign({ 'Прокат: запрос': [{ json: { body } }], 'Кабинет': [{ json: { ok: true } }] }, Object.fromEntries(Object.entries(OKD).map(([k, v]) => [k, v.map(j => ({ json: j }))])));
  return new Function('$', '$input', OK)(n => ({ first: () => nodes[n][0], all: () => nodes[n] }), { first: () => ({ json: { op: 'none', resp: { pass: 1 } } }) })[0].json;
}
assert.equal(okp({ action: 'points' }).resp.pass, 1, 'другие действия — дальше без изменений');
let ob = okp({ action: 'buy_prices' }).resp;
assert.deepEqual([ob.kinds.find(k => k.kind === 'Строительный фен').price, ob.kinds.find(k => k.kind === 'Большая болгарка').on_points, ob.kinds.find(k => k.kind === 'Лобзик').price, ob.unknown], [300, 2, null, [{ name: 'Непонятное', qty: 1 }]], 'последняя цена вида, сколько на пунктах, без цены, непонятные названия');
ob = okp({ action: 'buy_price_set', kind: 'Лобзик', price: 250, id: 'buy0001' });
assert.deepEqual([ob.op, ob.row.instrument, ob.row.cena], ['buy_price_set', 'Лобзик', 250]);
assert.equal(okp({ action: 'buy_price_set', kind: 'Ракета', price: 1, id: 'buy0002' }).resp.ok, false, 'только известные виды');
ob = okp({ action: 'payback', name: 'Ховарон' }).resp;
assert.deepEqual([ob.cost, ob.income, ob.sold, ob.no_price, ob.percent], [1300, 364, 100, 1, 36], 'окупаемость: 2×500 + 300; доход 300 + 64 с аренды; продажа 100; (364+100)/1300');
assert.equal(ob.tools.find(t => t.name === 'Фен').income, 64, 'доход по инструменту из окна владельца, без «сдачи»');
ob = okp({ action: 'payback_all' }).resp;
assert.deepEqual(ob.points.map(p => [p.name, p.percent]), [['Зарнисор', 0], ['Ховарон', 36]], 'пункты от худшего к лучшему');
ok('закупочные цены и окупаемость пунктов');
for (const need of ["action: 'buy_prices'", "action: 'buy_price_set'", "action: 'payback'", "action: 'payback_all'", 'function renderPkBuy(', 'function pkPbBlock(', "TX('Закупка и окупаемость')"]) assert.ok(src.includes(need), `нет: ${need}`);
ok('экран закупки и окупаемости, блок в карточке пункта');
console.log('PROKAT PASSED');
