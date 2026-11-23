// مولَّد آلياً من src/ بالأمر node ios/core/build.mjs — لا تعدّله يدوياً
(() => {
  // src/arabic.js
  var FATHA = "َ";
  var DAMMA = "ُ";
  var KASRA = "ِ";
  var SUKUN = "ْ";
  var SHADDA = "ّ";
  var FATHATAN = "ً";
  var DAMMATAN = "ٌ";
  var KASRATAN = "ٍ";
  var DAGGER = "ٰ";
  var VOWELS = /* @__PURE__ */ new Set([FATHA, DAMMA, KASRA]);
  var TANWEEN = /* @__PURE__ */ new Set([FATHATAN, DAMMATAN, KASRATAN]);
  var MARKS = /* @__PURE__ */ new Set([FATHA, DAMMA, KASRA, SUKUN, SHADDA, FATHATAN, DAMMATAN, KASRATAN, DAGGER]);
  var LETTERS_RE = /[ء-غف-يٱ]/;
  var SHAMSI = new Set("تثدذرزسشصضطظلن");
  var PROCLITIC_LETTERS = new Set("وفبكل");
  var TANWEEN_TO_VOWEL = { [FATHATAN]: FATHA, [DAMMATAN]: DAMMA, [KASRATAN]: KASRA };
  var VOWEL_TO_MADD = { [FATHA]: "ا", [DAMMA]: "و", [KASRA]: "ي" };
  function isLetter(ch) {
    return LETTERS_RE.test(ch);
  }
  function cleanText(s) {
    return s.replace(/ـ/g, "").replace(/آ/g, "آ").replace(/أ/g, "أ").replace(/إ/g, "إ").replace(/ؤ/g, "ؤ").replace(/ئ/g, "ئ").replace(/[ٕٖٓٔ-ٟۖ-ۭ]/g, "").replace(/ٲ|ٳ/g, "ا");
  }
  function stripMarks(w) {
    let o = "";
    for (const ch of w) if (!MARKS.has(ch)) o += ch;
    return o;
  }
  function keyOf(w) {
    return stripMarks(w).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  }
  function parseWord(w) {
    const toks = [];
    for (const ch of w) {
      if (MARKS.has(ch)) {
        if (toks.length) toks[toks.length - 1].m.push(ch);
      } else if (isLetter(ch)) {
        toks.push({ l: ch, m: [] });
      }
    }
    for (let i = 1; i < toks.length; i++) {
      const t = toks[i], p = toks[i - 1];
      if (t.l === "ا" && t.m.length === 1 && t.m[0] === FATHA && !p.m.length) {
        p.m.push(FATHA);
        t.m = [];
      }
      if ((t.l === "ا" || t.l === "ى") && t.m.includes(FATHATAN) && !p.m.some((x) => TANWEEN.has(x))) {
        p.m = p.m.filter((x) => !VOWELS.has(x) && x !== SUKUN);
        p.m.push(FATHATAN);
        t.m = t.m.filter((x) => x !== FATHATAN);
      }
    }
    for (const t of toks) {
      t.sh = t.m.includes(SHADDA);
      t.v = t.m.find((x) => VOWELS.has(x)) || null;
      t.tn = t.m.find((x) => TANWEEN.has(x)) || null;
      t.su = t.m.includes(SUKUN);
      t.dg = t.m.includes(DAGGER);
      t.marked = t.sh || !!t.v || !!t.tn || t.su;
    }
    return toks;
  }
  function tokenize(line) {
    const clean = cleanText(line);
    const words = [];
    let cur = "";
    for (const ch of clean) {
      if (isLetter(ch) || MARKS.has(ch)) cur += ch;
      else {
        if (cur) words.push(cur);
        cur = "";
      }
    }
    if (cur) words.push(cur);
    return words.filter((w) => /[ء-يٱ]/.test(w));
  }
  var u = (b, t, k) => ({ b, t, k });
  function analyzeVocalized(word, opts = {}) {
    const T = parseWord(word);
    const n = T.length;
    if (!n) return null;
    const units = [];
    let wasl = false;
    let incomplete = 0;
    const letters = T.map((t) => t.l).join("");
    for (let i = 0; i < n; i++) {
      const t = T[i], L = t.l, prev = T[i - 1], next = T[i + 1];
      const last = i === n - 1;
      if (i === 0 && (L === "ا" || L === "ٱ")) {
        if (L === "ا" && (t.v === FATHA || t.tn)) {
          units.push(u("1", "أ" + (t.v || FATHA), "c"));
          continue;
        }
        wasl = true;
        units.push(u("1", "ا" + FATHA, "w"));
        continue;
      }
      if (L === "ل" && prev && (prev.l === "ا" || prev.l === "ٱ") && !t.v && !t.sh && !t.tn && (i === 1 ? wasl : articleAlifSilent(T, i - 1))) {
        if (next && next.sh && SHAMSI.has(next.l) && !t.su) continue;
        if (next && next.sh && next.l === "ل") continue;
        units.push(u("0", "ل" + SUKUN, "c"));
        continue;
      }
      if (L === "ا" || L === "ٱ") {
        if (prev && prev.tn === FATHATAN) continue;
        if (last && prev && prev.l === "و" && !prev.v && !prev.sh) continue;
        if (articleAlifSilent(T, i)) continue;
        if ((t.v === KASRA || t.v === DAMMA) && afterProclitics(T, i)) continue;
        if (!t.v && next && (next.su || next.sh && !next.v && false) && i <= 2 && T.slice(0, i).every((x) => PROCLITIC_LETTERS.has(x.l))) continue;
        if (t.v) {
          units.push(u("1", "أ" + t.v, "c"));
          continue;
        }
        units.push(u("0", "ا", "m"));
        continue;
      }
      if (L === "آ") {
        units.push(u("1", "أ" + FATHA, "c"));
        units.push(u("0", "ا", "m"));
        continue;
      }
      if (L === "ى") {
        if (prev && prev.tn === FATHATAN) continue;
        if (t.v) {
          units.push(u("1", "ى" + t.v, "c"));
          continue;
        }
        units.push(u("0", "ى", "m"));
        continue;
      }
      if (t.sh) {
        units.push(u("0", L + SUKUN, "c"));
        const vv = t.v || (t.tn ? TANWEEN_TO_VOWEL[t.tn] : FATHA);
        units.push(u("1", L + vv, "c"));
        if (t.tn) units.push(u("0", "نْ", "n"));
      } else if (t.tn) {
        units.push(u("1", L + TANWEEN_TO_VOWEL[t.tn], "c"));
        units.push(u("0", "نْ", "n"));
      } else if (t.v) {
        units.push(u("1", L + t.v, "c"));
      } else if (t.su) {
        units.push(u("0", L + SUKUN, "c"));
      } else {
        if ((L === "و" || L === "ي") && i > 0) {
          const match = prev && (L === "و" && prev.v === DAMMA || L === "ي" && prev.v === KASRA);
          if (next && "اآى".includes(next.l) && !next.v && !(L === "و" && next.l === "ا" && i + 1 === n - 1)) units.push(u("1", L, "c"));
          else if (match) units.push(u("0", L, "m"));
          else if (prev && prev.l === "ا") {
            if (!opts.lenient) incomplete++;
            units.push(u("1", L, "c"));
          } else if (prev && prev.v === FATHA) {
            if (!opts.lenient) incomplete++;
            units.push(u("0", L + SUKUN, "c"));
          } else {
            if (!opts.lenient && !(last && i === 1)) incomplete++;
            units.push(u("0", L, "m"));
          }
        } else if (last) {
          units.push(u("1", L, "c"));
        } else if (next && (next.l === "ا" || next.l === "ى" || (next.l === "و" || next.l === "ي") && !next.marked && !(T[i + 2] && "اآى".includes(T[i + 2].l)))) {
          units.push(u("1", L, "c"));
        } else if (i === 0) {
          units.push(u("1", L, "c"));
        } else {
          incomplete++;
          units.push(u("1", L, "c"));
        }
      }
      if (t.dg) units.push(u("0", "ا", "m"));
      if (L === "ل" && next && next.l === "ه" && (i + 1 === n - 1 || i + 2 === n - 1 && T[n - 1].l === "م") && prev && prev.l === "ل" && !t.su && !(next.su && i + 1 === n - 1 && n <= 3)) {
        units.push(u("0", "ا", "m"));
      }
    }
    if (incomplete && !opts.lenient) return null;
    if (!units.length) return null;
    if (units[0].b === "0") return null;
    return { units, wasl, letters };
  }
  function afterProclitics(T, i) {
    if (i < 1 || i > 2) return false;
    for (let j = 0; j < i; j++) if (!PROCLITIC_LETTERS.has(T[j].l) || !T[j].v) return false;
    return true;
  }
  function articleAlifSilent(T, i) {
    if (i < 1 || i > 3) return false;
    const a = T[i], l = T[i + 1];
    if (!a || a.l !== "ا" && a.l !== "ٱ" || a.v || a.tn || !l || l.l !== "ل") return false;
    for (let j = 0; j < i; j++) if (!PROCLITIC_LETTERS.has(T[j].l)) return false;
    if (a.l === "ٱ") return true;
    if (l.v || l.tn) return false;
    if (l.su || l.sh) return true;
    const after = T[i + 2];
    if (!after) return false;
    if (after.sh) return true;
    return !!T[i - 1].v && !l.marked && i + 2 < T.length - 0;
  }
  function userFullyMarked(T) {
    const n = T.length;
    for (let i = 1; i < n - 1; i++) {
      const t = T[i], prev = T[i - 1], next = T[i + 1];
      if ("اىآٱ".includes(t.l) || t.marked) continue;
      if (t.l === "ل" && (prev.l === "ا" || prev.l === "ٱ")) continue;
      if (t.l === "و" && prev.v === DAMMA || t.l === "ي" && prev.v === KASRA) {
        if (next && "اآى".includes(next.l)) return false;
        continue;
      }
      return false;
    }
    return true;
  }
  function endTypeOf(units) {
    const last = units[units.length - 1];
    if (last.b === "1") return "v";
    return last.k === "m" ? "m" : "c";
  }
  function bits(units) {
    return units.map((x) => x.b).join("");
  }
  function ishbaaText(unit) {
    const v = [...unit.t].find((c) => VOWELS.has(c));
    return VOWEL_TO_MADD[v] || "ا";
  }

  // src/meters.js
  var V = (p, name, cost = 0, note = "") => ({ p, name, cost, note });
  var FAOOLUN = [V("11010", "فعولن"), V("1101", "فعولُ", 0.1, "مقبوضة")];
  var MAFAEELUN = [V("1101010", "مفاعيلن"), V("110110", "مفاعلن", 0.1, "مقبوضة"), V("110101", "مفاعيلُ", 0.5, "مكفوفة")];
  var FAELUN = [V("10110", "فاعلن"), V("1110", "فعِلن", 0.1, "مخبونة")];
  var FAELATUN = [V("1011010", "فاعلاتن"), V("111010", "فعِلاتن", 0.1, "مخبونة"), V("101101", "فاعلاتُ", 0.6, "مكفوفة"), V("11101", "فعِلاتُ", 0.8, "مشكولة")];
  var MUSTAF = [V("1010110", "مستفعلن"), V("110110", "مُتَفْعِلن", 0.1, "مخبونة"), V("101110", "مُسْتَعِلن", 0.2, "مطوية"), V("11110", "مُتَعِلن", 0.5, "مخبولة")];
  var MUTAFA = [V("1110110", "متَفاعلن"), V("1010110", "متْفاعلن", 0.1, "مضمرة"), V("110110", "مُفاعلن", 0.8, "موقوصة"), V("101110", "مُتْفَعِلن", 0.9, "مخزولة")];
  var MUFALATUN = [V("1101110", "مفاعلَتن"), V("1101010", "مفاعلْتن", 0.1, "معصوبة"), V("110110", "مفاعَتن", 0.9, "معقولة")];
  var MAFOOLATU = [V("101101", "مفعُلاتُ", 0, "مطوية"), V("1010101", "مفعولاتُ", 0.4), V("110101", "معولاتُ", 0.3, "مخبونة")];
  var MUSTAF_LUN = [V("1010110", "مستفعِ لن"), V("110110", "متفعِ لن", 0.1, "مخبونة")];
  var KHABAB = [V("1110", "فعِلن"), V("1010", "فعْلن", 0.05, "مقطوعة")];
  var HAZAJ = [V("1101010", "مفاعيلن"), V("110101", "مفاعيلُ", 0.2, "مكفوفة")];
  var FORMS = [
    { meter: "الطويل", form: "تام", prior: 0, slots: [
      FAOOLUN,
      MAFAEELUN,
      FAOOLUN,
      [V("110110", "مفاعلن", 0, "مقبوضة"), V("1101010", "مفاعيلن", 0), V("11010", "فعولن", 0.2, "محذوفة")]
    ] },
    { meter: "المديد", form: "تام", prior: 0.3, slots: [
      FAELATUN,
      FAELUN,
      [V("1011010", "فاعلاتن"), V("111010", "فعِلاتن", 0.1, "مخبونة"), V("10110", "فاعلن", 0, "محذوفة"), V("1110", "فعِلن", 0, "محذوفة مخبونة"), V("101100", "فاعلانْ", 0.3, "مقصورة"), V("1010", "فعْلن", 0.3, "بتراء")]
    ] },
    { meter: "البسيط", form: "تام", prior: 0, slots: [
      MUSTAF,
      FAELUN,
      MUSTAF,
      [V("1110", "فعِلن", 0, "مخبونة"), V("10110", "فاعلن", 0.2), V("1010", "فعْلن", 0.2, "مقطوعة")]
    ] },
    { meter: "البسيط", form: "مجزوء", prior: 0.3, slots: [
      MUSTAF,
      FAELUN,
      [V("1010110", "مستفعلن"), V("110110", "مُتَفْعِلن", 0.1, "مخبونة"), V("101010", "مستفعلْ", 0.2, "مقطوعة"), V("10101100", "مستفعلانْ", 0.4, "مذالة")]
    ] },
    { meter: "البسيط", form: "مخلع", prior: 0.1, slots: [
      MUSTAF,
      FAELUN,
      [V("11010", "فعولن", 0, "مخلّعة")]
    ] },
    { meter: "الوافر", form: "تام", prior: 0, slots: [
      MUFALATUN,
      MUFALATUN,
      [V("11010", "فعولن", 0, "مقطوفة")]
    ] },
    { meter: "الوافر", form: "مجزوء", prior: 0.2, slots: [
      MUFALATUN,
      [V("1101110", "مفاعلَتن"), V("1101010", "مفاعلْتن", 0.1, "معصوبة")]
    ] },
    { meter: "الكامل", form: "تام", prior: 0, slots: [
      MUTAFA,
      MUTAFA,
      [V("1110110", "متَفاعلن"), V("1010110", "متْفاعلن", 0.1, "مضمرة"), V("111010", "فعِلاتن", 0.2, "مقطوعة"), V("101010", "مفعولن", 0.3, "مضمرة مقطوعة"), V("1110", "فعِلن", 0.2, "حذّاء"), V("1010", "فعْلن", 0.3, "حذّاء مضمرة")]
    ] },
    { meter: "الكامل", form: "مجزوء", prior: 0.2, slots: [
      MUTAFA,
      [V("1110110", "متَفاعلن"), V("1010110", "متْفاعلن", 0.1, "مضمرة"), V("111010", "فعِلاتن", 0.2, "مقطوعة"), V("101010", "مفعولن", 0.3, "مضمرة مقطوعة"), V("11101100", "متفاعلانْ", 0.3, "مذيّلة"), V("111011010", "متفاعلاتن", 0.3, "مرفّلة"), V("10101100", "متْفاعلانْ", 0.4, "مذيّلة مضمرة"), V("101011010", "متْفاعلاتن", 0.4, "مرفّلة مضمرة")]
    ] },
    { meter: "الهزج", form: "مجزوء", prior: 0.25, slots: [
      HAZAJ,
      [V("1101010", "مفاعيلن"), V("11010", "فعولن", 0.3, "محذوفة")]
    ] },
    { meter: "الرجز", form: "تام", prior: 0.2, slots: [
      MUSTAF,
      MUSTAF,
      [...MUSTAF, V("101010", "مستفعلْ", 0.2, "مقطوعة"), V("11010", "متفعلْ", 0.4, "مخبونة مقطوعة")]
    ] },
    { meter: "الرجز", form: "مجزوء", prior: 0.4, slots: [
      MUSTAF,
      [...MUSTAF, V("101010", "مستفعلْ", 0.2, "مقطوعة"), V("11010", "متفعلْ", 0.4, "مخبونة مقطوعة")]
    ] },
    { meter: "الرمل", form: "تام", prior: 0.1, slots: [
      FAELATUN,
      FAELATUN,
      [V("10110", "فاعلن", 0, "محذوفة"), V("1110", "فعِلن", 0, "محذوفة مخبونة"), V("101100", "فاعلانْ", 0.3, "مقصورة"), V("11100", "فعِلانْ", 0.4, "مقصورة مخبونة"), V("1011010", "فاعلاتن", 0.5), V("111010", "فعِلاتن", 0.6, "مخبونة")]
    ] },
    { meter: "الرمل", form: "مجزوء", prior: 0.3, slots: [
      FAELATUN,
      [V("1011010", "فاعلاتن"), V("111010", "فعِلاتن", 0.1, "مخبونة"), V("10110", "فاعلن", 0.3, "محذوفة"), V("1110", "فعِلن", 0.3, "محذوفة مخبونة"), V("10110100", "فاعلاتانْ", 0.4, "مسبّغة"), V("101100", "فاعلانْ", 0.4, "مقصورة")]
    ] },
    { meter: "السريع", form: "تام", prior: 0.1, slots: [
      MUSTAF,
      MUSTAF,
      [V("10110", "فاعلن", 0, "مطوية مكشوفة"), V("1110", "فعِلن", 0, "مخبولة مكشوفة"), V("101100", "فاعلانْ", 0.3, "مطوية موقوفة"), V("1010", "فعْلن", 0.4, "صلماء")]
    ] },
    { meter: "المنسرح", form: "تام", prior: 0.1, slots: [
      MUSTAF,
      MAFOOLATU,
      [V("101110", "مفتعلن", 0, "مطوية"), V("1010110", "مستفعلن", 0.2), V("11110", "فعِلتن", 0.5, "مخبولة"), V("101010", "مفعولن", 0.4, "مقطوعة"), V("110110", "مُتَفْعِلن", 0.4, "مخبونة")]
    ] },
    { meter: "المنسرح", form: "منهوك", prior: 0.8, slots: [
      MUSTAF,
      [V("1010101", "مفعولاتُ", 0), V("101010", "مفعولن", 0.1, "موقوفة"), V("110101", "معولاتُ", 0.2)]
    ] },
    { meter: "الخفيف", form: "تام", prior: 0, slots: [
      FAELATUN,
      MUSTAF_LUN,
      [V("1011010", "فاعلاتن"), V("111010", "فعِلاتن", 0, "مخبونة"), V("101010", "فالاتن", 0.2, "مشعّثة"), V("10110", "فاعلن", 0.3, "محذوفة"), V("1110", "فعِلن", 0.3, "محذوفة مخبونة")]
    ] },
    { meter: "الخفيف", form: "مجزوء", prior: 0.3, slots: [
      FAELATUN,
      [V("1010110", "مستفعِ لن"), V("110110", "متفعِ لن", 0.1, "مخبونة"), V("11010", "فعولن", 0.4, "مخبونة مقصورة")]
    ] },
    { meter: "المضارع", form: "مجزوء", prior: 0.6, slots: [
      [V("110101", "مفاعيلُ", 0, "مكفوفة"), V("110110", "مفاعلن", 0.2, "مقبوضة"), V("1101010", "مفاعيلن", 0.5)],
      [V("1011010", "فاعِ لاتن")]
    ] },
    { meter: "المقتضب", form: "مجزوء", prior: 0.6, slots: [
      [V("101101", "مفعُلاتُ", 0, "مطوية"), V("110101", "معولاتُ", 0.3, "مخبونة")],
      [V("101110", "مفتعلن", 0, "مطوية"), V("1010110", "مستفعلن", 0.4)]
    ] },
    { meter: "المجتث", form: "مجزوء", prior: 0.3, slots: [
      MUSTAF_LUN,
      [V("1011010", "فاعلاتن"), V("111010", "فعِلاتن", 0, "مخبونة"), V("101010", "فالاتن", 0.3, "مشعّثة")]
    ] },
    { meter: "المتقارب", form: "تام", prior: 0, slots: [
      FAOOLUN,
      FAOOLUN,
      FAOOLUN,
      [V("11010", "فعولن"), V("1101", "فعولُ", 0.3, "مقبوضة"), V("1100", "فعولْ", 0.2, "مقصورة"), V("110", "فعو", 0.1, "محذوفة"), V("10", "فعْ", 0.4, "بتراء")]
    ] },
    { meter: "المتقارب", form: "مجزوء", prior: 0.4, slots: [
      FAOOLUN,
      FAOOLUN,
      [V("11010", "فعولن"), V("1100", "فعولْ", 0.2, "مقصورة"), V("110", "فعو", 0.1, "محذوفة"), V("10", "فعْ", 0.4, "بتراء")]
    ] },
    { meter: "المتدارك", form: "تام", prior: 0.45, slots: [
      FAELUN,
      FAELUN,
      FAELUN,
      [...FAELUN, V("101100", "فاعلانْ", 0.3, "مذالة"), V("11100", "فعِلانْ", 0.4, "مذالة مخبونة")]
    ] },
    { meter: "المتدارك", form: "تام", prior: 0.45, slots: [
      KHABAB,
      KHABAB,
      KHABAB,
      [...KHABAB, V("11100", "فعِلانْ", 0.4, "مذالة مخبونة")]
    ] },
    { meter: "المتدارك", form: "مجزوء", prior: 0.75, slots: [
      FAELUN,
      FAELUN,
      [...FAELUN, V("101100", "فاعلانْ", 0.3, "مذالة"), V("10110100", "فاعلاتن", 0.4, "مرفّلة")]
    ] },
    { meter: "المتدارك", form: "مجزوء", prior: 0.75, slots: [KHABAB, KHABAB, KHABAB.concat([])] }
  ];
  var METER_INFO = {
    "الطويل": { key: "طويلٌ له دون البحور فضائلُ", feet: "فعولن مفاعيلن فعولن مفاعلن" },
    "المديد": { key: "لمديدِ الشعرِ عندي صفاتُ", feet: "فاعلاتن فاعلن فاعلاتن" },
    "البسيط": { key: "إنّ البسيطَ لديه يُبسَطُ الأملُ", feet: "مستفعلن فاعلن مستفعلن فعِلن" },
    "الوافر": { key: "بحورُ الشعرِ وافرُها جميلُ", feet: "مفاعلَتن مفاعلَتن فعولن" },
    "الكامل": { key: "كمُلَ الجمالُ من البحورِ الكاملُ", feet: "متَفاعلن متَفاعلن متَفاعلن" },
    "الهزج": { key: "على الأهزاجِ تسهيلُ", feet: "مفاعيلن مفاعيلن" },
    "الرجز": { key: "في أبحرِ الأرجازِ بحرٌ يسهلُ", feet: "مستفعلن مستفعلن مستفعلن" },
    "الرمل": { key: "رمَلُ الأبحرِ ترويهِ الثقاتُ", feet: "فاعلاتن فاعلاتن فاعلن" },
    "السريع": { key: "بحرٌ سريعٌ ما له ساحلُ", feet: "مستفعلن مستفعلن فاعلن" },
    "المنسرح": { key: "منسرحٌ فيه يُضرَبُ المثلُ", feet: "مستفعلن مفعولاتُ مفتعلن" },
    "الخفيف": { key: "يا خفيفاً خفّتْ به الحركاتُ", feet: "فاعلاتن مستفعِ لن فاعلاتن" },
    "المضارع": { key: "تُعَدُّ المضارعاتُ", feet: "مفاعيلُ فاعِ لاتن" },
    "المقتضب": { key: "اقتضِبْ كما سألوا", feet: "مفعولاتُ مفتعلن" },
    "المجتث": { key: "إنْ جُثّتِ الحركاتُ", feet: "مستفعِ لن فاعلاتن" },
    "المتقارب": { key: "عن المتقاربِ قال الخليلُ", feet: "فعولن فعولن فعولن فعولن" },
    "المتدارك": { key: "حركاتُ المحدَثِ تنتقلُ", feet: "فعِلن فعِلن فعِلن فعِلن" }
  };

  // src/engine.js
  var E = 5;
  var PRUNE = 8;
  var HEUR_BASE = 1.6;
  var SPECIAL = {
    "هذا": ["هَاذَا"],
    "هذه": ["هَاذِهِ", "هَاذِهِي"],
    "هذي": ["هَاذِي"],
    "هذان": ["هَاذَانِ"],
    "هذين": ["هَاذَيْنِ"],
    "هولاء": ["هَاؤُلَاءِ"],
    "ذلك": ["ذَالِكَ"],
    "ذلكم": ["ذَالِكُمْ", "ذَالِكُمُو"],
    "ذلكما": ["ذَالِكُمَا"],
    "لكن": ["لَاكِنْ", "لَاكِنَّ"],
    "لكنه": ["لَاكِنَّهُ", "لَاكِنَّهُو"],
    "لكنها": ["لَاكِنَّهَا"],
    "لكنهم": ["لَاكِنَّهُمْ", "لَاكِنَّهُمُو"],
    "لكنني": ["لَاكِنَّنِي"],
    "لكني": ["لَاكِنِّي"],
    "لكنما": ["لَاكِنَّمَا"],
    "لكننا": ["لَاكِنَّنَا"],
    "هكذا": ["هَاكَذَا"],
    "الرحمن": ["اَلرَّحْمَانِ"],
    "رحمن": ["رَحْمَانُ"],
    "الاله": ["اَلْإِلَاهُ"],
    "اله": ["إِلَاهُ", "إِلَهُ"],
    "الهي": ["إِلَاهِي"],
    "الهنا": ["إِلَاهَنَا"],
    "اولئك": ["أُلَائِكَ"],
    "اولاء": ["أُلَاءِ"],
    "اولو": ["أُلُو"],
    "اولي": ["أُلِي"],
    "اولات": ["أُلَاتُ"],
    "عمرو": ["عَمْرُ", "عَمْرٌ"],
    "طه": ["طَاهَا"],
    "داود": ["دَاوُودُ"],
    "طاوس": ["طَاوُوسُ"],
    "ماية": ["مِئَةٌ", "مِئَةُ"],
    "لله": ["لِلَّهِ"],
    "الله": ["اللَّهُ", "اللَّهِ"],
    "اللهم": ["اللَّهُمَّ"],
    "كذلك": ["كَذَالِكَ"],
    "لذلك": ["لِذَالِكَ"],
    "بذلك": ["بِذَالِكَ"],
    "انا": ["أَنَا", "أَنَ"],
    "لانا": ["لِأَنَّا"]
  };
  var PROCLITICS = [
    ["و", "وَ"],
    ["ف", "فَ"],
    ["ب", "بِ"],
    ["ل", "لِ"],
    ["ك", "كَ"],
    ["س", "سَ"],
    ["وب", "وَبِ"],
    ["ول", "وَلِ"],
    ["فب", "فَبِ"],
    ["فل", "فَلِ"],
    ["وك", "وَكَ"],
    ["فك", "فَكَ"],
    ["وس", "وَسَ"],
    ["فس", "فَسَ"],
    ["ا", "أَ"],
    ["او", "أَوَ"],
    ["اف", "أَفَ"],
    ["اب", "أَبِ"]
  ];
  var DICT = /* @__PURE__ */ new Map();
  function setDictionary(map) {
    DICT = map;
  }
  function dictionarySize() {
    return DICT.size;
  }
  function parseDictionary(text) {
    const m = /* @__PURE__ */ new Map();
    for (const line of text.split("\n")) {
      if (!line) continue;
      const parts = line.split("	");
      const forms = parts.slice(1);
      if (forms[0] && forms[0][0] === "!") {
        const fl = forms.shift().slice(1);
        forms.flags = fl || null;
      }
      m.set(parts[0], forms);
    }
    return m;
  }
  function mkCand(an, cost, display, src, generic = false, form = null) {
    return { units: an.units, wasl: an.wasl, endType: endTypeOf(an.units), cost, display, form: form || display, src, generic, bits: bits(an.units) };
  }
  function lastLetter(w) {
    const s = stripMarks(w);
    return s[s.length - 1];
  }
  function endingVariants(c, word, extra = 0.4, flags = null) {
    const cost = (t, base = extra) => flags && !flags.includes(t) ? Math.max(base, 1.05) : base;
    const out = [c];
    const U = c.units, n = U.length;
    const last = U[n - 1];
    const defin = /^(ال|وال|فال|بال|كال|لل)/.test(keyOf(word));
    const ll = lastLetter(word);
    const push = (units, dc, tag) => {
      if (!units.length || units[0].b === "0") return;
      const b = units.map((x) => x.b).join("");
      if (/00/.test(b.slice(0, -1))) return;
      out.push({ ...c, units, endType: endTypeOf(units), cost: c.cost + dc, bits: b, display: c.display, src: c.src + tag });
    };
    if (last.b === "1" && last.k !== "w") {
      if (!defin && n >= 2 && !"اىوي".includes(ll)) push([...U, { b: "0", t: "نْ", k: "n" }], cost("n"), "+ن");
      if (n >= 2 && U[n - 2].b === "1") push([...U.slice(0, -1), { b: "0", t: stripMarks(last.t) + SUKUN, k: "c" }], cost("s"), "+سكون");
      if (n >= 3 && U[n - 2].b === "0" && U[n - 2].k === "m") {
        const units = [...U.slice(0, -1), { b: "0", t: stripMarks(last.t) + SUKUN, k: "c" }];
        out.push({ ...c, units, endType: "c", cost: c.cost + 0.2, bits: bits(units), src: c.src + "+وقف", endOnly: true });
      }
      if ((ll === "ه" || ll === "م") && n >= 2) push([...U, { b: "0", t: ishbaaText(last), k: "m" }], ll === "ه" ? 0.12 : 0.25, "+إشباع");
    } else if (last.k === "m" && ll === "ي" && n >= 3 && U[n - 2].b === "1") {
      push([...U.slice(0, -1), { b: "1", t: "يَ", k: "c" }], extra, "+فتح الياء");
    } else if (last.k === "n") {
      push(U.slice(0, -1), cost("v"), "-تنوين");
    } else if (last.k === "c" && last.b === "0" && n >= 2 && U[n - 2].b === "1") {
      push([...U.slice(0, -1), { b: "1", t: stripMarks(last.t) + KASRA, k: "c" }], cost("v"), "+حركة");
    }
    return out;
  }
  function formsToCands(forms, baseCost, src) {
    const out = [];
    forms.forEach((f, i) => {
      const an = analyzeVocalized(f, { lenient: true });
      if (!an) return;
      const c = mkCand(an, baseCost + i * 0.15, f, src);
      c.flags = forms.flags !== void 0 ? forms.flags : src === "خاص" ? "x" : null;
      out.push(c);
    });
    return out;
  }
  function heuristicCands(skel, limit = 70) {
    const L = [...skel];
    const n = L.length;
    const results = [];
    const startArticle = n >= 4 && L[0] === "ا" && L[1] === "ل";
    function rec(i, acc, cost) {
      if (cost > HEUR_BASE + 2.2) return;
      if (i === n) {
        results.push([acc, cost]);
        return;
      }
      const l = L[i];
      const last = i === n - 1;
      if (i === 0) {
        if (startArticle) {
          if (SHAMSI.has(L[2]) && L[2] !== "ل") {
            rec(3, "ال" + L[2] + SHADDA + FATHA, cost);
          }
          rec(2, "ال" + SUKUN, cost + (SHAMSI.has(L[2]) ? 0.6 : 0));
          rec(1, "أَ", cost + 0.9);
          return;
        }
        if (l === "ا") {
          rec(1, "أَ", cost + 0.05);
          rec(1, "ا", cost + 0.5);
          return;
        }
        if ("آ".includes(l)) {
          rec(1, "آ", cost);
          return;
        }
        rec(1, l + FATHA, cost);
        return;
      }
      if (l === "ا" || l === "ى") {
        if (last && l === "ا" && L[i - 1] === "و") {
          rec(i + 1, acc + "ا", cost);
          return;
        }
        if (l === "ا" && i <= 2 && !last && L.slice(0, i).every((x) => "وفبكل".includes(x))) {
          if (L[i + 1] === "ل" && i + 2 < n) {
            if (SHAMSI.has(L[i + 2]) && L[i + 2] !== "ل") rec(i + 3, acc + "ال" + L[i + 2] + SHADDA + FATHA, cost);
            rec(i + 2, acc + "ال" + SUKUN, cost + (SHAMSI.has(L[i + 2]) ? 0.6 : 0));
          }
          rec(i + 1, acc + "ا" + KASRA, cost + 0.3);
          rec(i + 1, acc + "ا", cost + 0.2);
          return;
        }
        rec(i + 1, acc + l, cost);
        return;
      }
      if (l === "آ") {
        rec(i + 1, acc + "آ", cost);
        return;
      }
      if (l === "و" || l === "ي") {
        const accM = acc.endsWith(FATHA) ? acc.slice(0, -1) + (l === "و" ? DAMMA : KASRA) : acc;
        rec(i + 1, accM + l, cost + 0.05);
        if (acc.endsWith(FATHA)) rec(i + 1, acc + l + SUKUN, cost + 0.25);
        rec(i + 1, acc + l + FATHA, cost + 0.15);
        if (!last) rec(i + 1, acc + l + SHADDA + FATHA, cost + 0.8);
        if (last) rec(i + 1, acc + l + SHADDA + FATHA, cost + 0.9);
        return;
      }
      if (last) {
        rec(i + 1, acc + l + FATHA, cost);
        rec(i + 1, acc + l + SUKUN, cost + 0.35);
        if (l !== "ه" || L[i - 1] === "ا") rec(i + 1, acc + l + DAMMATAN, cost + 0.4);
        return;
      }
      rec(i + 1, acc + l + FATHA, cost);
      rec(i + 1, acc + l + SUKUN, cost + 0.2);
      rec(i + 1, acc + l + SHADDA + FATHA, cost + 0.75);
    }
    rec(0, "", HEUR_BASE);
    const seen = /* @__PURE__ */ new Map();
    for (const [form, cost] of results) {
      const an = analyzeVocalized(form, { lenient: true });
      if (!an) continue;
      const b = bits(an.units);
      const endOnly = /00$/.test(b);
      if (/00/.test(endOnly ? b.slice(0, -1) : b) || /11111/.test(b)) continue;
      const c4 = (b.match(/1111/g) || []).length;
      const c3 = (b.match(/111/g) || []).length;
      const cc = cost + c4 * 0.4 + c3 * 0.1;
      const k = b + "|" + an.wasl + "|" + endTypeOf(an.units);
      if (!seen.has(k) || seen.get(k).cost > cc) {
        const display = form.replace(new RegExp(FATHA, "g"), "");
        const cand = mkCand(an, cc + (endOnly ? 0.3 : 0), display, "تقدير", true, form);
        if (endOnly) cand.endOnly = true;
        seen.set(k, cand);
      }
    }
    const list = [...seen.values()].sort((a, b) => a.cost - b.cost).slice(0, limit);
    const ll = L[n - 1];
    if (ll === "ه" || ll === "م") {
      for (const c of list.slice()) {
        const U = c.units;
        if (U[U.length - 1].b === "1" && U.length >= 2) {
          const units = [...U, { b: "0", t: ishbaaText(U[U.length - 1]), k: "m" }];
          list.push({ ...c, units, endType: "m", bits: c.bits + "0", cost: c.cost + 0.15 });
        }
      }
    }
    return list;
  }
  function markClass(t) {
    if (!t) return null;
    if (t.sh) return "SH";
    if (t.tn) return "T";
    if (t.su) return "S";
    if (t.v) return "V";
    return null;
  }
  function compatible(userTok, candWord) {
    const C = parseWord(candWord);
    if (C.length !== userTok.length) return true;
    for (let i = 0; i < userTok.length - 1; i++) {
      const uc = markClass(userTok[i]);
      if (!uc) continue;
      const cc = markClass(C[i]);
      if (cc === uc) continue;
      if (uc === "V" && (cc === "SH" || cc === "T")) continue;
      if (uc === "S" && cc === null) continue;
      if (cc === null && "اىوي".includes(C[i].l)) continue;
      return false;
    }
    return true;
  }
  function endCompatible(userTok, c) {
    const t = userTok[userTok.length - 1];
    const last = c.units[c.units.length - 1];
    if (!t || !t.marked || "اىوي".includes(t.l)) return true;
    if (t.tn) return last.k === "n";
    if (t.su) return last.b === "0" && last.k !== "n" && last.k !== "m";
    if (t.v) return last.b === "1" || last.k === "m";
    return true;
  }
  function mergeDisplay(userWord, candWord) {
    const U = parseWord(userWord), C = parseWord(candWord);
    if (U.length !== C.length || !U.some((t) => t.marked)) return candWord;
    let o = "";
    for (let i = 0; i < U.length; i++) {
      const marks = U[i].marked ? U[i].m : C[i].m;
      o += U[i].l + marks.join("");
    }
    return o;
  }
  function skeletonPenalty(userWord, candWord) {
    const a = stripMarks(userWord), b = stripMarks(candWord);
    if (a === b || a.length !== b.length) return 0;
    let p = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if ("ىي".includes(a[i]) && "ىي".includes(b[i])) p += i === a.length - 1 ? 1.3 : 0.6;
      else if ("ةه".includes(a[i]) && "ةه".includes(b[i])) p += 0.6;
      else if ("اأإآ".includes(a[i]) && "اأإآ".includes(b[i])) p += a[i] === "ا" ? i === 0 ? 0 : 0.6 : 0.1;
    }
    return p;
  }
  var candCache = /* @__PURE__ */ new Map();
  function wordCandidates(word) {
    const cached = candCache.get(word);
    if (cached) return cached;
    const res = buildCandidates(word);
    if (candCache.size > 2e4) candCache.clear();
    candCache.set(word, res);
    return res;
  }
  var ENCLITICS = [
    ["هما", [["1", "هُ"], ["1", "مَ"], ["0", "ا", "m"]]],
    ["كما", [["1", "كُ"], ["1", "مَ"], ["0", "ا", "m"]]],
    ["هم", [["1", "هُ"], ["0", "مْ"]]],
    ["كم", [["1", "كُ"], ["0", "مْ"]]],
    ["هن", [["1", "هُ"], ["0", "نْ"], ["1", "نَ"]]],
    ["كن", [["1", "كُ"], ["0", "نْ"], ["1", "نَ"]]],
    ["ها", [["1", "هَ"], ["0", "ا", "m"]]],
    ["نا", [["1", "نَ"], ["0", "ا", "m"]]],
    ["ني", [["1", "نِ"], ["0", "ي", "m"]]],
    ["ه", [["1", "هُ"]]],
    ["ك", [["1", "كَ"]]],
    ["ي", [["0", "ي", "m"]], KASRA],
    ["ا", [["0", "ا", "m"]], FATHA]
  ];
  function directCands(key) {
    const out = [];
    if (SPECIAL[key]) out.push(...formsToCands(SPECIAL[key], 0, "خاص"));
    if (DICT.has(key)) out.push(...formsToCands(DICT.get(key), 0, "القاموس"));
    return out;
  }
  function lookupCands(key) {
    const out = directCands(key);
    for (const [suf, su, vowel] of ENCLITICS) {
      if (!key.endsWith(suf) || key.length - suf.length < 2) continue;
      const b0 = key.slice(0, -suf.length);
      const bases = [b0];
      if (b0.endsWith("ت")) bases.push(b0.slice(0, -1) + "ه");
      for (const bk of bases) {
        if (!DICT.has(bk)) continue;
        for (const c of formsToCands(DICT.get(bk), 0.3, "القاموس")) {
          let U = c.units.slice();
          if (U[U.length - 1].k === "n") U.pop();
          const last = U[U.length - 1];
          if (last.k === "m") {
            if (suf === "ا" || suf === "ي") continue;
          } else {
            let letter = stripMarks(last.t);
            if (letter === "ة") letter = "ت";
            U[U.length - 1] = { b: "1", t: letter + (vowel || ([...last.t].find((x) => x === FATHA || x === DAMMA || x === KASRA) || FATHA)), k: "c" };
          }
          const units = [...U, ...su.map(([b, t, k]) => ({ b, t, k: k || "c" }))];
          const bb = bits(units);
          if (/00/.test(bb.slice(0, -1))) continue;
          const disp = units.map((x) => x.t).join("").replace(/^ا[\u064E]/, "ا");
          const form = c.display.replace(/[\u064B-\u0652]*$/, "").replace(/ة$/, "ت") + (vowel || "") + suf;
          out.push({ units, wasl: c.wasl, endType: endTypeOf(units), cost: c.cost, display: form, form, src: "القاموس", generic: false, bits: bb, flags: null });
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
    const hasMarks = userToks.some((t) => t.marked);
    let base = [];
    if (hasMarks && userFullyMarked(userToks)) {
      const an = analyzeVocalized(word);
      const sp = SPECIAL[key] || PROCLITICS.some(([p]) => key.startsWith(p) && SPECIAL[key.slice(p.length)]);
      if (an && !sp) {
        const c = mkCand(an, 0, word, "تشكيلك");
        const lastTok = userToks[userToks.length - 1];
        const out = lastTok.marked && !"اىوي".includes(lastTok.l) ? [c] : endingVariants(c, word, 0.3);
        if (out.length === 1) {
          const ll = lastLetter(word);
          if ((ll === "ه" || ll === "م") && c.units[c.units.length - 1].b === "1") out.push(...endingVariants(c, word, 9).filter((x) => x.src.endsWith("إشباع")));
        }
        return out;
      }
    }
    for (const c of lookupCands(key)) base.push(...endingVariants(c, c.display, 0.4, c.flags));
    for (const [p, pv] of PROCLITICS) {
      if (!key.startsWith(p) || key.length - p.length < 2) continue;
      const rest = key.slice(p.length);
      const variants = [rest];
      if (p.endsWith("ل") && rest.startsWith("ل")) variants.push("ا" + rest);
      const pan = analyzeVocalized(pv);
      for (const r of variants) {
        for (const c of lookupCands(r)) {
          let bu = c.units;
          if (c.wasl) bu = bu.slice(1);
          if (!bu.length) continue;
          const units = [...pan.units, ...bu];
          const b = bits(units);
          if (/00/.test(b.slice(0, -1))) continue;
          const disp = pv + (c.wasl ? c.display.replace(/^[اٱ][\u064B-\u0652]*/, "ا") : c.display);
          const cc = { units, wasl: false, endType: endTypeOf(units), cost: c.cost + 0.1 * p.length + 0.05, display: disp, form: disp, src: "القاموس", generic: false, bits: b };
          base.push(...endingVariants(cc, disp, 0.4, c.flags));
        }
      }
    }
    const found = base.length > 0;
    base.push(...heuristicCands(skel, found ? 40 : 90).map((c) => found ? { ...c, cost: c.cost + 1.2 } : c));
    if (hasMarks) {
      const f = base.filter((c) => compatible(userToks, c.form || c.display) && endCompatible(userToks, c));
      if (f.length) base = f;
      base = base.map((c) => ({ ...c, display: mergeDisplay(word, c.display) }));
    }
    base = base.map((c) => c.generic ? c : { ...c, cost: c.cost + skeletonPenalty(word, c.form || c.display) });
    const best = /* @__PURE__ */ new Map();
    for (const c of base) {
      const k = c.bits + "|" + c.wasl + "|" + c.endType + "|" + !!c.endOnly;
      const prev = best.get(k);
      if (!prev || prev.cost > c.cost) best.set(k, c);
    }
    return [...best.values()].sort((a, b) => a.cost - b.cost);
  }
  var NFA = null;
  var NFA_CACHE = /* @__PURE__ */ new Map();
  var FORMS2 = FORMS.map((F) => ({ ...F, slots: [...F.slots, ...F.slots], double: true }));
  function getNFA(forms) {
    let n = NFA_CACHE.get(forms);
    if (!n) {
      n = buildNFA(forms);
      NFA_CACHE.set(forms, n);
    }
    return n;
  }
  function buildNFA(FORMS3) {
    const nodes = [];
    const starts = [];
    const node = (form, slot, extra = {}) => {
      nodes.push({ form, slot, edges: [], accept: -1, ...extra });
      return nodes.length - 1;
    };
    FORMS3.forEach((F, fi) => {
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
    if (!e || cost < e.cost - 1e-9 || Math.abs(cost - e.cost) < 1e-9 && err < e.err) {
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
          relax(map, ed.to, c, e.err + 1, { op: "i", exp: ed.ch, w, slot: ed.slot, vi: ed.vi, form: nodes[nd].form, prev: e.back });
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
      const nxt = /* @__PURE__ */ new Map();
      for (const [nd, e] of cur) {
        for (const ed of nodes[nd].edges) {
          const ok = ed.ch === it.b;
          relax(
            nxt,
            ed.to,
            e.cost + ed.cost + (ok ? 0 : E),
            e.err + (ok ? 0 : 1),
            { op: ok ? "m" : "s", got: it.b, exp: ed.ch, w: it.w, ui: it.ui, slot: ed.slot, vi: ed.vi, form: nodes[nd].form, prev: e.back }
          );
        }
        relax(nxt, nd, e.cost + E, e.err + 1, { op: "d", got: it.b, w: it.w, ui: it.ui, slot: nodes[nd].slot, form: nodes[nd].form, prev: e.back });
      }
      closure(nxt, it.w, 1);
      prune(nxt);
      cur = nxt;
    }
    return cur;
  }
  function resolveHeld(type, waslNext) {
    if (type === "v") return "1";
    if (type === "m") return waslNext ? null : "0";
    if (type === "c") return waslNext ? "1" : "0";
    return null;
  }
  function matchHemistich(words, opts = {}) {
    const forms = opts.double ? FORMS2 : FORMS;
    NFA = getNFA(forms);
    const { nodes, starts } = NFA;
    const formFilter = opts.forms || null;
    const cands = words.map((w) => wordCandidates(w));
    let groups = /* @__PURE__ */ new Map([["x", /* @__PURE__ */ new Map()]]);
    starts.forEach((s, fi) => {
      if (formFilter && !formFilter.has(fi)) return;
      groups.get("x").set(s, { cost: forms[fi].prior, err: 0, back: null });
    });
    closure(groups.get("x"), 0, 1);
    for (let i = 0; i < words.length; i++) {
      const ng = /* @__PURE__ */ new Map();
      for (const [type, sub] of groups) {
        if (!sub.size) continue;
        for (const c of cands[i]) {
          if (c.endOnly && i !== words.length - 1) continue;
          const seq = [];
          const waslHere = c.wasl && i > 0;
          if (type !== "x") {
            const hb = resolveHeld(type, waslHere);
            if (hb !== null) seq.push({ b: hb, w: i - 1, ui: "held" });
          }
          const startU = waslHere ? 1 : 0;
          for (let j = startU; j < c.units.length - 1; j++) seq.push({ b: c.units[j].b, w: i, ui: j });
          const start = /* @__PURE__ */ new Map();
          for (const [nd, e] of sub) {
            start.set(nd, { cost: e.cost + c.cost, err: e.err, back: { op: "w", w: i, cand: c, prev: e.back } });
          }
          const res = seq.length ? runSeq(start, seq) : start;
          let tgt = ng.get(c.endType);
          if (!tgt) {
            tgt = /* @__PURE__ */ new Map();
            ng.set(c.endType, tgt);
          }
          for (const [nd, e] of res) relax(tgt, nd, e.cost, e.err, e.back);
        }
      }
      let min = Infinity;
      for (const g of ng.values()) for (const e of g.values()) if (e.cost < min) min = e.cost;
      for (const g of ng.values()) for (const [k, e] of g) if (e.cost > min + PRUNE) g.delete(k);
      groups = ng;
    }
    const final = /* @__PURE__ */ new Map();
    const lw = words.length - 1;
    for (const [type, sub] of groups) {
      let seq = [];
      if (type === "v") seq = [{ b: "1", w: lw, ui: "held" }, { b: "0", w: lw, ui: "ish" }];
      else if (type === "m" || type === "c") seq = [{ b: "0", w: lw, ui: "held" }];
      const res = seq.length ? runSeq(sub, seq) : sub;
      closure(res, lw, 2);
      for (const [nd, e] of res) relax(final, nd, e.cost, e.err, e.back);
    }
    const byForm = /* @__PURE__ */ new Map();
    for (const [nd, e] of final) {
      const fi = nodes[nd].accept;
      if (fi < 0) continue;
      relax(byForm, fi, e.cost, e.err, e.back);
    }
    return { byForm, words, cands, forms };
  }
  var KNOWN = /* @__PURE__ */ new Map();
  for (const F of FORMS) for (const sl of F.slots) for (const v of sl) if (!KNOWN.has(v.p)) KNOWN.set(v.p, { name: v.name, note: v.note });
  function walk(back) {
    const ops = [];
    for (let b = back; b; b = b.prev) ops.push(b);
    return ops.reverse();
  }
  function explain(match, fi) {
    const e = match.byForm.get(fi);
    if (!e) return null;
    const F = match.forms[fi];
    const ops = walk(e.back);
    const chosen = [];
    for (const o of ops) if (o.op === "w") chosen[o.w] = o.cand;
    const unitOf = (o) => {
      const c = chosen[o.w];
      if (!c) return null;
      if (o.ui === "held") return c.units[c.units.length - 1];
      if (o.ui === "ish") return null;
      return c.units[o.ui];
    };
    const textOf = (o) => {
      const c = chosen[o.w];
      if (!c) return "";
      if (o.ui === "ish") return ishbaaText(c.units[c.units.length - 1]);
      const un = unitOf(o);
      if (!un) return "";
      if (o.ui === "held" && o.got === "1" && un.b === "0") {
        return un.k === "n" ? "نِ" : stripMarks(un.t) + KASRA;
      }
      return un.t;
    };
    const feet = F.slots.map((vs, k) => ({ slot: k, exp: "", got: "", text: "", name: null, note: "", ok: true, words: /* @__PURE__ */ new Set() }));
    const errors = [];
    let lastSlot = 0;
    for (const o of ops) {
      if (o.op === "w") continue;
      const k = o.slot != null ? Math.min(o.slot, F.slots.length - 1) : lastSlot;
      lastSlot = k;
      const ft = feet[k];
      if (o.vi != null && o.op !== "d") {
        const v = F.slots[k][o.vi];
        ft.name = v.name;
        ft.note = v.note;
        ft.vp = v.p;
      }
      if (o.op === "m" || o.op === "s") {
        ft.exp += o.exp;
        ft.got += o.got;
        ft.text += textOf(o);
      }
      if (o.op === "d") {
        ft.got += o.got;
        ft.text += textOf(o);
      }
      if (o.op === "i") {
        ft.exp += o.exp;
      }
      if (o.w != null) ft.words.add(o.w);
      if (o.op !== "m") {
        ft.ok = false;
        errors.push({ kind: o.op, foot: k, word: o.w, exp: o.exp, got: o.got });
      }
    }
    return {
      formIndex: fi,
      meter: F.meter,
      form: F.form,
      cost: e.cost,
      err: e.err,
      feet: feet.map((f, k) => ({
        ...f,
        words: [...f.words],
        allowed: F.slots[k].map((v) => ({ p: v.p, name: v.name, note: v.note })),
        gotName: f.ok ? null : KNOWN.get(f.got) || null
      })),
      errors,
      words: match.words.map((w, i) => ({ text: w, display: chosen[i] ? chosen[i].display : w, generic: chosen[i] ? chosen[i].generic : false, src: chosen[i] ? chosen[i].src : "" }))
    };
  }
  var SEP_RE = /\s*(?:\*+|#|…|\.{2,}|\t+|\||٭|✱|ـ{2,}|\s-\s|\s{3,})\s*/;
  function splitVerse(line) {
    const parts = cleanText(line).split(SEP_RE).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return [parts[0], parts.slice(1).join(" ")];
    return [parts[0] || ""];
  }
  function hemiWords(text) {
    return tokenize(text);
  }
  function combine(m1, m2) {
    const scores = [];
    const byKey = /* @__PURE__ */ new Map();
    for (const [fi, e] of m1.byForm) {
      const F = FORMS[fi];
      for (const [fj, e2] of m2.byForm) {
        const G = FORMS[fj];
        if (G.meter !== F.meter || G.form !== F.form) continue;
        const tot = e.cost + e2.cost - F.prior;
        const k = F.meter + "|" + F.form;
        const prev = byKey.get(k);
        if (!prev || prev.cost > tot) byKey.set(k, { meter: F.meter, form: F.form, fi, fj, cost: tot, err: e.err + e2.err });
      }
    }
    for (const v of byKey.values()) scores.push(v);
    scores.sort((a, b) => a.cost - b.cost);
    return scores;
  }
  function bestOf(m) {
    const list = [...m.byForm.entries()].map(([fi, e]) => ({ meter: m.forms[fi].meter, form: m.forms[fi].form, fi, cost: e.cost, err: e.err })).sort((a, b) => a.cost - b.cost);
    const seen = /* @__PURE__ */ new Set();
    return list.filter((x) => {
      const k = x.meter + x.form;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  function isFragment(w) {
    const k = keyOf(w);
    return k.length <= 2 && !DICT.has(k) && !SPECIAL[k];
  }
  function formSet(meter) {
    if (!meter) return null;
    const set = /* @__PURE__ */ new Set();
    FORMS.forEach((F, i) => {
      if (F.meter === meter) set.add(i);
    });
    return set.size ? set : null;
  }
  function analyzeVerse(line, opts = {}) {
    const fs = formSet(opts.meter);
    const parts = Array.isArray(line) ? line : splitVerse(line);
    let w1 = hemiWords(parts[0] || "");
    const w2 = parts[1] ? hemiWords(parts[1]) : null;
    if (w2 && w1.length > 1 && keyOf(w1[w1.length - 1]) === "ال") w1 = w1.slice(0, -1);
    if (!w1.length) return null;
    if (!w2 || !w2.length) {
      const m12 = matchHemistich(w1, { forms: fs });
      let alts = bestOf(m12);
      let best2 = alts[0];
      if (opts.autoSplit !== false && w1.length >= 5 && (!best2 || best2.err > 0 || best2.cost > w1.length * 0.9)) {
        const md = matchHemistich(w1, { double: true, forms: fs });
        const altsD = bestOf(md);
        if (altsD[0] && (!best2 || altsD[0].cost + 0.3 < best2.cost)) {
          const split = splitFromPath(md, altsD[0].fi);
          if (split > 0 && split < w1.length) {
            const r = analyzeVerse([w1.slice(0, split).join(" "), w1.slice(split).join(" ")], { autoSplit: false, meter: opts.meter });
            if (r && r.cost <= altsD[0].cost + 1.5) {
              r.autoSplit = true;
              return r;
            }
          }
          return verseResult(md, altsD, true);
        }
      }
      if (!best2) return null;
      return {
        single: true,
        meter: best2.meter,
        form: best2.form,
        cost: best2.cost,
        exact: best2.err === 0,
        hemistichs: [explain(m12, best2.fi)],
        alternatives: alts.slice(1, 4)
      };
    }
    const m1 = matchHemistich(w1, { forms: fs });
    const m2 = matchHemistich(w2, { forms: fs });
    const scores = combine(m1, m2);
    let best = scores[0];
    let res = best ? {
      single: false,
      meter: best.meter,
      form: best.form,
      cost: best.cost,
      exact: best.err === 0,
      hemistichs: [explain(m1, best.fi), explain(m2, best.fj)],
      alternatives: scores.slice(1, 4)
    } : null;
    if ((!res || !res.exact) && (isFragment(w1[w1.length - 1]) || isFragment(w2[0]))) {
      const joined = [...w1.slice(0, -1), w1[w1.length - 1] + w2[0], ...w2.slice(1)];
      const md = matchHemistich(joined, { double: true, forms: fs });
      const altsD = bestOf(md);
      if (altsD[0] && (!res || altsD[0].cost + 0.5 < res.cost)) return verseResult(md, altsD, false, true);
    }
    if (res) {
      const h2 = res.hemistichs[1];
      const lastW = h2 && h2.words.length ? h2.words[h2.words.length - 1] : null;
      res.rhymeInfo = lastW ? { ...rhymeInfo(lastW.display), word: lastW.text } : null;
      res.rhyme = res.rhymeInfo ? res.rhymeInfo.rawi : rhymeOf(w2[w2.length - 1]);
    }
    return res;
  }
  function rawiIndex(T) {
    const L = T.map((t) => t.l);
    let i = L.length - 1;
    while (i > 0 && "اوىي".includes(L[i]) && !T[i].v && !T[i].sh) i--;
    if (i > 1 && L[i] === "ه" && !T[i].su && !"اوي".includes(L[i - 1])) {
      i--;
      while (i > 0 && "اوىي".includes(L[i]) && !T[i].v && !T[i].sh && i === L.length - 2) i--;
    }
    return i;
  }
  function normRawi(r) {
    if ("أإآؤئء".includes(r)) return "ء";
    if (r === "ة") return "ت";
    if (r === "ى") return "ا";
    return r;
  }
  function rhymeOf(word) {
    if (!word) return null;
    const T = parseWord(cleanText(word));
    if (!T.length) return null;
    return normRawi(T[rawiIndex(T)].l);
  }
  var HARAKA = { [FATHA]: "الفتح", [DAMMA]: "الضم", [KASRA]: "الكسر" };
  var TN2H = { "ً": "الفتح", "ٌ": "الضم", "ٍ": "الكسر" };
  function rhymeInfo(word) {
    if (!word) return null;
    const T = parseWord(cleanText(word));
    if (!T.length) return null;
    const i = rawiIndex(T);
    const t = T[i];
    let haraka = t.su ? "السكون" : t.v ? HARAKA[t.v] : t.tn ? TN2H[t.tn] : null;
    if (!haraka && i < T.length - 1) haraka = { "ا": "الفتح", "و": "الضم", "ي": "الكسر", "ى": "الفتح" }[T[i + 1].l] || null;
    if (!haraka && i === T.length - 1 && !t.marked) haraka = null;
    const p = T[i - 1];
    let ridf = null;
    if (p && i >= 2 && !p.marked && !p.sh) {
      if (p.l === "ا") ridf = "ا";
      else if ((p.l === "و" || p.l === "ي") && (!T[i - 2].marked || T[i - 2].v === (p.l === "و" ? DAMMA : KASRA))) ridf = "وي";
    }
    return { rawi: normRawi(t.l), haraka, ridf, key: rhymeKey(keyOf(word)) };
  }
  function rhymeKey(k) {
    let x = k.replace(/^(وال|فال|بال|كال|لل|ال)/, "");
    if (x === k && /^[وف]/.test(k) && k.length >= 5) x = k.slice(1);
    return x;
  }
  function majorityOf(arr) {
    const c = /* @__PURE__ */ new Map();
    for (const x of arr) if (x != null) c.set(x, (c.get(x) || 0) + 1);
    let best = null, n = 0;
    for (const [k, v] of c) if (v > n) {
      best = k;
      n = v;
    }
    return best;
  }
  function checkRhymes(infos, want = {}) {
    const issues = infos.map(() => []);
    const ok = infos.filter(Boolean);
    if (!ok.length) return { issues, rawi: null };
    const rawi = want.rawi || majorityOf(ok.map((x) => x.rawi));
    const haraka = majorityOf(ok.map((x) => x.haraka));
    const ridfMaj = majorityOf(ok.map((x) => x.ridf || "none"));
    const seen = /* @__PURE__ */ new Map();
    infos.forEach((x, i) => {
      if (!x) return;
      if (x.rawi !== rawi) issues[i].push({ kind: "اختلاف الروي", msg: `رويّ هذا البيت «${x.rawi}» والقصيدة على «${rawi}»` });
      else if (haraka && x.haraka && x.haraka !== haraka) {
        const pair = [x.haraka, haraka];
        const kind = pair.includes("السكون") ? "اختلاف الإطلاق والتقييد" : pair.includes("الفتح") ? "الإصراف" : "الإقواء";
        issues[i].push({ kind, msg: `حركة الروي هنا ${x.haraka} وفي القصيدة ${haraka}` });
      }
      const r = x.ridf || "none";
      if (infos.length > 1 && r !== ridfMaj && x.rawi === rawi) {
        const name = (v) => v === "none" ? "بلا ردف" : v === "ا" ? "مردوفة بالألف" : "مردوفة بالواو أو الياء";
        issues[i].push({ kind: "سناد الردف", msg: `القافية هنا ${name(r)} وفي القصيدة ${name(ridfMaj)}` });
      }
      if (x.key && seen.has(x.key)) issues[i].push({ kind: "الإيطاء", msg: `تكررت كلمة القافية «${x.word || x.key}» من البيت ${seen.get(x.key) + 1}` });
      else if (x.key) seen.set(x.key, i);
    });
    return { issues, rawi, haraka };
  }
  function verseResult(md, alts, auto, madwar = false) {
    const best = alts[0];
    const ex = explain(md, best.fi);
    return {
      single: false,
      joined: true,
      madwar,
      autoSplit: auto,
      meter: best.meter,
      form: best.form,
      cost: best.cost,
      exact: best.err === 0,
      hemistichs: [ex],
      alternatives: alts.slice(1, 4)
    };
  }
  function splitFromPath(md, fi) {
    const e = md.byForm.get(fi);
    const half = md.forms[fi].slots.length / 2;
    const ops = walk(e.back);
    let lastW = -1;
    for (const o of ops) {
      if (o.op === "w" || o.slot == null) continue;
      if (o.slot < half && o.w != null) lastW = Math.max(lastW, o.w);
    }
    for (const o of ops) {
      if (o.op === "w" || o.slot == null || o.w == null) continue;
      if (o.slot >= half) return o.w === lastW ? -1 : o.w;
    }
    return -1;
  }

  // src/explain.js
  var sym = (s) => [...s || ""].map((b) => b === "1" ? "/" : "ه").join("");
  var ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
  function footRole(hemiIndex, k, nFeet, joined) {
    if (joined) {
      const half = nFeet / 2;
      if (k === half - 1) return "العروض";
      if (k === nFeet - 1) return "الضرب";
      return "الحشو";
    }
    if (k === nFeet - 1) return hemiIndex === 1 ? "الضرب" : "العروض";
    return "الحشو";
  }
  function diffKind(got, exp) {
    if (got.length < exp.length) {
      const d = exp.length - got.length;
      return `ناقصة ${d === 1 ? "حرفاً واحداً" : d === 2 ? "حرفين" : d + " أحرف"} عمّا يقتضيه الوزن`;
    }
    if (got.length > exp.length) {
      const d = got.length - exp.length;
      return `زائدة ${d === 1 ? "حرفاً واحداً" : d === 2 ? "حرفين" : d + " أحرف"} على ما يقتضيه الوزن`;
    }
    const parts = [];
    for (let i = 0; i < got.length; i++) {
      if (got[i] === exp[i]) continue;
      parts.push(got[i] === "0" ? "سُكّن فيها ما حقه الحركة" : "حُرّك فيها ما حقه السكون");
    }
    return [...new Set(parts)].join("، و");
  }
  var LETTER = /[\u0621-\u064A\u0671]/;
  function firstBreak(f, got, atEnd) {
    if (!f.text || !got) return null;
    const units = [];
    for (const ch of f.text) {
      if (LETTER.test(ch)) units.push(ch);
      else if (units.length) units[units.length - 1] += ch;
    }
    if (units.length !== got.length) return null;
    if (atEnd) {
      const pre = (f.allowed || []).filter((v) => v.p.length < got.length && got.startsWith(v.p)).sort((a, b) => b.p.length - a.p.length)[0];
      if (pre) return { v: pre, i: pre.p.length, text: f.text, ok: units.slice(0, pre.p.length).join(""), extra: units.slice(pre.p.length).join("") };
    }
    let best = null;
    for (const v of f.allowed || []) {
      let i = 0;
      while (i < got.length && i < v.p.length && got[i] === v.p[i]) i++;
      if (i < got.length && i < v.p.length && (!best || i > best.i)) best = { i, v };
    }
    if (!best) return null;
    return { ...best, text: f.text, ok: units.slice(0, best.i).join(""), at: units[best.i] };
  }
  function brokenFootText(f, k, role, meter, words) {
    const allowed = (f.allowed || []).map((v) => `${v.name} (${sym(v.p)})`);
    const exp = f.vp || f.exp || "";
    const at = (f.words || []).map((i) => words[i] && (words[i].display || words[i].text)).filter(Boolean);
    const where = `التفعيلة ${ORD[k] || k + 1} — ${role}${at.length ? ` عند «${at.join(" ")}»` : ""}`;
    let what;
    const got = f.got || "";
    const sameLen = (f.allowed || []).some((v) => v.p.length === got.length);
    const known = f.gotName && sameLen && !(f.allowed || []).some((v) => v.p === got);
    const pos = firstBreak(f, got, role !== "الحشو");
    if (pos && pos.extra) {
      what = `جاء المقطع «${pos.text}» على (${sym(got)})، فتتم ${pos.v.name} (${sym(pos.v.p)}) عند «${pos.ok}» ويزيد «${pos.extra}»`;
    } else if (pos) {
      what = `جاء المقطع «${pos.text}» على (${sym(got)})، فيستقيم ${pos.ok ? `إلى «${pos.ok}» ` : ""}ثم يأتي «${pos.at}» ${got[pos.i] === "1" ? "متحركاً وحقه السكون" : "ساكناً وحقه الحركة"} في ${pos.v.name} (${sym(pos.v.p)})`;
    } else if (known) {
      what = `جاءت «${f.gotName.name}» (${sym(f.got)})${f.gotName.note ? ` ${f.gotName.note}` : ""}، وهذه الصورة لا تجوز في ${role === "الحشو" ? "حشو" : role === "العروض" ? "عروض" : "ضرب"} ${meter}`;
    } else {
      what = `جاءت (${sym(f.got)})${exp ? ` ${diffKind(f.got, exp)}` : ""}`;
    }
    const can = allowed.length === 1 ? `ولا يجوز هنا إلا ${allowed[0]}` : `والجائز هنا: ${allowed.slice(0, 4).join(" أو ")}`;
    return { where, what, can, text: `${where}: ${what}. ${can}.` };
  }
  function verseProblems(r) {
    const out = [];
    if (!r || !r.hemistichs) return out;
    const joined = !!r.joined;
    const labels = joined ? ["البيت"] : r.single ? ["الشطر"] : ["الصدر", "العجز"];
    r.hemistichs.forEach((h, hi) => {
      if (!h) return;
      h.feet.forEach((f, k) => {
        if (f.ok) return;
        const role = footRole(hi, k, h.feet.length, joined);
        const t = brokenFootText(f, k, role, r.meter, h.words);
        out.push({ hemi: labels[hi], ...t, cut: f.text, text: `${labels[hi]}، ${t.text}` });
      });
    });
    return out;
  }

  // src/craft.js
  var CRAFT_GUIDE = `دليل الصنعة

أولاً: الطبع قبل الصنعة
- المعنى والصورة أولاً، والمحسّن يأتي حيث يأتي طوعاً. المحسّن المجلوب قسراً عيب لا حلية، وقد عاب النقاد الإسراف في البديع.
- لا يلزم في كل بيت محسّن، لكن لا تخلُ القصيدة من صورة حية.
- الشعر الذي يُطرب: لفظ جزل سهل المخرج، ومعنى يفاجئ، وصورة تُرى، وإيقاع داخلي (تكرار حرف، توازن جمل، تقسيم).

ثانياً: البيان
- التشبيه، وأجوده المركب الذي ينقل هيئة كاملة:
  كأن مثار النقع فوق رءوسنا ... وأسيافنا ليل تهاوى كواكبه (بشار)
- الاستعارة: تُعطي المعنى جسداً يتحرك:
  وإذا المنية أنشبت أظفارها ... ألفيت كل تميمة لا تنفع (أبو ذؤيب الهذلي)
- الكناية: تقول الصفة دون أن تسميها:
  طويل النجاد رفيع العماد ... كثير الرماد إذا ما شتا (الخنساء)

ثالثاً: البديع المعنوي
- الطباق: الجمع بين الضدين:
  أما والذي أبكى وأضحك والذي ... أمات وأحيا والذي أمره الأمر (أبو صخر الهذلي)
- المقابلة: معنيان أو أكثر ثم ما يقابلها على الترتيب:
  ما أحسن الدين والدنيا إذا اجتمعا ... وأقبح الكفر والإفلاس بالرجل
- حسن التعليل: أن تدّعي لوصفٍ علةً طريفة غير علته الحقيقية:
  ما به قتل أعاديه ولكن ... يتقي إخلاف ما ترجو الذئاب (المتنبي)
- تأكيد المدح بما يشبه الذم:
  ولا عيب فيهم غير أن سيوفهم ... بهن فلول من قراع الكتائب (النابغة)
- التقسيم: ذكر متعدد ثم إضافة ما لكل واحد إليه:
  ولا يقيم على ضيم يراد به ... إلا الأذلان عير الحي والوتد
  هذا على الخسف مربوط برمته ... وذا يشج فلا يأوي له أحد (المتلمس)
- التعديد: أسماء أو صفات مفردة على سياق واحد تصنع إيقاعاً:
  فالخيل والليل والبيداء تعرفني ... والسيف والرمح والقرطاس والقلم (المتنبي)

رابعاً: البديع اللفظي
- الجناس: تشابه اللفظين واختلاف المعنى، بلا تكلف:
  فدارهم ما دمت في دارهم ... وأرضهم ما دمت في أرضهم
- رد العجز على الصدر: لفظ في أول البيت يعود في آخره:
  سريع إلى ابن العم يلطم وجهه ... وليس إلى داعي الندى بسريع
- التصريع: أن تتفق عروض المطلع وضربه في الروي والوزن، وهو سنة المطالع.

خامساً: المعاني، وبها يزول «الرصّ»
- لا تجعل كل بيت جملة خبرية مستقلة على قالب واحد؛ هذا ما يجعل الكلام منتظماً بلا حياة.
- نوّع الأساليب: النداء، والاستفهام، والتعجب، والأمر، والقسم، والشرط، والتقديم والتأخير:
  أعلل النفس بالآمال أرقبها ... ما أضيق العيش لولا فسحة الأمل (الطغرائي)
- اربط الأبيات بالمعنى لا بحروف العطف وحدها، حتى يسلم كل بيت إلى ما بعده.
- الإيجاز: كل لفظ يعمل؛ لا حشو لإقامة الوزن.

سادساً: بناء القصيدة
- المطلع: مصرَّع، قوي، يُدخل في الغرض أو يمهد له (براعة الاستهلال).
- حسن التخلص: انتقال لطيف بين المعاني لا قفز.
- الختام: بيت محكم سائر يُحفظ كالمثل (حسن الانتهاء).

سابعاً: عيوب تُجتنب
- الحشو والكلمات التي لا عمل لها إلا إقامة الوزن.
- المعاني المبتذلة والصور المستهلكة (كالبدر والأسد بلا جديد).
- التكلف في البديع، والمعاظلة (تعقيد اللفظ)، والإيطاء (تكرار كلمة القافية).
- التضمين العروضي: ألا يتم معنى البيت إلا بما بعده.`;

  // src/ai.js
  var MODELS = [
    { id: "claude-opus-5-5", label: "Opus 5.5 — أجود شعراً" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5 — أسرع وأرخص" }
  ];
  var DEFAULTS = { key: "", composeModel: "claude-opus-5-5", fixModel: "claude-sonnet-5-5", autoFix: true };
  var AUTO_FIX_LIMIT = 3;
  var MAX_FIX_ROUNDS = 3;
  function getSettings() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("wazn.ai") || "{}") };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }
  function saveSettings(s) {
    localStorage.setItem("wazn.ai", JSON.stringify({ ...getSettings(), ...s }));
  }
  function hasKey() {
    return !!getSettings().key;
  }
  var AIError = class extends Error {
  };
  var transport = async (body, key) => {
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new AIError("تعذّر الاتصال. هذه الميزة تحتاج إنترنت.");
    }
    if (!res.ok) {
      let msg = "";
      try {
        msg = (await res.json()).error.message;
      } catch (e) {
      }
      const mk = (t) => {
        const er = new AIError(t);
        er.diag = `HTTP ${res.status}
${msg}`;
        return er;
      };
      if (res.status === 401) throw mk("المفتاح غير صحيح. راجعه في الإعدادات.");
      if (res.status === 403) throw mk("المفتاح لا يملك صلاحية لهذا الطلب.");
      if (res.status === 404) throw mk("النموذج المختار غير متاح لحسابك. غيّره من الإعدادات.");
      if (res.status === 429) throw mk("بلغت حد الطلبات أو حد الصرف. انتظر قليلاً أو راجع حدود حسابك.");
      if (res.status === 529 || res.status >= 500) throw mk("خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل.");
      if (/credit|balance/i.test(msg)) throw mk("رصيد الحساب لا يكفي.");
      const e2 = new AIError("رفض الطلب: " + (msg || res.status));
      e2.diag = `HTTP ${res.status}
${msg}`;
      throw e2;
    }
    return res.json();
  };
  function setTransport(fn) {
    transport = fn;
  }
  var MAX_RETRY_TOKENS = 64e3;
  var noThinking = /* @__PURE__ */ new Set();
  async function callClaude({ model, system, messages, maxTokens = 32e3, tool = null, onProgress = null, think = false, effort = "high" }) {
    const { key } = getSettings();
    if (!key) throw new AIError("أضف مفتاح الـ API من الإعدادات أولاً.");
    const body = { model, max_tokens: maxTokens, system, messages };
    if (tool) {
      body.tools = [tool];
      body.tool_choice = { type: "auto" };
    }
    if (think && !noThinking.has(model)) {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort };
    }
    let data;
    try {
      data = await transport(body, key);
    } catch (e) {
      if (body.thinking && e && /HTTP 400/.test(e.diag || "") && /think|output_config|effort/i.test(e.diag || "")) {
        noThinking.add(model);
        delete body.thinking;
        delete body.output_config;
        const clean = messages.map((m) => Array.isArray(m.content) ? { ...m, content: m.content.filter((c) => c.type !== "thinking" && c.type !== "redacted_thinking") } : m);
        body.messages = clean;
        data = await transport(body, key);
      } else throw e;
    }
    const empty = (d) => d.stop_reason === "max_tokens" && !(d.content || []).some((c) => c.type === "tool_use" || c.type === "text" && c.text.trim());
    if (empty(data) && maxTokens < MAX_RETRY_TOKENS) {
      if (onProgress) onProgress("أطال التفكير، يعيد المحاولة بمساحة أكبر…");
      try {
        data = await transport({ ...body, max_tokens: MAX_RETRY_TOKENS }, key);
      } catch (e) {
      }
    }
    const content = data.content || [];
    const text = content.filter((c) => c.type === "text").map((c) => c.text).join("");
    const use = content.find((c) => c.type === "tool_use");
    return { text, input: use ? use.input : null, toolId: use ? use.id : null, content, stop: data.stop_reason, usage: data.usage || {} };
  }
  function payload(res) {
    if (res.input && typeof res.input === "object") {
      for (const k of Object.keys(res.input)) {
        const v = res.input[k];
        if (typeof v === "string" && /^\s*[\[{]/.test(v)) {
          try {
            res.input[k] = JSON.parse(v);
          } catch (e) {
          }
        }
      }
      return res.input;
    }
    try {
      return parseJSON(res.text);
    } catch (e) {
      const why = res.stop === "max_tokens" ? "انقطع الرد لطوله، حتى بعد إعادة المحاولة." : res.stop === "refusal" ? "اعتذر النموذج عن الطلب." : "لم يصل الرد بالشكل المطلوب.";
      const err = new AIError(why + " افتح «تفاصيل الخطأ» وصوّرها.");
      err.raw = (res.text || "").slice(0, 800);
      err.diag = `stop: ${res.stop}
blocks: ${(res.content || []).map((c) => c.type).join(", ") || "لا شيء"}`;
      throw err;
    }
  }
  function followUp(messages, res, text) {
    if (res.toolId) {
      messages.push({ role: "assistant", content: res.content });
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: res.toolId, content: "وصلت الأبيات وفُحصت." }, { type: "text", text }] });
    } else {
      messages.push({ role: "assistant", content: res.text });
      messages.push({ role: "user", content: text });
    }
  }
  var FIX_TOOL = {
    name: "submit_suggestions",
    description: "سلّم الصيغ المقترحة للبيت مشكولة تشكيلاً كاملاً.",
    input_schema: {
      type: "object",
      properties: {
        suggestions: { type: "array", items: { type: "object", properties: { sadr: { type: "string" }, ajz: { type: "string" }, note: { type: "string" } }, required: ["sadr", "ajz"] } }
      },
      required: ["suggestions"]
    }
  };
  async function testKey() {
    const { fixModel } = getSettings();
    await callClaude({ model: fixModel, system: "أجب بكلمة واحدة.", messages: [{ role: "user", content: "قل: تمام" }], maxTokens: 10 });
    return true;
  }
  function parseJSON(text) {
    text = String(text || "").replace(/```(?:json)?/g, "");
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b <= a) throw new AIError("جاء الرد بصيغة غير متوقعة. حاول مرة ثانية.");
    try {
      return JSON.parse(text.slice(a, b + 1));
    } catch (e) {
      throw new AIError("جاء الرد بصيغة غير متوقعة. حاول مرة ثانية.");
    }
  }
  var METERS = Object.keys(METER_INFO);
  function normalizeMeter(name) {
    if (!name) return null;
    const n = String(name).replace(/[ً-ْ]/g, "").replace(/^(بحر|مجزوء|مخلع|مشطور|منهوك)\s+/, "").trim();
    return METERS.find((m) => m === n || m === "ال" + n || m.slice(2) === n.replace(/^ال/, "")) || null;
  }
  function describeProblems(r, targetMeter) {
    if (!r || r.empty || r.error) return ["لم يُفهم البيت."];
    const out = [];
    if (targetMeter && r.meter !== targetMeter) out.push(`ليس على ${targetMeter}.`);
    for (const p of verseProblems(r)) out.push(`${p.text}${p.cut ? ` (تقطيعها كما قُرئت: ${p.cut})` : ""}`);
    return out;
  }
  function verseText(v) {
    return `${v.sadr} * ${v.ajz}`;
  }
  function majority(arr) {
    const c = /* @__PURE__ */ new Map();
    for (const x of arr) if (x) c.set(x, (c.get(x) || 0) + 1);
    let best = null, n = 0;
    for (const [k, v] of c) if (v > n) {
      best = k;
      n = v;
    }
    return best;
  }
  var POET_SYSTEM = `أنت شاعر عربي فحل، تنظم الشعر العمودي على عروض الخليل بن أحمد. غايتك أن يُطرب البيت ويُحفظ ويُتمثَّل به، لا أن يسلم وزنه فحسب.

${CRAFT_GUIDE}

طريقة العمل:
1. قبل الكتابة فكّر: ما المعنى الذي تبنيه القصيدة من أولها إلى آخرها؟ ما صورة كل بيت؟ أين يقع المحسّن طوعاً لا قسراً؟ وأي الأساليب تنوّع بها (نداء، استفهام، تعجب، شرط…)؟ المطلع مصرَّع، والختام بيت سائر.
2. اكتب المسودة في تفكيرك بحرية، ثم هذّبها على البحر حتى يستقيم الوزن دون أن يذهب ماء الشعر.
3. بعد أن تستقر الأبيات شكّلها تشكيلاً كاملاً؛ فميزانٌ عروضي آلي سيزنها.

القواعد:
- فصحى جزلة سليمة نحواً وصرفاً، بلا عامية ولا ركاكة.
- كل الأبيات على بحر واحد، وروي واحد وحركة روي واحدة، والتزم الردف إن بدأت به، ولا تكرر كلمة القافية.
- التزم البحر، وتجنب الضرورات الشعرية النادرة.
- نفّذ ما طلبه المستخدم من أوصاف ومعانٍ وصور وألفاظ كما طلبه، ولا تستبدله بمعانٍ عامة، ولا تلطّفه، ولا تعتذر، ولا تضف وعظاً أو تعليقاً.
- لك أن تبالغ مبالغة الشعراء، وأن تجري على عادة الشعر العربي في الفخر والمدح والذم والغزل.
- لا تنسب إلى الشخص وقائع محددة أو أنساباً أو مناصب لم تُذكر لك؛ أما الأوصاف والمبالغات فلك فيها السعة.
- إن ذُكر اسم فاجعله في بيت واحد على الأقل إن استقام به الوزن.
- إن كان الغرض هجاءً فاهجُ بحدّة وسخرية لاذعة كما يطلب المستخدم، في الطباع والأفعال والهيئة والأخلاق، بلا تلطيف. ولا يُستثنى إلا: الفحش الجنسي، والرمي بالزنا أو بجريمة، والطعن في نسب أو قبيلة أو عرق أو دين، والتهديد.
- أبيات الاستئناس إن وُجدت تريك المستوى المطلوب؛ لا تنقل منها لفظاً ولا معنى.
- مع كل بيت اكتب «الصنعة»: سطراً قصيراً يسمي ما في البيت من بيان أو بديع أو أسلوب بموضعه من لفظه، مثل: طباق بين «أبكى» و«أضحك». وإن لم يكن فيه محسّن فاذكر ما يقوم عليه جماله. لا تدّعِ ما ليس في البيت.`;
  var CRITIC_SYSTEM = `أنت ناقد شعر عربي بصير على طريقة الآمدي وابن رشيق، وشاعر مجيد في الوقت نفسه. تُعرض عليك صياغات لقصيدة واحدة كتبها شاعر بحسب طلب صاحبها.

${CRAFT_GUIDE}

عملك:
1. وازن بين الصياغات في: السبك وتماسك الأبيات، والصورة، والطرب والإيقاع الداخلي، وتنوع الأساليب، وسلامة اللغة، وخلوها من الحشو والتكلف والابتذال، ووفائها بطلب صاحبها.
2. اختر أجودها.
3. احكم على كل بيت من المختارة بصدق. البيت الضعيف (حشو، رصف بلا صورة، تكلف، معنى مبتذل، جملة خبرية باردة) أعد نظمه كاملاً على البحر والروي وحركته، ولك أن تأخذ له بيتاً أجود من صياغة أخرى إن ناسب موضعه. لا ترقّع كلمة بكلمة.
4. أبقِ البيت القوي كما هو حرفاً بحرف.
5. شكّل كل حرف تشكيلاً كاملاً؛ فميزانٌ عروضي آلي سيزن القصيدة.
6. اكتب لكل بيت «الصنعة» صادقة، سطراً قصيراً بموضعها من لفظ البيت.
7. اكتب حكمك في جملتين: لماذا اخترت هذه الصياغة، وما الذي أعدت نظمه.
سلّم باستدعاء الأداة submit_final دائماً، ولا تكتب الأبيات نصاً خارج الأداة.`;
  var PURPOSES = ["مدح", "تهنئة", "رثاء", "شكر", "حكمة", "غزل عفيف", "هجاء"];
  var VERSE_ITEM = { type: "object", properties: { sadr: { type: "string" }, ajz: { type: "string" }, craft: { type: "string", description: "صنعة البيت في سطر" } }, required: ["sadr", "ajz", "craft"] };
  function draftsTool(n, count) {
    const props = { meter: { type: "string", description: "اسم البحر" }, rawi: { type: "string", description: "حرف الروي" } };
    const req = ["meter"];
    for (let i = 1; i <= n; i++) {
      props[`draft${i}`] = { type: "array", items: VERSE_ITEM, description: `الصياغة ${i}: قصيدة كاملة من ${count} أبيات بالضبط` };
      req.push(`draft${i}`);
    }
    return {
      name: "submit_drafts",
      description: n > 1 ? `سلّم ${n} صياغات مستقلة، كل صياغة قصيدة كاملة من ${count} أبيات بالضبط في خانتها، وكل بيت مشكول ومعه صنعته.` : `سلّم القصيدة: ${count} أبيات بالضبط، كل بيت مشكول ومعه صنعته.`,
      input_schema: { type: "object", properties: props, required: req }
    };
  }
  function collectDrafts(pd, count) {
    const raw = [];
    for (let i = 1; i <= 5; i++) if (pd[`draft${i}`]) raw.push(pd[`draft${i}`]);
    if (Array.isArray(pd.drafts)) for (const d of pd.drafts) raw.push(Array.isArray(d) ? d : d && d.verses);
    if (!raw.length && pd.verses) raw.push(pd.verses);
    const out = [];
    for (const r of raw) {
      const vs = cleanVerses(Array.isArray(r) ? r : []);
      if (!vs.length) continue;
      if (vs.length > count && vs.length % count === 0) {
        for (let k = 0; k < vs.length; k += count) out.push(vs.slice(k, k + count));
      } else out.push(vs.slice(0, Math.max(count, 1)));
    }
    const seen = /* @__PURE__ */ new Set();
    return out.filter((d) => {
      const k = d.map(verseText).join("|");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  var FINAL_TOOL = {
    name: "submit_final",
    description: "سلّم القصيدة النهائية مشكولة، مع صنعة كل بيت وحكم الناقد.",
    input_schema: {
      type: "object",
      properties: {
        chosen: { type: "integer", description: "رقم الصياغة المختارة، من ١" },
        verses: { type: "array", items: VERSE_ITEM },
        verdict: { type: "string" }
      },
      required: ["chosen", "verses"]
    }
  };
  var ONE_VERSE_TOOL = {
    name: "submit_verse",
    description: "سلّم البيت الجديد مشكولاً تشكيلاً كاملاً مع صنعته.",
    input_schema: { type: "object", properties: { verse: VERSE_ITEM }, required: ["verse"] }
  };
  var DRAFTS_UP_TO = 4;
  function requestText(p) {
    const lines = [`الغرض: ${p.purpose}`];
    if (p.name) lines.push(`الاسم: ${p.name}`);
    if (p.details) lines.push(`التفاصيل والصفات: ${p.details}`);
    lines.push(`عدد الأبيات: ${p.count}`);
    if (p.meter) lines.push(`البحر: ${p.meter} (${METER_INFO[p.meter].feet})`);
    else lines.push("البحر: اختر البحر الأنسب للغرض من بحور الخليل الستة عشر.");
    if (p.rawi) lines.push(`حرف الروي: ${p.rawi}`);
    else lines.push("حرف الروي: اختر روياً سهلاً كثير الألفاظ يناسب الغرض.");
    return lines.join("\n");
  }
  function exemplarText(p) {
    const ex = (p.exemplars || []).filter(Boolean);
    return ex.length ? `

أبيات للاستئناس بالمستوى (لا تنقل منها):
${ex.join("\n")}` : "";
  }
  function cleanVerses(list) {
    return (list || []).filter((v) => v && v.sadr && v.ajz).map((v) => ({ sadr: String(v.sadr).trim(), ajz: String(v.ajz).trim(), craft: String(v.craft || "").trim() }));
  }
  function numbered(vs) {
    return vs.map((v, i) => `${i + 1}. ${verseText(v)}`).join("\n");
  }
  async function weighAll(verses, target, rawi, check2) {
    const results = await check2(verses.map((v) => ({ parts: [v.sadr, v.ajz], meter: target })));
    const rh = checkRhymes(results.map((r) => r && r.rhymeInfo), { rawi });
    const problems = [];
    results.forEach((r, i) => {
      const pr = r && r.exact ? [] : describeProblems(r, target);
      for (const iss of rh.issues[i]) pr.push(`عيب في القافية (${iss.kind}): ${iss.msg}.`);
      verses[i].ok = pr.length === 0;
      verses[i].rhymeIssues = rh.issues[i];
      if (pr.length) problems.push(`البيت ${i + 1}: ${verseText(verses[i])}
- ${pr.join("\n- ")}`);
    });
    return { results, problems, haraka: rh.haraka && rh.haraka !== "السكون" ? rh.haraka : null };
  }
  async function compose(p, check2, onProgress = () => {
  }) {
    const { composeModel } = getSettings();
    const nDrafts = p.count <= DRAFTS_UP_TO ? 3 : 1;
    const request = requestText(p);
    onProgress("يتأمّل ويخطّط للقصيدة…");
    const ask = nDrafts > 1 ? `اكتب ثلاث صياغات مستقلة للقصيدة، كل صياغة قصيدة كاملة من ${p.count} أبيات بالضبط، تختلف في المدخل والصور والأساليب، لا تنويعات لفظية على صياغة واحدة. وفي الصياغة الواحدة لا يكرر بيتٌ معنى بيت آخر؛ كل بيت يضيف معنى جديداً.` : `اكتب القصيدة في ${p.count} أبيات بالضبط، كل بيت يضيف معنى جديداً ولا يكرر معنى غيره.`;
    const poetMsgs = [{ role: "user", content: `${request}${exemplarText(p)}

${ask}
سلّم باستدعاء الأداة submit_drafts.` }];
    const pr = await callClaude({ model: composeModel, system: POET_SYSTEM, messages: poetMsgs, tool: draftsTool(nDrafts, p.count), think: true, onProgress });
    const pd = payload(pr);
    const drafts = collectDrafts(pd, p.count);
    if (!drafts.length) {
      const er = new AIError("لم تصل أبيات. افتح «تفاصيل الخطأ» وصوّرها.");
      er.diag = `stop: ${pr.stop}
input: ${JSON.stringify(pr.input || {}).slice(0, 500)}`;
      er.raw = (pr.text || "").slice(0, 500);
      throw er;
    }
    let target = p.meter || null;
    let rawi = p.rawi || null;
    if (!target) {
      const free = await check2(drafts[0].map((v) => ({ parts: [v.sadr, v.ajz] })));
      target = majority(free.filter((r) => r && r.exact).map((r) => r.meter)) || normalizeMeter(pd.meter) || majority(free.map((r) => r && r.meter));
    }
    onProgress(nDrafts > 1 ? "الناقد يوازن بين الصياغات…" : "الناقد يقرأ القصيدة…");
    const shown = drafts.map((d, i) => `الصياغة ${i + 1}:
${numbered(d)}`).join("\n\n");
    const criticMsgs = [{ role: "user", content: `طلب صاحب القصيدة:
${request}
البحر: ${target || pd.meter || ""}${rawi || pd.rawi ? `، الروي: ${rawi || pd.rawi}` : ""}

${shown}

اختر وقوّم، وسلّم القصيدة النهائية بالأداة submit_final، وهي ${p.count} أبيات بالضبط، لا يكرر بيت منها معنى غيره.` }];
    let cr = await callClaude({ model: composeModel, system: CRITIC_SYSTEM, messages: criticMsgs, tool: FINAL_TOOL, think: true, effort: "medium", onProgress });
    let cd = payload(cr);
    let verses = cleanVerses(cd.verses);
    let chosen = Math.min(Math.max(parseInt(cd.chosen, 10) || 1, 1), drafts.length) - 1;
    const verdict = String(cd.verdict || "").trim();
    if (verses.length !== drafts[chosen].length) verses = drafts[chosen].map((v) => ({ ...v }));
    onProgress("يزن القصيدة…");
    if (!rawi) {
      const res0 = await check2(verses.map((v) => ({ parts: [v.sadr, v.ajz], meter: target })));
      rawi = majority(res0.filter((r) => r && r.exact).map((r) => r.rhyme)) || pd.rawi || null;
    }
    let w = await weighAll(verses, target, rawi, check2);
    let round = 0;
    while (w.problems.length && round < MAX_FIX_ROUNDS) {
      round++;
      onProgress(`يعيد نظم ما انكسر (المحاولة ${round} من ${MAX_FIX_ROUNDS})…`);
      followUp(
        criticMsgs,
        cr,
        `زن الميزان الآلي القصيدة على ${target} (${METER_INFO[target] ? METER_INFO[target].feet : ""})${rawi ? ` وعلى روي «${rawi}»` : ""}، والرمز / متحرك وه ساكن. هذه الأبيات انكسرت:

${w.problems.join("\n\n")}

أعد نظم كل بيت منكسر كاملاً بمعناه وصورته في موضعه، لا ترقيعاً لكلمة، وأبقِ السليم كما هو حرفاً بحرف، وشكّل كل حرف، ثم سلّم القصيدة كلها من جديد بالترتيب نفسه مع الصنعة بالأداة submit_final.`
      );
      cr = await callClaude({ model: composeModel, system: CRITIC_SYSTEM, messages: criticMsgs, tool: FINAL_TOOL, think: true, effort: "low", onProgress });
      cd = payload(cr);
      const fixed = cleanVerses(cd.verses);
      if (fixed.length === verses.length) verses = fixed;
      onProgress("يزن القصيدة…");
      w = await weighAll(verses, target, rawi, check2);
    }
    const alternatives = [];
    for (let i = 0; i < drafts.length; i++) {
      if (i === chosen) continue;
      const vs = drafts[i].map((v) => ({ ...v }));
      const aw = await weighAll(vs, target, rawi, check2);
      alternatives.push({ number: i + 1, verses: vs.map((v, j) => ({ ...v, result: aw.results[j] })) });
    }
    return {
      meter: target,
      rawi,
      haraka: w.haraka,
      rounds: round,
      chosen: chosen + 1,
      verdict,
      verses: verses.map((v, i) => ({ ...v, result: w.results[i] })),
      alternatives
    };
  }
  async function regenerateVerse(p, poem, index, check2, onProgress = () => {
  }) {
    const { composeModel } = getSettings();
    const target = poem.meter;
    const others = poem.verses.filter((_, i) => i !== index).map((v) => v.ajz.trim().split(/\s+/).pop());
    const msgs = [{ role: "user", content: `${requestText(p)}

القصيدة الآن (البحر ${target}${poem.rawi ? `، الروي «${poem.rawi}»` : ""}${poem.haraka ? ` وحركته ${poem.haraka}` : ""}):
${numbered(poem.verses)}

أعد نظم البيت رقم ${index + 1} وحده نظماً جديداً أجود منه، يخدم موضعه من القصيدة ويتصل بما قبله وما بعده، على البحر والروي وحركته. لا تكرر كلمة قافية مستعملة في غيره (${others.join("، ")}). وشكّل كل حرف، واكتب صنعته، وسلّم بالأداة submit_verse.` }];
    let verse = null, result = null;
    for (let round = 0; round <= 2; round++) {
      onProgress(round === 0 ? "ينظم بيتاً بديلاً…" : "يعيد نظمه لأنه انكسر…");
      const r = await callClaude({ model: composeModel, system: POET_SYSTEM, messages: msgs, tool: ONE_VERSE_TOOL, think: true, effort: round === 0 ? "medium" : "low", onProgress });
      const d = payload(r);
      const v = cleanVerses([d.verse || d])[0];
      if (!v) continue;
      onProgress("يزن البيت…");
      const res = (await check2([{ parts: [v.sadr, v.ajz], meter: target }]))[0];
      const probs = res && res.exact ? [] : describeProblems(res, target);
      const ri = res && res.rhymeInfo;
      if (poem.rawi && ri && ri.rawi !== poem.rawi) probs.push(`الروي «${ri.rawi}» والمطلوب «${poem.rawi}».`);
      if (poem.haraka && ri && ri.haraka && ri.haraka !== poem.haraka) probs.push(`حركة الروي ${ri.haraka} والمطلوب ${poem.haraka}.`);
      verse = v;
      result = res;
      if (!probs.length) return { ...v, ok: true, result: res };
      followUp(msgs, r, `زن الميزان البيت فانكسر:
- ${probs.join("\n- ")}
أعد نظمه كاملاً على ${target} (${METER_INFO[target] ? METER_INFO[target].feet : ""})، وشكّل كل حرف، وسلّم بالأداة submit_verse.`);
    }
    if (!verse) throw new AIError("لم يصل بيت. حاول مرة ثانية.");
    return { ...verse, ok: false, result };
  }
  var FIX_SYSTEM = `أنت عروضي وشاعر فصيح. يُعطى لك بيت فيه كسر في الوزن أو عيب في القافية، مع موضعه ووجهه كما حددهما ميزان آلي.
اقترح ثلاث صيغ سليمة للبيت على البحر والقافية المطلوبين، بأقل تغيير ممكن يحفظ معنى الشاعر وألفاظه. وإن كان العيب في الوزن وحده فحافظ على كلمة القافية.
شكّل كل حرف تشكيلاً كاملاً.
سلّم الصيغ باستدعاء الأداة submit_suggestions دائماً، ومع كل صيغة ملاحظة قصيرة بما غيّرته، ولا تكتبها نصاً خارج الأداة.`;
  async function suggestFix(r, check2, onProgress = () => {
  }, opts = {}) {
    const { fixModel } = getSettings();
    const meter = r.meter;
    const parts = r.input && r.input.parts ? r.input.parts : null;
    const original = parts ? `${parts[0]} * ${parts[1] || ""}` : r.input && r.input.text || "";
    const probs = r.exact ? [] : describeProblems(r, meter);
    for (const iss of opts.rhymeIssues || []) probs.push(`عيب في القافية (${iss.kind}): ${iss.msg}.`);
    const rhymeWant = opts.rawi ? `
القافية المطلوبة: الروي «${opts.rawi}»${opts.haraka ? ` وحركته ${opts.haraka}` : ""}.` : "";
    const messages = [{
      role: "user",
      content: `البحر المقصود: ${meter} (${METER_INFO[meter] ? METER_INFO[meter].feet : ""})${rhymeWant}
البيت: ${original}
ما وجده الميزان (/ متحرك، ه ساكن):
- ${probs.join("\n- ")}`
    }];
    const rhymeOK = (res) => {
      if (!opts.rawi) return true;
      const ri = res.rhymeInfo;
      if (!ri || ri.rawi !== opts.rawi) return false;
      if (opts.haraka && ri.haraka && ri.haraka !== opts.haraka) return false;
      return true;
    };
    const good = [];
    for (let round = 0; round < 2 && good.length === 0; round++) {
      onProgress(round === 0 ? "يقترح تعديلاً…" : "يحاول مرة ثانية…");
      const resp = await callClaude({ model: fixModel, system: FIX_SYSTEM, messages, tool: FIX_TOOL, onProgress });
      const data = payload(resp);
      const sugg = (data.suggestions || []).filter((s) => s && s.sadr && s.ajz);
      if (!sugg.length) continue;
      onProgress("يزن الاقتراحات…");
      const res = await check2(sugg.map((s) => ({ parts: [s.sadr, s.ajz], meter })));
      const bad = [];
      sugg.forEach((s, i) => {
        if (res[i] && res[i].exact && rhymeOK(res[i])) good.push({ ...s, result: res[i] });
        else {
          const pr = res[i] && res[i].exact ? ["خالف القافية المطلوبة."] : describeProblems(res[i], meter);
          bad.push(`${verseText(s)}
- ${pr.join("\n- ")}`);
        }
      });
      if (!good.length) {
        followUp(messages, resp, `كل الاقتراحات لم تسلم عند الفحص:

${bad.join("\n\n")}

اقترح ثلاث صيغ أخرى سليمة الوزن والقافية، وشكّل كل حرف.`);
      }
    }
    return good;
  }

  // data/exemplars.json
  var exemplars_default = { مدح: [{ t: "ألستم خير من ركب المطايا ... وأندى العالمين بطون راح", poet: "جرير", meter: "الوافر" }, { t: "بيض الصفائح لا سود الصحائف في ... متونهن جلاء الشك والريب", poet: "أبو تمام", meter: "البسيط" }, { t: "على قدر أهل العزم تأتي العزائم ... وتأتي على قدر الكرام المكارم", poet: "المتنبي", meter: "الطويل" }, { t: "وتعظم في عين الصغير صغارها ... وتصغر في عين العظيم العظائم", poet: "المتنبي", meter: "الطويل" }, { t: "وقفت وما في الموت شك لواقف ... كأنك في جفن الردى وهو نائم", poet: "المتنبي", meter: "الطويل" }, { t: "تمر بك الأبطال كلمى هزيمة ... ووجهك وضاح وثغرك باسم", poet: "المتنبي", meter: "الطويل" }, { t: "يا أعدل الناس إلا في معاملتي ... فيك الخصام وأنت الخصم والحكم", poet: "المتنبي", meter: "البسيط" }, { t: "أنا الذي نظر الأعمى إلى أدبي ... وأسمعت كلماتي من به صمم", poet: "المتنبي", meter: "البسيط" }, { t: "الخيل والليل والبيداء تعرفني ... والسيف والرمح والقرطاس والقلم", poet: "المتنبي", meter: "البسيط" }, { t: "وإذا لم يكن من الموت بد ... فمن العجز أن تكون جبانا", poet: "المتنبي", meter: "الخفيف" }, { t: "ومن ضاقت الأرض عن نفسه ... حرى أن يضيق بها جسمه", poet: "المتنبي", meter: "المتقارب" }, { t: "وليس يصح في الأفهام شيء ... إذا احتاج النهار إلى دليل", poet: "المتنبي", meter: "الوافر" }, { t: "ودهر ناسه ناس صغار ... وإن كانت لهم جثث ضخام", poet: "المتنبي", meter: "الوافر" }, { t: "ووضع الندى في موضع السيف بالعلى ... مضر كوضع السيف في موضع الندى", poet: "المتنبي", meter: "الطويل" }, { t: "وغاية المفرط في سلمه ... كغاية المفرط في حربه", poet: "المتنبي", meter: "السريع" }, { t: "ويصدق وعدها والصدق شر ... إذا ألقاك في الكرب العظام", poet: "المتنبي", meter: "الوافر" }, { t: "لعل عتبك محمود عواقبه ... وربما صحت الأجسام بالعلل", poet: "المتنبي", meter: "البسيط" }, { t: "لكل امرئ من دهره ما تعودا ... وعادات سيف الدولة الفتك في العدى", poet: "المتنبي", meter: "الطويل" }, { t: "ومن طلب الفتح الجليل فإنما ... مفاتيحه البيض الخفاف الصوارم", poet: "المتنبي", meter: "الطويل" }, { t: "إذا رأيت نيوب الليث بارزة ... فلا تظنن أن الليث يبتسم", poet: "المتنبي", meter: "البسيط" }, { t: "لو فكر العاشق في منتهى ... حسن الذي يسبيه لم يسبه", poet: "المتنبي", meter: "السريع" }, { t: "وأنفس ما للفتى لبه ... وذو اللب يكره إنفاقه", poet: "المتنبي", meter: "المتقارب" }, { t: "إلف هذا الهواء أوقع في الأن ... فس أن الحمام مر المذاق", poet: "المتنبي", meter: "الخفيف" }, { t: "تبخل أيدينا بأرواحنا ... على زمان هن من كسبه", poet: "المتنبي", meter: "السريع" }, { t: "دون الحلاوة في الزمان مرارة ... لا تختطى إلا على أهواله", poet: "المتنبي", meter: "الكامل" }, { t: "ومن العداوة ما ينالك نفعه ... ومن الصداقة ما يضر ويؤلم", poet: "المتنبي", meter: "الكامل" }, { t: "كل حلم أتى بغير اقتدار ... حجة لاجئ إليها اللئام", poet: "المتنبي", meter: "الخفيف" }, { t: "تريدين لقيان المعالي رخيصة ... ولا بد دون الشهد من إبر النحل", poet: "المتنبي", meter: "الطويل" }, { t: "وأسرع مفعول فعلت تغيرا ... تكلف شيء في طباعك ضده", poet: "المتنبي", meter: "الطويل" }, { t: "وإن تكن تغلب الغلباء عنصرها ... فإن في الخمر معنى ليس في العنب", poet: "المتنبي", meter: "البسيط" }, { t: "قفي تغرم الأولى من اللحظ مهجتي ... بثانية والمتلف الشيء غارمه", poet: "المتنبي", meter: "الطويل" }, { t: "ولا تبال بشعر بعد شاعره ... قد أفسد القول حتى أحمد الصمم", poet: "المتنبي", meter: "البسيط" }, { t: "أبدا تسترد ما تهب الدن ... يا فيا ليت جودها كان بخلا", poet: "المتنبي", meter: "الخفيف" }, { t: "وما ثناك كلام الناس عن كرم ... ومن يسد طريق العارض الهطل", poet: "المتنبي", meter: "البسيط" }, { t: "قبحا لوجهك يا زمان فإنه ... وجه له من كل قبح برقع", poet: "المتنبي", meter: "الكامل" }, { t: "لا تطلبن كريما بعد رؤيته ... إن الكرام بأسخاهم يدا ختموا", poet: "المتنبي", meter: "البسيط" }, { t: "ما الذي عنده تدار المنايا ... كالذي عنده تدار الشمول", poet: "المتنبي", meter: "الخفيف" }, { t: "وما جهلت أياديك البوادي ... ولكن ربما خفي الصواب", poet: "المتنبي", meter: "الوافر" }, { t: "فرب كئيب ليس تندى جفونه ... ورب كثير الدمع غير كئيب", poet: "المتنبي", meter: "الطويل" }, { t: "أيدري ما أرابك من يريب ... وهل ترقى إلى الفلك الخطوب", poet: "المتنبي", meter: "الوافر" }, { t: "أهون بطول الثواء والتلف ... والقيد والسجن يا أبا دلف", poet: "المتنبي", meter: "المنسرح" }, { t: "ومكايد السفهاء واقعة بهم ... وعداوة الشعراء بئس المقتنى", poet: "المتنبي", meter: "الكامل" }, { t: "فصرت كالسيف حامدا يده ... ما يحمد السيف كل من حمله", poet: "المتنبي", meter: "المنسرح" }, { t: "وخل زيا لمن يحققه ... ما كل دام جبينه عابد", poet: "المتنبي", meter: "المنسرح" }, { t: "يممت شاسع دارهم عن نية ... إن المحب لمن يحب يزور", poet: "المتنبي", meter: "الكامل" }, { t: "صبرا بني إسحاق عنه تكرما ... إن العظيم على العظيم صبور", poet: "المتنبي", meter: "الكامل" }, { t: "وما عاقني غير قول الوشاة ... وإن الوشايات طرق الكذب", poet: "المتنبي", meter: "المتقارب" }, { t: "إن خير الدموع عينا لدمع ... بعثته رعاية فاستهلا", poet: "المتنبي", meter: "الخفيف" }], رثاء: [{ t: "وإن صخرا لتأتم الهداة به ... كأنه علم في رأسه نار", poet: "الخنساء", meter: "البسيط" }, { t: "وإن صخرا لوالينا وسيدنا ... وإن صخرا إذا نشتو لنحار", poet: "الخنساء", meter: "البسيط" }, { t: "فإن تفق الأنام وأنت منهم ... فإن المسك بعض دم الغزال", poet: "المتنبي", meter: "الوافر" }, { t: "ولو كان النساء كمن فقدنا ... لفضلت النساء على الرجال", poet: "المتنبي", meter: "الوافر" }, { t: "كذا فليجل الخطب وليفدح الأمر ... فليس لعين لم يفض ماؤها عذر", poet: "أبو تمام", meter: "الطويل" }, { t: "مضى طاهر الأثواب لم تبق روضة ... غداة ثوى إلا اشتهت أنها قبر", poet: "أبو تمام", meter: "الطويل" }, { t: "حكم المنية في البرية جار ... ما هذه الدنيا بدار قرار", poet: "أبو الحسن التهامي", meter: "الكامل" }, { t: "جاورت أعدائي وجاور ربه ... شتان بين جواره وجواري", poet: "أبو الحسن التهامي", meter: "الكامل" }], حكمة: [{ t: "ومن لم يصانع في أمور كثيرة ... يضرس بأنياب ويوطأ بمنسم", poet: "زهير بن أبي سلمى", meter: "الطويل" }, { t: "ألا كل شيء ما خلا الله باطل ... وكل نعيم لا محالة زائل", poet: "لبيد بن ربيعة", meter: "الطويل" }, { t: "وإذا أراد الله نشر فضيلة ... طويت أتاح لها لسان حسود", poet: "أبو تمام", meter: "الكامل" }, { t: "لولا اشتعال النار، فيما جاورت ... ما كان يعرف طيب عرف العود", poet: "أبو تمام", meter: "الكامل" }, { t: "إذا غامرت في شرف مروم ... فلا تقنع بما دون النجوم", poet: "المتنبي", meter: "الوافر" }, { t: "فطعم الموت في أمر حقير ... كطعم الموت في أمر عظيم", poet: "المتنبي", meter: "الوافر" }, { t: "ما كل ما يتمنى المرء يدركه ... تجري الرياح بما لا تشتهي السفن", poet: "المتنبي", meter: "البسيط" }, { t: "إذا أنت أكرمت الكريم ملكته ... وإن أنت أكرمت اللئيم تمردا", poet: "المتنبي", meter: "الطويل" }, { t: "ووضع الندى في موضع السيف بالعلى ... مضر كوضع السيف في موضع الندى", poet: "المتنبي", meter: "الطويل" }, { t: "لا يسلم الشرف الرفيع من الأذى ... حتى يراق على جوانبه الدم", poet: "المتنبي", meter: "الكامل" }, { t: "والظلم من شيم النفوس فإن تجد ... ذا عفة فلعلة لا يظلم", poet: "المتنبي", meter: "الكامل" }, { t: "ومراد النفوس أصغر من أن ... تتعادى فيه وأن تتفانى", poet: "المتنبي", meter: "الخفيف" }, { t: "وإذا لم يكن من الموت بد ... فمن العجز أن تكون جبانا", poet: "المتنبي", meter: "الخفيف" }, { t: "ولابد للقلب من آلة ... ورأي يصدع صم الصفا", poet: "المتنبي", meter: "المتقارب" }, { t: "وما كل من قال قولا وفى ... وما كل من سيم خسفا أبى", poet: "المتنبي", meter: "المتقارب" }, { t: "ولكن تأخذ الآذان منه ... على قدر القرائح والفهوم", poet: "المتنبي", meter: "الوافر" }, { t: "وإن كان ذنبي كل ذنب فإنه ... محا الذنب كل الذنب من جاء تائبا", poet: "المتنبي", meter: "الطويل" }, { t: "وربما زاد على عمره ... وزاد في الأمن على سربه", poet: "المتنبي", meter: "السريع" }, { t: "كل ما لم يكن من الصعب في الأن ... فس سهل فيها إذا هو كانا", poet: "المتنبي", meter: "الخفيف" }, { t: "ما من يرى أنك في وعده ... كمن يرى أنك في حبسه", poet: "المتنبي", meter: "السريع" }, { t: "لك إلف يجره وإذا ما ... كرم الأصل كان للإلف أصلا", poet: "المتنبي", meter: "الخفيف" }, { t: "ومن ضاقت الأرض عن نفسه ... حرى أن يضيق بها جسمه", poet: "المتنبي", meter: "المتقارب" }, { t: "ولكل عين قرة في قربه ... حتى كأن مغيبه الأقذاء", poet: "المتنبي", meter: "الكامل" }, { t: "ما كان عندي أن بدر الدجى ... يوحشه المفقود من شهبه", poet: "المتنبي", meter: "السريع" }, { t: "وما بلد الإنسان غير الموافق ... وما أهله الأدنون غير الأصادق", poet: "المتنبي", meter: "الطويل" }, { t: "وكان حالهما في الحكم واحدة ... لو احتكمنا من الدنيا إلى حكم", poet: "المتنبي", meter: "البسيط" }, { t: "فلما نظرت إلى عقله ... رأيت النهى كلها في الخصى", poet: "المتنبي", meter: "المتقارب" }, { t: "فإن قليل الحب بالعقل صالح ... وإن كثير الحب بالجهل فاسد", poet: "المتنبي", meter: "الطويل" }, { t: "كل دمع يسيل منها عليها ... وبفك اليدين منها تخلى", poet: "المتنبي", meter: "الخفيف" }, { t: "وما أنا منهم بالعيش فيهم ... ولكن معدن الذهب الرغام", poet: "المتنبي", meter: "الوافر" }, { t: "وليس يصح في الأفهام شيء ... إذا احتاج النهار إلى دليل", poet: "المتنبي", meter: "الوافر" }, { t: "من كان فوق محل الشمس موضعه ... فليس يرفعه شيء ولا يضع", poet: "المتنبي", meter: "البسيط" }, { t: "وكم من عائب قولا صحيحا ... وآفته من الفهم السقيم", poet: "المتنبي", meter: "الوافر" }, { t: "آلة العيش صحة وشباب ... فإذا وليا عن المرء ولى", poet: "المتنبي", meter: "الخفيف" }, { t: "إن السلاح جميع الناس تحمله ... وليس كل ذوات المخلب السبع", poet: "المتنبي", meter: "البسيط" }, { t: "شر البلاد مكان لا صديق به ... وشر ما يكسب الإنسان ما يصم", poet: "المتنبي", meter: "البسيط" }, { t: "الرأي قبل شجاعة الشجعان ... هو أول وهي المحل الثاني", poet: "المتنبي", meter: "الكامل" }], هجاء: [{ t: "فغض الطرف إنك من نمير ... فلا كعبا بلغت ولا كلابا", poet: "جرير", meter: "الوافر" }, { t: "زعم الفرزدق أن سيقتل مربعا ... أبشر بطول سلامة يا مربع", poet: "جرير", meter: "الكامل" }, { t: "ورجا الأخيطل من سفاهة رأيه ... ما لم يكن وأب له لينالا", poet: "جرير", meter: "الكامل" }, { t: "وأعور من نبهان أما نهاره ... فأعمى وأما ليله فبصير", poet: "جرير", meter: "الطويل" }, { t: "قوم إذا استنبح الأضياف كلبهم ... قالوا لأمهم بولي على النار", poet: "الأخطل", meter: "البسيط" }, { t: "فانعق بضأنك يا جرير فإنما ... منتك نفسك في الخلاء ضلالا", poet: "الأخطل", meter: "الكامل" }, { t: "كنت القذى في موج أكدر مزبد ... قذف الأتي به فضل ضلالا", poet: "الأخطل", meter: "الكامل" }, { t: "قبيلة كشراك النعل دارجة ... إن يهبطوا العفو لا يوجد لهم أثر", poet: "الأخطل", meter: "البسيط" }, { t: "أبني كليب إن عمي اللذا ... قتلا الملوك وفككا الأغلالا", poet: "الأخطل", meter: "الكامل" }, { t: "ما ضر تغلب وائل أهجوتها ... أم بلت حيث تناطح البحران", poet: "الفرزدق", meter: "الكامل" }, { t: "إن الأراقم لن ينال قديمها ... كلب عوى متهتم الأسنان", poet: "الفرزدق", meter: "الكامل" }, { t: "ليس الكرام بناحليك أباهم ... حتى ترد إلى عطية تعتل", poet: "الفرزدق", meter: "الكامل" }, { t: "دع المكارم لا ترحل لبغيتها ... واقعد فإنك أنت الطاعم الكاسي", poet: "الحطيئة", meter: "البسيط" }, { t: "أبت شفتاي اليوم إلا تكلما ... بشر فما أدري لمن أنا قائله", poet: "الحطيئة", meter: "الطويل" }, { t: "أرى لي وجها شوه الله خلقه ... فقبح من وجه وقبح حامله", poet: "الحطيئة", meter: "الطويل" }, { t: "هجوت محمدا فأجبت عنه ... وعند الله في ذاك الجزاء", poet: "حسان بن ثابت", meter: "الوافر" }, { t: "فإن أبي ووالده وعرضي ... لعرض محمد منكم وقاء", poet: "حسان بن ثابت", meter: "الوافر" }, { t: "أتهجوه ولست له بكفء ... فشركما لخيركما الفداء", poet: "حسان بن ثابت", meter: "الوافر" }, { t: "وإن أحق الناس أن لا تلومه ... على اللؤم من ألفى أباه كذلكا", poet: "حسان بن ثابت", meter: "الطويل" }, { t: "نامت نواطير مصر عن ثعالبها ... فقد بشمن وما تفنى العناقيد", poet: "المتنبي", meter: "البسيط" }, { t: "وماذا بمصر من المضحكات ... ولكنه ضحك كالبكا", poet: "المتنبي", meter: "المتقارب" }, { t: "أغاية الدين أن تحفوا شواربكم ... يا أمة ضحكت من جهلها الأمم", poet: "المتنبي", meter: "البسيط" }, { t: "أمينا وإخلافا وغدرا وخسة ... وجبنا، أشخصا لحت لي أم مخازيا", poet: "المتنبي", meter: "الطويل" }, { t: "خفافيش أعشاها نهار بضوئه ... ولاءمها قطع من الليل غيهب", poet: "ابن الرومي", meter: "الطويل" }, { t: "معشر أشبهوا القرود ولكن ... خالفوها في خفة الأرواح", poet: "ابن الرومي", meter: "الخفيف" }, { t: "لو رأى مثلها النبي لأجرى ... في لحى الناس سنة التقصير", poet: "ابن الرومي", meter: "الخفيف" }, { t: "هو الأسد الورد في قصره ... ولكنه ثعلب المعركه", poet: "ابن الرومي", meter: "المتقارب" }, { t: "يقتر عيسى على نفسه ... وليس بباق ولا خالد", poet: "ابن الرومي", meter: "المتقارب" }, { t: "وجهك يا عمرو فيه طول ... وفي وجوه الكلاب طول", poet: "ابن الرومي", meter: "البسيط" }, { t: "يحرم فيكم الصهباء صبحا ... ويشربها على عمد مساء", poet: "أبو العلاء المعري", meter: "الوافر" }, { t: "رويدك قد غررت وأنت حر ... بصاحب حيلة يعظ النساء", poet: "أبو العلاء المعري", meter: "الوافر" }, { t: "متصنع لك في مودته ... يلقاك بالترحيب والبشر", poet: "البحتري", meter: "الكامل" }], غزل: [{ t: "ولكن تأخذ الآذان منه ... على قدر القرائح والفهوم", poet: "المتنبي", meter: "الوافر" }, { t: "ولكل عين قرة في قربه ... حتى كأن مغيبه الأقذاء", poet: "المتنبي", meter: "الكامل" }, { t: "وما أنا منهم بالعيش فيهم ... ولكن معدن الذهب الرغام", poet: "المتنبي", meter: "الوافر" }, { t: "شر البلاد مكان لا صديق به ... وشر ما يكسب الإنسان ما يصم", poet: "المتنبي", meter: "البسيط" }, { t: "فإن تفق الأنام وأنت منهم ... فإن المسك بعض دم الغزال", poet: "المتنبي", meter: "الوافر" }, { t: "فهذه الأرواح من جوه ... وهذه الأجسام من تربه", poet: "المتنبي", meter: "السريع" }, { t: "وغاية المفرط في سلمه ... كغاية المفرط في حربه", poet: "المتنبي", meter: "السريع" }, { t: "ومن يجد الطريق إلى المعالي ... فلا يذر المطي بلا سنام", poet: "المتنبي", meter: "الوافر" }, { t: "وأصبح شعري منهما في مكانه ... وفي عنق الحسناء يستحسن العقد", poet: "المتنبي", meter: "الطويل" }, { t: "ذكر الفتى عمره الثاني وحاجته ... ما فاته وفضول العيش أشغال", poet: "المتنبي", meter: "البسيط" }, { t: "أين الذي الهرمان من بنيانه، ... ما قومه، ما يومه، ما المصرع؟", poet: "المتنبي", meter: "الكامل" }, { t: "إنا لفي زمن ترك القبيح به ... من أكثر الناس إحسان وإجمال", poet: "المتنبي", meter: "البسيط" }, { t: "وما انتفاع أخي الدنيا بناظره ... إذا استوت عنده الأنوار والظلم", poet: "المتنبي", meter: "البسيط" }, { t: "وإنما يبلغ الإنسان طاقته ... ما كل ماشية بالرحل شملال", poet: "المتنبي", meter: "البسيط" }, { t: "وإذا وكلت إلى كريم رأيه ... في الجود بان مذيقه من محضه", poet: "المتنبي", meter: "الكامل" }, { t: "وأنفس ما للفتى لبه ... وذو اللب يكره إنفاقه", poet: "المتنبي", meter: "المتقارب" }, { t: "إذا لم تشاهد غير حسن شياتها ... ولباتها فالحسن عنك مغيب", poet: "المتنبي", meter: "الطويل" }, { t: "حسن الحضارة مجلوب بتطرية ... وفي البداوة حسن غير مجلوب", poet: "المتنبي", meter: "البسيط" }, { t: "أعلى الممالك ما يبنى على الأسل ... والطعن عند محبيهن كالقبل", poet: "المتنبي", meter: "البسيط" }, { t: "فقيل تخلص نفس المرء سالمة ... وقيل تشرك جسم المرء في العطب", poet: "المتنبي", meter: "البسيط" }, { t: "الحب ما منع الكلام الألسنا ... وألذ شكوى عاشق ما أعلنا", poet: "المتنبي", meter: "الكامل" }, { t: "وللسر مني موضع لا يناله ... صديق ولا يفضي إليه شراب", poet: "المتنبي", meter: "الطويل" }, { t: "غير أن الفتى يلاقي المنايا ... كالحات ولا يلاقي الهوانا", poet: "المتنبي", meter: "الخفيف" }, { t: "وإذا لم تجد من الناس كفؤا ... ذات خدر تمنت الموت بعلا", poet: "المتنبي", meter: "الخفيف" }, { t: "وأسرع مفعول فعلت تغيرا ... تكلف شيء في طباعك ضده", poet: "المتنبي", meter: "الطويل" }, { t: "وذاك أن الفحول البيض عاجزة ... عن الجميل فكيف الخصية السود؟", poet: "المتنبي", meter: "البسيط" }, { t: "ومن لم يعشق الدنيا قديما ... ولكن لا سبيل إلى الوصال", poet: "المتنبي", meter: "الوافر" }, { t: "ومن صحب الدنيا طويلا تقلبت ... على عينه حتى يرى صدقها كذبا", poet: "المتنبي", meter: "الطويل" }, { t: "وعاد في طلب المتروك تاركه ... إنا لنغفل والأيام في الطلب", poet: "المتنبي", meter: "البسيط" }, { t: "وما تنفع الخيل الكرام ولا القنا ... إذا لم يكن فوق الكرام كرام", poet: "المتنبي", meter: "الطويل" }, { t: "والذل يظهر في الذليل مودة ... وأود منه لمن يود الأرقم", poet: "المتنبي", meter: "الكامل" }, { t: "وفي الناس من يرضى بميسور عيشه ... ومركوبه رجلاه والثوب جلده", poet: "المتنبي", meter: "الطويل" }, { t: "وما في سطوة الأرباب عيب ... وما في ذلة العبدان عار", poet: "المتنبي", meter: "الوافر" }, { t: "لا تطلبن كريما بعد رؤيته ... إن الكرام بأسخاهم يدا ختموا", poet: "المتنبي", meter: "البسيط" }, { t: "وما ذاك بخلا بالنفوس على القنا ... ولكن صدم الشر بالشر أحزم", poet: "المتنبي", meter: "الطويل" }, { t: "أهل الحفيظة إلا أن تجر بهم ... وفي التجارب بعد الغي ما يزع", poet: "المتنبي", meter: "البسيط" }, { t: "وقد تحدث الأيام عندك شيمة ... وتنعمر الأوقات وهي يباب", poet: "المتنبي", meter: "الطويل" }, { t: "وفي تعب من يحسد الشمس ضوءها ... ويجهد أن يأتي لها بضريب", poet: "المتنبي", meter: "الطويل" }, { t: "وربما فارق الإنسان مهجته ... يوم الوغى غير قال خشية العار", poet: "المتنبي", meter: "البسيط" }, { t: "بأبي الوحيد وجيشه متكاثر ... يبكي ومن شر السلاح الأدمع", poet: "المتنبي", meter: "الكامل" }, { t: "والناس قد نبذوا الحفاظ فمطلق ... ينسى الذي يولى وعاف يندم", poet: "المتنبي", meter: "الكامل" }, { t: "فإن كنت لا تعطي الذمام طواعة ... فعوذ الأعادي بالكريم ذمام", poet: "المتنبي", meter: "الطويل" }, { t: "فصرت كالسيف حامدا يده ... ما يحمد السيف كل من حمله", poet: "المتنبي", meter: "المنسرح" }, { t: "فتى زان في عيني أقصى قبيله ... وكم سيد في حلة لا يزينها", poet: "المتنبي", meter: "الطويل" }, { t: "أينكر ريح الليث حتى يذوقه ... وقد عرفت ريح الليوث البهائم", poet: "المتنبي", meter: "الطويل" }, { t: "فكثير من الشجاع التوقي ... وكثير من البليغ السلام", poet: "المتنبي", meter: "الخفيف" }, { t: "هم لأموالهم ولسن لهم ... والعار يبقى والجرح يلتئم", poet: "المتنبي", meter: "المنسرح" }, { t: "يجشمك الزمان هوى وحبا ... وقد يؤذى من المقة الحبيب", poet: "المتنبي", meter: "الوافر" }, { t: "فإن الجرح ينفر بعد حين ... إذا كان البناء على فساد", poet: "المتنبي", meter: "الوافر" }, { t: "ولو لم تبق لم تعش البقايا ... وفي الماضي لمن يبقى اعتبار", poet: "المتنبي", meter: "الوافر" }], عام: [{ t: "ومن لم يصانع في أمور كثيرة ... يضرس بأنياب ويوطأ بمنسم", poet: "زهير بن أبي سلمى", meter: "الطويل" }, { t: "ألا كل شيء ما خلا الله باطل ... وكل نعيم لا محالة زائل", poet: "لبيد بن ربيعة", meter: "الطويل" }, { t: "وإذا أراد الله نشر فضيلة ... طويت أتاح لها لسان حسود", poet: "أبو تمام", meter: "الكامل" }, { t: "لولا اشتعال النار، فيما جاورت ... ما كان يعرف طيب عرف العود", poet: "أبو تمام", meter: "الكامل" }, { t: "إذا غامرت في شرف مروم ... فلا تقنع بما دون النجوم", poet: "المتنبي", meter: "الوافر" }, { t: "فطعم الموت في أمر حقير ... كطعم الموت في أمر عظيم", poet: "المتنبي", meter: "الوافر" }, { t: "ما كل ما يتمنى المرء يدركه ... تجري الرياح بما لا تشتهي السفن", poet: "المتنبي", meter: "البسيط" }, { t: "إذا أنت أكرمت الكريم ملكته ... وإن أنت أكرمت اللئيم تمردا", poet: "المتنبي", meter: "الطويل" }, { t: "ووضع الندى في موضع السيف بالعلى ... مضر كوضع السيف في موضع الندى", poet: "المتنبي", meter: "الطويل" }, { t: "لا يسلم الشرف الرفيع من الأذى ... حتى يراق على جوانبه الدم", poet: "المتنبي", meter: "الكامل" }, { t: "والظلم من شيم النفوس فإن تجد ... ذا عفة فلعلة لا يظلم", poet: "المتنبي", meter: "الكامل" }, { t: "ومراد النفوس أصغر من أن ... تتعادى فيه وأن تتفانى", poet: "المتنبي", meter: "الخفيف" }, { t: "وإذا لم يكن من الموت بد ... فمن العجز أن تكون جبانا", poet: "المتنبي", meter: "الخفيف" }, { t: "ولابد للقلب من آلة ... ورأي يصدع صم الصفا", poet: "المتنبي", meter: "المتقارب" }, { t: "وما كل من قال قولا وفى ... وما كل من سيم خسفا أبى", poet: "المتنبي", meter: "المتقارب" }, { t: "ولكن تأخذ الآذان منه ... على قدر القرائح والفهوم", poet: "المتنبي", meter: "الوافر" }, { t: "وإن كان ذنبي كل ذنب فإنه ... محا الذنب كل الذنب من جاء تائبا", poet: "المتنبي", meter: "الطويل" }, { t: "وربما زاد على عمره ... وزاد في الأمن على سربه", poet: "المتنبي", meter: "السريع" }, { t: "كل ما لم يكن من الصعب في الأن ... فس سهل فيها إذا هو كانا", poet: "المتنبي", meter: "الخفيف" }, { t: "ما من يرى أنك في وعده ... كمن يرى أنك في حبسه", poet: "المتنبي", meter: "السريع" }, { t: "لك إلف يجره وإذا ما ... كرم الأصل كان للإلف أصلا", poet: "المتنبي", meter: "الخفيف" }, { t: "ومن ضاقت الأرض عن نفسه ... حرى أن يضيق بها جسمه", poet: "المتنبي", meter: "المتقارب" }, { t: "ولكل عين قرة في قربه ... حتى كأن مغيبه الأقذاء", poet: "المتنبي", meter: "الكامل" }, { t: "ما كان عندي أن بدر الدجى ... يوحشه المفقود من شهبه", poet: "المتنبي", meter: "السريع" }, { t: "وما بلد الإنسان غير الموافق ... وما أهله الأدنون غير الأصادق", poet: "المتنبي", meter: "الطويل" }, { t: "وكان حالهما في الحكم واحدة ... لو احتكمنا من الدنيا إلى حكم", poet: "المتنبي", meter: "البسيط" }, { t: "فلما نظرت إلى عقله ... رأيت النهى كلها في الخصى", poet: "المتنبي", meter: "المتقارب" }, { t: "فإن قليل الحب بالعقل صالح ... وإن كثير الحب بالجهل فاسد", poet: "المتنبي", meter: "الطويل" }, { t: "كل دمع يسيل منها عليها ... وبفك اليدين منها تخلى", poet: "المتنبي", meter: "الخفيف" }, { t: "وما أنا منهم بالعيش فيهم ... ولكن معدن الذهب الرغام", poet: "المتنبي", meter: "الوافر" }, { t: "وليس يصح في الأفهام شيء ... إذا احتاج النهار إلى دليل", poet: "المتنبي", meter: "الوافر" }, { t: "من كان فوق محل الشمس موضعه ... فليس يرفعه شيء ولا يضع", poet: "المتنبي", meter: "البسيط" }, { t: "وكم من عائب قولا صحيحا ... وآفته من الفهم السقيم", poet: "المتنبي", meter: "الوافر" }, { t: "آلة العيش صحة وشباب ... فإذا وليا عن المرء ولى", poet: "المتنبي", meter: "الخفيف" }, { t: "إن السلاح جميع الناس تحمله ... وليس كل ذوات المخلب السبع", poet: "المتنبي", meter: "البسيط" }, { t: "شر البلاد مكان لا صديق به ... وشر ما يكسب الإنسان ما يصم", poet: "المتنبي", meter: "البسيط" }, { t: "الرأي قبل شجاعة الشجعان ... هو أول وهي المحل الثاني", poet: "المتنبي", meter: "الكامل" }, { t: "وإذا لم يكن من الموت بد ... فمن العجز أن تكون جبانا", poet: "المتنبي", meter: "الخفيف" }, { t: "ما كان عندي أن بدر الدجى ... يوحشه المفقود من شهبه", poet: "المتنبي", meter: "السريع" }, { t: "إن السلاح جميع الناس تحمله ... وليس كل ذوات المخلب السبع", poet: "المتنبي", meter: "البسيط" }, { t: "وإذا الشيخ قال أف فما مل ... لحياة وإنما الضعف ملا", poet: "المتنبي", meter: "الخفيف" }, { t: "فلا قضى حاجته طالب ... فؤاده يخفق من رعبه", poet: "المتنبي", meter: "السريع" }, { t: "والظلم من شيم النفوس فإن تجد ... ذا عفة فلعلة لا يظلم", poet: "المتنبي", meter: "الكامل" }, { t: "ذكر الفتى عمره الثاني وحاجته ... ما فاته وفضول العيش أشغال", poet: "المتنبي", meter: "البسيط" }, { t: "فطعم الموت في أمر حقير ... كطعم الموت في أمر عظيم", poet: "المتنبي", meter: "الوافر" }, { t: "وقد يتزيا بالهوى غير أهله ... ويصطحب الإنسان من لا يلائمه", poet: "المتنبي", meter: "الطويل" }, { t: "لو فكر العاشق في منتهى ... حسن الذي يسبيه لم يسبه", poet: "المتنبي", meter: "السريع" }, { t: "إذا ما تأملت الزمان وصرفه ... تيقنت أن الموت ضرب من القتل", poet: "المتنبي", meter: "الطويل" }, { t: "ومن البلية عذل من لا يرعوي ... عن غيه وخطاب من لا يفهم", poet: "المتنبي", meter: "الكامل" }, { t: "ترفق أيها المولى عليهم ... فإن الرفق بالجاني عتاب", poet: "المتنبي", meter: "الوافر" }, { t: "الحب ما منع الكلام الألسنا ... وألذ شكوى عاشق ما أعلنا", poet: "المتنبي", meter: "الكامل" }, { t: "لا يعجبن مضيما حسن بزته ... وهل يروق دفينا جودة الكفن", poet: "المتنبي", meter: "البسيط" }, { t: "إذا كنت ترضى أن تعيش بذلة ... فلا تستعدن الحسام اليمانيا", poet: "المتنبي", meter: "الطويل" }, { t: "وما قضى أحد منها لبانته ... ولا انتهى أرب إلا إلى أرب", poet: "المتنبي", meter: "البسيط" }, { t: "خير الطيور على القصور وشرها ... يأوي الخراب ويسكن الناووسا", poet: "المتنبي", meter: "الكامل" }, { t: "ولا تبال بشعر بعد شاعره ... قد أفسد القول حتى أحمد الصمم", poet: "المتنبي", meter: "البسيط" }, { t: "أبى خلق الدنيا حبيبا تديمه ... فما طلبي منها حبيبا ترده", poet: "المتنبي", meter: "الطويل" }, { t: "وفي الناس من يرضى بميسور عيشه ... ومركوبه رجلاه والثوب جلده", poet: "المتنبي", meter: "الطويل" }, { t: "إذا لم تكن نفس النسيب كأصله ... فماذا الذي تغني كرام المناسب", poet: "المتنبي", meter: "الطويل" }, { t: "ومن ركب الثور بعد الجوا ... د أنكر أظلافه والغبب", poet: "المتنبي", meter: "المتقارب" }, { t: "يا من نعيت على بعد بمجلسه ... كل بما زعم الناعون مرتهن", poet: "المتنبي", meter: "البسيط" }, { t: "فلا ينفع الأسد الحياء من الطوى ... ولا تتقى حتى تكون ضواريا", poet: "المتنبي", meter: "الطويل" }, { t: "أرى الأجداد تغلبها كثيرا ... على الأولاد أخلاق اللئام", poet: "المتنبي", meter: "الوافر" }, { t: "وإن بذل الإنسان لي جود عابس ... جزيت بجود التارك المتبسم", poet: "المتنبي", meter: "الطويل" }, { t: "فصرت كالسيف حامدا يده ... ما يحمد السيف كل من حمله", poet: "المتنبي", meter: "المنسرح" }, { t: "لو كان يمكنني سفرت عن الصبا ... فالشيب من قبل الأوان تلثم", poet: "المتنبي", meter: "الكامل" }, { t: "ورفلت في حلل الثناء وإنما ... عدم الثناء نهاية الإعدام", poet: "المتنبي", meter: "الكامل" }, { t: "وما كمد الحساد شيء قصدته ... ولكنه من يزحم البحر يغرق", poet: "المتنبي", meter: "الطويل" }, { t: "يرى الجبناء أن العجز فخر ... وتلك خديعة الطبع اللئيم", poet: "المتنبي", meter: "الوافر" }] };

  // src/musajala.js
  var LETTERS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");
  var letterOf = (c) => "أإآاٱءىؤئ".includes(c) ? "ا" : c === "ة" ? "ت" : c;
  function lastLetter2(text) {
    const w = String(text).replace(/[*\u060C.!؟?:؛"«»)(]+/g, " ").trim().split(/\s+/).pop() || "";
    const L = [];
    for (const ch of w) {
      if (/[\u0621-\u064A\u0671]/.test(ch)) L.push({ c: ch, m: "" });
      else if (/[\u064B-\u0652]/.test(ch) && L.length) L[L.length - 1].m += ch;
    }
    if (!L.length) return null;
    const bare = (x) => x && !/[\u064E-\u0652\u064B-\u064D]/.test(x.m);
    if (L[L.length - 1].c === "ى") return "ا";
    let i = L.length - 1;
    if (i > 0 && "اوي".includes(L[i].c) && bare(L[i])) i--;
    if (i > 1 && L[i].c === "ه" && !L[i].m.includes("ْ") && !"اوي".includes(L[i - 1].c)) {
      i--;
    }
    return letterOf(L[i].c);
  }

  // ios/core/entry.js
  var N = globalThis.__native;
  globalThis.localStorage = {
    getItem: (k) => {
      const v = N.storeGet(k);
      return v == null || v === "" ? null : String(v);
    },
    setItem: (k, v) => N.storeSet(k, String(v)),
    removeItem: (k) => N.storeSet(k, "")
  };
  setTransport((body, key) => new Promise((resolve, reject) => {
    N.fetch(JSON.stringify(body), key, (status, text, netError) => {
      if (netError) {
        reject(new AIError("تعذّر الاتصال. هذه الميزة تحتاج إنترنت."));
        return;
      }
      if (status >= 200 && status < 300) {
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new AIError("جاء الرد بصيغة غير متوقعة. حاول مرة ثانية."));
        }
        return;
      }
      let msg = "";
      try {
        msg = JSON.parse(text).error.message;
      } catch (e) {
      }
      const mk = (t) => {
        const er = new AIError(t);
        er.diag = `HTTP ${status}
${msg}`;
        return er;
      };
      if (status === 401) return reject(mk("المفتاح غير صحيح. راجعه في الإعدادات."));
      if (status === 403) return reject(mk("المفتاح لا يملك صلاحية لهذا الطلب."));
      if (status === 404) return reject(mk("النموذج المختار غير متاح لحسابك. غيّره من الإعدادات."));
      if (status === 429) return reject(mk("بلغت حد الطلبات أو حد الصرف. انتظر قليلاً أو راجع حدود حسابك."));
      if (status === 529 || status >= 500) return reject(mk("خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل."));
      if (/credit|balance/i.test(msg)) return reject(mk("رصيد الحساب لا يكفي."));
      reject(mk("رفض الطلب: " + (msg || status)));
    });
  }));
  var ready = false;
  var store = /* @__PURE__ */ new Map();
  var nextId = 1;
  var keep = (r) => {
    const id = nextId++;
    store.set(id, r);
    if (store.size > 400) store.delete(store.keys().next().value);
    return id;
  };
  function analyzeItems(items) {
    return items.map((it) => {
      try {
        const r = analyzeVerse(it.parts || it.text, { autoSplit: true, meter: it.meter || null });
        return r ? { ...r, input: it } : { input: it, empty: true };
      } catch (e) {
        return { input: it, error: String(e && e.message || e) };
      }
    });
  }
  var check = (items) => Promise.resolve(analyzeItems(items));
  function parseInput(text) {
    const lines = String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = splitVerse(lines[i]);
      if (parts.length >= 2) {
        items.push({ text: lines[i], parts });
        continue;
      }
      const next = lines[i + 1];
      const wc = (s) => s.split(/\s+/).length;
      if (next && splitVerse(next).length < 2 && wc(lines[i]) <= 6 && wc(next) <= 6) {
        items.push({ text: lines[i] + " * " + next, parts: [lines[i], next] });
        i++;
        continue;
      }
      items.push({ text: lines[i] });
    }
    return items;
  }
  function meterTitle(r) {
    const m = r.meter, f = r.form;
    if (!m) return "—";
    if (f === "تام" || !f) return m;
    if (f === "مخلع") return "مخلّع " + m;
    return f + " " + m;
  }
  function needsFix(r) {
    return !!(r && !r.error && !r.empty && !r.single && !r.joined && r.input && r.input.parts && (!r.exact || r.rhymeIssues && r.rhymeIssues.length));
  }
  function hemiUI(h, label, half = 0) {
    const errWords = new Set((h.errors || []).map((e) => e.word).filter((x) => x != null));
    return {
      label,
      half,
      words: h.words.map((w, i) => ({ t: w.display, guess: !!w.generic, broken: errWords.has(i) })),
      feet: h.feet.map((f) => ({
        text: f.text || "—",
        sym: sym(f.got),
        name: f.name || "؟",
        bad: !f.ok,
        exp: !f.ok && f.vp ? sym(f.vp) : "",
        note: f.note || ""
      }))
    };
  }
  function toUI(r, label = "") {
    if (!r || r.error || r.empty) {
      return { id: 0, failed: true, title: "—", message: r && r.error ? "حدث خطأ: " + r.error : "لم أجد كلمات عربية في هذا السطر.", label };
    }
    const nBad = r.hemistichs.reduce((s, h) => s + h.feet.filter((f) => !f.ok).length, 0);
    const nRh = (r.rhymeIssues || []).length;
    let badge, ok;
    if (r.exact && !nRh) {
      badge = "موزون ✓";
      ok = true;
    } else if (r.exact) {
      badge = "موزون، وفي القافية عيب";
      ok = false;
    } else {
      badge = nBad === 1 ? "مكسور في تفعيلة" : nBad === 2 ? "مكسور في تفعيلتين" : `مكسور في ${nBad} تفعيلات`;
      ok = false;
    }
    const notes = [];
    if (r.autoSplit) notes.push("قسّمتُ البيت إلى صدر وعجز تلقائياً.");
    if (r.madwar) notes.push("بيت مدوّر: كلمة مشتركة بين الشطرين.");
    if (r.single && !r.autoSplit) notes.push("شطر واحد. اكتب الشطر الآخر بعد * ليُوزن البيت كاملاً.");
    const guesses = r.hemistichs.flatMap((h) => h.words.filter((w) => w.generic)).map((w) => w.display);
    let hemis;
    if (r.joined) {
      const h = r.hemistichs[0];
      hemis = [hemiUI(h, "البيت (الصدر ثم العجز)", h.feet.length / 2)];
    } else if (r.single) hemis = [hemiUI(r.hemistichs[0], "الشطر")];
    else hemis = [hemiUI(r.hemistichs[0], "الصدر"), hemiUI(r.hemistichs[1], "العجز")];
    const problems = verseProblems(r).map((p) => ({ head: `${p.hemi}، ${p.where}`, what: p.what, can: p.can }));
    const rhymeIssues = (r.rhymeIssues || []).map((i) => ({ kind: i.kind, msg: i.msg }));
    const alts = (r.alternatives || []).filter((a) => a.cost - r.cost < (r.exact ? 1.2 : 4)).slice(0, 2).map(meterTitle);
    return {
      id: keep(r),
      failed: false,
      label,
      title: meterTitle(r),
      meter: r.meter || "",
      exact: !!r.exact,
      badge,
      ok,
      notes,
      guesses,
      hemis,
      problems,
      rhymeIssues,
      alts,
      needsFix: needsFix(r)
    };
  }
  function rhymeSummary(results) {
    const full = results.filter((r) => r && !r.error && !r.empty && !r.single && !r.joined && r.rhymeInfo);
    if (full.length < 2) return null;
    const chk = checkRhymes(results.map((r) => r && r.rhymeInfo && !r.single && !r.joined ? r.rhymeInfo : null));
    results.forEach((r, i) => {
      if (r) r.rhymeIssues = chk.issues[i];
    });
    const n = chk.issues.reduce((s, x) => s + x.length, 0);
    const m = full.map((r) => r.rhymeInfo.ridf);
    const a = m.filter((x) => x === "ا").length, w = m.filter((x) => x === "وي").length;
    const ridf = a > full.length / 2 ? "مردوفة بالألف" : w > full.length / 2 ? "مردوفة بالواو والياء" : "";
    const parts = [`الروي «${chk.rawi || "؟"}»`];
    if (chk.haraka) parts.push(chk.haraka);
    if (ridf) parts.push(ridf);
    return {
      detail: parts.join("، "),
      badge: n ? n === 1 ? "عيب واحد" : n + " عيوب" : "سليمة ✓",
      ok: !n,
      rawi: chk.rawi || "",
      haraka: chk.haraka && chk.haraka !== "السكون" ? chk.haraka : ""
    };
  }
  function errJSON(e) {
    return JSON.stringify({
      message: e instanceof AIError ? e.message : "حدث خطأ: " + (e && e.message || e),
      diag: e && e.diag || "",
      raw: e && e.raw || ""
    });
  }
  function composedUI(v, i) {
    if (v.result && !v.result.error && !v.result.empty) v.result.rhymeIssues = v.rhymeIssues || [];
    return { sadr: v.sadr, ajz: v.ajz, ok: !!v.ok, craft: v.craft || "", result: v.result ? toUI(v.result, `البيت ${i + 1}`) : null };
  }
  var PURPOSE_POOL = { "مدح": "مدح", "تهنئة": "مدح", "شكر": "مدح", "رثاء": "رثاء", "حكمة": "حكمة", "هجاء": "هجاء", "غزل عفيف": "غزل" };
  function pickExemplars(purpose, meter, n = 8) {
    const pool = (exemplars_default[PURPOSE_POOL[purpose] || "عام"] || []).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => (b.meter === meter) - (a.meter === meter));
    const out = [], per = /* @__PURE__ */ new Map();
    for (const cap of [2, 99]) {
      for (const e of pool) {
        if (out.length >= n) break;
        if (out.includes(e) || (per.get(e.poet) || 0) >= cap) continue;
        out.push(e);
        per.set(e.poet, (per.get(e.poet) || 0) + 1);
      }
    }
    return out.map((e) => `${e.t} (${e.poet}، ${e.meter})`);
  }
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
      return JSON.stringify({ rhyme, items: results.map((r, i) => toUI(r, many ? `البيت ${i + 1}` : "")) });
    },
    // p: { purpose, name, details, count, meter, rawi } → done(json, errJson)
    compose(pJSON, onProgress, done) {
      const p = JSON.parse(pJSON);
      p.exemplars = pickExemplars(p.purpose, p.meter);
      compose(p, check, (m) => onProgress(String(m))).then((res) => {
        const verses = res.verses.map((v, i) => composedUI(v, i));
        const alternatives = (res.alternatives || []).map((a) => ({ number: a.number, verses: a.verses.map((v, i) => composedUI(v, i)) }));
        done(JSON.stringify({ meter: res.meter || "", rawi: res.rawi || "", haraka: res.haraka || "", rounds: res.rounds || 0, chosen: res.chosen || 1, verdict: res.verdict || "", verses, alternatives }), null);
      }, (e) => done(null, errJSON(e)));
    },
    // يعيد نظم بيت واحد: poem { meter, rawi, haraka, verses:[{sadr,ajz}] }
    regenerateVerse(pJSON, poemJSON, index, onProgress, done) {
      const p = JSON.parse(pJSON);
      const poem = JSON.parse(poemJSON);
      regenerateVerse(p, poem, index, check, (m) => onProgress(String(m))).then((v) => {
        done(JSON.stringify(composedUI(v, index)), null);
      }, (e) => done(null, errJSON(e)));
    },
    // id: رقم نتيجة الوزن، opts: { rawi, haraka }
    suggestFix(id, optsJSON, onProgress, done) {
      const r = store.get(id);
      if (!r) {
        done(null, JSON.stringify({ message: "انتهت صلاحية هذه النتيجة. زِن البيت من جديد.", diag: "", raw: "" }));
        return;
      }
      const o = JSON.parse(optsJSON || "{}");
      suggestFix(r, check, (m) => onProgress(String(m)), { rhymeIssues: r.rhymeIssues, rawi: o.rawi || null, haraka: o.haraka || null }).then((good) => {
        done(JSON.stringify(good.map((g) => ({ sadr: g.sadr, ajz: g.ajz, note: g.note || "", title: meterTitle(g.result) }))), null);
      }, (e) => done(null, errJSON(e)));
    },
    testKey(onProgress, done) {
      testKey().then(() => done("ok", null), (e) => done(null, errJSON(e)));
    },
    settings: () => JSON.stringify(getSettings()),
    saveSettings: (json) => {
      saveSettings(JSON.parse(json));
    },
    hasKey: () => hasKey(),
    autoFixLimit: () => AUTO_FIX_LIMIT,
    meters: () => JSON.stringify(Object.entries(METER_INFO).map(([name, i]) => ({ name, key: i.key, feet: i.feet }))),
    purposes: () => JSON.stringify(PURPOSES),
    models: () => JSON.stringify(MODELS),
    letters: () => JSON.stringify(LETTERS),
    lastLetter: (t) => lastLetter2(t) || ""
  };
})();
