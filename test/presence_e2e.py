import json, time, subprocess, sys
from playwright.sync_api import sync_playwright
REPO='/home/claude/sharipovnurullo11-oss/lola-app'
srv=subprocess.Popen(['python3','-m','http.server','8123','--bind','127.0.0.1'],cwd=REPO,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
FAKE_MOD='''
export const FilesetResolver={forVisionTasks:async()=>({})};
export const FaceDetector={createFromOptions:async()=>({detectForVideo:()=>({detections:window.__present?[{}]:[]}),close(){}})};
'''
events=[]
def api(route):
    req=route.request
    body={}
    try: body=json.loads(req.post_data or '{}')
    except Exception: pass
    if req.url.endswith('/presence'):
        if body.get('action')=='config': out={'ok':True,'enabled':True}
        else: events.append(body); out={'ok':True}
    elif req.url.endswith('/staff') and body.get('action')=='chats':
        out={'ok':True,'chats':[],'ordered':[],'name':'Тест'}
    else: out={'ok':True}
    route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(out))
def run():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
        ctx=b.new_context(permissions=['camera'])
        page=ctx.new_page()
        logs=[]; page.on('console',lambda m: logs.append(m.text)); page.on('pageerror',lambda e: logs.append('PAGEERROR '+str(e)))
        page.route('**/vision_bundle.mjs',lambda r: r.fulfill(status=200,content_type='text/javascript',headers={'access-control-allow-origin':'*'},body=FAKE_MOD))
        page.route('**/webhook/**',api)
        page.clock.install()
        page.goto('http://127.0.0.1:8123/window.html')
        page.evaluate("window.__present=true; store('ew_sid','S1'); store('ew_sname','Тест'); enter_mode();")
        page.clock.run_for(2100)
        page.wait_for_selector('dialog[open] [data-y]',timeout=5000)
        print('1. показано согласие:',page.inner_text('dialog[open] h3'))
        page.click('dialog[open] [data-y]')
        time.sleep(3)
        page.clock.run_for(2600)
        txt=lambda: page.inner_text('#cam-txt')
        print('2. плашка после включения:',txt())
        page.evaluate('window.__present=false')
        for _ in range(8): page.clock.run_for(2600)   # ~21 с без лица
        print('3. через ~21 с без лица:',txt())
        for _ in range(6): page.clock.run_for(2600)   # ещё ~16 с, всего >30
        print('4. через ~37 с без лица:',txt())
        page.evaluate('window.__present=true')
        page.clock.run_for(2600); time.sleep(0.5); page.clock.run_for(2100)
        print('5. вернулся:',txt())
        page.evaluate("store('ew_sid',null); enter_mode();")
        page.clock.run_for(2100); time.sleep(0.5); page.clock.run_for(2100)
        print('6. после выхода сотрудника плашка скрыта:',page.evaluate("document.getElementById('cam-badge').hidden"),'| видеопоток остановлен:',page.evaluate("!document.querySelector('video')"))
        time.sleep(0.5)
        print('события на сервер:',[ (e['event'], e.get('seconds')) for e in events])
        print('ошибки страницы:',[l for l in logs if 'PAGEERROR' in l])
        b.close()
try: run()
finally: srv.terminate()
