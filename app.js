/* SaveWise - app.js (used by every page) */
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

  /* ---------- session ---------- */
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } };
  function saveSession(d) { localStorage.setItem(TOKEN_KEY, d.token); localStorage.setItem(USER_KEY, JSON.stringify(d.user)); }
  function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.href = 'index.html'; }

  /* ---------- API ---------- */
  async function api(path, method, body) {
    if (typeof API_URL === 'undefined' || API_URL.indexOf('YOUR-BACKEND') !== -1) {
      throw new Error('Open config.js and set API_URL to your Render backend URL.');
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
      throw new Error('Cannot reach the server. Check API_URL in config.js, or wait a minute and try again.');
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
    if (on) loaderTimer = setTimeout(() => { $('#loaderHint').textContent = 'Waking up the server... free hosting can take up to a minute the first time.'; }, 4000);
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
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Please wait...';
    try { await fn(); } catch (e) { toast(e.message, 'err'); }
    finally { btn.disabled = false; btn.textContent = old; }
  }

  function showFatal(msg) {
    const m = $('main') || document.body;
    m.insertAdjacentHTML('afterbegin', '<section class="card err-card"><h3>😕 Could not load</h3><p class="muted">' + esc(msg) + '</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></section>');
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
    h += '<div class="form-err" id="sheetErr"></div><button class="btn ' + (cfg.danger ? 'btn-danger' : 'btn-primary') + '" id="sheetGo">' + esc(cfg.submit) + '</button><button class="btn btn-text" id="sheetCancel">Cancel</button></div>';
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
      go.disabled = true; go.textContent = 'Please wait...'; $('#sheetErr').textContent = '';
      try { await cfg.onSubmit(vals); close(); }
      catch (e) { $('#sheetErr').textContent = e.message; go.disabled = false; go.textContent = label; }
    };
  }

  /* ---------- shared renderers ---------- */
  const TX = {
    deposit: { icon: '⬇️', label: 'Deposit', sign: 1 },
    withdraw: { icon: '⬆️', label: 'Withdrawal', sign: -1 },
    interest: { icon: '✨', label: 'Interest', sign: 1 },
    autosave: { icon: '🔁', label: 'Autosave', sign: 1 },
    safelock_lock: { icon: '🔒', label: 'SafeLock locked', sign: 0 },
    safelock_unlock: { icon: '🔓', label: 'SafeLock unlocked', sign: 0 },
    goal_deposit: { icon: '🎯', label: 'Goal deposit', sign: 0 },
    goal_refund: { icon: '↩️', label: 'Goal refund', sign: 0 },
  };
  function txHtml(t) {
    const m = TX[t.type] || { icon: '💵', label: t.type, sign: 0 };
    const cls = m.sign > 0 ? 'pos' : m.sign < 0 ? 'neg' : 'neu';
    const sign = m.sign > 0 ? '+' : m.sign < 0 ? '-' : '';
    return '<div class="tx"><div class="tx-ic ' + cls + '">' + m.icon + '</div><div class="tx-mid"><b>' + esc(m.label) + '</b><small>' + esc(t.description || '') + '</small><small>' + fmtDateTime(t.created_at) + '</small></div><div class="tx-amt ' + cls + '">' + sign + money(t.amount) + '</div></div>';
  }
  const txList = (list) => list.length ? list.map(txHtml).join('') : '<div class="empty">No transactions yet. Make your first deposit! 💸</div>';

  function walletTile(href, cls, icon, name, sub, amount) {
    return '<a class="wtile ' + cls + '" href="' + href + '"><div class="wt-ic">' + icon + '</div><div class="wt-mid"><b>' + name + '</b><small>' + sub + '</small></div><div class="wt-amt">' + money(amount) + '</div></a>';
  }
  function progressRow(label, sub, pct) {
    return '<div class="prow"><div class="prow-top"><b>' + esc(label) + '</b><span>' + pct + '%</span></div><div class="progress"><div class="bar" style="width:' + pct + '%"></div></div><small>' + esc(sub) + '</small></div>';
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
      el.textContent = ms > 0 ? fmtCountdown(ms) : '🔓 Unlocked';
      if (ms <= 0 && el.dataset.locked === '1' && !seen[el.dataset.id]) { seen[el.dataset.id] = true; if (onZero) onZero(); }
    });
    tick(); cdTimer = setInterval(tick, 1000);
  }

  const claimInterest = (load) => async () => {
    const r = await api('/api/wallet/claim-interest', 'POST');
    toast(r.message, 'ok');
    await load();
  };

  /* ---------- LOGIN PAGE ---------- */
  function initLogin() {
    if (getToken()) { location.replace('dashboard.html'); return; }
    let mode = 'login';
    const setMode = (m) => {
      mode = m;
      $$('#authTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
      $('#nameField').style.display = m === 'register' ? 'block' : 'none';
      $('#password').autocomplete = m === 'register' ? 'new-password' : 'current-password';
      $('#authSubmit').textContent = m === 'register' ? 'Create account' : 'Log in';
      $('#authErr').textContent = '';
    };
    $('#authTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#authSubmit'), label = btn.textContent;
      const body = { email: $('#email').value.trim(), password: $('#password').value };
      if (mode === 'register') body.full_name = $('#full_name').value.trim();
      btn.disabled = true; btn.textContent = 'Please wait...'; $('#authErr').textContent = '';
      const hint = setTimeout(() => { $('#authHint').textContent = 'Waking up the server... this can take up to a minute the first time.'; }, 4000);
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
      $('#totalInterest').textContent = money(d.total_interest);
      $('#pendingInterest').textContent = money(d.pending_interest);
      $('#wallets').innerHTML =
        walletTile('wallet.html', 't-flex', '💳', 'Flex Wallet', 'Withdraw anytime · ' + w.flex.rate + '% p.a.', w.flex.balance) +
        walletTile('safelock.html', 't-lock', '🔒', 'SafeLock', w.safelock.count + ' active · ' + w.safelock.rate + '% p.a.', w.safelock.total) +
        walletTile('goals.html', 't-goal', '🎯', 'Target Savings', w.goals.count + (w.goals.count === 1 ? ' goal' : ' goals'), w.goals.total);
      const rows = d.goals.map((g) => progressRow('🎯 ' + g.name, money(g.saved_amount) + ' of ' + money(g.target_amount), g.percent))
        .concat(d.safelocks.map((l) => progressRow('🔒 ' + money(l.amount) + ' SafeLock', l.days_left + ' day(s) left', lockPct(l))));
      $('#progress').innerHTML = rows.length ? rows.join('') : '<div class="empty">No goals or locks yet.<br><a class="btn btn-ghost btn-sm" href="goals.html">Create a goal</a></div>';
      $('#recentTx').innerHTML = txList(d.recent_transactions);
    };
    $('#claimBtn').onclick = (e) => act(e.currentTarget, claimInterest(load));
    boot(load);
  }

  /* ---------- WALLET ---------- */
  function initWallet() {
    let flex = 0, rate = 5;
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    const calc = () => {
      const amt = parseFloat($('#calcAmt').value) || 0;
      const days = parseFloat($('#calcDays').value) || 0;
      const interest = amt * (rate / 100) * days / 365; // balance * rate * days / 365
      $('#calcInterest').textContent = money(interest);
      $('#calcTotal').textContent = money(amt + interest);
    };

    const load = async () => {
      const s = await api('/api/wallet/summary');
      flex = s.wallets.flex.balance;
      $('#flexBalance').textContent = money(flex);
      $('#pending').textContent = money(s.pending_interest);
      const [a, t] = await Promise.all([api('/api/wallet/autosave'), api('/api/wallet/transactions?limit=100')]);
      $('#rules').innerHTML = a.rules.length ? a.rules.map((r) =>
        '<div class="rule"><div><b>' + money(r.amount) + '</b><span class="badge">' + cap(r.frequency) + '</span><small>Next save: ' + fmtDate(r.next_run) + '</small></div><button class="btn btn-soft-red btn-sm" data-stop="' + r.id + '">Stop</button></div>').join('')
        : '<div class="empty">No autosave rules yet. Set one and save without thinking about it. 🔁</div>';
      $('#txList').innerHTML = txList(t.transactions);
      calc();
    };

    $('#depBtn').onclick = () => openSheet({
      title: 'Deposit money', note: 'Adds demo money to your Flex wallet.', submit: 'Deposit',
      fields: [{ id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' }],
      onSubmit: async (v) => { const r = await api('/api/wallet/deposit', 'POST', { amount: v.amount }); toast(r.message, 'ok'); await load(); },
    });
    $('#wdBtn').onclick = () => openSheet({
      title: 'Withdraw money', note: 'Available: <b>' + money(flex) + '</b>', submit: 'Withdraw',
      fields: [{ id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' }],
      onSubmit: async (v) => { const r = await api('/api/wallet/withdraw', 'POST', { amount: v.amount }); toast(r.message, 'ok'); await load(); },
    });
    $('#claimBtn').onclick = (e) => act(e.currentTarget, claimInterest(load));
    $('#newRule').onclick = () => openSheet({
      title: 'New autosave rule', submit: 'Start autosave',
      note: 'Money is added to your Flex wallet on schedule. Rules are applied when you open the app.',
      fields: [
        { id: 'amount', label: 'Amount each time (USD)', type: 'number', placeholder: '0.00' },
        { id: 'frequency', label: 'How often', type: 'segment', value: 'weekly', options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }] },
      ],
      onSubmit: async (v) => { const r = await api('/api/wallet/autosave', 'POST', { amount: v.amount, frequency: v.frequency }); toast(r.message, 'ok'); await load(); },
    });
    $('#rules').onclick = (e) => {
      const b = e.target.closest('[data-stop]'); if (!b) return;
      act(b, async () => { await api('/api/wallet/autosave/' + b.dataset.stop, 'DELETE'); toast('Autosave stopped', 'ok'); await load(); });
    };
    $('#calcRate').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#calcRate button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); rate = Number(b.dataset.rate); calc();
    };
    $('#calcAmt').oninput = calc; $('#calcDays').oninput = calc;
    boot(load);
  }

  /* ---------- GOALS ---------- */
  function initGoals() {
    let flex = 0, goals = [];
    const goalCard = (g) => {
      const done = g.saved_amount >= g.target_amount;
      const when = g.days_left < 0 ? 'Deadline passed' : g.days_left === 0 ? 'Due today' : g.days_left + ' day' + (g.days_left === 1 ? '' : 's') + ' left';
      return '<section class="card goal"><div class="goal-top"><div><h3>' + esc(g.name) + '</h3><small>Target ' + money(g.target_amount) + ' · by ' + fmtDate(g.deadline) + '</small></div><div class="pct">' + g.percent + '%</div></div>' +
        '<div class="progress"><div class="bar" style="width:' + g.percent + '%"></div></div>' +
        '<div class="goal-meta"><span><b>' + money(g.saved_amount) + '</b> saved</span>' + (done ? '<span class="badge done">🎉 Goal reached</span>' : '<span>⏳ ' + when + '</span>') + '</div>' +
        '<div class="goal-actions">' + (done ? '' : '<button class="btn btn-primary btn-sm" data-act="add" data-id="' + g.id + '">Add money</button>') +
        '<button class="btn btn-soft-red btn-sm" data-act="del" data-id="' + g.id + '">Remove</button></div></section>';
    };
    const load = async () => {
      const d = await api('/api/goals');
      flex = d.flex_balance; goals = d.goals;
      $('#goalsTotal').textContent = money(round2(goals.reduce((s, g) => s + g.saved_amount, 0)));
      $('#goalsCount').textContent = goals.length + (goals.length === 1 ? ' goal' : ' goals');
      $('#goalList').innerHTML = goals.length ? goals.map(goalCard).join('') : '<div class="card empty">You have no goals yet.<br>Save for a phone, rent, a trip... 🎯</div>';
    };
    $('#newGoal').onclick = () => openSheet({
      title: 'New savings goal', submit: 'Create goal',
      fields: [
        { id: 'name', label: 'Goal name', placeholder: 'e.g. New laptop' },
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
          title: 'Add to ' + g.name, submit: 'Add money',
          note: 'Comes from your Flex wallet (<b>' + money(flex) + '</b>). You need <b>' + money(left) + '</b> more.',
          fields: [{ id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' }],
          onSubmit: async (v) => { const r = await api('/api/goals/' + g.id + '/deposit', 'POST', { amount: v.amount }); toast(r.message, 'ok'); await load(); },
        });
      } else {
        openSheet({
          title: 'Remove this goal?', danger: true, submit: 'Yes, remove',
          note: 'Any money saved in "' + esc(g.name) + '" (' + money(g.saved_amount) + ') goes back to your Flex wallet.',
          onSubmit: async () => { await api('/api/goals/' + g.id, 'DELETE'); toast('Goal removed', 'ok'); await load(); },
        });
      }
    };
    boot(load);
  }

  /* ---------- SAFELOCK ---------- */
  function initSafelock() {
    let flex = 0;
    const lockCard = (l) => {
      const interest = round2(l.interest_earned + l.pending_interest);
      return '<section class="card lock"><div class="lock-top"><div><small>Locked amount</small><h3>' + money(l.amount) + '</h3></div><span class="badge">' + l.lock_days + ' days · ' + l.rate + '%</span></div>' +
        '<small>Time left</small><div class="countdown" data-end="' + l.end_date + '" data-id="' + l.id + '" data-locked="' + (l.can_withdraw ? '0' : '1') + '">--</div>' +
        '<div class="progress"><div class="bar" style="width:' + lockPct(l) + '%"></div></div>' +
        '<div class="goal-meta"><span>Unlocks ' + fmtDate(l.end_date) + '</span><span>Interest <b>+' + money(interest) + '</b></span></div>' +
        (l.can_withdraw
          ? '<button class="btn btn-primary" data-w="' + l.id + '">Withdraw ' + money(l.amount + interest) + '</button>'
          : '<button class="btn btn-ghost" disabled>🔒 Locked until ' + fmtDate(l.end_date) + '</button>') + '</section>';
    };
    const pastRow = (l) => '<div class="tx"><div class="tx-ic neu">🔓</div><div class="tx-mid"><b>' + money(l.amount) + ' · ' + l.lock_days + ' days</b><small>Withdrawn · ' + fmtDate(l.end_date) + '</small></div><div class="tx-amt pos">+' + money(l.interest_earned) + '</div></div>';

    const load = async () => {
      const [s, d] = await Promise.all([api('/api/wallet/summary'), api('/api/wallet/safelock')]);
      flex = s.wallets.flex.balance;
      const active = d.safelocks.filter((l) => l.status === 'active');
      const past = d.safelocks.filter((l) => l.status !== 'active');
      $('#lockTotal').textContent = money(s.wallets.safelock.total);
      $('#lockInterest').textContent = money(s.pending_interest);
      $('#lockList').innerHTML = active.length ? active.map(lockCard).join('') : '<div class="card empty">Nothing locked yet.<br>Lock money for 30, 60 or 90 days and earn ' + d.rate + '% a year. 🔒</div>';
      $('#pastCard').style.display = past.length ? 'block' : 'none';
      $('#pastList').innerHTML = past.map(pastRow).join('');
      startCountdowns(load);
    };
    $('#lockBtn').onclick = () => openSheet({
      title: 'Lock money', submit: 'Lock it',
      note: 'Available in Flex wallet: <b>' + money(flex) + '</b>. Earns <b>12% a year</b>. You <b>cannot</b> withdraw before the lock date.',
      fields: [
        { id: 'amount', label: 'Amount (USD)', type: 'number', placeholder: '0.00' },
        { id: 'days', label: 'Lock for', type: 'segment', value: '30', options: [{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }] },
      ],
      onSubmit: async (v) => { const r = await api('/api/wallet/safelock', 'POST', { amount: v.amount, days: Number(v.days) }); toast(r.message, 'ok'); await load(); },
    });
    $('#claimBtn').onclick = (e) => act(e.currentTarget, claimInterest(load));
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
    const nav = $('#nav'); if (!nav) return;
    const items = [['dashboard', 'dashboard.html', '🏠', 'Home'], ['wallet', 'wallet.html', '💳', 'Wallet'], ['goals', 'goals.html', '🎯', 'Goals'], ['safelock', 'safelock.html', '🔒', 'SafeLock']];
    nav.innerHTML = items.map((i) => '<a href="' + i[1] + '" class="' + (i[0] === page ? 'on' : '') + '"><span>' + i[2] + '</span>' + i[3] + '</a>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    shell(page);
    if (page === 'login') return initLogin();
    if (!getToken()) { location.replace('index.html'); return; }
    const lo = $('#logoutBtn'); if (lo) lo.onclick = logout;
    const u = getUser(), h = $('#hello');
    if (h && u && u.full_name) h.textContent = 'Hi, ' + u.full_name.split(' ')[0] + ' 👋';
    const pages = { dashboard: initDashboard, wallet: initWallet, goals: initGoals, safelock: initSafelock };
    if (pages[page]) pages[page]();
  });
})();
