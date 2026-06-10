// ─── Shared Utilities ─────────────────────────────────────────────────────────

const API = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(path) {
    const r = await fetch(path, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

function fmt$(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtSF(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US') + ' SF';
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function isOverdue(dateStr) {
  return dateStr && dateStr < today();
}

// "2026-06-09 14:34:00" or "2026-06-09T14:34" → "Jun 9, 2026 at 2:34 PM"
function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(String(dt).replace(' ', 'T'));
  if (isNaN(d)) return dt;
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

// Current local time formatted for <input type="datetime-local">
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// 💬 count chip shown on list rows (empty string when no notes)
function noteCountChip(count) {
  return count > 0 ? `<span class="note-count-chip" title="${count} note${count === 1 ? '' : 's'}">&#128172; ${count}</span>` : '';
}

// Wire up tab switching inside an open modal body
function initModalTabs() {
  document.querySelectorAll('#modal-body .modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modal-body .modal-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#modal-body .modal-tab-pane').forEach(pane => {
        pane.style.display = pane.id === `tab-${btn.dataset.tab}` ? '' : 'none';
      });
      // Footer Save applies to the details form only
      const saveBtn = document.getElementById('modal-save');
      if (saveBtn) saveBtn.style.display = btn.dataset.tab === 'details' ? '' : 'none';
    });
  });
}

function isToday(dateStr) {
  return dateStr === today();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function badge(val, map) {
  const cls = map[val] || 'badge-prospect';
  const label = val ? val.replace(/_/g, ' ') : '—';
  return `<span class="badge ${cls}">${label}</span>`;
}

const STATUS_MAP = {
  available: 'badge-available',
  off_market: 'badge-off_market',
  active: 'badge-active',
  under_contract: 'badge-under_contract',
  leased: 'badge-leased',
  sold: 'badge-sold',
  withdrawn: 'badge-withdrawn',
  dead: 'badge-dead',
  prospect: 'badge-prospect',
  loi: 'badge-loi',
  closed: 'badge-closed',
  pending: 'badge-pending',
  invoiced: 'badge-invoiced',
  received: 'badge-received'
};

// ─── Modal ─────────────────────────────────────────────────────────────────────

const modal = {
  el: document.getElementById('modal'),
  backdrop: document.getElementById('modal-backdrop'),
  title: document.getElementById('modal-title'),
  body: document.getElementById('modal-body'),
  saveBtn: document.getElementById('modal-save'),
  _onSave: null,

  open(titleText, html, onSave) {
    this.title.textContent = titleText;
    this.body.innerHTML = html;
    this.saveBtn.style.display = '';
    this._onSave = onSave;
    this.el.classList.add('open');
    this.backdrop.classList.add('open');
    const first = this.body.querySelector('input, select, textarea');
    if (first) first.focus();
  },

  close() {
    this.el.classList.remove('open');
    this.backdrop.classList.remove('open');
    this._onSave = null;
  },

  triggerSave() {
    if (this._onSave) this._onSave();
  }
};

document.getElementById('modal-close').addEventListener('click', () => modal.close());
document.getElementById('modal-cancel').addEventListener('click', () => modal.close());
document.getElementById('modal-backdrop').addEventListener('click', () => modal.close());
document.getElementById('modal-save').addEventListener('click', () => modal.triggerSave());

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function formData(fields) {
  const data = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (!el) return;
    if (el.type === 'checkbox') data[f] = el.checked;
    else data[f] = el.value.trim() || null;
  });
  return data;
}

function requireField(id, msg) {
  const el = document.getElementById(id);
  if (!el || !el.value.trim()) {
    if (el) { el.classList.add('error'); el.focus(); }
    toast(msg, 'error');
    return false;
  }
  el.classList.remove('error');
  return true;
}

// ─── Router ────────────────────────────────────────────────────────────────────

const PAGES = ['dashboard', 'properties', 'contacts', 'deals', 'followups', 'activities', 'comps', 'vendors'];
const PAGE_LOADERS = {};

function navigate(page) {
  if (!PAGES.includes(page)) page = 'dashboard';
  PAGES.forEach(p => {
    const pageEl = document.getElementById(`page-${p}`);
    if (pageEl) pageEl.classList.toggle('active', p === page);
  });
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  if (PAGE_LOADERS[page]) PAGE_LOADERS[page]();

  if (window.innerWidth < 769) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

window.addEventListener('hashchange', () => {
  navigate(location.hash.replace('#', '') || 'dashboard');
});

// Sidebar hamburger (desktop collapse)
document.getElementById('hamburger').addEventListener('click', () => {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth < 769) {
    sb.classList.toggle('open');
  } else {
    sb.classList.toggle('collapsed');
  }
});

// Mobile hamburger
document.getElementById('hamburger-mobile').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Nav links
document.querySelectorAll('.nav-link').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const page = a.dataset.page;
    history.pushState(null, '', `#${page}`);
    navigate(page);
  });
});

// Init
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  if (params.get('gmail') === 'connected') {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => toast('Gmail connected — click Sync Now to import emails'), 400);
  } else if (params.get('gmail') === 'error') {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => toast('Gmail connection failed', 'error'), 400);
  }
  navigate(location.hash.replace('#', '') || 'dashboard');
});
