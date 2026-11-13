# مختارات الهجاء: من قصائد الهجاء في دواوين الفحول، تُرتَّب بشهرتها في كتب تراث
import json, re, sys, os, subprocess, urllib.parse
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
from common import strip, clean, key, merge_marks, MARKS
D = '/home/claude/wazn/data/diwans'
POETS = ['jarir', 'farazdaq', 'akhtal', 'hutaya', 'bashar', 'hassan', 'abutammam', 'buhturi', 'ibnrumi', 'maarri', 'ibnmutazz', 'abufiras', 'radi', 'asha', 'nabigha', 'zuhair', 'antara', 'tarafa']
BAD = ['زنا', 'زان', 'زني', 'فرج', 'اير', 'است', 'قحب', 'ناك', 'نيك', 'بظر', 'خصي', 'عبد', 'عبيد', 'زنج', 'سود', 'لوط', 'بغي', 'عاهر', 'مومس', 'حر امك', 'امه', 'امك', 'نسوه', 'فقح', 'سلح', 'خرء', 'بول']
def bad(t):
    k = ' ' + strip(t).replace('أ', 'ا').replace('إ', 'ا').replace('ة', 'ه') + ' '
    return any(b in k for b in BAD)
cands = []
for pid in POETS:
    d = json.load(open(f'{D}/{pid}.json'))
    for p in d['poems']:
        if p.get('th') != 'هجاء': continue
        for s, a in p['v']:
            if bad(s + ' ' + a) or len(key(s)) < 12: continue
            cands.append({'pid': pid, 'poet': d['poet'], 'poem': p['t'], 'sadr': s, 'ajz': a})
print('candidates', len(cands))
def fame(c):
    q = strip(c['sadr'] + ' ' + c['ajz'])
    r = subprocess.run(['curl', '-s', '--max-time', '25', 'https://api.turath.io/search?q=' + urllib.parse.quote(q)], capture_output=True).stdout
    try: j = json.loads(r); c['fame'] = j['count']; c['hits'] = j['data'][:8]
    except Exception: c['fame'] = 0; c['hits'] = []
    return c
with ThreadPoolExecutor(8) as ex: cands = list(ex.map(fame, cands))
# الشهرة الحقيقية: أن يرد البيت نفسه (صدره وعجزه) في الكتب، لا مجرد كلماته
def confirmed(c):
    ka = key(c['ajz'])[-10:]
    return sum(1 for h in c['hits'] if ka in key(h.get('text', '')))
for c in cands: c['conf'] = confirmed(c)
cands = [c for c in cands if c['conf'] >= 2]
cands.sort(key=lambda c: -c['fame'])
per, out = {}, []
for c in cands:
    if per.get(c['poet'], 0) >= 9: continue
    per[c['poet']] = per.get(c['poet'], 0) + 1; out.append(c)
    if len(out) >= 90: break
json.dump(out, open('/home/claude/ws/hija_sel.json', 'w'), ensure_ascii=False)
print('selected', len(out), per)
for i, c in enumerate(out): print(i, c['fame'], c['poet'][:6], '|', strip(c['sadr']), '*', strip(c['ajz']))
