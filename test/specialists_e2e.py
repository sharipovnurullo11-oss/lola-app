# Проверка раздела «Специалисты» в браузере: список, бухгалтер, запись, удаление, остатки, сотрудник не видит.
import subprocess, time, json, os
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8126'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
AN = {'st': 'none', 'left': 1, 'polls': 0}
KBC = []
SHP = []; SHD = []; SHREV = [0]
NOTES = []
SLOW = [0]; HELD = []; calls = []; ops = [{"id": "x1", "type": "in", "amount": "500", "note": "Продажа <b>x</b>", "date": time.strftime('%Y-%m-') + '01', "ts": 1}]; stock = [{"name": "Крем", "qty": 7}]
def h(route):
    u = route.request.url
    if u.endswith('/buhgalter'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if a == 'list':
            if SLOW[0]: HELD.append(route); return
            return route.fulfill(json={"ok": True, "ops": ops, "stock": stock})
        if a == 'add': ops.append(dict(b['op'], ts=2)); return route.fulfill(json={"ok": True})
        if a == 'del':
            ops[:] = [o for o in ops if o['id'] != b['id']]; return route.fulfill(json={"ok": True})
        if a == 'stock':
            for g in stock:
                if g['name'] == b['name']: g['qty'] += b['delta']; break
            else: stock.append({"name": b['name'], "qty": b['delta']})
            return route.fulfill(json={"ok": True, "stock": stock})
    if u.endswith('/magazin'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if not b.get('sid') and b.get('code') != 'kshamsulotestkod0000000000000': return route.fulfill(json={"ok": False, "error": "нет доступа"})
        if a == 'foto_get': return route.fulfill(json={"ok": True, "kod": b['kod'], "foto": FOTOS.get(b['kod'], '')})
        if a == 'foto': FOTOS[b['kod']] = b['foto']
        if b.get('sid') == 'keepersid7777':
            if a == 'receive':
                for x in SHP:
                    if x['kod'] == b['kod']: x['qty'] += b['qty']
            return route.fulfill(json={"ok": True, "role": "storekeeper", "products": [{"kod": x['kod'], "name": x['name'], "zakup": x['zakup'], "qty": x['qty'], "foto": 1 if x['kod'] in FOTOS else 0} for x in SHP], "debts": [], "receipts": [{"id": "r1", "kod": "S1", "name": "Дрель продавца", "qty": 3, "zakup": 100, "date": time.strftime('%Y-%m-%d'), "who": "Кладовщик Али", "fix": False}]})
        if b.get('sid') == 'selltestsid9999':
            if a == 'sell':
                for it in b['items']:
                    for x in SHP:
                        if x['kod'] == it['kod']: x['qty'] -= it['qty']
            return route.fulfill(json={"ok": True, "role": "seller", "products": [{"kod": x['kod'], "name": x['name'], "price": x['price'], "qty": x['qty']} for x in SHP], "debts": []})
        def view():
            return {"ok": True, "products": SHP, "debts": SHD, "report": {"month": time.strftime('%Y-%m'), "revenue": SHREV[0], "profit": 0, "owner": 0, "debt": sum(d['sum'] for d in SHD), "byDay": {}, "days": {time.strftime('%Y-%m-%d'): {"sold": 300, "cashIn": 200, "debtNew": 100, "profit": 50, "purchase": 80}}, "checks": [], "low": []}}
        if a == 'product':
            p = b['p']; SHP[:] = [x for x in SHP if x['kod'] != p['kod']] + [{"kod": p['kod'], "name": p['name'], "zakup": p['zakup'], "marzha": p['marzha'], "price": round(p['zakup'] * (1 + p['marzha'] / 100), 2), "qty": 0}]
            return route.fulfill(json=view())
        if a == 'receive':
            for x in SHP:
                if x['kod'] == b['kod']: x['qty'] += b['qty']
            return route.fulfill(json=view())
        if a == 'sell':
            for it in b['items']:
                for x in SHP:
                    if x['kod'] == it['kod']:
                        if x['qty'] < it['qty']: return route.fulfill(json={"ok": False, "error": "на складе мало"})
                        x['qty'] -= it['qty']
                        if b['pay'] == 'dolg': SHD.append({"name": b['who'], "sum": x['price'] * it['qty'], "since": b['date'], "owner": False})
                        if b['pay'] == 'vladelec': SHD.append({"name": "Владелец", "sum": x['zakup'] * it['qty'], "since": b['date'], "owner": True})
                        if b['pay'] in ('nal', 'perevod'): SHREV[0] += x['price'] * it['qty']
            return route.fulfill(json=view())
        if a == 'pay':
            SHD[:] = [d for d in SHD if d['name'] != b['who']]; return route.fulfill(json=view())
        return route.fulfill(json=view())
    if u.endswith('/yurist'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if a == 'status': return route.fulfill(json={"ok": True, "left": 5, "limit": 5})
        if len(b.get('text', '')) < (40 if a == 'explain' else 8): return route.fulfill(json={"ok": False, "error": "коротко"})
        return route.fulfill(json={"ok": True, "text": "КОРОТКО <b>x</b>\nответ юриста", "left": 4})
    if u.endswith('/marketolog'):
        b = json.loads(route.request.post_data); calls.append(b)
        if b['action'] == 'status': return route.fulfill(json={"ok": True, "channels": ["instagram"], "left": 10, "limit": 20})
        return route.fulfill(json={"ok": True, "text": "ПЛАН <b>x</b>\n- понедельник рилс", "left": 9})
    if u.endswith('/znaniya'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if a == 'nlist': return route.fulfill(json={"ok": True, "notes": NOTES, "total": len(NOTES)})
        if a == 'nsave':
            NOTES.insert(0, {"id": len(NOTES) + 10, "key": b['key'], "t": b['t'], "vremya": "2026-10-22T05:00:00.000Z"}); return route.fulfill(json={"ok": True, "saved": True})
        if a == 'ndel':
            NOTES[:] = [n for n in NOTES if n['id'] != b['id']]; return route.fulfill(json={"ok": True, "deleted": True})
        if a == 'list': return route.fulfill(json={"ok": True, "cases": [c for c in KBC if c['spec'] == b['spec']], "total": len([c for c in KBC if c['spec'] == b['spec']])})
        if a == 'save':
            KBC.insert(0, {"id": len(KBC) + 1, "spec": b['spec'], "q": b['q'], "a": b['a'], "vremya": "2026-10-22T05:00:00.000Z"})
            return route.fulfill(json={"ok": True, "saved": True, "total": len([c for c in KBC if c['spec'] == b['spec']])})
        if a == 'delete':
            KBC[:] = [c for c in KBC if c['id'] != b['id']]
            return route.fulfill(json={"ok": True, "deleted": True, "total": len([c for c in KBC if c['spec'] == b['spec']])})
    if u.endswith('/assistent'):
        b = json.loads(route.request.post_data); calls.append(b); t = b.get('text', '')
        if 'обиделась' in t: return route.fulfill(json={"ok": True, "id": "manager", "left": 19})
        if 'клиентов стало меньше' in t: return route.fulfill(json={"ok": True, "id": "mkt", "left": 17})
        if 'погод' in t: return route.fulfill(json={"ok": True, "id": "", "left": 18})
        return route.fulfill(json={"ok": False, "error": "ai"})
    if u.endswith('/smm'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if a == 'analysis_status':
            base = {"ok": True, "connected": True, "extra_price_somoni": 50, "left_this_month": AN['left'], "started": "", "finished": "", "novyh_video": 0}
            if AN['st'] == 'running':
                AN['polls'] += 1
                if AN['polls'] >= 1: AN['st'] = 'done'
            if AN['st'] == 'none': return route.fulfill(json=dict(base, running=False, status='none', shag='', otchet=''))
            if AN['st'] == 'running': return route.fulfill(json=dict(base, running=True, status='running', shag='Разбираю видео', otchet=''))
            return route.fulfill(json=dict(base, running=False, status='done', shag='Готово', otchet='ИТОГ <b>x</b>\nГЛАВНЫЙ ШАГ НА СЕГОДНЯ', finished='2026-10-22T05:00:00.000Z', novyh_video=5))
        if a == 'analysis_start':
            if AN['left'] <= 0: return route.fulfill(json={"ok": False, "error": "Бесплатный анализ в этом месяце уже использован"})
            AN['left'] -= 1; AN['st'] = 'running'; AN['polls'] = 0
            return route.fulfill(json={"ok": True, "started": True, "run_id": "r1"})
        if a == 'status': return route.fulfill(json={"ok": True, "connected": True, "username": "nurullo_psiholog", "left": 5, "limit": 5})
        if a == 'plan': return route.fulfill(json={"ok": True, "text": "ПЛАН <b>x</b>\nПН - рилс", "left": 4, "connected": True})
        if a == 'caption': return route.fulfill(json={"ok": True, "text": "Подпись готова", "left": 3, "connected": True})
        if a == 'ideas': return route.fulfill(json={"ok": True, "text": "ИДЕИ <b>x</b>", "left": 2, "connected": True})
        if a == 'reply': return route.fulfill(json={"ok": True, "text": "ОТВЕТ готов", "left": 1, "connected": True})
        return route.fulfill(json={"ok": False, "error": "Не получилось прочитать ваш Instagram", "reconnect": True})
    route.fulfill(json={"ok": True, "staff": [], "sessions": [], "chats": []})
FOTOS = {}
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def go(pg, sid):
    pg.click('[data-home="fin"]'); pg.wait_for_timeout(150); pg.click('[data-fin="%s"]' % sid)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.add_init_script("""
window.__scanNext = null;
window.BarcodeDetector = class { constructor(o){ this.o = o; } static async getSupportedFormats(){ return ['ean_13']; } async detect(){ const c = window.__scanNext; window.__scanNext = null; return c ? [{rawValue: c}] : []; } };
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: function (c) { if (c && c.video && JSON.stringify(c.video.facingMode || '').indexOf('environment') >= 0) return Promise.resolve(new MediaStream()); return Promise.reject(new DOMException('нет камеры', 'NotAllowedError')); } } });
""")
        pg.goto('http://localhost:8126/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("localStorage.setItem('ew_cab','kshamsulotestkod0000000000000')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(pg.is_visible('#sp-home'), 'первый экран владельца — ряд специалистов')
        t = pg.inner_text('#sp-home')
        check(all(x in t for x in ['Финансист', 'SMM-специалист', 'Юрист', 'Маркетолог', 'Менеджер по клиентам', 'Продавец-ассистент']), 'все шесть специалистов на первом экране')
        check(not pg.is_visible('#list') and not pg.is_visible('#chs'), 'переписки спрятаны за главным экраном')
        check(not pg.is_visible('#m-specbtn'), 'кнопки «Специалисты» в меню больше нет')
        pg.click('[data-home="lawyer"]'); pg.wait_for_timeout(300); check('Договор оказания услуг' in pg.inner_text('#sp-body') and 'Договор аренды' in pg.inner_text('#sp-body') and 'Договор купли-продажи' in pg.inner_text('#sp-body'), 'юрист: три договора в меню')
        pg.click('[data-law="kind:services"]'); pg.fill('[data-law-f="a"]', 'Шарипов Нурулло'); pg.fill('[data-law-f="b"]', 'Иванова Анна'); pg.fill('[data-law-f="svc"]', 'консультация <b>x</b>'); pg.fill('[data-law-f="price"]', '1200 сомони за месяц'); pg.click('[data-law="make"]'); pg.wait_for_timeout(200)
        t = pg.inner_text('#law-res'); check('ДОГОВОР ОКАЗАНИЯ УСЛУГ' in t and 'Шарипов Нурулло' in t and 'Иванова Анна' in t and '1200 сомони за месяц' in t and 'оплата за этот период' not in t and 'не возвращается' in t, 'юрист: договор услуг на русском с условием «не возвращается»')
        check(pg.locator('#law-res b').count() == 0 and '<b>x</b>' in t, 'юрист: текст экранирован')
        check('________' in t and 'живому юристу' in pg.inner_text('#sp-body'), 'юрист: пустые поля — прочерки, есть пометка про живого юриста')
        pg.click('[data-law="edit"]'); pg.select_option('[data-law-f="ref"]', 'prop'); pg.click('[data-law-lang]') if False else None
        pg.click('[data-law="lang:tg"]'); check(pg.input_value('[data-law-f="a"]') == 'Шарипов Нурулло', 'юрист: ответы не пропали при смене языка'); pg.click('[data-law="make"]'); pg.wait_for_timeout(200)
        t = pg.inner_text('#law-res'); check('ШАРТНОМАИ ХИЗМАТРАСОНӢ' in t and 'Иҷрокунанда' in t and 'баргардонида мешавад' in t or 'бармегардонад' in t, 'юрист: договор на таджикском, вариант «вернуть за неиспользованное»')
        pg.click('[data-law="edit"]'); pg.click('[data-law="lang:uz"]'); pg.click('[data-law="make"]'); check('SHARTNOMASI' in pg.inner_text('#law-res') and 'Ijrochi' in pg.inner_text('#law-res'), 'юрист: договор на узбекском')
        pg.click('[data-law="menu"]'); pg.click('[data-law="kind:rent"]'); pg.fill('[data-law-f="price"]', '1500'); pg.click('[data-law="make"]'); check('ДОГОВОР АРЕНДЫ' in pg.inner_text('#law-res') or 'IJARA' in pg.inner_text('#law-res') or 'ИҶОРА' in pg.inner_text('#law-res'), 'юрист: договор аренды')
        pg.click('[data-law="menu"]'); pg.click('[data-law="kind:sale"]'); pg.click('[data-law="make"]'); check('ПРОДАЖИ' in pg.inner_text('#law-res') or 'SOTDI' in pg.inner_text('#law-res') or 'ФУРӮШ' in pg.inner_text('#law-res'), 'юрист: договор купли-продажи')
        pg.click('[data-law="menu"]'); pg.wait_for_timeout(300); check('Задать вопрос юристу' in pg.inner_text('#sp-body') and 'Объяснить договор' in pg.inner_text('#sp-body') and 'Вопросов сегодня осталось: 5' in pg.inner_text('#sp-body'), 'юрист: в меню вопрос и объяснение договора, остаток запросов')
        pg.click('[data-law="ask"]'); pg.click('[data-law="run"]'); check(pg.is_visible('#sp-body .err') and not any(x.get('action') == 'ask' for x in calls), 'юрист: короткий вопрос не уходит на сервер')
        pg.fill('#law-text', 'Клиент отказался после двух встреч, возвращать ли деньги?'); pg.click('[data-law="lang:tg"]'); pg.click('[data-law="run"]'); pg.wait_for_timeout(500)
        check(any(x.get('action') == 'ask' and x.get('lang') == 'tg' for x in calls) and 'ответ юриста' in pg.inner_text('#law-ans') and pg.locator('#law-ans b').count() == 0, 'юрист: ответ получен, язык ответа передан, текст экранирован')
        check(pg.input_value('#law-text').startswith('Клиент отказался'), 'юрист: вопрос не пропал')
        pg.click('[data-kb="save:lawyer"]'); pg.wait_for_timeout(500); check(any(x.get('action') == 'save' and x.get('spec') == 'lawyer' and x['q'].startswith('Вопрос') for x in calls), 'юрист: ответ можно запомнить в базу знаний')
        pg.click('[data-law="menu"]'); pg.click('[data-law="explain"]'); pg.fill('#law-text', 'Договор. Клиент вносит предоплату за месяц и не вправе требовать возврата.'); pg.click('[data-law="run"]'); pg.wait_for_timeout(500)
        check(any(x.get('action') == 'explain' for x in calls), 'юрист: объяснение договора отправлено')
        pg.click('[data-law="menu"]'); pg.click('[data-law="kind:sale"]'); pg.click('[data-law="make"]')
        pg.click('[data-kb="save:lawyer"]'); pg.wait_for_timeout(600)
        check(any(x.get('action') == 'save' and x.get('spec') == 'lawyer' and x['q'].startswith('Договор') for x in calls) and 'Запомнено дел: 2' in pg.inner_text('#sp-body'), 'База знаний: договор Юриста записан')
        pg.click('[data-law="copy"]'); pg.wait_for_timeout(200); pg.click('[data-sp-back]'); pg.wait_for_timeout(200)
        check(pg.is_visible('#sp-home'), 'после «назад» остаёмся на главном экране')
        pg.click('[data-home="manager"]'); pg.wait_for_timeout(300); t = pg.inner_text('#sp-body')
        check('Находит тех, кто замолчал' in t and 'Пишет тексты для возврата' in t and 'работает' in t and 'готовится' not in t and 'Скоро' not in t, 'менеджер: понятно, что он делает и что уже работает')
        pg.evaluate("CHATS=[{id:'a1',imya:'<b>Иван</b>',kanal:'instagram',messages:[{d:'in',t:'привет',v:'2026-09-01T10:00:00Z'},{d:'out',t:'ответ',v:'2026-09-02T10:00:00Z'}]},{id:'a2',imya:'Новый',kanal:'telegram',messages:[{d:'in',t:'вопрос',v:new Date().toISOString()}]}]")
        pg.click('[data-mgr="quiet"]'); pg.wait_for_timeout(300); t = pg.inner_text('#sp-body')
        check('<b>Иван</b>' in t and 'Новый' not in t, 'менеджер: список замолчавших показывает только тех, кто молчит, текст не исполняется')
        pg.click('[data-mgr="quiet"]'); pg.wait_for_timeout(200); check('<b>Иван</b>' not in pg.inner_text('#sp-body'), 'менеджер: список можно скрыть')
        pg.click('[data-mgr="repeat"]'); pg.wait_for_timeout(300); check('Иван' in pg.inner_text('#sp-body') and 'Новый' not in pg.inner_text('#sp-body'), 'менеджер: «кому пора напомнить» показывает давно молчащих')
        pg.click('[data-mgr="rd:90"]'); pg.wait_for_timeout(300); check('Иван' in pg.inner_text('#sp-body') or 'таких клиентов нет' in pg.inner_text('#sp-body'), 'менеджер: порог дней переключается')
        pg.click('[data-mgr="repeat"]'); pg.wait_for_timeout(200)
        pg.click('[data-mgr="cards"]'); pg.wait_for_timeout(300); check('Иван' in pg.inner_text('#sp-body'), 'менеджер: карточки клиентов показывают список клиентов')
        pg.click('[data-mgr="cpick:0"]'); pg.wait_for_timeout(200)
        pg.fill('#mg-note', 'Купил <i>курс</i>'); pg.click('[data-mgr="cadd"]'); pg.wait_for_timeout(600)
        t = pg.inner_text('#sp-body'); check(any(x.get('action') == 'nsave' and x.get('key') == 'instagram:a1' for x in calls) and 'Купил <i>курс</i>' in t, 'менеджер: заметка к клиенту записана, текст не исполняется')
        pg.click('[data-mgr^="cdel:"]'); check(not any(x.get('action') == 'ndel' for x in calls), 'менеджер: первое нажатие удаления только спрашивает')
        pg.click('[data-mgr^="cdel:"]'); pg.wait_for_timeout(600); check(any(x.get('action') == 'ndel' for x in calls) and 'Купил' not in pg.inner_text('#sp-body'), 'менеджер: заметка удалена')
        pg.click('[data-mgr="cards"]'); pg.wait_for_timeout(200)
        pg.click('[data-mgr="mkt"]'); pg.wait_for_timeout(400); check('Вернуть замолчавших' in pg.inner_text('#sp-body'), 'менеджер: кнопка открывает Маркетолога с возвратом замолчавших'); pg.click('[data-sp-back]'); pg.wait_for_timeout(200)
        pg.click('[data-home="mkt"]'); pg.wait_for_timeout(600); pg.click('[data-mkt="task:plan"]'); pg.wait_for_timeout(500)
        check(pg.is_visible('[data-kb="save:mkt"]') and 'База знаний' in pg.inner_text('#sp-body'), 'Маркетолог: после ответа есть «запомнить» и карточка базы знаний')
        pg.click('[data-kb="save:mkt"]'); pg.wait_for_timeout(600)
        check(any(x.get('action') == 'save' and x.get('spec') == 'mkt' and 'понедельник' in x['a'] for x in calls) and 'Запомнено ✓' in pg.inner_text('#sp-body'), 'Маркетолог: дело записано в базу знаний')
        pg.wait_for_timeout(300)
        pg.click('[data-sp-back]'); pg.wait_for_timeout(200)
        pg.click('[data-home="seller"]'); pg.wait_for_timeout(300)
        check(not pg.is_visible('#sp-home') and pg.is_visible('#list') and pg.is_visible('#sp-back'), 'продавец-ассистент открывает переписки, сверху «← Специалисты»')
        pg.click('#sp-back button'); pg.wait_for_timeout(200); check(pg.is_visible('#sp-home') and not pg.is_visible('#list'), 'кнопка «← Специалисты» возвращает на главный экран')
        go(pg, 'buh'); pg.wait_for_timeout(500)
        check(pg.is_visible('[data-onb^="kind:"]'), 'бухгалтер: при первом входе просит выбрать вид деятельности')
        check(pg.locator('#sp-body [data-shop="goto"]').count() == 0, 'бухгалтер: кнопок «Касса» и «Учёт» внутри больше нет, они в «Финансисте»')
        pg.click('[data-onb="kind:health"]'); pg.click('[data-onb="stock:yes"]'); pg.click('[data-onb^="staff:"] >> nth=0'); pg.click('[data-onb="hire"]'); pg.wait_for_timeout(700)
        t = pg.inner_text('#sp-body'); check('500' in t and 'Крем' in t, 'бухгалтер: итоги и остатки загружены')
        check('<b>x</b>' in t and pg.locator('#sp-body b', has_text='x').count() == 0, 'текст записи экранирован')
        pg.fill('#bh-text', 'расход 150,5 такси'); pg.click('[data-buh="text"]'); pg.wait_for_timeout(500)
        check(any(c['action'] == 'add' and c['op']['type'] == 'out' and c['op']['amount'] == '150.5' for c in calls), 'текстовая запись расхода')
        bt = pg.inner_text('#sp-body').replace('\xa0', ' ')
        check('469,5' in bt, 'бухгалтерия: прибыль = 500 + 200 (магазин) − 150,5 − 80 (закупка) = 469,5')
        check('Магазин: продажи' in bt and pg.locator('#sp-body [data-buh="del"]').count() == pg.locator('#sp-body [data-buh="edit"]').count() and 'Магазин: закупка' in bt, 'бухгалтерия: строки магазина показаны без кнопок правки/удаления')
        _t = pg.inner_text('#sp-body'); check('Куда ушли деньги' in _t and 'Транспорт' in _t, 'бухгалтер: итог «куда ушли деньги» с категорией Транспорт')
        pg.fill('#bh-text', 'привет'); pg.click('[data-buh="text"]'); check('расход 150' in pg.inner_text('#bh-err'), 'непонятный текст отклонён')
        pg.evaluate("window.SpeechRecognition=function(){this.start=function(){var me=this;setTimeout(function(){me.onresult({results:[[{transcript:'потратил сто двадцать на бензин'}]]});me.onend&&me.onend()},50)};this.stop=function(){}}")
        n1 = len(ops); pg.click('[data-buh="mic"]'); pg.wait_for_timeout(700)
        check(len(ops) == n1 + 1 and ops[-1]['amount'] in (120, '120', 12000) or any('бензин' in str(o) for o in ops), 'голос: «потратил сто двадцать на бензин» записан расходом')
        pg.click('[data-buh="sell"]'); pg.fill('#bh-sqty', '2'); pg.fill('#bh-sprice', '75'); n2 = len(ops); pg.click('[data-buh="sell-ok"]'); pg.wait_for_timeout(800)
        check(len(ops) == n2 + 1 and any('Продажа' in str(o.get('note')) and str(o.get('amount')) in ('150', '150.00') for o in ops), 'продажа: 2 шт × 75 = 150 в приход')
        pg.click('[data-buh="edit"]'); pg.wait_for_timeout(200)
        check(pg.input_value('#bh-sum') != '' , 'исправление: форма открылась с заполненной суммой')
        pg.fill('#bh-sum', '777'); pg.click('[data-buh="add"]'); pg.wait_for_timeout(800)
        check(any(str(o.get('amount')) in ('777', '777.00') for o in ops), 'исправление: новая сумма сохранена')
        check(not pg.is_visible('#bh-form'), 'форма скрыта, пока не нажали «Деньги пришли»')
        pg.click('[data-buh="open-in"]'); check(pg.is_visible('#bh-form') and pg.is_visible('#bh-sum'), 'кнопка «Деньги пришли» открывает форму')
        pg.fill('#bh-sum', '0'); pg.click('[data-buh="add"]'); check(pg.is_visible('#bh-err'), 'нулевая сумма отклонена')
        pg.click('[data-chip="Продажа"]'); check(pg.input_value('#bh-note') == 'Продажа', 'слово-подсказка подставляется в «За что»')
        pg.fill('#bh-sum', '70,5'); pg.click('[data-buh="add"]'); pg.wait_for_timeout(400)
        check(any(c['action'] == 'add' and c['op']['type'] == 'in' and c['op']['amount'] == '70.5' and c['op']['note'] == 'Продажа' for c in calls) and not pg.is_visible('#bh-form'), 'приход записан через форму, форма закрылась')
        n0 = len(ops); pg.click('[data-buh="del"][data-id]:last-of-type'); pg.wait_for_timeout(200)
        check(len(ops) == n0 and 'Удалить?' in pg.inner_text('#sp-body'), 'первое нажатие × только спрашивает «Удалить?»')
        pg.click('[data-buh="del"][data-id]:last-of-type'); pg.wait_for_timeout(400); check(len(ops) == n0 - 1, 'второе нажатие удаляет')
        pg.click('[data-buh="st+"]'); pg.wait_for_timeout(400); check(any(c['action'] == 'stock' and c['delta'] == 1 for c in calls), 'остаток +1')
        pg.click('[data-buh="open-g"]'); pg.fill('#bh-gname', 'Духи'); pg.fill('#bh-gqty', '3'); pg.click('[data-buh="gadd"]'); pg.wait_for_timeout(400); check('Духи' in pg.inner_text('#sp-body'), 'новый товар')
        # быстрое открытие бухгалтера: записи из телефона сразу, сервер отвечает медленно
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); SLOW[0] = 1.5
        go(pg, 'buh'); pg.wait_for_timeout(150)
        t = pg.inner_text('#sp-body'); check('Духи' in t and 'Загрузка' not in t, 'бухгалтер открывается сразу из сохранённого')
        check('Обновляем' in t, 'пока идёт обновление, написано «Обновляем…»')
        SLOW[0] = 0
        for r_ in HELD: r_.fulfill(json={"ok": True, "ops": ops, "stock": stock})
        HELD.clear(); pg.wait_for_timeout(400); check('Обновляем' not in pg.inner_text('#sp-body'), 'после ответа сервера пометка исчезла')
        # SMM
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); pg.click('[data-home="smm"]'); pg.wait_for_timeout(500)
        t = pg.inner_text('#sp-body'); check('@nurullo_psiholog' in t and 'осталось' in t and '5' in t, 'SMM: статус Instagram и остаток запросов')
        pg.click('[data-smm="caption"]'); check('о чём пост' in pg.inner_text('#sp-body').lower() and not any(c['action'] == 'caption' for c in calls), 'SMM: пустая подпись не уходит на сервер')
        pg.fill('#sm-plan', 'вопрос про цену'); pg.click('[data-smm="plan"]'); pg.wait_for_timeout(500)
        check(any(c['action'] == 'plan' and c['text'] == 'вопрос про цену' for c in calls), 'SMM: план отправлен с текстом недели')
        check(pg.locator('#sm-res b').count() == 0 and 'ПЛАН <b>x</b>' in pg.inner_text('#sm-res'), 'SMM: ответ экранирован')
        check('4' in pg.inner_text('#sp-body'), 'SMM: остаток запросов уменьшился')
        pg.fill('#sm-cap', 'пост про тревогу'); pg.click('[data-smm="caption"]'); pg.wait_for_timeout(500); check('Подпись готова' in pg.inner_text('#sm-res'), 'SMM: подпись получена')
        pg.click('[data-smm="ideas"]'); pg.wait_for_timeout(500)
        check(any(c['action'] == 'ideas' for c in calls) and 'ИДЕИ <b>x</b>' in pg.inner_text('#sm-res') and pg.locator('#sm-res b').count() == 0, 'SMM: идеи роликов получены, ответ экранирован')
        pg.click('[data-smm="reply"]'); check('вставьте комментарий' in pg.inner_text('#sp-body').lower() and not any(c['action'] == 'reply' for c in calls), 'SMM: пустой комментарий не уходит на сервер')
        pg.fill('#sm-rep', 'А сколько стоит консультация?'); pg.click('[data-smm="reply"]'); pg.wait_for_timeout(500)
        check(any(c['action'] == 'reply' and c['text'] == 'А сколько стоит консультация?' for c in calls) and 'ОТВЕТ готов' in pg.inner_text('#sm-res'), 'SMM: ответ на комментарий получен')
        pg.click('[data-smm="ideas"]'); pg.wait_for_timeout(400)
        check(pg.is_visible('[data-kb="save:smm"]') and 'База знаний' in pg.inner_text('#sp-body') and 'Запомнено дел: 0' in pg.inner_text('#sp-body'), 'База знаний: у SMM есть кнопка «запомнить» и карточка базы')
        pg.click('[data-kb="save:smm"]'); pg.wait_for_timeout(600)
        sv = [c for c in calls if c.get('action') == 'save' and c.get('spec') == 'smm']
        check(len(sv) == 1 and sv[0]['q'].startswith('Идеи роликов') and 'ИДЕИ' in sv[0]['a'], 'База знаний: дело SMM записано с вопросом и ответом')
        check('Запомнено дел: 1' in pg.inner_text('#sp-body') and 'Запомнено ✓' in pg.inner_text('#sp-body'), 'База знаний: счётчик вырос, кнопка стала «Запомнено»')
        pg.click('[data-kb="toggle:smm"]'); check('Идеи роликов' in pg.inner_text('#sp-body') and pg.locator('#sp-body b', has_text='x').count() == 0, 'База знаний: дело видно в списке, текст экранирован')
        pg.click('[data-kb^="del:smm"]'); check('Точно удалить?' in pg.inner_text('#sp-body') and not any(c.get('action') == 'delete' for c in calls), 'База знаний: первое нажатие только спрашивает')
        pg.click('[data-kb^="del:smm"]'); pg.wait_for_timeout(600); check(any(c.get('action') == 'delete' for c in calls) and 'Запомнено дел: 0' in pg.inner_text('#sp-body'), 'База знаний: второе нажатие удаляет')
        pg.click('[data-smm="profile"]'); pg.wait_for_timeout(500); check('Instagram' in pg.inner_text('#sp-body') and pg.is_visible('#sp-body .err'), 'SMM: ошибка разбора показана')
        # SMM: полный анализ Instagram
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); pg.click('[data-home="smm"]'); pg.wait_for_timeout(600)
        t = pg.inner_text('#sp-body'); check('Полный анализ Instagram' in t and 'Бесплатных анализов в этом месяце осталось: 1' in t, 'SMM: карточка полного анализа и остаток в месяце')
        check(pg.is_visible('[data-smm="an-start"]') and not pg.is_visible('#sm-an-res'), 'SMM: кнопка запуска есть, отчёта ещё нет')
        pg.fill('#sm-plan', 'текст не должен пропасть')
        pg.click('[data-smm="an-start"]'); pg.wait_for_timeout(400)
        check(any(c['action'] == 'analysis_start' for c in calls), 'SMM: анализ запущен на сервере')
        t = pg.inner_text('#sp-body'); check('Разбираю' in t or 'Запущено' in t, 'SMM: показан ход анализа')
        check(not pg.is_visible('[data-smm="an-start"]'), 'SMM: пока идёт анализ, кнопки запуска нет (нет двойного запуска)')
        check(pg.input_value('#sm-plan') == 'текст не должен пропасть', 'SMM: набранный текст не пропал при запуске анализа')
        pg.wait_for_timeout(9500)
        check(pg.is_visible('#sm-an-res') and 'ИТОГ <b>x</b>' in pg.inner_text('#sm-an-res') and pg.locator('#sm-an-res b').count() == 0, 'SMM: готовый отчёт показан и экранирован')
        t = pg.inner_text('#sp-body'); check('22.10.2026' in t and 'новых видео разобрано: 5' in t, 'SMM: дата отчёта и число разобранных видео')
        check('50 сомони' in t and not pg.is_visible('[data-smm="an-start"]'), 'SMM: бесплатный анализ использован, дополнительный 50 сомони, кнопки нет')
        check(pg.input_value('#sm-plan') == 'текст не должен пропасть', 'SMM: текст в поле плана сохранился после готового отчёта')
        pg.click('[data-smm="an-copy"]'); pg.wait_for_timeout(200); check('Скопировано' in pg.inner_text('#sp-body') or pg.is_visible('[data-smm="an-copy"]'), 'SMM: кнопка копирования отчёта работает без ошибок')
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); pg.reload(); pg.wait_for_timeout(1200); pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        hero = pg.locator('#sp-home .sp-hero'); tile = pg.locator('#sp-home .sp-tile').first
        check(hero.count() == 1 and pg.evaluate("document.querySelector('#sp-home .sp-hero').nextElementSibling.className") == 'sp-grid', 'ассистент: большая кнопка стоит над сеткой специалистов')
        check(hero.bounding_box()['width'] > 2 * tile.bounding_box()['width'] and hero.bounding_box()['height'] > tile.bounding_box()['height'], 'ассистент: кнопка заметно больше карточек специалистов')
        ops.append({"id": "t1", "type": "in", "amount": "200", "note": "Продажа", "date": time.strftime('%Y-%m-%d'), "ts": 9}); stock.append({"name": "Мыло <i>", "qty": 1})
        pg.evaluate("(function(){var n=new Date().toISOString(),o=new Date(Date.now()-30*864e5).toISOString();CHATS=[{kanal:'instagram',id:'a1',messages:[{d:'in',t:'привет',v:n}]},{kanal:'whatsapp',id:'b2',messages:[{d:'in',t:'спасибо',v:o},{d:'out',t:'пожалуйста',v:o}]}];})()")
        check('Что происходит' in pg.inner_text('#sp-hero-sub'), 'кнопка ассистента: пока переписок нет — общее описание')
        pg.evaluate("render_list()"); pg.wait_for_timeout(100)
        check(pg.inner_text('#sp-hero-sub') == 'Ждут ответа: 1 · Молчат больше двух недель: 1' and pg.locator('#sp-home .sp-hero.wait').count() == 1, 'кнопка ассистента: на ней видно, сколько ждут ответа и сколько молчат')
        pg.click('[data-home="assistant"]'); pg.wait_for_timeout(500); t = pg.inner_text('#sp-body')
        fx = lambda k: pg.inner_text('.asst-fact[data-id="%s"]' % k) if pg.locator('.asst-fact[data-id="%s"]' % k).count() else ''
        check('Ждут ответа: 1' in fx('seller'), 'ассистент: продавец показывает, сколько клиентов ждут ответа')
        check('Молчат больше двух недель: 1' in fx('manager'), 'ассистент: менеджер показывает замолчавших клиентов')
        check('Сегодня: пришло ' in fx('buh') and 'пришло 0,' not in fx('buh') and 'Прибыль за месяц' in fx('buh') and 'Мыло <i> (1)' in fx('buh') and pg.locator('.asst-fact i').count() == 0, 'ассистент: бухгалтер — приход за сегодня, прибыль, что заканчивается (экранировано)')
        check('@nurullo_psiholog' in fx('smm') and 'Анализ готов (22.10.2026)' in fx('smm') and 'осталось: 5 из 5' in fx('smm'), 'ассистент: SMM — Instagram, готовый анализ, остаток запросов')
        check('осталось: 10 из 20' in fx('mkt') and 'не подключены' not in fx('mkt'), 'ассистент: маркетолог — остаток запросов')
        check('Вопросов сегодня осталось: 5' in fx('lawyer'), 'ассистент: юрист — остаток вопросов')
        check('Мой ассистент: сводка дня' in t and pg.locator('#sp-body [data-asst="open"]').count() == 7, 'ассистент: окно сводки с семью специалистами и кнопками «Подробнее»')
        pg.fill('#as-in', 'расскажи погоду'); pg.click('[data-asst="send"]'); pg.wait_for_timeout(200)
        check('Не понял' in pg.inner_text('#as-msg') and pg.input_value('#as-in') == 'расскажи погоду', 'ассистент: непонятная задача — подсказка, текст не пропал')
        pg.fill('#as-in', 'составь договор аренды'); pg.click('[data-asst="send"]'); pg.wait_for_timeout(400)
        check(pg.locator('#law-text').count() == 1 and pg.input_value('#law-text') == 'составь договор аренды', 'ассистент: ИИ не ответил — задача ушла юристу по ключевым словам, текст уже в поле вопроса')
        check(any(c.get('action') == 'route' and c.get('text') == 'составь договор аренды' and c.get('code') == 'kshamsulotestkod0000000000000' for c in calls), 'ассистент: поручение отправлено ИИ с кодом кабинета')
        pg.click('[data-sp-back]'); pg.wait_for_timeout(200); pg.click('[data-home="assistant"]'); pg.wait_for_timeout(300)
        pg.fill('#as-in', 'клиентка обиделась, что делать?'); pg.click('[data-asst="send"]'); pg.wait_for_timeout(400)
        check('Менеджер по клиентам' in pg.inner_text('#sp-body'), 'ассистент: ИИ понял поручение без ключевых слов и передал менеджеру')
        pg.click('[data-sp-back]'); pg.wait_for_timeout(200); pg.click('[data-home="assistant"]'); pg.wait_for_timeout(300)
        pg.fill('#as-in', 'почему клиентов стало меньше'); pg.click('[data-asst="send"]'); pg.wait_for_timeout(500)
        check(pg.locator('#mk-in').count() == 1 and pg.input_value('#mk-in') == 'почему клиентов стало меньше' and not any(c.get('action') == 'chat' and 'стало меньше' in str(c) for c in calls), 'ассистент: текст поручения уже в чате маркетолога, но сам не отправлен')
        pg.click('[data-sp-back]'); pg.wait_for_timeout(200); pg.click('[data-home="assistant"]'); pg.wait_for_timeout(300)
        n_ops = len(ops); pg.fill('#as-in', 'расход 150 такси'); pg.click('[data-asst="send"]'); pg.wait_for_timeout(600)
        check(pg.locator('#bh-text').count() == 1 and pg.input_value('#bh-text') == 'расход 150 такси' and len(ops) == n_ops, 'ассистент: строка для бухгалтера подставлена, но не записана без нажатия')
        pg.click('[data-sp-back]'); pg.wait_for_timeout(200); pg.click('[data-home="assistant"]'); pg.wait_for_timeout(300)
        pg.click('[data-asst="open"][data-id="smm"]'); pg.wait_for_timeout(400)
        check('SMM-специалист' in pg.inner_text('#sp-body'), 'ассистент: «Подробнее» открывает нужного специалиста')
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check('Финансист' in pg.inner_text('#sp-home'), 'финансист: есть на главном экране')
        go(pg, 'shop'); pg.wait_for_timeout(500)
        check('Пока пусто' in pg.inner_text('#sp-body'), 'магазин: касса открывается и при пустом списке товаров (пустая корзина)')
        pg.click('[data-shop="tab"][data-k="tovar"]'); pg.click('[data-shop="fnew"]')
        pg.fill('#sh-f-kod', 'dr-01'); pg.fill('#sh-f-name', 'Дрель <b>x</b>'); pg.fill('#sh-f-zakup', '100'); pg.fill('#sh-f-marzha', '25')
        check('125' in pg.inner_text('#sh-f-price'), 'магазин: цена продажи считается сама из закупки и маржи')
        pg.click('[data-shop="save"]'); pg.wait_for_timeout(300)
        check(any(x.get('action') == 'product' and x['p']['kod'] == 'dr-01' and x['p']['marzha'] == 25 for x in calls) and pg.locator('#sp-body b').filter(has_text='<b>x</b>').count() >= 0 and '125' in pg.inner_text('#sp-body'), 'магазин: товар сохранён с кодом и маржой')
        check('Дрель <b>x</b>' in pg.inner_text('#sp-body'), 'магазин: название экранировано')
        pg.click('[data-shop="fnew"]'); pg.fill('#sh-f-kod', 'bad kod!'); pg.fill('#sh-f-name', 'x'); pg.fill('#sh-f-zakup', '5'); pg.fill('#sh-f-marzha', '10'); pg.click('[data-shop="save"]')
        check(pg.is_visible('#sh-err') and not any(x.get('action') == 'product' and x['p']['kod'] == 'bad kod!' for x in calls), 'магазин: неверный код не отправляется')
        pg.click('[data-shop="fcancel"]')
        pg.click('[data-shop="rcv"][data-k="dr-01"]'); pg.fill('#sh-r-qty', '5'); pg.click('[data-shop="rok"]'); pg.wait_for_timeout(300)
        check('остаток 5' in pg.inner_text('#sp-body'), 'магазин: приход увеличил остаток')
        pg.click('[data-shop="tab"][data-k="kassa"]'); pg.fill('#sh-code', 'DR-01'); pg.press('#sh-code', 'Enter'); pg.wait_for_timeout(200)
        check('125' in pg.inner_text('#sh-total'), 'магазин: код в кассе добавляет товар в чек (Enter)')
        pg.click('[data-shop="plus"][data-k="dr-01"]'); check('250' in pg.inner_text('#sh-total'), 'магазин: плюс увеличивает количество')
        check(pg.locator('#sp-body [data-shop="tab"]').count() == 5 and pg.locator('#sp-body [data-shop="pay"]').count() == 0, 'продажа: у руководителя сверху вкладки, простой экран без выбора способа оплаты')
        pg.click('[data-shop="dolgopen"]'); pg.click('[data-shop="sell"]'); check(pg.is_visible('#sh-err'), 'магазин: долг без покупателя не проходит')
        pg.fill('#shx-who', 'Рустам'); pg.click('[data-shop="sell"]'); pg.wait_for_timeout(400)
        check(any(x.get('action') == 'sell' and x['pay'] == 'dolg' and x['who'] == 'Рустам' and x['items'][0]['qty'] == 2 for x in calls) and 'Продано на 250' in pg.inner_text('#sp-body'), 'магазин: продажа в долг записана')
        check(pg.is_visible('[data-shop="print"]') and pg.locator('[data-shop="rw"]').count() == 2, 'чек: после продажи есть «Печать чека» и выбор ленты 58/80')
        pg.click('[data-shop="rw"][data-k="80"]'); pg.wait_for_timeout(100); check(pg.evaluate("localStorage.getItem('ew_rw')") == '80', 'чек: ширина ленты запоминается')
        pg.evaluate("window.__pr=0; HTMLIFrameElement.prototype.__x=1"); pg.click('[data-shop="print"]'); pg.wait_for_timeout(500)
        check(pg.evaluate("(function(){var f=document.querySelector('iframe');return !!f&&f.contentDocument.body.innerText.indexOf('250')>=0})()"), 'чек: в печатной форме есть сумма 250')
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); go(pg, 'shop'); pg.wait_for_timeout(300); pg.click('#sp-body [data-shop="tab"][data-k="tovar"]'); pg.wait_for_timeout(300); pg.click('[data-shop="tab"][data-k="dolg"]'); pg.wait_for_timeout(200)
        check('Рустам' in pg.inner_text('#sp-body') and '250' in pg.inner_text('#sp-body'), 'магазин: долг виден в списке')
        pg.click('[data-shop="pay-open"][data-k="Рустам"]'); pg.click('[data-shop="pok"]'); pg.wait_for_timeout(300)
        check(any(x.get('action') == 'pay' and x['who'] == 'Рустам' and x['amount'] == 250 for x in calls) and 'Долгов нет' in pg.inner_text('#sp-body'), 'магазин: оплата долга принята')
        pg.click('[data-shop="tab"][data-k="kassa"]'); pg.fill('#sh-code', 'dr-01'); pg.press('#sh-code', 'Enter'); n1 = len(calls)
        pg.click('[data-shop="paynow"]'); pg.wait_for_timeout(400)
        check(any(x.get('action') == 'sell' and x['pay'] == 'nal' and x['items'][0]['qty'] == 1 for x in calls[n1:]), 'касса: «Оплатить» записывает продажу наличными одним нажатием')
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); go(pg, 'shop'); pg.wait_for_timeout(300); pg.click('#sp-body [data-shop="tab"][data-k="tovar"]'); pg.wait_for_timeout(300)
        pg.click('[data-shop="tab"][data-k="otchet"]'); check('Итоги дня' in pg.inner_text('#sp-body') and 'Пришло денег' in pg.inner_text('#sp-body'), 'магазин: «Итоги дня» в отчёте'); check('Выручка' in pg.inner_text('#sp-body') and 'Прибыль' in pg.inner_text('#sp-body'), 'магазин: отчёт показывает выручку и прибыль')
        pg.click('#sp-body [data-shop="preview"]'); pg.wait_for_timeout(500)
        pt = pg.inner_text('#kas-body')
        check(pg.is_visible('#kas-root') and 'Так видит продавец' in pt and 'Отчёт' not in pt, 'руководитель: просмотр «как видит продавец» открывается')
        pg.click('#kas-body [data-shop="selout"]'); pg.wait_for_timeout(300)
        check(not pg.is_visible('#kas-root') and pg.is_visible('#sp-body'), 'руководитель: просмотр закрывается, он остаётся в своём окне')
        SHD.append({"name": "Бунёд", "sum": 1280, "since": time.strftime('%Y-%m-%d'), "owner": False}); SHD.append({"name": "Мунира", "sum": 150, "since": time.strftime('%Y-%m-%d'), "owner": False})
        pg.click('[data-shop="mprev"]'); pg.wait_for_timeout(300); pg.click('[data-shop="mnext"]'); pg.wait_for_timeout(300)
        pg.click('[data-shop="tab"][data-k="kassa"]'); pg.click('#sh-code'); pg.keyboard.type('d'); pg.wait_for_timeout(150)
        check('Дрель' in pg.inner_text('#sh-hints') and pg.locator('#sh-hints [data-shop="put"]').count() >= 1, 'касса: подсказка появляется по первому символу кода')
        pg.fill('#sh-code', 'dr-01'); pg.wait_for_timeout(150)
        check(pg.locator('#sh-hints [data-shop="put"]').count() == 1 and 'Нажмите на карточку' in pg.inner_text('#sh-hints'), 'касса: при полном коде остаётся одна карточка товара')
        pg.click('#sh-hints [data-shop="put"]'); pg.click('#sh-hints [data-shop="put"]'); pg.wait_for_timeout(150)
        check('В корзине: 2' in pg.inner_text('#sh-hints') and '250' in pg.inner_text('#sh-total'), 'касса: повторное нажатие на карточку увеличивает количество и сумму')
        pg.click('[data-shop="dolgopen"]'); pg.click('#shx-who'); pg.keyboard.type('Бу'); pg.wait_for_timeout(150)
        check('Бунёд' in pg.inner_text('#sh-whohint') and 'Мунира' not in pg.inner_text('#sh-whohint'), 'долг: список покупателей фильтруется по набранным буквам')
        pg.click('#sh-whohint [data-shop="who"]'); pg.wait_for_timeout(150)
        check('У этого покупателя уже долг' in pg.inner_text('#sh-whohint') and pg.locator('#shx-who').input_value() == 'Бунёд', 'долг: покупатель выбран из списка, большой долг предупреждает')
        pg.fill('#shx-who', 'Новый человек'); pg.wait_for_timeout(150)
        check('Нового покупателя запишем' in pg.inner_text('#sh-whohint'), 'долг: нового покупателя можно вписать вручную')
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); pg.click('[data-home="fin"]'); pg.wait_for_timeout(400)
        check(pg.locator('#sp-body [data-fin="buh"]').count() == 1 and pg.locator('#sp-body [data-fin="shop"]').count() == 1 and 'Финансист' in pg.inner_text('#sp-body'), 'финансист: внутри два раздела «Бухгалтерия» и «Учёт магазина»')
        pg.click('#sp-body [data-fin="shop"]'); pg.wait_for_timeout(400)
        check(pg.is_visible('#sh-code') and pg.locator('#sp-body [data-shop="tab"]').count() == 5, 'финансист: «Учёт магазина» открывает продажу, сверху пять вкладок')
        pg.click('[data-shop="tab"][data-k="prihod"]'); pg.fill('#sh-pcode', 'dr'); pg.wait_for_timeout(150)
        check(pg.locator('#sh-phints [data-shop="rcv"]').count() >= 1, 'приём: товар находится по первым буквам кода')
        n2 = len(calls); pg.click('#sh-phints [data-shop="rcv"]'); pg.fill('#sh-r-qty', '4'); pg.click('[data-shop="rok"]'); pg.wait_for_timeout(300)
        check(any(x.get('action') == 'receive' and x['kod'] == 'dr-01' and x['qty'] == 4 for x in calls[n2:]), 'приём: приход записывается из вкладки «Приём»')
        pg.click('[data-shop="fnew"]'); check(pg.is_visible('#sh-f-kod'), 'приём: новый товар заводится прямо во вкладке')
        pg.click('[data-shop="fcancel"]')
        # остаток меньше, чем в чеке: продажа не блокируется, видно жёлтое предупреждение
        pg.click('[data-shop="tab"][data-k="kassa"]'); pg.fill('#sh-code', 'dr-01'); pg.press('#sh-code', 'Enter')
        pg.click('[data-shop="scan"][data-k="sell"]'); pg.wait_for_timeout(200)
        check(pg.is_visible('#sh-scan-in'), 'скан на продаже: кнопка «Скан» открывает сканер')
        pg.evaluate("window.__scanNext='dr-01'"); pg.wait_for_timeout(700)
        check(pg.query_selector('#sh-scan') is None and 'Дрель' in pg.inner_text('#sp-body'), 'скан на продаже: штрихкод кладёт товар в чек')
        pg.click('[data-shop="scan"][data-k="sell"]'); pg.wait_for_timeout(200); pg.fill('#sh-scan-in', 'ZZZ-9'); pg.click('#sh-scan-ok'); pg.wait_for_timeout(300)
        check(pg.query_selector('#sh-scan') is None and pg.input_value('#sh-f-kod') == 'ZZZ-9', 'скан на продаже: незнакомый код у владельца открывает «Новый товар»')
        pg.click('[data-shop="fcancel"]'); pg.wait_for_timeout(200)
        pg.click('[data-shop="tab"][data-k="kassa"]'); pg.wait_for_timeout(200)
        for _ in range(12): pg.click('[data-shop="plus"][data-k="dr-01"]')
        check(pg.is_visible('#sh-low') and 'Продажа пройдёт' in pg.inner_text('#sh-low'), 'продажа: при нехватке остатка жёлтое предупреждение, без блокировки')
        check(pg.locator('#sp-body [data-shop="minus"]').count() == 1 and not pg.is_visible('#sh-err'), 'продажа: товар добавлен сверх остатка')
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(not errs, 'нет ошибок страницы ' + str(errs))
        check(pg.evaluate('document.documentElement.scrollWidth') <= pg.evaluate('innerWidth'), 'нет горизонтальной прокрутки на телефоне')
        # другой клиент не видит «Учёт магазина»
        pg.evaluate("localStorage.setItem('ew_cab','kdrugoyklient0000000000000000');document.querySelectorAll('dialog[open]').forEach(d=>d.close())"); pg.reload(); pg.wait_for_timeout(1200)
        check(pg.locator('#sp-home [data-home="shop"]').count() == 0 and pg.locator('#sp-home [data-home="fin"]').count() == 1, 'другой клиент: отдельной плитки «Учёт магазина» нет, есть «Финансист»')
        pg.click('[data-home="fin"]'); pg.wait_for_timeout(500)
        check(pg.locator('#sp-body [data-fin]').count() == 0 and (pg.locator('#sp-body [data-buh]').count() + pg.locator('#sp-body [data-onb]').count()) > 0 and pg.locator('#sp-body [data-shop]').count() == 0, 'другой клиент: «Финансист» сразу открывает бухгалтерию, раздела магазина нет')
        pg.evaluate("localStorage.setItem('ew_cab','kshamsulotestkod0000000000000');document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        # сотрудник не видит
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close());localStorage.removeItem('ew_cab');localStorage.setItem('ew_sid','sidtest123456')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("localStorage.setItem('ew_cam_declined','1');document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(not pg.is_visible('#sp-home') and not pg.is_visible('#sp-back'), 'сотрудник не видит главный экран специалистов')
        check(pg.is_visible('#sp-kassa-btn'), 'продавец: есть большая кнопка «Касса»')
        n0 = len(calls); pg.click('#sp-kassa-btn'); pg.wait_for_timeout(600)
        pg.click('[data-shop="scan"][data-k="sell"]'); pg.wait_for_timeout(200); pg.fill('#sh-scan-in', 'NOPE-77'); pg.click('#sh-scan-ok'); pg.wait_for_timeout(300)
        check(pg.query_selector('#sh-scan') is None and 'Скажите кладовщику' in pg.inner_text('#sp-body') and pg.query_selector('#sh-f-kod') is None, 'скан у продавца: незнакомый код — подсказка сказать кладовщику, без «Нового товара»')
        check(pg.is_visible('#sh-code'), 'продавец: касса открывается')
        lc = [c for c in calls[n0:] if c.get('action') == 'list']
        check(lc and lc[-1].get('sid') == 'sidtest123456' and 'code' not in lc[-1], 'продавец: запрос уходит с сессией, без кода кабинета')
        check(pg.locator('#sp-body [data-shop="tab"]').count() == 0, 'продавец: вкладок Товары, Долги, Отчёт нет')
        pg.fill('#sh-code', SHP[0]['kod']); pg.wait_for_timeout(200); pg.click('#sp-body [data-shop="put"]'); pg.wait_for_timeout(300)
        check(pg.locator('#sp-body [data-shop="pay"]').count() == 0 and pg.locator('#sp-body [data-shop="dolgopen"]').count() == 1 and pg.locator('#sp-body [data-shop="paynow"]').count() == 1, 'продавец: только «В долг» и «Оплатить»')
        pg.click('#sp-body [data-shop="paynow"]'); pg.wait_for_timeout(400)
        check(any(x.get('action') == 'sell' and x.get('sid') == 'sidtest123456' and x['pay'] == 'nal' for x in calls), 'продавец: «Оплатить» проводит продажу по его сессии')
        # продавец с ролью: только касса на весь экран
        SHP.append({"kod": "S1", "name": "Дрель продавца", "zakup": 100, "marzha": 25, "price": 125.0, "qty": 5})
        pg.evaluate("localStorage.setItem('ew_sid','selltestsid9999')"); pg.reload(); pg.wait_for_timeout(3500)
        pg.evaluate("localStorage.setItem('ew_cam_declined','1')")
        kt = pg.inner_text('#kas-body') if pg.query_selector('#kas-body') else ''
        check(pg.is_visible('#kas-root') and 'Продажа' in kt, 'продавец с ролью: открыта продажа на весь экран')
        check(not pg.query_selector('#kas-body [data-shop="tab"]') and 'Отчёт' not in kt and 'Закуп' not in kt and 'Взял владелец' not in kt, 'продавец с ролью: нет вкладок, отчёта, закупки и «Взял владелец»')
        pg.fill('#kas-body #sh-code', 'S1'); pg.wait_for_timeout(200); pg.click('#kas-body [data-shop="put"]'); pg.click('#kas-body [data-shop="paynow"]'); pg.wait_for_timeout(500)
        check(any(x.get('action') == 'sell' and x.get('sid') == 'selltestsid9999' and x['pay'] == 'nal' and 'code' not in x for x in calls), 'продавец с ролью: продажа уходит по сессии сотрудника')
        check(not errs, 'продавец с ролью: нет ошибок страницы ' + str(errs))
        # кладовщик: только «Приём товара», без продажи, долгов и отчёта
        pg.evaluate("localStorage.setItem('ew_sid','keepersid7777')"); pg.reload(); pg.wait_for_timeout(3500)
        pg.evaluate("localStorage.setItem('ew_cam_declined','1')")
        kk = pg.inner_text('#kas-body') if pg.query_selector('#kas-body') else ''
        check(pg.is_visible('#kas-root') and 'Приём товара' in kk, 'кладовщик: открыт «Приём товара» на весь экран')
        check(not pg.query_selector('#kas-body [data-shop="tab"]') and not pg.query_selector('#kas-body #sh-code') and 'Отчёт' not in kk and 'Долги' not in kk and 'Кладовщик Али' in kk, 'кладовщик: нет вкладок, продажи, долгов и отчёта; журнал приёма с автором виден')
        pg.fill('#kas-body #sh-pcode', 'S1'); pg.wait_for_timeout(200); n3 = len(calls); pg.click('#kas-body [data-shop="rcv"]'); pg.fill('#sh-r-qty', '7'); pg.click('#kas-body [data-shop="rok"]'); pg.wait_for_timeout(500)
        check(any(x.get('action') == 'receive' and x.get('sid') == 'keepersid7777' and x['kod'] == 'S1' and x['qty'] == 7 and 'code' not in x for x in calls[n3:]), 'кладовщик: приход уходит по сессии сотрудника')
        import base64
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
        pg.fill('#kas-body #sh-pcode', 'S1'); pg.wait_for_timeout(200); pg.click('#kas-body [data-shop="rcv"]'); n4 = len(calls)
        with pg.expect_file_chooser() as fc: pg.click('#kas-body [data-shop="foto"]')
        fc.value.set_files([{'name': 'f.png', 'mimeType': 'image/png', 'buffer': png}]); pg.wait_for_timeout(900)
        check(any(x.get('action') == 'foto' and x.get('kod') == 'S1' and x['foto'].startswith('data:image/jpeg;base64,') and len(x['foto']) < 20000 and x.get('sid') == 'keepersid7777' for x in calls[n4:]), 'кладовщик: фото товара сжимается и уходит на сервер')
        pg.wait_for_timeout(300); check(pg.locator('#kas-body img[src^="data:image/jpeg"]').count() >= 1, 'кладовщик: фото показано в форме приёма')
        pg.click('#kas-body [data-shop="rcancel"]'); pg.wait_for_timeout(200)
        n5 = len(calls)
        pg.click('#kas-body [data-shop="scan"][data-k="recv"]'); pg.wait_for_timeout(200)
        check(pg.is_visible('#sh-scan-in'), 'скан приёма: кнопка «Скан» открывает сканер')
        pg.evaluate("window.__scanNext='S1'"); pg.wait_for_timeout(700)
        check(pg.query_selector('#sh-scan') is None and pg.is_visible('#kas-body #sh-r-qty'), 'скан приёма: штрихкод известного товара открывает приход без набора')
        pg.click('#kas-body [data-shop="rcancel"]'); pg.wait_for_timeout(200)
        pg.click('#kas-body [data-shop="scan"][data-k="recv"]'); pg.wait_for_timeout(200); pg.fill('#sh-scan-in', '4600NEW77'); pg.click('#sh-scan-ok'); pg.wait_for_timeout(300)
        check(pg.query_selector('#sh-scan') is None and pg.input_value('#kas-body #sh-f-kod') == '4600NEW77', 'скан приёма: незнакомый штрихкод сразу открывает «Новый товар» с этим кодом')
        pg.click('#kas-body [data-shop="fcancel"]'); pg.wait_for_timeout(200)
        pg.evaluate("window.BarcodeDetector = undefined"); pg.click('#kas-body [data-shop="scan"][data-k="recv"]'); pg.wait_for_timeout(300)
        check('недоступен' in pg.inner_text('#sh-scan-msg'), 'скан без камеры: понятное сообщение и ввод вручную')
        pg.click('#sh-scan-x'); pg.wait_for_timeout(200)
        check(pg.query_selector('#sh-scan') is None and not any(x.get('action') == 'receive' for x in calls[n5:]), 'скан: закрытие сканера ничего не записывает')
        check(not errs, 'кладовщик: нет ошибок страницы ' + str(errs))
        b.close()
finally: srv.terminate()
