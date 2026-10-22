# «Все заходы» у сотрудника: раскрылось — стоит раскрытым при обновлении списка, сворачивается только повторным нажатием.
import subprocess, time, json
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8128'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
def now_iso(): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
STAFF = [
    {"name": "Оператор А", "phone": "+992900000001", "status": "on", "online": False, "lastSeen": now_iso(), "waitSince": None, "waiting": 0, "lastReply": None,
     "minutes": 60, "firstIn": now_iso(), "lastOut": now_iso(), "replies": 1, "incoming": 1, "clients": 1, "orders": 0, "channels": [], "devices": ["Телефон"],
     "sessions": [{"from": now_iso(), "to": now_iso(), "online": False, "min": 60, "device": "Телефон"}]},
    {"name": "Оператор Б", "phone": "+992900000002", "status": "on", "online": False, "lastSeen": now_iso(), "waitSince": None, "waiting": 0, "lastReply": None,
     "minutes": 30, "firstIn": now_iso(), "lastOut": now_iso(), "replies": 0, "incoming": 0, "clients": 0, "orders": 0, "channels": [], "devices": ["Телефон"],
     "sessions": [{"from": now_iso(), "to": now_iso(), "online": False, "min": 30, "device": "Телефон"}]},
]
def h(route):
    u = route.request.url
    if u.endswith('/staff'):
        b = json.loads(route.request.post_data or '{}')
        if b.get('action') == 'staff_list':
            return route.fulfill(json={"ok": True, "now": now_iso(), "staff": STAFF, "dialogs": [], "devices": [], "freeWaiting": 0})
    route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8128/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("localStorage.setItem('ew_cab','codetest1')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.evaluate("open_team()"); pg.wait_for_timeout(800)
        d = pg.locator('#s-list details[data-ph]'); check(d.count() == 2, 'у каждого сотрудника есть «Все заходы»')
        check(pg.evaluate("[...document.querySelectorAll('#s-list details')].every(x=>!x.open)"), 'по умолчанию «Все заходы» свёрнуты')
        pg.locator('#s-list details[data-ph] summary').first.click(); pg.wait_for_timeout(200)
        check(pg.evaluate("document.querySelectorAll('#s-list details')[0].open"), 'нажали — раскрылось')
        pg.evaluate("load_staff()"); pg.wait_for_timeout(600)
        check(pg.evaluate("document.querySelectorAll('#s-list details')[0].open"), 'после обновления списка с сервера остаётся раскрытым')
        pg.evaluate("render_staff()"); pg.wait_for_timeout(300)
        check(pg.evaluate("document.querySelectorAll('#s-list details')[0].open") and pg.evaluate("!document.querySelectorAll('#s-list details')[1].open"), 'после перерисовки раскрыт только тот, что открыли')
        pg.locator('#s-list details[data-ph] summary').first.click(); pg.wait_for_timeout(200)
        pg.evaluate("load_staff()"); pg.wait_for_timeout(600)
        check(pg.evaluate("!document.querySelectorAll('#s-list details')[0].open"), 'повторное нажатие сворачивает, и после обновления он остаётся свёрнутым')
        check(not errs, 'нет ошибок страницы ' + str(errs))
finally:
    srv.terminate()
