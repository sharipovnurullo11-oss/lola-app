# Проверка окна «Финансист по объектам» в браузере: 6 объектов и «+», внутри Аванс / Мастера / Материалы, итог внизу.
import subprocess, time, json, os, re
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8127'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
rows = []; calls = []; nid = [1]; photos = {}; trashed = {}; TP = {}
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
    for n in list(P):
        if n in trashed: TP[n] = P.pop(n)
    return P
def h(route):
    u = route.request.url
    if u.endswith('/foto-big'):
        fb = json.loads(route.request.post_data); calls.append(fb)
        if fb['action'] == 'save': photos[fb['name']] = fb['foto']; return route.fulfill(json={"ok": True})
        return route.fulfill(json={"ok": True, "foto": photos.get(fb['name'], '')})
    if u.endswith('/materialy-foto'):
        b0 = json.loads(route.request.post_data); calls.append({'action': 'materialy-foto', 'has': bool(b0.get('foto'))}); return route.fulfill(json={"ok": True, "count": 3, "total": 1500, "items": [{"name": "Цемент М400", "qty": 10, "unit": "мешок", "price": 60, "sum": 600}, {"name": "Гвозди", "qty": 2, "unit": "кг", "price": 25, "sum": 50}, {"name": "Краска белая", "qty": "", "unit": "", "price": "", "sum": 850}]})
    if not u.endswith('/objekty'): return route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
    b = json.loads(route.request.post_data); calls.append(b); a = b['action']; P = pts()
    if a == 'ping': return route.fulfill(json={"ok": True})
    if a == 'list': return route.fulfill(json={"ok": True, "points": list(P.values()), "trash": len([n for n in TP if trashed.get(n) == 'trash']), "total": {"inn": 0, "out": 0, "left": 0}, "unassigned": [], "recent": []})
    if a == 'trash_point': trashed[b['tochka']] = 'trash'; return route.fulfill(json={"ok": True})
    if a == 'restore_point': trashed.pop(b['tochka'], None); return route.fulfill(json={"ok": True})
    if a == 'purge_point': trashed[b['tochka']] = 'purged'; return route.fulfill(json={"ok": True})
    if a == 'trash_list': return route.fulfill(json={"ok": True, "points": [TP[n] for n in TP if trashed.get(n) == 'trash']})
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
    if a == 'rename':
        for r in rows:
            if r['tochka'] == b['tochka']: r['tochka'] = b['name']
            if r['zakazchik'] == b['tochka']: r['zakazchik'] = b['name']
        return route.fulfill(json={"ok": True})
    if a == 'debts':
        L = [p for p in P.values() if p['masters']]
        return route.fulfill(json={"ok": True, "total": {"mastersOwe": sum(p['mastersOwe'] for p in L), "customersOwe": 0}, "points": [{"name": p['name'], "mastersOwe": p['mastersOwe'], "owes": None, "masters": p['masters']} for p in L]})
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
        pg.wait_for_timeout(900)
        pg.reload(wait_until='commit'); pg.wait_for_timeout(5)
        check(pg.evaluate("document.documentElement.classList.contains('ob-pre')") or pg.evaluate("document.body.classList.contains('ob-only')"), 'при обновлении обычное окно прячется сразу')
        pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(not pg.evaluate("document.documentElement.classList.contains('ob-pre')") and pg.is_visible('#sp-home') and not pg.is_visible('#chs'), 'после загрузки видно только главное окно Асрора')
        check(pg.evaluate("document.body.classList.contains('ob-only')") and not any(pg.is_visible(x) for x in ['#b-team', '#b-slots', '#b-dev', '#b-menu']), 'у Асрора нет кнопок Команда / Свободные часы / Развивай агента / меню')
        check(pg.is_visible('#sp-home [data-home="obj"]') and pg.evaluate("!!document.querySelector('#m-spec') && document.querySelector('#sp-home').offsetParent !== null"), 'при входе открыто главное окно, а не поиск препарата')
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
        pg.click(body + ' [data-obj="sec:material"]'); pg.wait_for_timeout(300)
        check(pg.locator(body + ' [data-obj="mat-open"]').count() == 1, 'в «Материалах» есть кнопка «Таблица покупок»')
        pg.click(body + ' [data-obj="mat-open"]'); pg.wait_for_timeout(300)
        check(pg.locator('#mt-n-0').count() == 1 and pg.locator('#mt-n-2').count() == 1 and pg.locator('#mt-n-3').count() == 0, 'таблица: 3 пустые строки')
        pg.fill('#mt-n-0', 'Цемент'); pg.fill('#mt-q-0', '5'); pg.fill('#mt-p-0', '50')
        check(pg.input_value('#mt-s-0') == '250', 'сумма строки = кол-во × цена: 250 ' + pg.input_value('#mt-s-0'))
        pg.fill('#mt-n-1', 'Гвозди'); pg.fill('#mt-s-1', '20')
        check(num(pg.inner_text('#mt-total')) == 270, 'итого 270 ' + pg.inner_text('#mt-total'))
        check('Цемент 250' in pg.inner_text('#mt-expl') and 'Гвозди 20' in pg.inner_text('#mt-expl'), 'пояснение: что за что ' + pg.inner_text('#mt-expl'))
        pg.fill('#mt-q-0', '6')
        check(pg.input_value('#mt-s-0') == '300' and num(pg.inner_text('#mt-total')) == 320, 'изменили кол-во: строка 300, итого 320')
        pg.click(body + ' [data-obj="mat-add"]'); pg.wait_for_timeout(200)
        check(pg.locator('#mt-n-3').count() == 1, '+ Строка добавляет строку')
        pg.click(body + ' [data-obj="mat-del:3"]'); pg.wait_for_timeout(200)
        check(pg.locator('#mt-n-3').count() == 0, '✕ убирает строку')
        shot(pg, 'mat-table')
        pg.set_input_files('#mt-foto-gal', {'name': 'chek.jpg', 'mimeType': 'image/jpeg', 'buffer': bytes.fromhex('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc40014000100000000000000000000000000000000ffc40014100100000000000000000000000000000000ffda0008010100003f00d2cf20ffd9')})
        pg.wait_for_timeout(1500)
        check(any(c.get('action') == 'materialy-foto' and c.get('has') for c in calls), 'фото ушло на чтение')
        check(pg.input_value('#mt-n-2') == 'Цемент М400' and pg.input_value('#mt-s-2') == '600', 'фото заполнило таблицу: Цемент М400 = 600 ' + pg.input_value('#mt-n-2'))
        check(pg.input_value('#mt-n-4') == 'Краска белая' and pg.input_value('#mt-s-4') == '850', 'строка только с суммой (краска 850) прочитана')
        check(num(pg.inner_text('#mt-total')) == 300 + 20 + 600 + 50 + 850, 'итого после фото 1820 ' + pg.inner_text('#mt-total'))
        shot(pg, 'mat-after-photo')
        n0 = len([c for c in calls if c.get('action') == 'out'])
        pg.click(body + ' [data-obj="mat-save"]'); pg.wait_for_timeout(1500)
        outs = [c for c in calls if c.get('action') == 'out' and c.get('statya') == 'material'][n0:]
        check(len(outs) == 5 and sum(float(c['amount']) for c in outs) == 1820, 'записано 5 строк, сумма 1820 ' + str([(c['amount'], c['note']) for c in outs]))
        check(any(c['note'].startswith('Цемент · 6') for c in outs) and len(set(c['oid'] for c in outs)) == 5, 'у строк разные номера и понятные заметки')
        t = pg.inner_text(body)
        check(pg.locator('#mt-n-0').count() == 0 and 'Покупка записана' in t, 'после записи таблица закрыта, есть сообщение ' + t[:200])
        check(not errs, 'нет ошибок страницы ' + str(errs))
        b.close()
finally: srv.terminate()
print('MATERIALY E2E PASSED')
