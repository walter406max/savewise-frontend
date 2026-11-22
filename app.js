/* SaveWise - app.js */
(function () {
  'use strict';

  const TOKEN_KEY = 'sw_token', USER_KEY = 'sw_user';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toDate = (d) => new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
  const fmtDate = (d) => toDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtDateTime = (d) => toDate(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const pad = (n) => String(n).padStart(2, '0');
  const round2 = (n) => Math.round(n * 100) / 100;

  /* ---------- icons ---------- */
  const PATHS = {
    logo: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20h14V9.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    down: '<path d="M12 4v13"/><path d="M6 12l6 6 6-6"/>',
    up: '<path d="M12 20V7"/><path d="M6 12l6-6 6 6"/>',
    repeat: '<path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 20v-5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
  };
  const ico = (n, s) => '<svg class="ic" viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[n] || '') + '</svg>';
  const hydrate = () => $$('[data-ic]').forEach((el) => { el.innerHTML = ico(el.dataset.ic, el.dataset.s); });

  /* ---------- session ---------- */
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  function saveSession(d) { localStorage.setItem(TOKEN_KEY, d.token); localStorage.setItem(USER_KEY, JSON.stringify(d.user)); }
  function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.href = 'index.html'; }

  /* ---------- API ---------- */
  async function api(path, method, body) {
    if (typeof API_URL === 'undefined' || API_URL.indexOf('YOUR-BACKEND') !== -1) {
      throw new Error('API_URL is not set in config.js.');
    }
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(API_URL.replace(/\/$/, '') + path, {
        method: method || 'GET', headers, body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* no json */ }
    if (res.status === 401 && token) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  /* ---------- UI helpers ---------- */
  let loaderTimer;
  function setLoading(on) {
    const el = $('#loader'); if (!el) return;
    clearTimeout(loaderTimer);
    el.classList.toggle('show', on);
    $('#loaderHint').textContent = '';
    if (on) loaderTimer = setTimeout(() => { $('#loaderHint').textContent = 'The server is starting up. This can take up to a minute.'; }, 4000);
  }

  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  async function act(btn, fn) {
    const old = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Please wait';
    try { await fn(); } catch (e) { toast(e.message, 'err'); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  }

  function showFatal(msg) {
    const m = $('main') || document.body;
    m.insertAdjacentHTML('afterbegin', '<section class="card err-card"><h3>Could not load this page</h3><p class="muted">' + esc(msg) + '</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></section>');
  }

  async function boot(fn) {
    setLoading(true);
    try { await fn(); } catch (e) { if (e.message !== 'Session expired') showFatal(e.message); }
    finally { setLoading(false); }
  }

  function openSheet(cfg) {
    const root = $('#sheet');
    const vals = {};
    let h = '<div class="sheet-box"><div class="sheet-handle"></div><h3>' + esc(cfg.title) + '</h3>';
    if (cfg.note) h += '<p class="muted sheet-note">' + cfg.note + '</p>';
    (cfg.fields || []).forEach((f) => {
      h += '<label class="lbl">' + esc(f.label) + '</label>';
      if (f.type === 'segment') {
        vals[f.id] = f.value;
        h += '<div class="seg" data-seg="' + f.id + '">' + f.options.map((o) =>
          '<button type="button" data-v="' + esc(o.value) + '" class="' + (String(o.value) === String(f.value) ? 'on' : '') + '">' + esc(o.label) + '</button>').join('') + '</div>';
      } else {
        const num = f.type === 'number';
        h += '<input class="input" id="f_' + f.id + '" type="' + (f.type || 'text') + '"' +
          (num ? ' inputmode="decimal" step="0.01" min="0.01"' : '') + (f.min ? ' min="' + f.min + '"' : '') +
          ' placeholder="' + esc(f.placeholder || '') + '" value="' + esc(f.value || '') + '" autocomplete="off">';
      }
    });
    h += '<div class="form-err" id="sheetErr"></div><button class="btn ' + (cfg.danger ? 'btn-danger' : 'btn-primary') + '" id="sheetGo">' + esc(cfg.submit) + '</button><button class="btn btn-quiet" id="sheetCancel">Cancel</button></div>';
    root.innerHTML = h;
    root.classList.add('show');
    const close = () => { root.classList.remove('show'); root.innerHTML = ''; };
    root.onclick = (e) => { if (e.target === root) close(); };
    $('#sheetCancel').onclick = close;
    $$('.seg', root).forEach((seg) => {
      seg.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        $$('button', seg).forEach((x) => x.classList.remove('on'));
        b.classList.add('on'); vals[seg.dataset.seg] = b.dataset.v;
      };
    });
    root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') $('#sheetGo').click(); };
    const first = $('input', root); if (first) setTimeout(() => first.focus(), 250);
    $('#sheetGo').onclick = async () => {
      (cfg.fields || []).forEach((f) => { if (f.type !== 'segment') vals[f.id] = $('#f_' + f.id).value.trim(); });
      const go = $('#sheetGo'), label = go.textContent;
      go.disabled = true; go.textContent = 'Please wait'; $('#sheetErr').textContent = '';
      try { await cfg.onSubmit(vals); close(); }
      catch (e) { $('#sheetErr').textContent = e.message; go.disabled = false; go.textContent = label; }
    };
  }

  /* ---------- shared renderers ---------- */
  const TX = {
    deposit: { ic: 'down', label: 'Deposit', sign: 1, tone: 't-goal' },
    withdraw: { ic: 'up', label: 'Withdrawal', sign: -1, tone: 't-out' },
    autosave: { ic: 'repeat', label: 'Autosave', sign: 1, tone: 't-flex' },
    interest: { ic: 'plus', label: 'Interest', sign: 1, tone: 't-neu' },
    safelock_lock: { ic: 'lock', label: 'SafeLock', sign: 0, tone: 't-lock' },
    safelock_unlock: { ic: 'unlock', label: 'SafeLock released', sign: 0, tone: 't-lock' },
    goal_deposit: { ic: 'target', label: 'Goal deposit', sign: 0, tone: 't-goal' },
    goal_refund: { ic: 'target', label: 'Goal refund', sign: 0, tone: 't-neu' },
  };
  function txHtml(t) {
    const m = TX[t.type] || { ic: 'wallet', label: t.type, sign: 0, tone: 't-neu' };
    const cls = m.sign > 0 ? 'pos' : m.sign < 0 ? 'neg' : '';
    const sign = m.sign > 0 ? '+' : m.sign < 0 ? '-' : '';
    return '<div class="row"><span class="row-ic ' + m.tone + '">' + ico(m.ic, 20) + '</span><span class="row-main"><b>' + esc(m.label) + '</b><small>' + esc(t.description || '') + '</small><small>' + fmtDateTime(t.created_at) + '</small></span><span class="row-end ' + cls + '">' + sign + money(t.amount) + '</span></div>';
  }
  const txList = (list) => list.length ? list.map(txHtml).join('') : '<div class="empty"><p>No transactions yet</p><small>Your deposits and transfers will show up here.</small></div>';

  function navRow(href, tone, icon, title, sub, amount) {
    return '<a class="row" href="' + href + '"><span class="row-ic ' + tone + '">' + ico(icon, 20) + '</span><span class="row-main"><b>' + title + '</b><small>' + sub + '</small></span><span class="row-end">' + money(amount) + ico('chev', 16) + '</span></a>';
  }
  function progressRow(label, sub, pct) {
    return '<div class="prow"><div class="prow-top"><b>' + esc(label) + '</b><span>' + esc(sub) + '</span></div><div class="track"><div class="fill' + (pct >= 100 ? ' done' : '') + '" style="width:' + pct + '%"></div></div></div>';
  }
  function lockPct(l) {
    const s = new Date(l.start_date), e = new Date(l.end_date);
    return Math.max(0, Math.min(100, Math.round((Date.now() - s) / (e - s) * 100)));
  }
  function fmtCountdown(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 86400) + 'd ' + pad(Math.floor(s % 86400 / 3600)) + 'h ' + pad(Math.floor(s % 3600 / 60)) + 'm ' + pad(s % 60) + 's';
  }
  let cdTimer; const seen = {};
  function startCountdowns(onZero) {
    clearInterval(cdTimer);
    const tick = () => $$('[data-end]').forEach((el) => {
      const ms = new Date(el.dataset.end) - Date.now();
      el.textContent = ms > 0 ? fmtCountdown(ms) : 'Unlocked';
      if (ms <= 0 && el.dataset.locked === '1' && !seen[el.dataset.id]) { seen[el.dataset.id] = true; if (onZero) onZero(); }
    });
    tick(); cdTimer = setInterval(tick, 1000);
  }

  /* ---------- LOGIN ---------- */
  function initLogin() {
    if (getToken()) { location.replace('dashboard.html'); return; }
    let mode = 'login';
    const setMode = (m) => {
      mode = m;
      $$('#authTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
      $('#nameField').style.display = m === 'register' ? 'block' : 'none';
      $('#password').autocomplete = m === 'register' ? 'new-password' : 'current-password';
      $('#authSubmit').textContent = m === 'register' ? 'Create account' : 'Sign in';
      $('#authErr').textContent = '';
    };
    $('#authTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#authSubmit'), label = btn.textContent;
      const body = { email: $('#email').value.trim(), password: $('#password').value };
      if (mode === 'register') body.full_name = $('#full_name').value.trim();
      btn.disabled = true; btn.textContent = 'Please wait'; $('#authErr').textContent = '';
      const hint = setTimeout(() => { $('#authHint').textContent = 'The server is starting up. This can take up to a minute.'; }, 4000);
      try {
        const res = await api('/api/auth/' + mode, 'POST', body);
        saveSession(res);
        location.href = 'dashboard.html';
      } catch (err) {
        $('#authErr').textContent = err.message;
        btn.disabled = false; btn.textContent = label;
      } finally { clearTimeout(hint); $('#authHint').textContent = ''; }
    };
  }

  /* ---------- DASHBOARD ---------- */
  function initDashboard() {
    const load = async () => {
      const d = await api('/api/wallet/summary');
      const w = d.wallets;
      $('#totalBalance').textContent = money(d.total_balance);
      $('#stAvail').textContent = money(w.flex.balance);
      $('#stLocked').textContent = money(w.safelock.total);
      $('#stGoals').textContent = money(w.goals.total);
      $('#wallets').innerHTML =
        navRow('wallet.html', 't-flex', 'wallet', 'Flex Wallet', 'Available any time', w.flex.balance) +
        navRow('safelock.html', 't-lock', 'lock', 'SafeLock', w.safelock.count + ' active', w.safelock.total) +
        navRow('goals.html', 't-goal', 'target', 'Target Savings', w.goals.count + (w.goals.count === 1 ? ' goal' : ' goals'), w.goals.total);
      const rows = d.goals.map((g) => progressRow(g.name, money(g.saved_amount) + ' of ' + money(g.target_amount), g.percent))
        .concat(d.safelocks.map((l) => progressRow(money(l.amount) + ' SafeLock', l.days_left + (l.days_left === 1 ? ' day left' : ' days left'), lockPct(l))));
      $('#progress').innerHTML = rows.length ? rows.join('') : '<div class="empty"><p>Nothing in progress</p><small>Create a goal or lock some money to track it here.</small></div>';
      $('#recentTx').innerHTML = txList(d.recent_transactions);
    };
    boot(load);
  }

  /* ---------- WALLET ---------- */
  function initWallet() {
    let flex = 0;
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const load = async () => {
      const s = await api('/api/wallet/summary');
      flex = s.wallets.flex.balance;
      $('#flexBalance').textContent = money(flex);
      const [a, t] = await Promise.all([api('/api/wallet/autosave'), api('/api/wallet/transactions?limit=100')]);
      $('#rules').innerHTML = a.rules.length ? a.rules.map((r) =>
        '<div class="row"><span class="row-ic t-flex">' + ico('repeat', 20) + '</span><span class="row-main"><b>' + money(r.amount) + ' ' + cap(r.frequency).toLowerCase() + '</b><small>Next: ' + fmtDate(r.next_run) + '</small></span><button class="btn btn-danger-soft btn-sm" data-stop="' + r.id + '">Stop</button></div>').join('')
        : '<div class="empty"><p>No autosave rules</p><small>Set one up and save on a schedule.</small></div>';
      $('#txList').innerHTML = txList(t.transactions);
    };
    $('#depBtn').onclick = () => openSheet({
      title: 'Deposit', note: 'Adds demo funds to your Flex wallet.', submit: 'Deposit',
      fields: [{ id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' }],
      onSubmit: async (v) => { const r = await api('/api/wallet/deposit', 'POST', { amount: v.amount }); toast(r.message, 'ok'); await load(); },
    });
    $('#wdBtn').onclick = () => openSheet({
      title: 'Withdraw', note: 'Available: <b>' + money(flex) + '</b>', submit: 'Withdraw',
      fields: [{ id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' }],
      onSubmit: async (v) => { const r = await api('/api/wallet/withdraw', 'POST', { amount: v.amount }); toast(r.message, 'ok'); await load(); },
    });
    $('#newRule').onclick = () => openSheet({
      title: 'New autosave rule', submit: 'Start autosave',
      note: 'Money moves into your Flex wallet on schedule. Rules are applied whenever you open the app.',
      fields: [
        { id: 'amount', label: 'Amount each time (USD)', type: 'number', placeholder: '0.00' },
        { id: 'frequency', label: 'Frequency', type: 'segment', value: 'weekly', options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }] },
      ],
      onSubmit: async (v) => { const r = await api('/api/wallet/autosave', 'POST', { amount: v.amount, frequency: v.frequency }); toast(r.message, 'ok'); await load(); },
    });
    $('#rules').onclick = (e) => {
      const b = e.target.closest('[data-stop]'); if (!b) return;
      act(b, async () => { await api('/api/wallet/autosave/' + b.dataset.stop, 'DELETE'); toast('Autosave stopped', 'ok'); await load(); });
    };
    boot(load);
  }

  /* ---------- GOALS ---------- */
  function initGoals() {
    let flex = 0, goals = [];
    const goalCard = (g) => {
      const done = g.saved_amount >= g.target_amount;
      const when = g.days_left < 0 ? 'Deadline passed' : g.days_left === 0 ? 'Due today' : g.days_left + (g.days_left === 1 ? ' day left' : ' days left');
      return '<section class="card"><div class="split"><div><h3>' + esc(g.name) + '</h3><small>Target ' + money(g.target_amount) + ' · due ' + fmtDate(g.deadline) + '</small></div><span class="pct">' + g.percent + '%</span></div>' +
        '<div class="track"><div class="fill' + (done ? ' done' : '') + '" style="width:' + g.percent + '%"></div></div>' +
        '<div class="meta"><span><b>' + money(g.saved_amount) + '</b> saved</span>' + (done ? '<span class="tag ok">Goal reached</span>' : '<span>' + when + '</span>') + '</div>' +
        '<div class="btnrow">' + (done ? '' : '<button class="btn btn-primary btn-sm" data-act="add" data-id="' + g.id + '">Add money</button>') +
        '<button class="btn btn-danger-soft btn-sm" data-act="del" data-id="' + g.id + '">Remove</button></div></section>';
    };
    const load = async () => {
      const d = await api('/api/goals');
      flex = d.flex_balance; goals = d.goals;
      $('#goalsTotal').textContent = money(round2(goals.reduce((s, g) => s + g.saved_amount, 0)));
      $('#goalsCount').textContent = goals.length + (goals.length === 1 ? ' goal' : ' goals');
      $('#goalList').innerHTML = goals.length ? goals.map(goalCard).join('') : '<div class="card empty"><p>No goals yet</p><small>Create a goal to start saving toward it.</small></div>';
    };
    $('#newGoal').onclick = () => openSheet({
      title: 'New goal', submit: 'Create goal',
      fields: [
        { id: 'name', label: 'Goal name', placeholder: 'e.g. Laptop' },
        { id: 'target', label: 'Target amount (USD)', type: 'number', placeholder: '0.00' },
        { id: 'deadline', label: 'Deadline', type: 'date', min: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
      ],
      onSubmit: async (v) => { const r = await api('/api/goals', 'POST', { name: v.name, target_amount: v.target, deadline: v.deadline }); toast(r.message, 'ok'); await load(); },
    });
    $('#goalList').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const g = goals.find((x) => x.id === Number(b.dataset.id)); if (!g) return;
      if (b.dataset.act === 'add') {
        const left = round2(g.target_amount - g.saved_amount);
        openSheet({
          title: 'Add to ' + esc(g.name), submit: 'Add money',
          note: 'Comes from your Flex wallet (<b>' + money(flex) + '</b>). <b>' + money(left) + '</b> left to reach the target.',
          fields: [{ id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' }],
          onSubmit: async (v) => { const r = await api('/api/goals/' + g.id + '/deposit', 'POST', { amount: v.amount }); toast(r.message, 'ok'); await load(); },
        });
      } else {
        openSheet({
          title: 'Remove this goal?', danger: true, submit: 'Remove goal',
          note: 'The ' + money(g.saved_amount) + ' saved in "' + esc(g.name) + '" will return to your Flex wallet.',
          onSubmit: async () => { await api('/api/goals/' + g.id, 'DELETE'); toast('Goal removed', 'ok'); await load(); },
        });
      }
    };
    boot(load);
  }

  /* ---------- SAFELOCK ---------- */
  function initSafelock() {
    let flex = 0;
    const lockCard = (l) =>
      '<section class="card"><div class="split"><div><small>Locked amount</small><div class="figure">' + money(l.amount) + '</div></div><span class="tag">' + l.lock_days + ' days</span></div>' +
      '<small>Time remaining</small><div class="countdown" data-end="' + l.end_date + '" data-id="' + l.id + '" data-locked="' + (l.can_withdraw ? '0' : '1') + '"></div>' +
      '<div class="track"><div class="fill" style="width:' + lockPct(l) + '%"></div></div>' +
      '<div class="meta"><span>Unlocks ' + fmtDate(l.end_date) + '</span></div>' +
      (l.can_withdraw
        ? '<button class="btn btn-primary" data-w="' + l.id + '">Withdraw ' + money(l.amount) + '</button>'
        : '<button class="btn btn-soft" disabled>' + ico('lock', 18) + 'Locked until ' + fmtDate(l.end_date) + '</button>') + '</section>';
    const pastRow = (l) => '<div class="row"><span class="row-ic t-lock">' + ico('unlock', 20) + '</span><span class="row-main"><b>' + money(l.amount) + '</b><small>' + l.lock_days + ' days · released ' + fmtDate(l.end_date) + '</small></span></div>';

    const load = async () => {
      const [s, d] = await Promise.all([api('/api/wallet/summary'), api('/api/wallet/safelock')]);
      flex = s.wallets.flex.balance;
      const active = d.safelocks.filter((l) => l.status === 'active');
      const past = d.safelocks.filter((l) => l.status !== 'active');
      $('#lockTotal').textContent = money(s.wallets.safelock.total);
      $('#lockCount').textContent = active.length + (active.length === 1 ? ' active lock' : ' active locks');
      $('#lockList').innerHTML = active.length ? active.map(lockCard).join('') : '<div class="card empty"><p>Nothing locked</p><small>Lock money for 30, 60 or 90 days to keep it out of reach.</small></div>';
      $('#pastCard').style.display = past.length ? 'block' : 'none';
      $('#pastList').innerHTML = past.map(pastRow).join('');
      startCountdowns(load);
    };
    $('#lockBtn').onclick = () => openSheet({
      title: 'Lock money', submit: 'Lock funds',
      note: 'Available in Flex wallet: <b>' + money(flex) + '</b>. Locked funds cannot be withdrawn before the unlock date.',
      fields: [
        { id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' },
        { id: 'days', label: 'Lock period', type: 'segment', value: '30', options: [{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }] },
      ],
      onSubmit: async (v) => { const r = await api('/api/wallet/safelock', 'POST', { amount: v.amount, days: Number(v.days) }); toast(r.message, 'ok'); await load(); },
    });
    $('#lockList').onclick = (e) => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      act(b, async () => { const r = await api('/api/wallet/safelock/' + b.dataset.w + '/withdraw', 'POST'); toast(r.message, 'ok'); await load(); });
    };
    boot(load);
  }

  /* ---------- START ---------- */
  function shell(page) {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="toasts"></div><div id="sheet" class="sheet"></div>' +
      '<div id="loader" class="loader"><div class="spinner"></div><p id="loaderHint"></p></div>');
    const nav = $('#nav');
    if (nav) {
      const items = [['dashboard', 'dashboard.html', 'home', 'Home'], ['wallet', 'wallet.html', 'wallet', 'Wallet'], ['goals', 'goals.html', 'target', 'Goals'], ['safelock', 'safelock.html', 'lock', 'SafeLock']];
      nav.innerHTML = items.map((i) => '<a href="' + i[1] + '" class="' + (i[0] === page ? 'on' : '') + '">' + ico(i[2], 22) + i[3] + '</a>').join('');
    }
    hydrate();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    shell(page);
    if (page === 'login') return initLogin();
    if (!getToken()) { location.replace('index.html'); return; }
    const lo = $('#logoutBtn'); if (lo) lo.onclick = logout;
    const pages = { dashboard: initDashboard, wallet: initWallet, goals: initGoals, safelock: initSafelock };
    if (pages[page]) pages[page]();
  });
})();
