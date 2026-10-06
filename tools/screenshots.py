from playwright.sync_api import sync_playwright
import os
OUT='screenshots'; os.makedirs(OUT,exist_ok=True)
URL='http://localhost:8788/'
CASES=[('fabricated','The Prophet said: seek knowledge even if you have to go to China'),
       ('other-wording','Paradise lies under the feet of mothers'),
       ('authentic','The strong man is not the one who wrestles, but the one who controls himself when angry'),
       ('french','Le meilleur d\'entre vous est celui qui apprend le Coran et l\'enseigne'),
       ('quran-verse','Allah does not burden a soul beyond its capacity'),
       ('not-found','Cleanliness is next to godliness')]
def ready(pg): pg.wait_for_function("document.querySelector('#dbText').textContent.includes('جاهز')",timeout=90000); pg.wait_for_timeout(600)
def go(pg,q):
    pg.evaluate("window.scrollTo(0,0)"); pg.fill('#q',q); pg.click('#go')
    pg.wait_for_function("!document.querySelector('#result').hidden && !document.querySelector('#go').disabled",timeout=60000)
    pg.wait_for_timeout(1200)
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---- laptop
    ctx=b.new_context(viewport={'width':1440,'height':900},device_scale_factor=2,color_scheme='dark'); pg=ctx.new_page()
    pg.goto(URL); ready(pg); pg.screenshot(path=f'{OUT}/laptop-01-home.png')
    for i,(name,q) in enumerate(CASES,2):
        go(pg,q)
        pg.evaluate("document.querySelector('#result').scrollIntoView({block:'start'}); window.scrollBy(0,-24)"); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/laptop-{i:02d}-{name}.png')
    # reply close-up for the fabricated case
    go(pg,CASES[0][1]); el=pg.locator('.reply'); el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); el.screenshot(path=f'{OUT}/laptop-07-ready-reply.png')
    ctx.close()
    # ---- phone
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,color_scheme='dark',is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.goto(URL); ready(pg); pg.screenshot(path=f'{OUT}/phone-01-home.png')
    for i,(name,q) in enumerate(CASES[:3]+CASES[4:],2):
        go(pg,q)
        pg.evaluate("document.querySelector('#result').scrollIntoView({block:'start'})"); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/phone-{i:02d}-{name}-verdict.png')
    go(pg,CASES[0][1])
    for sel,name in [('#matn','fabricated-source-comment'),('.reply','fabricated-reply'),('.ledger','fabricated-sources')]:
        pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'start'}}); window.scrollBy(0,-12)"); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/phone-{name}.png')
    ctx.close(); b.close()
print(sorted(os.listdir(OUT)))
