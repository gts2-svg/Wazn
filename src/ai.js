// وزن — التأليف واقتراح التصحيح بالذكاء الاصطناعي
// المفتاح يُحفظ على هذا الجهاز فقط، ويُرسل مباشرة إلى Anthropic
import { METER_INFO } from './meters.js';
import { checkRhymes } from './engine.js';
import { verseProblems, sym } from './explain.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5 — أجود شعراً' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 — أسرع وأرخص' },
];
const DEFAULTS = { key: '', composeModel: 'claude-opus-5-5', fixModel: 'claude-sonnet-5-5', autoFix: true };
export const AUTO_FIX_LIMIT = 3;
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
    const mk = (t) => { const er = new AIError(t); er.diag = `HTTP ${res.status}\n${msg}`; return er; };
    if (res.status === 401) throw mk('المفتاح غير صحيح. راجعه في الإعدادات.');
    if (res.status === 403) throw mk('المفتاح لا يملك صلاحية لهذا الطلب.');
    if (res.status === 404) throw mk('النموذج المختار غير متاح لحسابك. غيّره من الإعدادات.');
    if (res.status === 429) throw mk('بلغت حد الطلبات أو حد الصرف. انتظر قليلاً أو راجع حدود حسابك.');
    if (res.status === 529 || res.status >= 500) throw mk('خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل.');
    if (/credit|balance/i.test(msg)) throw mk('رصيد الحساب لا يكفي.');
    const e2 = new AIError('رفض الطلب: ' + (msg || res.status)); e2.diag = `HTTP ${res.status}\n${msg}`; throw e2;
  }
  return res.json();
};
// للاختبار فقط
export function setTransport(fn) { transport = fn; }

async function callClaude({ model, system, messages, maxTokens = 4000, tool = null }) {
  const { key } = getSettings();
  if (!key) throw new AIError('أضف مفتاح الـ API من الإعدادات أولاً.');
  const body = { model, max_tokens: maxTokens, system, messages };
  if (tool) { body.tools = [tool]; body.tool_choice = { type: 'tool', name: tool.name }; }
  const data = await transport(body, key);
  const content = data.content || [];
  const text = content.filter(c => c.type === 'text').map(c => c.text).join('');
  const use = content.find(c => c.type === 'tool_use');
  return { text, input: use ? use.input : null, toolId: use ? use.id : null, content, stop: data.stop_reason, usage: data.usage || {} };
}

// يستخرج الكائن من الأداة، وإلا من النص
function payload(res) {
  if (res.input && typeof res.input === 'object') {
    if (typeof res.input.verses === 'string' || typeof res.input.suggestions === 'string') {
      try { const k = res.input.verses ? 'verses' : 'suggestions'; res.input[k] = JSON.parse(res.input[k]); } catch (e) {}
    }
    return res.input;
  }
  try { return parseJSON(res.text); }
  catch (e) {
    const why = res.stop === 'max_tokens' ? 'انقطع الرد لطوله.' : res.stop === 'refusal' ? 'اعتذر النموذج عن الطلب.' : 'لم يصل الرد بالشكل المطلوب.';
    const err = new AIError(why + ' افتح «تفاصيل الخطأ» وصوّرها.');
    err.raw = (res.text || '').slice(0, 800);
    err.diag = `stop: ${res.stop}\nblocks: ${(res.content || []).map(c => c.type).join(', ') || 'لا شيء'}`;
    throw err;
  }
}

// رسالتا المتابعة بعد رد استعمل الأداة
function followUp(messages, res, text) {
  if (res.toolId) {
    messages.push({ role: 'assistant', content: res.content });
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: res.toolId, content: 'وصلت الأبيات وفُحصت.' }, { type: 'text', text }] });
  } else {
    messages.push({ role: 'assistant', content: res.text });
    messages.push({ role: 'user', content: text });
  }
}

const VERSES_TOOL = {
  name: 'submit_verses',
  description: 'سلّم الأبيات المؤلفة مشكولة تشكيلاً كاملاً.',
  input_schema: {
    type: 'object',
    properties: {
      meter: { type: 'string', description: 'اسم البحر' },
      rawi: { type: 'string', description: 'حرف الروي' },
      verses: { type: 'array', items: { type: 'object', properties: { sadr: { type: 'string' }, ajz: { type: 'string' } }, required: ['sadr', 'ajz'] } },
    },
    required: ['meter', 'verses'],
  },
};
const FIX_TOOL = {
  name: 'submit_suggestions',
  description: 'سلّم الصيغ المقترحة للبيت مشكولة تشكيلاً كاملاً.',
  input_schema: {
    type: 'object',
    properties: {
      suggestions: { type: 'array', items: { type: 'object', properties: { sadr: { type: 'string' }, ajz: { type: 'string' }, note: { type: 'string' } }, required: ['sadr', 'ajz'] } },
    },
    required: ['suggestions'],
  },
};

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

// وصف الكسر بلغة العروض (من قواعد المحرك)
export function describeProblems(r, targetMeter) {
  if (!r || r.empty || r.error) return ['لم يُفهم البيت.'];
  const out = [];
  if (targetMeter && r.meter !== targetMeter) out.push(`ليس على ${targetMeter}.`);
  for (const p of verseProblems(r)) out.push(`${p.text}${p.cut ? ` (تقطيعها كما قُرئت: ${p.cut})` : ''}`);
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
- وحّد حركة الروي في كل الأبيات، والتزم الردف إن بدأت به، ولا تكرر كلمة القافية.
- إن كان الغرض هجاءً فاجعله هجاءً ظريفاً من باب الدعابة والممازحة بين الأصحاب: لا فحش، ولا قذف، ولا طعن في نسب أو قبيلة أو عرض أو دين أو لون، ولا اتهام بجرم، ولا تهديد.
سلّم الأبيات عبر الأداة submit_verses: كل بيت صدر وعجز، مع اسم البحر وحرف الروي.`;

export const PURPOSES = ['مدح', 'تهنئة', 'رثاء', 'شكر', 'حكمة', 'غزل عفيف', 'هجاء'];

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
  let haraka = null;
  let verses = [];
  let results = [];
  let round = 0;

  while (true) {
    onProgress(round === 0 ? 'يكتب الأبيات…' : `يصلح ما انكسر (المحاولة ${round} من ${MAX_FIX_ROUNDS})…`);
    const res = await callClaude({ model: composeModel, system: COMPOSE_SYSTEM, messages, tool: VERSES_TOOL });
    const data = payload(res);
    const vs = (data.verses || []).filter(v => v && v.sadr && v.ajz).map(v => ({ sadr: String(v.sadr).trim(), ajz: String(v.ajz).trim() }));
    if (!vs.length) { const er = new AIError('لم تصل أبيات. افتح «تفاصيل الخطأ» وصوّرها.'); er.diag = `stop: ${res.stop}\ninput: ${JSON.stringify(res.input || {}).slice(0, 500)}`; er.raw = (res.text || '').slice(0, 500); throw er; }
    verses = vs;

    onProgress('يزن الأبيات…');
    if (!target) {
      const free = await check(verses.map(v => ({ parts: [v.sadr, v.ajz] })));
      target = majority(free.filter(r => r && r.exact).map(r => r.meter)) || normalizeMeter(data.meter) || majority(free.map(r => r && r.meter));
    }
    results = await check(verses.map(v => ({ parts: [v.sadr, v.ajz], meter: target })));
    if (!rawi) rawi = majority(results.filter(r => r && r.exact).map(r => r.rhyme)) || data.rawi || null;
    const rh = checkRhymes(results.map(r => r && r.rhymeInfo), { rawi });
    haraka = rh.haraka && rh.haraka !== 'السكون' ? rh.haraka : null;

    const problems = [];
    results.forEach((r, i) => {
      const pr = r && r.exact ? [] : describeProblems(r, target);
      for (const iss of rh.issues[i]) pr.push(`عيب في القافية (${iss.kind}): ${iss.msg}.`);
      verses[i].ok = pr.length === 0;
      verses[i].rhymeIssues = rh.issues[i];
      if (pr.length) problems.push(`البيت ${i + 1}: ${verseText(verses[i])}\n- ${pr.join('\n- ')}`);
    });

    if (!problems.length || round >= MAX_FIX_ROUNDS) break;
    round++;
    followUp(messages, res,
      `فحص الميزان الآلي الأبيات على ${target} (${METER_INFO[target] ? METER_INFO[target].feet : ''})${rawi ? ` وعلى روي «${rawi}»` : ''}، والرمز / متحرك وه ساكن. هذه الأبيات انكسرت:\n\n${problems.join('\n\n')}\n\nأصلح هذه الأبيات وحدها بأقل تغيير يحفظ المعنى، وأبقِ السليم كما هو حرفاً بحرف، وشكّل كل حرف، ثم سلّم الأبيات كلها من جديد بالترتيب نفسه.`);
  }

  return {
    meter: target, rawi, haraka, rounds: round,
    verses: verses.map((v, i) => ({ ...v, result: results[i] })),
  };
}

/* ---------------- اقتراح التصحيح ---------------- */

const FIX_SYSTEM = `أنت عروضي وشاعر فصيح. يُعطى لك بيت فيه كسر في الوزن أو عيب في القافية، مع موضعه ووجهه كما حددهما ميزان آلي.
اقترح ثلاث صيغ سليمة للبيت على البحر والقافية المطلوبين، بأقل تغيير ممكن يحفظ معنى الشاعر وألفاظه. وإن كان العيب في الوزن وحده فحافظ على كلمة القافية.
شكّل كل حرف تشكيلاً كاملاً.
سلّم الصيغ عبر الأداة submit_suggestions، ومع كل صيغة ملاحظة قصيرة بما غيّرته.`;

// opts: { rhymeIssues: [{kind,msg}], rawi, haraka }
export async function suggestFix(r, check, onProgress = () => {}, opts = {}) {
  const { fixModel } = getSettings();
  const meter = r.meter;
  const parts = r.input && r.input.parts ? r.input.parts : null;
  const original = parts ? `${parts[0]} * ${parts[1] || ''}` : (r.input && r.input.text) || '';
  const probs = r.exact ? [] : describeProblems(r, meter);
  for (const iss of opts.rhymeIssues || []) probs.push(`عيب في القافية (${iss.kind}): ${iss.msg}.`);
  const rhymeWant = opts.rawi ? `\nالقافية المطلوبة: الروي «${opts.rawi}»${opts.haraka ? ` وحركته ${opts.haraka}` : ''}.` : '';
  const messages = [{
    role: 'user',
    content: `البحر المقصود: ${meter} (${METER_INFO[meter] ? METER_INFO[meter].feet : ''})${rhymeWant}\nالبيت: ${original}\nما وجده الميزان (/ متحرك، ه ساكن):\n- ${probs.join('\n- ')}`,
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
    onProgress(round === 0 ? 'يقترح تعديلاً…' : 'يحاول مرة ثانية…');
    const resp = await callClaude({ model: fixModel, system: FIX_SYSTEM, messages, maxTokens: 2500, tool: FIX_TOOL });
    const data = payload(resp);
    const sugg = (data.suggestions || []).filter(s => s && s.sadr && s.ajz);
    if (!sugg.length) continue;
    onProgress('يزن الاقتراحات…');
    const res = await check(sugg.map(s => ({ parts: [s.sadr, s.ajz], meter })));
    const bad = [];
    sugg.forEach((s, i) => {
      if (res[i] && res[i].exact && rhymeOK(res[i])) good.push({ ...s, result: res[i] });
      else {
        const pr = res[i] && res[i].exact ? ['خالف القافية المطلوبة.'] : describeProblems(res[i], meter);
        bad.push(`${verseText(s)}\n- ${pr.join('\n- ')}`);
      }
    });
    if (!good.length) {
      followUp(messages, resp, `كل الاقتراحات لم تسلم عند الفحص:\n\n${bad.join('\n\n')}\n\nاقترح ثلاث صيغ أخرى سليمة الوزن والقافية، وشكّل كل حرف.`);
    }
  }
  return good;
}
