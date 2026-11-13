# الهجاء: ضبط الأبيات المنتقاة (hija_pick.json) من تراث أولاً ثم الديوان، وضمّها إلى all_pre.json قبل الوزن
import json, re, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
W = '/home/claude/ws'
src_code = open(os.path.join(os.path.dirname(__file__), 'build_cur.py'), encoding='utf-8').read()
# نعيد تعريف الدالتين من build_cur.py
ns = {'__file__': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_cur.py')}
code = src_code.split('items = []')[0]
code = code.replace("cands = json.load(open(os.path.join(os.path.dirname(__file__), 'candidates.json')))", '')
exec(code, ns)
locate, turath = ns['locate'], ns['turath']
picks = json.load(open(f'{W}/hija_pick.json'))
items = []
for c in picks:
    ws, wa = c['sadr'], c['ajz']
    res = turath(strip(ws)); time.sleep(0.2)
    hits = res.get('data', [])
    if not any(locate(h.get('text', ''), ws, wa) for h in hits):
        r2 = turath(strip(wa)); time.sleep(0.2); hits = hits + r2.get('data', [])
        res = res if res.get('count') else r2
    best, sharh = None, None
    for h in hits:
        m = json.loads(h['meta']) if isinstance(h['meta'], str) else h['meta']
        loc = locate(h.get('text', ''), ws, wa)
        if not loc: continue
        ts, ta, end = loc
        bn = m.get('book_name', '')
        trusted = h.get('cat_id') == 34 or (bn.startswith('ديوان ') and 'المعاني' not in bn)
        sc = len(MARKS.findall(ts + ta)) + (1000 if trusted else 0)
        link = f"https://app.turath.io/book/{h['book_id']}?page={m.get('page_id')}"
        if best is None or sc > best[2]: best = (ts, ta, sc, bn, link, trusted)
        if not sharh and 'شرح' in bn:
            after = re.sub(r'\s+', ' ', h['text'][end:]).strip()
            nxt = after.find('...'); seg = after[:nxt] if nxt > 0 else after
            seg = re.sub(r'^[ً-ْ\s،,.:)]+', '', seg)
            if len(seg) > 40:
                if len(seg) > 600: seg = seg[:600].rsplit(' ', 1)[0] + '…'
                sharh = {'text': seg, 'book': bn, 'url': link}
    if c.get('sharh') and len(c['sharh']) > 40 and not sharh:
        sharh = {'text': c['sharh'][:600], 'book': 'شرح ديوان المتنبي للواحدي', 'url': None}
    if best:
        ms, _ = merge_marks(best[0], ws, best[5]); ma, _ = merge_marks(best[1], wa, best[5])
        src = {'book': best[3], 'url': best[4]}
    else:
        ms, ma, src = ws, wa, None
    items.append({'g': ['الهجاء'], 'poet': c['poet'], 'poem': c['poem'], 'sadr': ms, 'ajz': ma, 'wiki': [ws, wa],
                  'src': src, 'sharh': sharh, 'fame': res.get('count', 0)})
    print('OK' if src else '--', c['poet'], '|', ms, '*', ma, '|', src and src['book'], '| sharh' if sharh else '')
pre = [i for i in json.load(open(f'{W}/all_pre.json')) if 'الهجاء' not in i['g']]
json.dump(pre + items, open(f'{W}/all_pre.json', 'w'), ensure_ascii=False)
print('total', len(pre) + len(items), 'hija', len(items))
