# دواوين الفحول من مجموعة «أشعار» (arbml/Ashaar_dataset، ومصدرها موقع الديوان)
import pandas as pd, re, json, os
OUT = '/home/claude/wazn/data/diwans'
df = pd.read_pickle('/home/claude/data/ashaar/all.pkl')
POETS = [('imru', 'امرؤ القيس', 'العصر الجاهلي'), ('nabigha', 'النابغة الذبياني', 'العصر الجاهلي'), ('zuhair', 'زهير بن أبي سلمى', 'العصر الجاهلي'),
 ('asha', 'الأعشى', 'العصر الجاهلي'), ('tarafa', 'طرفة بن العبد', 'العصر الجاهلي'), ('antara', 'عنترة بن شداد', 'العصر الجاهلي'),
 ('labid', 'لبيد بن ربيعة', 'المخضرمون'), ('urwa', 'عروة بن الورد', 'العصر الجاهلي'), ('shanfara', 'الشنفرى', 'العصر الجاهلي'),
 ('hassan', 'حسان بن ثابت', 'المخضرمون'), ('kaab', 'كعب بن زهير', 'المخضرمون'), ('khansa', 'الخنساء', 'المخضرمون'), ('hutaya', 'الحطيئة', 'المخضرمون'),
 ('abudhuayb', 'أبو ذؤيب الهذلي', 'المخضرمون'), ('jarir', 'جرير', 'العصر الأموي'), ('farazdaq', 'الفرزدق', 'العصر الأموي'), ('akhtal', 'الأخطل', 'العصر الأموي'),
 ('dhurrumma', 'ذو الرمة', 'العصر الأموي'), ('umar', 'عمر بن أبي ربيعة', 'العصر الأموي'), ('jamil', 'جميل بثينة', 'العصر الأموي'),
 ('majnun', 'قيس بن الملوح', 'العصر الأموي'), ('malik', 'مالك بن الريب', 'العصر الأموي'), ('bashar', 'بشار بن برد', 'العصر العباسي'),
 ('abunuwas', 'أبو نواس', 'العصر العباسي'), ('ataahiya', 'أبو العتاهية', 'العصر العباسي'), ('abutammam', 'أبو تمام', 'العصر العباسي'),
 ('buhturi', 'البحتري', 'العصر العباسي'), ('ibnrumi', 'ابن الرومي', 'العصر العباسي'), ('ibnmutazz', 'ابن المعتز', 'العصر العباسي'),
 ('abufiras', 'أبو فراس الحمداني', 'العصر العباسي'), ('radi', 'الشريف الرضي', 'العصر العباسي'), ('mahyar', 'مهيار الديلمي', 'العصر العباسي'),
 ('maarri', 'أبو العلاء المعري', 'العصر العباسي'), ('shafii', 'الإمام الشافعي', 'العصر العباسي'), ('ibnzaydun', 'ابن زيدون', 'العصر الأندلسي'),
 ('ibnkhafaja', 'ابن خفاجة', 'العصر الأندلسي'), ('ibnhani', 'ابن هانئ الأندلسي', 'العصر الأندلسي'), ('safi', 'صفي الدين الحلي', 'العصر المملوكي'),
 ('busiri', 'البوصيري', 'العصر المملوكي')]
THEMES = {'قصيدة مدح': 'مدح', 'قصيدة هجاء': 'هجاء', 'قصيدة رثاء': 'رثاء', 'قصيدة غزل': 'غزل', 'قصيدة رومنسيه': 'غزل', 'قصيدة عتاب': 'عتاب',
          'قصيدة حزينه': 'حزن', 'قصيدة دينية': 'ديني', 'قصيدة شوق': 'شوق', 'قصيدة فراق': 'فراق', 'قصيدة ذم': 'ذم', 'قصيدة المعلقات': 'معلقة'}
def clean(s):
    s = re.sub(r'\s+', ' ', str(s).replace('\u0640', '')).strip()
    # همزة القطع المكسورة تسقط في هذه المجموعة: «ِلى» ← «إِلى»، «فَِنَّ» ← «فَإِنَّ»
    s = re.sub(r'(^|\s)\u0650', '\\1\u0625\u0650', s)
    s = re.sub(r'([\u064E\u064F\u0650\u0652])\u0650', '\\1\u0625\u0650', s)
    return s
# أسماء البحور بحسب ترقيم الصنف في بطاقة المجموعة (dataset_info: poem_meter)
METERS = ['البسيط', 'الخفيف', 'الرجز', 'الرمل', 'السريع', 'الطويل', 'الكامل', 'المتدارك', 'المتقارب', 'المجتث', 'المديد', 'المضارع', 'المقتضب', 'المنسرح', '', 'الهزج', 'الوافر']
def ratio(t):
    l = len(re.findall('[ء-ي]', t)); m = len(re.findall('[ً-ْ]', t)); return m / max(1, l)
index = json.load(open(f'{OUT}/index.json'))
for pid, name, era in POETS:
    sub = df[df['poet_name'] == name]
    poems = []
    for _, r in sub.iterrows():
        vs = [clean(x) for x in r['poem_verses']]
        if len(vs) < 2: continue
        pairs = [[vs[i], vs[i + 1]] for i in range(0, len(vs) - 1, 2)]
        m = r['poem_meter']
        m = METERS[int(m)] if isinstance(m, (int, float)) and m == m and 0 <= int(m) < len(METERS) else ''
        poems.append({'t': clean(r['poem_title']), 'm': m, 'th': THEMES.get(r['poem_theme'], ''), 'v': pairs})
    if not poems: print('NONE', name); continue
    allt = ' '.join(x for p in poems[:60] for v in p['v'] for x in v)
    rt = ratio(allt)
    note = 'الضبط من المصدر، وهو ناقص في هذا الديوان.' if rt < 0.4 else ''
    d = {'id': pid, 'name': 'ديوان ' + name, 'poet': name, 'era': era, 'kind': 'diwan', 'note': note,
         'src': {'name': 'مجموعة «أشعار» (موقع الديوان)', 'url': 'https://huggingface.co/datasets/arbml/Ashaar_dataset'}, 'poems': poems}
    json.dump(d, open(f'{OUT}/{pid}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    meta = {k: d[k] for k in ('id', 'name', 'poet', 'era', 'kind', 'src', 'note')}
    meta.update({'poems': len(poems), 'verses': sum(len(p['v']) for p in poems), 'sections': None, 'tashkeel': round(rt, 2)})
    index = [x for x in index if x['id'] != pid] + [meta]
    print(pid, len(poems), meta['verses'], round(rt, 2), os.path.getsize(f'{OUT}/{pid}.json') // 1024, 'KB')
ORDER = ['العصر الجاهلي', 'المخضرمون', 'العصر الأموي', 'العصر العباسي', 'العصر الأندلسي', 'العصر المملوكي']
index.sort(key=lambda x: (x['kind'] != 'anthology', ORDER.index(x['era']) if x['era'] in ORDER else 9))
json.dump(index, open(f'{OUT}/index.json', 'w'), ensure_ascii=False)
print('total diwans', len(index), 'verses', sum(x['verses'] for x in index))
