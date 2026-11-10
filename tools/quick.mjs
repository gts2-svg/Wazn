import { analyzeVerse } from '../src/engine.js';
import { METER_INFO } from '../src/meters.js';
const lines = process.argv.slice(2).length ? process.argv.slice(2) : Object.entries(METER_INFO).map(([m, i]) => i.key + ' * ' + i.key);
for (const l of lines) {
  const t = Date.now();
  const r = analyzeVerse(l);
  if (!r) { console.log('NULL', l); continue; }
  const h = r.hemistichs[0];
  console.log((r.exact ? 'OK ' : 'XX ') + r.meter + ' ' + r.form + ' c=' + r.cost.toFixed(2) + ' ' + (Date.now() - t) + 'ms | ' + l.split('*')[0]);
  console.log('    ' + h.feet.map(f => f.name + '[' + f.got + ']').join(' ') + ' | ' + h.words.map(w => w.display).join(' '));
  if (r.alternatives[0]) console.log('    alt: ' + r.alternatives.slice(0,2).map(a => a.meter + ' ' + a.form + ' ' + a.cost.toFixed(2)).join(', '));
}
