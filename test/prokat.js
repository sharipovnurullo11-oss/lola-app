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
console.log('PROKAT PASSED');
