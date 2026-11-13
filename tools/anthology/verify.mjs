// يزن أبيات المختارات: node verify.mjs IN.json OUT.json
import fs from 'fs';
import { analyzeVerse, setDictionary, parseDictionary } from '../../src/engine.js';
setDictionary(parseDictionary(fs.readFileSync(new URL('../../data/dict.tsv', import.meta.url), 'utf8')));
const [, , inp, outp] = process.argv;
const list = JSON.parse(fs.readFileSync(inp, 'utf8'));
const out = []; let fromWiki = 0, dropped = 0;
for (const v of list) {
  let r = analyzeVerse([v.sadr, v.ajz]);
  let use = 'merged';
  if (!r || !r.exact) {
    const r2 = v.wiki ? analyzeVerse([v.wiki[0], v.wiki[1]]) : null;
    if (r2 && r2.exact) { r = r2; use = 'wiki'; v.sadr = v.wiki[0]; v.ajz = v.wiki[1]; fromWiki++; }
  }
  if (!r || !r.exact) { dropped++; v.dropped = r ? `${r.meter} مكسور` : 'غير مفهوم'; }
  v.meter = r ? r.meter : null; v.form = r ? r.form : null; v.use = use;
  out.push(v);
}
fs.writeFileSync(outp, JSON.stringify(out, null, 0));
console.log(`total ${out.length} ok ${out.length - dropped} fromWiki ${fromWiki} dropped ${dropped}`);
const m = {}; out.filter(v => !v.dropped).forEach(v => m[v.meter] = (m[v.meter] || 0) + 1); console.log(m);
