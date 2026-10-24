/* ============ 小云账本 · 逻辑 ============ */
(() => {
  'use strict';

  const STORE_KEY = 'xiaoyun.ledger.v1';
  const CNY = '¥';

  /* ---------- 分类 ---------- */
  const CATS = {
    expense: [
      { id: 'food', name: '餐饮', icon: 'bowl', color: '#FF9F80' },
      { id: 'transit', name: '交通', icon: 'bus', color: '#8FB8FF' },
      { id: 'shopping', name: '购物', icon: 'bag', color: '#FFC85C' },
      { id: 'fun', name: '娱乐', icon: 'star', color: '#B9A6F2' },
      { id: 'daily', name: '日用', icon: 'home', color: '#6FD3BE' },
      { id: 'health', name: '医疗', icon: 'heart', color: '#FF8B9E' },
      { id: 'study', name: '学习', icon: 'book', color: '#7FC8A9' },
      { id: 'social', name: '人情', icon: 'gift', color: '#F7A8C4' },
      { id: 'other', name: '其他', icon: 'dots', color: '#C9BFB5' },
    ],
    income: [
      { id: 'salary', name: '工资', icon: 'wallet', color: '#6FD3BE' },
      { id: 'redpack', name: '红包', icon: 'gift', color: '#FF8B76' },
      { id: 'invest', name: '理财', icon: 'chart', color: '#8FB8FF' },
      { id: 'other-in', name: '其他', icon: 'dots', color: '#C9BFB5' },
    ],
  };

  const catById = (type, id) =>
    CATS[type].find((c) => c.id === id) || CATS[type][CATS[type].length - 1];

  /* ---------- 状态 ---------- */
  const state = {
    entries: [],
    budget: 0,
    month: monthOf(new Date()),
    tab: 'home',
    filter: 'all',
  };

  const sheet = {
    open: false,
    type: 'expense',
    cat: 'food',
    amount: '',
    date: todayStr(),
    note: '',
    editingId: null,
  };

  /* ---------- 工具 ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function monthOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
  function monthLabel(m) { const [y, mo] = m.split('-'); return `${y}年${Number(mo)}月`; }
  function daysInMonth(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); }
  function shiftMonth(m, delta) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    return monthOf(d);
  }
  function centsOf(str) {
    const n = parseFloat(str);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  function money(cents, trim = false) {
    const neg = cents < 0;
    const abs = Math.abs(cents) / 100;
    let s = abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (trim) s = s.replace(/\.00$/, '');
    return (neg ? '-' : '') + s;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- 存储 ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) {
        state.entries = data.entries.filter((e) => e && typeof e.amount === 'number' && e.date);
      }
      if (typeof data.budget === 'number') state.budget = data.budget;
    } catch (err) {
      console.warn('读取账本失败', err);
    }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        version: 1,
        budget: state.budget,
        entries: state.entries,
      }));
    } catch (err) {
      toast('存不下了……先导出备份吧');
    }
  }

  /* ---------- 查询 ---------- */
  function monthEntries(m = state.month) {
    return state.entries.filter((e) => e.date.slice(0, 7) === m);
  }
  function totals(list) {
    let expense = 0, income = 0;
    for (const e of list) {
      if (e.type === 'income') income += e.amount;
      else expense += e.amount;
    }
    return { expense, income, balance: income - expense };
  }
  function sortedDesc(list) {
    return [...list].sort((a, b) =>
      a.date === b.date ? (b.ts || 0) - (a.ts || 0) : a.date < b.date ? 1 : -1);
  }

  /* ---------- 渲染：顶栏 ---------- */
  function renderTop() {
    $('#monthPill').textContent = monthLabel(state.month);
  }

  /* ---------- 渲染：首页 ---------- */
  function renderHome() {
    const list = monthEntries();
    const t = totals(list);

    $('#ovExpense').textContent = money(t.expense);
    $('#ovIncome').textContent = CNY + money(t.income, true);
    $('#ovBalance').textContent = (t.balance < 0 ? '-' : '') + CNY + money(Math.abs(t.balance), true);
    $('#entryCount').textContent = `${list.length} 笔`;

    const box = $('#budgetBox');
    if (state.budget > 0) {
      box.hidden = false;
      const pct = Math.min(100, Math.round((t.expense / state.budget) * 100));
      $('#budgetFill').style.width = pct + '%';
      $('#budgetPct').textContent = pct + '%';
      const left = state.budget - t.expense;
      box.classList.toggle('is-over', left < 0);
      $('#budgetText').textContent = left >= 0
        ? `预算 ${money(state.budget, true)}，还能花 ${money(left, true)}`
        : `超出预算 ${money(-left, true)} 啦`;
    } else {
      box.hidden = true;
    }

    const recent = sortedDesc(state.entries).slice(0, 4);
    const host = $('#recentList');
    host.innerHTML = recent.length ? recent.map(entryHtml).join('') : emptyHtml('还没有记录', '点右下角的 + 记第一笔吧');
  }

  /* ---------- 渲染：明细 ---------- */
  function renderList() {
    const list = sortedDesc(monthEntries()).filter((e) => state.filter === 'all' || e.type === state.filter);
    const t = totals(monthEntries());
    $('#monthSummary').innerHTML =
      `<span>本月 <b>${monthEntries().length}</b> 笔</span>` +
      `<span>支出 <b>${CNY}${money(t.expense)}</b></span>` +
      `<span>收入 <b>${CNY}${money(t.income)}</b></span>`;

    const host = $('#monthList');
    if (!list.length) {
      host.innerHTML = emptyHtml('这个月还空着', state.filter === 'all' ? '轻轻记一笔，让日子有迹可循' : '换个筛选看看');
      return;
    }
    const groups = new Map();
    for (const e of list) {
      if (!groups.has(e.date)) groups.set(e.date, []);
      groups.get(e.date).push(e);
    }

    let html = '';
    for (const [date, items] of groups) {
      const sub = totals(items);
      const parts = [];
      if (sub.expense) parts.push(`支出 ${CNY}${money(sub.expense)}`);
      if (sub.income) parts.push(`收入 ${CNY}${money(sub.income)}`);
      html += `<div class="day-head"><b>${dayLabel(date)}</b><span>${parts.join(' · ')}</span></div>`;
      html += items.map(entryHtml).join('');
    }
    host.innerHTML = html;
  }

  function dayLabel(date) {
    const today = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const [, m, d] = date.split('-');
    const md = `${Number(m)}月${Number(d)}日`;
    if (date === today) return `今天 · ${md}`;
    if (date === todayStr(y)) return `昨天 · ${md}`;
    const wd = '日一二三四五六'[new Date(date + 'T00:00:00').getDay()];
    return `${md} 周${wd}`;
  }

  function entryHtml(e) {
    const cat = catById(e.type, e.cat);
    const cls = e.type === 'income' ? 'income' : '';
    const sign = e.type === 'income' ? '+' : '−';
    return `<button class="entry" data-id="${e.id}">
      <span class="entry-ico" style="--c:${cat.color}"><svg><use href="#i-${cat.icon}"/></svg></span>
      <span class="entry-main">
        <span class="entry-name">${cat.name}</span>
        ${e.note ? `<span class="entry-note">${escapeHtml(e.note)}</span>` : ''}
      </span>
      <span class="entry-amt ${cls}">${sign}${CNY}${money(e.amount)}</span>
    </button>`;
  }

  function emptyHtml(title, sub) {
    return `<div class="empty">
      <svg class="empty-cloud" viewBox="0 0 92 64" aria-hidden="true">
        <path class="c" d="M22 54C12.6 54 5 47.6 5 39.6c0-6.6 4.6-12.2 11-13.6C17.4 16.4 25.4 9.6 35 9.6c8.2 0 15.2 4.8 17.8 11.8 1-.3 2.2-.4 3.2-.4 6.4 0 11.6 4.9 11.6 11 0 .9-.1 1.8-.4 2.6 4 1.4 6.8 5 6.8 9.4 0 5.4-4.6 9.8-10.2 9.8H22Z"/>
        <ellipse class="blush" cx="29" cy="43" rx="5" ry="3"/>
        <ellipse class="blush" cx="63" cy="43" rx="5" ry="3"/>
        <circle class="eye" cx="35" cy="37" r="2.6"/>
        <circle class="eye" cx="57" cy="37" r="2.6"/>
        <path class="smile" d="M42 44c1.8 2.2 6.2 2.2 8 0"/>
      </svg>
      <div><b>${title}</b></div>
      <div>${sub}</div>
    </div>`;
  }

  /* ---------- 渲染：统计 ---------- */
  function renderStats() {
    const list = monthEntries().filter((e) => e.type === 'expense');
    const total = list.reduce((s, e) => s + e.amount, 0);

    const byCat = new Map();
    for (const e of list) byCat.set(e.cat, (byCat.get(e.cat) || 0) + e.amount);
    const rows = [...byCat.entries()]
      .map(([id, amt]) => ({ ...catById('expense', id), amt }))
      .sort((a, b) => b.amt - a.amt);

    const donut = $('#donut');
    $('#donutTotal').textContent = CNY + money(total, true);
    const R = 54, C = 2 * Math.PI * R;
    if (!rows.length) {
      donut.innerHTML = `<circle cx="70" cy="70" r="${R}" stroke="#F3ECE2"/>`;
    } else {
      let offset = 0;
      donut.innerHTML = rows.map((r) => {
        const frac = r.amt / total;
        const len = Math.max(frac * C - 3, 1.5);
        const seg = `<circle cx="70" cy="70" r="${R}" stroke="${r.color}"
          stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"/>`;
        offset += frac * C;
        return seg;
      }).join('');
    }

    $('#donutLegend').innerHTML = rows.slice(0, 6).map((r) => `
      <div class="legend-item"><i class="legend-dot" style="--c:${r.color}"></i>${r.name}
        <b>${Math.round((r.amt / total) * 100)}%</b></div>`).join('') ||
      `<div class="legend-item" style="color:#A79B90">这个月还没有支出</div>`;

    renderWeekBars();
    renderRank(rows, total);
  }

  function renderWeekBars() {
    const [y, mo] = state.month.split('-').map(Number);
    const thisMonth = monthOf(new Date()) === state.month;
    const lastDay = thisMonth ? new Date().getDate() : daysInMonth(state.month);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(y, mo - 1, lastDay - i);
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    const sums = days.map((d) =>
      state.entries.filter((e) => e.date === d && e.type === 'expense').reduce((s, e) => s + e.amount, 0));
    const max = Math.max(...sums, 1);
    $('#weekBars').innerHTML = days.map((d, i) => {
      const h = sums[i] ? Math.max(6, Math.round((sums[i] / max) * 92)) : 4;
      const isToday = d === todayStr();
      return `<div class="bar-col">
        <span class="bar-val">${sums[i] ? money(sums[i], true) : ''}</span>
        <i class="bar ${isToday ? 'today' : ''}" style="height:${h}px; --c:${isToday ? 'var(--mint)' : 'var(--coral)'}"></i>
        <span class="bar-day">${Number(d.slice(8))}日</span>
      </div>`;
    }).join('');
  }

  function renderRank(rows, total) {
    const host = $('#rankList');
    if (!rows.length) { host.innerHTML = `<div class="hint">还没有可以排行的记录呢。</div>`; return; }
    const max = rows[0].amt;
    host.innerHTML = rows.slice(0, 6).map((r) => `
      <div class="rank-row">
        <span class="rank-ico" style="--c:${r.color}"><svg><use href="#i-${r.icon}"/></svg></span>
        <span class="rank-name">${r.name}</span>
        <span class="rank-track"><i style="width:${Math.round((r.amt / max) * 100)}%;--c:${r.color}"></i></span>
        <span class="rank-amt">${CNY}${money(r.amt, true)}</span>
      </div>`).join('');
  }

  /* ---------- 渲染：我的 ---------- */
  function renderMe() {
    const input = $('#budgetInput');
    if (document.activeElement !== input) {
      input.value = state.budget ? String(state.budget / 100) : '';
    }
  }

  function renderAll() {
    renderTop();
    renderHome();
    renderList();
    renderStats();
    renderMe();
  }

  /* ---------- 视图切换 ---------- */
  function setTab(tab) {
    state.tab = tab;
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === tab));
    $$('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.tab === tab));
    $('#fab').classList.toggle('is-hidden', !(tab === 'home' || tab === 'list'));
    $('.views').scrollTop = 0;
  }

  /* ---------- 记账弹层 ---------- */
  function openSheet(entry = null) {
    sheet.open = true;
    sheet.editingId = entry ? entry.id : null;
    sheet.type = entry ? entry.type : 'expense';
    sheet.cat = entry ? entry.cat : CATS.expense[0].id;
    sheet.amount = entry ? (entry.amount / 100).toFixed(2).replace(/\.?0+$/, '') : '';
    sheet.date = entry ? entry.date : todayStr();
    sheet.note = entry ? entry.note || '' : '';

    $('#dateInput').value = sheet.date;
    $('#noteInput').value = sheet.note;
    $('#deleteBtn').hidden = !entry;
    $('#saveBtn').textContent = entry ? '保存修改' : '记下这笔';
    renderSheet();
    $('#sheetWrap').classList.add('is-open');
    $('#sheetWrap').setAttribute('aria-hidden', 'false');
  }

  function closeSheet() {
    sheet.open = false;
    $('#sheetWrap').classList.remove('is-open');
    $('#sheetWrap').setAttribute('aria-hidden', 'true');
  }

  function renderSheet() {
    $$('#typeToggle .type-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.type === sheet.type));
    $$('#catRow .cat').forEach((c) => c.classList.toggle('is-on', c.dataset.cat === sheet.cat));

    const display = $('#amountText');
    if (sheet.amount) {
      display.textContent = sheet.amount;
      display.parentElement.classList.remove('placeholder');
    } else {
      display.textContent = '0.00';
      display.parentElement.classList.add('placeholder');
    }
    $('#saveBtn').disabled = centsOf(sheet.amount) <= 0;
  }

  function renderCats() {
    const host = $('#catRow');
    host.innerHTML = CATS[sheet.type].map((c) => `
      <button class="cat ${c.id === sheet.cat ? 'is-on' : ''}" data-cat="${c.id}">
        <span class="cat-ico" style="--c:${c.color}"><svg><use href="#i-${c.icon}"/></svg></span>
        <span>${c.name}</span>
      </button>`).join('');
  }

  function pressKey(k) {
    if (k === 'del') {
      sheet.amount = sheet.amount.slice(0, -1);
    } else if (k === '.') {
      if (!sheet.amount.includes('.')) sheet.amount = (sheet.amount || '0') + '.';
    } else {
      const [int, dec] = sheet.amount.split('.');
      if (dec !== undefined && dec.length >= 2) return;
      if (int && int.replace('-', '').length >= 7) return;
      sheet.amount = (sheet.amount === '0' ? '' : sheet.amount) + k;
    }
    renderSheet();
  }

  function saveEntry() {
    const cents = centsOf(sheet.amount);
    if (cents <= 0) { toast('先输入金额呀'); return; }
    const note = $('#noteInput').value.trim();
    const date = $('#dateInput').value || todayStr();

    if (sheet.editingId) {
      const e = state.entries.find((x) => x.id === sheet.editingId);
      if (e) Object.assign(e, { type: sheet.type, cat: sheet.cat, amount: cents, note, date, ts: Date.now() });
    } else {
      state.entries.push({
        id: uid(), type: sheet.type, cat: sheet.cat, amount: cents,
        note, date, ts: Date.now(),
      });
    }
    save();
    renderAll();
    closeSheet();
    cheerMascot();
    toast(sheet.editingId ? '改好啦' : '记下啦 ♪');
  }

  function deleteEntry() {
    const e = state.entries.find((x) => x.id === sheet.editingId);
    if (!e) return;
    if (!window.confirm(`删掉这条「${catById(e.type, e.cat).name} ${CNY}${money(e.amount)}」吗？`)) return;
    state.entries = state.entries.filter((x) => x.id !== e.id);
    save();
    renderAll();
    closeSheet();
    toast('删掉了');
  }

  /* ---------- 提示 & 小动作 ---------- */
  let toastTimer = null;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 1800);
  }

  function cheerMascot() {
    const m = $('#mascot');
    m.classList.remove('cheer');
    void m.offsetWidth;
    m.classList.add('cheer');
    setTimeout(() => m.classList.remove('cheer'), 700);
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return ['夜深了呀', '记完这笔就去睡吧'];
    if (h < 11) return ['早上好呀', '今天也记一笔吧'];
    if (h < 14) return ['中午好呀', '吃饭花了多少呢'];
    if (h < 18) return ['下午好呀', '喝口水，记一笔'];
    if (h < 23) return ['晚上好呀', '今天过得怎么样'];
    return ['该休息啦', '明天再记也不迟'];
  }

  /* ---------- 导入导出 ---------- */
  function exportData() {
    const data = { app: 'xiaoyun-ledger', version: 1, exportedAt: new Date().toISOString(), budget: state.budget, entries: state.entries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `小云账本-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('备份已导出');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.entries)) throw new Error('文件里没有 entries');
        if (!window.confirm(`导入会覆盖现在的 ${state.entries.length} 条记录，继续吗？`)) return;
        state.entries = data.entries.filter((e) => e && typeof e.amount === 'number' && e.date);
        if (typeof data.budget === 'number') state.budget = data.budget;
        save();
        renderAll();
        toast(`导入了 ${state.entries.length} 条`);
      } catch (err) {
        toast('这个文件读不懂呢');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $('#prevMonth').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); renderAll(); });
    $('#nextMonth').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); renderAll(); });

    $$('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.goto)));

    $('#fab').addEventListener('click', () => openSheet());

    $$('#typeFilter .chip').forEach((c) => c.addEventListener('click', () => {
      state.filter = c.dataset.filter;
      $$('#typeFilter .chip').forEach((x) => x.classList.toggle('is-on', x === c));
      renderList();
    }));

    document.addEventListener('click', (ev) => {
      const entry = ev.target.closest('.entry');
      if (entry && entry.dataset.id) {
        const found = state.entries.find((e) => e.id === entry.dataset.id);
        if (found) openSheet(found);
      }
    });

    $('#sheetWrap').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) closeSheet();
    });

    $$('#typeToggle .type-btn').forEach((b) => b.addEventListener('click', () => {
      if (sheet.type === b.dataset.type) return;
      sheet.type = b.dataset.type;
      sheet.cat = CATS[sheet.type][0].id;
      renderCats();
      renderSheet();
    }));

    $('#catRow').addEventListener('click', (ev) => {
      const c = ev.target.closest('.cat');
      if (!c) return;
      sheet.cat = c.dataset.cat;
      renderSheet();
    });

    $('#keypad').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-k]');
      if (b) pressKey(b.dataset.k);
    });

    $('#saveBtn').addEventListener('click', saveEntry);
    $('#deleteBtn').addEventListener('click', deleteEntry);

    $('#dateInput').addEventListener('change', (e) => { sheet.date = e.target.value; });
    $('#noteInput').addEventListener('input', (e) => { sheet.note = e.target.value; });

    $('#saveBudget').addEventListener('click', () => {
      const v = parseFloat($('#budgetInput').value);
      state.budget = Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
      save();
      renderAll();
      toast(state.budget ? '预算设好啦' : '已取消预算');
    });

    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importData(f);
      e.target.value = '';
    });

    $('#clearBtn').addEventListener('click', () => {
      if (!state.entries.length) { toast('账本已经是空的啦'); return; }
      if (!window.confirm(`确定清空全部 ${state.entries.length} 条记录？清空后没法恢复，建议先导出备份。`)) return;
      state.entries = [];
      save();
      renderAll();
      toast('账本清空了');
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && sheet.open) closeSheet();
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    load();
    const [hi, sub] = greeting();
    $('#greeting').textContent = hi;
    $('#greetingSub').textContent = sub;

    renderCats();
    bind();
    renderAll();
    setTab('home');

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
