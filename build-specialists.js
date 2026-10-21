// Вшивает specialists.cjs в window.html между метками specialists:start и specialists:end.
// Живая страница подтягивает только window.html, поэтому модуль лежит внутри него. Запуск: node build-shop.js
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./specialists.cjs', import.meta.url), 'utf8');
if (/<\/script/i.test(src)) throw new Error('в specialists.cjs нельзя писать закрывающий тег script');
const file = new URL('./window.html', import.meta.url);
let html = fs.readFileSync(file, 'utf8');
const A = '/*specialists:start*/', B = '/*specialists:end*/';
if (html.includes(A)) {
  const i = html.indexOf(A), j = html.indexOf(B);
  if (j < i) throw new Error('метки перепутаны');
  html = html.slice(0, i + A.length) + '\n' + src + '\n' + html.slice(j);
} else {
  const k = html.lastIndexOf('</body>');
  html = html.slice(0, k) + '<script>\n' + A + '\n' + src + '\n' + B + '\n</script>\n' + html.slice(k);
}
fs.writeFileSync(file, html);
console.log('specialists вшит в window.html');
