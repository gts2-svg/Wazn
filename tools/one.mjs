import fs from 'fs';
import { analyzeVerse, setDictionary, parseDictionary } from '../src/engine.js';
setDictionary(parseDictionary(fs.readFileSync(process.env.DICT || '/home/claude/data/dict_full.tsv', 'utf8')));
for (const l of process.argv.slice(2)) {
  const r = analyzeVerse(l);
  if (!r) { console.log('NULL'); continue; }
  console.log(`${r.exact ? 'OK' : 'XX'} ${r.meter} ${r.form} c=${r.cost.toFixed(2)} ${r.autoSplit ? 'auto' : ''} | ${l}`);
  for (const h of r.hemistichs) {
    console.log('   ' + h.feet.map(f => `${f.name}[${f.got}${f.ok ? '' : '≠' + f.exp}]${f.text}`).join(' '));
    console.log('   ' + h.words.map(w => w.display + (w.generic ? '?' : '')).join(' '));
  }
  console.log('   alt: ' + r.alternatives.map(a => `${a.meter} ${a.form} ${a.cost.toFixed(2)}`).join(', '));
}
