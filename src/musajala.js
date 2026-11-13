// وزن — المساجلة: أبيات تبدأ بحرف، وهو في العادة رويّ بيت الصاحب
import { normAr } from './diwans.js';

export const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
const NAMES = { 'ا': 'الهمزة', 'ب': 'الباء', 'ت': 'التاء', 'ث': 'الثاء', 'ج': 'الجيم', 'ح': 'الحاء', 'خ': 'الخاء', 'د': 'الدال', 'ذ': 'الذال', 'ر': 'الراء', 'ز': 'الزاي', 'س': 'السين', 'ش': 'الشين', 'ص': 'الصاد', 'ض': 'الضاد', 'ط': 'الطاء', 'ظ': 'الظاء', 'ع': 'العين', 'غ': 'الغين', 'ف': 'الفاء', 'ق': 'القاف', 'ك': 'الكاف', 'ل': 'اللام', 'م': 'الميم', 'ن': 'النون', 'ه': 'الهاء', 'و': 'الواو', 'ي': 'الياء' };
const AR = (n) => Number(n).toLocaleString('ar-EG');
// الهمزة بصورها والألف حرف واحد، والتاء المربوطة تاء
export const letterOf = (c) => ('أإآاٱءىؤئ'.includes(c) ? 'ا' : c === 'ة' ? 'ت' : c);
const firstLetter = (s) => { const m = String(s).replace(/[ً-ْٰـ]/g, '').match(/[ء-يٱ]/); return m ? letterOf(m[0]) : null; };
// رويّ آخر كلمة في بيت الصاحب: تُحذف ألف الإطلاق أو واوه أو ياؤه، وهاء الوصل، والمقصور رويّه الألف
export function lastLetter(text) {
  const w = String(text).replace(/[*\u060C.!؟?:؛"«»)(]+/g, ' ').trim().split(/\s+/).pop() || '';
  const L = [];
  for (const ch of w) {
    if (/[\u0621-\u064A\u0671]/.test(ch)) L.push({ c: ch, m: '' });
    else if (/[\u064B-\u0652]/.test(ch) && L.length) L[L.length - 1].m += ch;
  }
  if (!L.length) return null;
  const bare = (x) => x && !/[\u064E-\u0652\u064B-\u064D]/.test(x.m);
  if (L[L.length - 1].c === 'ى') return 'ا';
  let i = L.length - 1;
  if (i > 0 && 'اوي'.includes(L[i].c) && bare(L[i])) i--;                 // حرف الإطلاق
  if (i > 1 && L[i].c === 'ه' && !L[i].m.includes('\u0652') && !'اوي'.includes(L[i - 1].c)) {
    i--;                                                                  // هاء الوصل: دارُهُ
  }
  return letterOf(L[i].c);
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function initMusajala({ $, esc, baytHTML, weigh, openPoem, diwans }) {
  const root = $('#sj-root');
  const S = { data: null, letter: null, prefix: '', list: [], shown: 0, used: new Set(), deep: false };
  const vkey = (v) => normAr(v.s + v.a);

  async function load() {
    if (S.data) return;
    const r = await fetch('data/musajala.json');
    S.data = (await r.json()).items;
  }

  function frame() {
    root.innerHTML = `<p class="lead">في المساجلة يبدأ بيتك بالحرف الذي ختم به صاحبك بيته، وهو رويّه. الصق بيته لأستخرج الحرف، أو اختر الحرف بنفسك.</p>
      <form id="sj-form" class="dw-row">
        <input id="sj-verse" class="search" type="search" placeholder="بيت صاحبك (أو آخر كلمة منه)" autocomplete="off">
        <button class="ghost small" type="submit">استخرج الحرف</button>
      </form>
      <p id="sj-said" class="lead" hidden></p>
      <div class="sj-letters">${LETTERS.map(l => `<button class="sj-l" data-l="${l}">${l === 'ا' ? 'أ' : l}</button>`).join('')}</div>
      <input id="sj-prefix" class="search" type="search" placeholder="أو اكتب أول البيت إن كنت تذكره" autocomplete="off">
      <div id="sj-head"></div>
      <div id="sj-out"></div>
      <button id="sj-more" class="ghost" hidden>عرض المزيد</button>
      <div id="sj-deep"></div>`;
  }

  function pick() {
    const p = normAr(S.prefix);
    if (!S.letter && !p) { S.list = []; render(true); return; }
    const pool = S.data.filter(v => (!S.letter || v.f === S.letter) && (!p || normAr(v.s).startsWith(p)) && !S.used.has(vkey(v)));
    // المختارات أولاً، ثم البقية، وكلاهما بترتيب عشوائي
    S.list = [...shuffle(pool.filter(v => v.x)), ...shuffle(pool.filter(v => !v.x))];
    S.deep = false;
    render(true);
  }

  function render(reset) {
    const out = $('#sj-out'), head = $('#sj-head'), more = $('#sj-more');
    document.querySelectorAll('.sj-l').forEach(b => b.classList.toggle('on', b.dataset.l === S.letter));
    if (reset) { S.shown = 0; out.innerHTML = ''; }
    if (!S.letter && !S.prefix) { head.innerHTML = ''; more.hidden = true; return; }
    if (reset || S.deep) {
      head.innerHTML = `<div class="dw-bar sj-bar"><span class="lead">${S.letter ? `حرف ${NAMES[S.letter]}` : 'ما يبدأ بما كتبت'}: ${AR(S.list.length)} بيت${S.used.size ? ` · استعملتَ ${AR(S.used.size)}` : ''}</span>
        <span><button class="ghost small" data-act="shuffle">غيرها</button>${S.used.size ? ' <button class="ghost small" data-act="reset">جولة جديدة</button>' : ''}</span></div>`;
    }
    const empty = out.querySelector('.sj-empty'); if (empty && S.list.length) empty.remove();
    const next = S.list.slice(S.shown, S.shown + 12);
    S.shown += next.length;
    out.insertAdjacentHTML('beforeend', next.map(card).join(''));
    if (!S.list.length) out.innerHTML = '<p class="lead sj-empty">لا أبيات هنا. جرّب البحث في كل أبيات الدواوين أدناه.</p>';
    more.hidden = S.shown >= S.list.length;
    if (!S.deep) $('#sj-deep').innerHTML = `<button class="ghost" data-act="deep">ابحث في كل أبيات الدواوين، لا المطالع وحدها</button>`;
  }

  function card(v) {
    const id = S.list.indexOf(v);
    if (v.l == null) v.l = lastLetter(v.a) || '';
    return `<article class="verse-card" data-n="${id}">
      <div class="poem">${baytHTML(v.s, v.a)}</div>
      <div class="verse-meta"><b>${esc(v.p || '')}</b>${v.m ? `<span>${esc(v.m)}</span>` : ''}${v.x ? '<span>من المختارات</span>' : ''}
        ${v.l ? '' : '<!--'}<button class="sj-end" data-l="${v.l}" title="الحرف الذي سيبدأ به صاحبك">يختم بـ${v.l === 'ا' ? 'الهمزة' : '«' + v.l + '»'}</button>${v.l ? '' : '-->'}</div>
      <div class="verse-actions">
        <button class="ghost small cp">نسخ</button>
        <button class="ghost small wz">زِنه</button>
        ${v.d ? '<button class="ghost small op">القصيدة</button>' : ''}
        <button class="ghost small use">استعملته</button>
      </div>
    </article>`;
  }

  async function deep() {
    const box = $('#sj-deep');
    const p = normAr(S.prefix);
    box.innerHTML = '<p class="lead" id="sj-prog">يبحث في الدواوين… أول مرة يحمّلها كلها (نحو ٣٧ م.ب)، ثم تبقى على جهازك.</p>';
    const ix = await diwans.loadIndex();
    const found = [];
    for (const m of ix) {
      let d; try { d = await diwans.loadDiwan(m.id); } catch (e) { continue; }
      d.poems.forEach((po, i) => po.v.forEach((v, k) => {
        if (!v[0] || !v[1]) return;
        if (S.letter && firstLetter(v[0]) !== S.letter) return;
        if (p && !po.n[k].startsWith(p)) return;
        found.push({ s: v[0], a: v[1], p: d.kind === 'anthology' ? po.poet : d.poet, m: po.m || '', d: m.id, i, k });
      }));
      const pr = $('#sj-prog'); if (pr) pr.textContent = `يبحث… ${m.name}`;
    }
    const seen = new Set(S.list.map(vkey));
    const extra = shuffle(found.filter(v => !seen.has(vkey(v)) && !S.used.has(vkey(v))));
    S.list = S.list.concat(extra);
    S.deep = true;
    render(false);
    $('#sj-deep').innerHTML = `<p class="lead">أُضيف ${AR(extra.length)} بيت من حشو القصائد.</p>`;
  }

  function markUsed(v, cardEl) {
    S.used.add(vkey(v));
    cardEl.classList.add('used');
    const b = cardEl.querySelector('.use'); if (b) b.textContent = 'استُعمل ✓';
  }

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'sj-form') return;
    e.preventDefault();
    const t = $('#sj-verse').value.trim();
    const said = $('#sj-said');
    const l = t && lastLetter(t);
    if (!l) { said.hidden = false; said.textContent = 'لم أتبيّن آخر حرف. اكتب البيت أو آخر كلمة منه.'; return; }
    said.hidden = false;
    said.innerHTML = `رويّ بيته ${l === 'ا' ? 'الهمزة أو الألف' : `«${esc(l)}»`}، فابدأ ب${NAMES[l]}.`;
    S.letter = l; pick();
  });
  let t;
  root.addEventListener('input', (e) => {
    if (e.target.id !== 'sj-prefix') return;
    clearTimeout(t);
    t = setTimeout(() => { S.prefix = e.target.value.trim(); const f = firstLetter(S.prefix); if (f) S.letter = f; pick(); }, 250);
  });
  root.addEventListener('click', async (e) => {
    const x = e.target;
    const l = x.closest('.sj-l, .sj-end');
    if (l) {
      S.letter = S.letter === l.dataset.l && l.classList.contains('sj-l') ? null : l.dataset.l;
      $('#sj-said').hidden = true;
      pick();
      if (l.classList.contains('sj-end')) $('#sj-head').scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    const act = x.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'shuffle') pick();
      else if (a === 'reset') { S.used.clear(); pick(); }
      else if (a === 'deep') deep();
      return;
    }
    if (x.closest('#sj-more')) { render(false); return; }
    const c = x.closest('.verse-card');
    if (!c) return;
    const v = S.list[+c.dataset.n];
    if (!v) return;
    if (x.classList.contains('cp')) {
      try { await navigator.clipboard.writeText(v.s + '    ' + v.a + (v.p ? '\n— ' + v.p : '')); x.textContent = 'نُسخ ✓'; } catch (err) {}
      markUsed(v, c);
    } else if (x.classList.contains('use')) markUsed(v, c);
    else if (x.classList.contains('wz')) weigh(v.s + ' * ' + v.a);
    else if (x.classList.contains('op')) openPoem(v.d, v.i, v.k || 0);
  });

  return {
    async show() {
      if (S.data) return;
      root.innerHTML = '<p class="lead">يحمّل…</p>';
      try { await load(); frame(); }
      catch (e) { root.innerHTML = '<p class="err-box">تعذّر التحميل. تحقق من الاتصال.</p>'; S.data = null; }
    },
  };
}
