PAGE_LOADERS.properties = loadProperties;

async function loadProperties() {
  const el = document.getElementById('page-properties');
  const statusFilter = el._statusFilter || '';
  const typeFilter = el._typeFilter || '';
  const repFilter = el._repFilter || '';

  let url = '/api/properties';
  if (statusFilter) url += `?status=${statusFilter}`;

  let rows = await API.get(url).catch(() => []);

  if (typeFilter) rows = rows.filter(r => r.property_type === typeFilter);
  if (repFilter) rows = rows.filter(r => r.rep_type === repFilter);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Properties</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <a href="/api/properties/export.csv" class="btn btn-secondary" download>&#8595; Export CSV</a>
        <button class="btn btn-primary" id="add-property-btn">+ Add Property</button>
      </div>
    </div>
    <div class="filter-bar">
      <select id="filter-type">
        <option value="">All Types</option>
        <option value="retail">Retail</option>
        <option value="office">Office</option>
        <option value="industrial">Industrial</option>
        <option value="land">Land</option>
        <option value="mixed-use">Mixed-Use</option>
      </select>
      <select id="filter-rep">
        <option value="">All Rep Types</option>
        <option value="landlord_rep">Landlord Rep</option>
        <option value="tenant_rep">Tenant Rep</option>
        <option value="investment_sale">Investment Sale</option>
      </select>
      <select id="filter-status">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="under_contract">Under Contract</option>
        <option value="leased">Leased</option>
        <option value="sold">Sold</option>
        <option value="withdrawn">Withdrawn</option>
      </select>
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Address</th><th>Type</th><th>SF</th><th>Rate $/SF/yr</th>
              <th>Price</th><th>Rep Type</th><th>Status</th><th>Owner</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="properties-tbody">
            ${rows.length === 0 ? `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">&#127970;</div><div class="empty-state-text">No properties yet. Add your first listing.</div></div></td></tr>` :
              rows.map(p => `
                <tr>
                  <td>
                    <a class="property-address-link" href="#" onclick="openPropertyProfile(${p.id});return false"><strong>${p.address}</strong></a>${suiteAvailabilityBadge(p)}${noteCountChip(p.note_count)}${p.city ? `<br><small style="color:var(--text-muted)">${p.city}, ${p.state || 'TX'}</small>` : ''}
                  </td>
                  <td>${p.property_type ? p.property_type.replace(/-/g,' ') : '—'}</td>
                  <td>${fmtSF(p.size_sf)}</td>
                  <td>${p.asking_rate ? fmt$(p.asking_rate) : '—'}</td>
                  <td>${p.asking_price ? fmt$(p.asking_price) : '—'}</td>
                  <td>${p.rep_type ? p.rep_type.replace(/_/g,' ') : '—'}</td>
                  <td>${badge(p.status, STATUS_MAP)}</td>
                  <td>${p.owner_name || '—'}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="editProperty(${p.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProperty(${p.id})">Del</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Restore filter values
  document.getElementById('filter-type').value = typeFilter;
  document.getElementById('filter-rep').value = repFilter;
  document.getElementById('filter-status').value = statusFilter;

  document.getElementById('filter-status').addEventListener('change', e => { el._statusFilter = e.target.value; loadProperties(); });
  document.getElementById('filter-type').addEventListener('change', e => { el._typeFilter = e.target.value; loadProperties(); });
  document.getElementById('filter-rep').addEventListener('change', e => { el._repFilter = e.target.value; loadProperties(); });
  document.getElementById('add-property-btn').addEventListener('click', () => openPropertyModal());
}

// "3 available" (green) or "All leased" (gray) shown next to the address
function suiteAvailabilityBadge(p) {
  if (!p.suite_count) return '';
  if (p.available_suite_count > 0) {
    return ` <span class="badge badge-available">${p.available_suite_count} available</span>`;
  }
  return ' <span class="badge badge-leased">All leased</span>';
}

// $/SF/yr with 2 decimals, e.g. $18.00
function fmtRate(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function propertyForm(p = {}) {
  return `
    <div class="form-grid">
      <div class="form-group full">
        <label>Address *</label>
        <input id="address" value="${p.address || ''}" placeholder="123 Main St" />
      </div>
      <div class="form-group">
        <label>City</label>
        <input id="city" value="${p.city || ''}" placeholder="Houston" />
      </div>
      <div class="form-group">
        <label>State</label>
        <input id="state" value="${p.state || 'TX'}" />
      </div>
      <div class="form-group">
        <label>Property Type</label>
        <select id="property_type">
          <option value="">Select...</option>
          ${['retail','office','industrial','land','mixed-use'].map(t => `<option value="${t}" ${p.property_type===t?'selected':''}>${t.replace(/-/g,' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Size (SF)</label>
        <input id="size_sf" type="number" value="${p.size_sf || ''}" placeholder="5000" />
      </div>
      <div class="form-group">
        <label>Asking Rate ($/SF/yr)</label>
        <input id="asking_rate" type="number" step="0.01" value="${p.asking_rate || ''}" placeholder="24.00" />
      </div>
      <div class="form-group">
        <label>Asking Price ($)</label>
        <input id="asking_price" type="number" value="${p.asking_price || ''}" placeholder="1500000" />
      </div>
      <div class="form-group">
        <label>Rep Type</label>
        <select id="rep_type">
          <option value="">Select...</option>
          <option value="landlord_rep" ${p.rep_type==='landlord_rep'?'selected':''}>Landlord Rep</option>
          <option value="tenant_rep" ${p.rep_type==='tenant_rep'?'selected':''}>Tenant Rep</option>
          <option value="investment_sale" ${p.rep_type==='investment_sale'?'selected':''}>Investment Sale</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="status">
          ${['active','under_contract','leased','sold','withdrawn'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Year Built</label>
        <input id="year_built" type="number" value="${p.year_built || ''}" placeholder="2005" />
      </div>
      <div class="form-section-title">Owner Info</div>
      <div class="form-group">
        <label>Owner Name</label>
        <input id="owner_name" value="${p.owner_name || ''}" />
      </div>
      <div class="form-group">
        <label>Owner Phone</label>
        <input id="owner_phone" value="${p.owner_phone || ''}" />
      </div>
      <div class="form-group full">
        <label>Owner Email</label>
        <input id="owner_email" type="email" value="${p.owner_email || ''}" />
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea id="notes">${p.notes || ''}</textarea>
      </div>
    </div>
  `;
}

function openPropertyModal(p = {}) {
  // Edit gets tabs (Details | Suites | Notes); add is just the details form
  const html = p.id ? `
    <div class="modal-tabs">
      <button type="button" class="modal-tab active" data-tab="details">Details</button>
      <button type="button" class="modal-tab" data-tab="suites">Suites / Spaces</button>
      <button type="button" class="modal-tab" data-tab="attachments">Attachments</button>
      <button type="button" class="modal-tab" data-tab="notes">Notes</button>
    </div>
    <div class="modal-tab-pane" id="tab-details">${propertyForm(p)}</div>
    <div class="modal-tab-pane" id="tab-suites" style="display:none">${suitesTabHtml()}</div>
    <div class="modal-tab-pane" id="tab-attachments" style="display:none">${attachmentsTabHtml()}</div>
    <div class="modal-tab-pane" id="tab-notes" style="display:none">${notesTabHtml()}</div>
  ` : propertyForm(p);

  modal.open(p.id ? 'Edit Property' : 'Add Property', html, async () => {
    if (!requireField('address', 'Address is required')) return;
    const data = formData(['address','city','state','property_type','size_sf','asking_rate','asking_price','rep_type','status','owner_name','owner_phone','owner_email','year_built','notes']);
    try {
      if (p.id) {
        await API.put(`/api/properties/${p.id}`, data);
        toast('Property updated');
      } else {
        await API.post('/api/properties', data);
        toast('Property added');
      }
      modal.close();
      loadProperties();
    } catch (e) {
      toast('Error saving property', 'error');
    }
  });

  if (p.id) {
    initModalTabs();
    loadSuitesTab(p.id);
    loadAttachmentsTab('property_id', p.id);
    loadNotesTab('property_id', p.id);
  }
}

async function editProperty(id) {
  const p = await API.get(`/api/properties/${id}`);
  openPropertyModal(p);
}

async function deleteProperty(id) {
  if (!confirm('Delete this property? This cannot be undone.')) return;
  await API.delete(`/api/properties/${id}`);
  toast('Property deleted');
  loadProperties();
}

// ─── Suites / Spaces tab ──────────────────────────────────────────────────────

const SUITE_STATUSES = ['available', 'under_contract', 'leased', 'sold', 'off_market'];

let _suites = [];
let _suitesPropertyId = null;

function suitesTabHtml() {
  return `
    <div class="suites-summary" id="suites-summary">Loading suites…</div>
    <div class="table-wrap">
      <table class="suites-table">
        <thead>
          <tr>
            <th>Suite Name</th><th>SF</th><th>Rate $/SF/yr</th><th>Asking Price</th>
            <th>Floor</th><th>Status</th><th>Notes</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="suites-tbody"></tbody>
      </table>
    </div>
    <div id="suite-form-wrap" style="display:none"></div>
    <div style="margin-top:12px">
      <button type="button" class="btn btn-secondary" id="add-suite-btn" onclick="openSuiteForm()">+ Add Suite</button>
    </div>
  `;
}

function renderSuitesSummary() {
  const el = document.getElementById('suites-summary');
  if (!el) return;
  if (_suites.length === 0) {
    el.textContent = 'No suites added yet';
    return;
  }
  const available = _suites.filter(s => s.status === 'available');
  const parts = [`${available.length} suite${available.length === 1 ? '' : 's'} available`];
  const sfs = available.map(s => s.size_sf).filter(v => v != null && !isNaN(v) && v !== '');
  if (sfs.length) {
    const min = Math.min(...sfs), max = Math.max(...sfs);
    parts.push(min === max
      ? `${Number(min).toLocaleString('en-US')} SF`
      : `${Number(min).toLocaleString('en-US')}–${Number(max).toLocaleString('en-US')} SF`);
  }
  const rates = available.map(s => s.asking_rate).filter(v => v != null && !isNaN(v) && v !== '');
  if (rates.length) parts.push(`From ${fmtRate(Math.min(...rates))}/SF`);
  el.textContent = parts.join(' | ');
}

function renderSuitesTable() {
  const tbody = document.getElementById('suites-tbody');
  if (!tbody) return;
  tbody.innerHTML = _suites.length === 0
    ? '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:18px">No suites added yet.</td></tr>'
    : _suites.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.suite_name)}</strong></td>
        <td>${fmtSF(s.size_sf)}</td>
        <td>${s.asking_rate ? fmtRate(s.asking_rate) : '—'}</td>
        <td>${s.asking_price ? fmt$(s.asking_price) : '—'}</td>
        <td>${s.floor ? escapeHtml(s.floor) : '—'}</td>
        <td>${badge(s.status, STATUS_MAP)}</td>
        <td class="suite-notes-cell">${s.notes ? escapeHtml(s.notes) : '—'}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-sm btn-secondary" onclick="openSuiteForm(${s.id})">Edit</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="deleteSuite(${s.id})">Del</button>
        </td>
      </tr>
    `).join('');
  renderSuitesSummary();
}

async function loadSuitesTab(propertyId) {
  _suitesPropertyId = propertyId;
  _suites = await API.get(`/api/properties/${propertyId}/suites`).catch(() => []);
  renderSuitesTable();
}

function openSuiteForm(suiteId) {
  const s = suiteId ? (_suites.find(x => x.id === suiteId) || {}) : {};
  const wrap = document.getElementById('suite-form-wrap');
  wrap.style.display = '';
  wrap.innerHTML = `
    <div class="suite-form">
      <div class="form-section-title">${suiteId ? 'Edit Suite' : 'Add Suite'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Suite Name *</label>
          <input id="suite_name" value="${escapeHtml(s.suite_name || '')}" placeholder="Suite 100, End Cap, Pad Site A" />
        </div>
        <div class="form-group">
          <label>Size (SF)</label>
          <input id="suite_size_sf" type="number" value="${s.size_sf || ''}" placeholder="1200" />
        </div>
        <div class="form-group">
          <label>Asking Rate ($/SF/yr)</label>
          <input id="suite_asking_rate" type="number" step="0.01" value="${s.asking_rate || ''}" placeholder="18.00" />
        </div>
        <div class="form-group">
          <label>Asking Price ($)</label>
          <input id="suite_asking_price" type="number" value="${s.asking_price || ''}" placeholder="Optional — for sale" />
        </div>
        <div class="form-group">
          <label>Floor</label>
          <input id="suite_floor" value="${escapeHtml(s.floor || '')}" placeholder="1st Floor, Ground" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="suite_status">
            ${SUITE_STATUSES.map(st => `<option value="${st}" ${(s.status || 'available') === st ? 'selected' : ''}>${st.replace(/_/g, ' ')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="suite_notes">${escapeHtml(s.notes || '')}</textarea>
        </div>
      </div>
      <div class="suite-form-actions">
        <button type="button" class="btn btn-primary" onclick="saveSuiteForm(${suiteId || 'null'})">${suiteId ? 'Update Suite' : 'Add Suite'}</button>
        <button type="button" class="btn btn-secondary" onclick="closeSuiteForm()">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById('suite_name').focus();
}

function closeSuiteForm() {
  const wrap = document.getElementById('suite-form-wrap');
  wrap.style.display = 'none';
  wrap.innerHTML = '';
}

async function saveSuiteForm(suiteId) {
  if (!requireField('suite_name', 'Suite name is required')) return;
  const data = {
    suite_name: val('suite_name'),
    size_sf: val('suite_size_sf') || null,
    asking_rate: val('suite_asking_rate') || null,
    asking_price: val('suite_asking_price') || null,
    floor: val('suite_floor') || null,
    status: val('suite_status'),
    notes: val('suite_notes') || null
  };
  try {
    if (suiteId) {
      await API.put(`/api/properties/${_suitesPropertyId}/suites/${suiteId}`, data);
      toast('Suite updated');
    } else {
      await API.post(`/api/properties/${_suitesPropertyId}/suites`, data);
      toast('Suite added');
    }
    closeSuiteForm();
    await loadSuitesTab(_suitesPropertyId);
    loadProperties();
  } catch (e) {
    toast('Error saving suite', 'error');
  }
}

async function deleteSuite(suiteId) {
  if (!confirm('Delete this suite? This cannot be undone.')) return;
  try {
    await API.delete(`/api/properties/${_suitesPropertyId}/suites/${suiteId}`);
    toast('Suite deleted');
    await loadSuitesTab(_suitesPropertyId);
    loadProperties();
  } catch (e) {
    toast('Error deleting suite', 'error');
  }
}

// ─── Property Profile (read-only view) ───────────────────────────────────────

window.openPropertyProfile = async function(id) {
  const [p, suites, notes] = await Promise.all([
    API.get(`/api/properties/${id}`),
    API.get(`/api/properties/${id}/suites`).catch(() => []),
    API.get(`/api/notes?property_id=${id}`).catch(() => [])
  ]);

  const suitesHtml = suites.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px">No suites added yet.</p>'
    : `<table class="suites-table" style="width:100%">
        <thead><tr><th>Suite</th><th>SF</th><th>Rate $/SF/yr</th><th>Status</th><th>Floor</th></tr></thead>
        <tbody>${suites.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.suite_name)}</strong></td>
            <td>${fmtSF(s.size_sf)}</td>
            <td>${s.asking_rate ? fmtRate(s.asking_rate) : '—'}</td>
            <td>${badge(s.status, STATUS_MAP)}</td>
            <td>${s.floor ? escapeHtml(s.floor) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

  const notesHtml = notes.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px">No notes yet.</p>'
    : notes.slice(0, 5).map(n => `
        <div class="note-card" style="margin-bottom:8px">
          <div class="note-card-header">
            <span class="note-date">${fmtDateTime(n.note_date)}</span>
          </div>
          <div class="note-text">${escapeHtml(n.note_text)}</div>
        </div>`).join('');

  const html = `
    <div class="profile-header">
      <div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h2 style="margin:0;font-size:18px">${escapeHtml(p.address)}</h2>
          ${badge(p.status, STATUS_MAP)}
        </div>
        ${p.city ? `<div style="color:var(--text-muted);font-size:13px;margin-top:4px">${escapeHtml(p.city)}, ${escapeHtml(p.state || 'TX')}</div>` : ''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="modal.close();editProperty(${p.id})">Edit Property</button>
    </div>

    <div class="profile-grid">
      <div class="profile-field"><span class="profile-label">Type</span><span>${p.property_type ? p.property_type.replace(/-/g, ' ') : '—'}</span></div>
      <div class="profile-field"><span class="profile-label">Size</span><span>${fmtSF(p.size_sf)}</span></div>
      <div class="profile-field"><span class="profile-label">Asking Rate</span><span>${p.asking_rate ? fmtRate(p.asking_rate) + '/SF/yr' : '—'}</span></div>
      <div class="profile-field"><span class="profile-label">Asking Price</span><span>${p.asking_price ? fmt$(p.asking_price) : '—'}</span></div>
      <div class="profile-field"><span class="profile-label">Rep Type</span><span>${p.rep_type ? p.rep_type.replace(/_/g, ' ') : '—'}</span></div>
      <div class="profile-field"><span class="profile-label">Year Built</span><span>${p.year_built || '—'}</span></div>
    </div>

    ${(p.owner_name || p.owner_phone || p.owner_email) ? `
    <div class="profile-section">
      <div class="profile-section-title">Owner / Contact</div>
      <div class="profile-grid">
        ${p.owner_name ? `<div class="profile-field"><span class="profile-label">Name</span><span>${escapeHtml(p.owner_name)}</span></div>` : ''}
        ${p.owner_phone ? `<div class="profile-field"><span class="profile-label">Phone</span><span>${escapeHtml(p.owner_phone)}</span></div>` : ''}
        ${p.owner_email ? `<div class="profile-field"><span class="profile-label">Email</span><span><a href="mailto:${escapeHtml(p.owner_email)}" class="teal-link">${escapeHtml(p.owner_email)}</a></span></div>` : ''}
      </div>
    </div>` : ''}

    ${p.notes ? `
    <div class="profile-section">
      <div class="profile-section-title">Property Notes</div>
      <div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(p.notes)}</div>
    </div>` : ''}

    <div class="profile-section">
      <div class="profile-section-title">Suites / Spaces <span style="font-weight:400;color:var(--text-muted)">(${suites.length})</span></div>
      ${suitesHtml}
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Recent Notes <span style="font-weight:400;color:var(--text-muted)">(${notes.length})</span></div>
      ${notesHtml}
      ${notes.length > 5 ? `<p style="font-size:12px;color:var(--text-muted);margin-top:6px">Showing 5 of ${notes.length} — open Edit to see all</p>` : ''}
    </div>
  `;

  modal.open(`Property Profile`, html, null);
  document.getElementById('modal-save').style.display = 'none';
};
