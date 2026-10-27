// Цветной статус инструмента на пункте (иконки и карточка инструмента) и доход по нему за месяц.
// 🟢 ok — работает, 🟡 repair — увезён на склад в ремонт, 🔴 broken — сломан, 🔴 lost — потерян (на объезде «нет»),
// ⚪ pickup — сломан больше 14 дней, нужно забрать; moved — весь перевезён на другой пункт, sklad — весь на складе исправный.
const items = $input.all();
const first = items[0] && items[0].json;
// Инструмент без фото приходит готовым ответом (skip) — статус добавляем прямо в ответ.
const bare = first && first.skip && first.resp && first.resp.ok && first.resp.tool && Array.isArray(first.resp.photos);
if (!first || (!bare && (first.skip || (first.mode !== 'tools' && first.mode !== 'tool')))) return items;
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pk = s => norm(s).slice(0, 14);
const num = x => Math.round((Number(x) || 0) * 100) / 100;
const iso = s => { const x = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s || '')); if (x) return x[3] + '-' + x[2] + '-' + x[1]; const y = /^\d{4}-\d{2}-\d{2}/.exec(String(s || '')); return y ? y[0] : ''; };
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const days = d => d ? Math.floor((Date.parse(today) - Date.parse(d)) / 86400000) : 0;
const key = pk(bare ? first.resp.point : first.point), month = today.slice(0, 7);
const rents = R('Аренды').filter(r => pk(r.tochka) === key && r.status !== 'сдача');
const visits = R('Визиты').filter(v => pk(v.tochka) === key).sort((a, b) => iso(a.data_vizita).localeCompare(iso(b.data_vizita)) || Number(a.id) - Number(b.id));
const moves = R('Перевозки').filter(m => pk(m.iz) === key).sort((a, b) => String(a.data).localeCompare(String(b.data)) || Number(a.id) - Number(b.id));
const statusOf = (name, qty) => {
  const k = norm(name), my = rents.filter(r => norm(r.instrument) === k);
  const income = num(my.filter(r => r.status !== 'сломан' && String(r.nachalo || '').slice(0, 7) === month).reduce((s, r) => s + (Number(r.summa) || 0), 0));
  const res = (status, text) => ({ status: status, status_text: text, out: my.filter(r => r.status === 'в аренде').length, month_income: income });
  if (!(qty > 0)) {
    const mv = moves.filter(m => norm(m.instrument) === k).pop();
    if (!mv) return res('', '');
    if (String(mv.v) !== 'Склад') return res('moved', 'перевезён: ' + mv.v);
    const st = String(mv.sostoyanie || '');
    return st === 'починен' ? res('sklad', 'на складе') : res('repair', 'на складе: ' + (st || 'в ремонте'));
  }
  const lv = visits.filter(v => norm(v.instrument) === k).pop();
  const lvd = lv ? iso(lv.data_vizita) : '';
  const fixedAfter = d => my.some(r => r.proverka === 'починен' && iso(r.vozvrat) >= d);
  const ob = my.filter(r => r.status === 'сломан').map(r => iso(r.nachalo)).sort()[0] || '';
  const since = ob || (lv && lv.sostoyanie === 'сломан' && !fixedAfter(lvd) ? lvd : '');
  if (since) return days(since) > 14 ? res('pickup', 'сломан ' + days(since) + ' дн. — забрать') : res('broken', 'сломан');
  if (lv && lv.sostoyanie === 'нет' && !my.some(r => iso(r.nachalo) > lvd)) return res('lost', 'не нашли на объезде');
  return res('ok', 'работает');
};
if (first.mode === 'tools') return items.map(i => ({ json: Object.assign({}, i.json, statusOf(i.json.name, Number(i.json.qty) || 0)) }));
const tname = bare ? first.resp.tool : first.name;
const qty = R('Записи инструментов').filter(r => String(r.tip) === 'Инструмент' && pk(r.tochka) === key && norm(r.instrument) === norm(tname)).reduce((s, r) => s + Math.max(1, Number(r.kolvo) || 1), 0);
const st = statusOf(tname, qty);
if (bare) return [{ json: Object.assign({}, first, { resp: Object.assign({}, first.resp, st) }) }];
return items.map(i => ({ json: Object.assign({}, i.json, st) }));
