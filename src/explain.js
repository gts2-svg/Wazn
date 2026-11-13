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

// أول حرف يخرج به المقطع عن أقرب صورة جائزة، بحروفه
const LETTER = /[\u0621-\u064A\u0671]/;
function firstBreak(f, got, atEnd) {
  if (!f.text || !got) return null;
  const units = [];
  for (const ch of f.text) {
    if (LETTER.test(ch)) units.push(ch);
    else if (units.length) units[units.length - 1] += ch;
  }
  if (units.length !== got.length) return null;
  // في آخر الشطر: إن تمّت صورة جائزة وبقي بعدها شيء فهو زيادة
  if (atEnd) {
    const pre = (f.allowed || []).filter(v => v.p.length < got.length && got.startsWith(v.p)).sort((a, b) => b.p.length - a.p.length)[0];
    if (pre) return { v: pre, i: pre.p.length, text: f.text, ok: units.slice(0, pre.p.length).join(''), extra: units.slice(pre.p.length).join('') };
  }
  let best = null;
  for (const v of f.allowed || []) {
    let i = 0;
    while (i < got.length && i < v.p.length && got[i] === v.p[i]) i++;
    if (i < got.length && i < v.p.length && (!best || i > best.i)) best = { i, v };
  }
  if (!best) return null;
  return { ...best, text: f.text, ok: units.slice(0, best.i).join(''), at: units[best.i] };
}

// نص واحد لكل تفعيلة مكسورة
export function brokenFootText(f, k, role, meter, words) {
  const allowed = (f.allowed || []).map(v => `${v.name} (${sym(v.p)})`);
  const exp = f.vp || f.exp || '';
  const at = (f.words || []).map(i => words[i] && (words[i].display || words[i].text)).filter(Boolean);
  const where = `التفعيلة ${ORD[k] || k + 1} — ${role}${at.length ? ` عند «${at.join(' ')}»` : ''}`;
  let what;
  const got = f.got || '';
  // اسم الصورة لا يُذكر إلا إذا كانت بطول صور الموضع، وإلا كان اسمها مضلّلاً (كأن يُقال «مفاعلن» في موضع «فعولن»)
  const sameLen = (f.allowed || []).some(v => v.p.length === got.length);
  const known = f.gotName && sameLen && !(f.allowed || []).some(v => v.p === got);
  const pos = firstBreak(f, got, role !== 'الحشو');
  if (pos && pos.extra) {
    what = `جاء المقطع «${pos.text}» على (${sym(got)})، فتتم ${pos.v.name} (${sym(pos.v.p)}) عند «${pos.ok}» ويزيد «${pos.extra}»`;
  } else if (pos) {
    what = `جاء المقطع «${pos.text}» على (${sym(got)})، فيستقيم ${pos.ok ? `إلى «${pos.ok}» ` : ''}ثم يأتي «${pos.at}» ${got[pos.i] === '1' ? 'متحركاً وحقه السكون' : 'ساكناً وحقه الحركة'} في ${pos.v.name} (${sym(pos.v.p)})`;
  } else if (known) {
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
