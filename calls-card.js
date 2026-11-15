/* Calls card: the same Katya Calls system, shown inside Home and TTG Ops.
   - Loaded only after the host app decides this viewer may see it (Home: the portal flag from its server; TTG Ops: live mode).
   - Talks only to the Calls API with the Calls key already on this phone (localStorage 'calls.k'). No key: "Open Calls once to connect".
   - The Calls server checks the key on every request and answers only Roni's key. Any other key: the card removes itself.
   - Scheduled calls are one-off (today or tomorrow). If the scheduler is off, Set time says so and Call me now still works.
   No names, no numbers and no data are kept here; the list lives in memory only. */
(function () {
  'use strict';
  if (window.CallsCard) return;
  var API = 'https://script.google.com/macros/s/AKfycbzi_sFF-Nn1L_UGW16_GjWsVQpQ8XOQcc-n3iiD59ZEXygMSrRWWSM4pgM9dNY6ukET/exec';
  var CALLS_URL = '/calls/';
  var PRESETS = {
    home: [
      { id: 'wake', type: 'wake', label: 'Wake me up', time: '07:00', day: 'tomorrow' },
      { id: 'goodnight', type: 'goodnight', label: 'Goodnight', time: '22:30', day: 'today' }
    ],
    ttg: [
      { id: 'plan', type: 'plan', label: 'Plan the day', time: '09:00', day: 'tomorrow', note: 'Plan the day: go through today, the calendar and open items, and agree on the top three.' },
      { id: 'meeting', type: 'checkin', label: 'Check in before a meeting', time: '', day: 'today', note: 'Check in before a meeting: who it is with and what he wants out of it.', ask: 'Which meeting? (optional)' },
      { id: 'wrap', type: 'todo', label: 'End of day wrap', time: '17:30', day: 'today', note: 'End of day wrap: what got done today and what moves to tomorrow.' }
    ]
  };
  var S = { list: null, running: null, at: 0, loading: false, gone: false, err: '', busy: false, slots: {} };

  (function css() {
    if (document.querySelector('link[data-calls-card]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/hub/calls-card.css?v=1'; l.setAttribute('data-calls-card', '1');
    document.head.appendChild(l);
  })();

  function key() { try { return localStorage.getItem('calls.k') || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(a, d) {
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 30000);
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ k: key(), a: a }, d || {})),
      redirect: 'follow', referrerPolicy: 'no-referrer', credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(t); return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function srcOf(place, p) { return 'card:' + place + ':' + p.id; }
  function matches(place, p, it) {
    if (it.status !== 'scheduled') return false;
    var src = String(it.src || '');
    if (src === srcOf(place, p)) return true;
    return place === 'home' && it.type === p.type && src.indexOf('card:ttg:') !== 0;   // a wake-up set in the Calls app shows in Home too
  }
  function when(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var tz = 'America/New_York', day = function (x) { return x.toLocaleDateString('en-CA', { timeZone: tz }); };
    var now = new Date(), tm = new Date(now.getTime() + 864e5);
    var lbl = day(d) === day(now) ? 'Today' : day(d) === day(tm) ? 'Tomorrow' : d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
    return lbl + ' ' + d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  }

  function load(force) {
    if (!key() || S.gone || S.loading) return;
    if (!force && S.list && Date.now() - S.at < 60000) return;
    S.loading = true;
    api('callList').then(function (j) {
      if (j && j.ok) { S.list = j.scheduled || []; S.running = !!(j.scheduler && j.scheduler.running); S.err = ''; S.at = Date.now(); }
      else if (j && j.error === 'locked') { S.err = 'locked'; }
      else { S.gone = true; }                      // 'not allowed': not Roni's Calls key, so no card at all
    }).catch(function () { S.err = 'offline'; }).then(function () { S.loading = false; drawAll(); });
  }

  function draw(slot, place) {
    if (S.gone) { slot.innerHTML = ''; slot.hidden = true; return; }
    var head = '<div class="cc-head"><span class="cc-chip"><span class="cc-dot"></span>Calls</span><a class="cc-manage" href="' + CALLS_URL + '">Manage in Calls &rsaquo;</a></div>';
    if (!key() || S.err === 'locked') {
      slot.innerHTML = '<div class="cc-card">' + head + '<p class="cc-p">Open Calls once to connect. Katya\u2019s calls show up here after that.</p><a class="cc-btn cc-btn-p" href="' + CALLS_URL + '">Open Calls</a></div>';
      return;
    }
    var ps = PRESETS[place] || [];
    var rows = ps.map(function (p) {
      var it = (S.list || []).filter(function (x) { return matches(place, p, x); }).sort(function (a, b) { return a.at < b.at ? -1 : 1; })[0];
      var sub = !S.list ? (S.err ? 'Could not load' : 'Loading\u2026') : it ? esc(when(it.at)) + ' <button type="button" class="cc-link" data-cc="cancel" data-id="' + esc(it.id) + '">Cancel</button>' : 'Not set';
      var btn = S.running ? '<button type="button" class="cc-btn cc-btn-g" data-cc="set" data-p="' + p.id + '">Set time</button>' : '';
      return '<div class="cc-row"><div class="cc-grow"><div class="cc-t">' + esc(p.label) + '</div><div class="cc-s">' + sub + '</div></div>' + btn + '</div>';
    }).join('');
    var off = S.list && !S.running ? '<p class="cc-note">Set a time is off until scheduled calls are switched on. Call me now works.</p>' : '';
    slot.innerHTML = '<div class="cc-card">' + head + (place === 'ttg' ? '<div class="cc-title">Work calls</div>' : '') + rows + off +
      '<button type="button" class="cc-btn cc-btn-p cc-block" data-cc="now">Call me now</button>' +
      '<p class="cc-foot">Same calls as in Calls. Change one here and it changes there.</p></div>';
  }
  function drawAll() { Object.keys(S.slots).forEach(function (pl) { var s = S.slots[pl]; if (s && s.isConnected !== false) draw(s, pl); }); }

  function toast(m) { var d = document.createElement('div'); d.className = 'cc-toast'; d.setAttribute('role', 'status'); d.textContent = m; document.body.appendChild(d); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2800); }
  function sheet(html, onclick) {
    var bg = document.createElement('div'); bg.className = 'cc-sheet';
    bg.innerHTML = '<div class="cc-sheet-card" role="dialog" aria-modal="true">' + html + '</div>';
    function close() { if (bg.parentNode) bg.parentNode.removeChild(bg); }
    bg.addEventListener('click', function (e) {
      if (e.target === bg || (e.target.closest && e.target.closest('[data-close]'))) return close();
      onclick && onclick(e, bg, close);
    });
    document.body.appendChild(bg);
    var f = bg.querySelector('button,input'); if (f) try { f.focus(); } catch (x) {}
    return bg;
  }
  function chips(name, items, on) {
    return '<div class="cc-chips" role="radiogroup">' + items.map(function (x) { return '<button type="button" class="cc-c' + (x[0] === on ? ' on' : '') + '" role="radio" aria-checked="' + (x[0] === on) + '" data-' + name + '="' + esc(x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
  }
  function pick(bg, name, v) { bg.querySelectorAll('[data-' + name + ']').forEach(function (b) { var on = b.getAttribute('data-' + name) === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
  function noteFor(p, extra) { extra = String(extra || '').trim(); return (p.note || '') + (extra ? ' ' + extra : ''); }

  function callNowSheet(place) {
    var ps = PRESETS[place], cur = ps[0];
    var ask = function (p) { return p.ask ? '<input class="cc-in" id="ccAsk" maxlength="150" placeholder="' + esc(p.ask) + '">' : ''; };
    var bg = sheet('<h3 class="cc-h">Katya calls you now</h3><p class="cc-p">What is it about?</p>' + chips('kind', ps.map(function (p) { return [p.id, p.label]; }), cur.id) +
      '<div id="ccAskWrap">' + ask(cur) + '</div><p class="cc-err" id="ccErr" hidden></p><div class="cc-actions"><button type="button" class="cc-btn cc-btn-g" data-close>Cancel</button><button type="button" class="cc-btn cc-btn-p" data-go>Call me now</button></div>',
    function (e, bg, close) {
      var k = e.target.closest('[data-kind]');
      if (k) { cur = ps.filter(function (p) { return p.id === k.getAttribute('data-kind'); })[0] || cur; pick(bg, 'kind', cur.id); bg.querySelector('#ccAskWrap').innerHTML = ask(cur); return; }
      if (!e.target.closest('[data-go]') || S.busy) return;
      var a = bg.querySelector('#ccAsk'), btn = e.target.closest('[data-go]'), er = bg.querySelector('#ccErr');
      S.busy = true; btn.disabled = true;
      api('callNow', { type: cur.type, note: noteFor(cur, a && a.value) }).then(function (j) {
        if (j && j.ok) { close(); toast('Katya is calling you now.'); }
        else { er.hidden = false; er.textContent = (j && j.error) || 'Could not place the call.'; btn.disabled = false; }
      }).catch(function () { er.hidden = false; er.textContent = 'No connection. Nothing was called.'; btn.disabled = false; }).then(function () { S.busy = false; });
    });
    return bg;
  }
  function setSheet(place, pid) {
    var p = (PRESETS[place] || []).filter(function (x) { return x.id === pid; })[0]; if (!p) return;
    var day = p.day, t = p.time;
    if (!t) { var d = new Date(Date.now() + 36e5); t = ('0' + d.getHours()).slice(-2) + ':00'; }
    return sheet('<div class="cc-head"><span class="cc-chip"><span class="cc-dot"></span>Calls</span></div><h3 class="cc-h">' + esc(p.label) + ' at</h3>' +
      chips('day', [['today', 'Today'], ['tomorrow', 'Tomorrow']], day) +
      '<input class="cc-in cc-time" id="ccTime" type="time" value="' + esc(t) + '" aria-label="Time">' + (p.ask ? '<input class="cc-in" id="ccAsk" maxlength="150" placeholder="' + esc(p.ask) + '">' : '') +
      '<p class="cc-note">It shows in Calls too. Katya does not call on Shabbat or Yom Tov.</p><p class="cc-err" id="ccErr" hidden></p>' +
      '<div class="cc-actions"><button type="button" class="cc-btn cc-btn-g" data-close>Cancel</button><button type="button" class="cc-btn cc-btn-p" data-save>Save</button></div>',
    function (e, bg, close) {
      var dd = e.target.closest('[data-day]'); if (dd) { day = dd.getAttribute('data-day'); pick(bg, 'day', day); return; }
      if (!e.target.closest('[data-save]') || S.busy) return;
      var tm = bg.querySelector('#ccTime').value, a = bg.querySelector('#ccAsk'), er = bg.querySelector('#ccErr'), btn = e.target.closest('[data-save]');
      if (!/^\d{1,2}:\d{2}$/.test(tm)) { er.hidden = false; er.textContent = 'Pick a time'; return; }
      S.busy = true; btn.disabled = true;
      api('callSchedule', { type: p.type, note: noteFor(p, a && a.value), day: day, time: tm, src: srcOf(place, p) }).then(function (j) {
        if (j && j.ok) { S.list = j.scheduled || S.list; S.at = Date.now(); close(); toast('Saved. It shows in Calls too.'); drawAll(); }
        else { er.hidden = false; er.textContent = (j && j.error) || 'Could not save.'; btn.disabled = false; if (j && /not switched on/.test(j.error || '')) { S.running = false; drawAll(); } }
      }).catch(function () { er.hidden = false; er.textContent = 'No connection. Nothing was scheduled.'; btn.disabled = false; }).then(function () { S.busy = false; });
    });
  }
  function cancel(id, btn) {
    if (S.busy) return; S.busy = true; btn.disabled = true;
    api('callCancel', { id: id }).then(function (j) {
      if (j && j.ok) { S.list = j.scheduled || []; S.at = Date.now(); toast('Canceled. Katya will not call.'); }
      else toast((j && j.error) || 'Could not cancel.');
    }).catch(function () { toast('No connection. Nothing changed.'); }).then(function () { S.busy = false; drawAll(); });
  }

  window.CallsCard = {
    mount: function (slot, place) {
      if (!slot || !PRESETS[place]) return;
      S.slots[place] = slot;
      if (!slot._cc) {
        slot._cc = 1;
        slot.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('[data-cc]'); if (!b) return;
          var a = b.getAttribute('data-cc');
          if (a === 'now') callNowSheet(place);
          else if (a === 'set') setSheet(place, b.getAttribute('data-p'));
          else if (a === 'cancel') cancel(b.getAttribute('data-id'), b);
        });
      }
      slot.hidden = false;
      draw(slot, place); load(false);
    },
    _state: S, _presets: PRESETS
  };
})();
