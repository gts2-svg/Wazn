# عيون المتنبي: اختيار الصاحب بن عباد (الأمثال السائرة) + ضبط تراث مكمّلاً من ويكي مصدر + شرح الواحدي
import sys, json, re, difflib, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
W = '/home/claude/ws'
diwan = json.load(open(f'{W}/mut.json'))
dv = []  # (key, sadr, ajz, title)
for p in diwan:
    for s, a in p['verses']: dv.append((key(s + a), s, a, p['title']))
keys = [x[0] for x in dv]
by_prefix = {}
for i, k in enumerate(keys): by_prefix.setdefault(k[:6], []).append(i)

def find(s, a):
    k = key(s + a)
    cands = by_prefix.get(k[:6], [])
    best, br = None, 0
    pool = cands if cands else range(len(keys))
    for i in pool:
        r = difflib.SequenceMatcher(None, k, keys[i], autojunk=False).ratio()
        if r > br: best, br = i, r
    if br < 0.86 and cands:
        for i in range(len(keys)):
            r = difflib.SequenceMatcher(None, k, keys[i], autojunk=False).quick_ratio()
            if r > br:
                r = difflib.SequenceMatcher(None, k, keys[i], autojunk=False).ratio()
                if r > br: best, br = i, r
    return (best, br) if br >= 0.82 else (None, br)

# شرح الواحدي: نبحث عن البيت في النص المطبَّع، ونأخذ ما بعده إلى البيت التالي
wah = turath_pages(f'{W}/turath/wahidi')
wtext = ''; wmarks = []
for meta, txt, f in wah:
    wmarks.append((len(wtext), meta.get('page_id')))
    txt = re.sub(r'<[^>]+>', ' ', txt)
    wtext += txt + '\n'
NZ, IDX = [], []
for i, ch in enumerate(wtext):
    n = norm(ch)
    if n and n != ' ': NZ.append(n); IDX.append(i)
NZ = ''.join(NZ)
def sharh(cands):
    for s, a in cands:
        ks, ka = key(s), key(a)
        i = NZ.find(ks)
        if i < 0: i = NZ.find(ks[:14])
        if i < 0: continue
        j = NZ.find(ka[-8:], i + 8)
        if j < 0 or j - i > len(ks) + len(ka) + 20: continue
        end = IDX[j + len(ka[-8:]) - 1] + 1
        n = wtext.find('...', end)
        seg = wtext[end:n if n > 0 else end + 1500]
        ws = seg.split()
        if n > 0: ws = ws[:-6] if len(ws) > 12 else ws
        seg = re.sub(r'^[\u064B-\u0652\s،,.:]+', '', ' '.join(ws)).strip()
        if len(seg) < 15: continue
        page = None
        for off, pid in wmarks:
            if off <= end: page = pid
        if len(seg) > 900: seg = seg[:900].rsplit(' ', 1)[0] + '…'
        return {'text': seg, 'book': 'شرح ديوان المتنبي للواحدي', 'url': f'https://app.turath.io/book/754?page={page}'}
    return None

ia = turath_pages(f'{W}/turath/ibnabbad')
out, miss = [], []
seen = set()
for meta, txt, f in ia:
    for s, a, pos in split_verses(txt):
        if len(key(s + a)) < 20: continue
        i, r = find(s, a)
        if i is None: miss.append((s, a, round(r, 2))); continue
        if i in seen: continue
        seen.add(i)
        _, ws, wa, title = dv[i]
        ms, p1 = merge_marks(s, ws, False); ma, p2 = merge_marks(a, wa, False)
        out.append({'poet': 'المتنبي', 'sadr': ms, 'ajz': ma, 'wiki': [ws, wa], 'turath': [s, a],
                    'partial': p1 or p2, 'match': round(r, 3), 'poem': title,
                    'src': {'book': 'الأمثال السائرة من شعر المتنبي (الصاحب بن عباد)', 'url': f"https://app.turath.io/book/37460?page={meta.get('page_id')}"},
                    'sharh': sharh([(s, a), (ws, wa)])})
json.dump(out, open(f'{W}/mut_sel.json', 'w'), ensure_ascii=False, indent=0)
print('selected', len(out), 'missed', len(miss), 'with sharh', sum(1 for x in out if x['sharh']), 'partial', sum(1 for x in out if x['partial']))
for m in miss[:8]: print('MISS', m)
