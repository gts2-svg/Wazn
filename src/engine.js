// وزن — المحرك العروضي
// يحوّل البيت إلى متحركات وسواكن، ويطابقه على صور البحور، ويحدد موضع الكسر
import {
  FATHA, DAMMA, KASRA, SUKUN, SHADDA, DAMMATAN,
  cleanText, stripMarks, keyOf, parseWord, tokenize, analyzeVocalized, endTypeOf, bits, ishbaaText, userFullyMarked,
  SHAMSI,
} from './arabic.js';
import { FORMS } from './meters.js';

const E = 5;          // كلفة الخطأ الواحد (زيادة أو نقص أو إبدال)
const PRUNE = 8;    // حد التقليم
const HEUR_BASE = 1.6; // كلفة التشكيل التقديري للكلمة غير الموجودة في القاموس

// كلمات تُكتب بخلاف نطقها
const SPECIAL = {
  'هذا': ['هَاذَا'], 'هذه': ['هَاذِهِ', 'هَاذِهِي'], 'هذي': ['هَاذِي'], 'هذان': ['هَاذَانِ'], 'هذين': ['هَاذَيْنِ'],
  'هولاء': ['هَاؤُلَاءِ'], 'ذلك': ['ذَالِكَ'], 'ذلكم': ['ذَالِكُمْ', 'ذَالِكُمُو'], 'ذلكما': ['ذَالِكُمَا'],
  'لكن': ['لَاكِنْ', 'لَاكِنَّ'], 'لكنه': ['لَاكِنَّهُ', 'لَاكِنَّهُو'], 'لكنها': ['لَاكِنَّهَا'], 'لكنهم': ['لَاكِنَّهُمْ', 'لَاكِنَّهُمُو'],
  'لكنني': ['لَاكِنَّنِي'], 'لكني': ['لَاكِنِّي'], 'لكنما': ['لَاكِنَّمَا'], 'لكننا': ['لَاكِنَّنَا'],
  'هكذا': ['هَاكَذَا'], 'الرحمن': ['اَلرَّحْمَانِ'], 'رحمن': ['رَحْمَانُ'], 'الاله': ['اَلْإِلَاهُ'], 'اله': ['إِلَاهُ', 'إِلَهُ'],
  'الهي': ['إِلَاهِي'], 'الهنا': ['إِلَاهَنَا'], 'اولئك': ['أُلَائِكَ'], 'اولاء': ['أُلَاءِ'], 'اولو': ['أُلُو'], 'اولي': ['أُلِي'],
  'اولات': ['أُلَاتُ'], 'عمرو': ['عَمْرُ', 'عَمْرٌ'], 'طه': ['طَاهَا'], 'داود': ['دَاوُودُ'], 'طاوس': ['طَاوُوسُ'], 'ماية': ['مِئَةٌ', 'مِئَةُ'],
  'لله': ['لِلَّهِ'], 'الله': ['اللَّهُ', 'اللَّهِ'], 'اللهم': ['اللَّهُمَّ'], 'كذلك': ['كَذَالِكَ'], 'لذلك': ['لِذَالِكَ'], 'بذلك': ['بِذَالِكَ'],
  'انا': ['أَنَا', 'أَنَ'], 'لانا': ['لِأَنَّا'],
};

// حروف الجر والعطف الملتصقة
const PROCLITICS = [
  ['و', 'وَ'], ['ف', 'فَ'], ['ب', 'بِ'], ['ل', 'لِ'], ['ك', 'كَ'], ['س', 'سَ'],
  ['وب', 'وَبِ'], ['ول', 'وَلِ'], ['فب', 'فَبِ'], ['فل', 'فَلِ'], ['وك', 'وَكَ'], ['فك', 'فَكَ'], ['وس', 'وَسَ'], ['فس', 'فَسَ'],
  ['ا', 'أَ'], ['او', 'أَوَ'], ['اف', 'أَفَ'], ['اب', 'أَبِ'],
];

let DICT = new Map();
export function setDictionary(map) { DICT = map; }
export function dictionarySize() { return DICT.size; }

// تحميل القاموس من النص: كل سطر «مفتاح<TAB>صيغة<TAB>صيغة…»
export function parseDictionary(text) {
  const m = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const parts = line.split('\t');
    const forms = parts.slice(1);
    if (forms[0] && forms[0][0] === '!') { const fl = forms.shift().slice(1); forms.flags = fl || null; }
    m.set(parts[0], forms);
  }
  return m;
}

/* ----------------------------- المرشحات ----------------------------- */

function mkCand(an, cost, display, src, generic = false, form = null) {
  return { units: an.units, wasl: an.wasl, endType: endTypeOf(an.units), cost, display, form: form || display, src, generic, bits: bits(an.units) };
}

function lastLetter(w) { const s = stripMarks(w); return s[s.length - 1]; }

// صور نهاية الكلمة: الإعراب يتغير بحسب السياق، فنجرّب البدائل
function endingVariants(c, word, extra = 0.4, flags = null) {
  const cost = (t, base = extra) => (flags && !flags.includes(t)) ? Math.max(base, 1.05) : base;
  const out = [c];
  const U = c.units, n = U.length;
  const last = U[n - 1];
  const defin = /^(ال|وال|فال|بال|كال|لل)/.test(keyOf(word));
  const ll = lastLetter(word);
  const push = (units, dc, tag) => {
    if (!units.length || units[0].b === '0') return;
    const b = units.map(x => x.b).join('');
    if (/00/.test(b.slice(0, -1))) return;
    out.push({ ...c, units, endType: endTypeOf(units), cost: c.cost + dc, bits: b, display: c.display, src: c.src + tag });
  };
  if (last.b === '1' && last.k !== 'w') {
    // تنوين
    if (!defin && n >= 2 && !'اىوي'.includes(ll)) push([...U, { b: '0', t: 'نْ', k: 'n' }], cost('n'), '+ن');
    // تسكين
    if (n >= 2 && U[n - 2].b === '1') push([...U.slice(0, -1), { b: '0', t: stripMarks(last.t) + SUKUN, k: 'c' }], cost('s'), '+سكون');
    // تسكين القافية بعد المد: الجنانْ (آخر الشطر فقط)
    if (n >= 3 && U[n - 2].b === '0' && U[n - 2].k === 'm') {
      const units = [...U.slice(0, -1), { b: '0', t: stripMarks(last.t) + SUKUN, k: 'c' }];
      out.push({ ...c, units, endType: 'c', cost: c.cost + 0.2, bits: bits(units), src: c.src + '+وقف', endOnly: true });
    }
    // إشباع هاء الضمير وميم الجمع
    if ((ll === 'ه' || ll === 'م') && n >= 2) push([...U, { b: '0', t: ishbaaText(last), k: 'm' }], ll === 'ه' ? 0.12 : 0.25, '+إشباع');
  } else if (last.k === 'm' && ll === 'ي' && n >= 3 && U[n - 2].b === '1') {
    push([...U.slice(0, -1), { b: '1', t: 'يَ', k: 'c' }], extra, '+فتح الياء');
  } else if (last.k === 'n') {
    push(U.slice(0, -1), cost('v'), '-تنوين');
  } else if (last.k === 'c' && last.b === '0' && n >= 2 && U[n - 2].b === '1') {
    push([...U.slice(0, -1), { b: '1', t: stripMarks(last.t) + KASRA, k: 'c' }], cost('v'), '+حركة');
  }
  return out;
}

function formsToCands(forms, baseCost, src) {
  const out = [];
  forms.forEach((f, i) => {
    const an = analyzeVocalized(f, { lenient: true });
    if (!an) return;
    const c = mkCand(an, baseCost + i * 0.15, f, src);
    c.flags = forms.flags !== undefined ? forms.flags : (src === 'خاص' ? 'x' : null);
    out.push(c);
  });
  return out;
}

// تشكيل تقديري لكلمة غير معروفة: كل حرف متحرك أو ساكن أو مشدد
function heuristicCands(skel, limit = 70) {
  const L = [...skel];
  const n = L.length;
  const results = [];
  const startArticle = n >= 4 && (L[0] === 'ا') && L[1] === 'ل';

  function rec(i, acc, cost) {
    if (cost > HEUR_BASE + 2.2) return;
    if (i === n) { results.push([acc, cost]); return; }
    const l = L[i];
    const last = i === n - 1;
    if (i === 0) {
      if (startArticle) {
        if (SHAMSI.has(L[2]) && L[2] !== 'ل') {
          rec(3, 'ال' + L[2] + SHADDA + FATHA, cost);
        }
        rec(2, 'ال' + SUKUN, cost + (SHAMSI.has(L[2]) ? 0.6 : 0));
        rec(1, 'أَ', cost + 0.9);
        return;
      }
      if (l === 'ا') { rec(1, 'أَ', cost + 0.05); rec(1, 'ا', cost + 0.5); return; }
      if ('آ'.includes(l)) { rec(1, 'آ', cost); return; }
      rec(1, l + FATHA, cost);
      return;
    }
    if (l === 'ا' || l === 'ى') {
      if (last && l === 'ا' && L[i - 1] === 'و') { rec(i + 1, acc + 'ا', cost); return; }
      if (l === 'ا' && i <= 2 && !last && L.slice(0, i).every(x => 'وفبكل'.includes(x))) {
        if (L[i + 1] === 'ل' && i + 2 < n) {
          if (SHAMSI.has(L[i + 2]) && L[i + 2] !== 'ل') rec(i + 3, acc + 'ال' + L[i + 2] + SHADDA + FATHA, cost);
          rec(i + 2, acc + 'ال' + SUKUN, cost + (SHAMSI.has(L[i + 2]) ? 0.6 : 0));
        }
        rec(i + 1, acc + 'ا' + KASRA, cost + 0.3);  // همزة وصل: وَاسْتَوْدَعُوا
        rec(i + 1, acc + 'ا', cost + 0.2);
        return;
      }
      rec(i + 1, acc + l, cost);
      return;
    }
    if (l === 'آ') { rec(i + 1, acc + 'آ', cost); return; }
    if (l === 'و' || l === 'ي') {
      const accM = acc.endsWith(FATHA) ? acc.slice(0, -1) + (l === 'و' ? DAMMA : KASRA) : acc;
      rec(i + 1, accM + l, cost + 0.05);             // حرف مد
      if (acc.endsWith(FATHA)) rec(i + 1, acc + l + SUKUN, cost + 0.25); // لين: بَيْت
      rec(i + 1, acc + l + FATHA, cost + 0.15);
      if (!last) rec(i + 1, acc + l + SHADDA + FATHA, cost + 0.8);
      if (last) rec(i + 1, acc + l + SHADDA + FATHA, cost + 0.9);
      return;
    }
    if (last) {
      rec(i + 1, acc + l + FATHA, cost);
      rec(i + 1, acc + l + SUKUN, cost + 0.35);
      if (l !== 'ه' || L[i - 1] === 'ا') rec(i + 1, acc + l + DAMMATAN, cost + 0.4);
      return;
    }
    rec(i + 1, acc + l + FATHA, cost);
    rec(i + 1, acc + l + SUKUN, cost + 0.2);
    rec(i + 1, acc + l + SHADDA + FATHA, cost + 0.75);
  }
  rec(0, '', HEUR_BASE);

  const seen = new Map();
  for (const [form, cost] of results) {
    const an = analyzeVocalized(form, { lenient: true });
    if (!an) continue;
    const b = bits(an.units);
    const endOnly = /00$/.test(b);
    if (/00/.test(endOnly ? b.slice(0, -1) : b) || /11111/.test(b)) continue;
    const c4 = (b.match(/1111/g) || []).length;
    const c3 = (b.match(/111/g) || []).length;
    const cc = cost + c4 * 0.4 + c3 * 0.1;
    const k = b + '|' + an.wasl + '|' + endTypeOf(an.units);
    if (!seen.has(k) || seen.get(k).cost > cc) {
      const display = form.replace(new RegExp(FATHA, 'g'), '');
      const cand = mkCand(an, cc + (endOnly ? 0.3 : 0), display, 'تقدير', true, form);
      if (endOnly) cand.endOnly = true;
      seen.set(k, cand);
    }
  }
  const list = [...seen.values()].sort((a, b) => a.cost - b.cost).slice(0, limit);
  const ll = L[n - 1];
  if (ll === 'ه' || ll === 'م') {
    for (const c of list.slice()) {
      const U = c.units;
      if (U[U.length - 1].b === '1' && U.length >= 2) {
        const units = [...U, { b: '0', t: ishbaaText(U[U.length - 1]), k: 'm' }];
        list.push({ ...c, units, endType: 'm', bits: c.bits + '0', cost: c.cost + 0.15 });
      }
    }
  }
  return list;
}

function markClass(t) {
  if (!t) return null;
  if (t.sh) return 'SH';
  if (t.tn) return 'T';
  if (t.su) return 'S';
  if (t.v) return 'V';
  return null;
}

// هل يتفق المرشح مع ما وضعه المستخدم من حركات؟ (الحرف الأخير يُفحص على حدة)
function compatible(userTok, candWord) {
  const C = parseWord(candWord);
  if (C.length !== userTok.length) return true;
  for (let i = 0; i < userTok.length - 1; i++) {
    const uc = markClass(userTok[i]);
    if (!uc) continue;
    const cc = markClass(C[i]);
    if (cc === uc) continue;
    if (uc === 'V' && (cc === 'SH' || cc === 'T')) continue;   // أغفل الشدة
    if (uc === 'S' && cc === null) continue;
    if (cc === null && 'اىوي'.includes(C[i].l)) continue;
    return false;
  }
  return true;
}

// ما كتبه المستخدم على الحرف الأخير يُلزِم نوع النهاية
function endCompatible(userTok, c) {
  const t = userTok[userTok.length - 1];
  const last = c.units[c.units.length - 1];
  if (!t || !t.marked || 'اىوي'.includes(t.l)) return true;
  if (t.tn) return last.k === 'n';
  if (t.su) return last.b === '0' && last.k !== 'n' && last.k !== 'm';
  if (t.v) return last.b === '1' || last.k === 'm';
  return true;
}

// عرض التشكيل: حركات المستخدم أولاً ثم حركات المرشح
function mergeDisplay(userWord, candWord) {
  const U = parseWord(userWord), C = parseWord(candWord);
  if (U.length !== C.length || !U.some(t => t.marked)) return candWord;
  let o = '';
  for (let i = 0; i < U.length; i++) {
    const marks = U[i].marked ? U[i].m : C[i].m;
    o += (U[i].l) + marks.join('');
  }
  return o;
}

function skeletonPenalty(userWord, candWord) {
  const a = stripMarks(userWord), b = stripMarks(candWord);
  if (a === b || a.length !== b.length) return 0;
  let p = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if ('ىي'.includes(a[i]) && 'ىي'.includes(b[i])) p += i === a.length - 1 ? 1.3 : 0.6;
    else if ('ةه'.includes(a[i]) && 'ةه'.includes(b[i])) p += 0.6;
    else if ('اأإآ'.includes(a[i]) && 'اأإآ'.includes(b[i])) p += a[i] === 'ا' ? (i === 0 ? 0 : 0.6) : 0.1;
  }
  return p;
}

const candCache = new Map();

export function wordCandidates(word) {
  const cached = candCache.get(word);
  if (cached) return cached;
  const res = buildCandidates(word);
  if (candCache.size > 20000) candCache.clear();
  candCache.set(word, res);
  return res;
}

// اللواحق: الضمائر وألف الإطلاق/تنوين النصب
const ENCLITICS = [
  ['هما', [['1', 'هُ'], ['1', 'مَ'], ['0', 'ا', 'm']]], ['كما', [['1', 'كُ'], ['1', 'مَ'], ['0', 'ا', 'm']]],
  ['هم', [['1', 'هُ'], ['0', 'مْ']]], ['كم', [['1', 'كُ'], ['0', 'مْ']]],
  ['هن', [['1', 'هُ'], ['0', 'نْ'], ['1', 'نَ']]], ['كن', [['1', 'كُ'], ['0', 'نْ'], ['1', 'نَ']]],
  ['ها', [['1', 'هَ'], ['0', 'ا', 'm']]], ['نا', [['1', 'نَ'], ['0', 'ا', 'm']]], ['ني', [['1', 'نِ'], ['0', 'ي', 'm']]],
  ['ه', [['1', 'هُ']]], ['ك', [['1', 'كَ']]], ['ي', [['0', 'ي', 'm']], KASRA], ['ا', [['0', 'ا', 'm']], FATHA],
];

function directCands(key) {
  const out = [];
  if (SPECIAL[key]) out.push(...formsToCands(SPECIAL[key], 0, 'خاص'));
  if (DICT.has(key)) out.push(...formsToCands(DICT.get(key), 0, 'القاموس'));
  return out;
}

function lookupCands(key) {
  const out = directCands(key);
  for (const [suf, su, vowel] of ENCLITICS) {
    if (!key.endsWith(suf) || key.length - suf.length < 2) continue;
    const b0 = key.slice(0, -suf.length);
    const bases = [b0];
    if (b0.endsWith('ت')) bases.push(b0.slice(0, -1) + 'ه');
    for (const bk of bases) {
      if (!DICT.has(bk)) continue;
      for (const c of formsToCands(DICT.get(bk), 0.3, 'القاموس')) {
        let U = c.units.slice();
        if (U[U.length - 1].k === 'n') U.pop();
        const last = U[U.length - 1];
        if (last.k === 'm') { if (suf === 'ا' || suf === 'ي') continue; }
        else {
          let letter = stripMarks(last.t);
          if (letter === 'ة') letter = 'ت';
          U[U.length - 1] = { b: '1', t: letter + (vowel || ([...last.t].find(x => x === FATHA || x === DAMMA || x === KASRA) || FATHA)), k: 'c' };
        }
        const units = [...U, ...su.map(([b, t, k]) => ({ b, t, k: k || 'c' }))];
        const bb = bits(units);
        if (/00/.test(bb.slice(0, -1))) continue;
        const disp = units.map(x => x.t).join('').replace(/^ا[\u064E]/, 'ا');
        const form = c.display.replace(/[\u064B-\u0652]*$/, '').replace(/ة$/, 'ت') + (vowel || '') + suf;
        out.push({ units, wasl: c.wasl, endType: endTypeOf(units), cost: c.cost, display: form, form, src: 'القاموس', generic: false, bits: bb, flags: null });
      }
    }
  }
  return out;
}

function buildCandidates(raw) {
  const word = cleanText(raw);
  const skel = stripMarks(word);
  const key = keyOf(word);
  const userToks = parseWord(word);
  const hasMarks = userToks.some(t => t.marked);
  let base = [];

  // كلمة مشكولة كاملة من المستخدم
  if (hasMarks && userFullyMarked(userToks)) {
    const an = analyzeVocalized(word);
    const sp = SPECIAL[key] || PROCLITICS.some(([p]) => key.startsWith(p) && SPECIAL[key.slice(p.length)]);
    if (an && !sp) {
      const c = mkCand(an, 0, word, 'تشكيلك');
      const lastTok = userToks[userToks.length - 1];
      const out = lastTok.marked && !'اىوي'.includes(lastTok.l) ? [c] : endingVariants(c, word, 0.3);
      // الإشباع مسموح حتى مع التشكيل الكامل
      if (out.length === 1) {
        const ll = lastLetter(word);
        if ((ll === 'ه' || ll === 'م') && c.units[c.units.length - 1].b === '1') out.push(...endingVariants(c, word, 9).filter(x => x.src.endsWith('إشباع')));
      }
      return out;
    }
  }

  for (const c of lookupCands(key)) base.push(...endingVariants(c, c.display, 0.4, c.flags));

  // تجريد السوابق
  for (const [p, pv] of PROCLITICS) {
    if (!key.startsWith(p) || key.length - p.length < 2) continue;
    const rest = key.slice(p.length);
    const variants = [rest];
    if (p.endsWith('ل') && rest.startsWith('ل')) variants.push('ا' + rest); // للكتاب = لِ + الكتاب
    const pan = analyzeVocalized(pv);
    for (const r of variants) {
      for (const c of lookupCands(r)) {
        let bu = c.units;
        if (c.wasl) bu = bu.slice(1);
        if (!bu.length) continue;
        const units = [...pan.units, ...bu];
        const b = bits(units);
        if (/00/.test(b.slice(0, -1))) continue;
        const disp = pv + (c.wasl ? c.display.replace(/^[اٱ][\u064B-\u0652]*/, 'ا') : c.display);
        const cc = { units, wasl: false, endType: endTypeOf(units), cost: c.cost + 0.1 * p.length + 0.05, display: disp, form: disp, src: 'القاموس', generic: false, bits: b };
        base.push(...endingVariants(cc, disp, 0.4, c.flags));
      }
    }
  }

  const found = base.length > 0;
  base.push(...heuristicCands(skel, found ? 40 : 90).map(c => found ? { ...c, cost: c.cost + 1.2 } : c));

  // التوافق مع حركات المستخدم الجزئية
  if (hasMarks) {
    const f = base.filter(c => compatible(userToks, c.form || c.display) && endCompatible(userToks, c));
    if (f.length) base = f;
    base = base.map(c => ({ ...c, display: mergeDisplay(word, c.display) }));
  }
  base = base.map(c => c.generic ? c : ({ ...c, cost: c.cost + skeletonPenalty(word, c.form || c.display) }));

  // إزالة المكرر: نفس الرموز ونفس الوصل ونفس نوع النهاية
  const best = new Map();
  for (const c of base) {
    const k = c.bits + '|' + c.wasl + '|' + c.endType + '|' + !!c.endOnly;
    const prev = best.get(k);
    if (!prev || prev.cost > c.cost) best.set(k, c);
  }
  return [...best.values()].sort((a, b) => a.cost - b.cost);
}


/* ----------------------------- آلة البحور ----------------------------- */

let NFA = null;
const NFA_CACHE = new Map();
// صور البيت كاملاً (الصدر والعجز متصلان) للمدوّر والتقسيم التلقائي
export const FORMS2 = FORMS.map(F => ({ ...F, slots: [...F.slots, ...F.slots], double: true }));
function getNFA(forms) {
  let n = NFA_CACHE.get(forms);
  if (!n) { n = buildNFA(forms); NFA_CACHE.set(forms, n); }
  return n;
}
function buildNFA(FORMS) {
  const nodes = [];
  const starts = [];
  const node = (form, slot, extra = {}) => { nodes.push({ form, slot, edges: [], accept: -1, ...extra }); return nodes.length - 1; };
  FORMS.forEach((F, fi) => {
    const bnd = [];
    for (let k = 0; k <= F.slots.length; k++) bnd.push(node(fi, k));
    nodes[bnd[F.slots.length]].accept = fi;
    starts.push(bnd[0]);
    F.slots.forEach((variants, k) => {
      variants.forEach((v, vi) => {
        let cur = bnd[k];
        for (let j = 0; j < v.p.length; j++) {
          const to = j === v.p.length - 1 ? bnd[k + 1] : node(fi, k);
          nodes[cur].edges.push({ ch: v.p[j], to, cost: j === 0 ? v.cost : 0, slot: k, vi, pos: j });
          cur = to;
        }
      });
    });
  });
  return { nodes, starts };
}

function relax(map, key, cost, err, back) {
  const e = map.get(key);
  if (!e || cost < e.cost - 1e-9 || (Math.abs(cost - e.cost) < 1e-9 && err < e.err)) {
    map.set(key, { cost, err, back });
  }
}

function prune(map) {
  let min = Infinity;
  for (const e of map.values()) if (e.cost < min) min = e.cost;
  for (const [k, e] of map) if (e.cost > min + PRUNE) map.delete(k);
  return min;
}

function closure(map, w, rounds = 2) {
  const { nodes } = NFA;
  let frontier = [...map.entries()];
  for (let r = 0; r < rounds; r++) {
    const nf = [];
    for (const [nd, e] of frontier) {
      for (const ed of nodes[nd].edges) {
        const c = e.cost + ed.cost + E;
        const before = map.get(ed.to);
        relax(map, ed.to, c, e.err + 1, { op: 'i', exp: ed.ch, w, slot: ed.slot, vi: ed.vi, form: nodes[nd].form, prev: e.back });
        const after = map.get(ed.to);
        if (after !== before) nf.push([ed.to, after]);
      }
    }
    frontier = nf;
    if (!frontier.length) break;
  }
}

function runSeq(start, seq) {
  const { nodes } = NFA;
  let cur = start;
  for (const it of seq) {
    const nxt = new Map();
    for (const [nd, e] of cur) {
      for (const ed of nodes[nd].edges) {
        const ok = ed.ch === it.b;
        relax(nxt, ed.to, e.cost + ed.cost + (ok ? 0 : E), e.err + (ok ? 0 : 1),
          { op: ok ? 'm' : 's', got: it.b, exp: ed.ch, w: it.w, ui: it.ui, slot: ed.slot, vi: ed.vi, form: nodes[nd].form, prev: e.back });
      }
      relax(nxt, nd, e.cost + E, e.err + 1, { op: 'd', got: it.b, w: it.w, ui: it.ui, slot: nodes[nd].slot, form: nodes[nd].form, prev: e.back });
    }
    closure(nxt, it.w, 1);
    prune(nxt);
    cur = nxt;
  }
  return cur;
}

function resolveHeld(type, waslNext) {
  if (type === 'v') return '1';
  if (type === 'm') return waslNext ? null : '0';
  if (type === 'c') return waslNext ? '1' : '0';
  return null;
}

// مطابقة شطر واحد (مصفوفة كلمات) على كل صور البحور
export function matchHemistich(words, opts = {}) {
  const forms = opts.double ? FORMS2 : FORMS;
  NFA = getNFA(forms);
  const { nodes, starts } = NFA;
  const formFilter = opts.forms || null;
  const cands = words.map(w => wordCandidates(w));

  // الحالة: Map<"node|type", entry>
  let groups = new Map([['x', new Map()]]);
  starts.forEach((s, fi) => {
    if (formFilter && !formFilter.has(fi)) return;
    groups.get('x').set(s, { cost: forms[fi].prior, err: 0, back: null });
  });
  closure(groups.get('x'), 0, 1);

  for (let i = 0; i < words.length; i++) {
    const ng = new Map();
    for (const [type, sub] of groups) {
      if (!sub.size) continue;
      for (const c of cands[i]) {
        if (c.endOnly && i !== words.length - 1) continue;
        const seq = [];
        const waslHere = c.wasl && i > 0;
        if (type !== 'x') {
          const hb = resolveHeld(type, waslHere);
          if (hb !== null) seq.push({ b: hb, w: i - 1, ui: 'held' });
        }
        const startU = waslHere ? 1 : 0;
        for (let j = startU; j < c.units.length - 1; j++) seq.push({ b: c.units[j].b, w: i, ui: j });
        const start = new Map();
        for (const [nd, e] of sub) {
          start.set(nd, { cost: e.cost + c.cost, err: e.err, back: { op: 'w', w: i, cand: c, prev: e.back } });
        }
        const res = seq.length ? runSeq(start, seq) : start;
        let tgt = ng.get(c.endType);
        if (!tgt) { tgt = new Map(); ng.set(c.endType, tgt); }
        for (const [nd, e] of res) relax(tgt, nd, e.cost, e.err, e.back);
      }
    }
    // تقليم عام
    let min = Infinity;
    for (const g of ng.values()) for (const e of g.values()) if (e.cost < min) min = e.cost;
    for (const g of ng.values()) for (const [k, e] of g) if (e.cost > min + PRUNE) g.delete(k);
    groups = ng;
  }

  // نهاية الشطر: إشباع حركة الروي
  const final = new Map();
  const lw = words.length - 1;
  for (const [type, sub] of groups) {
    let seq = [];
    if (type === 'v') seq = [{ b: '1', w: lw, ui: 'held' }, { b: '0', w: lw, ui: 'ish' }];
    else if (type === 'm' || type === 'c') seq = [{ b: '0', w: lw, ui: 'held' }];
    const res = seq.length ? runSeq(sub, seq) : sub;
    closure(res, lw, 2);
    for (const [nd, e] of res) relax(final, nd, e.cost, e.err, e.back);
  }

  const byForm = new Map();
  for (const [nd, e] of final) {
    const fi = nodes[nd].accept;
    if (fi < 0) continue;
    relax(byForm, fi, e.cost, e.err, e.back);
  }
  return { byForm, words, cands, forms };
}

/* ----------------------------- إعادة بناء المسار ----------------------------- */

function walk(back) {
  const ops = [];
  for (let b = back; b; b = b.prev) ops.push(b);
  return ops.reverse();
}

export function explain(match, fi) {
  const e = match.byForm.get(fi);
  if (!e) return null;
  const F = match.forms[fi];
  const ops = walk(e.back);
  const chosen = [];
  for (const o of ops) if (o.op === 'w') chosen[o.w] = o.cand;

  const unitOf = (o) => {
    const c = chosen[o.w];
    if (!c) return null;
    if (o.ui === 'held') return c.units[c.units.length - 1];
    if (o.ui === 'ish') return null;
    return c.units[o.ui];
  };
  const textOf = (o) => {
    const c = chosen[o.w];
    if (!c) return '';
    if (o.ui === 'ish') return ishbaaText(c.units[c.units.length - 1]);
    const un = unitOf(o);
    if (!un) return '';
    if (o.ui === 'held' && o.got === '1' && un.b === '0') {
      return un.k === 'n' ? 'نِ' : stripMarks(un.t) + KASRA;
    }
    return un.t;
  };

  const feet = F.slots.map((vs, k) => ({ slot: k, exp: '', got: '', text: '', name: null, note: '', ok: true, words: new Set() }));
  const errors = [];
  let lastSlot = 0;
  for (const o of ops) {
    if (o.op === 'w') continue;
    const k = o.slot != null ? Math.min(o.slot, F.slots.length - 1) : lastSlot;
    lastSlot = k;
    const ft = feet[k];
    if (o.vi != null && o.op !== 'd') {
      const v = F.slots[k][o.vi];
      ft.name = v.name; ft.note = v.note; ft.vp = v.p;
    }
    if (o.op === 'm' || o.op === 's') { ft.exp += o.exp; ft.got += o.got; ft.text += textOf(o); }
    if (o.op === 'd') { ft.got += o.got; ft.text += textOf(o); }
    if (o.op === 'i') { ft.exp += o.exp; }
    if (o.w != null) ft.words.add(o.w);
    if (o.op !== 'm') {
      ft.ok = false;
      errors.push({ kind: o.op, foot: k, word: o.w, exp: o.exp, got: o.got });
    }
  }
  return {
    formIndex: fi, meter: F.meter, form: F.form, cost: e.cost, err: e.err,
    feet: feet.map(f => ({ ...f, words: [...f.words] })),
    errors,
    words: match.words.map((w, i) => ({ text: w, display: chosen[i] ? chosen[i].display : w, generic: chosen[i] ? chosen[i].generic : false, src: chosen[i] ? chosen[i].src : '' })),
  };
}

/* ----------------------------- البيت كاملاً ----------------------------- */

const SEP_RE = /\s*(?:\*+|#|…|\.{2,}|\t+|\||٭|✱|ـ{2,}|\s-\s|\s{3,})\s*/;

export function splitVerse(line) {
  const parts = cleanText(line).split(SEP_RE).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(' ')];
  return [parts[0] || ''];
}

function hemiWords(text) { return tokenize(text); }

// يجمع نتيجتي الشطرين على بحر واحد
function combine(m1, m2) {
  const scores = [];
  const byKey = new Map();
  for (const [fi, e] of m1.byForm) {
    const F = FORMS[fi];
    for (const [fj, e2] of m2.byForm) {
      const G = FORMS[fj];
      if (G.meter !== F.meter || G.form !== F.form) continue;
      const tot = e.cost + e2.cost - F.prior; // لا نحسب ندرة البحر مرتين
      const k = F.meter + '|' + F.form;
      const prev = byKey.get(k);
      if (!prev || prev.cost > tot) byKey.set(k, { meter: F.meter, form: F.form, fi, fj, cost: tot, err: e.err + e2.err });
    }
  }
  for (const v of byKey.values()) scores.push(v);
  scores.sort((a, b) => a.cost - b.cost);
  return scores;
}

function bestOf(m) {
  const list = [...m.byForm.entries()].map(([fi, e]) => ({ meter: m.forms[fi].meter, form: m.forms[fi].form, fi, cost: e.cost, err: e.err }))
    .sort((a, b) => a.cost - b.cost);
  const seen = new Set();
  return list.filter(x => { const k = x.meter + x.form; if (seen.has(k)) return false; seen.add(k); return true; });
}

function isFragment(w) {
  const k = keyOf(w);
  return k.length <= 2 && !DICT.has(k) && !SPECIAL[k];
}

export function analyzeVerse(line, opts = {}) {
  const parts = Array.isArray(line) ? line : splitVerse(line);
  let w1 = hemiWords(parts[0] || '');
  const w2 = parts[1] ? hemiWords(parts[1]) : null;
  // البيت المدوّر: «ال» في آخر الصدر
  if (w2 && w1.length > 1 && keyOf(w1[w1.length - 1]) === 'ال') w1 = w1.slice(0, -1);
  if (!w1.length) return null;

  if (!w2 || !w2.length) {
    const m1 = matchHemistich(w1);
    let alts = bestOf(m1);
    let best = alts[0];
    // بيت كامل بلا فاصل؟
    if (opts.autoSplit !== false && w1.length >= 5 && (!best || best.err > 0 || best.cost > w1.length * 0.9)) {
      const md = matchHemistich(w1, { double: true });
      const altsD = bestOf(md);
      if (altsD[0] && (!best || altsD[0].cost + 0.3 < best.cost)) {
        const split = splitFromPath(md, altsD[0].fi);
        if (split > 0 && split < w1.length) {
          const r = analyzeVerse([w1.slice(0, split).join(' '), w1.slice(split).join(' ')], { autoSplit: false });
          if (r && r.cost <= altsD[0].cost + 1.5) { r.autoSplit = true; return r; }
        }
        return verseResult(md, altsD, true);
      }
    }
    if (!best) return null;
    return {
      single: true, meter: best.meter, form: best.form, cost: best.cost, exact: best.err === 0,
      hemistichs: [explain(m1, best.fi)], alternatives: alts.slice(1, 4),
    };
  }

  const m1 = matchHemistich(w1);
  const m2 = matchHemistich(w2);
  const scores = combine(m1, m2);
  let best = scores[0];
  let res = best ? {
    single: false, meter: best.meter, form: best.form, cost: best.cost, exact: best.err === 0,
    hemistichs: [explain(m1, best.fi), explain(m2, best.fj)], alternatives: scores.slice(1, 4),
  } : null;
  // المدوّر: كلمة مقسومة بين الشطرين
  if ((!res || !res.exact) && (isFragment(w1[w1.length - 1]) || isFragment(w2[0]))) {
    const joined = [...w1.slice(0, -1), w1[w1.length - 1] + w2[0], ...w2.slice(1)];
    const md = matchHemistich(joined, { double: true });
    const altsD = bestOf(md);
    if (altsD[0] && (!res || altsD[0].cost + 0.5 < res.cost)) return verseResult(md, altsD, false, true);
  }
  return res;
}

function verseResult(md, alts, auto, madwar = false) {
  const best = alts[0];
  const ex = explain(md, best.fi);
  return {
    single: false, joined: true, madwar, autoSplit: auto, meter: best.meter, form: best.form, cost: best.cost,
    exact: best.err === 0, hemistichs: [ex], alternatives: alts.slice(1, 4),
  };
}

// موضع نهاية الصدر من مسار الصور المضاعفة
function splitFromPath(md, fi) {
  const e = md.byForm.get(fi);
  const half = md.forms[fi].slots.length / 2;
  const ops = walk(e.back);
  let lastW = -1;
  for (const o of ops) {
    if (o.op === 'w' || o.slot == null) continue;
    if (o.slot < half && o.w != null) lastW = Math.max(lastW, o.w);
  }
  // الكلمة التي ينتهي عندها الصدر
  for (const o of ops) {
    if (o.op === 'w' || o.slot == null || o.w == null) continue;
    if (o.slot >= half) return o.w === lastW ? -1 : o.w;
  }
  return -1;
}

export function meterOnly(line) {
  const r = analyzeVerse(line);
  return r ? r.meter : null;
}

export { FORMS };
