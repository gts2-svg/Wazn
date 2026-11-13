# جمع المختارات في ملف واحد للتطبيق
import json, sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from common import key, words, strip
from lint import unknown_words, known
W = '/home/claude/ws'
BAD = ['العبد', 'العبيد', 'عبيد', 'الخصي', 'خصي', 'الاسود', 'اسود', 'كافور', 'كويفير', 'مشفر', 'امه', 'النخاس', 'الطرطبه', 'ضبه']
def offensive(v):
    t = ' ' + strip(v['sadr'] + ' ' + v['ajz']).replace('أ', 'ا').replace('ة', 'ه') + ' '
    return any(re.search(r'[\sء-ي]?' + b + r'\b', t) for b in BAD if len(b) > 3) or ' ضبه ' in t
def fix(v, has_src):
    unk = unknown_words(v)
    if not unk: return v
    wiki = v.get('wiki')
    wk = set(key(w) for w in words(wiki[0]) + words(wiki[1])) if wiki else set()
    if all(key(w) in wk for w in unk) and has_src: return v           # المصدران متفقان
    if wiki:
        alt = dict(v, sadr=wiki[0], ajz=wiki[1])
        if not unknown_words(alt) or (has_src and set(key(w) for w in unknown_words(alt)) <= set(key(w) for w in unk)):
            return alt
    return None
items = []
# ١) المختارات المنتقاة لكل غرض
for v in json.load(open(f'{W}/cur_sel.json')):
    f = fix(v, bool(v.get('src')))
    if not f: print('DROP', v['poet'], v['sadr']); continue
    items.append({'g': v['g'], 'poet': v['poet'], 'sadr': f['sadr'], 'ajz': f['ajz'], 'wiki': v['wiki'], 'poem': v['poem'],
                  'src': v.get('src'), 'sharh': v.get('sharh'), 'fame': v.get('fame', 0)})
cur_keys = set(key(i['sadr']) for i in items)
# ٢) عيون المتنبي: اختيار الصاحب بن عباد
mut = json.load(open(f'{W}/mut_fame.json'))
mut = [v for v in mut if not v.get('dropped') and not offensive(v)]
mut.sort(key=lambda v: -v.get('fame', 0))
n_hikma = 0
for v in mut:
    f = fix(v, True)
    if not f: continue
    g = ['عيون المتنبي']
    if n_hikma < 25 and key(v['sadr']) not in cur_keys: g.append('الحكمة'); n_hikma += 1
    sh = v.get('sharh')
    if sh and len(sh['text']) < 40: sh = None
    items.append({'g': g, 'poet': 'المتنبي', 'sadr': f['sadr'], 'ajz': f['ajz'], 'wiki': v['wiki'], 'poem': v['poem'],
                  'src': v['src'], 'sharh': sh, 'fame': v.get('fame', 0)})
json.dump(items, open(f'{W}/all_pre.json', 'w'), ensure_ascii=False)
print('items', len(items), 'mutanabbi', sum(1 for i in items if 'عيون المتنبي' in i['g']))
