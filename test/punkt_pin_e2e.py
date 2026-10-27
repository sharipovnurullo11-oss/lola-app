# Окно владельца пункта в браузере: PIN. Сервер n8n подменён: PIN «4321», после неверного PIN — сообщение, после верного — окно пункта.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8128'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
calls = []
ME = {"ok": True, "pct": 25, "point": {"name": "Зарафшон сити", "owner": "Суҳроб"}, "tools": [{"name": "Фен", "qty": 1, "out": 0, "broken": 0, "free": 1, "photo_id": "", "min_hour": 0, "min_day": 40, "thumb": ""}], "rentals": [], "earned": 0, "collected": 0, "owed": 0, "handed": 0, "handovers": []}
def h(route):
    b = json.loads(route.request.post_data); calls.append(b)
    if b.get('pin') == '4321': return route.fulfill(json=ME)
    if not b.get('pin'): return route.fulfill(json={"ok": False, "need_pin": True, "error": "введите PIN"})
    return route.fulfill(json={"ok": False, "need_pin": True, "error": "Неверный PIN. Осталось попыток: 8"})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
try:
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = br.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/prokat-owner', h)
        pg.goto('http://localhost:8128/punkt.html#t=' + 'a' * 32); pg.wait_for_timeout(600)
        t = pg.inner_text('#app'); check('Введите PIN пункта' in t and 'Неверный' not in t, 'сначала спрашивает PIN, без ошибки')
        check('#t=' not in pg.url, 'ссылка убрана из адресной строки')
        pg.fill('#f-pin', '12'); pg.click('button[type=submit]'); pg.wait_for_timeout(200)
        check('PIN — 4 цифры' in pg.inner_text('#app') and len(calls) == 1, 'короткий PIN не отправляется')
        pg.fill('#f-pin', '1111'); pg.click('button[type=submit]'); pg.wait_for_timeout(500)
        check('Осталось попыток: 8' in pg.inner_text('#app') and calls[-1].get('pin') == '1111', 'неверный PIN — сообщение')
        pg.fill('#f-pin', '4321'); pg.press('#f-pin', 'Enter'); pg.wait_for_timeout(600)
        t = pg.inner_text('#app'); check('Зарафшон сити' in t and 'Фен' in t, 'верный PIN открывает окно пункта')
        check('Ваша доля (25%)' in t and 'К передаче Нурулло 75%' in t, 'доля пункта с сервера')
        check(all(c.get('token') == 'a' * 32 for c in calls), 'токен уходит с каждым запросом')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('PUNKT PIN E2E PASSED')
finally:
    srv.terminate()
