// وزن — تبويب الدواوين: قائمة الدواوين، وتصفح القصائد، والبحث، والاقتراح
const ERA_ORDER = ['العصر الجاهلي', 'المخضرمون', 'العصر الأموي', 'العصر العباسي', 'العصر الأندلسي', 'العصر المملوكي'];
const AR = (n) => Number(n).toLocaleString('ar-EG');
// تطبيع للبحث: بلا حركات ولا تطويل، وتوحيد الهمزات والياء والتاء المربوطة
export const normAr = (s) => String(s).replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function initDiwans({ $, esc, baytHTML, weigh }) {
  const root = $('#dw-root');
  const S = { index: null, cache: new Map(), view: 'home', id: null, poem: null, q: '', meter: '', sec: '', shown: 0, results: [], allQ: '' };

  async function loadIndex() {
    if (S.index) return S.index;
    const r = await fetch('data/diwans/index.json');
    S.index = await r.json();
    return S.index;
  }
  async function loadDiwan(id) {
    if (S.cache.has(id)) return S.cache.get(id);
    const r = await fetch(`data/diwans/${id}.json`);
    if (!r.ok) throw new Error('تعذّر تحميل الديوان');
    const d = await r.json();
    d.poems.forEach((p, i) => { p.i = i; p.n = p.v.map(v => normAr(v[0] + ' ' + v[1])); });
    S.cache.set(id, d);
    return d;
  }
  const meta = (id) => S.index.find(x => x.id === id);
  const pageUrl = (d, pg) => (d.sharhBook && pg ? d.sharhBook.url + pg : null);

  /* ---------- الصفحة الأولى: قائمة الدواوين ---------- */
  function renderHome() {
    S.view = 'home';
    const ix = S.index;
    const total = ix.reduce((s, d) => s + d.verses, 0);
    const byEra = {};
    ix.forEach(d => (byEra[d.era] = byEra[d.era] || []).push(d));
    const eras = Object.keys(byEra).sort((a, b) => ERA_ORDER.indexOf(a) - ERA_ORDER.indexOf(b));
    root.innerHTML = `<p class="lead">${AR(ix.length)} ديواناً ومجموعة، فيها ${AR(total)} بيت. يُحمَّل الديوان حين تفتحه أول مرة، ثم يبقى على جهازك ويعمل بلا إنترنت.</p>
      <form id="dw-allform" class="dw-row"><input id="dw-qall" class="search" type="search" placeholder="ابحث في كل الدواوين" value="${esc(S.allQ)}"><button class="ghost small" type="submit">ابحث</button></form>
      ${eras.map(e => `<h3 class="dw-era">${esc(e)}</h3><div class="dw-grid">${byEra[e].map(d => `
        <button class="dw-item" data-id="${esc(d.id)}">
          <b>${esc(d.name)}</b>
          <span>${d.kind === 'anthology' ? esc(d.poet) + ' · ' : ''}${AR(d.poems)} قصيدة · ${AR(d.verses)} بيت</span>
          ${d.note ? '<small class="dw-weak">الضبط ناقص</small>' : ''}
        </button>`).join('')}</div>`).join('')}`;
  }

  /* ---------- الديوان ---------- */
  function filtered(d) {
    const q = normAr(S.q);
    const poems = d.poems.filter(p => (!S.meter || p.m === S.meter) && (!S.sec || p.sec === S.sec || p.th === S.sec));
    if (!q) return { poems, verses: null };
    const verses = [];
    for (const p of poems) {
      if (normAr(p.t).includes(q) && !p.n.some(x => x.includes(q))) verses.push({ p, k: 0 });
      p.n.forEach((x, k) => { if (x.includes(q)) verses.push({ p, k }); });
    }
    return { poems, verses };
  }
  async function openDiwan(id) {
    S.view = 'diwan'; S.id = id; S.q = ''; S.meter = ''; S.sec = '';
    root.innerHTML = '<p class="lead">يحمّل الديوان…</p>';
    let d;
    try { d = await loadDiwan(id); } catch (e) { root.innerHTML = `<p class="err-box">${esc(e.message)}. تحقق من الاتصال ثم أعد المحاولة.</p><button class="ghost small" data-act="home">الدواوين</button>`; return; }
    renderDiwan(d);
  }
  function renderDiwan(d) {
    const m = meta(d.id);
    const meters = [...new Set(d.poems.map(p => p.m).filter(Boolean))].sort();
    const secs = d.sections || [...new Set(d.poems.map(p => p.th).filter(Boolean))];
    root.innerHTML = `<div class="dw-bar"><button class="ghost small" data-act="home">→ الدواوين</button></div>
      <h2 class="dw-title">${esc(d.name)}</h2>
      <p class="lead">${d.kind === 'anthology' ? esc(d.poet) + '. ' : ''}${AR(m.poems)} قصيدة، ${AR(m.verses)} بيت. المصدر: <a href="${esc(d.src.url.replace(/\?page=$/, ''))}" target="_blank" rel="noopener">${esc(d.src.name)}</a>${d.sharhBook && d.sharhBook.name !== d.src.name ? `، والشرح من ${esc(d.sharhBook.name)}` : ''}.${d.note ? ` <span class="dw-weak">${esc(d.note)}</span>` : ''}</p>
      <input id="dw-q" class="search" type="search" placeholder="ابحث في هذا الديوان" value="${esc(S.q)}">
      <div class="dw-row">
        ${meters.length > 1 ? `<select id="dw-meter"><option value="">كل البحور</option>${meters.map(x => `<option${x === S.meter ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
        ${secs.length ? `<select id="dw-sec"><option value="">${d.sections ? 'كل الأبواب' : 'كل الأغراض'}</option>${secs.map(x => `<option${x === S.sec ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
        <button class="ghost small" data-act="suggest">اقترح لي</button>
      </div>
      <div id="dw-out"></div>
      <button id="dw-more" class="ghost" hidden>عرض المزيد</button>`;
    renderList(d, true);
  }
  function renderList(d, reset) {
    const out = $('#dw-out'), more = $('#dw-more');
    const { poems, verses } = filtered(d);
    if (reset) { S.shown = 0; out.innerHTML = ''; S.results = verses || poems; }
    const list = S.results;
    const next = list.slice(S.shown, S.shown + 40);
    S.shown += next.length;
    if (reset) {
      const head = document.createElement('p'); head.className = 'lead';
      head.textContent = verses ? `${AR(verses.length)} بيت` : `${AR(poems.length)} قصيدة`;
      out.appendChild(head);
    }
    const frag = document.createElement('div');
    frag.innerHTML = verses ? next.map(({ p, k }) => verseCard(d, p, k, true)).join('') : next.map(p => `
      <button class="dw-poem" data-p="${p.i}">
        <span class="dw-pt">${esc(d.kind === 'anthology' ? p.poet : p.t)}</span>
        <span class="dw-pf">${esc(p.v[0][0])}</span>
        <small>${[d.sections ? p.sec : '', p.m, AR(p.v.length) + ' بيت'].filter(Boolean).map(esc).join(' · ')}</small>
      </button>`).join('');
    while (frag.firstChild) out.appendChild(frag.firstChild);
    if (!list.length) out.insertAdjacentHTML('beforeend', '<p class="lead">لا نتائج.</p>');
    more.hidden = S.shown >= list.length;
  }
  function verseCard(d, p, k, withPoem, extra = '') {
    const v = p.v[k];
    const poet = d.kind === 'anthology' ? p.poet : d.poet;
    const link = pageUrl(d, v[3] || p.pg);
    return `<article class="verse-card" data-id="${esc(d.id)}" data-p="${p.i}" data-k="${k}">
      <div class="poem">${baytHTML(v[0], v[1])}</div>
      <div class="verse-meta">${extra ? extra : `<b>${esc(String(poet || '').slice(0, 60))}</b>`}${withPoem ? `<span>${esc((d.kind === 'anthology' ? p.sec : p.t).slice(0, 50))}</span>` : ''}${extra ? '' : `<span>${esc(p.m || '')}</span>`}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">المصدر</a>` : ''}</div>
      <div class="verse-actions">
        ${v[2] ? '<button class="ghost small sh">الشرح</button>' : ''}
        <button class="ghost small wz">زِنه</button>
        <button class="ghost small cp">نسخ</button>
        ${withPoem ? '<button class="ghost small op">القصيدة</button>' : ''}
      </div>
    </article>`;
  }

  /* ---------- القصيدة ---------- */
  function openPoem(d, i, focus = -1) {
    S.view = 'poem'; S.poem = i;
    const p = d.poems[i];
    root.innerHTML = `<div class="dw-bar"><button class="ghost small" data-act="back">→ ${esc(d.name)}</button>
        <button class="ghost small" data-act="copypoem">نسخ القصيدة</button></div>
      <h2 class="dw-title">${esc(d.kind === 'anthology' ? p.poet : p.t)}</h2>
      <p class="lead">${[d.kind === 'anthology' ? p.sec : d.poet, p.m, AR(p.v.length) + ' بيت'].filter(Boolean).map(esc).join(' · ')}</p>
      <div class="dw-verses">${p.v.map((v, k) => verseCard(d, p, k, false, `<span class="dw-n">${AR(k + 1)}</span>`)).join('')}</div>`;
    window.scrollTo(0, 0);
    if (focus >= 0) {
      const el = root.querySelectorAll('.verse-card')[focus];
      if (el) { el.classList.add('hl'); el.scrollIntoView({ block: 'center' }); }
    }
  }

  /* ---------- اقترح لي ---------- */
  function suggest(d) {
    const { poems, verses } = filtered(d);
    const pool = verses || poems.flatMap(p => p.v.map((_, k) => ({ p, k })));
    const out = $('#dw-out'); out.innerHTML = '';
    if (!pool.length) { out.innerHTML = '<p class="lead">لا أبيات في هذا الاختيار.</p>'; return; }
    const pick = new Set();
    while (pick.size < Math.min(5, pool.length)) pick.add(Math.floor(Math.random() * pool.length));
    out.innerHTML = `<p class="lead">خمسة أبيات اختيرت عشوائياً${S.meter || S.sec ? ' مما اخترت' : ''}. اضغط «اقترح لي» لغيرها.</p>` +
      [...pick].map(j => verseCard(d, pool[j].p, pool[j].k, true)).join('');
    $('#dw-more').hidden = true;
  }

  /* ---------- البحث في كل الدواوين ---------- */
  async function searchAll(q) {
    S.view = 'all'; S.allQ = q;
    const nq = normAr(q);
    if (nq.length < 3) { renderHome(); return; }
    root.innerHTML = `<div class="dw-bar"><button class="ghost small" data-act="home">→ الدواوين</button></div>
      <p class="lead" id="dw-prog">يبحث… أول بحث يحمّل الدواوين كلها (نحو ٣٧ م.ب)، ثم تبقى على جهازك.</p><div id="dw-out"></div>`;
    const out = $('#dw-out'), prog = $('#dw-prog');
    let n = 0; const CAP = 300;
    for (const m of S.index) {
      if (S.view !== 'all' || S.allQ !== q) return;
      let d; try { d = await loadDiwan(m.id); } catch (e) { continue; }
      const hits = [];
      for (const p of d.poems) p.n.forEach((x, k) => { if (x.includes(nq) && n + hits.length < CAP) hits.push({ p, k }); });
      if (hits.length) {
        out.insertAdjacentHTML('beforeend', `<h3 class="dw-era">${esc(d.name)} <small>${AR(hits.length)}</small></h3>` + hits.slice(0, 30).map(h => verseCard(d, h.p, h.k, true)).join('') +
          (hits.length > 30 ? `<button class="ghost small" data-act="indiwan" data-id="${esc(d.id)}">كل نتائج ${esc(d.name)}</button>` : ''));
        n += hits.length;
      }
      prog.textContent = `يبحث… ${esc(m.name)}`;
      if (n >= CAP) break;
    }
    prog.textContent = n ? `${AR(n)} بيت${n >= CAP ? ' (أول ٣٠٠ نتيجة؛ ضيّق البحث)' : ''}` : 'لا نتائج.';
  }

  /* ---------- الأحداث ---------- */
  root.addEventListener('submit', (e) => {
    if (e.target.id === 'dw-allform') { e.preventDefault(); searchAll($('#dw-qall').value.trim()); }
  });
  let qTimer;
  root.addEventListener('input', (e) => {
    if (e.target.id !== 'dw-q') return;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { S.q = e.target.value.trim(); renderList(S.cache.get(S.id), true); }, 250);
  });
  root.addEventListener('change', (e) => {
    const d = S.cache.get(S.id);
    if (e.target.id === 'dw-meter') { S.meter = e.target.value; renderList(d, true); }
    if (e.target.id === 'dw-sec') { S.sec = e.target.value; renderList(d, true); }
  });
  root.addEventListener('click', async (e) => {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'home') { renderHome(); window.scrollTo(0, 0); }
      else if (a === 'back') { const d = S.cache.get(S.id); S.view = 'diwan'; const keep = { q: S.q, meter: S.meter, sec: S.sec }; renderDiwan(d); Object.assign(S, keep); restoreFilters(d); }
      else if (a === 'suggest') suggest(S.cache.get(S.id));
      else if (a === 'indiwan') { const q = S.allQ; await openDiwan(act.dataset.id); S.q = q; $('#dw-q').value = q; renderList(S.cache.get(S.id), true); }
      else if (a === 'copypoem') {
        const d = S.cache.get(S.id), p = d.poems[S.poem];
        try { await navigator.clipboard.writeText(p.t + '\n\n' + p.v.map(v => v[0] + '    ' + v[1]).join('\n') + '\n— ' + (d.kind === 'anthology' ? p.poet : d.poet)); act.textContent = 'نُسخت ✓'; } catch (err) {}
      }
      return;
    }
    const item = t.closest('.dw-item');
    if (item) { openDiwan(item.dataset.id); window.scrollTo(0, 0); return; }
    if (t.closest('#dw-more')) { renderList(S.cache.get(S.id), false); return; }
    const pb = t.closest('.dw-poem');
    if (pb) { openPoem(S.cache.get(S.id), +pb.dataset.p); return; }
    const card = t.closest('.verse-card');
    if (!card) return;
    const d = S.cache.get(card.dataset.id), p = d.poems[+card.dataset.p], k = +card.dataset.k, v = p.v[k];
    if (t.classList.contains('sh')) {
      let box = card.querySelector('.sharh-box');
      if (box) { box.remove(); return; }
      box = document.createElement('div'); box.className = 'sharh-box';
      const link = pageUrl(d, v[3] || p.pg);
      box.innerHTML = `${esc(v[2])}<div class="from">من ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(d.sharhBook.name)}</a>` : esc(d.sharhBook ? d.sharhBook.name : '')}</div>`;
      card.appendChild(box);
    } else if (t.classList.contains('wz')) {
      weigh(v[0] + ' * ' + v[1]);
    } else if (t.classList.contains('cp')) {
      try { await navigator.clipboard.writeText(v[0] + '    ' + v[1] + '\n— ' + (d.kind === 'anthology' ? p.poet : d.poet)); t.textContent = 'نُسخ ✓'; } catch (err) {}
    } else if (t.classList.contains('op')) {
      S.id = d.id; openPoem(d, p.i, k);
    }
  });
  function restoreFilters(d) {
    if ($('#dw-q')) $('#dw-q').value = S.q;
    if ($('#dw-meter')) $('#dw-meter').value = S.meter;
    if ($('#dw-sec')) $('#dw-sec').value = S.sec;
    renderList(d, true);
  }

  return {
    async show() {
      if (S.index) return;
      root.innerHTML = '<p class="lead">يحمّل…</p>';
      try { await loadIndex(); renderHome(); }
      catch (e) { root.innerHTML = '<p class="err-box">تعذّر تحميل قائمة الدواوين. تحقق من الاتصال.</p>'; S.index = null; }
    },
  };
}
