# مختارات الهجاء: قائمة منتقاة يدويًا من عيون الهجاء المشهورة، تُطلب في الدواوين بمطلع الشطر
import json, sys, os, glob
sys.path.insert(0, os.path.dirname(__file__))
from common import strip, key
D = '/home/claude/wazn/data/diwans'
PICKS = [l.split('|') for l in open(sys.argv[1], encoding='utf-8').read().strip().split('\n')]
idx = {d['id']: d for d in json.load(open(f'{D}/index.json'))}
cache = {}
def diwan(pid):
    if pid not in cache: cache[pid] = json.load(open(f'{D}/{pid}.json'))
    return cache[pid]
out, miss = [], []
for pid, q in PICKS:
    kq = key(q); found = None
    for p in diwan(pid)['poems']:
        for v in p['v']:
            if key(v[0]).startswith(kq) or key(v[0] + ' ' + v[1]).find(kq) >= 0:
                found = (p, v); break
        if found: break
    if not found: miss.append((pid, q)); continue
    p, v = found
    out.append({'pid': pid, 'poet': idx[pid]['poet'] if pid != 'hamasa' else p.get('poet', ''), 'poem': p['t'], 'm': p.get('m', ''),
                'sadr': v[0], 'ajz': v[1], 'sharh': v[2] if len(v) > 2 else '', 'pg': v[3] if len(v) > 3 else p.get('pg')})
json.dump(out, open('/home/claude/ws/hija_pick.json', 'w'), ensure_ascii=False, indent=0)
print('found', len(out), 'miss', len(miss))
for m in miss: print('MISS', m)
for c in out: print(c['pid'], '|', c['poet'], '|', c['m'], '|', c['sadr'], '*', c['ajz'])
