# Касса Шамсуло в браузере: возврат по чеку. Сервер /magazin подменён: чек с двумя позициями, часть уже вернули.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8130'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
SHOP = 'kshamsulotestkod0000000000000'; calls = []
P = [{"kod": "015", "name": "Гвозди 100", "price": 12, "zakup": 10, "marzha": 20, "qty": 50, "unit": "sht", "per": 0, "foto": 0, "bar": ["4600000000017"]},
     {"kod": "016", "name": "Саморез 50", "price": 3, "zakup": 2, "marzha": 50, "qty": 500, "unit": "sht", "per": 0, "foto": 0, "bar": []}]
def resp(): return {"ok": True, "role": "owner", "products": P, "debts": [], "receipts": [], "report": {"month": "2026-10", "revenue": 0, "profit": 0, "owner": 0, "debt": 0, "byDay": {}, "checks": [], "low": [], "expenses": 0, "expBy": {}, "expList": [], "payBy": {}, "payToday": {}, "sdachi": [], "days": {}, "salary": [], "payList": []}}
def h(route):
    u = route.request.url
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b)
        if b.get('action') == 'ping': return route.fulfill(json={"ok": False, "error": "неизвестное действие"})
        if b.get('action') == 'chek_get':
            if not str(b.get('chek', '')).endswith('xgyg1'): return route.fulfill(json={"ok": False, "error": "чек не найден или отменён"})
            return route.fulfill(json={"ok": True, "chek": {"id": "bmvnsot615xgyg1", "date": "2026-10-25", "pay": "nal", "who": "", "total": 60, "lines": [{"kod": "015", "name": "Гвозди 100", "qty": 3, "price": 12, "unit": "sht", "returned": 1, "left": 2}, {"kod": "016", "name": "Саморез 50", "qty": 8, "price": 3, "unit": "sht", "returned": 0, "left": 8}]}})
        if b.get('action') == 'vozvrat': return route.fulfill(json={"ok": True, "vozvrat": {"chek": "bmvnsot615xgyg1r000001", "from": "bmvnsot615xgyg1", "total": 30, "pay": "nal", "who": ""}})
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
        pg.goto('http://localhost:8130/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("c => { localStorage.setItem('ew_cab', c); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }", SHOP); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500); pg.click('#sp-body [data-fin="shop"]'); pg.wait_for_timeout(800)
        pg.click('[data-shop="retopen"]'); pg.wait_for_timeout(200)
        pg.fill('#sh-ret-q', '12'); pg.click('[data-shop="retfind"]'); pg.wait_for_timeout(200)
        check('не меньше 6 знаков' in body(pg) and not [c for c in calls if c.get('action') == 'chek_get'], 'короткий номер чека не ищем')
        pg.click('[data-shop="scan"][data-k="ret"]'); pg.wait_for_timeout(300); pg.fill('#sh-scan-in', '615xgyg1'); pg.click('#sh-scan-ok'); pg.wait_for_timeout(600)
        t = body(pg); check('bmvnsot615xgyg1' in t and 'Гвозди 100' in t and 'уже вернули 1' in t, 'скан штрихкода с чека находит чек и показывает, что уже вернули')
        pg.fill('#sh-ret-0', '3'); pg.click('[data-shop="retgo"]'); pg.wait_for_timeout(200)
        check('не больше 2' in body(pg) and not [c for c in calls if c.get('action') == 'vozvrat'], 'больше оставшегося не отправляем')
        pg.fill('#sh-ret-0', '2'); pg.fill('#sh-ret-1', '2'); pg.click('[data-shop="retgo"]'); pg.wait_for_timeout(800)
        vz = [c for c in calls if c.get('action') == 'vozvrat']
        check(len(vz) == 1 and vz[0]['chek'] == 'bmvnsot615xgyg1' and vz[0]['items'] == [{'kod': '015', 'qty': 2}, {'kod': '016', 'qty': 2}] and len(vz[0].get('id', '')) >= 6, 'возврат ушёл на сервер: чек, позиции, количество')
        t = body(pg); check('Возврат оформлен: верните покупателю 30' in t and 'Товар вернулся на склад' in t, 'сообщение: сколько денег вернуть')
        check(any(c.get('action') == 'list' for c in calls[-2:]), 'после возврата касса обновилась')
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SHOP RETURN E2E PASSED')
finally:
    srv.terminate()
