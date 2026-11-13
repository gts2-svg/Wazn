# قراءة قصائد ويكي مصدر: python3 parse_wikisource.py DIR POET OUT.json
import sys, re, json, glob
sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import clean, key
d, poet, out = sys.argv[1], sys.argv[2], sys.argv[3]
poems = []
for f in sorted(glob.glob(d + '/*.txt')):
    raw = open(f, encoding='utf-8').read()
    title = raw.split('\n', 1)[0].replace('### ', '').strip()
    verses = []
    for m in re.finditer(r'\{\{أبيات\|(.*?)\}\}', raw, re.S):
        for line in m.group(1).split('\n'):
            if '\\\\' not in line: continue
            s, a = line.split('\\\\', 1)
            s, a = clean(s), clean(a.split('\\\\')[0])
            if len(s) > 3 and len(a) > 3: verses.append([s, a])
    if verses: poems.append({'title': title, 'poet': poet, 'verses': verses})
json.dump(poems, open(out, 'w'), ensure_ascii=False)
print(len(poems), 'poems', sum(len(p['verses']) for p in poems), 'verses')
