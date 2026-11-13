// يكتب ملفات الدواوين للتطبيق، ويحسب بحر كل قصيدة بالمحرك
import fs from 'fs';
import { analyzeVerse, setDictionary, parseDictionary } from '../../src/engine.js';
setDictionary(parseDictionary(fs.readFileSync(new URL('../../data/dict.tsv', import.meta.url), 'utf8')));
const W = '/home/claude/ws', OUT = new URL('../../data/diwans/', import.meta.url).pathname;
function meterOf(verses) {
  const c = {};
  for (const v of verses.slice(0, 4)) { const r = analyzeVerse([v[0], v[1]]); if (r && r.exact) c[r.meter] = (c[r.meter] || 0) + 1; }
  const e = Object.entries(c).sort((a, b) => b[1] - a[1]);
  return e.length ? e[0][0] : '';
}
// شرح الواحدي يُطابَق آلياً، فما وقع في صفحة بعيدة عن صفحات القصيدة فهو لبيت آخر ويُحذف
function saneSharh(vs) {
  const pgs = vs.filter(v => v[3]).map(v => v[3]).sort((a, b) => a - b);
  if (!pgs.length) return vs;
  const med = pgs[Math.floor(pgs.length / 2)];
  let drop = 0;
  const out = vs.map(v => (v[3] && Math.abs(v[3] - med) > Math.max(3, Math.ceil(vs.length / 6))) ? (drop++, [v[0], v[1]]) : v);
  saneSharh.dropped = (saneSharh.dropped || 0) + drop;
  return out;
}
const index = fs.existsSync(OUT + 'index.json') ? JSON.parse(fs.readFileSync(OUT + 'index.json', 'utf8')) : [];
function save(d) {
  fs.writeFileSync(OUT + d.id + '.json', JSON.stringify(d));
  const meta = { id: d.id, name: d.name, poet: d.poet, era: d.era, kind: d.kind, src: d.src, note: d.note || '',
    poems: d.poems.length, verses: d.poems.reduce((s, p) => s + p.v.length, 0), sections: d.sections || null, tashkeel: d.tashkeel ?? null };
  const i = index.findIndex(x => x.id === d.id); if (i >= 0) index[i] = meta; else index.push(meta);
  console.log(d.id, meta.poems, 'poems', meta.verses, 'verses');
}
// اسم الشاعر في الحماسة بلا «قال» ولا «تقدّمت ترجمته»، مع تجاوز الحركات
const rx = (w) => [...w].map(c => c === ' ' ? '\\s+' : c + '[\\u064B-\\u0652]*').join('');
const cleanPoet = (s) => String(s || '').replace(new RegExp('^\\s*(?:[وف][\\u064B-\\u0652]*)?' + rx('قال') + '\\s*'), '')
  .replace(new RegExp('\\s*' + rx('تقدمت ترجمته') + '.*$'), '').replace(/[\s،,:]+$/, '').trim();
const which = process.argv.slice(2);
if (!which.length || which.includes('mutanabbi')) {
  const p = JSON.parse(fs.readFileSync(W + '/mut_full.json', 'utf8'));
  save({ id: 'mutanabbi', name: 'ديوان المتنبي', poet: 'المتنبي', era: 'العصر العباسي', kind: 'diwan',
    src: { name: 'ويكي مصدر', url: 'https://ar.wikisource.org/wiki/مؤلف:المتنبي' },
    sharhBook: { name: 'شرح ديوان المتنبي للواحدي', url: 'https://app.turath.io/book/754?page=' },
    poems: p.map(x => ({ t: x.title, m: meterOf(x.v), v: saneSharh(x.v) })) });
}
if (!which.length || which.includes('hamasa')) {
  const p = JSON.parse(fs.readFileSync(W + '/hamasa.json', 'utf8'));
  const sections = [...new Set(p.map(x => x.bab))];
  save({ id: 'hamasa', name: 'ديوان الحماسة', poet: 'اختيار أبي تمام', era: 'العصر العباسي', kind: 'anthology', sections,
    note: 'نص الأبيات كما في شرح التبريزي (تراث)، وهو قليل التشكيل في الأصل.',
    src: { name: 'شرح ديوان الحماسة للتبريزي', url: 'https://app.turath.io/book/6907?page=' },
    sharhBook: { name: 'شرح ديوان الحماسة للتبريزي', url: 'https://app.turath.io/book/6907?page=' },
    poems: p.map(x => { const poet = (c => (!c || c === 'آخر') ? 'شاعر آخر' : c)(cleanPoet(x.poet)); return { t: poet, poet, sec: x.bab, pg: x.page, m: meterOf(x.verses.map(v => [v.s, v.a])),
      v: x.verses.map(v => v.sh ? [v.s, v.a, v.sh, v.pg] : [v.s, v.a]) }; }) });
}
fs.writeFileSync(OUT + 'index.json', JSON.stringify(index));
console.log('sharh dropped', saneSharh.dropped || 0);
