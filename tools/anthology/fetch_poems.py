# يجلب قصائد المرشحين من ويكي مصدر بعنوانها، ويبحث إن لم يجده
import json, subprocess, time, re, sys, os, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from common import key
UA = 'WaznPoetryApp/1.0 (https://github.com/gts2-svg/Wazn; personal use)'
OUT = '/home/claude/ws/cand_poems'; os.makedirs(OUT, exist_ok=True)
def get(url):
    for t in range(4):
        r = subprocess.run(['curl', '-s', '--max-time', '30', '-A', UA, url], capture_output=True).stdout.decode('utf-8', 'ignore')
        if 'too many requests' in r or 'Wikimedia Error' in r: time.sleep(15); continue
        return r
    return ''
def raw(title):
    t = get('https://ar.wikisource.org/w/index.php?action=raw&title=' + urllib.parse.quote(title))
    if t.startswith('#تحويل') or t.startswith('#REDIRECT'):
        m = re.search(r'\[\[([^]]+)\]\]', t)
        if m: time.sleep(1); t = get('https://ar.wikisource.org/w/index.php?action=raw&title=' + urllib.parse.quote(m.group(1)))
    return t if 'أبيات' in t else ''
def search(q):
    j = get('https://ar.wikisource.org/w/api.php?action=query&format=json&list=search&srlimit=5&srsearch=' + urllib.parse.quote(q))
    try: return [x['title'] for x in json.loads(j)['query']['search']]
    except Exception: return []
cands = json.load(open(os.path.join(os.path.dirname(__file__), 'candidates.json')))
for c in cands:
    f = f"{OUT}/{key(c['poem'])[:40]}.txt"
    if os.path.exists(f) and os.path.getsize(f) > 50: continue
    t = raw(c['poem']); time.sleep(1.2)
    if not t:
        sad = c['v'][0].split('*')[0].strip()
        for q in [c['poem'], sad]:
            for title in search(q):
                time.sleep(1.2); t = raw(title)
                if t and key(sad)[:12] in key(t): break
                t = ''
            if t: break
            time.sleep(2)
    open(f, 'w').write(t)
    print(('OK  ' if t else 'MISS') + ' ' + c['poet'] + ' | ' + c['poem'])
