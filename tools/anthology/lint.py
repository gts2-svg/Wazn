# فحص الكلمات: كلمة غير معروفة في القاموس = خطأ محتمل في النسخة
import json, sys, re, os
sys.path.insert(0, os.path.dirname(__file__))
from common import strip, words
D = set(l.split('\t', 1)[0] for l in open('/home/claude/wazn/data/dict.tsv', encoding='utf-8'))
def ek(w): return strip(w).replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ٱ','ا').replace('ى','ي').replace('ة','ه')
PRE = ['', 'و', 'ف', 'ب', 'ل', 'ك', 'ال', 'وال', 'فال', 'بال', 'كال', 'لل', 'وب', 'ول', 'فل', 'ا']
SUF = ['', 'ه', 'ها', 'هم', 'هما', 'هن', 'ك', 'كم', 'ي', 'نا', 'ني', 'ا', 'وا', 'ون', 'ين', 'ان', 'ات', 'ت', 'تم']
def known(w):
    k = re.sub('[^ء-ي]', '', ek(w))
    if len(k) <= 3: return True
    for p in PRE:
        if not k.startswith(p): continue
        r = k[len(p):]
        for s in SUF:
            if s and not r.endswith(s): continue
            b = r[:len(r) - len(s)] if s else r
            if len(b) >= 2 and (b in D or ('ال' + b) in D or (b + 'ه') in D): return True
    return False
def unknown_words(v): return [w for w in words(v['sadr']) + words(v['ajz']) if not known(w)]
if __name__ == '__main__':
    d = json.load(open(sys.argv[1]))
    for v in d: v['unknown'] = unknown_words(v)
    json.dump(d, open(sys.argv[2], 'w'), ensure_ascii=False)
    print('with unknown words:', sum(1 for v in d if v['unknown']), 'of', len(d))
    for v in [v for v in d if v['unknown']][:12]: print(' ', v['unknown'], '|', v['sadr'], '*', v['ajz'])
