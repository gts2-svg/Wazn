# شهرة البيت: عدد مواضع وروده في كتب تراث (يُبحث بصدر البيت)
import json, subprocess, sys, os, time, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from common import strip, clean
inp, outp = sys.argv[1], sys.argv[2]
d = json.load(open(inp))
for v in d:
    if 'fame' in v: continue
    q = strip(clean(v['sadr']))
    r = subprocess.run(['curl', '-s', '--max-time', '20', 'https://api.turath.io/search?q=' + urllib.parse.quote(q)], capture_output=True).stdout
    try: v['fame'] = json.loads(r)['count']
    except Exception: v['fame'] = 0
    time.sleep(0.15)
json.dump(d, open(outp, 'w'), ensure_ascii=False)
print('done', len(d), sorted([v['fame'] for v in d])[-5:])
