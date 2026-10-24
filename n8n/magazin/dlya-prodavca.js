const ID = $('Кабинет').first().json;
const items = $input.all();
const all = $('Записи магазина').all().map(i => i.json).filter(r => r && r.id !== undefined);
const rows = all.filter(r => r.tip === 'prodazha' && r.ssylka);
const by = {}; rows.forEach(r => { by[String(r.chek)] = String(r.ssylka); });
// Журнал приёма: кто, что и сколько принял (последние 40).
const receipts = all.filter(r => r.tip === 'prihod' || r.tip === 'korrekt').sort((a, b) => String(b.vremya).localeCompare(String(a.vremya))).slice(0, 40).map(r => ({ id: String(r.oid), kod: r.kod, name: String(r.nazvanie), qty: Number(r.kolvo), zakup: Number(r.zakup), date: String(r.data), who: String(r.ssylka || ''), fix: r.tip === 'korrekt' }));
// Подневные суммы за месяц для «Итогов дня» и «Бухгалтерии»: продано, пришло денег (нал/перевод + оплаты долгов), новые долги, прибыль, закупка, выплаты зарплаты (salary) и личные расходы (pers). Товар, взятый владельцем, выручкой не считается.
const r2 = x => Math.round(Number(x) * 100) / 100;
const voidedSet = new Set(all.filter(x => x.tip === 'void').map(x => String(x.ssylka)));
function daysOf(ms) {
  const voided = voidedSet;
  const newZ = {}; all.filter(x => x.tip === 'tovar').forEach(x => { newZ[String(x.oid)] = Number(x.zakup); });
  const days = {};
  const dd = d => (days[d] = days[d] || { sold: 0, cashIn: 0, debtNew: 0, profit: 0, purchase: 0, salary: 0, pers: 0 });
  all.forEach(x => {
    const d = String(x.data); if (d.slice(0, 7) !== ms) return;
    if (x.tip === 'prodazha' && !voided.has(String(x.chek))) {
      if (x.oplata === 'vladelec') return;
      const s = Number(x.summa), o = dd(d);
      o.sold += s; o.profit += (Number(x.cena) - Number(x.zakup)) * Number(x.kolvo);
      if (x.oplata === 'dolg') o.debtNew += s; else o.cashIn += s;
    } else if (x.tip === 'oplata' && !voided.has(String(x.oid))) dd(d).cashIn += Number(x.summa);
    else if (x.tip === 'prihod') { const z = newZ[('t' + x.oid).slice(0, 40)]; dd(d).purchase += Number(x.kolvo) * (z > 0 ? z : Number(x.zakup)); }
    else if (x.tip === 'vyplata' && !voided.has(String(x.oid))) dd(d).salary += Number(x.summa);
    else if (x.tip === 'rashod' && !voided.has(String(x.oid))) dd(d).pers += Number(x.summa);
  });
  Object.keys(days).forEach(d => { Object.keys(days[d]).forEach(k => { days[d][k] = r2(days[d][k]); }); });
  return days;
}
// Зарплата продавцов за месяц: оклад + процент от выручки его чеков (без «Взял шеф») − авансы − выплаты − личные расходы.
function salaryOf(ms) {
  const inM = x => String(x.data).slice(0, 7) === ms;
  const live = x => !voidedSet.has(String(x.oid));
  const names = {};
  let staff = []; try { staff = $('Сотрудники').all().map(i => i.json); } catch (e) {}
  staff.filter(s => String(s.kabinet_kod) === String(ID.kod) && s.rol === 'prodavec' && s.status === 'on' && s.imya).forEach(s => { names[String(s.imya).slice(0, 40)] = 1; });
  all.forEach(x => { if (x.tip === 'zp_set' || x.tip === 'vyplata' || x.tip === 'rashod') { if (x.pokupatel) names[String(x.pokupatel)] = 1; } else if (x.tip === 'prodazha' && x.ssylka && x.oplata !== 'vladelec') names[String(x.ssylka)] = 1; });
  const setOf = n => all.filter(x => x.tip === 'zp_set' && String(x.pokupatel) === n).sort((a, b) => String(b.vremya).localeCompare(String(a.vremya)))[0];
  const list = Object.keys(names).sort().map(n => {
    const st = setOf(n), oklad = st ? Number(st.summa) : 0, pct = st ? Number(st.marzha) : 0;
    const rev = r2(all.filter(x => x.tip === 'prodazha' && String(x.ssylka) === n && x.oplata !== 'vladelec' && inM(x) && !voidedSet.has(String(x.chek))).reduce((s, x) => s + Number(x.summa), 0));
    const sum = k => r2(all.filter(x => x.tip === 'vyplata' && x.oplata === k && String(x.pokupatel) === n && inM(x) && live(x)).reduce((s, x) => s + Number(x.summa), 0));
    const avans = sum('avans'), paid = sum('zp');
    const exp = r2(all.filter(x => x.tip === 'rashod' && String(x.pokupatel) === n && inM(x) && live(x)).reduce((s, x) => s + Number(x.summa), 0));
    const bonus = r2(rev * pct / 100), accrued = r2(oklad + bonus);
    return { name: n, oklad, pct, rev, bonus, accrued, avans, paid, exp, rest: r2(accrued - avans - paid - exp) };
  });
  const pl = all.filter(x => x.tip === 'vyplata' && inM(x) && live(x)).sort((a, b) => String(b.vremya).localeCompare(String(a.vremya))).slice(0, 30).map(x => ({ id: String(x.oid), date: String(x.data), who: String(x.pokupatel), kind: x.oplata, sum: Number(x.summa) }));
  return { list, pl };
}
return items.map(it => {
  const r = it.json.resp;
  if (r && r.ok) {
    const sk = ID.role === 'staff' && ID.srole === 'kladovshchik';
    r.role = ID.role === 'staff' ? (sk ? 'storekeeper' : 'seller') : 'owner';
    if (sk) {
      // Кладовщику: товары, остатки и закупка; без маржи, отчёта, продаж и долгов. Единица измерения и «сколько в одной штуке» нужны для приёма (24.10).
      r.products = (r.products || []).map(p => ({ kod: p.kod, name: p.name, zakup: p.zakup, qty: p.qty, unit: p.unit, per: p.per, foto: p.foto }));
      r.debts = [];
      r.receipts = receipts;
      delete r.report;
    } else if (ID.role === 'staff') {
      // Продавцу не отдаём закупку, маржу, отчёт и суммы долгов. Единица измерения нужна кассе (метры, кг).
      r.products = (r.products || []).map(p => ({ kod: p.kod, name: p.name, price: p.price, qty: p.qty, unit: p.unit, per: p.per, foto: p.foto }));
      r.debts = (r.debts || []).filter(d => !d.owner).map(d => ({ name: d.name, sum: 0, warn: d.sum >= 1000, owner: false }));
      delete r.report;
    } else {
      r.receipts = receipts;
      if (r.report) { r.report.days = daysOf(r.report.month); const sl = salaryOf(r.report.month); r.report.salary = sl.list; r.report.payList = sl.pl; }
      if (r.report && Array.isArray(r.report.checks)) r.report.checks.forEach(c => { if (by[String(c.id)]) c.seller = by[String(c.id)]; });
    }
  }
  return it;
});
