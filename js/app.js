/* Moriones Heritage Guide - frontend-only MVP
 * Vanilla JS, no build step. Content lives in data/content.json (EN/FIL).
 * Saved on this device only (localStorage): language, quiz results, badges,
 * etiquette checklist, explored costume parts. */
(function () {
  'use strict';

  var STORE_KEY = 'mhg.v1';
  var DATA = null;
  var state = load();
  var quiz = newQuiz(false);
  /* Fisher-Yates shuffle (unbiased) */
  function shuffled(n) {
    var a = [], i, j, x;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  /* A new run shows each question's options in a fresh random order, so the right answer is not always "A".
   * picked and answer stay as indexes into the ORIGINAL options array; order[] only controls what is shown where. */
  function newQuiz(started) {
    var q = { started: started, i: 0, score: 0, picked: null, done: false, order: [] };
    if (started && DATA) q.order = DATA.quiz.map(function (x) { return shuffled(x.options.length); });
    return q;
  }
  var selectedPart = null;
  var anatomyMode = 'model';   // '3d model' first; falls back to the drawing if 3D is unavailable
  var viewers = [], viewer = null;

  /* ---------- storage (every access guarded) ---------- */
  function defaults() {
    return { lang: 'en', best: 0, attempts: 0, last: null, badges: [], etiquette: {}, parts: [], plan: [] };
  }
  function load() {
    var base = defaults();
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        Object.keys(base).forEach(function (k) {
          if (!p || typeof p !== 'object' || !(k in p)) return;
          // keep a saved value only if it has the right type; anything else falls back to the default
          var want = base[k], got = p[k];
          var ok = Array.isArray(want) ? Array.isArray(got)
            : (want !== null && typeof want === 'object') ? (got !== null && typeof got === 'object' && !Array.isArray(got))
            : typeof want === 'number' ? (typeof got === 'number' && isFinite(got))
            : typeof want === 'string' ? typeof got === 'string'
            : true;   // 'last' defaults to null: number or null
          if (k === 'last') ok = got === null || (typeof got === 'number' && isFinite(got));
          if (ok) base[k] = got;
        });
        ['badges', 'parts', 'plan'].forEach(function (k) {
          base[k] = base[k].filter(function (x) { return typeof x === 'string'; });
        });
      }
    } catch (e) { /* storage unavailable: run in memory */ }
    if (base.lang !== 'en' && base.lang !== 'fil') base.lang = 'en';
    return base;
  }
  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
  function t(obj) { return obj ? (obj[state.lang] || obj.en || '') : ''; }
  function ui(key) { return t(DATA.ui[key]); }  
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function srcChips(ids) {
    if (!ids || !ids.length) return '';
    var chips = ids.map(function (id) {
      var s = DATA.sources[id];
      if (!s) return '';
      return '<a class="chip" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.short) + '</a>';
    }).join('');
    return '<div class="src"><span>' + esc(ui('sourcesLabel')) + '</span>' + chips + '</div>';
  }

  /* Review status: every item starts as "not yet reviewed" until a reviewer is recorded in content.json */
  function reviewChip(item) {
    var r = item && item.review;
    if (r && r.status === 'reviewed') {
      return '<span class="chip ok">' + esc(ui('reviewReviewed')) + ' ' + esc(r.by) + ' · ' + esc(r.date) + '</span>';
    }
    return '<span class="chip warn">' + esc(ui('reviewUnreviewed')) + '</span>';
  }
  /* sources + review status. showUnreviewed=false hides the repeated "not yet reviewed" chip */
  function srcRow(item, showUnreviewed) {
    var chips = (item.src || []).map(function (id) {
      var s = DATA.sources[id];
      return s ? '<a class="chip" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.short) + '</a>' : '';
    }).join('');
    var rv = (showUnreviewed || (item.review && item.review.status === 'reviewed')) ? reviewChip(item) : '';
    if (!chips && !rv) return '';
    return '<div class="src">' + (chips ? '<span>' + esc(ui('sourcesLabel')) + '</span>' + chips : '') + rv + '</div>';
  }

  function award(id) {
    if (state.badges.indexOf(id) === -1) { state.badges.push(id); save(); return true; }
    return false;
  }

  /* ---------- static chrome ---------- */
  var ROUTES = ['learn', 'directory', 'plan', 'quiz', 'sources'];

  function renderChrome() {
    document.documentElement.lang = state.lang;
    $('#siteTitle').textContent = ui('title');
    $('#siteTagline').textContent = ui('tagline');
    $('#notice').textContent = ui('notice');
    $('#skip').textContent = ui('skip');
    $('#langLabel').textContent = ui('langLabel');
    $('#footer').textContent = ui('footer');
    $all('.lang-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)); });
    var rt = parseRoute(), cur = rt.view;
    var pageName = cur === 'learn' ? t(DATA.ui.learnTabs[LEARN.indexOf(rt.sub) >= 0 ? rt.sub : 'legend']) : t(DATA.ui.nav[cur]);
    document.title = pageName + ' \u00b7 ' + ui('title');
    $('#nav').innerHTML = ROUTES.map(function (r) {
      return '<li><a href="#/' + r + '"' + (r === cur ? ' aria-current="page"' : '') + '>' + esc(t(DATA.ui.nav[r])) + '</a></li>';
    }).join('');
  }

  function parseRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var parts = (qi >= 0 ? h.slice(0, qi) : h).split('/');
    var view = ROUTES.indexOf(parts[0]) >= 0 ? parts[0] : 'learn';
    var params = {};
    if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* ignore bad escape */ } }
    });
    return { view: view, sub: parts[1] || '', params: params };
  }

  /* ---------- Learn ---------- */
  var LEARN = ['legend', 'rites', 'anatomy'];

  function renderLearn(sub) {
    if (LEARN.indexOf(sub) < 0) sub = 'legend';
    var tabs = '<div class="tabs" role="tablist" aria-label="' + esc(t(DATA.ui.nav.learn)) + '">' +
      LEARN.map(function (k) {
        return '<button type="button" role="tab" class="tab" id="tab-' + k + '" aria-selected="' + (k === sub) +
          '" aria-controls="panel" data-sub="' + k + '" tabindex="' + (k === sub ? '0' : '-1') + '">' + esc(t(DATA.ui.learnTabs[k])) + '</button>';
      }).join('') + '</div>';
    var body = sub === 'legend' ? legendHTML() : sub === 'rites' ? ritesHTML() : anatomyHTML();
    var head = sub === 'legend' ? heroHTML() : '<h1>' + esc(t(DATA.ui.nav.learn)) + '</h1>';
    return head + tabs +
      '<div id="panel" role="tabpanel" aria-labelledby="tab-' + sub + '">' + body + '</div>';
  }

  function heroHTML() {
    return '<section class="hero"><div><p class="eyebrow">' + esc(ui('heroKicker')) + '</p>' +
      '<h1>Mory<em>onan</em></h1><p class="lead">' + esc(ui('heroLead')) + '</p>' +
      '<p><a class="btn hero-cta" href="#/learn/anatomy">' + esc(ui('heroCta')) + '</a></p></div>' +
      '<div class="arch" id="heroArch" aria-hidden="true"><svg viewBox="64 -4 172 215" focusable="false">' + figureArt() + '</svg></div></section>';
  }

  function legendHTML() {
    var L = DATA.legend;
    var paras = L.paragraphs.map(function (p) {
      return '<div class="card"><p>' + esc(t(p.text)) + '</p>' + srcRow(p) + '</div>';
    }).join('');
    var origin = '<div class="card origin"><h3 aria-level="2">' + esc(ui('originNoteTitle')) + '</h3><p>' + esc(t(L.originNote)) + '</p>' + srcRow(L.originNote) + '</div>';
    return '<div class="legend-grid">' + paras + origin + '</div>';
  }

  function ritesHTML() {
    var items = DATA.rites.map(function (r) {
      return '<li><div class="day">' + esc(t(r.day)) + '</div><h3 aria-level="2">' + esc(t(r.title)) + '</h3><p>' + esc(t(r.text)) + '</p>' + srcRow(r, true) + '</li>';
    }).join('');
    return '<p class="muted">' + esc(t(DATA.meta.scheduleNote)) + '</p><ol class="timeline">' + items + '</ol>';
  }

  /* Simple original illustration. Parts are keyboard-operable buttons. */
  var PARTS = [
    { id: 'crest', n: 1, aria: 'Helmet and crest', mx: 150, my: 40,
      hit: '<ellipse class="hit" cx="150" cy="46" rx="50" ry="30"/>' },
    { id: 'mask', n: 2, aria: 'Mask', mx: 192, my: 112,
      hit: '<ellipse class="hit" cx="150" cy="105" rx="42" ry="46"/>' },
    { id: 'breastplate', n: 3, aria: 'Breastplate', mx: 150, my: 205,
      hit: '<rect class="hit" x="104" y="148" width="92" height="118" rx="10"/>' },
    { id: 'cape', n: 4, aria: 'Cape', mx: 80, my: 322,
      hit: '<path class="hit" d="M86 150 L58 372 L104 372 L104 150 Z M214 150 L242 372 L196 372 L196 150 Z"/>' },
    { id: 'weapons', n: 5, aria: 'Sword, spear and shield', mx: 250, my: 300,
      hit: '<ellipse class="hit" cx="62" cy="235" rx="32" ry="46"/><rect class="hit" x="238" y="36" width="24" height="356"/>' },
    { id: 'sandals', n: 6, aria: 'Sandals', mx: 131, my: 392,
      hit: '<rect class="hit" x="106" y="376" width="88" height="22" rx="4"/>' }
  ];
  var PART_NAMES_FIL = { crest: 'Helmet at tuktok', mask: 'Maskara', breastplate: 'Baluti sa dibdib', cape: 'Kapa', weapons: 'Espada, sibat at kalasag', sandals: 'Sandalyas' };

  /* The costume drawing, styled with classes (colors live in styles.css) */
  function figureArt() {
    return '<rect class="fg-bg" x="-40" y="-20" width="380" height="460"/>' +
      '<path class="fg-cape" d="M85 150 Q60 260 52 372 L248 372 Q240 260 215 150 Z"/>' +
      '<rect class="fg-skin" x="118" y="335" width="26" height="45"/><rect class="fg-skin" x="156" y="335" width="26" height="45"/>' +
      '<rect class="fg-leather" x="110" y="378" width="40" height="14" rx="4"/><rect class="fg-leather" x="150" y="378" width="40" height="14" rx="4"/>' +
      '<path class="fg-strap" d="M118 352 H144 M156 352 H182 M118 364 H144 M156 364 H182"/>' +
      '<path class="fg-tunic" d="M110 262 L190 262 L205 337 L95 337 Z"/>' +
      '<path class="fg-steel-line" d="M192 272 L222 338"/><path class="fg-hilt" d="M186 276 L202 266"/>' +
      '<path class="fg-arm" d="M104 158 L84 232"/><path class="fg-arm" d="M196 158 L246 218"/>' +
      '<path class="fg-brass" d="M108 150 Q150 138 192 150 L196 262 Q150 275 104 262 Z"/>' +
      '<path class="fg-brass-line" d="M106 185 Q150 195 194 185 M105 215 Q150 225 195 215 M104 245 Q150 255 196 245"/>' +
      '<ellipse class="fg-shield" cx="62" cy="235" rx="30" ry="44"/><circle class="fg-gold" cx="62" cy="235" r="9"/>' +
      '<line class="fg-shaft" x1="250" y1="62" x2="250" y2="392"/><polygon class="fg-steel" points="250,36 242,66 258,66"/>' +
      '<rect class="fg-skin-fill" x="140" y="130" width="20" height="24"/>' +
      '<ellipse class="fg-wood" cx="150" cy="95" rx="40" ry="46"/>' +
      '<path class="fg-ink" d="M114 108 Q150 178 186 108 Q150 134 114 108 Z"/>' +
      '<path class="fg-brow" d="M120 80 Q134 68 148 82 M152 82 Q166 68 180 80"/>' +
      '<ellipse class="fg-eye" cx="134" cy="90" rx="6" ry="3.5"/><ellipse class="fg-eye" cx="166" cy="90" rx="6" ry="3.5"/>' +
      '<path class="fg-nose" d="M150 92 L143 113 L157 113 Z"/>' +
      '<path class="fg-mouth" d="M135 122 Q150 114 165 122"/>' +
      '<path class="fg-helm" d="M108 90 Q108 34 150 32 Q192 34 192 90 L184 80 Q150 62 116 80 Z"/>' +
      '<path class="fg-ink" d="M116 46 Q150 -4 184 46 L176 52 Q150 14 124 52 Z"/>' +
      '<path class="fg-crestline" d="M135 30 L140 48 M150 20 L150 44 M165 30 L160 48"/>';
  }

  function figureSVG() {
    var hotspots = PARTS.map(function (p) {
      var name = state.lang === 'fil' ? PART_NAMES_FIL[p.id] : p.aria;
      return '<g class="hot" data-part="' + p.id + '" role="button" tabindex="0" aria-label="' + esc(name) + '">' + p.hit + '</g>';
    }).join('');
    var markers = PARTS.map(function (p) {
      return '<g class="marker" aria-hidden="true"><circle cx="' + p.mx + '" cy="' + p.my + '" r="10"/><text x="' + p.mx + '" y="' + p.my + '">' + p.n + '</text></g>';
    }).join('');
    return '<svg viewBox="0 0 300 410" role="group" aria-label="' + esc(state.lang === 'fil' ? 'Guhit ng kasuotang Morion na may anim na napipiling bahagi' : 'Drawing of a Morion costume with six selectable parts') + '">' +
      figureArt() + hotspots + markers + '</svg>';
  }

  function anatomyHTML() {
    var list = DATA.glossary.map(function (g, idx) {
      var seen = state.parts.indexOf(g.id) >= 0;
      return '<li><button type="button" class="partbtn" data-part="' + g.id + '" aria-pressed="false">' + (idx + 1) + '. ' + esc(t(g.name)) +
        '<span class="seen" aria-hidden="true">' + (seen ? '\u2713' : '') + '</span></button></li>';
    }).join('');
    var toggle = '<div class="seg-toggle" role="group" aria-label="' + esc(ui('viewLabel')) + '">' +
      ['model', 'drawing'].map(function (m) {
        return '<button type="button" class="seg" data-mode="' + m + '" aria-pressed="' + (anatomyMode === m) + '">' + esc(ui(m === 'model' ? 'view3d' : 'viewDrawing')) + '</button>';
      }).join('') + '</div>';
    return '<p class="muted">' + esc(ui('anatomyIntro')) + '</p>' +
      '<div class="anatomy"><div>' + toggle + '<div class="figure" id="figureBox">' + figureBoxHTML() + '</div></div>' +
      '<div><ul class="partlist">' + list + '</ul>' +
      '<p class="progress" id="partProgress" aria-live="polite"></p>' +
      '<div class="card" id="partPanel" aria-live="polite"></div></div></div>';
  }

  function figureBoxHTML() {
    if (anatomyMode !== 'model') return figureSVG();
    return '<div class="mask3d"><div class="mask3d-stage" id="m3dStage"><p class="m3d-msg" id="m3dMsg" role="status">' + esc(ui('m3dLoading')) + '</p></div>' +
      '<div class="mask3d-ctrl" role="group" aria-label="' + esc(ui('m3dControls')) + '">' +
      '<button type="button" class="btn secondary sm" id="m3dAuto" aria-pressed="true">' + esc(ui('m3dPause')) + '</button>' +
      '<button type="button" class="btn secondary sm" id="m3dReset">' + esc(ui('m3dReset')) + '</button>' +
      '<button type="button" class="btn secondary sm sq" id="m3dZin" aria-label="' + esc(ui('m3dZoomIn')) + '">+</button>' +
      '<button type="button" class="btn secondary sm sq" id="m3dZout" aria-label="' + esc(ui('m3dZoomOut')) + '">\u2212</button></div>' +
      '<div class="mask3d-opts"><label class="check"><input type="checkbox" id="m3dHelmet" checked><span>' + esc(ui('m3dHelmet')) + '</span></label>' +
      '<label class="check"><input type="checkbox" id="m3dFlowers"><span>' + esc(ui('m3dFlowers')) + '</span></label></div>' +
      '<p class="small muted">' + esc(ui('m3dHint')) + '</p><p class="small muted m3d-credit">' + esc(ui('m3dCredit')) + '</p></div>';
  }

  function updateAnatomy() {
    var g = DATA.glossary.filter(function (x) { return x.id === selectedPart; })[0];
    var panel = $('#partPanel');
    if (!panel) return;
    var modelled = selectedPart === 'mask' || selectedPart === 'crest';
    panel.innerHTML = g
      ? '<h3 aria-level="2">' + esc(t(g.name)) + '</h3><p>' + esc(t(g.text)) + '</p>' + srcRow(g, true) +
        (anatomyMode === 'model' && !modelled ? '<p class="small muted">' + esc(ui('m3dNotModelled')) + '</p>' : '')
      : '<p class="muted">' + esc(ui('anatomyPrompt')) + '</p>';
    if (viewer) viewer.highlight(modelled ? selectedPart : null);
    $all('.hot').forEach(function (h) { h.classList.toggle('active', h.dataset.part === selectedPart); });
    $all('.partbtn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.part === selectedPart));
      var s = $('.seen', b); if (s) s.textContent = state.parts.indexOf(b.dataset.part) >= 0 ? '✓' : '';
    });
    $('#partProgress').textContent = state.parts.length + ' / ' + DATA.glossary.length + ' ' + ui('explored');
  }

  function selectPart(id) {
    selectedPart = id;
    if (state.parts.indexOf(id) === -1) state.parts.push(id);
    if (state.parts.length >= DATA.glossary.length) award('explorer');
    save();
    updateAnatomy();
  }

  /* ---------- Directory ---------- */
  var dirFilter = { q: '', town: '', category: '' };

  /* put the current filters in the address so a filtered view can be shared (no page reload) */
  function setHash(view, params) {
    var qs = Object.keys(params).filter(function (k) { return params[k]; }).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    try { history.replaceState(null, '', '#/' + view + (qs ? '?' + qs : '')); } catch (e) { /* e.g. some sandboxes */ }
  }
  function townNames(d) {
    return d.towns.map(function (k) { return t(DATA.filters.municipality[k]); });
  }
  function townChips(d) {
    return d.towns.map(function (k) { return '<span class="chip">' + esc(t(DATA.filters.municipality[k])) + '</span>'; }).join(' ');
  }

  function directoryHTML() {
    var F = DATA.filters;
    function opts(group) {
      return '<option value="">' + esc(ui('all')) + '</option>' + Object.keys(F[group]).map(function (k) {
        return '<option value="' + k + '">' + esc(t(F[group][k])) + '</option>';
      }).join('');
    }
    return '<h1>' + esc(ui('dirTitle')) + '</h1><p class="muted">' + esc(ui('dirIntro')) + '</p><p class="muted small">' + esc(t(DATA.meta.scheduleNote)) + '</p>' +
      '<form class="filters" role="search" id="dirForm">' +
      '<div><label for="dq">' + esc(ui('search')) + '</label><input type="search" id="dq" placeholder="' + esc(ui('searchPh')) + '" autocomplete="off"></div>' +
      '<div><label for="dm">' + esc(ui('municipality')) + '</label><select id="dm">' + opts('municipality') + '</select></div>' +
      '<div><label for="dc">' + esc(ui('category')) + '</label><select id="dc">' + opts('category') + '</select></div>' +
      '<div><button type="button" class="btn secondary" id="dreset">' + esc(ui('reset')) + '</button></div></form>' +
      '<p id="dcount" aria-live="polite" class="muted"></p><ul class="results" id="dresults"></ul>';
  }

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function filterDirectory() {
    var q = norm(dirFilter.q.trim());
    return DATA.directory.filter(function (d) {
      if (dirFilter.town && d.towns.indexOf(dirFilter.town) < 0) return false;
      if (dirFilter.category && d.category !== dirFilter.category) return false;
      if (!q) return true;
      var hay = norm([d.name.en, d.name.fil, d.text.en, d.text.fil, d.where.en, d.where.fil, d.when.en, d.when.fil,
        townNames(d).join(' '), t(DATA.filters.category[d.category])].join(' '));
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }

  function drawDirectory() {
    var rows = filterDirectory();
    $('#dcount').textContent = rows.length + ' ' + ui('results');
    $('#dresults').innerHTML = rows.length ? rows.map(function (d) {
      return '<li><article class="card" data-cat="' + d.category + '"><h3 aria-level="2">' + esc(t(d.name)) + '</h3>' +
        '<div><span class="chip">' + esc(t(DATA.filters.category[d.category])) + '</span> ' + townChips(d) +
        (d.typical ? ' <span class="chip warn">' + esc(ui('verifyYearly')) + '</span>' : '') + '</div>' +
        '<dl class="meta"><div><dt>' + esc(ui('when')) + ':</dt> <dd>' + esc(t(d.when)) + '</dd></div>' +
        '<div><dt>' + esc(ui('where')) + ':</dt> <dd>' + esc(t(d.where)) + '</dd></div></dl>' +
        '<p>' + esc(t(d.text)) + '</p>' + srcRow(d, true) + '</article></li>';
    }).join('') : '<li class="card" id="noRes">' + esc(ui('noResults')) + suggestionsHTML() + '</li>';
    setHash('directory', { q: dirFilter.q.trim(), town: dirFilter.town, cat: dirFilter.category });
  }

  function suggestionsHTML() {
    return '<p class="small">' + esc(ui('tryThese')) + '</p><p>' + DATA.suggestions.map(function (w) {
      return '<button type="button" class="chip suggest" data-q="' + esc(w) + '">' + esc(w) + '</button>';
    }).join(' ') + '</p>';
  }

  function bindDirectory(params) {
    var q = $('#dq'), m = $('#dm'), c = $('#dc');
    $('#dirForm').addEventListener('submit', function (e) { e.preventDefault(); });
    if (params && (params.q !== undefined || params.town !== undefined || params.cat !== undefined)) {
      dirFilter = {
        q: params.q || '',
        town: has(DATA.filters.municipality, params.town) ? params.town : '',
        category: has(DATA.filters.category, params.cat) ? params.cat : ''
      };
    }
    q.value = dirFilter.q; m.value = dirFilter.town; c.value = dirFilter.category;
    q.addEventListener('input', function () { dirFilter.q = q.value; drawDirectory(); });
    m.addEventListener('change', function () { dirFilter.town = m.value; drawDirectory(); });
    c.addEventListener('change', function () { dirFilter.category = c.value; drawDirectory(); });
    $('#dreset').addEventListener('click', function () {
      dirFilter = { q: '', town: '', category: '' };
      q.value = ''; m.value = ''; c.value = ''; drawDirectory(); q.focus();
    });
    $('#dresults').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.suggest') : null;
      if (!b) return;
      dirFilter = { q: b.dataset.q, town: '', category: '' };
      q.value = dirFilter.q; m.value = ''; c.value = ''; drawDirectory(); q.focus();
    });
    drawDirectory();
  }


  /* ---------- Plan a visit ---------- */
  var planFilter = { day: 'fri', town: '' };
  var sharedIds = null;

  function dayIndex(id) { var i = DATA.days.map(function (d) { return d.id; }).indexOf(id); return i < 0 ? 99 : i; }
  function dirById(id) { return DATA.directory.filter(function (d) { return d.id === id; })[0]; }
  function dayName(id) { var d = DATA.days.filter(function (x) { return x.id === id; })[0]; return d ? t(d) : ui('dayAny'); }
  function townMatch(d, town) { return !town || d.towns.indexOf(town) >= 0 || d.towns.indexOf('island') >= 0; }

  function planView() {
    var dayOpts = DATA.days.map(function (d) { return '<option value="' + d.id + '">' + esc(t(d)) + '</option>'; }).join('');
    var townOpts = '<option value="">' + esc(ui('anyTown')) + '</option>' + Object.keys(DATA.filters.municipality).filter(function (k) { return k !== 'island'; }).map(function (k) {
      return '<option value="' + k + '">' + esc(t(DATA.filters.municipality[k])) + '</option>';
    }).join('');
    return '<h1>' + esc(ui('planTitle')) + '</h1><p class="muted">' + esc(ui('planIntro')) + '</p><p class="muted small">' + esc(t(DATA.meta.scheduleNote)) + '</p>' +
      '<div id="sharedBox"></div>' +
      '<form class="filters plan-filters" id="planForm">' +
      '<div><label for="pday">' + esc(ui('day')) + '</label><select id="pday">' + dayOpts + '</select></div>' +
      '<div><label for="ptown">' + esc(ui('town')) + '</label><select id="ptown">' + townOpts + '</select></div>' +
      '<div class="span2"></div></form>' +
      '<div class="two-col plan-cols"><div><div id="presults" aria-live="polite"></div></div>' +
      '<div><section class="card" id="myplan" aria-labelledby="myplanH"></section></div></div>';
  }

  function planCard(d) {
    var on = state.plan.indexOf(d.id) >= 0;
    return '<article class="card" data-cat="' + d.category + '"><h3>' + esc(t(d.name)) + '</h3>' +
      '<div><span class="chip">' + esc(t(DATA.filters.category[d.category])) + '</span> ' + townChips(d) +
      (d.typical ? ' <span class="chip warn">' + esc(ui('verifyYearly')) + '</span>' : '') + '</div>' +
      '<dl class="meta"><div><dt>' + esc(ui('when')) + ':</dt> <dd>' + esc(t(d.when)) + '</dd></div>' +
      '<div><dt>' + esc(ui('where')) + ':</dt> <dd>' + esc(t(d.where)) + '</dd></div></dl>' +
      '<p>' + esc(t(d.text)) + '</p>' +
      '<button type="button" class="btn secondary savebtn" data-save="' + d.id + '" aria-pressed="' + on + '">' + esc(on ? '✓ ' + ui('saved') : ui('save')) + '</button>' +
      srcRow(d, true) + '</article>';
  }

  function drawPlanResults() {
    var day = planFilter.day, town = planFilter.town;
    var events = DATA.directory.filter(function (d) { return d.category !== 'site' && d.days.indexOf(day) >= 0 && townMatch(d, town); });
    var places = DATA.directory.filter(function (d) {
      return events.indexOf(d) < 0 && (d.category === 'site' || d.days.indexOf('any') >= 0) && (!town || d.towns.indexOf(town) >= 0);
    });
    var html = '<h3 aria-level="2" class="sec">' + esc(ui('onDay')) + ' ' + esc(dayName(day)) + '</h3>' +
      (events.length ? events.map(planCard).join('') : '<div class="card"><p>' + esc(ui('nothingDay')) + '</p></div>');
    if (places.length) html += '<h3 aria-level="2" class="sec">' + esc(ui('inTown')) + '</h3>' + places.map(planCard).join('');
    $('#presults').innerHTML = html;
    setHash('plan', { day: day, town: town, ids: state.plan.join(',') });
  }

  function planLink() {
    return location.href.split('#')[0] + '#/plan?day=' + encodeURIComponent(planFilter.day) + (planFilter.town ? '&town=' + encodeURIComponent(planFilter.town) : '') +
      (state.plan.length ? '&ids=' + state.plan.join(',') : '');
  }

  /* The plan as plain text: this is what people can paste into a message, e-mail or note.
   * (A link to a local file cannot be opened by anyone else, so text is the dependable way to share.) */
  function planText() {
    var items = state.plan.map(dirById).filter(Boolean).sort(function (a, b) { return dayIndex(a.days[0]) - dayIndex(b.days[0]); });
    var fil = state.lang === 'fil';
    var out = [ui('planTextTitle'), ui('title') + ' (' + (fil ? 'proyektong pang-estudyante, MarSU' : 'student project, MarSU') + ')', ''];
    if (!items.length) out.push(ui('emptyPlan'));
    items.forEach(function (d, i) {
      out.push((i + 1) + '. ' + t(d.name));
      out.push('   ' + ui('day') + ': ' + d.days.map(dayName).join(', '));
      out.push('   ' + ui('town') + ': ' + townNames(d).join(', '));
      out.push('   ' + ui('when') + ': ' + t(d.when));
      out.push('   ' + ui('where') + ': ' + t(d.where));
      out.push('');
    });
    out.push(t(DATA.meta.scheduleNote));
    out.push(fil ? 'Ang Moryonan ay relihiyosong panata at pagsisisi. Bumisita nang may paggalang.' : 'The Moryonan is a religious tradition of penance and vows. Please visit with respect.');
    return out.join('\n');
  }

  /* copy with a fallback for browsers/pages where the modern clipboard API is blocked (e.g. file://) */
  function copyText(text, done) {
    function legacy() {
      var ok = false, ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    } else { legacy(); }
  }

  function downloadText(text, name) {
    var blob = new Blob(['\ufeff' + text.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 500);
  }

  function drawMyPlan() {
    var box = $('#myplan'); if (!box) return;
    var items = state.plan.map(dirById).filter(Boolean).sort(function (a, b) { return dayIndex(a.days[0]) - dayIndex(b.days[0]); });
    var list = items.length ? '<ol class="planlist">' + items.map(function (d) {
      return '<li><div><strong>' + esc(t(d.name)) + '</strong><br><span class="small muted">' +
        esc(d.days.map(dayName).join(', ')) + ' \u00b7 ' + esc(townNames(d).join(', ')) + '</span></div>' +
        '<button type="button" class="btn secondary small-btn" data-remove="' + d.id + '" aria-label="' + esc(ui('removeFromPlan') + ': ' + t(d.name)) + '">' + esc(ui('removeFromPlan')) + '</button></li>';
    }).join('') + '</ol>' : '<p class="muted">' + esc(ui('emptyPlan')) + '</p>';
    var web = /^https?:$/.test(location.protocol), dis = items.length ? '' : ' disabled';
    box.innerHTML = '<h3 aria-level="2" id="myplanH">' + esc(ui('myPlan')) + '</h3>' + list +
      '<p class="muted small">' + esc(t(DATA.meta.scheduleNote)) + '</p>' +
      '<div class="actions"><button type="button" class="btn" id="copyPlan"' + dis + '>' + esc(ui('copyText')) + '</button> ' +
      '<button type="button" class="btn secondary" id="dlPlan"' + dis + '>' + esc(ui('downloadTxt')) + '</button> ' +
      '<button type="button" class="btn secondary" id="printPlan">' + esc(ui('print')) + '</button>' +
      (web ? ' <button type="button" class="btn secondary" id="copyLink"' + dis + '>' + esc(ui('copyLink')) + '</button>' : '') + '</div>' +
      '<p class="small" id="copyMsg" role="status"></p>' +
      '<details class="plan-text"><summary>' + esc(ui('showText')) + '</summary>' +
      '<label for="planTextBox" class="visually-hidden">' + esc(ui('planTextTitle')) + '</label>' +
      '<textarea id="planTextBox" readonly rows="10"></textarea></details>' +
      (web ? '' : '<p class="small muted">' + esc(ui('linkNote')) + '</p>');
    $('#planTextBox').value = planText();
    $('#planTextBox').addEventListener('focus', function () { this.select(); });
    $('#copyPlan').addEventListener('click', function () {
      var msg = $('#copyMsg');
      copyText(planText(), function (ok) {
        msg.textContent = ok ? ui('copiedText') : ui('copyFail');
        if (!ok) { var d = $('.plan-text'); if (d) d.open = true; var tb = $('#planTextBox'); if (tb) { tb.focus(); tb.select(); } }
      });
    });
    $('#dlPlan').addEventListener('click', function () {
      try { downloadText(planText(), 'moriones-visit-plan.txt'); $('#copyMsg').textContent = ui('downloaded'); }
      catch (e) { $('#copyMsg').textContent = ui('copyFail'); }
    });
    $('#printPlan').addEventListener('click', function () { window.print(); });
    var cl = $('#copyLink');
    if (cl) cl.addEventListener('click', function () {
      copyText(planLink(), function (ok) { $('#copyMsg').textContent = ok ? ui('copied') : ui('copyFail'); });
    });
    $all('[data-remove]', box).forEach(function (b) {
      b.addEventListener('click', function () { togglePlan(b.dataset.remove, false); });
    });
  }

  function togglePlan(id, on) {
    var i = state.plan.indexOf(id);
    if (on && i < 0) state.plan.push(id);
    if (!on && i >= 0) state.plan.splice(i, 1);
    save(); drawPlanResults(); drawMyPlan();
  }

  function bindPlan(params) {
    var day = $('#pday'), town = $('#ptown');
    $('#planForm').addEventListener('submit', function (e) { e.preventDefault(); });
    if (params && params.day && DATA.days.some(function (d) { return d.id === params.day; })) planFilter.day = params.day;
    if (params && params.town !== undefined) planFilter.town = (has(DATA.filters.municipality, params.town) && params.town !== 'island') ? params.town : '';
    if (params && params.ids) {
      var ids = params.ids.split(',').filter(function (id) { return dirById(id); });
      if (ids.length && ids.join(',') !== state.plan.join(',')) {
        sharedIds = ids;
        $('#sharedBox').innerHTML = '<div class="card origin"><p>' + esc(state.lang === 'fil' ? 'May kasamang plano ang link na ito na may ' + ids.length + ' bagay. Gamitin ito bilang iyong plano?' : 'This link includes a plan with ' + ids.length + ' item(s). Use it as your plan?') +
          '</p><button type="button" class="btn" id="useShared">' + esc(state.lang === 'fil' ? 'Gamitin ang planong ito' : 'Use this plan') + '</button></div>';
        $('#useShared').addEventListener('click', function () {
          state.plan = sharedIds.slice(); save(); $('#sharedBox').innerHTML = ''; drawPlanResults(); drawMyPlan();
        });
      }
    }
    day.value = planFilter.day; town.value = planFilter.town;
    day.addEventListener('change', function () { planFilter.day = day.value; drawPlanResults(); });
    town.addEventListener('change', function () { planFilter.town = town.value; drawPlanResults(); });
    $('#presults').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.savebtn') : null;
      if (!b) return;
      togglePlan(b.dataset.save, b.getAttribute('aria-pressed') !== 'true');
      var again = $('[data-save="' + b.dataset.save + '"]'); if (again) again.focus();
    });
    drawPlanResults(); drawMyPlan();
  }

  /* ---------- Quiz + etiquette ---------- */
  function quizView() {
    return '<h1>' + esc(ui('quizTitle')) + '</h1>' +
      '<div class="two-col"><div>' + '<div class="card" id="quizBox"></div>' + '</div>' +
      '<div><div class="card" id="statsBox"></div><div class="card" id="badgeBox"></div></div></div>' +
      '<h2>' + esc(ui('etiquetteTitle')) + '</h2><p class="muted">' + esc(ui('etiquetteIntro')) + '</p>' +
      '<div class="card"><ul class="checklist" id="checklist"></ul><p class="progress" id="chkCount" aria-live="polite"></p>' +
      '<button type="button" class="btn secondary" id="printChk">' + esc(ui('print')) + '</button></div>' +
      '<p><button type="button" class="btn secondary" id="resetAll">' + esc(ui('resetProgress')) + '</button></p>';
  }

  function drawQuiz() {
    var box = $('#quizBox'); if (!box) return;
    var Q = DATA.quiz;
    if (!quiz.started) {
      box.innerHTML = '<p>' + esc(ui('quizIntro')) + '</p><button type="button" class="btn" id="qstart">' + esc(ui('start')) + '</button>';
      $('#qstart').addEventListener('click', function () { quiz = newQuiz(true); drawQuiz(); focusQuiz(); });
    } else if (quiz.done) {
      box.innerHTML = '<h3 aria-level="2" tabindex="-1" id="qresult">' + esc(ui('score')) + ': ' + quiz.score + ' / ' + Q.length + '</h3>' +
        segBar(quiz.score, Q.length) +
        '<button type="button" class="btn" id="qretry">' + esc(ui('retry')) + '</button>';
      $('#qretry').addEventListener('click', function () { quiz = newQuiz(true); drawQuiz(); focusQuiz(); });
      var r = $('#qresult'); if (r) r.focus();
    } else {
      var q = Q[quiz.i], answered = quiz.picked !== null;
      var ord = quiz.order[quiz.i] || q.options.map(function (o, n) { return n; });
      var optsHTML = ord.map(function (idx, pos) {
        var o = q.options[idx], cls = '';
        if (answered) cls = idx === q.answer ? ' right' : (idx === quiz.picked ? ' wrong' : '');
        return '<li><button type="button" class="opt' + cls + '" data-idx="' + idx + '"' + (answered ? ' disabled' : '') + '><span class="k" aria-hidden="true">' + 'ABCD'.charAt(pos) + '</span><span>' + esc(t(o)) + '</span></button></li>';
      }).join('');
      var fb = '';
      if (answered) {
        var ok = quiz.picked === q.answer;
        fb = '<div class="feedback ' + (ok ? 'right' : 'wrong') + '" role="status"><strong>' + esc(ok ? ui('correct') : ui('incorrect')) + '</strong> ' + esc(t(q.why)) + srcRow(q) + '</div>' +
          '<button type="button" class="btn" id="qnext">' + esc(quiz.i === Q.length - 1 ? ui('finish') : ui('next')) + '</button>';
      }
      box.innerHTML = segBar(quiz.i + (answered ? 1 : 0), Q.length) +
        '<p class="muted" id="qnum">' + esc(ui('question')) + ' ' + (quiz.i + 1) + ' ' + esc(ui('of')) + ' ' + Q.length + '</p>' +
        '<h3 aria-level="2" id="qtext" tabindex="-1">' + esc(t(q.q)) + '</h3><ul class="quiz-options">' + optsHTML + '</ul>' + fb;
      $all('.opt', box).forEach(function (b) {
        b.addEventListener('click', function () { answer(parseInt(b.dataset.idx, 10)); });
      });
      var nx = $('#qnext');
      if (nx) { nx.addEventListener('click', next); nx.focus(); }
    }
    drawStats();
  }

  function segBar(n, total) {
    var out = '';
    for (var i = 0; i < total; i++) out += '<span' + (i < n ? ' class="on"' : '') + '></span>';
    return '<div class="segs" aria-hidden="true">' + out + '</div>';
  }

  function focusQuiz() { var h = $('#qtext'); if (h) h.focus(); }

  function answer(idx) {
    if (quiz.picked !== null) return;
    quiz.picked = idx;
    if (idx === DATA.quiz[quiz.i].answer) quiz.score++;
    drawQuiz();
  }

  function next() {
    if (quiz.i === DATA.quiz.length - 1) {
      quiz.done = true;
      state.attempts += 1;
      state.last = quiz.score;
      if (quiz.score > state.best) state.best = quiz.score;
      award('first');
      if (quiz.score >= 7) award('scholar');
      if (quiz.score === DATA.quiz.length) award('perfect');
      save();
      drawQuiz();
    } else {
      quiz.i++; quiz.picked = null; drawQuiz(); focusQuiz();
    }
  }

  function drawStats() {
    var s = $('#statsBox'), b = $('#badgeBox'); if (!s || !b) return;
    var total = DATA.quiz.length;
    s.innerHTML = '<p><strong>' + esc(ui('best')) + ':</strong> ' + (state.attempts ? state.best + ' / ' + total : '–') +
      '<br><strong>' + esc(ui('attempts')) + ':</strong> ' + state.attempts + '</p>';
    var names = DATA.ui.badgeNames, hints = DATA.ui.badgeHints;
    b.innerHTML = '<h3 aria-level="2">' + esc(ui('badges')) + '</h3><ul class="badges">' + Object.keys(names).map(function (k) {
      var on = state.badges.indexOf(k) >= 0;
      return '<li class="badge' + (on ? ' earned' : '') + '"><div class="n">' + (on ? '★ ' : '☆ ') + esc(t(names[k])) + '</div><div class="h">' + esc(t(hints[k])) + '</div></li>';
    }).join('') + '</ul>';
  }

  function drawChecklist() {
    var ul = $('#checklist'); if (!ul) return;
    ul.innerHTML = DATA.etiquette.map(function (e) {
      var tag = e.type === 'sourced' ? '<span class="chip ok">' + esc(ui('sourced')) + '</span>' : '<span class="chip warn">' + esc(ui('pending')) + '</span>';
      return '<li><label><input type="checkbox" data-id="' + e.id + '"' + (state.etiquette[e.id] ? ' checked' : '') + '><span>' + esc(t(e.text)) + '<br>' + tag + '</span></label>' +
        srcRow(e) + '</li>';
    }).join('');
    $all('input', ul).forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.etiquette[cb.dataset.id] = cb.checked;
        var all = DATA.etiquette.every(function (e) { return state.etiquette[e.id]; });
        if (all) award('visitor');
        save(); updateCheckCount(); drawStats();
      });
    });
    updateCheckCount();
  }
  function updateCheckCount() {
    var n = DATA.etiquette.filter(function (e) { return state.etiquette[e.id]; }).length;
    var c = $('#chkCount'); if (c) c.textContent = n + ' / ' + DATA.etiquette.length + ' ' + ui('checked');
  }

  function bindQuizView() {
    drawQuiz(); drawChecklist();
    $('#printChk').addEventListener('click', function () { window.print(); });
    $('#resetAll').addEventListener('click', function () {
      if (!window.confirm(ui('resetConfirm'))) return;
      var lang = state.lang; state = defaults(); state.lang = lang; save();
      quiz = newQuiz(false);
      selectedPart = null;
      drawQuiz(); drawChecklist();
    });
  }

  /* ---------- Sources ---------- */
  function sourcesHTML() {
    var items = Object.keys(DATA.sources).map(function (k) {
      var s = DATA.sources[k];
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a></li>';
    }).join('');
    var groups = [DATA.legend.paragraphs, DATA.rites, DATA.glossary, DATA.directory, DATA.quiz, DATA.etiquette];
    var total = 0, done = 0;
    groups.forEach(function (g) { g.forEach(function (it) { total++; if (it.review && it.review.status === 'reviewed') done++; }); });
    return '<h1>' + esc(ui('sourcesTitle')) + '</h1><p class="muted">' + esc(ui('sourcesIntro')) + '</p>' +
      '<ul class="sources-list">' + items + '</ul>' +
      '<div class="card origin"><h3 aria-level="2">' + esc(ui('reviewTitle')) + '</h3><p>' + esc(ui('reviewText')) + '</p>' +
      '<p><strong>' + done + ' / ' + total + '</strong> ' + esc(state.lang === 'fil' ? 'bagay ang nasuri ng lokal na tagasuri.' : 'items have been reviewed by a local reviewer.') + '</p></div>';
  }

  /* ---------- router ---------- */
  function render(opts) {
    var r = parseRoute(), main = $('#main'), keep = null;
    // a language switch on the hero page keeps the running 3D viewer instead of rebuilding its WebGL context
    if (opts && opts.keepHero && r.view === 'learn' && LEARN.indexOf(r.sub) <= 0) {
      var old = $('#heroArch');
      if (old && old.classList.contains('is-3d')) keep = { el: old, viewers: viewers.slice() };
    }
    if (keep) { viewers = []; viewer = null; } else destroyViewers();
    renderChrome();
    if (r.view === 'learn') {
      main.innerHTML = renderLearn(r.sub);
      if (keep) { var fresh = $('#heroArch'); if (fresh) { fresh.parentNode.replaceChild(keep.el, fresh); viewers = keep.viewers; } else keep.viewers.forEach(function (v) { try { v.destroy(); } catch (e) { /* ignore */ } }); }
      bindLearn(LEARN.indexOf(r.sub) < 0 ? 'legend' : r.sub);
    } else if (r.view === 'directory') {
      main.innerHTML = directoryHTML(); bindDirectory(r.params);
    } else if (r.view === 'plan') {
      main.innerHTML = planView(); bindPlan(r.params);
    } else if (r.view === 'quiz') {
      main.innerHTML = quizView(); bindQuizView();
    } else {
      main.innerHTML = sourcesHTML();
    }
    if (opts && opts.focusTab) {
      var activeTab = $('.tab[aria-selected="true"]');
      if (activeTab) activeTab.focus();
    } else if (opts && opts.focus) { main.focus({ preventScroll: false }); window.scrollTo(0, 0); }
  }

  var pendingLearnTabFocus = false;

  function navigateLearnTab(sub) {
    var hash = '#/learn/' + sub;
    if (location.hash !== hash) {
      pendingLearnTabFocus = true;
      location.hash = hash;
    }
  }

  function bindLearn(sub) {
    var tabs = $all('.tab');
    tabs.forEach(function (tb, i) {
      tb.addEventListener('click', function () { navigateLearnTab(tb.dataset.sub); });
      tb.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = tabs[(i + d + tabs.length) % tabs.length];
        navigateLearnTab(n.dataset.sub);
      });
    });
    if (sub === 'legend') mountHero();
    if (sub === 'anatomy') {
      $all('.seg').forEach(function (b) {
        b.addEventListener('click', function () { setAnatomyMode(b.dataset.mode); });
      });
      bindFigure();
      $all('.partbtn').forEach(function (b) { b.addEventListener('click', function () { selectPart(b.dataset.part); }); });
      updateAnatomy();
    }
  }

  /* ---------- 3D mask (lazy loaded) ---------- */
  var maskState = 'idle', maskWaiters = [];  // idle | loading | ready | failed
  function loadMask(cb) {
    if (maskState === 'ready') return cb(true);
    if (maskState === 'failed') return cb(false);
    maskWaiters.push(cb);
    if (maskState === 'loading') return;
    maskState = 'loading';
    function done(ok) {
      maskState = ok ? 'ready' : 'failed';
      var w = maskWaiters; maskWaiters = []; w.forEach(function (f) { f(ok); });
    }
    var sc = document.createElement('script');
    sc.src = 'js/mask3d.js';
    sc.onload = function () { done(!!(window.MHGMask && window.MHGMask.supported())); };  // no WebGL: stays 'failed'
    sc.onerror = function () { if (sc.parentNode) sc.parentNode.removeChild(sc); done(false); maskState = 'idle'; };  // network error: allow a retry later
    document.head.appendChild(sc);
  }
  function destroyViewers() {
    viewers.forEach(function (v) { try { v.destroy(); } catch (e) { /* ignore */ } });
    viewers = []; viewer = null;
  }
  function mountHero() {
    var arch = $('#heroArch'); if (!arch || arch.classList.contains('is-3d')) return;
    loadMask(function (ok) {
      var again = $('#heroArch');
      if (!ok || again !== arch || !document.body.contains(arch)) return;
      try {
        var v = window.MHGMask.create(arch, { decorative: true, zoom: 7.5, auto: !reducedMotion() });
        viewers.push(v); arch.classList.add('is-3d');
      } catch (e) { /* keep the drawing */ }
    });
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function setAnatomyMode(m) {
    if (m === anatomyMode) return;
    anatomyMode = m;
    destroyViewers();
    $('#figureBox').innerHTML = figureBoxHTML();
    $all('.seg').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === anatomyMode)); });
    bindFigure();
    updateAnatomy();
  }
  function fallbackToDrawing() {
    destroyViewers();
    anatomyMode = 'drawing';
    var box = $('#figureBox'); if (!box) return;
    box.innerHTML = figureBoxHTML();
    $all('.seg').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === anatomyMode)); });
    bindFigure(); updateAnatomy();
    var note = document.createElement('p'); note.className = 'small muted'; note.setAttribute('role', 'status'); note.textContent = ui('m3dFail');
    box.appendChild(note);
  }
  function bindFigure() {
    if (anatomyMode === 'model') {
      var stage = $('#m3dStage'); if (!stage) return;
      loadMask(function (ok) {
        var msg = $('#m3dMsg');
        if (!document.body.contains(stage) || anatomyMode !== 'model') return;
        if (!ok) { fallbackToDrawing(); return; }
        try {
          viewer = window.MHGMask.create(stage, {
            label: ui('m3dLabel'), auto: !reducedMotion(),
            onAutoChange: function (on) { var b = $('#m3dAuto'); if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = ui(on ? 'm3dPause' : 'm3dPlay'); } },
            onContextLost: function () { if (anatomyMode === 'model') fallbackToDrawing(); }
          });
          viewers.push(viewer);
          if (msg) msg.remove();
          var b = $('#m3dAuto'); if (b) { b.setAttribute('aria-pressed', String(viewer.isAuto())); b.textContent = ui(viewer.isAuto() ? 'm3dPause' : 'm3dPlay'); }
          $('#m3dAuto').addEventListener('click', function () { viewer.setAuto(!viewer.isAuto()); });
          $('#m3dReset').addEventListener('click', function () { viewer.reset(); });
          $('#m3dZin').addEventListener('click', function () { viewer.zoom(1); });
          $('#m3dZout').addEventListener('click', function () { viewer.zoom(-1); });
          $('#m3dHelmet').addEventListener('change', function (e) {
            viewer.setHelmet(e.target.checked); $('#m3dFlowers').disabled = !e.target.checked;
          });
          $('#m3dFlowers').addEventListener('change', function (e) { viewer.setFlowers(e.target.checked); });
          if (selectedPart === 'mask' || selectedPart === 'crest') viewer.highlight(selectedPart);
        } catch (e) { fallbackToDrawing(); }
      });
    } else {
      $all('.hot').forEach(function (h) {
        h.addEventListener('click', function () { selectPart(h.dataset.part); });
        h.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPart(h.dataset.part); }
        });
      });
    }
  }

  /* ---------- clean-up of the earlier offline (PWA) experiment ---------- */
  // v6 briefly registered a service worker on http(s). This build is a normal desktop website,
  // so remove that worker and its caches from any browser that still has them.
  function cleanupOldOffline() {
    try {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      }
      if (window.caches && window.caches.keys) {
        window.caches.keys().then(function (ks) { ks.forEach(function (k) { if (k.indexOf('mhg-') === 0) window.caches.delete(k); }); });
      }
    } catch (e) { /* nothing to clean */ }
  }

  /* ---------- boot ---------- */
  function boot() {
    $all('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.lang = b.dataset.lang; save();
        render({ keepHero: true });
      });
    });
    window.addEventListener('hashchange', function () {
      quiz = quiz.done ? newQuiz(false) : quiz;
      var focusTab = pendingLearnTabFocus;
      pendingLearnTabFocus = false;
      var go = function () { render({ focus: !focusTab, focusTab: focusTab }); };
      // soft cross-fade between pages where the browser supports it (skipped for reduced motion)
      if (document.startViewTransition && !reducedMotion()) { try { document.startViewTransition(go); } catch (e) { go(); } } else go();
    });
    // Prefer the JSON file (always current over http). When the page is opened straight from disk
    // (file://) the browser blocks fetch(), so fall back to the generated copy in data/content.js.
    cleanupOldOffline();
    function loadScriptData() {
      return new Promise(function (resolve, reject) {
        if (window.MHG_DATA) return resolve(window.MHG_DATA);
        var sc = document.createElement('script');
        sc.src = 'data/content.js';
        sc.onload = function () { window.MHG_DATA ? resolve(window.MHG_DATA) : reject(new Error('no data')); };
        sc.onerror = function () { reject(new Error('no data')); };
        document.head.appendChild(sc);
      });
    }
    // online: only content.json is downloaded; content.js is loaded only from disk (file://) or if the fetch fails
    (location.protocol === 'file:' ? loadScriptData() : fetch('data/content.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(loadScriptData))
      .then(function (json) { DATA = json; render(); })
      .catch(function () {
        $('#main').innerHTML = '<div class="error" role="alert">' + esc('The content could not be loaded. Make sure data/content.js and data/content.json are next to index.html, then reload. / Hindi ma-load ang nilalaman. Tiyaking nasa tabi ng index.html ang data/content.js at data/content.json, pagkatapos ay i-reload.') + '</div>';
      });
  }
  boot();
})();
