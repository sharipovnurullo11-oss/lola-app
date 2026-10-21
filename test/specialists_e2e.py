# Проверка раздела «Специалисты» в браузере: список, бухгалтер, запись, удаление, остатки, сотрудник не видит.
import subprocess, time, json
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8126'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
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
    if u.endswith('/smm'):
        b = json.loads(route.request.post_data); calls.append(b); a = b['action']
        if a == 'status': return route.fulfill(json={"ok": True, "connected": True, "username": "nurullo_psiholog", "left": 5, "limit": 5})
        if a == 'plan': return route.fulfill(json={"ok": True, "text": "ПЛАН <b>x</b>\nПН - рилс", "left": 4, "connected": True})
        if a == 'caption': return route.fulfill(json={"ok": True, "text": "Подпись готова", "left": 3, "connected": True})
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
        check(all(x in t for x in ['Бухгалтер', 'SMM-специалист', 'Юрист', 'Маркетолог-таргетолог', 'Менеджер по клиентам', 'Продавец-ассистент']), 'все шесть специалистов на первом экране')
        check(not pg.is_visible('#list') and not pg.is_visible('#chs'), 'переписки спрятаны за главным экраном')
        check(not pg.is_visible('#m-specbtn'), 'кнопки «Специалисты» в меню больше нет')
        pg.click('[data-home="lawyer"]'); pg.wait_for_timeout(300); check('Скоро' in pg.inner_text('#sp-body'), 'юрист — скоро'); pg.click('[data-sp-back]'); pg.wait_for_timeout(200)
        check(pg.is_visible('#sp-home'), 'после «назад» остаёмся на главном экране')
        pg.click('[data-home="seller"]'); pg.wait_for_timeout(300)
        check(not pg.is_visible('#sp-home') and pg.is_visible('#list') and pg.is_visible('#sp-back'), 'продавец-ассистент открывает переписки, сверху «← Специалисты»')
        pg.click('#sp-back button'); pg.wait_for_timeout(200); check(pg.is_visible('#sp-home') and not pg.is_visible('#list'), 'кнопка «← Специалисты» возвращает на главный экран')
        pg.click('[data-home="buh"]'); pg.wait_for_timeout(500)
        t = pg.inner_text('#sp-body'); check('500' in t and 'Крем' in t, 'бухгалтер: итоги и остатки загружены')
        check('<b>x</b>' in t and pg.locator('#sp-body b', has_text='x').count() == 0, 'текст записи экранирован')
        pg.fill('#bh-text', 'расход 150,5 такси'); pg.click('[data-buh="text"]'); pg.wait_for_timeout(500)
        check(any(c['action'] == 'add' and c['op']['type'] == 'out' and c['op']['amount'] == '150.5' for c in calls), 'текстовая запись расхода')
        check('349,5' in pg.inner_text('#sp-body').replace('\xa0', ' '), 'прибыль = 500 − 150,5 = 349,5')
        pg.fill('#bh-sum', '0'); pg.click('[data-buh="add"]'); check(pg.is_visible('#bh-err'), 'нулевая сумма отклонена')
        pg.fill('#bh-text', 'привет'); pg.click('[data-buh="text"]'); check('расход 150' in pg.inner_text('#bh-err'), 'непонятный текст отклонён')
        pg.click('[data-buh="del"][data-id]:last-of-type'); pg.wait_for_timeout(400)
        pg.click('[data-buh="st+"]'); pg.wait_for_timeout(400); check(any(c['action'] == 'stock' and c['delta'] == 1 for c in calls), 'остаток +1')
        pg.fill('#bh-gname', 'Духи'); pg.fill('#bh-gqty', '3'); pg.click('[data-buh="gadd"]'); pg.wait_for_timeout(400); check('Духи' in pg.inner_text('#sp-body'), 'новый товар')
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
        pg.click('[data-smm="profile"]'); pg.wait_for_timeout(500); check('Instagram' in pg.inner_text('#sp-body') and pg.is_visible('#sp-body .err'), 'SMM: ошибка разбора показана')
        check(not errs, 'нет ошибок страницы ' + str(errs))
        check(pg.evaluate('document.documentElement.scrollWidth') <= pg.evaluate('innerWidth'), 'нет горизонтальной прокрутки на телефоне')
        # сотрудник не видит
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close());localStorage.removeItem('ew_cab');localStorage.setItem('ew_sid','sidtest123456')"); pg.reload(); pg.wait_for_timeout(1200)
        pg.evaluate("localStorage.setItem('ew_cam_declined','1');document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        check(not pg.is_visible('#sp-home') and not pg.is_visible('#sp-back'), 'сотрудник не видит главный экран специалистов')
        b.close()
finally: srv.terminate()
