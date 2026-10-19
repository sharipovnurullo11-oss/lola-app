// Вшивает shop.cjs в window.html между метками shop:start и shop:end.
// Живая страница подтягивает только window.html, поэтому модуль лежит внутри него. Запуск: node build-shop.js
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./shop.cjs', import.meta.url), 'utf8');
if (/<\/script/i.test(src)) throw new Error('в shop.cjs нельзя писать закрывающий тег script');
const file = new URL('./window.html', import.meta.url);
let html = fs.readFileSync(file, 'utf8');
const A = '/*shop:start*/', B = '/*shop:end*/';
if (html.includes(A)) {
  const i = html.indexOf(A), j = html.indexOf(B);
  if (j < i) throw new Error('метки перепутаны');
  html = html.slice(0, i + A.length) + '\n' + src + '\n' + html.slice(j);
} else {
  const k = html.lastIndexOf('</body>');
  html = html.slice(0, k) + '<script>\n' + A + '\n' + src + '\n' + B + '\n</script>\n' + html.slice(k);
}
fs.writeFileSync(file, html);
console.log('shop вшит в window.html');
