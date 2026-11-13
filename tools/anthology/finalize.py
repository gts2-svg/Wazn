# الخطوة الأخيرة: استبعاد ما فيه خطأ ضبط ظاهر، وتنظيف الشروح، وكتابة data/mukhtarat.json
import json, re, os
W = '/home/claude/ws'
d = json.load(open(f'{W}/all_ver.json'))
MANUAL_DROP = {1, 3, 16, 19, 20, 38}   # أبيات المختارات المنتقاة التي ظهر في ضبطها خطأ في المصدرين معاً
BAD = re.compile('إ[َُ]|أِ|ًن(?:\\s|$)|[ً-ْ]{3,}')
def clean_sharh(t):
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'-\s*[٠-٩0-9]+\s*-', ' ', t)
    t = re.sub(r'(?<=[ء-ي])[١٢٣٤٥٦٧٨٩٠]+', '', t)
    return re.sub(r'\s+', ' ', t).strip()
out, dropped = [], []
for i, v in enumerate(d):
    if v.get('dropped') or i in MANUAL_DROP or BAD.search(v['sadr'] + ' ' + v['ajz']):
        dropped.append(v['poet'] + ': ' + v['sadr']); continue
    sh = v.get('sharh')
    if sh: sh = dict(sh, text=clean_sharh(sh['text']))
    out.append({'g': v['g'], 'poet': v['poet'], 'sadr': v['sadr'], 'ajz': v['ajz'], 'meter': v['meter'],
                'poem': v.get('poem'), 'src': v.get('src'), 'sharh': sh, 'fame': v.get('fame', 0)})
meta = {'version': 1, 'built': '2026-11-13', 'groups': ['الحكمة', 'المدح', 'الرثاء', 'الهجاء', 'عيون المتنبي'],
        'note': 'نص البيت وحركاته من كتب تراث والشاملة أولاً، ويُكمَّل الضبط الناقص من دواوين ويكي مصدر؛ وكل بيت موزون آلياً.'}
json.dump({'meta': meta, 'items': out}, open('/home/claude/wazn/data/mukhtarat.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('kept', len(out), 'dropped', len(dropped))
