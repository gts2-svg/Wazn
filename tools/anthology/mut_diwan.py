# ديوان المتنبي كاملاً (ويكي مصدر) مع شرح الواحدي لكل بيت إن وُجد
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
W = '/home/claude/ws'
wah = turath_pages(f'{W}/turath/wahidi')
wtext, wmarks = '', []
for meta, txt, f in wah:
    wmarks.append((len(wtext), meta.get('page_id')))
    wtext += re.sub(r'<[^>]+>', ' ', txt) + '\n'
NZ, IDX = [], []
for i, ch in enumerate(wtext):
    n = norm(ch)
    if n and n != ' ': NZ.append(n); IDX.append(i)
NZ = ''.join(NZ)
def sharh(s, a):
    ks, ka = key(s), key(a)
    i = NZ.find(ks)
    if i < 0: i = NZ.find(ks[:14]) if len(ks) > 14 else -1
    if i < 0: return None
    j = NZ.find(ka[-8:], i + 8)
    if j < 0 or j - i > len(ks) + len(ka) + 20: return None
    end = IDX[j + len(ka[-8:]) - 1] + 1
    n = wtext.find('...', end)
    ws = wtext[end:n if n > 0 else end + 1500].split()
    if n > 0 and len(ws) > 12: ws = ws[:-6]
    seg = re.sub(r'^[ً-ْ\s،,.:]+', '', ' '.join(ws)).strip()
    if len(seg) < 40: return None
    if len(seg) > 700: seg = seg[:700].rsplit(' ', 1)[0] + '…'
    page = None
    for off, pid in wmarks:
        if off <= end: page = pid
    return [seg, page]
poems = json.load(open(f'{W}/mut.json'))
n = 0
for p in poems:
    p['v'] = []
    for s, a in p['verses']:
        sh = sharh(s, a); n += bool(sh)
        p['v'].append([s, a] + ([sh[0], sh[1]] if sh else []))
    del p['verses']
json.dump(poems, open(f'{W}/mut_full.json', 'w'), ensure_ascii=False)
print('verses', sum(len(p['v']) for p in poems), 'with sharh', n)
