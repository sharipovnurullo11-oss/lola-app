// Защита от потери кода: specialists.cjs должен совпадать с блоком, вшитым в window.html.
// Если правили окно прямо в window.html, перенесите правку в specialists.cjs; иначе node build-specialists.js сотрёт её.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../specialists.cjs', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../window.html', import.meta.url), 'utf8');
const A = '/*specialists:start*/', B = '/*specialists:end*/';
const i = html.indexOf(A), j = html.indexOf(B);
assert.ok(i >= 0 && j > i, 'в window.html нет меток specialists:start / specialists:end');
assert.equal(html.slice(i + A.length + 1, j - 1), src, 'specialists.cjs и блок в window.html разошлись: перенесите правки в specialists.cjs и запустите node build-specialists.js');
console.log('ok - specialists.cjs совпадает с window.html');
console.log('SYNC PASSED');
