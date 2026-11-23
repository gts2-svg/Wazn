// وزن — التأليف واقتراح التصحيح بالذكاء الاصطناعي
// المفتاح يُحفظ على هذا الجهاز فقط، ويُرسل مباشرة إلى Anthropic
import { METER_INFO } from './meters.js';
import { checkRhymes } from './engine.js';
import { verseProblems, sym } from './explain.js';
import { CRAFT_GUIDE } from './craft.js';

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

// أقصى حد للرد عند إعادة المحاولة
const MAX_RETRY_TOKENS = 64000;
// النماذج التي رفضت التفكير المتكيّف مرة لا يُطلب منها ثانية في هذه الجلسة
const noThinking = new Set();
async function callClaude({ model, system, messages, maxTokens = 32000, tool = null, onProgress = null, think = false, effort = 'high' }) {
  const { key } = getSettings();
  if (!key) throw new AIError('أضف مفتاح الـ API من الإعدادات أولاً.');
  const body = { model, max_tokens: maxTokens, system, messages };
  // بعض النماذج لا تقبل إلزام الأداة، فنتركها «auto» ونطلب استعمالها في التعليمات
  if (tool) { body.tools = [tool]; body.tool_choice = { type: 'auto' }; }
  // التفكير المتكيّف: عالٍ للشاعر، ومتوسط للناقد، وخفيف لإصلاح الوزن
  if (think && !noThinking.has(model)) { body.thinking = { type: 'adaptive' }; body.output_config = { effort }; }
  let data;
  try { data = await transport(body, key); }
  catch (e) {
    // إن رفض النموذج إعداد التفكير نعيد الطلب بدونه بدل أن يفشل النظم
    if (body.thinking && e && /HTTP 400/.test(e.diag || '') && /think|output_config|effort/i.test(e.diag || '')) {
      noThinking.add(model);
      delete body.thinking; delete body.output_config;
      const clean = messages.map(m => Array.isArray(m.content) ? { ...m, content: m.content.filter(c => c.type !== 'thinking' && c.type !== 'redacted_thinking') } : m);
      body.messages = clean;
      data = await transport(body, key);
    } else throw e;
  }
  // إذا استنفد التفكيرُ الحدَّ قبل أن يكتب شيئاً، نعيد مرة واحدة بحد أعلى
  const empty = (d) => d.stop_reason === 'max_tokens' && !(d.content || []).some(c => c.type === 'tool_use' || (c.type === 'text' && c.text.trim()));
  if (empty(data) && maxTokens < MAX_RETRY_TOKENS) {
    if (onProgress) onProgress('أطال التفكير، يعيد المحاولة بمساحة أكبر…');
    try { data = await transport({ ...body, max_tokens: MAX_RETRY_TOKENS }, key); } catch (e) { /* تبقى النتيجة الأولى ويظهر سببها */ }
  }
  const content = data.content || [];
  const text = content.filter(c => c.type === 'text').map(c => c.text).join('');
  const use = content.find(c => c.type === 'tool_use');
  return { text, input: use ? use.input : null, toolId: use ? use.id : null, content, stop: data.stop_reason, usage: data.usage || {} };
}

// يستخرج الكائن من الأداة، وإلا من النص
function payload(res) {
  if (res.input && typeof res.input === 'object') {
    // بعض الردود تأتي بالقوائم نصاً، فتُفك
    for (const k of Object.keys(res.input)) {
      const v = res.input[k];
      if (typeof v === 'string' && /^\s*[\[{]/.test(v)) { try { res.input[k] = JSON.parse(v); } catch (e) {} }
    }
    return res.input;
  }
  try { return parseJSON(res.text); }
  catch (e) {
    const why = res.stop === 'max_tokens' ? 'انقطع الرد لطوله، حتى بعد إعادة المحاولة.' : res.stop === 'refusal' ? 'اعتذر النموذج عن الطلب.' : 'لم يصل الرد بالشكل المطلوب.';
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
  text = String(text || '').replace(/```(?:json)?/g, '');
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

const POET_SYSTEM = `أنت شاعر عربي فحل، تنظم الشعر العمودي على عروض الخليل بن أحمد. غايتك أن يُطرب البيت ويُحفظ ويُتمثَّل به، لا أن يسلم وزنه فحسب.

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

const CRITIC_SYSTEM = `أنت ناقد شعر عربي بصير على طريقة الآمدي وابن رشيق، وشاعر مجيد في الوقت نفسه. تُعرض عليك صياغات لقصيدة واحدة كتبها شاعر بحسب طلب صاحبها.

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

export const PURPOSES = ['مدح', 'تهنئة', 'رثاء', 'شكر', 'حكمة', 'غزل عفيف', 'هجاء'];

const VERSE_ITEM = { type: 'object', properties: { sadr: { type: 'string' }, ajz: { type: 'string' }, craft: { type: 'string', description: 'صنعة البيت في سطر' } }, required: ['sadr', 'ajz', 'craft'] };
const DRAFTS_TOOL = {
  name: 'submit_drafts',
  description: 'سلّم صياغات القصيدة، كل بيت مشكول تشكيلاً كاملاً ومعه صنعته.',
  input_schema: {
    type: 'object',
    properties: {
      meter: { type: 'string', description: 'اسم البحر' },
      rawi: { type: 'string', description: 'حرف الروي' },
      drafts: { type: 'array', items: { type: 'object', properties: { verses: { type: 'array', items: VERSE_ITEM } }, required: ['verses'] } },
    },
    required: ['meter', 'drafts'],
  },
};
const FINAL_TOOL = {
  name: 'submit_final',
  description: 'سلّم القصيدة النهائية مشكولة، مع صنعة كل بيت وحكم الناقد.',
  input_schema: {
    type: 'object',
    properties: {
      chosen: { type: 'integer', description: 'رقم الصياغة المختارة، من ١' },
      verses: { type: 'array', items: VERSE_ITEM },
      verdict: { type: 'string' },
    },
    required: ['chosen', 'verses'],
  },
};
const ONE_VERSE_TOOL = {
  name: 'submit_verse',
  description: 'سلّم البيت الجديد مشكولاً تشكيلاً كاملاً مع صنعته.',
  input_schema: { type: 'object', properties: { verse: VERSE_ITEM }, required: ['verse'] },
};

// القصيدة القصيرة تُكتب ثلاث صياغات؛ الطويلة صياغة واحدة يقوّمها الناقد
export const DRAFTS_UP_TO = 4;

function requestText(p) {
  const lines = [`الغرض: ${p.purpose}`];
  if (p.name) lines.push(`الاسم: ${p.name}`);
  if (p.details) lines.push(`التفاصيل والصفات: ${p.details}`);
  lines.push(`عدد الأبيات: ${p.count}`);
  if (p.meter) lines.push(`البحر: ${p.meter} (${METER_INFO[p.meter].feet})`);
  else lines.push('البحر: اختر البحر الأنسب للغرض من بحور الخليل الستة عشر.');
  if (p.rawi) lines.push(`حرف الروي: ${p.rawi}`);
  else lines.push('حرف الروي: اختر روياً سهلاً كثير الألفاظ يناسب الغرض.');
  return lines.join('\n');
}
function exemplarText(p) {
  const ex = (p.exemplars || []).filter(Boolean);
  return ex.length ? `\n\nأبيات للاستئناس بالمستوى (لا تنقل منها):\n${ex.join('\n')}` : '';
}
function cleanVerses(list) {
  return (list || []).filter(v => v && v.sadr && v.ajz).map(v => ({ sadr: String(v.sadr).trim(), ajz: String(v.ajz).trim(), craft: String(v.craft || '').trim() }));
}
function numbered(vs) { return vs.map((v, i) => `${i + 1}. ${verseText(v)}`).join('\n'); }

// يزن الأبيات ويجمع عيوبها؛ يرجع { results, problems, haraka }
async function weighAll(verses, target, rawi, check) {
  const results = await check(verses.map(v => ({ parts: [v.sadr, v.ajz], meter: target })));
  const rh = checkRhymes(results.map(r => r && r.rhymeInfo), { rawi });
  const problems = [];
  results.forEach((r, i) => {
    const pr = r && r.exact ? [] : describeProblems(r, target);
    for (const iss of rh.issues[i]) pr.push(`عيب في القافية (${iss.kind}): ${iss.msg}.`);
    verses[i].ok = pr.length === 0;
    verses[i].rhymeIssues = rh.issues[i];
    if (pr.length) problems.push(`البيت ${i + 1}: ${verseText(verses[i])}\n- ${pr.join('\n- ')}`);
  });
  return { results, problems, haraka: rh.haraka && rh.haraka !== 'السكون' ? rh.haraka : null };
}

/**
 * ينظم القصيدة على مراحل: الشاعر يكتب صياغاته، والناقد يختار ويعيد نظم الضعيف،
 * والميزان يزن، والمكسور يُعاد نظمه بيتاً كاملاً لا ترقيعاً.
 * check(items) => Promise<results> من المحرك
 */
export async function compose(p, check, onProgress = () => {}) {
  const { composeModel } = getSettings();
  const nDrafts = p.count <= DRAFTS_UP_TO ? 3 : 1;
  const request = requestText(p);

  // ١) الشاعر
  onProgress('يتأمّل ويخطّط للقصيدة…');
  const ask = nDrafts > 1
    ? `اكتب ثلاث صياغات مستقلة للقصيدة، تختلف في المدخل والصور والأساليب، لا تنويعات لفظية على صياغة واحدة.`
    : 'اكتب صياغة واحدة للقصيدة.';
  const poetMsgs = [{ role: 'user', content: `${request}${exemplarText(p)}\n\n${ask}\nسلّم باستدعاء الأداة submit_drafts.` }];
  const pr = await callClaude({ model: composeModel, system: POET_SYSTEM, messages: poetMsgs, tool: DRAFTS_TOOL, think: true, onProgress });
  const pd = payload(pr);
  let drafts = (Array.isArray(pd.drafts) ? pd.drafts : []).map(d => cleanVerses(d && d.verses)).filter(d => d.length);
  if (!drafts.length && pd.verses) drafts = [cleanVerses(pd.verses)].filter(d => d.length);
  if (!drafts.length) { const er = new AIError('لم تصل أبيات. افتح «تفاصيل الخطأ» وصوّرها.'); er.diag = `stop: ${pr.stop}\ninput: ${JSON.stringify(pr.input || {}).slice(0, 500)}`; er.raw = (pr.text || '').slice(0, 500); throw er; }

  // البحر والروي إن تُركا للشاعر
  let target = p.meter || null;
  let rawi = p.rawi || null;
  if (!target) {
    const free = await check(drafts[0].map(v => ({ parts: [v.sadr, v.ajz] })));
    target = majority(free.filter(r => r && r.exact).map(r => r.meter)) || normalizeMeter(pd.meter) || majority(free.map(r => r && r.meter));
  }

  // ٢) الناقد
  onProgress(nDrafts > 1 ? 'الناقد يوازن بين الصياغات…' : 'الناقد يقرأ القصيدة…');
  const shown = drafts.map((d, i) => `الصياغة ${i + 1}:\n${numbered(d)}`).join('\n\n');
  const criticMsgs = [{ role: 'user', content: `طلب صاحب القصيدة:\n${request}\nالبحر: ${target || pd.meter || ''}${rawi || pd.rawi ? `، الروي: ${rawi || pd.rawi}` : ''}\n\n${shown}\n\nاختر وقوّم، وسلّم القصيدة النهائية بالأداة submit_final.` }];
  let cr = await callClaude({ model: composeModel, system: CRITIC_SYSTEM, messages: criticMsgs, tool: FINAL_TOOL, think: true, effort: 'medium', onProgress });
  let cd = payload(cr);
  let verses = cleanVerses(cd.verses);
  let chosen = Math.min(Math.max(parseInt(cd.chosen, 10) || 1, 1), drafts.length) - 1;
  const verdict = String(cd.verdict || '').trim();
  if (!verses.length) verses = drafts[chosen].map(v => ({ ...v }));

  // ٣) الميزان، والمكسور يُعاد نظمه كاملاً
  onProgress('يزن القصيدة…');
  if (!rawi) {
    const res0 = await check(verses.map(v => ({ parts: [v.sadr, v.ajz], meter: target })));
    rawi = majority(res0.filter(r => r && r.exact).map(r => r.rhyme)) || pd.rawi || null;
  }
  let w = await weighAll(verses, target, rawi, check);
  let round = 0;
  while (w.problems.length && round < MAX_FIX_ROUNDS) {
    round++;
    onProgress(`يعيد نظم ما انكسر (المحاولة ${round} من ${MAX_FIX_ROUNDS})…`);
    followUp(criticMsgs, cr,
      `زن الميزان الآلي القصيدة على ${target} (${METER_INFO[target] ? METER_INFO[target].feet : ''})${rawi ? ` وعلى روي «${rawi}»` : ''}، والرمز / متحرك وه ساكن. هذه الأبيات انكسرت:\n\n${w.problems.join('\n\n')}\n\nأعد نظم كل بيت منكسر كاملاً بمعناه وصورته في موضعه، لا ترقيعاً لكلمة، وأبقِ السليم كما هو حرفاً بحرف، وشكّل كل حرف، ثم سلّم القصيدة كلها من جديد بالترتيب نفسه مع الصنعة بالأداة submit_final.`);
    cr = await callClaude({ model: composeModel, system: CRITIC_SYSTEM, messages: criticMsgs, tool: FINAL_TOOL, think: true, effort: 'low', onProgress });
    cd = payload(cr);
    const fixed = cleanVerses(cd.verses);
    if (fixed.length === verses.length) verses = fixed;
    onProgress('يزن القصيدة…');
    w = await weighAll(verses, target, rawi, check);
  }

  // الصياغات الأخرى: تُوزن لتُعرض، ولا تُصلح
  const alternatives = [];
  for (let i = 0; i < drafts.length; i++) {
    if (i === chosen) continue;
    const vs = drafts[i].map(v => ({ ...v }));
    const aw = await weighAll(vs, target, rawi, check);
    alternatives.push({ number: i + 1, verses: vs.map((v, j) => ({ ...v, result: aw.results[j] })) });
  }

  return {
    meter: target, rawi, haraka: w.haraka, rounds: round, chosen: chosen + 1, verdict,
    verses: verses.map((v, i) => ({ ...v, result: w.results[i] })),
    alternatives,
  };
}

/**
 * يعيد نظم بيت واحد من القصيدة ويُبقي غيره
 * poem: { meter, rawi, haraka, verses:[{sadr,ajz}] }
 */
export async function regenerateVerse(p, poem, index, check, onProgress = () => {}) {
  const { composeModel } = getSettings();
  const target = poem.meter;
  const others = poem.verses.filter((_, i) => i !== index).map(v => v.ajz.trim().split(/\s+/).pop());
  const msgs = [{ role: 'user', content: `${requestText(p)}\n\nالقصيدة الآن (البحر ${target}${poem.rawi ? `، الروي «${poem.rawi}»` : ''}${poem.haraka ? ` وحركته ${poem.haraka}` : ''}):\n${numbered(poem.verses)}\n\nأعد نظم البيت رقم ${index + 1} وحده نظماً جديداً أجود منه، يخدم موضعه من القصيدة ويتصل بما قبله وما بعده، على البحر والروي وحركته. لا تكرر كلمة قافية مستعملة في غيره (${others.join('، ')}). وشكّل كل حرف، واكتب صنعته، وسلّم بالأداة submit_verse.` }];
  let verse = null, result = null;
  for (let round = 0; round <= 2; round++) {
    onProgress(round === 0 ? 'ينظم بيتاً بديلاً…' : 'يعيد نظمه لأنه انكسر…');
    const r = await callClaude({ model: composeModel, system: POET_SYSTEM, messages: msgs, tool: ONE_VERSE_TOOL, think: true, effort: round === 0 ? 'medium' : 'low', onProgress });
    const d = payload(r);
    const v = cleanVerses([d.verse || d])[0];
    if (!v) continue;
    onProgress('يزن البيت…');
    const res = (await check([{ parts: [v.sadr, v.ajz], meter: target }]))[0];
    const probs = res && res.exact ? [] : describeProblems(res, target);
    const ri = res && res.rhymeInfo;
    if (poem.rawi && ri && ri.rawi !== poem.rawi) probs.push(`الروي «${ri.rawi}» والمطلوب «${poem.rawi}».`);
    if (poem.haraka && ri && ri.haraka && ri.haraka !== poem.haraka) probs.push(`حركة الروي ${ri.haraka} والمطلوب ${poem.haraka}.`);
    verse = v; result = res;
    if (!probs.length) return { ...v, ok: true, result: res };
    followUp(msgs, r, `زن الميزان البيت فانكسر:\n- ${probs.join('\n- ')}\nأعد نظمه كاملاً على ${target} (${METER_INFO[target] ? METER_INFO[target].feet : ''})، وشكّل كل حرف، وسلّم بالأداة submit_verse.`);
  }
  if (!verse) throw new AIError('لم يصل بيت. حاول مرة ثانية.');
  return { ...verse, ok: false, result };
}

/* ---------------- اقتراح التصحيح ---------------- */

const FIX_SYSTEM = `أنت عروضي وشاعر فصيح. يُعطى لك بيت فيه كسر في الوزن أو عيب في القافية، مع موضعه ووجهه كما حددهما ميزان آلي.
اقترح ثلاث صيغ سليمة للبيت على البحر والقافية المطلوبين، بأقل تغيير ممكن يحفظ معنى الشاعر وألفاظه. وإن كان العيب في الوزن وحده فحافظ على كلمة القافية.
شكّل كل حرف تشكيلاً كاملاً.
سلّم الصيغ باستدعاء الأداة submit_suggestions دائماً، ومع كل صيغة ملاحظة قصيرة بما غيّرته، ولا تكتبها نصاً خارج الأداة.`;

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
    const resp = await callClaude({ model: fixModel, system: FIX_SYSTEM, messages, tool: FIX_TOOL, onProgress });
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
