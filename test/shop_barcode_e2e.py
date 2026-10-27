# Касса Шамсуло в браузере: заводской штрихкод. Сервер /magazin подменён: товары с коротким кодом магазина, к «Гвоздям» привязан EAN-13.
# Касса находит товар по штрихкоду; незнакомый штрихкод после скана предлагает привязать к товару (руководитель/кладовщик).
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8129'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
SHOP = 'kshamsulotestkod0000000000000'; calls = []
P = [{"kod": "015", "name": "Гвозди 100", "price": 12, "zakup": 10, "marzha": 20, "qty": 50, "unit": "sht", "per": 0, "foto": 0, "bar": ["4600000000017"]},
     {"kod": "016", "name": "Саморез 50", "price": 3, "zakup": 2, "marzha": 50, "qty": 500, "unit": "sht", "per": 0, "foto": 0, "bar": []}]
def resp(): return {"ok": True, "role": "owner", "products": P, "debts": [], "receipts": [], "report": {"month": "2026-10", "revenue": 0, "profit": 0, "owner": 0, "debt": 0, "byDay": {}, "checks": [], "low": [], "expenses": 0, "expBy": {}, "expList": [], "payBy": {}, "payToday": {}, "sdachi": [], "days": {}, "salary": [], "payList": []}}
def h(route):
    u = route.request.url
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b)
        if b.get('action') == 'ping': return route.fulfill(json={"ok": False, "error": "неизвестное действие"})
        j = b.get('bind_barcode')
        if j:
            for p in P:
                if p['kod'] == j['kod']: p['bar'] = sorted(set(p['bar'] + [j['code']]))
        return route.fulfill(json=resp())
    route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def body(pg): return pg.inner_text('#sp-body')
def scan(pg, code):
    pg.click('[data-shop="scan"]'); pg.wait_for_timeout(300)
    check(pg.locator('#sh-scan-in').count() == 1, 'сканер открылся (камеры нет — ввод вручную)')
    pg.fill('#sh-scan-in', code); pg.click('#sh-scan-ok'); pg.wait_for_timeout(500)
try:
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = br.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8129/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("c => { localStorage.setItem('ew_cab', c); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }", SHOP); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500); pg.click('#sp-body [data-fin="shop"]'); pg.wait_for_timeout(800)
        pg.fill('#sh-code', '4600000000017'); pg.wait_for_timeout(200)
        check('Гвозди 100' in pg.inner_text('#sh-hints'), 'касса находит товар по заводскому штрихкоду')
        pg.fill('#sh-code', ''); pg.wait_for_timeout(100)
        scan(pg, '4600000000017')
        check('Гвозди 100' in body(pg), 'скан штрихкода кладёт товар в корзину')
        scan(pg, '4811111111117')
        t = body(pg); check('«4811111111117» ещё не привязан' in t, 'незнакомый штрихкод — предлагает привязать')
        pg.fill('#sh-b-q', 'само'); pg.wait_for_timeout(200)
        pg.click('[data-shop="bind"][data-k="016"]'); pg.wait_for_timeout(600)
        bc = [c for c in calls if c.get('bind_barcode')]
        check(len(bc) == 1 and bc[0]['bind_barcode']['kod'] == '016' and bc[0]['bind_barcode']['code'] == '4811111111117' and bc[0]['action'] == 'list', 'привязка ушла на сервер')
        check('Штрихкод привязан' in body(pg) and 'ещё не привязан' not in body(pg), 'сообщение о привязке')
        pg.fill('#sh-pcode', '016'); pg.wait_for_timeout(200); pg.click('[data-shop="rcv"][data-k="016"]'); pg.wait_for_timeout(300)
        t = body(pg); check('Штрихкоды:' in t and '4811111111117' in t, 'в приёме товара видны его штрихкоды')
        pg.click('[data-shop="scan"][data-k="bindto"]'); pg.wait_for_timeout(300); pg.fill('#sh-scan-in', '4822222222220'); pg.click('#sh-scan-ok'); pg.wait_for_timeout(600)
        bc = [c for c in calls if c.get('bind_barcode')]
        check(len(bc) == 2 and bc[1]['bind_barcode'] == {'kod': '016', 'code': '4822222222220', 'id': bc[1]['bind_barcode']['id']}, 'кнопка «Привязать заводской штрихкод» в приёме товара')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SHOP BARCODE E2E PASSED')
finally:
    srv.terminate()
