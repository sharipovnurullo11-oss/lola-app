# Касса («Учёт магазина» в «Финансисте») видна только кабинету, которому сервер /magazin даёт доступ. Кода кабинета в приложении нет.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8128'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
SHOP = 'kshamsulotestkod0000000000000'; calls = []; DOWN = [False]
def h(route):
    u = route.request.url
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b)
        if DOWN[0]: return route.abort()
        if b.get('code') != SHOP: return route.fulfill(json={"ok": False, "error": "нет доступа"})
        return route.fulfill(json={"ok": False, "error": "неизвестное действие"} if b.get('action') == 'ping' else {"ok": True, "products": [], "debts": []})
    route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def login(pg, code):
    pg.evaluate("c => { localStorage.setItem('ew_cab', c); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }", code); pg.reload(); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
def tile(pg):
    pg.click('[data-home="fin"]'); pg.wait_for_timeout(500); on = pg.locator('#sp-body [data-fin="shop"]').count() > 0
    pg.evaluate("document.querySelector('[data-sp-back]') && document.querySelector('[data-sp-back]').click()"); return on
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8128/window.html'); pg.wait_for_timeout(500)
        src = open(os.path.join(ROOT, 'window.html'), encoding='utf-8').read()
        check('SHOP_ALLOW' not in src and 'k17jy' not in src, 'кода кабинета Шамсуло в приложении нет')
        login(pg, SHOP); check(tile(pg), 'кабинет с доступом: в «Финансисте» есть касса')
        check(any(c.get('action') == 'ping' for c in calls), 'доступ спрашивается у сервера')
        n = len(calls); login(pg, SHOP); check(tile(pg), 'после перезагрузки касса на месте')
        login(pg, 'kdrugoyklient0000000000000000'); check(not tile(pg), 'другой кабинет: в «Финансисте» нет кассы')
        DOWN[0] = True; login(pg, 'kdrugoyklient0000000000000000'); check(not tile(pg), 'нет связи: кассу не включаем')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SHOP ACCESS E2E PASSED')
finally:
    srv.terminate()
