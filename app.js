// وزن — الواجهة
import { METER_INFO } from './src/meters.js';
import { splitVerse } from './src/engine.js';
import { getSettings, saveSettings, hasKey, testKey, compose, suggestFix, MODELS, PURPOSES, AIError, AUTO_FIX_LIMIT } from './src/ai.js';
import { checkRhymes } from './src/engine.js';
import { verseProblems, sym } from './src/explain.js';
import { initDiwans } from './src/diwans.js';
import { initMusajala } from './src/musajala.js';

const VERSION = '1.5.0';
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
    const exp = bad && f.vp ? `<div class="exp">المطلوب: ${sym(f.vp)}</div>` : '';
    const sep = half && k === half ? '<div class="half-sep"></div>' : '';
    return `${sep}<div class="foot${bad ? ' bad' : ''}">
      <div class="ar">${esc(f.text) || '—'}</div>
      <div class="sym">${symbols(f.got)}</div>${exp}
      <div class="name">${esc(f.name || '؟')}</div>
      ${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="hemi">
    <div class="hemi-label">${label}</div>
    <div class="words">${words}</div>
    <div class="feet" style="--n:${half || h.feet.length}">${feet}</div>
  </div>`;
}

// المكان والوجه: من قواعد المحرك
function problemsHTML(r) {
  const items = [];
  for (const p of verseProblems(r)) {
    items.push(`<li><b>${esc(p.hemi)}، ${esc(p.where)}:</b> ${esc(p.what)}. <span class="can">${esc(p.can)}.</span></li>`);
  }
  for (const iss of r.rhymeIssues || []) {
    items.push(`<li><b>القافية — ${esc(iss.kind)}:</b> ${esc(iss.msg)}.</li>`);
  }
  return items.length ? `<div class="probs"><div class="probs-h">موضع الخطأ ووجهه</div><ul class="errs">${items.join('')}</ul></div>` : '';
}

function needsFix(r) {
  return r && !r.error && !r.empty && !r.single && !r.joined && r.input && r.input.parts &&
    (!r.exact || (r.rhymeIssues && r.rhymeIssues.length));
}

function renderResult(r, opts = {}) {
  const node = $('#tpl-result').content.firstElementChild.cloneNode(true);
  if (r.error || r.empty) {
    node.querySelector('.meter').textContent = '—';
    node.querySelector('.notes').innerHTML = `<p class="err-box">${r.error ? 'حدث خطأ: ' + esc(r.error) : 'لم أجد كلمات عربية في هذا السطر.'}</p>`;
    return node;
  }
  node.querySelector('.meter').innerHTML = meterTitle(r);
  const badge = node.querySelector('.badge');
  const nBad = r.hemistichs.reduce((s, h) => s + h.feet.filter(f => !f.ok).length, 0);
  const nRh = (r.rhymeIssues || []).length;
  if (r.exact && !nRh) { badge.textContent = 'موزون ✓'; badge.classList.add('ok'); }
  else if (r.exact) { badge.textContent = 'موزون، وفي القافية عيب'; badge.classList.add('bad'); }
  else {
    badge.textContent = nBad === 1 ? 'مكسور في تفعيلة' : nBad === 2 ? 'مكسور في تفعيلتين' : `مكسور في ${nBad} تفعيلات`;
    badge.classList.add('bad');
  }

  const notes = [];
  if (opts.label) notes.push(`<p>${esc(opts.label)}</p>`);
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
  node.querySelector('.hemis').innerHTML = html + problemsHTML(r);

  const close = (r.alternatives || []).filter(a => a.cost - r.cost < (r.exact ? 1.2 : 4)).slice(0, 2);
  if (close.length) {
    node.querySelector('.alts').innerHTML = 'يحتمل أيضاً: ' + close.map(a => meterTitle(a)).join('، ');
  }
  if (needsFix(r) && !opts.noFix) attachFix(node, r, opts.fix || {});
  return node;
}

// التعديل المقترح: زر، ويُشغَّل تلقائياً لأول ثلاثة أبيات
function attachFix(node, r, fx) {
  const box = document.createElement('div');
  box.className = 'card-actions';
  box.innerHTML = `<button class="ghost small fix">اقترح تعديلاً</button><span class="status"></span>`;
  const out = document.createElement('div');
  node.appendChild(box);
  node.appendChild(out);
  const go = () => runFix(r, box, out, fx);
  box.querySelector('.fix').addEventListener('click', go);
  node._autoFix = go;
}

async function runFix(r, box, out, fx = {}) {
  const btn = box.querySelector('.fix'), st = box.querySelector('.status');
  if (!hasKey()) { st.innerHTML = 'التعديل المقترح يحتاج مفتاح API. <button class="linkish" data-goto="about">أضفه</button>'; return; }
  btn.disabled = true;
  try {
    const good = await suggestFix(r, analyze, msg => { st.textContent = msg; }, { rhymeIssues: r.rhymeIssues, rawi: fx.rawi, haraka: fx.haraka });
    st.textContent = '';
    if (!good.length) { out.innerHTML = '<p class="sugg why">ما سلمت الاقتراحات عند الفحص هذه المرة. اضغط «اقترح تعديلاً» لمحاولة أخرى.</p>'; return; }
    btn.textContent = 'اقتراحات أخرى';
    out.innerHTML = `<div class="sugg"><div class="probs-h">التعديل المقترح</div>` + good.map(g => `
      <div class="poem">${baytHTML(g.sadr, g.ajz)}</div>
      ${g.note ? `<div class="why">${esc(g.note)}</div>` : ''}
      <span class="badge ok">سليم الوزن على ${meterTitle(g.result)}${fx.rawi ? ' والقافية' : ''} ✓</span>`).join('<hr class="soft">') + '</div>';
  } catch (e) {
    st.textContent = e instanceof AIError ? e.message : 'حدث خطأ: ' + e.message;
    out.innerHTML = `<details class="more"><summary>تفاصيل الخطأ</summary><pre class="raw">${esc(`النسخة: ${VERSION}\n${e.diag || ''}${e.raw ? '\nنص الرد:\n' + e.raw : ''}`)}</pre></details>`;
  } finally {
    btn.disabled = false;
  }
}

async function runAutoFixes(nodes) {
  if (!hasKey() || !getSettings().autoFix) return;
  for (const n of nodes.filter(n => n._autoFix).slice(0, AUTO_FIX_LIMIT)) await n._autoFix();
}

function baytHTML(sadr, ajz, bad = false) {
  return `<div class="bayt${bad ? ' bad' : ''}"><span class="s1">${esc(sadr)}</span><span class="dot">✽</span><span class="s2">${esc(ajz)}</span></div>`;
}

// فحص القافية بين الأبيات
function rhymeSummary(results) {
  const full = results.filter(r => r && !r.error && !r.empty && !r.single && !r.joined && r.rhymeInfo);
  if (full.length < 2) return null;
  const chk = checkRhymes(results.map(r => (r && r.rhymeInfo && !r.single && !r.joined) ? r.rhymeInfo : null));
  results.forEach((r, i) => { if (r) r.rhymeIssues = chk.issues[i]; });
  const n = chk.issues.reduce((s, x) => s + x.length, 0);
  const ridf = (() => { const m = full.map(r => r.rhymeInfo.ridf); const a = m.filter(x => x === 'ا').length, w = m.filter(x => x === 'وي').length; return a > full.length / 2 ? 'مردوفة بالألف' : w > full.length / 2 ? 'مردوفة بالواو والياء' : ''; })();
  const div = document.createElement('div');
  div.className = 'card rhyme-card';
  div.innerHTML = `<div class="card-head"><div class="meter">القافية<small>الروي «${esc(chk.rawi || '؟')}»${chk.haraka ? '، ' + esc(chk.haraka) : ''}${ridf ? '، ' + ridf : ''}</small></div>
    <span class="badge ${n ? 'bad' : 'ok'}">${n ? (n === 1 ? 'عيب واحد' : n + ' عيوب') : 'سليمة ✓'}</span></div>`;
  return { node: div, rawi: chk.rawi, haraka: chk.haraka && chk.haraka !== 'السكون' ? chk.haraka : null };
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
    const rs = rhymeSummary(results);
    if (rs) out.appendChild(rs.node);
    const nodes = results.map((r, i) => renderResult(r, { label: results.length > 1 ? `البيت ${i + 1}` : '', fix: rs ? { rawi: rs.rawi, haraka: rs.haraka } : {} }));
    nodes.forEach(n => out.appendChild(n));
    $('#status').textContent = '';
    runAutoFixes(nodes);
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
  if (name === 'anth') loadAnth();
  if (name === 'diwan') DIWANS.show();
  if (name === 'saj') MUSAJALA.show();
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
    out.innerHTML = `<p class="err-box">${esc(err instanceof AIError ? err.message : 'حدث خطأ: ' + err.message)}</p>` +
      `<details class="more"><summary>تفاصيل الخطأ</summary><pre class="raw">${esc(`النسخة: ${VERSION}\n${err.diag || ''}${err.raw ? '\nنص الرد:\n' + err.raw : ''}`)}</pre></details>`;
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
    <div class="broken-list"></div>
    <details class="more"><summary>التقطيع والتفعيلات</summary><div class="cuts"></div></details>`;
  const cuts = card.querySelector('.cuts');
  const fixNodes = [];
  res.verses.forEach((v, i) => {
    if (!v.result || v.result.error || v.result.empty) return;
    v.result.rhymeIssues = v.rhymeIssues || [];
    const node = renderResult(v.result, { label: `البيت ${i + 1}`, fix: { rawi: res.rawi, haraka: res.haraka } });
    if (!v.ok) { card.querySelector('.broken-list').appendChild(node); fixNodes.push(node); }
    else cuts.appendChild(node);
  });
  if (fixNodes.length) runAutoFixes(fixNodes);
  card.querySelector('.copy').addEventListener('click', async (e) => {
    const text = res.verses.filter(v => v.ok).map(v => `${v.sadr}    ${v.ajz}`).join('\n');
    try { await navigator.clipboard.writeText(text); e.target.textContent = 'نُسخت ✓'; }
    catch (err) { e.target.textContent = 'تعذّر النسخ'; }
  });
  card.querySelector('.again').addEventListener('click', () => $('#write-form').requestSubmit());
  return card;
}

/* ---------------- المختارات ---------------- */
const ANTH = { items: [], group: 'الحكمة', q: '', shown: 0 };
const INTRO = {
  'عيون المتنبي': 'ما اختاره الصاحب بن عباد (ت ٣٨٥هـ) من أمثال المتنبي السائرة في كتابه «الأمثال السائرة من شعر المتنبي»، مرتبة من الأشهر في كتب التراث.',
  'الحكمة': 'عيون الحكمة عند الفحول، ومعها أشهر أمثال المتنبي.',
  'المدح': 'من أجود ما قيل في المدح.',
  'الرثاء': 'من أجود ما قيل في الرثاء.',
  'الهجاء': 'من عيون الهجاء عند الفحول: نقائض جرير والفرزدق والأخطل، والحطيئة وحسان وابن الرومي والمتنبي. تُرك منه ما فيه فحش، أو طعن في عِرض، أو عصبية لِلَّون.',
};
async function loadAnth() {
  if (ANTH.items.length) return;
  try {
    const r = await fetch('data/mukhtarat.json');
    const d = await r.json();
    ANTH.items = d.items;
    const groups = d.meta.groups;
    $('#anth-groups').innerHTML = groups.map(g => `<button class="chip${g === ANTH.group ? ' active' : ''}" data-g="${esc(g)}">${esc(g)}<small>${d.items.filter(i => i.g.includes(g)).length}</small></button>`).join('');
    renderAnth(true);
  } catch (e) {
    $('#anth-list').innerHTML = '<p class="err-box">تعذّر تحميل المختارات.</p>';
  }
}
function anthFiltered() {
  const q = ANTH.q.replace(/[\u064B-\u0652\u0640]/g, '');
  return ANTH.items.filter(i => i.g.includes(ANTH.group) && (!q ||
    (i.sadr + ' ' + i.ajz + ' ' + i.poet).replace(/[\u064B-\u0652\u0640]/g, '').includes(q)));
}
function renderAnth(reset) {
  const list = anthFiltered();
  if (reset) { ANTH.shown = 0; $('#anth-list').innerHTML = ''; }
  $('#anth-intro').textContent = INTRO[ANTH.group] || '';
  const next = list.slice(ANTH.shown, ANTH.shown + 40);
  ANTH.shown += next.length;
  const frag = document.createElement('div');
  frag.innerHTML = next.map((v, k) => `<article class="verse-card" data-i="${ANTH.items.indexOf(v)}">
      <div class="poem">${baytHTML(v.sadr, v.ajz)}</div>
      <div class="verse-meta"><b>${esc(v.poet)}</b><span>${esc(v.meter || '')}</span>${v.src ? `<a href="${esc(v.src.url)}" target="_blank" rel="noopener">المصدر</a>` : ''}</div>
      <div class="verse-actions">
        ${v.sharh ? '<button class="ghost small sh">الشرح</button>' : ''}
        <button class="ghost small wz">زِنه</button>
        <button class="ghost small cp">نسخ</button>
      </div>
    </article>`).join('');
  while (frag.firstChild) $('#anth-list').appendChild(frag.firstChild);
  if (!list.length) $('#anth-list').innerHTML = '<p class="lead">لا نتائج.</p>';
  $('#anth-more').hidden = ANTH.shown >= list.length;
}
$('#anth-groups').addEventListener('click', (e) => {
  const c = e.target.closest('.chip'); if (!c) return;
  ANTH.group = c.dataset.g;
  document.querySelectorAll('#anth-groups .chip').forEach(x => x.classList.toggle('active', x === c));
  renderAnth(true);
});
$('#anth-q').addEventListener('input', (e) => { ANTH.q = e.target.value.trim(); renderAnth(true); });
$('#anth-more').addEventListener('click', () => renderAnth(false));
$('#anth-list').addEventListener('click', async (e) => {
  const card = e.target.closest('.verse-card'); if (!card) return;
  const v = ANTH.items[+card.dataset.i];
  if (e.target.classList.contains('sh')) {
    let box = card.querySelector('.sharh-box');
    if (box) { box.remove(); return; }
    box = document.createElement('div'); box.className = 'sharh-box';
    box.innerHTML = `${esc(v.sharh.text)}<div class="from">من ${v.sharh.url ? `<a href="${esc(v.sharh.url)}" target="_blank" rel="noopener">${esc(v.sharh.book)}</a>` : esc(v.sharh.book)}</div>`;
    card.appendChild(box);
  } else if (e.target.classList.contains('wz')) {
    $('#verse').value = v.sadr + ' * ' + v.ajz; showTab('weigh'); run();
  } else if (e.target.classList.contains('cp')) {
    try { await navigator.clipboard.writeText(v.sadr + '    ' + v.ajz + '\n— ' + v.poet); e.target.textContent = 'نُسخ ✓'; } catch (err) {}
  }
});

/* ---------------- الدواوين ---------------- */
const weighLine = (line) => { $('#verse').value = line; showTab('weigh'); window.scrollTo(0, 0); run(); };
const DIWANS = initDiwans({ $, esc, baytHTML, weigh: weighLine });
const MUSAJALA = initMusajala({ $, esc, baytHTML, weigh: weighLine, diwans: DIWANS,
  openPoem: async (id, i, k) => { await DIWANS.openAt(id, i, k); showTab('diwan'); } });

/* ---------------- الإعدادات ---------------- */
function loadSettingsUI() {
  const s = getSettings();
  const opts = MODELS.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  $('#s-compose').innerHTML = opts; $('#s-fix').innerHTML = opts;
  $('#s-compose').value = s.composeModel; $('#s-fix').value = s.fixModel;
  $('#s-key').value = s.key;
  $('#s-auto').checked = s.autoFix !== false;
}
loadSettingsUI();
$('#s-show').addEventListener('click', () => {
  const k = $('#s-key'); k.type = k.type === 'password' ? 'text' : 'password';
  $('#s-show').textContent = k.type === 'password' ? 'إظهار' : 'إخفاء';
});
$('#s-save').addEventListener('click', () => {
  saveSettings({ key: $('#s-key').value.trim(), composeModel: $('#s-compose').value, fixModel: $('#s-fix').value, autoFix: $('#s-auto').checked });
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
  // إذا نزل تحديث وتسلّم العاملُ الجديد الصفحةَ: نعيد التحميل مرة واحدة لتظهر النسخة الجديدة
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
  });
}
