# Проверка окна «Финансист по объектам» в браузере: 6 объектов и «+», внутри Аванс / Мастера / Материалы, итог внизу.
import subprocess, time, json, os, re
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8127'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
rows = []; calls = []; nid = [1]
def pts():
    P = {}
    voided = set(r['ssylka'] for r in rows if r['tip'] == 'void')
    for r in rows:
        if r['tip'] == 'tochka': P.setdefault(r['tochka'], {'name': r['tochka'], 'zakazchik': r['zakazchik'], 'inn': 0, 'out': 0, 'by': {}})
    for r in rows:
        if r['tip'] in ('prihod', 'rashod') and r['oid'] not in voided and r['tochka'] in P:
            p = P[r['tochka']]
            if r['tip'] == 'prihod': p['inn'] += r['summa']
            else: p['out'] += r['summa']; p['by'][r['statya']] = p['by'].get(r['statya'], 0) + r['summa']
    for p in P.values(): p['left'] = p['inn'] - p['out']; p['owes'] = None; p['mastersOwe'] = 0; p['dogovor'] = None
    return P
def h(route):
    u = route.request.url
    if not u.endswith('/objekty'): return route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
    b = json.loads(route.request.post_data); calls.append(b); a = b['action']; P = pts()
    if a == 'ping': return route.fulfill(json={"ok": True})
    if a == 'list': return route.fulfill(json={"ok": True, "points": list(P.values()), "total": {"inn": 0, "out": 0, "left": 0}, "unassigned": [], "recent": []})
    if a == 'point':
        p = dict(P[b['name']]); voided = set(r['ssylka'] for r in rows if r['tip'] == 'void')
        p['entries'] = [{"oid": r['oid'], "tip": r['tip'], "tochka": r['tochka'], "data": r['data'], "statya": r['statya'], "summa": r['summa'], "master": r['master'], "komment": r['komment']} for r in reversed(rows) if r['tip'] in ('prihod', 'rashod') and r['tochka'] == b['name'] and r['oid'] not in voided]
        return route.fulfill(json={"ok": True, "point": p})
    def add(tip, **kw):
        rows.append(dict({'oid': b['oid'], 'tip': tip, 'tochka': '', 'data': b.get('date', ''), 'statya': '', 'summa': 0, 'master': '', 'zakazchik': '', 'komment': b.get('note', ''), 'ssylka': ''}, **kw))
    if a == 'add_point': add('tochka', tochka=b['name'], zakazchik=b.get('zakazchik', '')); return route.fulfill(json={"ok": True})
    if a == 'in': add('prihod', tochka=b['tochka'], summa=float(b['amount'])); return route.fulfill(json={"ok": True})
    if a == 'out':
        if b['statya'] == 'master' and not b.get('master'): return route.fulfill(json={"ok": False, "error": "укажите мастера"})
        add('rashod', tochka=b['tochka'], statya=b['statya'], master=b.get('master', ''), summa=float(b['amount'])); return route.fulfill(json={"ok": True})
    if a == 'void': add('void', ssylka=b['target']); return route.fulfill(json={"ok": True})
    return route.fulfill(json={"ok": False, "error": "неизвестное действие"})
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def shot(pg, n):
    d = os.environ.get('SHOT')
    if d: pg.screenshot(path=os.path.join(d, n + '.png'))
def num(t): return int(re.sub(r'[^0-9]', '', t) or 0)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8127/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("localStorage.setItem('ew_cab','kasrortestkod000000000000000');localStorage.setItem('ew_obj_for','kasrortestkod000000000000000')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(pg.is_visible('#sp-home [data-home="obj"]'), 'плитка «Финансист по объектам» есть')
        pg.click('#sp-home [data-home="obj"]'); pg.wait_for_timeout(600)
        body = '#sp-body'
        check(pg.locator(body + ' [data-obj="f:client"]').count() == 7, 'пустое окно: 6 мест под объекты и кнопка «+»')
        pg.click(body + ' [data-obj="f:client"] >> nth=0'); pg.wait_for_timeout(200)
        pg.fill('#ob-name', 'Рустам'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(any(c.get('action') == 'add_point' and c.get('name') == 'Рустам' for c in calls), 'имя клиента записано как новая точка')
        check(pg.locator(body + ' [data-obj^="pt:"]').count() == 1 and pg.locator(body + ' [data-obj="f:client"]').count() == 6, 'теперь 1 объект, 5 пустых мест и «+»')
        pg.click(body + ' [data-obj="f:client"] >> nth=5'); pg.wait_for_timeout(200)
        pg.fill('#ob-name', 'Фарид'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(pg.locator(body + ' [data-obj^="pt:"]').count() == 2, '«+» добавляет ещё один объект')
        shot(pg, 'home')
        pg.click(body + ' [data-obj="pt:Рустам"]'); pg.wait_for_timeout(500)
        t = pg.inner_text(body)
        check(all(x in t for x in ['Аванс', 'Мастера', 'Материалы', 'Получено', 'Потрачено', 'Осталось']), 'внутри объекта три кнопки и итог')
        pg.click(body + ' [data-obj="sec:in"]'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj="f:sec"]'); pg.wait_for_timeout(200)
        pg.fill('#ob-sum', '5000'); pg.fill('#ob-note', 'первый аванс'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(any(c.get('action') == 'in' and c.get('tochka') == 'Рустам' and c.get('amount') == '5000' and c.get('note') == 'первый аванс' and c.get('date') for c in calls), 'аванс: сумма, дата, комментарий записаны')
        check('первый аванс' in pg.inner_text(body), 'аванс виден в списке')
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300)
        pg.click(body + ' [data-obj="sec:master"]'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj="f:sec"]'); pg.wait_for_timeout(200)
        pg.fill('#ob-sum', '800'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(300)
        check('имя мастера' in pg.inner_text(body).lower() and not any(c.get('statya') == 'master' for c in calls), 'мастер без имени не записывается')
        pg.fill('#ob-note', 'Фарход'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(any(c.get('action') == 'out' and c.get('statya') == 'master' and c.get('master') == 'Фарход' and c.get('amount') == '800' for c in calls) and 'Фарход' in pg.inner_text(body), 'мастер: сумма, дата, имя записаны и видны')
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300)
        pg.click(body + ' [data-obj="sec:material"]'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj="f:sec"]'); pg.wait_for_timeout(200)
        pg.fill('#ob-sum', '1200'); pg.fill('#ob-note', 'цемент'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(any(c.get('action') == 'out' and c.get('statya') == 'material' and c.get('note') == 'цемент' for c in calls), 'материалы: что куплено записано')
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(400)
        boxes = pg.locator(body + ' div[style*="min-width:90px"] div').all_inner_texts()
        check([num(x) for x in boxes[:3]] == [5000, 2000, 3000], 'итог внизу: получено 5000, потрачено 2000, осталось 3000 ' + str(boxes))
        shot(pg, 'object')
        pg.click(body + ' [data-obj="sec:material"]'); pg.wait_for_timeout(300)
        shot(pg, 'section')
        pg.click(body + ' [data-obj^="void:"] >> nth=0'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj^="void:"] >> nth=0'); pg.wait_for_timeout(600)
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(400)
        boxes = pg.locator(body + ' div[style*="min-width:90px"] div').all_inner_texts()
        check([num(x) for x in boxes[:3]] == [5000, 800, 4200], 'отмена записи пересчитывает итог ' + str(boxes))
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300)
        check(pg.locator(body + ' [data-obj^="pt:"]').count() == 2, 'назад к списку объектов')
        check(not errs, 'нет ошибок страницы ' + str(errs))
        b.close()
finally: srv.terminate()
print('OBJEKTY E2E PASSED')
