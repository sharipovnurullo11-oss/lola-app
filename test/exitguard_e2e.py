# Вопрос «Выйти из приложения?» не должен появляться при открытии кабинета клиента из админки (смена адреса #admin → #as=...).
import subprocess, time, os
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8128'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
def check(c, m):
    print(('ok - ' if c else 'FAIL - ') + m)
    if not c: raise SystemExit(1)
def not_guarded(pg): return not bool(pg.evaluate("EWExitGuard._state().guarded"))
def asking(pg): return pg.evaluate("(function(){var d=document.getElementById('m-exit');return !!(d&&d.open)})()")
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None); pg = b.new_page(viewport={'width': 390, 'height': 800}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/webhook/**', lambda r: r.fulfill(json={"ok": True}))
        pg.goto('http://localhost:8128/window.html'); pg.wait_for_timeout(300)
        pg.evaluate("localStorage.setItem('ew_cab','kcabinetadmintest00000000000');sessionStorage.setItem('ew_cab','kcabinetadmintest00000000000')"); pg.goto('http://localhost:8128/window.html#admin'); pg.reload(); pg.wait_for_timeout(1500)
        check(not_guarded(pg), 'на экране админа защита от выхода не включается')
        pg.evaluate("location.hash = '#as=kd6es8ycn5fa6gj43v7vlmw3nc0z5'"); pg.wait_for_timeout(600)
        check(not asking(pg), 'открытие кабинета из списка не задаёт вопрос «выйти»')
        pg.evaluate("location.hash = '#admin'"); pg.wait_for_timeout(600)
        check(not asking(pg), 'возврат в админку не задаёт вопрос «выйти»')
        # обычное «Назад» клиента по-прежнему спрашивает
        pg = b.new_page(viewport={'width': 390, 'height': 800}); pg.route('**/webhook/**', lambda r: r.fulfill(json={"ok": True}))
        pg.goto('http://localhost:8128/window.html'); pg.evaluate("localStorage.setItem('ew_cab','kcabinetclienttest0000000000');sessionStorage.setItem('ew_cab','kcabinetclienttest0000000000')"); pg.reload(); pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close()); window.dispatchEvent(new PopStateEvent('popstate'))"); pg.wait_for_timeout(800)  # Chrome пропускает записи без касания, поэтому «Назад» имитируем событием
        check(asking(pg), 'обычная кнопка «Назад» у клиента по-прежнему спрашивает про выход')
        check(not errs, 'нет ошибок страницы ' + str(errs))
        b.close()
finally: srv.terminate()
print('EXITGUARD E2E PASSED')
