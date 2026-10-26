# Проверка экрана «Склад» проката в браузере. Сервер n8n подменён: запросы /prokat со складскими действиями
# выполняет тот же код узла «Склад: решить» (n8n/prokat/sklad.js) через node.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8127'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
DB = {'st': [], 'ph': [], 'nid': 1}; calls = []
RUN = r'''
const fs = require('fs'); const [code, inp] = [fs.readFileSync(process.argv[1], 'utf8'), JSON.parse(fs.readFileSync(0, 'utf8'))];
const nodes = { 'Прокат: запрос': [{ json: { body: inp.body } }], 'Кабинет': [{ json: { ok: true } }], 'Склад': inp.st.map(j => ({ json: j })), 'Фото склада': inp.ph.map(j => ({ json: j })) };
const $ = n => ({ first: () => nodes[n][0], all: () => nodes[n] });
process.stdout.write(JSON.stringify(new Function('$', '$input', code)($, { first: () => ({ json: { op: 'none', resp: { ok: false } } }) })[0].json));
'''
def solve(body):
    r = subprocess.run(['node', '-e', RUN, os.path.join(ROOT, 'n8n/prokat/sklad.js')], input=json.dumps({'body': body, 'st': DB['st'], 'ph': DB['ph']}), capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    if j.get('op') == 'stock_insert':
        for x in j['rows']: DB['st'].append(dict(x, id=DB['nid'])); DB['nid'] += 1
        if j.get('foto_row'): DB['ph'].append(dict(j['foto_row'], id=DB['nid'])); DB['nid'] += 1
    return j['resp']
def h(route):
    u = route.request.url
    if u.endswith('/prokat'):
        b = json.loads(route.request.post_data); calls.append(b); a = b.get('action')
        if a == 'points': return route.fulfill(json={"ok": True, "points": [], "total": 0})
        if a == 'reminders': return route.fulfill(json={"ok": True, "visit": [], "owed": [], "broken": []})
        if str(a).startswith('stock'): return route.fulfill(json=solve(b))
    route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def body(pg): return pg.inner_text('#sp-body')
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8127/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("localStorage.setItem('ew_cab','k8testprokatkabinetkod00000')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500)
        pg.click('[data-pk="sklad"]'); pg.wait_for_timeout(500)
        t = body(pg); check('Склад' in t and 'На складе пока пусто' in t and 'Новый инструмент' in t, 'пустой склад с кнопкой «Новый инструмент»')
        pg.click('[data-pk="sk-new"]'); pg.fill('#pk-sk-name', 'Болгарка большая')
        pg.set_input_files('input[data-skphoto]', os.path.join(ROOT, 'public/icon-512.png')); pg.wait_for_timeout(800)
        check('Фото готово' in body(pg), 'фото инструмента сделано и сжато')
        pg.click('[data-pk="sk-st:0"]'); pg.fill('#pk-sk-qty', '3'); pg.click('[data-pk="sk-save"]'); pg.wait_for_timeout(1500)
        ph = [c for c in calls if c.get('action') == 'stock_photo']
        check(len(ph) == 1 and len(ph[0]['photo']) <= 58000, 'фото ушло на сервер маленьким (%d знаков)' % len(ph[0]['photo']))
        t = body(pg); check('Болгарка большая' in t and 'Запчасти' in t and pg.locator('#sp-body img').count() >= 1, 'открылась карточка вида с фото')
        pg.click('[data-pk="sk-f:move"]'); pg.click('[data-pk="sk-st:0"]'); pg.click('[data-pk="sk-to:1"]'); pg.fill('#pk-sk-qty', '1'); pg.click('[data-pk="sk-save"]'); pg.wait_for_timeout(1200)
        g = [x for x in DB['st'] if x['sostoyanie'] in ('сломан', 'в ремонте')]
        check(sum(x['izmenenie'] for x in g if x['sostoyanie'] == 'сломан') == 2 and sum(x['izmenenie'] for x in g if x['sostoyanie'] == 'в ремонте') == 1, 'смена состояния: 1 из «сломан» в «в ремонте»')
        pg.click('[data-pk="sk-f:p+"]'); pg.fill('#pk-sk-part', 'Щётки'); pg.fill('#pk-sk-qty', '4'); pg.click('[data-pk="sk-save"]'); pg.wait_for_timeout(1200)
        t = body(pg); check('Щётки' in t, 'запчасть добавлена к виду')
        pg.click('[data-pk="sk-f:del"]'); pg.click('[data-pk="sk-st:2"]'); pg.fill('#pk-sk-qty', '1'); pg.click('[data-pk="sk-save"]'); pg.wait_for_timeout(1200)
        check('на складе столько нет' in body(pg), 'нельзя убрать то, чего нет')
        pg.click('[data-pk="sk-cancel"]'); pg.click('[data-pk="sk-list"]'); pg.wait_for_timeout(800)
        t = body(pg); check('Болгарка большая' in t and 'Запчастей всего' in t and 'сломан 2' in t and 'в ремонте 1' in t, 'список: плитка вида с количеством по состояниям')
        check(pg.evaluate("document.documentElement.scrollWidth <= 390"), 'нет горизонтальной прокрутки на телефоне')
        pg.screenshot(path=os.environ.get('SHOT', '/tmp/sklad.png'), full_page=True)
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SKLAD E2E PASSED')
finally:
    srv.terminate()
