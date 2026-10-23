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
console.log('PROKAT PASSED');
