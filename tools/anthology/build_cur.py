# المختارات المنتقاة: نص البيت ورواية حركاته من تراث أولاً، ويُكمَّل الضبط من ويكي مصدر، والشرح من كتب الشروح
import json, re, sys, os, difflib, subprocess, urllib.parse, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
W = '/home/claude/ws'
cands = json.load(open(os.path.join(os.path.dirname(__file__), 'candidates.json')))

def wiki_verses(poem):
    f = f"{W}/cand_poems/{key(poem)[:40]}.txt"
    if not os.path.exists(f): return []
    raw = open(f, encoding='utf-8').read()
    out = []
    for m in re.finditer(r'\{\{أبيات\|?(.*?)\}\}', raw, re.S):
        for line in m.group(1).split('\n'):
            line = line.lstrip('|')
            if '\\\\' not in line: continue
            s, a = line.split('\\\\', 1)
            out.append((clean(s), clean(a.split('\\\\')[0])))
    return out

def locate(text, s, a):
    """يجد البيت داخل نص صفحة من تراث ويعيد (الصدر، العجز، موضع النهاية)"""
    nz, idx = [], []
    for i, ch in enumerate(text):
        n = norm(ch)
        if n and n != ' ': nz.append(n); idx.append(i)
    nz = ''.join(nz)
    ks, ka = key(s), key(a)
    i = nz.find(ks)
    if i < 0: return None
    j = nz.find(ka, i + len(ks))
    if j < 0 or j - (i + len(ks)) > 12: return None
    s0, s1 = idx[i], idx[i + len(ks) - 1] + 1
    a0, a1 = idx[j], idx[j + len(ka) - 1] + 1
    return text[s0:s1], text[a0:a1], a1

def turath(q):
    r = subprocess.run(['curl', '-s', '--max-time', '25', 'https://api.turath.io/search?q=' + urllib.parse.quote(q)], capture_output=True).stdout
    try: return json.loads(r)
    except Exception: return {'count': 0, 'data': []}

items = []
for c in cands:
    wv = wiki_verses(c['poem'])
    for line in c['v']:
        s, a = [x.strip() for x in line.split('*')]
        # الضبط الكامل من الديوان في ويكي مصدر
        best, br = None, 0
        for ws, wa in wv:
            r = difflib.SequenceMatcher(None, key(s + a), key(ws + wa), autojunk=False).ratio()
            if r > br: best, br = (ws, wa), r
        if br < 0.8: print('NOWIKI', c['poet'], s); continue
        ws, wa = best
        # تراث: الرواية وحركاتها، وعدد مواضع الورود، والشرح
        res = turath(strip(ws)); time.sleep(0.2)
        hits = res.get('data', [])
        src_marks, sharh, src = None, None, None
        def score(h):
            m = json.loads(h['meta']) if isinstance(h['meta'], str) else h['meta']
            bn = m.get('book_name', '')
            return (2 if h.get('cat_id') == 34 else 0) + (2 if 'شرح' in bn or 'ديوان' in bn else 0) + (1 if h.get('cat_id') == 32 else 0)
        for h in sorted(hits, key=score, reverse=True):
            m = json.loads(h['meta']) if isinstance(h['meta'], str) else h['meta']
            loc = locate(h.get('text', ''), ws, wa)
            if not loc: continue
            ts, ta, end = loc
            marks = len(MARKS.findall(ts + ta))
            link = f"https://app.turath.io/book/{h['book_id']}?page={m.get('page_id')}"
            trusted = h.get('cat_id') == 34 or m.get('book_name', '').startswith('ديوان ')
            sc = marks + (1000 if trusted else 0)
            if src_marks is None or sc > src_marks[2]:
                src_marks = (ts, ta, sc, m.get('book_name'), link, trusted)
            bn = m.get('book_name', '')
            if not sharh and 'شرح' in bn:
                after = re.sub(r'\s+', ' ', h['text'][end:]).strip()
                nxt = after.find('...')
                seg = after[:nxt] if nxt > 0 else after
                ws_ = seg.split()
                if nxt > 0 and len(ws_) > 12: ws_ = ws_[:-6]
                seg = re.sub(r'^[ً-ْ\s،,.:)]+', '', ' '.join(ws_))
                if len(seg) > 40:
                    if len(seg) > 700: seg = seg[:700].rsplit(' ', 1)[0] + '…'
                    sharh = {'text': seg, 'book': bn, 'url': link}
        if src_marks:
            ms, _ = merge_marks(src_marks[0], ws, src_marks[5]); ma, _ = merge_marks(src_marks[1], wa, src_marks[5])
            src = {'book': src_marks[3], 'url': src_marks[4]}
        else:
            ms, ma = ws, wa
        items.append({'g': [c['g']], 'poet': c['poet'], 'poem': c['poem'], 'sadr': ms, 'ajz': ma, 'wiki': [ws, wa],
                      'src': src, 'sharh': sharh, 'fame': res.get('count', 0)})
        print('OK ', c['poet'], '|', ms, '*', ma, '| src' if src else '| wiki-only', '| sharh' if sharh else '')
json.dump(items, open(f'{W}/cur_sel.json', 'w'), ensure_ascii=False)
print(len(items))
