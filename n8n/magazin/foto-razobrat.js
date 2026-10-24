// Ответ ИИ по фото: только коды из каталога магазина, до 5 штук. Кладовщику цену продажи не показываем.
const V = $('Для продавца').first().json.vision || {};
const ID = $('Кабинет').first().json;
const fail = e => [{ json: { resp: { ok: false, error: e } } }];
const items = Array.isArray(V.items) ? V.items : [];
const msg = $json && $json.choices && $json.choices[0] && $json.choices[0].message ? $json.choices[0].message.content : '';
if (!msg) return fail('не получилось распознать фото, попробуйте ещё раз или введите код');
let j = {};
try { j = JSON.parse(String(msg).replace(/^```(json)?\s*|\s*```$/g, '')); } catch (e) { return fail('не получилось распознать фото, попробуйте ещё раз или введите код'); }
const by = {}; items.forEach(p => { by[String(p.kod).toLowerCase()] = p; });
const found = [];
(Array.isArray(j.codes) ? j.codes : []).forEach(c => { const p = by[String(c).trim().toLowerCase()]; if (p && found.indexOf(p) < 0) found.push(p); });
const keeper = ID.role === 'staff' && ID.srole === 'kladovshchik';
const list = found.slice(0, 5).map(p => { const o = Object.assign({}, p); if (keeper) delete o.price; return o; });
return [{ json: { resp: { ok: true, found: list, note: String(j.note || '').slice(0, 200) } } }];
