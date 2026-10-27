# Касса Шамсуло в браузере: история движения товара (№226–227). Сервер /magazin подменён.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8133'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
SHOP = 'kshamsulotestkod0000000000000'; calls = []; ROLE = ['owner']
P = [{"kod": "CEM", "name": "Цемент", "price": 3, "zakup": 2, "marzha": 50, "qty": 47.5, "unit": "kg", "per": 0, "sell": 0, "foto": 0, "bar": []}]
H = {"kod": "CEM", "name": "Цемент", "unit": "kg", "qty": 47.5, "total": 5, "events": [
  {"t": "return", "date": "2026-10-27", "time": "12:10", "qty": 1, "price": 3, "who": "Маруф", "ost": 47.5},
  {"t": "sale", "date": "2026-10-27", "time": "11:00", "qty": 2.5, "price": 3, "sum": 7.5, "pay": "dolg", "buyer": "Карим", "who": "Маруф", "chek": "c1", "ost": 46.5},
  {"t": "count", "date": "2026-10-26", "time": "18:00", "fact": 49, "was": 50, "who": "Али", "ost": 49},
  {"t": "in", "date": "2026-10-25", "time": "10:00", "qty": 50, "price": 2, "who": "Али", "post": "Саид", "pay": "dolg", "ost": 50},
  {"t": "new", "date": "2026-10-24", "time": "09:00", "zakup": 2, "sell": 0, "marzha": 50, "ost": 0}]}
def resp(extra=None):
    r = {"ok": True, "role": ROLE[0], "products": P, "debts": [], "receipts": [], "report": {"month": "2026-10", "revenue": 0, "profit": 0, "owner": 0, "debt": 0, "byDay": {}, "checks": [], "low": [], "expenses": 0, "expBy": {}, "expList": [], "payBy": {}, "payToday": {}, "sdachi": [], "kassa": [], "postDebts": [], "postPays": [], "days": {}, "salary": [], "payList": [], "itogiHour": 21}}
    r.update(extra or {}); return r
def h(route):
    u = route.request.url
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b)
        if b.get('action') == 'ping': return route.fulfill(json={"ok": False, "error": "неизвестное действие"})
        if b.get('action') == 'history': return route.fulfill(json={"ok": True, "role": "owner", "history": H})
        return route.fulfill(json=resp())
    route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def body(pg): return pg.inner_text('#sp-body')
try:
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = br.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8133/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("c => { localStorage.setItem('ew_cab', c); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }", SHOP); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500); pg.click('#sp-body [data-fin="shop"]'); pg.wait_for_timeout(800)
        pg.click('[data-shop="tab"][data-k="tovar"]'); pg.wait_for_timeout(300)
        check(pg.locator('[data-shop="hist"][data-k="CEM"]').count() == 1, 'у товара кнопка «История»')
        pg.click('[data-shop="hist"][data-k="CEM"]'); pg.wait_for_timeout(500)
        hc = [c for c in calls if c.get('action') == 'history']
        check(len(hc) == 1 and hc[0]['kod'] == 'CEM', 'запрос истории товара')
        t = body(pg)
        check('Остаток сейчас: 47,5' in t or 'Остаток сейчас: 47.5' in t, 'остаток сейчас')
        check('Приход +50' in t and 'принял Али' in t and 'поставщик Саид (в долг у поставщика)' in t, 'приход: кто принял, поставщик')
        check('Продажа −2,5' in t or 'Продажа −2.5' in t, 'продажа с дробным количеством')
        check('покупатель Карим' in t and 'продал Маруф' in t, 'кто продал и кому')
        check('Пересчёт: по факту 49' in t and 'Возврат +1' in t and 'Товар заведён' in t, 'пересчёт, возврат, заведение товара')
        pg.click('[data-shop="hclose"]'); pg.wait_for_timeout(300)
        check('Цемент' in body(pg) and pg.locator('[data-shop="hist"]').count() == 1, 'назад к товарам')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SHOP HIST E2E PASSED')
finally:
    srv.terminate()
