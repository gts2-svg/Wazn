// وزن — شرح الكسر بمصطلح العروض، من قواعد المحرك نفسه (بلا ذكاء اصطناعي)

export const sym = s => [...(s || '')].map(b => b === '1' ? '/' : 'ه').join('');
const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

// موضع التفعيلة: حشو أو عروض (آخر الصدر) أو ضرب (آخر العجز)
export function footRole(hemiIndex, k, nFeet, joined) {
  if (joined) {
    const half = nFeet / 2;
    if (k === half - 1) return 'العروض';
    if (k === nFeet - 1) return 'الضرب';
    return 'الحشو';
  }
  if (k === nFeet - 1) return hemiIndex === 1 ? 'الضرب' : 'العروض';
  return 'الحشو';
}

function diffKind(got, exp) {
  if (got.length < exp.length) {
    const d = exp.length - got.length;
    return `ناقصة ${d === 1 ? 'حرفاً واحداً' : d === 2 ? 'حرفين' : d + ' أحرف'} عمّا يقتضيه الوزن`;
  }
  if (got.length > exp.length) {
    const d = got.length - exp.length;
    return `زائدة ${d === 1 ? 'حرفاً واحداً' : d === 2 ? 'حرفين' : d + ' أحرف'} على ما يقتضيه الوزن`;
  }
  const parts = [];
  for (let i = 0; i < got.length; i++) {
    if (got[i] === exp[i]) continue;
    parts.push(got[i] === '0' ? 'سُكّن فيها ما حقه الحركة' : 'حُرّك فيها ما حقه السكون');
  }
  return [...new Set(parts)].join('، و');
}

// نص واحد لكل تفعيلة مكسورة
export function brokenFootText(f, k, role, meter, words) {
  const allowed = (f.allowed || []).map(v => `${v.name} (${sym(v.p)})`);
  const exp = f.vp || f.exp || '';
  const at = (f.words || []).map(i => words[i] && (words[i].display || words[i].text)).filter(Boolean);
  const where = `التفعيلة ${ORD[k] || k + 1} — ${role}${at.length ? ` عند «${at.join(' ')}»` : ''}`;
  let what;
  const known = f.gotName && !(f.allowed || []).some(v => v.p === f.got);
  if (known) {
    what = `جاءت «${f.gotName.name}» (${sym(f.got)})${f.gotName.note ? ` ${f.gotName.note}` : ''}، وهذه الصورة لا تجوز في ${role === 'الحشو' ? 'حشو' : role === 'العروض' ? 'عروض' : 'ضرب'} ${meter}`;
  } else {
    what = `جاءت (${sym(f.got)})${exp ? ` ${diffKind(f.got, exp)}` : ''}`;
  }
  const can = allowed.length === 1 ? `ولا يجوز هنا إلا ${allowed[0]}` : `والجائز هنا: ${allowed.slice(0, 4).join(' أو ')}`;
  return { where, what, can, text: `${where}: ${what}. ${can}.` };
}

// كل الكسور في نتيجة بيت
export function verseProblems(r) {
  const out = [];
  if (!r || !r.hemistichs) return out;
  const joined = !!r.joined;
  const labels = joined ? ['البيت'] : r.single ? ['الشطر'] : ['الصدر', 'العجز'];
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
