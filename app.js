/* Roni: one front door for Home, Work, TTG, Calls and Steady.
   - It never replaces an app. Every tile opens the app at its own link, and each app's own server checks every request.
   - One personal link (#home=..&work=..&ttg=..&calls=..) signs this browser in to all four, using the same storage each app already uses.
   - A link that is not Roni's (a kid, or Kayla) only ever sees "This link only opens Home". It fails closed.
   - Steady is never read. It keeps its notes on the phone, so its tile has no count. */
(function () {
  'use strict';
  var C = window.HUB_CONFIG || {};
  var LS = window.localStorage;
  var RX = /^[A-Za-z0-9_-]{20,128}$/, RXH = /^[A-Za-z0-9_-]{16,128}$/;
  function get(k) { try { return LS.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  function del(k) { try { LS.removeItem(k); } catch (e) {} }
  function fnvq(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(16); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* 1) Take the one link once, store each key exactly where its app keeps it, then strip it from the address bar. */
  (function takeLink() {
    var h = location.hash.replace(/^#/, '');
    if (!/(^|&)(home|work|ttg|calls)=/.test(h)) return;
    var p = new URLSearchParams(h);
    var home = p.get('home'), work = p.get('work'), ttg = p.get('ttg'), calls = p.get('calls');
    if (home && RXH.test(home)) {               // same steps as Home's own sign-in (pages/auth.js)
      var prevK = get('homeops.k');
      if (get('homeops.kskip') !== fnvq('homeops:' + home)) {
        if (prevK && home !== prevK) set('homeops.kprev', prevK);
        if (home !== prevK) { del('homeops.s'); del('homeops.sexp'); set('homeops.switched', '1'); }
        set('homeops.k', home);
      }
    }
    if (work && RX.test(work)) set('ttgr.k', work);                                              // same as Recruiting boot.js
    if (ttg && RX.test(ttg)) { if (get('ttgops.k') !== ttg) del('ttgops.cache'); set('ttgops.k', ttg); }   // same as TTG Ops boot.js
    if (calls && calls.length >= 8 && calls.length <= 200) set('calls.k', calls);                // same as Calls app.js
    del('hub.who');
    history.replaceState(null, '', location.pathname);
  })();

  var K = { home: get('homeops.k'), work: get('ttgr.k'), ttg: get('ttgops.k'), calls: get('calls.k') };
  var app = document.getElementById('app');
  var state = { gate: 'loading', home: '', calls: '' };

  /* Who is this? Remembered per Home key (one-way hash) so Roni's screen paints at once; always re-checked. */
  var whoTag = K.home ? fnvq('hub:' + K.home) : (K.calls ? fnvq('hubc:' + K.calls) : '');
  if (whoTag && get('hub.who') === whoTag + ':Roni') state.gate = 'roni';

  function post(url, body) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 25000);
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', referrerPolicy: 'no-referrer', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); }).then(function (j) { clearTimeout(t); return j; }, function (e) { clearTimeout(t); throw e; });
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
    work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M18 8v6M15 11h6"/></svg>',
    ttg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-9"/><path d="M12 12c-4 0-6-2.5-6-6 3.5 0 6 2 6 6Z"/><path d="M12 12c4 0 6-2.5 6-6-3.5 0-6 2-6 6Z"/></svg>',
    calls: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    steady: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17a8 8 0 0 1 16 0"/><path d="M2 21h20"/><path d="M12 5V3M5.6 7.6 4.2 6.2M18.4 7.6l1.4-1.4"/></svg>'
  };

  function tile(id, name, sub, hint, own, tag) {
    var t = tag || 'a';
    var attrs = t === 'a' ? ' href="' + esc(C.APPS[id]) + '"' : ' type="button" data-act="' + id + '"';
    return '<' + t + ' class="tile t-' + id + '"' + attrs + '><div class="ic">' + ICON[id] + '</div><div><div class="nm">' + esc(name) +
      (own ? '<span class="ext">own app</span>' : '') + '</div><div class="sub">' + esc(sub) + '</div><div class="hint" data-hint="' + id + '">' + esc(hint) + '</div></div><div class="chev" aria-hidden="true">&rsaquo;</div></' + t + '>';
  }
  function today() { return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
  function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.'; }

  function draw() {
    if (state.gate === 'loading') { app.innerHTML = '<div class="top"><div class="brand"><div class="mark">R</div>Roni</div></div><div class="date">' + esc(today()) + '</div><h1>One moment.</h1>'; return; }
    if (state.gate === 'signin') {
      app.innerHTML = '<div class="top"><div class="brand"><div class="mark">R</div>Roni</div></div><div class="card"><h2>Open your personal link</h2>' +
        '<p>Open your one link on this phone once. After that, Home, Work, TTG and Calls open without asking again.</p><p>Steady needs no sign-in. It lives on the phone.</p></div>';
      return;
    }
    if (state.gate === 'homeonly') {
      app.innerHTML = '<div class="card"><h2>This link only opens Home</h2>' +
        '<p>Everything for you is in Home.</p><a class="btn home" href="' + esc(C.APPS.home) + '">Open Home</a></div>';
      return;
    }
    var homeHint = state.home || (K.home ? 'Gafni House' : 'Open once with your link');
    var callsHint = state.calls || (K.calls ? 'Calls, presets and history' : 'Open once with your link');
    app.innerHTML = '<div class="top"><div class="brand"><div class="mark">R</div>Roni</div><div class="who">Signed in &middot; Roni</div></div>' +
      '<div class="date">' + esc(today()) + '</div><h1>' + greet() + '</h1><div class="tiles">' +
      tile('home', 'Home', 'Gafni House', homeHint) +
      tile('work', 'Work', 'Recruiting', K.work ? 'Recruiting and Projects' : 'Open once with your link') +
      tile('ttg', 'TTG', 'TTG Ops', K.ttg ? 'Oversight workspace' : 'Open once with your link') +
      tile('calls', 'Calls', 'Katya Calls', callsHint, true) +
      tile('steady', 'Steady', 'Opens on this phone', 'Private to this phone, no live count', true, 'button') +
      '</div><div class="foot">Steady and Calls keep their own icons and links too. Opening them here goes to the same app.</div>' +
      '<div class="links"><button class="lnk" data-act="copylink">Copy my one link</button></div>';
  }
  function hint(id, text) { var el = app.querySelector('[data-hint="' + id + '"]'); if (el) el.textContent = text; }

  function becomeRoni() { if (whoTag) set('hub.who', whoTag + ':Roni'); if (state.gate !== 'roni') { state.gate = 'roni'; draw(); } }
  function notRoni() { del('hub.who'); state.gate = 'homeonly'; draw(); }

  /* 2) Check who this is, and fetch counts only. Nothing else from any app is kept or shown. */
  var homeDone = !K.home, callsDone = !K.calls, homeWho = '', callsWho = '';
  function settle() {
    if (homeWho && homeWho !== 'Roni') return notRoni();
    if (callsWho && callsWho !== 'Roni') return notRoni();
    if (homeWho === 'Roni' || callsWho === 'Roni') return becomeRoni();
    if (!homeDone || !callsDone) return;
    // Nobody confirmed. Fail closed: a Home key on its own only opens Home; no keys at all asks for the link.
    if (state.gate === 'roni') return;              // already confirmed on this phone for this same key
    if (K.home) { state.gate = 'homeonly'; draw(); return; }
    if (K.work || K.ttg) { state.gate = 'signin'; draw(); return; }
    state.gate = 'signin'; draw();
  }
  if (K.home) {
    post(C.HOME_API, { k: K.home, s: get('homeops.s') || undefined, action: 'getData', args: [] }).then(function (j) {
      if (j && j.ok) {
        homeWho = (j.user && j.user.person) || (j.result && j.result.signedInAs) || '';
        var r = j.result || {};
        var g = (r.shopping || []).filter(function (s) { return !s.checked; }).length;
        var t = (r.todos || []).filter(function (x) { return !x.done; }).length;
        state.home = plural(g, 'on grocery', 'on grocery') + ' \u00b7 ' + plural(t, 'to-do', 'to-dos');
      } else if (j && j.status === 428) { homeWho = 'Roni'; state.home = 'Sign in inside Home'; }   // only Roni's link asks for Google sign-in
      else if (j && (j.status === 401 || j.status === 403)) { homeWho = ''; K.home = ''; state.home = ''; }
    }).catch(function () {}).then(function () { homeDone = true; settle(); if (state.gate === 'roni') hint('home', state.home || 'Gafni House'); });
  }
  if (K.calls) {
    post(C.CALLS_API, { k: K.calls, a: 'boot' }).then(function (j) {
      if (j && j.ok) {
        callsWho = j.who || '';
        var n = (j.outbox || []).filter(function (x) { return x.status === 'draft'; }).length;
        state.calls = n ? plural(n, 'text waiting for your OK', 'texts waiting for your OK') : 'Calls, presets and history';
      }
    }).catch(function () {}).then(function () { callsDone = true; settle(); if (state.gate === 'roni') hint('calls', state.calls || 'Calls, presets and history'); });
  }
  if (!K.home && !K.calls) settle();
  draw();

  function toast(msg) { var d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }
  function sheet(html) { var s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + html + '</div>'; s.addEventListener('click', function (e) { if (e.target === s || e.target.getAttribute('data-close') != null) s.remove(); }); document.body.appendChild(s); }

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || state.gate !== 'roni') return;
    var act = b.getAttribute('data-act');
    if (act === 'steady') {
      if (/Android/i.test(navigator.userAgent)) {
        var left = false, onHide = function () { left = true; };
        document.addEventListener('visibilitychange', onHide, { once: true });
        location.href = 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=' + C.STEADY_PACKAGE + ';end';
        setTimeout(function () {
          if (left || document.hidden) return;
          sheet('<h2>Steady is its own app</h2><p>Open Steady from your home screen. It keeps everything on this phone, so this page never reads it.</p><button class="btn" data-close>OK</button>');
        }, 1500);
      } else location.href = C.APPS.steadyWeb;
      return;
    }
    if (act === 'copylink') {
      var parts = [];
      if (K.home) parts.push('home=' + encodeURIComponent(K.home));
      if (K.work) parts.push('work=' + encodeURIComponent(K.work));
      if (K.ttg) parts.push('ttg=' + encodeURIComponent(K.ttg));
      if (K.calls) parts.push('calls=' + encodeURIComponent(K.calls));
      if (!parts.length) { toast('Open each app once with its link first'); return; }
      var link = location.origin + location.pathname + '#' + parts.join('&');
      var missing = ['home', 'work', 'ttg', 'calls'].filter(function (x) { return !K[x]; });
      var done = function () { toast(missing.length ? 'Copied. Not in it yet: ' + missing.join(', ') : 'Copied. Keep it private, it signs in all four.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { toast('Could not copy on this browser'); });
      else toast('Could not copy on this browser');
      return;
    }
  });
})();
