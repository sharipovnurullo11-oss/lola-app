// Ответ ИИ по фото без названия: только названия из списка инструментов пункта.
const src = $('ИИ: запросы').all().map(i => i.json);
const got = $input.all().map(i => i.json);
const guesses = src.map((g, i) => {
  const msg = got[i] && got[i].choices && got[i].choices[0] && got[i].choices[0].message ? got[i].choices[0].message.content : '';
  let j = {}; try { j = JSON.parse(String(msg).replace(/^```(json)?\s*|\s*```$/g, '')); } catch (e) {}
  const name = (g.cand || []).find(c => c.toLowerCase() === String(j.name || '').trim().toLowerCase()) || '';
  return { fid: g.fid, date: g.date, point: g.point, name: name, sure: !!(name && j.sure), note: String(j.note || '').slice(0, 160) };
});
return [{ json: { resp: { ok: true, guesses: guesses } } }];
