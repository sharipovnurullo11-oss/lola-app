# Касса Шамсуло в браузере: сдача кассы (№299). Сервер /magazin подменён.
# После сдачи видно, сколько должно быть, разницу и итог смены по способам оплаты; в отчёте руководитель подтверждает смену.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8130'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
SHOP = 'kshamsulotestkod0000000000000'; calls = []
KS = []
SD = [{"id": "sdac000001", "date": "2026-10-27", "who": "Зоир", "fact": 14, "exp": 16, "diff": -2, "by": {"nal": 16, "alif": 12, "dolg": 12}, "ok": ""}]
def resp(extra=None):
    r = {"ok": True, "role": "owner", "products": [], "debts": [], "receipts": [], "report": {"month": "2026-10", "revenue": 0, "profit": 0, "owner": 0, "debt": 0, "byDay": {}, "checks": [], "low": [], "expenses": 0, "expBy": {}, "expList": [], "payBy": {}, "payToday": {}, "sdachi": SD, "kassa": KS, "days": {}, "salary": [], "payList": []}}
    r.update(extra or {}); return r
def h(route):
    u = route.request.url
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b)
        if b.get('action') == 'ping': return route.fulfill(json={"ok": False, "error": "неизвестное действие"})
        if b.get('action') == 'sdacha_ok': SD[0]['ok'] = '2026-10-27'
        if b.get('action') == 'kassa': KS.append({"id": b['id'], "date": b['date'], "who": b.get('who') or 'Руководитель', "kind": b['kind'], "sum": b['amount'], "note": b.get('note', '')})
        if b.get('action') == 'sdacha': return route.fulfill(json=resp({"sdacha": {"expected": 30, "fact": 30, "diff": 0, "by": {"nal": 30, "dushanbe": 20}}}))
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
        pg.goto('http://localhost:8130/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("c => { localStorage.setItem('ew_cab', c); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }", SHOP); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500); pg.click('#sp-body [data-fin="shop"]'); pg.wait_for_timeout(800)
        pg.click('[data-shop="sdopen"]'); pg.wait_for_timeout(200); pg.fill('#sh-sd-fact', '30'); pg.click('[data-shop="sdsave"]'); pg.wait_for_timeout(600)
        t = body(pg); check('Всё сходится' in t and 'Смена: Наличные 30 · Душанбе Сити 20' in t, 'после сдачи — итог смены по способам оплаты')
        pg.locator('[data-shop="kopen"]').first.click(); pg.wait_for_timeout(300)
        pg.fill('#sh-k-amt', '40'); pg.click('[data-shop="ksave"]'); pg.wait_for_timeout(200)
        check('Выберите: внесли или взяли' in body(pg), 'без выбора «внёс / взял» не записывает')
        pg.click('[data-shop="kkind"][data-k="out"]'); pg.wait_for_timeout(200)
        check(pg.input_value('#sh-k-amt') == '40', 'сумма не стирается при выборе')
        pg.click('[data-shop="kchip"][data-k="Маруф"]'); pg.fill('#sh-k-note', 'забрал на товар'); pg.click('[data-shop="ksave"]'); pg.wait_for_timeout(600)
        kc = [c for c in calls if c.get('action') == 'kassa']
        check(len(kc) == 1 and kc[0]['kind'] == 'out' and kc[0]['amount'] == 40 and kc[0]['who'] == 'Маруф' and kc[0]['note'] == 'забрал на товар', 'изъятие ушло на сервер')
        check('Записано: взяли из кассы' in body(pg), 'сообщение о записи')
        pg.click('[data-shop="tab"][data-k="otchet"]'); pg.wait_for_timeout(500)
        t = body(pg); check('Внесли и взяли из кассы' in t and 'забрал на товар' in t and '−40' in t, 'в отчёте видно изъятие')
        t = body(pg); check('Зоир' in t and 'Наличные 16 · Алиф 12 · В долг 12' in t, 'в отчёте сдача с разбивкой по способам')
        check('Итоги дня на телефон' in t and pg.locator('[data-shop="ihour"][data-k="21"]').get_attribute('class') == 'btn', 'итоги дня: по умолчанию 21:00')
        pg.click('[data-shop="ihour"][data-k="22"]'); pg.wait_for_timeout(500)
        ih = [c for c in calls if c.get('action') == 'itogi_time']
        check(len(ih) == 1 and ih[0]['hour'] == 22, 'запасное время итогов ушло на сервер')
        check(pg.locator('[data-shop="sdok"][data-k="sdac000001"]').count() == 1, 'кнопка «Подтвердить смену»')
        pg.click('[data-shop="sdok"][data-k="sdac000001"]'); pg.wait_for_timeout(600)
        ok = [c for c in calls if c.get('action') == 'sdacha_ok']
        check(len(ok) == 1 and ok[0]['sdacha'] == 'sdac000001' and len(ok[0]['id']) >= 6, 'подтверждение ушло на сервер')
        check('Смена подтверждена' in body(pg) and pg.locator('[data-shop="sdok"]').count() == 0, 'смена отмечена подтверждённой')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SHOP SDACHA E2E PASSED')
finally:
    srv.terminate()
