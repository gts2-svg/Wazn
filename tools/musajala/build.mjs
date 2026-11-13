// وزن — فهرس المساجلة: أبيات مرتبة بأول حرف، مع رويّها
// المصادر: المختارات كلها، ومطالع قصائد الدواوين (٧ أبيات فأكثر، وكل مقطوعات الحماسة)
import fs from 'fs';
import { lastLetter } from '../../src/musajala.js';
const ROOT = new URL('../../', import.meta.url).pathname;
const MARK = /[ً-ْٰـ]/g;
export const letterOf = (c) => ('أإآاٱءى'.includes(c) ? 'ا' : c === 'ة' ? 'ت' : c);
const first = (s) => { const m = String(s).replace(MARK, '').match(/[ء-يٱ]/); return m ? letterOf(m[0]) : null; };
const last = (a) => lastLetter(a);
const key = (s) => s.replace(MARK, '').replace(/[^ء-ي]/g, '');
const out = [], seen = new Set();
function add(o) {
  const k = key(o.s + o.a);
  if (!k || seen.has(k)) return;
  const f = first(o.s), l = last(o.a);
  if (!f || !l) return;
  seen.add(k);
  out.push({ ...o, f, l });
}
const mk = JSON.parse(fs.readFileSync(ROOT + 'data/mukhtarat.json', 'utf8'));
for (const it of mk.items) add({ s: it.sadr, a: it.ajz, p: it.poet, m: it.meter || '', x: 1 });
const ix = JSON.parse(fs.readFileSync(ROOT + 'data/diwans/index.json', 'utf8'));
for (const d of ix) {
  const D = JSON.parse(fs.readFileSync(ROOT + `data/diwans/${d.id}.json`, 'utf8'));
  D.poems.forEach((p, i) => {
    if (d.id !== 'hamasa' && p.v.length < 7) return;
    const v = p.v[0];
    if (!v || !v[0] || !v[1]) return;
    add({ s: v[0], a: v[1], p: d.kind === 'anthology' ? p.poet : d.poet, m: p.m || '', d: d.id, i });
  });
}
// الحروف القليلة في المطالع تُكمَّل من حشو القصائد حتى ٢٠٠ بيت، من الدواوين التامة الضبط
const by = {};
for (const o of out) by[o.f] = (by[o.f] || 0) + 1;
const MIN = 200;
for (const d of ix) {
  if (d.note || d.id === 'hamasa') continue;
  const D = JSON.parse(fs.readFileSync(ROOT + `data/diwans/${d.id}.json`, 'utf8'));
  D.poems.forEach((p, i) => {
    if (p.v.length < 7) return;
    p.v.forEach((v, k) => {
      if (!k || !v[0] || !v[1]) return;
      const f = first(v[0]);
      if (!f || (by[f] || 0) >= MIN) return;
      const n = out.length;
      add({ s: v[0], a: v[1], p: d.poet, m: p.m || '', d: d.id, i, k });
      if (out.length > n) by[f] = (by[f] || 0) + 1;
    });
  });
}
fs.writeFileSync(ROOT + 'data/musajala.json', JSON.stringify({ meta: { built: new Date().toISOString().slice(0, 10), count: out.length }, items: out }));
console.log(out.length, 'verses', (fs.statSync(ROOT + 'data/musajala.json').size / 1e6).toFixed(2) + 'MB');
console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + v).join(' '));
