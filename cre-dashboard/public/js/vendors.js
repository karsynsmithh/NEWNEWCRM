PAGE_LOADERS.vendors = loadVendors;

const VENDOR_TYPES = ['attorney','title_company','lender','inspector','contractor','appraiser','architect','environmental','accountant','insurance','other'];

const VENDOR_BADGE_CLS = {
  attorney: 'vbadge-attorney', title_company: 'vbadge-title', lender: 'vbadge-lender',
  inspector: 'vbadge-inspector', contractor: 'vbadge-contractor', appraiser: 'vbadge-appraiser',
  architect: 'vbadge-architect', environmental: 'vbadge-environmental',
  accountant: 'vbadge-accountant', insurance: 'vbadge-insurance', other: 'vbadge-other'
};

function vBadge(type) {
  const cls = VENDOR_BADGE_CLS[type] || 'vbadge-other';
  return `<span class="vbadge ${cls}">${(type||'').replace(/_/g,' ')}</span>`;
}

function starDisplay(rating, interactive = false, vendorId = null) {
  if (!rating) return '<span style="color:var(--text-muted);font-size:12px">No rating</span>';
  return Array.from({length:5}, (_,i) =>
    `<span style="color:${i < rating ? '#f59e0b' : '#e2e8f0'};font-size:16px">&#9733;</span>`
  ).join('');
}

async function loadVendors() {
  const el = document.getElementById('page-vendors');
  const typeFilter = el._typeFilter || '';
  const preferredOnly = el._preferredOnly || false;
  const searchText = el._searchText || '';

  let url = '/api/vendors';
  const qs = [];
  if (typeFilter) qs.push(`vendor_type=${typeFilter}`);
  if (preferredOnly) qs.push('preferred=1');
  if (qs.length) url += '?' + qs.join('&');

  let vendors = await API.get(url).catch(() => []);

  if (searchText) {
    const s = searchText.toLowerCase();
    vendors = vendors.filter(v =>
      (v.name && v.name.toLowerCase().includes(s)) ||
      (v.company && v.company.toLowerCase().includes(s)) ||
      (v.specialty && v.specialty.toLowerCase().includes(s))
    );
  }

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Vendor Rolodex</h1>
      <button class="btn btn-primary" id="add-vendor-btn">+ Add Vendor</button>
    </div>
    <div class="filter-bar">
      <select id="filter-vendor-type">
        <option value="">All Types</option>
        ${VENDOR_TYPES.map(t => `<option value="${t}" ${typeFilter===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted)">
        <input type="checkbox" id="filter-preferred" ${preferredOnly?'checked':''} />
        &#11088; Preferred only
      </label>
      <input type="text" id="filter-vendor-search" value="${searchText}" placeholder="Search name, company, specialty..." style="min-width:200px" />
    </div>
    <div class="vendor-grid" id="vendor-grid">
      ${vendors.length === 0
        ? `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">&#128193;</div><div class="empty-state-text">No vendors yet. Add your first vendor.</div></div>`
        : vendors.map(v => renderVendorCard(v)).join('')}
    </div>
  `;

  document.getElementById('add-vendor-btn').addEventListener('click', () => openVendorModal());
  document.getElementById('filter-vendor-type').addEventListener('change', e => { el._typeFilter = e.target.value; loadVendors(); });
  document.getElementById('filter-preferred').addEventListener('change', e => { el._preferredOnly = e.target.checked; loadVendors(); });
  document.getElementById('filter-vendor-search').addEventListener('input', e => { el._searchText = e.target.value; loadVendors(); });
}

function renderVendorCard(v) {
  const notesSnippet = v.notes ? (v.notes.length > 80 ? v.notes.slice(0, 80) + '…' : v.notes) : '';
  return `
    <div class="vendor-card">
      <div class="vendor-card-header">
        <div>
          <div class="vendor-name"><a href="#" class="teal-link" onclick="openVendorProfile(${v.id});return false">${v.name}</a></div>
          ${v.company ? `<div class="vendor-company">${v.company}</div>` : ''}
        </div>
        <button class="star-btn ${v.preferred ? 'starred' : ''}" onclick="toggleVendorPreferred(${v.id}, ${v.preferred ? 0 : 1})" title="${v.preferred ? 'Remove preferred' : 'Mark preferred'}">
          ${v.preferred ? '&#11088;' : '&#9733;'}
        </button>
      </div>
      <div style="margin:8px 0">${vBadge(v.vendor_type)}</div>
      ${v.specialty ? `<div class="vendor-specialty">${v.specialty}</div>` : ''}
      <div class="vendor-contact-info">
        ${v.phone ? `<a href="tel:${v.phone}" class="vendor-contact-link">&#128222; ${v.phone}</a>` : ''}
        ${v.email ? `<a href="mailto:${v.email}" class="vendor-contact-link">&#9993; ${v.email}</a>` : ''}
      </div>
      ${v.rating ? `<div style="margin:6px 0">${starDisplay(v.rating)}</div>` : ''}
      ${notesSnippet ? `<div class="vendor-notes">${notesSnippet}</div>` : ''}
      <div class="vendor-card-actions">
        <button class="btn btn-sm btn-secondary" onclick="editVendor(${v.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVendor(${v.id})">Delete</button>
      </div>
    </div>`;
}

function vendorForm(v = {}) {
  return `
    <div class="form-grid">
      <div class="form-group"><label>Name *</label><input id="v_name" value="${v.name||''}" /></div>
      <div class="form-group"><label>Company</label><input id="v_company" value="${v.company||''}" /></div>
      <div class="form-group"><label>Vendor Type *</label>
        <select id="v_vendor_type">
          <option value="">Select...</option>
          ${VENDOR_TYPES.map(t => `<option value="${t}" ${v.vendor_type===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Specialty</label><input id="v_specialty" value="${v.specialty||''}" placeholder="Retail Leasing, 1031 Exchange..." /></div>
      <div class="form-group"><label>Email</label><input id="v_email" type="email" value="${v.email||''}" /></div>
      <div class="form-group"><label>Phone</label><input id="v_phone" value="${v.phone||''}" /></div>
      <div class="form-group"><label>Address</label><input id="v_address" value="${v.address||''}" /></div>
      <div class="form-group"><label>City</label><input id="v_city" value="${v.city||''}" /></div>
      <div class="form-group full">
        <label>Rating (1–5)</label>
        <div id="star-rating" style="display:flex;gap:6px;margin-top:4px">
          ${[1,2,3,4,5].map(n => `<span class="star-pick ${(v.rating||0)>=n?'active':''}" data-val="${n}" onclick="pickRating(${n})" style="font-size:24px;cursor:pointer;color:${(v.rating||0)>=n?'#f59e0b':'#e2e8f0'}">&#9733;</span>`).join('')}
        </div>
        <input type="hidden" id="v_rating" value="${v.rating||''}" />
      </div>
      <div class="form-group full">
        <label>
          <input type="checkbox" id="v_preferred" ${v.preferred?'checked':''} style="margin-right:6px" />
          Mark as preferred vendor
        </label>
      </div>
      <div class="form-group full"><label>Notes</label><textarea id="v_notes">${v.notes||''}</textarea></div>
    </div>`;
}

window.pickRating = function(n) {
  document.getElementById('v_rating').value = n;
  document.querySelectorAll('.star-pick').forEach(s => {
    const active = parseInt(s.dataset.val) <= n;
    s.style.color = active ? '#f59e0b' : '#e2e8f0';
    s.classList.toggle('active', active);
  });
};

function openVendorModal(v = {}) {
  modal.open(v.id ? 'Edit Vendor' : 'Add Vendor', vendorForm(v), async () => {
    if (!requireField('v_name', 'Name is required')) return;
    if (!requireField('v_vendor_type', 'Vendor type is required')) return;
    const data = {
      name: val('v_name'), company: val('v_company'), vendor_type: val('v_vendor_type'),
      specialty: val('v_specialty'), email: val('v_email'), phone: val('v_phone'),
      address: val('v_address'), city: val('v_city'),
      preferred: document.getElementById('v_preferred')?.checked ? 1 : 0,
      rating: val('v_rating') || null, notes: val('v_notes')
    };
    try {
      if (v.id) { await API.put(`/api/vendors/${v.id}`, data); toast('Vendor updated'); }
      else { await API.post('/api/vendors', data); toast('Vendor added'); }
      modal.close(); loadVendors();
    } catch (e) { toast('Error saving vendor', 'error'); }
  });
}

async function editVendor(id) {
  const v = await API.get(`/api/vendors/${id}`);
  openVendorModal(v);
}

async function deleteVendor(id) {
  if (!confirm('Delete this vendor? This cannot be undone.')) return;
  await API.delete(`/api/vendors/${id}`);
  toast('Vendor deleted'); loadVendors();
}

async function toggleVendorPreferred(id, newVal) {
  const v = await API.get(`/api/vendors/${id}`);
  await API.put(`/api/vendors/${id}`, { ...v, preferred: newVal });
  toast(newVal ? 'Marked as preferred' : 'Removed from preferred');
  loadVendors();
}

window.openVendorProfile = async function(id) {
  const v = await API.get(`/api/vendors/${id}`);

  const starsHtml = Array.from({length: 5}, (_, i) =>
    `<span style="color:${i < (v.rating || 0) ? '#f59e0b' : '#e2e8f0'};font-size:20px">&#9733;</span>`
  ).join('');

  const html = `
    <div class="profile-header">
      <div>
        <div style="font-size:20px;font-weight:700">${escapeHtml(v.name)}${v.preferred ? ' <span title="Preferred">&#11088;</span>' : ''}</div>
        ${vBadge(v.vendor_type)}
      </div>
    </div>
    <div class="profile-grid">
      <div class="profile-field"><span class="profile-label">Company</span>${escapeHtml(v.company || '—')}</div>
      <div class="profile-field"><span class="profile-label">Specialty</span>${escapeHtml(v.specialty || '—')}</div>
      <div class="profile-field"><span class="profile-label">Email</span>${v.email ? `<a href="mailto:${escapeHtml(v.email)}" class="teal-link">${escapeHtml(v.email)}</a>` : '—'}</div>
      <div class="profile-field"><span class="profile-label">Phone</span>${v.phone ? `<a href="tel:${escapeHtml(v.phone)}" class="teal-link">${escapeHtml(v.phone)}</a>` : '—'}</div>
      <div class="profile-field"><span class="profile-label">Address</span>${escapeHtml(v.address || '—')}</div>
      <div class="profile-field"><span class="profile-label">City</span>${escapeHtml(v.city || '—')}</div>
    </div>
    <div class="profile-section">
      <div class="profile-section-title">Rating</div>
      <div>${v.rating ? starsHtml : '<span style="color:var(--text-muted);font-size:13px">No rating</span>'}</div>
    </div>
    ${v.notes ? `<div class="profile-section"><div class="profile-section-title">Notes</div><div style="font-size:13px;color:var(--text-muted);white-space:pre-wrap">${escapeHtml(v.notes)}</div></div>` : ''}
    <div style="margin-top:16px">
      <button class="btn btn-secondary" onclick="modal.close();editVendor(${id})">Edit Vendor</button>
    </div>
  `;

  modal.open('Vendor Profile', html, null);
  document.getElementById('modal-save').style.display = 'none';
};
