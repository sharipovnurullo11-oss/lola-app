# Проверка экранов «Склад» и фото-истории инструментов проката в браузере. Сервер n8n подменён: запросы /prokat со складскими действиями
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
        if a == 'points': return route.fulfill(json={"ok": True, "points": [{"name": "Зарафшон сити", "city": "Душанбе", "profit": 100, "status": "В плюсе"}], "total": 1})
        if a == 'point': return route.fulfill(json={"ok": True, "point": {"name": b['name'], "city": "Душанбе", "months": [], "fills": [], "journal": [], "rent": {"count": 0, "collected": 0, "owner_share": 0, "owed": 0, "handed": 0, "handovers": []}, "last_visit": ""}})
        if a == 'tour_point': return route.fulfill(json={"ok": True, "point": b['name'], "last_visit": "2026-10-20", "items": [{"name": "Перфаратори майда 1", "qty": 1, "last_state": "на месте", "last_date": "2026-10-20", "last_photo_id": "x", "last_note": ""}, {"name": "Лобзик", "qty": 2, "last_state": "", "last_date": "", "last_photo_id": "", "last_note": ""}]})
        if a == 'moves': return route.fulfill(json={"ok": True, "moves": [{"date": "2026-09-01", "tool": b.get('tool', ''), "from": "Ховарон", "to": b.get('name', ''), "qty": 1, "state": "", "note": ""}]})
        if a == 'move': return route.fulfill(json={"ok": True, "moved": {"tool": b['tool'], "from": b['from'], "to": b['to'], "qty": b['qty']}})
        if a == 'owner_link': return route.fulfill(json={"ok": True, "point": b['name'], "link": "https://app.nurullo-sharipov.tech/punkt#t=" + "b" * 32, "owner": "Суҳроб", "since": "2026-10-23"})
        if a == 'owner_link_new': return route.fulfill(json={"ok": True, "point": b['name'], "link": "https://app.nurullo-sharipov.tech/punkt#t=" + "c" * 32, "owner": "Суҳроб", "since": "2026-10-26"})
        if a == 'reminders': return route.fulfill(json={"ok": True, "visit": [], "owed": [], "broken": []})
        if str(a).startswith('stock'): return route.fulfill(json=solve(b))
    if u.endswith('/magazin'): return route.fulfill(json={"ok": False, "error": "нет доступа"})
    if u.endswith('/prokat-foto'):
        b = json.loads(route.request.post_data); calls.append(b); img = 'http://localhost:8127/public/icon-192.png'
        if b.get('action') == 'tools': return route.fulfill(json={"ok": True, "point": b['name'], "tools": [{"name": "Перфаратори майда 1", "kind": "Маленький перфоратор", "prices": [{"srok": "коротко", "cena": 30, "note": ""}, {"srok": "сутки", "cena": 40, "note": ""}], "qty": 1, "count": 2, "first": "2026-02-22", "last": "2026-10-20", "url": img}, {"name": "Лобзик", "qty": 2, "count": 0, "first": "", "last": "", "url": ""}]})
        if b.get('action') == 'relabel': return route.fulfill(json={"ok": True, "tool": b['tool']})
        if b.get('action') == 'tool': return route.fulfill(json={"ok": True, "point": b['name'], "tool": b['tool'], "kind": "Маленький перфоратор", "prices": [{"srok": "коротко", "cena": 30, "note": ""}, {"srok": "сутки", "cena": 40, "note": ""}], "total": 2, "photos": [{"date": "2026-02-22", "src": "таблица", "state": "", "note": "", "url": img}, {"date": "2026-10-20", "src": "объезд", "state": "на месте", "note": "", "url": img}]})
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
        pg.click('[data-pk="home"]'); pg.wait_for_timeout(300); pg.click('[data-pk="folder"]'); pg.wait_for_timeout(300); pg.click('[data-pk="p:0"]'); pg.wait_for_timeout(800)
        t = body(pg); check('Инструменты на пункте' in t and 'Перфаратори майда 1' in t and 'Лобзик' in t and 'фото нет' in t, 'в окне пункта иконки инструментов')
        check('от 30 смн' in t, 'на иконке цена из прайса')
        check(any(c.get('action') == 'tools' and c.get('name') == 'Зарафшон сити' for c in calls), 'запрос инструментов пункта ушёл с action tools')
        pg.click('[data-pk="pt:0"]'); pg.wait_for_timeout(800)
        t = body(pg); check('22.02.2026' in t and '20.10.2026' in t and t.index('22.02.2026') < t.index('20.10.2026') and 'объезд' in t, 'фото инструмента по датам с подписью даты, от старого к новому')
        check('Перевозки' in t and 'Ховарон → Зарафшон сити' in t, 'в истории инструмента журнал перевозок')
        pg.click('[data-pk="mv-open"]'); pg.wait_for_timeout(200); pg.select_option('#pk-mv-to', 'Склад'); pg.wait_for_timeout(200)
        check('В каком состоянии на склад' in body(pg), 'перевозка на склад спрашивает состояние')
        pg.click('[data-pk="mv-st:1"]'); pg.fill('#pk-mv-qty', '1'); pg.fill('#pk-mv-note', 'в ремонт'); pg.click('[data-pk="mv-save"]'); pg.wait_for_timeout(800)
        mv = [c for c in calls if c.get('action') == 'move']
        check(len(mv) == 1 and mv[0]['from'] == 'Зарафшон сити' and mv[0]['to'] == 'Склад' and mv[0]['state'] == 'в ремонте' and mv[0]['qty'] == 1, 'перевозка ушла на сервер: откуда, куда, состояние')
        t = body(pg); check('Перевезено' in t, 'сообщение о перевозке')
        check('Цена аренды (Маленький перфоратор)' in t and 'до 3 ч — 30 смн · сутки — 40 смн' in t, 'в карточке инструмента цены аренды')
        pg.click('[data-pk="pth:1"]'); pg.wait_for_timeout(300); check(pg.is_visible('[data-pk="big-close"]'), 'фото открывается крупно')
        pg.click('[data-pk="big-close"]')
        pg.click('[data-pk="rl:0"]'); pg.wait_for_timeout(200); pg.click('[data-pk="rlp:0"]'); pg.click('[data-pk="rl-save"]'); pg.wait_for_timeout(800)
        rq = [c for c in calls if c.get('action') == 'relabel']
        check(len(rq) == 1 and rq[0]['tool'] == 'Лобзик' and rq[0]['name'] == 'Зарафшон сити', 'кнопка «Это другой инструмент» переносит фото в выбранный инструмент')
        t = body(pg); check('Фото перенесено в «Лобзик»' in t and '22.02.2026' not in t, 'перенесённое фото убрано из этой истории')
        pg.click('[data-pk="pt-back"]'); pg.wait_for_timeout(300); check('Инструменты на пункте' in body(pg), 'назад — снова окно пункта')
        pg.click('[data-pk="ol-open"]'); pg.wait_for_timeout(500)
        check(pg.input_value('#pk-ol-link').endswith('b' * 32) and 'Суҳроб' in body(pg) and '23.10.2026' in body(pg), 'ссылка владельца показана с именем и датой')
        check('wa.me/?text=' in pg.inner_html('#sp-body'), 'кнопка WhatsApp со ссылкой')
        pg.click('[data-pk="ol-ask"]'); pg.wait_for_timeout(200); check('Старая ссылка сразу перестанет работать' in body(pg), 'перед новой ссылкой — предупреждение')
        pg.click('[data-pk="ol-cancel"]'); pg.wait_for_timeout(200); check(not [c for c in calls if c.get('action') == 'owner_link_new'], 'отмена ничего не отправляет')
        pg.click('[data-pk="ol-ask"]'); pg.wait_for_timeout(200); pg.click('[data-pk="ol-new"]'); pg.wait_for_timeout(600)
        nl = [c for c in calls if c.get('action') == 'owner_link_new']
        check(len(nl) == 1 and nl[0]['name'] == 'Зарафшон сити' and len(nl[0].get('id', '')) >= 6, 'новая ссылка запрошена с номером записи')
        check(pg.input_value('#pk-ol-link').endswith('c' * 32) and 'Старая больше не работает' in body(pg), 'показана новая ссылка')
        pg.click('[data-pk="tour"]'); pg.wait_for_timeout(800)
        t = body(pg); check(t.count('Прошлое фото') == 1 and '20.10.2026' in t, 'в объезде прошлое фото инструмента для сравнения')
        pg.click('[data-pk="tprev:0"]'); pg.wait_for_timeout(300); check(pg.is_visible('[data-pk="big-close"]'), 'прошлое фото открывается крупно'); pg.click('[data-pk="big-close"]')
        pg.click('[data-pk="tour-back"]'); pg.wait_for_timeout(300)
        pg.click('[data-pk="pt:0"]'); pg.wait_for_timeout(600); pg.screenshot(path=os.environ.get('SHOT2', '/tmp/istoriya.png'), full_page=True)
        check(not errs, 'нет ошибок на странице: %s' % errs)
        print('SKLAD + FOTO E2E PASSED')
finally:
    srv.terminate()
