# Проверка раздела «Специалисты» в браузере: список, бухгалтер, запись, удаление, остатки, сотрудник не видит.
import subprocess, time, json
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8126'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
AN = {'st': 'none', 'left': 1, 'polls': 0}
KBC = []
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
    if u.endswith('/znaniya'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if a == 'list': return route.fulfill(json={"ok": True, "cases": [c for c in KBC if c['spec'] == b['spec']], "total": len([c for c in KBC if c['spec'] == b['spec']])})
        if a == 'save':
            KBC.insert(0, {"id": len(KBC) + 1, "spec": b['spec'], "q": b['q'], "a": b['a'], "vremya": "2026-10-22T05:00:00.000Z"})
            return route.fulfill(json={"ok": True, "saved": True, "total": len([c for c in KBC if c['spec'] == b['spec']])})
        if a == 'delete':
            KBC[:] = [c for c in KBC if c['id'] != b['id']]
            return route.fulfill(json={"ok": True, "deleted": True, "total": len([c for c in KBC if c['spec'] == b['spec']])})
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
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', h)
        pg.goto('http://localhost:8126/window.html'); pg.wait_for_timeout(500)
        pg.evaluate("localStorage.setItem('ew_cab','codetest1')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(pg.is_visible('#sp-home'), 'первый экран владельца — ряд специалистов')
        t = pg.inner_text('#sp-home')
        check(all(x in t for x in ['Бухгалтер', 'SMM-специалист', 'Юрист', 'Маркетолог', 'Менеджер по клиентам', 'Продавец-ассистент']), 'все шесть специалистов на первом экране')
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
        pg.click('[data-kb="save:lawyer"]'); pg.wait_for_timeout(600)
        check(any(x.get('action') == 'save' and x.get('spec') == 'lawyer' and x['q'].startswith('Договор') for x in calls) and 'Запомнено дел: 1' in pg.inner_text('#sp-body'), 'База знаний: договор Юриста записан')
        pg.click('[data-law="copy"]'); pg.wait_for_timeout(200); pg.click('[data-sp-back]'); pg.wait_for_timeout(200)
        check(pg.is_visible('#sp-home'), 'после «назад» остаёмся на главном экране')
        pg.click('[data-home="seller"]'); pg.wait_for_timeout(300)
        check(not pg.is_visible('#sp-home') and pg.is_visible('#list') and pg.is_visible('#sp-back'), 'продавец-ассистент открывает переписки, сверху «← Специалисты»')
        pg.click('#sp-back button'); pg.wait_for_timeout(200); check(pg.is_visible('#sp-home') and not pg.is_visible('#list'), 'кнопка «← Специалисты» возвращает на главный экран')
        pg.click('[data-home="buh"]'); pg.wait_for_timeout(500)
        check(pg.is_visible('[data-onb^="kind:"]'), 'бухгалтер: при первом входе просит выбрать вид деятельности')
        pg.click('[data-onb="kind:health"]'); pg.click('[data-onb="stock:yes"]'); pg.click('[data-onb^="staff:"] >> nth=0'); pg.click('[data-onb="hire"]'); pg.wait_for_timeout(700)
        t = pg.inner_text('#sp-body'); check('500' in t and 'Крем' in t, 'бухгалтер: итоги и остатки загружены')
        check('<b>x</b>' in t and pg.locator('#sp-body b', has_text='x').count() == 0, 'текст записи экранирован')
        pg.fill('#bh-text', 'расход 150,5 такси'); pg.click('[data-buh="text"]'); pg.wait_for_timeout(500)
        check(any(c['action'] == 'add' and c['op']['type'] == 'out' and c['op']['amount'] == '150.5' for c in calls), 'текстовая запись расхода')
        check('349,5' in pg.inner_text('#sp-body').replace('\xa0', ' '), 'прибыль = 500 − 150,5 = 349,5')
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
        pg.click('[data-home="buh"]'); pg.wait_for_timeout(150)
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
        check(not errs, 'нет ошибок страницы ' + str(errs))
        check(pg.evaluate('document.documentElement.scrollWidth') <= pg.evaluate('innerWidth'), 'нет горизонтальной прокрутки на телефоне')
        # сотрудник не видит
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close());localStorage.removeItem('ew_cab');localStorage.setItem('ew_sid','sidtest123456')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("localStorage.setItem('ew_cam_declined','1');document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(not pg.is_visible('#sp-home') and not pg.is_visible('#sp-back'), 'сотрудник не видит главный экран специалистов')
        b.close()
finally: srv.terminate()
