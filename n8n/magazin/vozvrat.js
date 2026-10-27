// Возврат по чеку (магазин Шамсуло, №343–344): покупатель возвращает часть купленного. Продавец находит чек по номеру (скан штрихкода с печатного чека
// или ввод номера), выбирает позиции и количество; деньги возвращаются по цене продажи, товар — на склад.
// chek_get — чек с позициями и сколько уже вернули; vozvrat — сам возврат. Возврат записывается строками продажи с минусом (tip 'prodazha',
// kolvo < 0, summa < 0), поэтому остаток, выручка, прибыль, наличные при сдаче кассы и долг покупателя пересчитываются сами.
// Номер чека возврата = номер исходного чека + 'r' + 6 знаков; такой чек можно отменить обычной отменой (void).
// Без чека возврат пока не делаем: ждём решения Шамсуло (№345).
const B = $('Магазин: запрос').first().json.body || {};
const act = String(B.action || '');
if (act !== 'chek_get' && act !== 'vozvrat') return $input.all();
const ID = $('Кабинет').first().json;
const fail = e => [{ json: { resp: { ok: false, error: e } } }];
if (!ID.ok) return fail('нет доступа');
if (!(ID.role === 'owner' || (ID.role === 'staff' && ID.srole === 'prodavec'))) return fail('возврат оформляет продавец или руководитель');
const kod = ID.kod, now = new Date().toISOString();
const all = $('Записи магазина').all().map(i => i.json).filter(r => r && r.id !== undefined && r.kabinet_kod === kod);
const r2 = x => Math.round(Number(x) * 100) / 100;
const r3 = x => Math.round(Number(x) * 1000) / 1000;
const idc = s => String(s || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
const cod = s => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2020-01-01' && d < '2100-01-01' && !isNaN(Date.parse(d));
const voided = new Set(all.filter(r => r.tip === 'void').map(r => String(r.ssylka)));
const live = all.filter(r => r.tip === 'prodazha' && !voided.has(String(r.chek)));
const units = {}; all.filter(r => r.tip === 'tovar').sort((a, b) => String(a.vremya).localeCompare(String(b.vremya))).forEach(r => { units[r.kod] = String(r.oplata || 'sht'); });
// Номер чека: полностью или последние 6+ знаков (если по ним находится ровно один чек).
const q = idc(B.chek).toLowerCase();
if (q.length < 6) return fail('введите номер чека (не меньше 6 знаков)');
const ids = Array.from(new Set(live.filter(r => Number(r.kolvo) > 0).map(r => String(r.chek))));
let chek = ids.find(c => c.toLowerCase() === q);
if (!chek) { const m = ids.filter(c => c.toLowerCase().endsWith(q)); if (m.length > 1) return fail('по этим цифрам несколько чеков — введите номер полностью'); chek = m[0]; }
if (!chek) return fail('чек не найден или отменён');
const lines = live.filter(r => String(r.chek) === chek && Number(r.kolvo) > 0);
const back = {}; live.filter(r => Number(r.kolvo) < 0 && String(r.chek).indexOf(chek + 'r') === 0).forEach(r => { back[r.kod] = r3((back[r.kod] || 0) - Number(r.kolvo)); });
const first = lines[0];
const view = () => ({ id: chek, date: String(first.data), pay: String(first.oplata), who: String(first.pokupatel || ''), total: r2(lines.reduce((s, r) => s + Number(r.summa), 0)),
  lines: lines.map(r => ({ kod: r.kod, name: String(r.nazvanie), qty: Number(r.kolvo), price: Number(r.cena), unit: units[r.kod] || 'sht', returned: back[r.kod] || 0, left: r3(Number(r.kolvo) - (back[r.kod] || 0)) })) });
if (act === 'chek_get') return [{ json: { resp: { ok: true, chek: view() } } }];

const id = idc(B.id), date = String(B.date || '');
if (id.length < 6) return fail('нет номера возврата');
if (!okDate(date)) return fail('неверная дата');
const rchek = (chek + 'r' + id.slice(-6)).slice(0, 40);
if (all.some(r => String(r.chek) === rchek)) return [{ json: { resp: { ok: true, dup: true, chek: view() } } }];
// Деньги возвращаются тем же способом, что и платили; при смешанной оплате продавец выбирает способ.
let pay = String(first.oplata);
if (pay === 'mix') { pay = String(B.pay || 'nal'); if (['nal', 'alif', 'dushanbe', 'perevod'].indexOf(pay) < 0) return fail('выберите, как вернуть деньги'); }
const want = {};
for (const it of (Array.isArray(B.items) ? B.items.slice(0, 60) : [])) { const k = cod(it.kod), x = r3(it.qty); if (!(x > 0)) continue; want[k] = r3((want[k] || 0) + x); }
const ks = Object.keys(want);
if (!ks.length) return fail('выберите, что возвращают');
const rows = [];
for (const k of ks) {
  const ln = lines.find(r => r.kod === k);
  if (!ln) return fail('этого товара нет в чеке');
  const left = r3(Number(ln.kolvo) - (back[k] || 0));
  if (want[k] > left + 0.0001) return fail('по чеку можно вернуть не больше ' + left + ': ' + ln.nazvanie);
  rows.push({ oid: (id + 'l' + rows.length).slice(0, 40), kabinet_kod: kod, tip: 'prodazha', kod: k, nazvanie: String(ln.nazvanie), kolvo: -want[k], zakup: Number(ln.zakup), marzha: Number(ln.marzha), cena: Number(ln.cena), summa: -r2(Number(ln.cena) * want[k]), oplata: pay, pokupatel: String(ln.pokupatel || ''), chek: rchek, data: date, ssylka: '', vremya: now });
}
const total = r2(-rows.reduce((s, r) => s + r.summa, 0));
const resp = { ok: true, vozvrat: { chek: rchek, from: chek, total: total, pay: pay, who: String(first.pokupatel || '') } };
return rows.map(r => ({ json: { rows: 1, row: r, resp: resp } }));
