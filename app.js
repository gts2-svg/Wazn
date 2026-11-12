// وزن — الواجهة
import { METER_INFO } from './src/meters.js';
import { splitVerse } from './src/engine.js';
import { getSettings, saveSettings, hasKey, testKey, compose, suggestFix, MODELS, PURPOSES, AIError } from './src/ai.js';

const VERSION = '1.1.0';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SAMPLES = [
  'قفا نبكِ من ذكرى حبيبٍ ومنزلِ * بسِقطِ اللوى بين الدَّخولِ فحوملِ',
  'الخيلُ والليلُ والبيداءُ تعرفني * والسيفُ والرمحُ والقرطاسُ والقلمُ',
  'إذا غامرتَ في شرفٍ مرومِ * فلا تقنعْ بما دونَ النجومِ',
  'وإذا أتتكَ مذمّتي من ناقصٍ * فهي الشهادةُ لي بأنّي كاملُ',
  'صاحِ هذي قبورُنا تملأُ الرحبَ * فأينَ القبورُ من عهدِ عادِ',
  'وللهِ في كلِّ تحريكةٍ * وتسكينةٍ أبداً شاهدُ',
  'ليسَ الغريبُ غريبَ الشامِ واليمنِ * إنّ الغريبَ غريبُ اللحدِ والكفنِ',
  'الحمدُ للهِ العليِّ الأجللِ * الواسعِ الفضلِ الوهوبِ المجزلِ',
];
const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

/* ---------------- العامل ---------------- */
const worker = new Worker('worker.js', { type: 'module' });
let reqId = 0;
const pending = new Map();
let isReady = false;
worker.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'ready') {
    isReady = true;
    $('#go').disabled = false;
    $('#status').textContent = 'جاهز';
    setTimeout(() => { if ($('#status').textContent === 'جاهز') $('#status').textContent = ''; }, 2500);
  } else if (m.type === 'result' || m.type === 'error') {
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.type === 'result' ? p.resolve(m.results) : p.reject(new Error(m.message)); }
  }
};
worker.onerror = () => { $('#status').textContent = 'تعذّر تشغيل المحرك'; };
worker.postMessage({ type: 'init' });

function analyze(items) {
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ type: 'analyze', id, items });
  });
}

/* ---------------- قراءة المدخل ---------------- */
function parseInput(text) {
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = splitVerse(lines[i]);
    if (parts.length >= 2) { items.push({ text: lines[i], parts }); continue; }
    // كل شطر في سطر: نجمع سطرين قصيرين متتاليين
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

/* ---------------- العرض ---------------- */
function meterTitle(r) {
  const m = r.meter, f = r.form;
  if (f === 'تام') return esc(m);
  if (f === 'مخلع') return 'مخلّع ' + esc(m);
  return esc(f) + ' ' + esc(m);
}

function symbols(bitsStr, expStr) {
  // / متحرك، ه ساكن
  return [...bitsStr].map(b => `<span>${b === '1' ? '/' : 'ه'}</span>`).join('');
}

function errText(e, words) {
  const w = e.word != null && words[e.word] ? `«${esc(words[e.word].display)}»` : '';
  const at = w ? `في ${w}: ` : '';
  if (e.kind === 's') return at + (e.got === '0' ? 'جاء ساكن والوزن يطلب متحركاً' : 'جاء متحرك والوزن يطلب ساكناً');
  if (e.kind === 'd') return at + (e.got === '1' ? 'حرف متحرك زائد' : 'حرف ساكن زائد');
  if (e.kind === 'i') return at + (e.exp === '1' ? 'ينقص حرف متحرك' : 'ينقص حرف ساكن');
  return at + 'خلل في الوزن';
}

function renderHemi(h, label, opts = {}) {
  const errWords = new Set(h.errors.map(e => e.word).filter(x => x != null));
  const words = h.words.map((w, i) => {
    const cls = ['w'];
    if (w.generic) cls.push('guess');
    if (errWords.has(i)) cls.push('broken');
    const title = w.generic ? ' title="تشكيل تقديري: تأكد منه"' : '';
    return `<span class="${cls.join(' ')}"${title}>${esc(w.display)}</span>`;
  }).join(' ');
  const half = opts.half || 0;
  const feet = h.feet.map((f, k) => {
    const bad = !f.ok;
    const exp = bad && f.vp ? `<div class="exp">المطلوب: ${[...f.vp].map(b => b === '1' ? '/' : 'ه').join('')}</div>` : '';
    const sep = half && k === half ? '<div class="half-sep"></div>' : '';
    return `${sep}<div class="foot${bad ? ' bad' : ''}">
      <div class="ar">${esc(f.text) || '—'}</div>
      <div class="sym">${symbols(f.got)}</div>${exp}
      <div class="name">${esc(f.name || '؟')}</div>
      ${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}
    </div>`;
  }).join('');
  // رسائل الكسر مع ترتيب التفعيلة
  const errs = [];
  const seen = new Set();
  for (const e of h.errors) {
    const k = e.foot + ':' + e.word + ':' + e.kind;
    if (seen.has(k)) continue;
    seen.add(k);
    const f = h.feet[e.foot];
    const fk = half ? (e.foot % half) : e.foot;
    errs.push(`<li>${errText(e, h.words)} — في التفعيلة ${ORD[fk] || (fk + 1)}${f && f.name ? ` (${esc(f.name)})` : ''}</li>`);
  }
  return `<div class="hemi">
    <div class="hemi-label">${label}</div>
    <div class="words">${words}</div>
    <div class="feet" style="--n:${half || h.feet.length}">${feet}</div>
    ${errs.length ? `<ul class="errs">${errs.join('')}</ul>` : ''}
  </div>`;
}

function renderResult(r) {
  const node = $('#tpl-result').content.firstElementChild.cloneNode(true);
  if (r.error || r.empty) {
    node.querySelector('.meter').textContent = '—';
    node.querySelector('.notes').innerHTML = `<p class="err-box">${r.error ? 'حدث خطأ: ' + esc(r.error) : 'لم أجد كلمات عربية في هذا السطر.'}</p>`;
    return node;
  }
  node.querySelector('.meter').innerHTML = meterTitle(r);
  const badge = node.querySelector('.badge');
  const nBad = r.hemistichs.reduce((s, h) => s + h.feet.filter(f => !f.ok).length, 0);
  if (r.exact) { badge.textContent = 'موزون ✓'; badge.classList.add('ok'); }
  else {
    badge.textContent = nBad === 1 ? 'مكسور في تفعيلة' : nBad === 2 ? 'مكسور في تفعيلتين' : `مكسور في ${nBad} تفعيلات`;
    badge.classList.add('bad');
  }

  const notes = [];
  if (r.autoSplit) notes.push('<p>قسّمتُ البيت إلى صدر وعجز تلقائياً.</p>');
  if (r.madwar) notes.push('<p>بيت مدوّر: كلمة مشتركة بين الشطرين.</p>');
  if (r.single && !r.autoSplit) notes.push('<p>شطر واحد. اكتب الشطر الآخر بعد * ليُوزن البيت كاملاً.</p>');
  const guesses = r.hemistichs.flatMap(h => h.words.filter(w => w.generic));
  if (guesses.length) notes.push(`<p class="warn">شكّلتُ تقديراً (تحتها خط منقّط): ${guesses.map(w => '«' + esc(w.display) + '»').join('، ')}. إن كان نطقها غير ذلك فشكّلها وأعد الوزن.</p>`);
  node.querySelector('.notes').innerHTML = notes.join('');

  let html = '';
  if (r.joined) {
    const h = r.hemistichs[0];
    html = renderHemi(h, 'البيت (الصدر ثم العجز)', { half: h.feet.length / 2 });
  } else if (r.single) {
    html = renderHemi(r.hemistichs[0], 'الشطر');
  } else {
    html = renderHemi(r.hemistichs[0], 'الصدر') + renderHemi(r.hemistichs[1], 'العجز');
  }
  node.querySelector('.hemis').innerHTML = html;

  const close = (r.alternatives || []).filter(a => a.cost - r.cost < (r.exact ? 1.2 : 4)).slice(0, 2);
  if (close.length) {
    node.querySelector('.alts').innerHTML = 'يحتمل أيضاً: ' + close.map(a => meterTitle(a)).join('، ');
  }
  if (!r.exact && !r.single && !r.joined && r.input && r.input.parts) {
    const box = document.createElement('div');
    box.className = 'card-actions';
    box.innerHTML = `<button class="ghost small fix">اقترح تصحيحاً</button><span class="status"></span>`;
    node.appendChild(box);
    const out = document.createElement('div');
    node.appendChild(out);
    box.querySelector('.fix').addEventListener('click', () => runFix(r, box, out));
  }
  return node;
}

async function runFix(r, box, out) {
  const btn = box.querySelector('.fix'), st = box.querySelector('.status');
  if (!hasKey()) { st.innerHTML = 'تحتاج مفتاح API. <button class="linkish" data-goto="about">أضفه</button>'; return; }
  btn.disabled = true;
  try {
    const good = await suggestFix(r.input.text, r, analyze, msg => { st.textContent = msg; });
    st.textContent = '';
    if (!good.length) { out.innerHTML = '<p class="sugg why">ما استقامت الاقتراحات على الوزن هذه المرة. جرّب مرة ثانية.</p>'; return; }
    out.innerHTML = good.map(g => `<div class="sugg">
      <div class="poem">${baytHTML(g.sadr, g.ajz)}</div>
      ${g.note ? `<div class="why">${esc(g.note)}</div>` : ''}
      <span class="badge ok">موزون على ${meterTitle(g.result)} ✓</span>
    </div>`).join('');
  } catch (e) {
    st.textContent = e instanceof AIError ? e.message : 'حدث خطأ: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

function baytHTML(sadr, ajz, bad = false) {
  return `<div class="bayt${bad ? ' bad' : ''}"><span class="s1">${esc(sadr)}</span><span class="dot">✽</span><span class="s2">${esc(ajz)}</span></div>`;
}

/* ---------------- الأحداث ---------------- */
async function run() {
  const text = $('#verse').value.trim();
  const out = $('#results');
  if (!text) { out.innerHTML = ''; return; }
  if (!isReady) { $('#status').textContent = 'انتظر حتى يكتمل تحميل القاموس…'; return; }
  const items = parseInput(text);
  $('#go').disabled = true;
  $('#status').textContent = 'يزن…';
  try {
    const results = await analyze(items);
    out.innerHTML = '';
    results.forEach(r => out.appendChild(renderResult(r)));
    $('#status').textContent = '';
    try { localStorage.setItem('wazn.last', text); } catch (e) {}
  } catch (e) {
    out.innerHTML = `<p class="err-box">تعذّر الوزن: ${esc(e.message)}</p>`;
  } finally {
    $('#go').disabled = false;
  }
}

$('#go').addEventListener('click', run);
$('#verse').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
});
let sampleIdx = 0;
$('#sample').addEventListener('click', () => {
  $('#verse').value = SAMPLES[sampleIdx++ % SAMPLES.length];
  run();
});
$('#clear').addEventListener('click', () => { $('#verse').value = ''; $('#results').innerHTML = ''; $('#verse').focus(); });

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) { showTab(g.dataset.goto); if (g.dataset.goto === 'about') $('#s-key').focus(); } });
function showTab(name) {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(x => x.classList.toggle('active', x.id === 'tab-' + name));
  if (name === 'write') $('#write-nokey').hidden = hasKey();
}

/* ---------------- اكتب لي ---------------- */
$('#w-purpose').innerHTML = [...PURPOSES, 'غرض آخر'].map(p => `<option>${p}</option>`).join('');
$('#w-meter').innerHTML += Object.keys(METER_INFO).map(m => `<option value="${m}">${m}</option>`).join('');
$('#w-purpose').addEventListener('change', () => { $('#w-other-wrap').hidden = $('#w-purpose').value !== 'غرض آخر'; });

$('#write-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('#w-status'), out = $('#write-results');
  if (!hasKey()) { $('#write-nokey').hidden = false; return; }
  if (!isReady) { st.textContent = 'انتظر حتى يكتمل تحميل القاموس…'; return; }
  let purpose = $('#w-purpose').value;
  if (purpose === 'غرض آخر') purpose = $('#w-other').value.trim() || 'غرض عام';
  const p = {
    purpose, name: $('#w-name').value.trim(), details: $('#w-details').value.trim(),
    count: +$('#w-count').value, meter: $('#w-meter').value || null, rawi: $('#w-rawi').value.trim() || null,
  };
  if (!p.name && !p.details && purpose !== 'حكمة') { st.textContent = 'اكتب الاسم أو بعض التفاصيل.'; return; }
  $('#w-go').disabled = true;
  out.innerHTML = '';
  try {
    const res = await compose(p, analyze, msg => { st.textContent = msg; });
    st.textContent = '';
    out.appendChild(renderPoem(res, p));
  } catch (err) {
    st.textContent = '';
    out.innerHTML = `<p class="err-box">${esc(err instanceof AIError ? err.message : 'حدث خطأ: ' + err.message)}</p>`;
  } finally {
    $('#w-go').disabled = false;
  }
});

function renderPoem(res, p) {
  const card = document.createElement('article');
  card.className = 'card';
  const okN = res.verses.filter(v => v.ok).length, n = res.verses.length;
  const badge = okN === n ? '<span class="badge ok">موزونة كلها ✓</span>' : `<span class="badge bad">${okN} من ${n} موزونة</span>`;
  const meter = res.meter ? esc(res.meter) : '—';
  card.innerHTML = `<header class="card-head"><div class="meter">${meter}<small>${res.rawi ? 'الروي: ' + esc(res.rawi) : ''}</small></div>${badge}</header>
    <div class="poem">${res.verses.map(v => baytHTML(v.sadr, v.ajz, !v.ok)).join('')}</div>
    <div class="poem-meta">${res.rounds ? `أُصلح بعد ${res.rounds === 1 ? 'محاولة واحدة' : res.rounds === 2 ? 'محاولتين' : res.rounds + ' محاولات'}.` : 'استقامت من أول مرة.'}${okN < n ? ' الأبيات بالأحمر ما استقام وزنها، ويمكنك أن تطلب غيرها.' : ''}</div>
    <div class="card-actions">
      <button class="ghost small copy">نسخ الأبيات</button>
      <button class="ghost small again">اكتب غيرها</button>
    </div>
    <details class="more"><summary>التقطيع والتفعيلات</summary><div class="cuts"></div></details>`;
  const cuts = card.querySelector('.cuts');
  res.verses.forEach(v => { if (v.result && !v.result.error && !v.result.empty) cuts.appendChild(renderResult(v.result)); });
  card.querySelector('.copy').addEventListener('click', async (e) => {
    const text = res.verses.filter(v => v.ok).map(v => `${v.sadr}    ${v.ajz}`).join('\n');
    try { await navigator.clipboard.writeText(text); e.target.textContent = 'نُسخت ✓'; }
    catch (err) { e.target.textContent = 'تعذّر النسخ'; }
  });
  card.querySelector('.again').addEventListener('click', () => $('#write-form').requestSubmit());
  return card;
}

/* ---------------- الإعدادات ---------------- */
function loadSettingsUI() {
  const s = getSettings();
  const opts = MODELS.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  $('#s-compose').innerHTML = opts; $('#s-fix').innerHTML = opts;
  $('#s-compose').value = s.composeModel; $('#s-fix').value = s.fixModel;
  $('#s-key').value = s.key;
}
loadSettingsUI();
$('#s-show').addEventListener('click', () => {
  const k = $('#s-key'); k.type = k.type === 'password' ? 'text' : 'password';
  $('#s-show').textContent = k.type === 'password' ? 'إظهار' : 'إخفاء';
});
$('#s-save').addEventListener('click', () => {
  saveSettings({ key: $('#s-key').value.trim(), composeModel: $('#s-compose').value, fixModel: $('#s-fix').value });
  $('#s-status').textContent = 'حُفظ ✓';
});
$('#s-del').addEventListener('click', () => {
  saveSettings({ key: '' }); $('#s-key').value = ''; $('#s-status').textContent = 'حُذف المفتاح';
});
$('#s-test').addEventListener('click', async () => {
  saveSettings({ key: $('#s-key').value.trim(), composeModel: $('#s-compose').value, fixModel: $('#s-fix').value });
  $('#s-status').textContent = 'يجرّب…';
  try { await testKey(); $('#s-status').textContent = 'المفتاح يعمل ✓'; }
  catch (e) { $('#s-status').textContent = e instanceof AIError ? e.message : e.message; }
});

// صفحة البحور
$('#meters').innerHTML = Object.entries(METER_INFO).map(([m, i]) =>
  `<button class="mcard" data-key="${esc(i.key)}"><h3>${esc(m)}</h3><div class="key">${esc(i.key)}</div><div class="tf">${esc(i.feet)}</div></button>`).join('');
$('#meters').addEventListener('click', (e) => {
  const b = e.target.closest('.mcard');
  if (!b) return;
  $('#verse').value = b.dataset.key;
  showTab('weigh');
  run();
});

$('#ver').textContent = VERSION;
$('#ver-badge').textContent = 'النسخة ' + VERSION;
try { const last = localStorage.getItem('wazn.last'); if (last) $('#verse').value = last; } catch (e) {}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
