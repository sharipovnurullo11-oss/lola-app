import subprocess,time,json
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8125'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
calls=[]
items=[{"tid":"t1","name":"Крем","price":50,"stock":7,"counted":"","active":True},{"tid":"t2","name":"Духи","price":120,"stock":-1,"counted":"","active":True}]
def h(route):
    u=route.request.url
    if u.endswith('/shop'):
        b=json.loads(route.request.post_data); calls.append(b)
        if b['action']=='list': return route.fulfill(json={"ok":True,"role":"staff","who":"Мадина","items":items,"recent":[{"oid":"a","tid":"t1","name":"Крем","tip":"sale","qty":2,"diff":0,"who":"Мадина","at":"2026-10-19T05:00:00Z"}]})
        return route.fulfill(json={"ok":True,"tid":b.get('tid'),"stock":4,"diff":-2,"calc":5,"warn":""})
    route.fulfill(json={"ok":True,"staff":[],"sessions":[]})
try:
  with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':390,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/webhook/**',h)
    pg.goto('http://localhost:8125/window.html');pg.wait_for_timeout(500)
    pg.evaluate("localStorage.setItem('ew_sid','sidtest123456')");pg.wait_for_timeout(300)
    pg.wait_for_timeout(2500);pg.evaluate("localStorage.setItem('ew_cam_declined','1');document.querySelectorAll('dialog[open]').forEach(d=>d.close())");pg.evaluate("EWShop.open()");pg.wait_for_timeout(1200)
    print(pg.evaluate("document.getElementById('m-shop').innerText")[:300])
    pg.click('[data-pick="t1"]');pg.wait_for_timeout(200)
    pg.fill('#sh-q','2');pg.click('[data-do="sale"]');pg.wait_for_timeout(800)
    pg.click('[data-pick="t1"]');pg.fill('#sh-c','3');pg.click('[data-do="count"]');pg.wait_for_timeout(800)
    print(pg.inner_text('#sh-msg'));print([ (c['action'],c.get('qty')) for c in calls]);print(errs)
    print(pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
finally: srv.terminate()
