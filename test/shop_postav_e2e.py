# Касса Шамсуло в браузере: долги поставщикам (№223, №224). Сервер /magazin подменён.
# При приёме товара указывают поставщика и оплату (в долг — только с именем поставщика); во вкладке «Долги» — «Кому должен магазин» и оплата поставщику.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8131'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
SHOP = 'kshamsulotestkod0000000000000'; calls = []
P = [{"kod": "016", "name": "Саморез 50", "price": 3, "zakup": 2, "marzha": 50, "qty": 500, "unit": "sht", "per": 0, "foto": 0, "bar": []}]
PD = [{"name": "Саид", "sum": 65, "since": "2026-10-20"}]
def resp():
    return {"ok": True, "role": "owner", "products": P, "debts": [{"name": "Карим", "sum": 100, "since": "2026-10-21", "owner": False}], "receipts": [{"id": "r1", "kod": "016", "name": "Саморез 50", "qty": 10, "zakup": 2, "date": "2026-10-20", "who": "Али", "fix": False, "post": "Саид", "pay": "dolg"}],
            "report": {"month": "2026-10", "revenue": 0, "profit": 0, "owner": 0, "debt": 100, "byDay": {}, "checks": [], "low": [], "expenses": 0, "expBy": {}, "expList": [], "payBy": {}, "payToday": {}, "sdachi": [], "kassa": [], "postDebts": PD, "postPays": [], "days": {}, "salary": [], "payList": [], "itogiHour": 21}}
def h(route):
    u = route.request.url
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b)
        if b.get('action') == 'ping': return route.fulfill(json={"ok": False, "error": "неизвестное действие"})
        if b.get('action') == 'post_pay': PD[0]['sum'] -= b['amount']
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
        pg.goto('http://localhost:8131/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("c => { localStorage.setItem('ew_cab', c); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }", SHOP); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500); pg.click('#sp-body [data-fin="shop"]'); pg.wait_for_timeout(800)
        pg.click('[data-shop="tab"][data-k="prihod"]'); pg.wait_for_timeout(300)
        check('Саид · в долг у поставщика' in body(pg), 'в журнале приёма видно поставщика и долг')
        pg.fill('#sh-pcode', '016'); pg.wait_for_timeout(200); pg.click('[data-shop="rcv"][data-k="016"]'); pg.wait_for_timeout(300)
        check(pg.locator('#sh-r-post').count() == 1 and pg.locator('#sh-r-pay').count() == 1, 'в приёме поля «Поставщик» и «Как заплатили»')
        check(pg.locator('#sh-posts option[value="Саид"]').count() == 1, 'подсказка с известными поставщиками')
        pg.fill('#sh-r-qty', '20'); pg.select_option('#sh-r-pay', 'dolg'); pg.click('[data-shop="rok"]'); pg.wait_for_timeout(300)
        check('Для долга укажите поставщика' in body(pg) and not [c for c in calls if c.get('action') == 'receive'], 'в долг без поставщика не отправляется')
        pg.fill('#sh-r-qty', '20'); pg.fill('#sh-r-post', 'Саид'); pg.select_option('#sh-r-pay', 'dolg'); pg.click('[data-shop="rok"]'); pg.wait_for_timeout(600)
        rc = [c for c in calls if c.get('action') == 'receive']
        check(len(rc) == 1 and rc[0]['post'] == 'Саид' and rc[0]['post_pay'] == 'dolg' and rc[0]['qty'] == 20, 'приём в долг ушёл на сервер')
        pg.click('[data-shop="tab"][data-k="dolg"]'); pg.wait_for_timeout(300)
        t = body(pg); check('Нам должны' in t and 'Мы должны' in t and 'Разница' in t and 'Кому должен магазин' in t and 'Саид' in t, 'вкладка «Долги»: итог и поставщики')
        pg.click('[data-shop="ppopen"][data-k="Саид"]'); pg.wait_for_timeout(200)
        pg.fill('#sh-pp-amt', '40'); pg.select_option('#sh-pp-pay', 'perevod'); pg.click('[data-shop="ppok"]'); pg.wait_for_timeout(600)
        pp = [c for c in calls if c.get('action') == 'post_pay']
        check(len(pp) == 1 and pp[0]['who'] == 'Саид' and pp[0]['amount'] == 40 and pp[0]['pay'] == 'perevod', 'оплата поставщику ушла на сервер')
        check('Оплата поставщику записана' in body(pg), 'сообщение об оплате')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SHOP POSTAV E2E PASSED')
finally:
    srv.terminate()
