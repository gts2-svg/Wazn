// وزن — نواة التطبيق الأصلي: محرك الوزن والذكاء الاصطناعي نفسهما اللذان في src/،
// مجموعين في ملف واحد (ios/App/JS/wazn-core.js) يشغّله التطبيق داخل JavaScriptCore.
// الواجهة كلها في Swift؛ هذا الملف يعطيها نتائج جاهزة للعرض بصيغة JSON.
// يُبنى بالأمر: node ios/core/build.mjs
import { analyzeVerse, setDictionary, parseDictionary, dictionarySize, splitVerse, checkRhymes } from '../../src/engine.js';
import { verseProblems, sym } from '../../src/explain.js';
import { METER_INFO } from '../../src/meters.js';
import { getSettings, saveSettings, hasKey, testKey, compose, regenerateVerse, suggestFix, setTransport, MODELS, PURPOSES, AIError, AUTO_FIX_LIMIT } from '../../src/ai.js';
import EXEMPLARS from '../../data/exemplars.json';
import { lastLetter, LETTERS } from '../../src/musajala.js';

/* ---------------- ما يقدّمه التطبيق (Swift) ----------------
   __native.storeGet(key) / __native.storeSet(key, value)  — حفظ الإعدادات
   __native.fetch(bodyJSON, key, done)  — طلب Anthropic؛ done(status, text, netError)
*/
const N = globalThis.__native;
globalThis.localStorage = {
  getItem: (k) => { const v = N.storeGet(k); return v == null || v === '' ? null : String(v); },
  setItem: (k, v) => N.storeSet(k, String(v)),
  removeItem: (k) => N.storeSet(k, ''),
};

setTransport((body, key) => new Promise((resolve, reject) => {
  N.fetch(JSON.stringify(body), key, (status, text, netError) => {
    if (netError) { reject(new AIError('تعذّر الاتصال. هذه الميزة تحتاج إنترنت.')); return; }
    if (status >= 200 && status < 300) {
      try { resolve(JSON.parse(text)); } catch (e) { reject(new AIError('جاء الرد بصيغة غير متوقعة. حاول مرة ثانية.')); }
      return;
    }
    let msg = '';
    try { msg = JSON.parse(text).error.message; } catch (e) {}
    const mk = (t) => { const er = new AIError(t); er.diag = `HTTP ${status}\n${msg}`; return er; };
    if (status === 401) return reject(mk('المفتاح غير صحيح. راجعه في الإعدادات.'));
    if (status === 403) return reject(mk('المفتاح لا يملك صلاحية لهذا الطلب.'));
    if (status === 404) return reject(mk('النموذج المختار غير متاح لحسابك. غيّره من الإعدادات.'));
    if (status === 429) return reject(mk('بلغت حد الطلبات أو حد الصرف. انتظر قليلاً أو راجع حدود حسابك.'));
    if (status === 529 || status >= 500) return reject(mk('خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل.'));
    if (/credit|balance/i.test(msg)) return reject(mk('رصيد الحساب لا يكفي.'));
    reject(mk('رفض الطلب: ' + (msg || status)));
  });
}));

/* ---------------- الوزن ---------------- */
let ready = false;
const store = new Map();   // نتائج الوزن الخام، لاقتراح التصحيح لاحقاً
let nextId = 1;
const keep = (r) => { const id = nextId++; store.set(id, r); if (store.size > 400) store.delete(store.keys().next().value); return id; };

function analyzeItems(items) {
  return items.map(it => {
    try {
      const r = analyzeVerse(it.parts || it.text, { autoSplit: true, meter: it.meter || null });
      return r ? { ...r, input: it } : { input: it, empty: true };
    } catch (e) {
      return { input: it, error: String(e && e.message || e) };
    }
  });
}
const check = (items) => Promise.resolve(analyzeItems(items));

// قراءة المدخل: بيت في كل سطر، أو كل شطر في سطر
function parseInput(text) {
  const lines = String(text).split(/\n+/).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = splitVerse(lines[i]);
    if (parts.length >= 2) { items.push({ text: lines[i], parts }); continue; }
    const next = lines[i + 1];
    const wc = s => s.split(/\s+/).length;
    if (next && splitVerse(next).length < 2 && wc(lines[i]) <= 6 && wc(next) <= 6) {
      items.push({ text: lines[i] + ' * ' + next, parts: [lines[i], next] });
      i++;
      continue;
    }
    items.push({ text: lines[i] });
  }
  return items;
}

function meterTitle(r) {
  const m = r.meter, f = r.form;
  if (!m) return '—';
  if (f === 'تام' || !f) return m;
  if (f === 'مخلع') return 'مخلّع ' + m;
  return f + ' ' + m;
}

function needsFix(r) {
  return !!(r && !r.error && !r.empty && !r.single && !r.joined && r.input && r.input.parts &&
    (!r.exact || (r.rhymeIssues && r.rhymeIssues.length)));
}

function hemiUI(h, label, half = 0) {
  const errWords = new Set((h.errors || []).map(e => e.word).filter(x => x != null));
  return {
    label,
    half,
    words: h.words.map((w, i) => ({ t: w.display, guess: !!w.generic, broken: errWords.has(i) })),
    feet: h.feet.map(f => ({
      text: f.text || '—',
      sym: sym(f.got),
      name: f.name || '؟',
      bad: !f.ok,
      exp: !f.ok && f.vp ? sym(f.vp) : '',
      note: f.note || '',
    })),
  };
}

// نتيجة جاهزة للعرض
function toUI(r, label = '') {
  if (!r || r.error || r.empty) {
    return { id: 0, failed: true, title: '—', message: r && r.error ? 'حدث خطأ: ' + r.error : 'لم أجد كلمات عربية في هذا السطر.', label };
  }
  const nBad = r.hemistichs.reduce((s, h) => s + h.feet.filter(f => !f.ok).length, 0);
  const nRh = (r.rhymeIssues || []).length;
  let badge, ok;
  if (r.exact && !nRh) { badge = 'موزون ✓'; ok = true; }
  else if (r.exact) { badge = 'موزون، وفي القافية عيب'; ok = false; }
  else { badge = nBad === 1 ? 'مكسور في تفعيلة' : nBad === 2 ? 'مكسور في تفعيلتين' : `مكسور في ${nBad} تفعيلات`; ok = false; }

  const notes = [];
  if (r.autoSplit) notes.push('قسّمتُ البيت إلى صدر وعجز تلقائياً.');
  if (r.madwar) notes.push('بيت مدوّر: كلمة مشتركة بين الشطرين.');
  if (r.single && !r.autoSplit) notes.push('شطر واحد. اكتب الشطر الآخر بعد * ليُوزن البيت كاملاً.');
  const guesses = r.hemistichs.flatMap(h => h.words.filter(w => w.generic)).map(w => w.display);

  let hemis;
  if (r.joined) { const h = r.hemistichs[0]; hemis = [hemiUI(h, 'البيت (الصدر ثم العجز)', h.feet.length / 2)]; }
  else if (r.single) hemis = [hemiUI(r.hemistichs[0], 'الشطر')];
  else hemis = [hemiUI(r.hemistichs[0], 'الصدر'), hemiUI(r.hemistichs[1], 'العجز')];

  const problems = verseProblems(r).map(p => ({ head: `${p.hemi}، ${p.where}`, what: p.what, can: p.can }));
  const rhymeIssues = (r.rhymeIssues || []).map(i => ({ kind: i.kind, msg: i.msg }));
  const alts = (r.alternatives || []).filter(a => a.cost - r.cost < (r.exact ? 1.2 : 4)).slice(0, 2).map(meterTitle);

  return {
    id: keep(r), failed: false, label, title: meterTitle(r), meter: r.meter || '', exact: !!r.exact,
    badge, ok, notes, guesses, hemis, problems, rhymeIssues, alts, needsFix: needsFix(r),
  };
}

function rhymeSummary(results) {
  const full = results.filter(r => r && !r.error && !r.empty && !r.single && !r.joined && r.rhymeInfo);
  if (full.length < 2) return null;
  const chk = checkRhymes(results.map(r => (r && r.rhymeInfo && !r.single && !r.joined) ? r.rhymeInfo : null));
  results.forEach((r, i) => { if (r) r.rhymeIssues = chk.issues[i]; });
  const n = chk.issues.reduce((s, x) => s + x.length, 0);
  const m = full.map(r => r.rhymeInfo.ridf);
  const a = m.filter(x => x === 'ا').length, w = m.filter(x => x === 'وي').length;
  const ridf = a > full.length / 2 ? 'مردوفة بالألف' : w > full.length / 2 ? 'مردوفة بالواو والياء' : '';
  const parts = [`الروي «${chk.rawi || '؟'}»`];
  if (chk.haraka) parts.push(chk.haraka);
  if (ridf) parts.push(ridf);
  return {
    detail: parts.join('، '),
    badge: n ? (n === 1 ? 'عيب واحد' : n + ' عيوب') : 'سليمة ✓',
    ok: !n,
    rawi: chk.rawi || '',
    haraka: chk.haraka && chk.haraka !== 'السكون' ? chk.haraka : '',
  };
}

function errJSON(e) {
  return JSON.stringify({
    message: e instanceof AIError ? e.message : 'حدث خطأ: ' + (e && e.message || e),
    diag: (e && e.diag) || '', raw: (e && e.raw) || '',
  });
}


/* ---------------- النظم ---------------- */
function composedUI(v, i) {
  if (v.result && !v.result.error && !v.result.empty) v.result.rhymeIssues = v.rhymeIssues || [];
  return { sadr: v.sadr, ajz: v.ajz, ok: !!v.ok, craft: v.craft || '', result: v.result ? toUI(v.result, `البيت ${i + 1}`) : null };
}

// أبيات الاستئناس: من الغرض نفسه، والبحر المطلوب أولاً، وبيتان على الأكثر لكل شاعر ما أمكن
const PURPOSE_POOL = { 'مدح': 'مدح', 'تهنئة': 'مدح', 'شكر': 'مدح', 'رثاء': 'رثاء', 'حكمة': 'حكمة', 'هجاء': 'هجاء', 'غزل عفيف': 'غزل' };
function pickExemplars(purpose, meter, n = 8) {
  const pool = (EXEMPLARS[PURPOSE_POOL[purpose] || 'عام'] || []).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  pool.sort((a, b) => (b.meter === meter) - (a.meter === meter));
  const out = [], per = new Map();
  for (const cap of [2, 99]) {
    for (const e of pool) {
      if (out.length >= n) break;
      if (out.includes(e) || (per.get(e.poet) || 0) >= cap) continue;
      out.push(e); per.set(e.poet, (per.get(e.poet) || 0) + 1);
    }
  }
  return out.map(e => `${e.t} (${e.poet}، ${e.meter})`);
}

/* ---------------- الواجهة التي يستدعيها Swift ---------------- */
globalThis.Wazn = {
  init(dictText) {
    setDictionary(parseDictionary(dictText));
    ready = true;
    return dictionarySize();
  },
  isReady: () => ready,

  // text: ما كتبه المستخدم → { rhyme, items }
  weigh(text) {
    const items = parseInput(text);
    const results = analyzeItems(items);
    const rhyme = rhymeSummary(results);
    const many = results.length > 1;
    return JSON.stringify({ rhyme, items: results.map((r, i) => toUI(r, many ? `البيت ${i + 1}` : '')) });
  },

  // p: { purpose, name, details, count, meter, rawi } → done(json, errJson)
  compose(pJSON, onProgress, done) {
    const p = JSON.parse(pJSON);
    p.exemplars = pickExemplars(p.purpose, p.meter);
    compose(p, check, (m) => onProgress(String(m))).then(res => {
      const verses = res.verses.map((v, i) => composedUI(v, i));
      const alternatives = (res.alternatives || []).map(a => ({ number: a.number, verses: a.verses.map((v, i) => composedUI(v, i)) }));
      done(JSON.stringify({ meter: res.meter || '', rawi: res.rawi || '', haraka: res.haraka || '', rounds: res.rounds || 0, chosen: res.chosen || 1, verdict: res.verdict || '', verses, alternatives }), null);
    }, e => done(null, errJSON(e)));
  },

  // يعيد نظم بيت واحد: poem { meter, rawi, haraka, verses:[{sadr,ajz}] }
  regenerateVerse(pJSON, poemJSON, index, onProgress, done) {
    const p = JSON.parse(pJSON);
    const poem = JSON.parse(poemJSON);
    regenerateVerse(p, poem, index, check, (m) => onProgress(String(m))).then(v => {
      done(JSON.stringify(composedUI(v, index)), null);
    }, e => done(null, errJSON(e)));
  },

  // id: رقم نتيجة الوزن، opts: { rawi, haraka }
  suggestFix(id, optsJSON, onProgress, done) {
    const r = store.get(id);
    if (!r) { done(null, JSON.stringify({ message: 'انتهت صلاحية هذه النتيجة. زِن البيت من جديد.', diag: '', raw: '' })); return; }
    const o = JSON.parse(optsJSON || '{}');
    suggestFix(r, check, (m) => onProgress(String(m)), { rhymeIssues: r.rhymeIssues, rawi: o.rawi || null, haraka: o.haraka || null }).then(good => {
      done(JSON.stringify(good.map(g => ({ sadr: g.sadr, ajz: g.ajz, note: g.note || '', title: meterTitle(g.result) }))), null);
    }, e => done(null, errJSON(e)));
  },

  testKey(onProgress, done) { testKey().then(() => done('ok', null), e => done(null, errJSON(e))); },

  settings: () => JSON.stringify(getSettings()),
  saveSettings: (json) => { saveSettings(JSON.parse(json)); },
  hasKey: () => hasKey(),
  autoFixLimit: () => AUTO_FIX_LIMIT,

  meters: () => JSON.stringify(Object.entries(METER_INFO).map(([name, i]) => ({ name, key: i.key, feet: i.feet }))),
  purposes: () => JSON.stringify(PURPOSES),
  models: () => JSON.stringify(MODELS),
  letters: () => JSON.stringify(LETTERS),
  lastLetter: (t) => lastLetter(t) || '',
};
