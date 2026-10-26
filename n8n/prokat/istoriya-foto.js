// Фото-история инструментов пункта: иконки инструментов (tools) и все фото одного инструмента по датам (tool).
// Старые фото — из таблицы «Фото по точкам», новые — из объездов («Визиты»). Остальные действия проходят дальше без изменений.
const B = $('Фото: запрос').first().json.body || {};
const act = String(B.action || '');
if (act !== 'tools' && act !== 'tool') return $input.all();
const out = resp => [{ json: { skip: true, resp: resp } }];
if (!$('Кабинет').first().json.ok) return out({ ok: false, error: 'нет доступа' });
const R = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pk = s => norm(s).slice(0, 14);
const nice = s => String(s || '').replace(/\s+/g, ' ').trim();
const iso = (d, m) => { const x = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(d || '')); if (x) return x[3] + '-' + x[2] + '-' + x[1]; const y = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (y) return y[0]; const z = /^(\d{4})-(\d{2})/.exec(String(m || '')); return z ? z[0] + '-01' : ''; };
// Цена аренды из прайса «Прокат — минимальные цены аренды»: вид инструмента узнаём по словам в названии (рус. и тадж.).
const small = s => /майда|малень|мелк|малая|малый/.test(s), big = s => /калон|кадре|больш|болш|катта/.test(s);
const kindOf = nm => { const s = norm(nm);
  if (/отбо|атбо|атбй|молот/.test(s)) return 'Отбойный молоток';
  if (/перфор|перфар|парфар/.test(s)) return small(s) ? 'Маленький перфоратор' : big(s) ? 'Большой перфоратор' : '';
  if (/болгар|балгар|ушм/.test(s)) return small(s) ? 'Маленькая болгарка' : big(s) ? 'Большая болгарка' : '';
  if (/шруп|шуруп|шурув/.test(s)) return 'Шуруповёрт аккумуляторный';
  if (/утюг|утиг|паял/.test(s)) return 'Паяльник для пластиковых труб';
  if (/вибрат/.test(s)) return 'Вибратор для бетона';
  if (/лобзик/.test(s)) return 'Лобзик';
  if (/бензо/.test(s)) return 'Бензопила';
  if (/циркул/.test(s)) return 'Циркулярка';
  if (/свар/.test(s)) return 'Сварка';
  if (/краск/.test(s)) return 'Краскопульт';
  if (/пушк/.test(s)) return 'Газовая пушка';
  if (/горел/.test(s)) return 'Газовая горелка с баллоном';
  if (/фен/.test(s)) return 'Строительный фен';
  if (/миксер/.test(s)) return 'Строительный миксер';
  if (/rodex|родекс|резьб|резба/.test(s)) return 'Резьбонарезной инструмент Rodex';
  if (/дрел/.test(s)) return 'Дрель';
  if (/кафел|кафед|плитк/.test(s)) return 'Кафелерез';
  return ''; };
const PR = R('Цены');
const priceOf = nm => { const k = kindOf(nm); return { kind: k, prices: k ? PR.filter(r => norm(r.instrument) === norm(k)).sort((a, b) => Number(a.cena) - Number(b.cena)).map(r => ({ srok: String(r.srok || ''), cena: Number(r.cena) || 0, note: String(r.primechanie || '') })) : [] }; };
const point = String(B.name || ''), key = pk(point);
if (!key) return out({ ok: false, error: 'пункт не найден' });
const NONAME = 'Без названия';
const photos = R('Фото по точкам').filter(r => r.drive_file_id && pk(r.tochka) === key);
// У старого фото без названия берём название из той же строки таблицы проката на этом пункте.
const byRow = {};
photos.forEach(r => { if (nice(r.instrument) && r.stroka_lista != null && r.stroka_lista !== '') byRow[String(r.stroka_lista)] = nice(r.instrument); });
const tools = {};
const tool = nm => { const k = norm(nm); return tools[k] || (tools[k] = { name: nice(nm), qty: 0, photos: [] }); };
R('Записи инструментов').filter(r => String(r.tip) === 'Инструмент' && pk(r.tochka) === key && nice(r.instrument)).forEach(r => { tool(r.instrument).qty += Math.max(1, Number(r.kolvo) || 1); });
photos.forEach(r => {
  const nm = nice(r.instrument) || byRow[String(r.stroka_lista)] || NONAME;
  tool(nm).photos.push({ fid: String(r.drive_file_id), date: iso(r.data_foto, r.mesyac), src: 'таблица', state: '', note: '' });
});
R('Визиты').filter(v => v.foto_ssylka && pk(v.tochka) === key && nice(v.instrument)).forEach(v => {
  tool(v.instrument).photos.push({ fid: String(v.foto_ssylka), date: iso(v.data_vizita), src: 'объезд', state: String(v.sostoyanie || ''), note: String(v.zametka || '') });
});
const seen = {};
Object.keys(tools).forEach(k => { tools[k].photos = tools[k].photos.filter(p => !seen[p.fid] && (seen[p.fid] = 1)).sort((a, b) => a.date.localeCompare(b.date)); });

if (act === 'tools') {
  const list = Object.keys(tools).map(k => tools[k]).sort((a, b) => (a.name === NONAME) - (b.name === NONAME) || a.name.localeCompare(b.name, 'ru'));
  if (!list.length) return out({ ok: true, point: point, tools: [] });
  return list.map(t => { const last = t.photos[t.photos.length - 1]; const pr = priceOf(t.name); return { json: { skip: false, mode: 'tools', fid: last ? last.fid : '', kind: pr.kind, prices: pr.prices, name: t.name, qty: t.qty, count: t.photos.length, first: t.photos.length ? t.photos[0].date : '', last: last ? last.date : '', point: point } }; });
}
const t = tools[norm(B.tool)];
if (!t) return out({ ok: false, error: 'инструмент не найден' });
const tp = priceOf(t.name);
if (!t.photos.length) return out({ ok: true, point: point, tool: t.name, kind: tp.kind, prices: tp.prices, photos: [] });
const shown = t.photos.slice(-40);
return shown.map(p => ({ json: { skip: false, mode: 'tool', fid: p.fid, date: p.date, src: p.src, state: p.state, note: p.note, name: t.name, point: point, total: t.photos.length, kind: tp.kind, prices: tp.prices } }));
