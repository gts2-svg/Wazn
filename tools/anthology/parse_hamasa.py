# الحماسة لأبي تمام من شرح التبريزي (تراث 6907): الأبواب والقصائد والأبيات وشرح كل بيت
import json, glob, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import clean
W = '/home/claude/ws'
BAB = [(1, 'باب الحماسة'), (309, 'باب المراثي'), (449, 'باب الأدب'), (506, 'باب النسيب'), (620, 'باب الهجاء'),
       (666, 'باب الأضياف والمديح'), (827, 'باب الصفات'), (831, 'باب السير والنعاس'), (841, 'باب الملح'), (860, 'باب مذمة النساء')]
def bab_of(p):
    b = BAB[0][1]
    for s, n in BAB:
        if p >= s: b = n
    return b
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
poems, cur = [], None
fs = sorted(glob.glob(f'{W}/turath/hamasa/*.json'))
for pi, f in enumerate(fs, 1):
    j = json.load(open(f)); t = j['text'].split('_________')[0]
    meta = j['meta'] if isinstance(j['meta'], dict) else json.loads(j['meta'])
    t = re.sub(r'<span data-type="title"[^>]*>(.*?)</span>', lambda m: '\n@@P ' + re.sub('<[^>]+>', '', m.group(1)) + '\n', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    parts = re.split(r'\n\s*ـ{2,}\s*\n', t, maxsplit=1)
    vpart, spart = parts[0], parts[1] if len(parts) > 1 else ''
    page_verses = []
    for m in re.finditer(r'@@P ([^\n]+)|(?:([٠-٩0-9]+)\s*-\s*)?\(([^()]{4,}?)\s*\.\.\.\s*([^()]{4,}?)\)', vpart):
        if m.group(1):
            title = m.group(1).strip()
            if title.startswith('الجزء'): continue
            cur = {'bab': bab_of(pi), 'title': title, 'verses': [], 'page': meta.get('page_id')}
            poems.append(cur); continue
        if cur is None:
            cur = {'bab': bab_of(pi), 'title': '', 'verses': [], 'page': meta.get('page_id')}; poems.append(cur)
        n = int(m.group(2).translate(AR)) if m.group(2) else len(cur['verses']) + 1
        v = {'s': clean(m.group(3)), 'a': clean(m.group(4)), 'n': n, 'sh': '', 'pg': meta.get('page_id')}
        cur['verses'].append(v); page_verses.append(v)
    for m in re.finditer(r'(?:^|\n)\s*([٠-٩0-9]+)\s*-\s*(.+?)(?=\n\s*[٠-٩0-9]+\s*-|\Z)', spart, re.S):
        n = int(m.group(1).translate(AR)); txt = re.sub(r'\s+', ' ', m.group(2)).strip()
        for v in reversed(page_verses):
            if v['n'] == n and not v['sh']: v['sh'] = txt; break
poems = [p for p in poems if p['verses']]
from common import norm
def content(w): return set(x for x in norm(w).split() if len(x) >= 4)
prev = ''
for p in poems:
    t = re.sub(r'^\s*(?:و\s*)?قَ?ا?لَ?\s*', '', norm(p['title'])).strip()
    t = re.sub(r'^(وقال|قال)\s*', '', t)
    if not t or t.startswith('ايضا') or t in ('اخر', 'الاخر', 'غيره'):
        p['poet'] = prev if t.startswith('ايضا') else (p['title'] and re.sub(r'^(وَ?قَالَ|وقال|قال)\s*', '', p['title']).strip()) or 'شاعر'
    else:
        p['poet'] = re.sub(r'^(وَ?قَالَ|وقال|قال)\s*', '', p['title']).strip()
    p['poet'] = re.sub(r'\s*(أَيْضا|ايضا)$', '', p['poet']).strip() or prev
    prev = p['poet']
    for v in p['verses']:
        if v['sh'] and not (content(v['s'] + ' ' + v['a']) & content(v['sh'])): v['sh'] = ''
json.dump(poems, open(f'{W}/hamasa.json', 'w'), ensure_ascii=False)
from collections import Counter
print(len(poems), 'poems', sum(len(p['verses']) for p in poems), 'verses', sum(1 for p in poems for v in p['verses'] if v['sh']), 'with sharh')
print(Counter(p['bab'] for p in poems))
p = poems[5]; print(p['title'], '|', p['verses'][0]['s'], '*', p['verses'][0]['a'], '|', p['verses'][0]['sh'][:120])
