// Окно владельца: на карточке инструмента — самое свежее фото (из таблицы фото или объезда), чтобы при возврате сравнивать «было → стало».
const prev = $input.first().json;
const r = prev.resp;
if (prev.op !== 'none' || !r || !r.ok || !Array.isArray(r.tools) || !r.point) return [{ json: prev }];
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pk = s => norm(s).slice(0, 14);
const iso = (d, m) => { const x = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(d || '')); if (x) return x[3] + '-' + x[2] + '-' + x[1]; const y = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (y) return y[0]; const z = /^(\d{4})-(\d{2})/.exec(String(m || '')); return z ? z[0] + '-01' : ''; };
const R = n => $(n).all().map(i => i.json).filter(x => x && x.id !== undefined);
const key = pk(r.point.name), best = {};
const put = (nm, fid, d) => { const k = norm(nm); if (!k || !fid) return; if (!best[k] || d >= best[k].d) best[k] = { fid: String(fid), d: d }; };
R('Фото по точкам').filter(x => pk(x.tochka) === key).forEach(x => put(x.instrument, x.drive_file_id, iso(x.data_foto, x.mesyac)));
R('Визиты').filter(x => pk(x.tochka) === key && x.foto_ssylka).forEach(x => put(x.instrument, x.foto_ssylka, iso(x.data_vizita)));
const tools = r.tools.map(t => best[norm(t.name)] ? Object.assign({}, t, { photo_id: best[norm(t.name)].fid }) : t);
return [{ json: Object.assign({}, prev, { resp: Object.assign({}, r, { tools: tools }) }) }];
