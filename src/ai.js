// وزن — التأليف واقتراح التصحيح بالذكاء الاصطناعي
// المفتاح يُحفظ على هذا الجهاز فقط، ويُرسل مباشرة إلى Anthropic
import { METER_INFO } from './meters.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5 — أجود شعراً' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 — أسرع وأرخص' },
];
const DEFAULTS = { key: '', composeModel: 'claude-opus-5-5', fixModel: 'claude-sonnet-5-5' };
const MAX_FIX_ROUNDS = 3;

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('wazn.ai') || '{}') }; }
  catch (e) { return { ...DEFAULTS }; }
}
export function saveSettings(s) {
  localStorage.setItem('wazn.ai', JSON.stringify({ ...getSettings(), ...s }));
}
export function hasKey() { return !!getSettings().key; }

/* ---------------- الاتصال ---------------- */

export class AIError extends Error {}

let transport = async (body, key) => {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AIError('تعذّر الاتصال. هذه الميزة تحتاج إنترنت.');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error.message; } catch (e) {}
    if (res.status === 401) throw new AIError('المفتاح غير صحيح. راجعه في الإعدادات.');
    if (res.status === 403) throw new AIError('المفتاح لا يملك صلاحية لهذا الطلب.');
    if (res.status === 404) throw new AIError('النموذج المختار غير متاح لحسابك. غيّره من الإعدادات.');
    if (res.status === 429) throw new AIError('بلغت حد الطلبات أو حد الصرف. انتظر قليلاً أو راجع حدود حسابك.');
    if (res.status === 529 || res.status >= 500) throw new AIError('خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل.');
    if (/credit|balance/i.test(msg)) throw new AIError('رصيد الحساب لا يكفي.');
    throw new AIError('رفض الطلب: ' + (msg || res.status));
  }
  return res.json();
};
// للاختبار فقط
export function setTransport(fn) { transport = fn; }

async function callClaude({ model, system, messages, maxTokens = 2500 }) {
  const { key } = getSettings();
  if (!key) throw new AIError('أضف مفتاح الـ API من الإعدادات أولاً.');
  const data = await transport({ model, max_tokens: maxTokens, system, messages }, key);
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return { text, usage: data.usage || {} };
}

export async function testKey() {
  const { fixModel } = getSettings();
  await callClaude({ model: fixModel, system: 'أجب بكلمة واحدة.', messages: [{ role: 'user', content: 'قل: تمام' }], maxTokens: 10 });
  return true;
}

function parseJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new AIError('جاء الرد بصيغة غير متوقعة. حاول مرة ثانية.');
  try { return JSON.parse(text.slice(a, b + 1)); }
  catch (e) { throw new AIError('جاء الرد بصيغة غير متوقعة. حاول مرة ثانية.'); }
}

/* ---------------- أدوات الوصف ---------------- */

const METERS = Object.keys(METER_INFO);
export function normalizeMeter(name) {
  if (!name) return null;
  const n = String(name).replace(/[ً-ْ]/g, '').replace(/^(بحر|مجزوء|مخلع|مشطور|منهوك)\s+/, '').trim();
  return METERS.find(m => m === n || m === 'ال' + n || m.slice(2) === n.replace(/^ال/, '')) || null;
}

const sym = s => [...(s || '')].map(b => b === '1' ? '/' : 'ه').join('');

// وصف الكسر بلغة يفهمها الشاعر
function describeProblems(r, targetMeter) {
  const out = [];
  if (!r || r.empty || r.error) return ['لم يُفهم البيت.'];
  if (targetMeter && r.meter !== targetMeter) out.push(`ليس على ${targetMeter}.`);
  const labels = r.hemistichs.length === 2 ? ['الصدر', 'العجز'] : ['البيت'];
  r.hemistichs.forEach((h, hi) => {
    if (!h) return;
    h.feet.forEach((f, k) => {
      if (f.ok) return;
      const ws = f.words.map(i => h.words[i] && h.words[i].text).filter(Boolean).join(' ');
      out.push(`${labels[hi]}، التفعيلة ${k + 1}: المطلوب ${f.name || ''} (${sym(f.vp || f.exp)}) وجاء (${sym(f.got)}) عند «${ws}» — مقطّعة: ${f.text}`);
    });
  });
  return out;
}

function verseText(v) { return `${v.sadr} * ${v.ajz}`; }

function majority(arr) {
  const c = new Map();
  for (const x of arr) if (x) c.set(x, (c.get(x) || 0) + 1);
  let best = null, n = 0;
  for (const [k, v] of c) if (v > n) { best = k; n = v; }
  return best;
}

/* ---------------- التأليف ---------------- */

const COMPOSE_SYSTEM = `أنت شاعر عربي فصيح متمكن من عروض الخليل بن أحمد، تكتب الشعر العمودي.
القواعد:
- فصحى سليمة نحواً وصرفاً، بلا عامية ولا ألفاظ ركيكة.
- كل الأبيات على بحر واحد، وبروي واحد وحركة روي واحدة.
- شكّل كل حرف في الأبيات تشكيلاً كاملاً؛ لأن ميزاناً عروضياً آلياً سيفحص كل بيت ويرد عليك ما انكسر.
- التزم البحر التزاماً دقيقاً، وتجنب الضرورات الشعرية النادرة.
- لا تخترع عن الشخص أخباراً أو ألقاباً أو أنساباً أو مناصب لم تُذكر لك؛ ابنِ المعاني على ما أُعطيت وعلى المعاني العامة اللائقة بالغرض.
- اجعل المعاني متماسكة غير مبتذلة، وتجنب الحشو وتكرار القوافي.
- إن ذُكر اسم فاجعله في بيت واحد على الأقل إن استقام به الوزن.
أخرج JSON فقط بلا أي كلام قبله أو بعده، بهذا الشكل:
{"meter":"اسم البحر","rawi":"حرف الروي","verses":[{"sadr":"الصدر","ajz":"العجز"}]}`;

export const PURPOSES = ['مدح', 'تهنئة', 'رثاء', 'شكر', 'حكمة', 'غزل عفيف'];

function composePrompt(p) {
  const lines = [`الغرض: ${p.purpose}`];
  if (p.name) lines.push(`الاسم: ${p.name}`);
  if (p.details) lines.push(`التفاصيل والصفات: ${p.details}`);
  lines.push(`عدد الأبيات: ${p.count}`);
  if (p.meter) lines.push(`البحر: ${p.meter} (${METER_INFO[p.meter].feet})`);
  else lines.push('البحر: اختر البحر الأنسب للغرض من بحور الخليل الستة عشر.');
  if (p.rawi) lines.push(`حرف الروي: ${p.rawi}`);
  else lines.push('حرف الروي: اختر روياً سهلاً كثير الألفاظ.');
  return lines.join('\n');
}

/**
 * يؤلف أبياتاً موزونة: يكتب الذكاء الاصطناعي، ويزن المحرك، ويُعاد المكسور للإصلاح
 * check(items) => Promise<results> من العامل
 */
export async function compose(p, check, onProgress = () => {}) {
  const { composeModel } = getSettings();
  const messages = [{ role: 'user', content: composePrompt(p) }];
  let target = p.meter || null;
  let rawi = p.rawi || null;
  let verses = [];
  let results = [];
  let round = 0;
  let lastText = '';

  while (true) {
    onProgress(round === 0 ? 'يكتب الأبيات…' : `يصلح ما انكسر (المحاولة ${round} من ${MAX_FIX_ROUNDS})…`);
    const { text } = await callClaude({ model: composeModel, system: COMPOSE_SYSTEM, messages });
    lastText = text;
    const data = parseJSON(text);
    const vs = (data.verses || []).filter(v => v && v.sadr && v.ajz).map(v => ({ sadr: String(v.sadr).trim(), ajz: String(v.ajz).trim() }));
    if (!vs.length) throw new AIError('لم تصل أبيات. حاول مرة ثانية.');
    verses = vs;

    onProgress('يزن الأبيات…');
    if (!target) {
      const free = await check(verses.map(v => ({ parts: [v.sadr, v.ajz] })));
      target = majority(free.filter(r => r && r.exact).map(r => r.meter)) || normalizeMeter(data.meter) || majority(free.map(r => r && r.meter));
    }
    results = await check(verses.map(v => ({ parts: [v.sadr, v.ajz], meter: target })));
    if (!rawi) rawi = majority(results.filter(r => r && r.exact).map(r => r.rhyme)) || data.rawi || null;

    const problems = [];
    results.forEach((r, i) => {
      const pr = r && r.exact ? [] : describeProblems(r, target);
      if (rawi && r && r.rhyme && r.rhyme !== rawi) pr.push(`رويّه «${r.rhyme}» والمطلوب «${rawi}».`);
      verses[i].ok = pr.length === 0;
      if (pr.length) problems.push(`البيت ${i + 1}: ${verseText(verses[i])}\n- ${pr.join('\n- ')}`);
    });

    if (!problems.length || round >= MAX_FIX_ROUNDS) break;
    round++;
    messages.push({ role: 'assistant', content: text });
    messages.push({
      role: 'user',
      content: `فحص الميزان الآلي الأبيات على ${target} (${METER_INFO[target] ? METER_INFO[target].feet : ''})${rawi ? ` وعلى روي «${rawi}»` : ''}، والرمز / متحرك وه ساكن. هذه الأبيات انكسرت:\n\n${problems.join('\n\n')}\n\nأصلح هذه الأبيات وحدها بأقل تغيير يحفظ المعنى، وأبقِ السليم كما هو حرفاً بحرف، وشكّل كل حرف، ثم أعد JSON كاملاً بكل الأبيات بالترتيب نفسه.`,
    });
  }

  return {
    meter: target, rawi, rounds: round,
    verses: verses.map((v, i) => ({ ...v, result: results[i] })),
  };
}

/* ---------------- اقتراح التصحيح ---------------- */

const FIX_SYSTEM = `أنت عروضي وشاعر فصيح. يُعطى لك بيت مكسور الوزن مع موضع الكسر كما حدده ميزان آلي.
اقترح ثلاث صيغ موزونة للبيت على البحر المطلوب، بأقل تغيير ممكن يحفظ معنى الشاعر وألفاظه، وحافظ على كلمة القافية إن أمكن.
شكّل كل حرف تشكيلاً كاملاً.
أخرج JSON فقط: {"suggestions":[{"sadr":"...","ajz":"...","note":"ما الذي غيّرته باختصار"}]}`;

export async function suggestFix(verse, r, check, onProgress = () => {}) {
  const { fixModel } = getSettings();
  const meter = r.meter;
  const parts = r.input && r.input.parts ? r.input.parts : null;
  const original = parts ? `${parts[0]} * ${parts[1] || ''}` : verse;
  const messages = [{
    role: 'user',
    content: `البحر المقصود: ${meter} (${METER_INFO[meter] ? METER_INFO[meter].feet : ''})\nالبيت: ${original}\nموضع الكسر (/ متحرك، ه ساكن):\n- ${describeProblems(r, meter).join('\n- ')}`,
  }];
  const good = [];
  for (let round = 0; round < 2 && good.length === 0; round++) {
    onProgress(round === 0 ? 'يقترح…' : 'يحاول مرة ثانية…');
    const { text } = await callClaude({ model: fixModel, system: FIX_SYSTEM, messages, maxTokens: 1500 });
    const data = parseJSON(text);
    const sugg = (data.suggestions || []).filter(s => s && s.sadr && s.ajz);
    if (!sugg.length) continue;
    onProgress('يزن الاقتراحات…');
    const res = await check(sugg.map(s => ({ parts: [s.sadr, s.ajz], meter })));
    const bad = [];
    sugg.forEach((s, i) => {
      if (res[i] && res[i].exact) good.push({ ...s, result: res[i] });
      else bad.push(`${verseText(s)}\n- ${describeProblems(res[i], meter).join('\n- ')}`);
    });
    if (!good.length) {
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `كل الاقتراحات انكسرت عند الفحص:\n\n${bad.join('\n\n')}\n\nاقترح ثلاث صيغ أخرى موزونة، وشكّل كل حرف، وأعد JSON بالشكل نفسه.` });
    }
  }
  return good;
}
