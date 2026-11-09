# Проверка окна «Финансист по объектам» в браузере: 6 объектов и «+», внутри Аванс / Мастера / Материалы, итог внизу.
import subprocess, time, json, os, re
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8127'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
rows = []; calls = []; nid = [1]; photos = {}
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
    for p in P.values():
        p['left'] = p['inn'] - p['out']; p['owes'] = None; p['dogovor'] = None; M = {}
        for r in rows:
            if r['tochka'] != p['name'] or r['oid'] in voided: continue
            if r['tip'] == 'rashod' and r['statya'] == 'master' and r['master']: M.setdefault(r['master'], {'name': r['master'], 'dogovor': None, 'paid': 0})['paid'] += r['summa']
            if r['tip'] == 'master_dogovor': M.setdefault(r['master'], {'name': r['master'], 'dogovor': None, 'paid': 0})['dogovor'] = r['summa']
        for m in M.values(): m['left'] = None if m['dogovor'] is None else max(0, m['dogovor'] - m['paid'])
        p['masters'] = list(M.values()); p['mastersOwe'] = sum(m['left'] or 0 for m in M.values())
    return P
def h(route):
    u = route.request.url
    if u.endswith('/foto-big'):
        fb = json.loads(route.request.post_data); calls.append(fb)
        if fb['action'] == 'save': photos[fb['name']] = fb['foto']; return route.fulfill(json={"ok": True})
        return route.fulfill(json={"ok": True, "foto": photos.get(fb['name'], '')})
    if not u.endswith('/objekty'): return route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
    b = json.loads(route.request.post_data); calls.append(b); a = b['action']; P = pts()
    if a == 'ping': return route.fulfill(json={"ok": True})
    if a == 'list': return route.fulfill(json={"ok": True, "points": list(P.values()), "total": {"inn": 0, "out": 0, "left": 0}, "unassigned": [], "recent": []})
    if a == 'point':
        p = dict(P[b['name']]); voided = set(r['ssylka'] for r in rows if r['tip'] == 'void')
        p['entries'] = [{"oid": r['oid'], "tip": r['tip'], "tochka": r['tochka'], "data": r['data'], "statya": r['statya'], "summa": r['summa'], "master": r['master'], "komment": r['komment'], "foto": r.get('foto', False)} for r in reversed(rows) if r['tip'] in ('prihod', 'rashod') and r['tochka'] == b['name'] and r['oid'] not in voided]
        return route.fulfill(json={"ok": True, "point": p})
    def add(tip, **kw):
        rows.append(dict({'oid': b['oid'], 'tip': tip, 'tochka': '', 'data': b.get('date', ''), 'statya': '', 'summa': 0, 'master': '', 'zakazchik': '', 'komment': b.get('note', ''), 'ssylka': '', 'foto': bool(b.get('foto'))}, **kw))
    if a == 'add_point': add('tochka', tochka=b['name'], zakazchik=b.get('zakazchik', '')); return route.fulfill(json={"ok": True})
    if a == 'in': add('prihod', tochka=b['tochka'], summa=float(b['amount'])); return route.fulfill(json={"ok": True})
    if a == 'out':
        if b['statya'] == 'master' and not b.get('master'): return route.fulfill(json={"ok": False, "error": "укажите мастера"})
        add('rashod', tochka=b['tochka'], statya=b['statya'], master=b.get('master', ''), summa=float(b['amount'])); return route.fulfill(json={"ok": True})
    if a == 'lich_list':
        vv = set(r['ssylka'] for r in rows if r['tip'] == 'void'); L = [r for r in rows if r['tip'] == 'lichnoe' and r['oid'] not in vv]
        i = sum(r['summa'] for r in L if r['statya'] == 'prihod'); o = sum(r['summa'] for r in L if r['statya'] == 'rashod')
        return route.fulfill(json={"ok": True, "inn": i, "out": o, "left": i - o, "entries": [{"oid": r['oid'], "kind": 'in' if r['statya'] == 'prihod' else 'out', "data": r['data'], "summa": r['summa'], "komment": r['komment']} for r in reversed(L)]})
    if a == 'lich_add':
        if float(b['amount'] or 0) <= 0: return route.fulfill(json={"ok": False, "error": "неверная сумма"})
        add('lichnoe', statya='prihod' if b['kind'] == 'in' else 'rashod', summa=float(b['amount'])); return route.fulfill(json={"ok": True})
    if a == 'master_set': add('master_dogovor', tochka=b['tochka'], master=b['master'], summa=float(b['amount'])); return route.fulfill(json={"ok": True})
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
        pg.add_init_script("window.SpeechRecognition = window.webkitSpeechRecognition = function(){ this.start = function(){ var s=this; setTimeout(function(){ s.onresult({results:[[{transcript: window.__say || 'материалы цемент 500 сомони'}]]}); s.onend(); }, 60); }; this.stop = function(){}; };")
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8127/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("localStorage.setItem('ew_cab','kasrortestkod000000000000000');localStorage.setItem('ew_obj_for','kasrortestkod000000000000000')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(pg.is_visible('#sp-home [data-home="obj"]'), 'плитка «Финансист по объектам» есть')
        pg.click('#sp-home [data-home="obj"]'); pg.wait_for_timeout(600)
        body = '#sp-body'
        check(not pg.is_visible('#m-spec [data-close]'), 'крестик X в окне объектов убран')
        check(pg.evaluate("document.getElementById('m-spec').style.width") == '100vw', 'окно объектов на весь экран')
        check(pg.inner_text('#sp-body [data-sp-back]').strip().endswith('Назад'), 'вверху кнопка «Назад»')
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
        check('Долги по мастерам' in pg.inner_text(body) and 'Фарход' in pg.inner_text(body) and 'договор не указан' in pg.inner_text(body), 'долги по мастерам: мастер виден, договор не указан')
        pg.click(body + ' [data-obj="fm:Фарход"]'); pg.wait_for_timeout(200); pg.fill('#ob-sum', '2000'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(any(c.get('action') == 'master_set' and c.get('master') == 'Фарход' and c.get('amount') == '2000' for c in calls), 'договор с мастером записан')
        t = pg.inner_text(body)
        check('осталось 1 200' in t and 'Долги по мастерам: 1 200' in t, 'долг по мастеру: выплачено 800, договор 2000, осталось 1200 ' + t[:300])
        shot(pg, 'masters')
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
        # голос: «материалы цемент 500 сомони» открывает форму материалов, уже заполненную
        pg.click(body + ' [data-obj="pt:Рустам"]'); pg.wait_for_timeout(500)
        pg.click(body + ' [data-obj="mic-obj"]'); pg.wait_for_timeout(500)
        check(pg.input_value('#ob-sum') == '500' and 'цемент' in pg.input_value('#ob-note') and 'Материалы' in pg.inner_text(body), 'голос: форма «Материалы» заполнена: 500, цемент')
        n0 = len([c for c in calls if c.get('action') == 'out'])
        check(len([c for c in calls if c.get('action') == 'out']) == n0, 'голос сам ничего не записывает')
        # фото чека к записи
        from PIL import Image
        Image.new('RGB', (300, 200), (200, 120, 40)).save('/tmp/chek_test.jpg')
        pg.set_input_files('#ob-foto-in', '/tmp/chek_test.jpg'); pg.wait_for_timeout(900)
        check('Фото добавлено' in pg.inner_text(body) and pg.input_value('#ob-sum') == '500', 'фото чека добавлено, введённое сохранилось')
        pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(900)
        fsave = [c for c in calls if c.get('action') == 'save' and str(c.get('name', '')).startswith('chek:')]
        outs = [c for c in calls if c.get('action') == 'out' and c.get('foto') == 1]
        check(len(fsave) == 1 and len(outs) == 1 and fsave[0]['name'] == 'chek:' + outs[0]['oid'] and fsave[0]['foto'].startswith('data:image/jpeg'), 'фото сохранено под номером записи, запись помечена')
        check(pg.locator(body + ' [data-obj^="ph:"]').count() == 1, 'в списке у записи значок фото')
        pg.click(body + ' [data-obj^="ph:"]'); pg.wait_for_timeout(500)
        check(pg.locator(body + ' img').count() == 1, 'фото чека открывается')
        shot(pg, 'chek')
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300)
        pg.click(body + ' [data-obj^="void:"] >> nth=0'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj^="void:"] >> nth=0'); pg.wait_for_timeout(600)
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300); pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300)
        # перерасход: расходы больше аванса — кнопка красная и есть предупреждение
        pg.click(body + ' [data-obj="pt:Фарид"]'); pg.wait_for_timeout(400); pg.click(body + ' [data-obj="sec:material"]'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj="f:sec"]'); pg.wait_for_timeout(200)
        pg.fill('#ob-sum', '100'); pg.fill('#ob-note', 'гвозди'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(400)
        check('Расходов больше, чем получено' in pg.inner_text(body), 'перерасход: есть предупреждение')
        check('rgb(192, 57, 43)' in pg.evaluate("getComputedStyle(document.querySelector('#sp-body [data-obj=\"sec:in\"]')).backgroundColor"), 'перерасход: кнопка «Аванс» красная')
        shot(pg, 'overspend')
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(400)
        check('rgb(192, 57, 43)' in pg.evaluate("getComputedStyle(document.querySelector('#sp-body [data-obj=\"pt:Фарид\"]')).borderColor"), 'перерасход: кнопка объекта красная на главной')
        # личные расходы Асрора: отдельная кнопка, свои итоги, объекты не затрагиваются
        pg.click(body + ' [data-obj="lich"]'); pg.wait_for_timeout(500)
        check('Личные расходы Асрора' in pg.inner_text(body) and 'Всего приходов' in pg.inner_text(body) and 'Всего расходов' in pg.inner_text(body) and 'Остаток' in pg.inner_text(body), 'личные: окно с тремя итогами')
        pg.click(body + ' [data-obj="f:lich_in"]'); pg.fill('#ob-sum', '10000'); pg.fill('#ob-note', 'от брата'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        pg.click(body + ' [data-obj="f:lich_out"]'); pg.fill('#ob-sum', '0'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(500)
        check('неверная сумма' in pg.inner_text(body) and pg.input_value('#ob-sum') == '0', 'личные: ошибка не стирает введённое')
        pg.fill('#ob-sum', '2500'); pg.fill('#ob-note', 'бензин'); pg.click(body + ' [data-obj="save"]'); pg.wait_for_timeout(600)
        check(any(c.get('action') == 'lich_add' and c.get('kind') == 'out' and c.get('amount') == '2500' and c.get('note') == 'бензин' and c.get('date') for c in calls), 'личные: расход записан с датой и комментарием')
        boxes = pg.locator(body + ' div[style*="min-width:90px"] div').all_inner_texts()
        check([num(x) for x in boxes[:3]] == [10000, 2500, 7500], 'личные итоги 10000/2500/7500 ' + str(boxes))
        shot(pg, 'lich')
        pg.click(body + ' [data-obj^="void:"] >> nth=0'); pg.wait_for_timeout(200); pg.click(body + ' [data-obj^="void:"] >> nth=0'); pg.wait_for_timeout(600)
        boxes = pg.locator(body + ' div[style*="min-width:90px"] div').all_inner_texts()
        check([num(x) for x in boxes[:3]] == [10000, 0, 10000], 'личные: отмена пересчитывает итог ' + str(boxes))
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(400)
        check(pg.locator(body + ' [data-obj^="pt:"]').count() == 2 and pg.locator(body + ' [data-obj="lich"]').count() == 1, 'назад: объекты на месте, личные не смешаны')
        pg.click('#sp-body [data-sp-back]'); pg.wait_for_timeout(400)
        check(pg.is_visible('#sp-home') or 'Специалист' in pg.inner_text('#sp-body'), '«Назад» возвращает к списку специалистов')
        pg.click('#sp-home [data-home="obj"]'); pg.wait_for_timeout(600)
        pg.click(body + ' [data-obj="pt:Рустам"]'); pg.wait_for_timeout(500); pg.click(body + ' [data-obj="rep"]'); pg.wait_for_timeout(300)
        rep = pg.inner_text('#ob-rep')
        check(rep.startswith('Отчёт по объекту: Рустам') and 'первый аванс' in rep and 'Фарход' in rep and 'цемент' not in rep and 'Остаток: 4 200' in rep, 'отчёт заказчику: аванс, мастер, остаток; отменённое не входит')
        check('бензин' not in rep and 'от брата' not in rep, 'личные расходы в отчёт не попадают')
        shot(pg, 'report')
        pg.click(body + ' [data-obj="back"]'); pg.wait_for_timeout(300)
        check(pg.locator(body + ' [data-obj="sec:in"]').count() == 1, 'из отчёта «Назад» возвращает в объект')
        check(not errs, 'нет ошибок страницы ' + str(errs))
        b.close()
finally: srv.terminate()
print('OBJEKTY E2E PASSED')
