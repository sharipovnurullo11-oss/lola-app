const src = $('История фото').all().map(i => i.json);
if (src[0] && src[0].skip) return [{ json: { resp: src[0].resp } }];
const got = $('Миниатюра Drive').all().map(i => i.json);
const url = i => { const g = got[i] || {}; let u = src[i].fid ? String(g.thumbnailLink || '') : ''; if (u) u = u.replace(/=s\d+$/, '=s900'); return u; };
const m = src[0] ? src[0].mode : '';
if (m === 'tools') return [{ json: { resp: { ok: true, point: src[0].point, tools: src.map((s, i) => ({ name: s.name, qty: s.qty, count: s.count, first: s.first, last: s.last, url: url(i) })) } } }];
if (m === 'tool') return [{ json: { resp: { ok: true, point: src[0].point, tool: src[0].name, total: src[0].total, photos: src.map((s, i) => ({ date: s.date, src: s.src, state: s.state, note: s.note, id: s.fid, url: url(i) })) } } }];
const photos = src.map((s, i) => ({ name: s.instrument, date: s.date, month: s.month, id: s.fid, url: url(i) }));
return [{ json: { resp: { ok: true, count: src[0] ? src[0].total : photos.length, photos: photos } } }];
