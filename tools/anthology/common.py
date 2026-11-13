# أدوات مشتركة لبناء المختارات
import re, json, glob, difflib, os
MARKS = re.compile('[ً-ْٰ]')
def strip(s): return MARKS.sub('', s)
def clean(s):
    s = s.replace('ـ', '')                 # تطويل
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\{\{[^}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^]|]*\|)?([^]]*)\]\]', r'\1', s)
    s = re.sub(r'[«»"()\[\]{}٭*0-9٠-٩]', ' ', s)
    s = re.sub(r'(^|\s)([وفبلك][َُِ]?)\s+(?=[ء-ي])', r'\1\2', s)  # «وَ كان» → «وَكان»
    s = re.sub(r'\s+', ' ', s).strip()
    return s
def norm(s):
    s = strip(clean(s))
    s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'[^ء-ي ]', '', s).strip()
def key(s): return norm(s).replace(' ', '')
def words(s): return clean(s).split(' ')

def turath_pages(d):
    out = []
    for f in sorted(glob.glob(d + '/*.json')):
        j = json.load(open(f))
        meta = json.loads(j['meta']) if isinstance(j['meta'], str) else j['meta']
        txt = j['text'].split('_________')[0]
        out.append((meta, txt, f))
    return out

def split_verses(text):
    # أبيات «صدر ... عجز» في نص تراث
    res = []
    for line in re.split(r'\n', text):
        for m in re.finditer(r'([^\n.]{6,}?)\s*\.\.\.\s*([^\n.]{6,})', line):
            res.append((m.group(1).strip(' ()-–'), m.group(2).strip(' ()-–'), m.start()))
    return res

TANW = set('\u064B\u064C\u064D'); VOW = set('\u064E\u064F\u0650'); SH = '\u0651'; SK = '\u0652'
def valid_marks(ms, last, letter=''):
    if not ms: return False
    if letter == 'إ' and ('\u064E' in ms or '\u064F' in ms): return False
    if letter == 'أ' and '\u0650' in ms: return False
    if len(ms) != len(set(ms)): return False
    v = [m for m in ms if m in VOW or m in TANW or m == SK]
    if len(v) > 1: return False
    if any(m in TANW for m in ms) and not last: return False
    if SH in ms and SK in ms: return False
    return True

def merge_marks(src, full, trusted=False):
    """حركات المصدر أولاً، ويُكمَّل الناقص من النسخة المشكولة كاملة (كلمة بكلمة).
    عند التعارض: المصدر إن كان ديواناً أو شرحاً موثوقاً، وإلا النسخة المشكولة"""
    sw, fw = words(src), words(full)
    sk, fk = [key(w) for w in sw], [key(w) for w in fw]
    sm = difflib.SequenceMatcher(None, sk, fk, autojunk=False)
    out, partial = [], False
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for a, b in zip(sw[i1:i2], fw[j1:j2]): out.append(merge_word(a, b, trusted))
        else:
            out.extend(sw[i1:i2]); partial = partial or (i2 > i1)
    return ' '.join(out), partial

def letters(w):
    toks = []
    for ch in w:
        if MARKS.match(ch):
            if toks: toks[-1][1].append(ch)
        else: toks.append([ch, []])
    return toks
def merge_word(a, b, trusted=False):
    A, B = letters(a), letters(b)
    if len(A) != len(B): return b
    o = ''
    n = len(A)
    for i, ((la, ma), (lb, mb)) in enumerate(zip(A, B)):
        last = i == n - 1
        if ma and valid_marks(ma, last, la) and (trusted or not mb or set(ma) == set(mb)):
            o += la + ''.join(ma)
        elif mb:
            o += lb + ''.join(mb)
        elif ma and valid_marks(ma, last, la):
            o += la + ''.join(ma)
        else:
            o += lb
    o = re.sub('([\u064B])(ا)[\u064B]', r'\1\2', o)
    return o
