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

const PAGES = ['dashboard', 'properties', 'contacts', 'deals', 'followups'];
const PAGE_LOADERS = {};

function navigate(page) {
  if (!PAGES.includes(page)) page = 'dashboard';
  PAGES.forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle('active', p === page);
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
  navigate(location.hash.replace('#', '') || 'dashboard');
});
