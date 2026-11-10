// بناء قاموس التشكيل من نصوص مشكولة
// node tools/build_dict.mjs out.tsv maxKeys
import fs from 'fs';
import readline from 'readline';
import { cleanText, stripMarks, keyOf, tokenize, analyzeVocalized, bits, parseWord } from '../src/arabic.js';

const DATA = '/home/claude/data';
const out = process.argv[2] || 'dict.tsv';
const MAXK = +(process.argv[3] || 120000);

const verseKey = s => stripMarks(cleanText(s)).replace(/[^ء-ي]/g, '');
// أبيات الاختبار لا تدخل القاموس
const testKeys = new Set();
for (const line of fs.readFileSync(`${DATA}/final_baits/test.txt`, 'utf8').split('\n')) {
  const t = line.replace(/^\d+\s+/, '');
  if (t) testKeys.add(verseKey(t));
}
console.log('test verses', testKeys.size);

const counts = new Map(); // key -> Map(form -> n)
const totals = new Map();
let tok = 0, used = 0;
function addLine(text, weight = 1) {
  for (const w of tokenize(text)) {
    tok++;
    const T = parseWord(w);
    const marked = T.filter(t => t.marked).length;
    const need = T.filter((t, i) => !'اىآٱ'.includes(t.l) && !((t.l === 'و' || t.l === 'ي') && !t.marked && i > 0)).length;
    if (marked < Math.max(1, need - 1) || T.length < 2) continue;
    const an = analyzeVocalized(w);
    if (!an) continue;
    used++;
    const k = keyOf(w);
    let m = counts.get(k);
    if (!m) { m = new Map(); counts.set(k, m); }
    m.set(w, (m.get(w) || 0) + weight);
    totals.set(k, (totals.get(k) || 0) + weight);
  }
}

async function lines(file, fn) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const l of rl) fn(l);
}

await lines(`${DATA}/tashkeela_train.txt`, l => addLine(l, 3));
console.log('tashkeela done', counts.size, tok, used);
let skipped = 0;
await lines(`${DATA}/apcd/APCD_plus_porse_all.csv`, l => {
  const i = l.lastIndexOf(',');
  if (i < 0) return;
  const v = l.slice(0, i);
  if (testKeys.has(verseKey(v))) { skipped++; return; }
  addLine(v, 1);
});
console.log('apcd done', counts.size, 'skipped test-overlap', skipped);
await lines(`${DATA}/final_baits/train.txt`, l => {
  const t = l.replace(/^\d+\s+/, '');
  if (testKeys.has(verseKey(t))) return;
  addLine(t.replace('#', ' '), 1);
});
console.log('metrec train done', counts.size);

// لكل مفتاح: أكثر الصيغ تكراراً لكل نمط وزني (بغض النظر عن حركة الآخر)
const keys = [...totals.entries()].filter(([k, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, MAXK);
const outLines = [];
for (const [k] of keys) {
  const forms = [...counts.get(k).entries()].sort((a, b) => b[1] - a[1]);
  const total = forms.reduce((s, f) => s + f[1], 0);
  const groups = new Map();
  for (const [f, n] of forms) {
    const an = analyzeVocalized(f);
    const b = bits(an.units);
    const stem = (an.wasl ? 'w' : '') + b.slice(0, -1);
    const g = groups.get(stem);
    if (!g) groups.set(stem, { f, n }); else g.n += n;
  }
  const sel = [...groups.values()].sort((a, b) => b.n - a.n).filter((g, i) => i === 0 || g.n / total >= 0.06).slice(0, 4);
  // أنواع النهايات المشاهدة: n تنوين، s سكون، v حركة، m مد
  const endc = {};
  for (const [f, n] of forms) {
    const T = parseWord(f); const lt = T[T.length - 1];
    if (!lt.marked && !'اىوي'.includes(lt.l)) continue;
    const an = analyzeVocalized(f); const lu = an.units[an.units.length - 1];
    const ty = lu.k === 'n' ? 'n' : lu.k === 'm' ? 'm' : lu.b === '0' ? 's' : 'v';
    endc[ty] = (endc[ty] || 0) + n;
  }
  const et = Object.values(endc).reduce((a, b) => a + b, 0);
  const flags = et >= 10 ? Object.entries(endc).filter(([t, n]) => n / et >= 0.05).map(([t]) => t).join('') : '';
  outLines.push(k + '\t!' + (et >= 10 ? (flags || '-') : '') + '\t' + sel.map(g => g.f).join('\t'));
}
fs.writeFileSync(out, outLines.join('\n'));
console.log('wrote', outLines.length, 'keys', fs.statSync(out).size, 'bytes');
