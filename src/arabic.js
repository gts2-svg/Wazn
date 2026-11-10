// وزن — أدوات النص العربي والكتابة العروضية للكلمة الواحدة
// كل كلمة تتحول إلى «وحدات»: كل وحدة حرف منطوق متحرك (1) أو ساكن (0)

export const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ',
  SHADDA = 'ّ', FATHATAN = 'ً', DAMMATAN = 'ٌ', KASRATAN = 'ٍ',
  DAGGER = 'ٰ';

const VOWELS = new Set([FATHA, DAMMA, KASRA]);
const TANWEEN = new Set([FATHATAN, DAMMATAN, KASRATAN]);
const MARKS = new Set([FATHA, DAMMA, KASRA, SUKUN, SHADDA, FATHATAN, DAMMATAN, KASRATAN, DAGGER]);
const LETTERS_RE = /[ء-غف-يٱ]/;
const SHAMSI = new Set('تثدذرزسشصضطظلن');
const PROCLITIC_LETTERS = new Set('وفبكل');

const TANWEEN_TO_VOWEL = { [FATHATAN]: FATHA, [DAMMATAN]: DAMMA, [KASRATAN]: KASRA };
const VOWEL_TO_MADD = { [FATHA]: 'ا', [DAMMA]: 'و', [KASRA]: 'ي' };

export function isLetter(ch) { return LETTERS_RE.test(ch); }
export function isMark(ch) { return MARKS.has(ch); }

// توحيد الحروف والحركات
export function cleanText(s) {
  return s
    .replace(/ـ/g, '')               // التطويل
    .replace(/آ/g, 'آ')
    .replace(/أ/g, 'أ')
    .replace(/إ/g, 'إ')
    .replace(/ؤ/g, 'ؤ')
    .replace(/ئ/g, 'ئ')
    .replace(/[ٕٖٓٔ-ٟۖ-ۭ]/g, '')
    .replace(/ٲ|ٳ/g, 'ا');
}

export function stripMarks(w) {
  let o = '';
  for (const ch of w) if (!MARKS.has(ch)) o += ch;
  return o;
}

// مفتاح البحث في القاموس: بلا تشكيل ومع توحيد الهمزات
export function keyOf(w) {
  return stripMarks(w).replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

// تقسيم الكلمة إلى حروف وعلى كل حرف علاماته
export function parseWord(w) {
  const toks = [];
  for (const ch of w) {
    if (MARKS.has(ch)) {
      if (toks.length) toks[toks.length - 1].m.push(ch);
    } else if (isLetter(ch)) {
      toks.push({ l: ch, m: [] });
    }
  }
  // «لاَ»: الفتحة المكتوبة على الألف للحرف الذي قبلها، و«ـاً»: تنوين النصب على الألف
  for (let i = 1; i < toks.length; i++) {
    const t = toks[i], p = toks[i - 1];
    if (t.l === 'ا' && t.m.length === 1 && t.m[0] === FATHA && !p.m.length) { p.m.push(FATHA); t.m = []; }
    if ((t.l === 'ا' || t.l === 'ى') && t.m.includes(FATHATAN) && !p.m.some(x => TANWEEN.has(x))) {
      p.m = p.m.filter(x => !VOWELS.has(x) && x !== SUKUN); p.m.push(FATHATAN); t.m = t.m.filter(x => x !== FATHATAN);
    }
  }
  for (const t of toks) {
    t.sh = t.m.includes(SHADDA);
    t.v = t.m.find(x => VOWELS.has(x)) || null;
    t.tn = t.m.find(x => TANWEEN.has(x)) || null;
    t.su = t.m.includes(SUKUN);
    t.dg = t.m.includes(DAGGER);
    t.marked = t.sh || !!t.v || !!t.tn || t.su;
  }
  return toks;
}

// تقطيع الكلمات في السطر
export function tokenize(line) {
  const clean = cleanText(line);
  const words = [];
  let cur = '';
  for (const ch of clean) {
    if (isLetter(ch) || MARKS.has(ch)) cur += ch;
    else { if (cur) words.push(cur); cur = ''; }
  }
  if (cur) words.push(cur);
  return words.filter(w => /[ء-يٱ]/.test(w));
}

const u = (b, t, k) => ({ b, t, k });

// تحليل كلمة مشكولة إلى وحدات عروضية
// يرجع null إذا كان التشكيل ناقصاً في وسط الكلمة
// opts.lenient: يقبل الحرف غير المشكول في الوسط ويعدّه متحركاً
export function analyzeVocalized(word, opts = {}) {
  const T = parseWord(word);
  const n = T.length;
  if (!n) return null;
  const units = [];
  let wasl = false;
  let incomplete = 0;
  const letters = T.map(t => t.l).join('');

  for (let i = 0; i < n; i++) {
    const t = T[i], L = t.l, prev = T[i - 1], next = T[i + 1];
    const last = i === n - 1;

    // همزة الوصل وأل التعريف في أول الكلمة
    if (i === 0 && (L === 'ا' || L === 'ٱ')) {
      if (L === 'ا' && (t.v === FATHA || t.tn)) { units.push(u('1', 'أ' + (t.v || FATHA), 'c')); continue; }
      wasl = true;
      units.push(u('1', 'ا' + FATHA, 'w'));
      continue;
    }
    // لام التعريف بعد الألف (أول الكلمة أو بعد حرف جر/عطف)
    if (L === 'ل' && prev && (prev.l === 'ا' || prev.l === 'ٱ') && !t.v && !t.sh && !t.tn &&
        (i === 1 ? wasl : articleAlifSilent(T, i - 1))) {
      if (next && next.sh && SHAMSI.has(next.l) && !t.su) continue; // شمسية: لا تنطق
      if (next && next.sh && next.l === 'ل') continue;               // الله، اللذان
      units.push(u('0', 'ل' + SUKUN, 'c'));
      continue;
    }

    if (L === 'ا' || L === 'ٱ') {
      if (prev && prev.tn === FATHATAN) continue;                       // ألف تنوين النصب
      if (last && prev && prev.l === 'و' && !prev.v && !prev.sh) continue; // ألف واو الجماعة
      if (articleAlifSilent(T, i)) continue;                              // وَالكتاب، بِالقلم
      if ((t.v === KASRA || t.v === DAMMA) && afterProclitics(T, i)) continue; // وَاِبْيَضَّ: همزة وصل
      if (!t.v && next && (next.su || (next.sh && !next.v && false)) && i <= 2 &&
          T.slice(0, i).every(x => PROCLITIC_LETTERS.has(x.l))) continue;      // فاسْتَلَّ
      if (t.v) { units.push(u('1', 'أ' + t.v, 'c')); continue; }
      units.push(u('0', 'ا', 'm'));
      continue;
    }
    if (L === 'آ') {
      units.push(u('1', 'أ' + FATHA, 'c'));
      units.push(u('0', 'ا', 'm'));
      continue;
    }
    if (L === 'ى') {
      if (prev && prev.tn === FATHATAN) continue;
      if (t.v) { units.push(u('1', 'ى' + t.v, 'c')); continue; }
      units.push(u('0', 'ى', 'm'));
      continue;
    }

    // سائر الحروف
    if (t.sh) {
      units.push(u('0', L + SUKUN, 'c'));
      const vv = t.v || (t.tn ? TANWEEN_TO_VOWEL[t.tn] : FATHA);
      units.push(u('1', L + vv, 'c'));
      if (t.tn) units.push(u('0', 'نْ', 'n'));
    } else if (t.tn) {
      units.push(u('1', L + TANWEEN_TO_VOWEL[t.tn], 'c'));
      units.push(u('0', 'نْ', 'n'));
    } else if (t.v) {
      units.push(u('1', L + t.v, 'c'));
    } else if (t.su) {
      units.push(u('0', L + SUKUN, 'c'));
    } else {
      // حرف بلا علامة
      if ((L === 'و' || L === 'ي') && i > 0) {
        const match = prev && ((L === 'و' && prev.v === DAMMA) || (L === 'ي' && prev.v === KASRA));
        if (next && 'اآى'.includes(next.l) && !next.v && !(L === 'و' && next.l === 'ا' && i + 1 === n - 1)) units.push(u('1', L, 'c'));   // دِيَار، سِوَى
        else if (match) units.push(u('0', L, 'm'));
        else if (prev && prev.l === 'ا' ) { if (!opts.lenient) incomplete++; units.push(u('1', L, 'c')); }
        else if (prev && prev.v === FATHA) { if (!opts.lenient) incomplete++; units.push(u('0', L + SUKUN, 'c')); }
        else { if (!opts.lenient && !(last && i === 1)) incomplete++; units.push(u('0', L, 'm')); }
      } else if (last) {
        units.push(u('1', L, 'c'));
      } else if (next && (next.l === 'ا' || next.l === 'ى' || ((next.l === 'و' || next.l === 'ي') && !next.marked && !(T[i + 2] && 'اآى'.includes(T[i + 2].l))))) {
        units.push(u('1', L, 'c'));
      } else if (i === 0) {
        units.push(u('1', L, 'c'));
      } else {
        incomplete++;
        units.push(u('1', L, 'c'));
      }
    }
    // الألف الخنجرية: هٰذا
    if (t.dg) units.push(u('0', 'ا', 'm'));
    // لفظ الجلالة: لّه → لّاه
    if (L === 'ل' && next && next.l === 'ه' && (i + 1 === n - 1 || (i + 2 === n - 1 && T[n - 1].l === 'م')) &&
        prev && prev.l === 'ل' && !t.su && !(next.su && i + 1 === n - 1 && n <= 3)) {
      units.push(u('0', 'ا', 'm'));
    }
  }
  if (incomplete && !opts.lenient) return null;
  if (!units.length) return null;
  // لا يبدأ النطق بساكن
  if (units[0].b === '0') return null;
  return { units, wasl, letters };
}

function afterProclitics(T, i) {
  if (i < 1 || i > 2) return false;
  for (let j = 0; j < i; j++) if (!PROCLITIC_LETTERS.has(T[j].l) || !T[j].v) return false;
  return true;
}

// هل الألف في الموضع i ألف «ال» بعد حرف جر أو عطف (فتسقط)؟
function articleAlifSilent(T, i) {
  if (i < 1 || i > 3) return false;
  const a = T[i], l = T[i + 1];
  if (!a || (a.l !== 'ا' && a.l !== 'ٱ') || a.v || a.tn || !l || l.l !== 'ل') return false;
  for (let j = 0; j < i; j++) if (!PROCLITIC_LETTERS.has(T[j].l)) return false;
  if (a.l === 'ٱ') return true;
  if (l.v || l.tn) return false;          // بَالُهُ
  if (l.su || l.sh) return true;
  const after = T[i + 2];
  if (!after) return false;
  if (after.sh) return true;
  // بلا علامات: نعدّها أل التعريف إذا كان الحرف السابق مشكولاً بحركة قصيرة
  return !!T[i - 1].v && !l.marked && i + 2 < T.length - 0;
}

// هل شكّل المستخدم الكلمة تشكيلاً كاملاً يُعتمد عليه؟
export function userFullyMarked(T) {
  const n = T.length;
  for (let i = 1; i < n - 1; i++) {
    const t = T[i], prev = T[i - 1], next = T[i + 1];
    if ('اىآٱ'.includes(t.l) || t.marked) continue;
    if (t.l === 'ل' && (prev.l === 'ا' || prev.l === 'ٱ')) continue;
    if ((t.l === 'و' && prev.v === DAMMA) || (t.l === 'ي' && prev.v === KASRA)) {
      if (next && 'اآى'.includes(next.l)) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function endTypeOf(units) {
  const last = units[units.length - 1];
  if (last.b === '1') return 'v';
  return last.k === 'm' ? 'm' : 'c';
}

export function bits(units) { return units.map(x => x.b).join(''); }

// حرف المد المناسب للإشباع
export function ishbaaText(unit) {
  const v = [...unit.t].find(c => VOWELS.has(c));
  return VOWEL_TO_MADD[v] || 'ا';
}

export { VOWELS, TANWEEN, SHAMSI, PROCLITIC_LETTERS };
