import fs from 'fs';
import { analyzeVerse, setDictionary, parseDictionary } from '../src/engine.js';
const LABELS = ['السريع','الكامل','المتقارب','المتدارك','المنسرح','المديد','المجتث','الرمل','البسيط','الخفيف','الطويل','الوافر','الهزج','الرجز'];
setDictionary(parseDictionary(fs.readFileSync('/home/claude/data/dict_full.tsv', 'utf8')));
const lines = fs.readFileSync('/home/claude/data/final_baits/test.txt', 'utf8').split('\n').filter(Boolean);
const mode = process.argv[2] || 'inexact'; const N = +(process.argv[3] || 15); const off = +(process.argv[4]||0);
let shown = 0;
for (let i = off; i < lines.length && shown < N; i += 20) {
  const m = lines[i].match(/^(\d+)\s+(.*)$/);
  const gold = LABELS[+m[1]];
  const r = analyzeVerse(m[2]);
  const good = r && r.meter === gold;
  if (mode === 'inexact' ? !(good && !r.exact) : good) continue;
  shown++;
  console.log(`#${i} ${gold} → ${r ? r.meter + ' ' + r.form + ' c=' + r.cost.toFixed(1) : '-'} | ${m[2]}`);
  if (!r) continue;
  for (const h of r.hemistichs) {
    console.log('   ' + h.feet.map(f => `${f.name}[${f.got}${f.ok ? '' : '≠' + f.exp}]`).join(' '));
    console.log('   ' + h.words.map(w => w.display + (w.generic ? '?' : '')).join(' '));
  }
}
