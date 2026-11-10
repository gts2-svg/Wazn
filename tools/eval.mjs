// قياس الدقة على أبيات MetRec للاختبار (لم تدخل القاموس)
import fs from 'fs';
import { analyzeVerse, setDictionary, parseDictionary } from '../src/engine.js';
const LABELS = ['السريع','الكامل','المتقارب','المتدارك','المنسرح','المديد','المجتث','الرمل','البسيط','الخفيف','الطويل','الوافر','الهزج','الرجز'];
const dictFile = process.argv[2] || '/home/claude/data/dict_full.tsv';
const N = +(process.argv[3] || 500);
const offset = +(process.argv[4] || 0);
const step = +(process.argv[5] || 1);
setDictionary(parseDictionary(fs.readFileSync(dictFile, 'utf8')));
const lines = fs.readFileSync('/home/claude/data/final_baits/test.txt', 'utf8').split('\n').filter(Boolean);
let ok = 0, exact = 0, n = 0, t0 = Date.now();
const conf = {};
const fails = [];
for (let i = offset; i < lines.length && n < N; i += step) {
  const m = lines[i].match(/^(\d+)\s+(.*)$/);
  const gold = LABELS[+m[1]];
  const r = analyzeVerse(m[2]);
  n++;
  const pred = r ? r.meter : 'لا شيء';
  if (pred === gold) { ok++; if (r.exact) exact++; }
  else { conf[gold + '→' + pred] = (conf[gold + '→' + pred] || 0) + 1; fails.push(`${gold}→${pred}${r && r.exact ? '(تام)' : ''} | ${m[2]}`); }
}
const sec = (Date.now() - t0) / 1000;
console.log(`n=${n} acc=${(100 * ok / n).toFixed(1)}% exact-correct=${(100 * exact / n).toFixed(1)}% time/verse=${(1000 * sec / n).toFixed(0)}ms`);
console.log(Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 15).map(x => x.join(':')).join('  '));
fs.writeFileSync('/home/claude/data/fails.txt', fails.join('\n'));
