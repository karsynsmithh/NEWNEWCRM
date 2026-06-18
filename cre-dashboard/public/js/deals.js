PAGE_LOADERS.deals = loadDeals;

let propertiesList = [];
let contactsList = [];

async function loadDeals() {
  const el = document.getElementById('page-deals');
  if (!el) return;
  const statusFilter = el._statusFilter || '';
  const typeFilter = el._typeFilter || '';

  el.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading...</p>';

  let url = '/api/deals';
  const qs = [];
  if (statusFilter) qs.push(`status=${statusFilter}`);
  if (typeFilter) qs.push(`deal_type=${typeFilter}`);
  if (qs.length) url += '?' + qs.join('&');

  try {
  const [deals, props, contacts] = await Promise.all([
    API.get(url).catch(() => []),
    API.get('/api/properties').catch(() => []),
    API.get('/api/contacts').catch(() => [])
  ]);
  propertiesList = props;
  contactsList = contacts;

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Deals</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <a href="/api/deals/export.csv" class="btn btn-secondary" download>&#8595; Export CSV</a>
        <button class="btn btn-primary" id="add-deal-btn">+ Add Deal</button>
      </div>
    </div>
    <div class="filter-bar">
      <select id="filter-deal-status">
        <option value="">All Statuses</option>
        ${['prospect','loi','under_contract','closed','dead'].map(s => `<option value="${s}" ${statusFilter===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
      </select>
      <select id="filter-deal-type">
        <option value="">All Types</option>
        <option value="lease" ${typeFilter==='lease'?'selected':''}>Lease</option>
        <option value="sale" ${typeFilter==='sale'?'selected':''}>Sale</option>
      </select>
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Deal Name</th><th>Type</th><th>Property</th><th>Tenant/Buyer</th>
              <th>Status</th><th>SF</th><th>Rate / Price</th><th>Expected Close</th>
              <th>Docs</th><th>Commission</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="deals-tbody">
            ${deals.length === 0
              ? `<tr><td colspan="11"><div class="empty-state"><div class="empty-state-icon">&#129309;</div><div class="empty-state-text">No deals yet. Add your first deal.</div></div></td></tr>`
              : deals.map(d => `
                <tr>
                  <td><a href="#" class="teal-link" onclick="openDealProfile(${d.id});return false"><strong>${d.deal_name}</strong></a>${noteCountChip(d.note_count)}</td>
                  <td>${d.deal_type || '—'}</td>
                  <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.property_address || '—'}</td>
                  <td>${d.tenant_buyer_name || '—'}</td>
                  <td>${badge(d.status, STATUS_MAP)}</td>
                  <td>${fmtSF(d.size_sf)}</td>
                  <td>${d.deal_type === 'lease' ? (d.lease_rate ? fmt$(d.lease_rate) + '/SF' : '—') : fmt$(d.sale_price)}</td>
                  <td>${fmtDate(d.expected_close_date)}</td>
                  <td id="doc-prog-${d.id}"><span style="color:var(--text-muted);font-size:11px">—</span></td>
                  <td>${fmt$(d.total_commission)}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="editDeal(${d.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDeal(${d.id})">Del</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('add-deal-btn').addEventListener('click', () => openDealModal());
  document.getElementById('filter-deal-status').addEventListener('change', e => { el._statusFilter = e.target.value; loadDeals(); });
  document.getElementById('filter-deal-type').addEventListener('change', e => { el._typeFilter = e.target.value; loadDeals(); });

  deals.forEach(d => {
    API.get(`/api/deals/${d.id}/documents`).then(docs => {
      const cell = document.getElementById(`doc-prog-${d.id}`);
      if (!cell || !docs.length) return;
      const done = docs.filter(x => ['executed','received','n_a'].includes(x.status)).length;
      const pct = Math.round((done / docs.length) * 100);
      cell.innerHTML = `<div class="doc-mini-prog">${done}/${docs.length}<div class="doc-mini-bar"><div class="doc-mini-bar-fill" style="width:${pct}%"></div></div></div>`;
    }).catch(() => {});
  });

  } catch (err) {
    console.error('Deals render error:', err);
    el.innerHTML = `<p style="color:var(--red);padding:20px">Deals error: ${err.message}</p>`;
  }
}

function dealForm(d = {}) {
  const propOptions = propertiesList.map(p => `<option value="${p.id}" ${d.property_id==p.id?'selected':''}>${p.address}</option>`).join('');
  const contactOptions = contactsList.map(c => `<option value="${c.id}" ${d.tenant_buyer_id==c.id?'selected':''}>${c.name}${c.company?' — '+c.company:''}</option>`).join('');
  const lsOptions = contactsList.map(c => `<option value="${c.id}" ${d.landlord_seller_id==c.id?'selected':''}>${c.name}${c.company?' — '+c.company:''}</option>`).join('');

  const isLease = d.deal_type === 'lease';
  const isSale = d.deal_type === 'sale';

  const leaseVal = (d.lease_rate && d.size_sf && d.term_months)
    ? d.lease_rate * d.size_sf * (d.term_months / 12)
    : null;

  return `
    <div class="form-grid">
      <div class="form-group full">
        <label>Deal Name *</label>
        <input id="deal_name" value="${d.deal_name || ''}" placeholder="Smith Retail Lease" />
      </div>
      <div class="form-group">
        <label>Deal Type</label>
        <select id="deal_type" onchange="updateDealFields()">
          <option value="">Select...</option>
          <option value="lease" ${isLease?'selected':''}>Lease</option>
          <option value="sale" ${isSale?'selected':''}>Sale</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="status">
          ${['prospect','loi','under_contract','closed','dead'].map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Property</label>
        <select id="property_id">
          <option value="">None</option>
          ${propOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Tenant / Buyer</label>
        <select id="tenant_buyer_id">
          <option value="">None</option>
          ${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Landlord / Seller</label>
        <select id="landlord_seller_id">
          <option value="">None</option>
          ${lsOptions}
        </select>
      </div>

      <div id="lease-fields" style="${isLease ? '' : 'display:none'}">
        <div class="form-grid" style="padding-top:4px">
          <div class="form-section-title">Lease Details</div>
          <div class="form-group">
            <label>Lease Rate ($/SF/yr)</label>
            <input id="lease_rate" type="number" step="0.01" value="${d.lease_rate || ''}" oninput="calcLeaseValue()" />
          </div>
          <div class="form-group">
            <label>Size (SF)</label>
            <input id="size_sf" type="number" value="${d.size_sf || ''}" oninput="calcLeaseValue()" />
          </div>
          <div class="form-group">
            <label>Term (months)</label>
            <input id="term_months" type="number" value="${d.term_months || ''}" oninput="calcLeaseValue()" />
          </div>
          <div class="form-group">
            <label>TI Allowance ($/SF)</label>
            <input id="ti_allowance" type="number" step="0.01" value="${d.ti_allowance || ''}" />
          </div>
          <div class="form-group">
            <label>Free Rent (months)</label>
            <input id="free_rent_months" type="number" value="${d.free_rent_months || ''}" />
          </div>
          <div class="calc-display" id="lease-calc">
            Total Lease Value: <strong>${leaseVal ? fmt$(leaseVal) : '—'}</strong>
          </div>
        </div>
      </div>

      <div id="sale-fields" style="${isSale ? '' : 'display:none'}">
        <div class="form-grid" style="padding-top:4px">
          <div class="form-section-title">Sale Details</div>
          <div class="form-group">
            <label>Sale Price ($)</label>
            <input id="sale_price" type="number" value="${d.sale_price || ''}" />
          </div>
          <div class="form-group">
            <label>NOI ($)</label>
            <input id="noi" type="number" value="${d.noi || ''}" />
          </div>
          <div class="form-group">
            <label>Cap Rate (%)</label>
            <input id="cap_rate" type="number" step="0.01" value="${d.cap_rate || ''}" />
          </div>
        </div>
      </div>

      <div class="form-section-title">Key Dates</div>
      <div class="form-group">
        <label>LOI Date</label>
        <input id="loi_date" type="date" value="${d.loi_date || ''}" />
      </div>
      <div class="form-group">
        <label>Expected Close Date</label>
        <input id="expected_close_date" type="date" value="${d.expected_close_date || ''}" />
      </div>
      <div class="form-group">
        <label>Actual Close Date</label>
        <input id="actual_close_date" type="date" value="${d.actual_close_date || ''}" />
      </div>
      <div class="form-section-title">Commission</div>
      <div class="form-group">
        <label>Total Commission ($)</label>
        <input id="total_commission" type="number" value="${d.total_commission || ''}" />
      </div>
      <div class="form-group">
        <label>Commission Status</label>
        <select id="commission_status">
          <option value="pending" ${d.commission_status==='pending'||!d.commission_status?'selected':''}>Pending</option>
          <option value="invoiced" ${d.commission_status==='invoiced'?'selected':''}>Invoiced</option>
          <option value="received" ${d.commission_status==='received'?'selected':''}>Received</option>
        </select>
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea id="notes">${d.notes || ''}</textarea>
      </div>
    </div>
  `;
}

window.updateDealFields = function() {
  const type = document.getElementById('deal_type').value;
  const lf = document.getElementById('lease-fields');
  const sf = document.getElementById('sale-fields');
  if (lf) lf.style.display = type === 'lease' ? '' : 'none';
  if (sf) sf.style.display = type === 'sale' ? '' : 'none';
};

window.calcLeaseValue = function() {
  const rate = parseFloat(document.getElementById('lease_rate')?.value);
  const sf = parseFloat(document.getElementById('size_sf')?.value);
  const months = parseFloat(document.getElementById('term_months')?.value);
  const el = document.getElementById('lease-calc');
  if (el) {
    const val = (rate && sf && months) ? rate * sf * (months / 12) : null;
    el.innerHTML = `Total Lease Value: <strong>${val ? fmt$(val) : '—'}</strong>`;
  }
};

function dealModalTabs(activeTab) {
  const tabs = d => [
    { id: 'tab-details', label: 'Details' },
    ...(d ? [{ id: 'tab-documents', label: 'Documents' }, { id: 'tab-vendors', label: 'Vendors' }] : [])
  ];
  return tabs;
}

function dealTabsHtml(activeTab, dealId) {
  return `
    <div class="modal-tabs">
      <button class="modal-tab ${activeTab==='details'?'active':''}" onclick="switchDealTab('details',${dealId})">Details</button>
      <button class="modal-tab ${activeTab==='documents'?'active':''}" onclick="switchDealTab('documents',${dealId})">Documents</button>
      <button class="modal-tab ${activeTab==='vendors'?'active':''}" onclick="switchDealTab('vendors',${dealId})">Vendors</button>
      <button class="modal-tab ${activeTab==='activity'?'active':''}" onclick="switchDealTab('activity',${dealId})">Activity</button>
    </div>`;
}

function dealModalWithTabs(d = {}, activeTab = 'details') {
  const isEdit = !!d.id;
  const tabsHtml = isEdit ? dealTabsHtml(activeTab, d.id) : '';
  return tabsHtml + dealForm(d);
}

window.switchDealTab = async function(tab, dealId) {
  const body = document.getElementById('modal-body');
  if (!body) return;
  const d = await API.get(`/api/deals/${dealId}`);
  if (tab === 'details') {
    body.innerHTML = dealModalWithTabs(d, 'details');
    updateDealFields();
  } else if (tab === 'documents') {
    body.innerHTML = await buildDocumentsTab(dealId, d);
    attachDocListeners(dealId);
  } else if (tab === 'vendors') {
    body.innerHTML = await buildVendorsTab(dealId);
    attachVendorListeners(dealId);
  } else if (tab === 'activity') {
    body.innerHTML = await buildDealActivityTab(dealId);
  }
};

async function buildDocumentsTab(dealId, d) {
  const docs = await API.get(`/api/deals/${dealId}/documents`).catch(() => []);
  const total = docs.length;
  const done = docs.filter(doc => ['executed','received','n_a'].includes(doc.status)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const tabsHtml = dealTabsHtml('documents', dealId);

  const docRows = docs.map(doc => `
    <div class="doc-row status-${doc.status}" id="docrow-${doc.id}">
      <div class="doc-name">${doc.doc_name}</div>
      <select class="doc-status-select doc-status-${doc.status}" onchange="updateDocStatus(${dealId}, ${doc.id}, this.value)">
        ${['pending','sent','received','executed','n_a'].map(s =>
          `<option value="${s}" ${doc.status===s?'selected':''}>${s === 'n_a' ? 'N/A' : s.charAt(0).toUpperCase()+s.slice(1)}</option>`
        ).join('')}
      </select>
      <input type="date" class="doc-due-date" value="${doc.due_date||''}" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"
        onchange="updateDocDate(${dealId}, ${doc.id}, this.value)" title="Due date" />
      <button class="btn btn-sm btn-danger" onclick="deleteDocRow(${dealId}, ${doc.id})" title="Delete">&#10005;</button>
    </div>`).join('');

  return tabsHtml + `
    <div class="doc-progress-bar">
      <div class="doc-progress-label">${done} of ${total} complete (${pct}%)</div>
      <div class="progress-bar-wrap" style="margin:4px 0 0">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="doc-checklist" id="doc-checklist">
      ${docRows || '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">No documents.</p>'}
    </div>
    <div style="margin-top:12px">
      <button class="btn btn-secondary btn-sm" id="add-doc-btn">+ Add Custom Document</button>
    </div>`;
}

function attachDocListeners(dealId) {
  const addBtn = document.getElementById('add-doc-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const name = prompt('Document name:');
      if (!name) return;
      await API.post(`/api/deals/${dealId}/documents`, { doc_name: name });
      _loadDealDocumentsPane(dealId);
    });
  }
}

window.updateDocStatus = async function(dealId, docId, status) {
  const doc = await API.get(`/api/deals/${dealId}/documents`).then(ds => ds.find(x => x.id === docId));
  if (!doc) return;
  const completed_date = ['executed','received'].includes(status) ? today() : null;
  await API.put(`/api/deals/${dealId}/documents/${docId}`, { ...doc, status, completed_date });
  const row = document.getElementById(`docrow-${docId}`);
  if (row) {
    row.className = `doc-row status-${status}`;
    const sel = row.querySelector('.doc-status-select');
    if (sel) { sel.className = `doc-status-select doc-status-${status}`; }
  }
};

window.updateDocDate = async function(dealId, docId, due_date) {
  const doc = await API.get(`/api/deals/${dealId}/documents`).then(ds => ds.find(x => x.id === docId));
  if (!doc) return;
  await API.put(`/api/deals/${dealId}/documents/${docId}`, { ...doc, due_date });
};

window.deleteDocRow = async function(dealId, docId) {
  if (!confirm('Delete this document item?')) return;
  await API.delete(`/api/deals/${dealId}/documents/${docId}`);
  _loadDealDocumentsPane(dealId);
};

async function buildVendorsTab(dealId) {
  const [linked, allVendors] = await Promise.all([
    API.get(`/api/deals/${dealId}/vendors`).catch(() => []),
    API.get('/api/vendors').catch(() => [])
  ]);

  const tabsHtml = dealTabsHtml('vendors', dealId);

  const linkedIds = new Set(linked.map(v => v.vendor_id));
  const available = allVendors.filter(v => !linkedIds.has(v.id));

  const tags = linked.map(v => `
    <div class="vendor-tag" id="vtag-${v.vendor_id}">
      <span>${v.name}${v.company ? ' — ' + v.company : ''}</span>
      ${v.role ? `<span style="color:var(--text-muted);font-size:11px">(${v.role})</span>` : ''}
      <button class="vendor-tag-remove" onclick="unlinkDealVendor(${dealId}, ${v.vendor_id})" title="Remove">&#10005;</button>
    </div>`).join('');

  return tabsHtml + `
    <div style="margin-bottom:12px">
      <div class="form-group" style="margin-bottom:0">
        <label>Key Vendors</label>
        <div class="vendor-tags-row" id="vendor-tags">${tags || '<span style="color:var(--text-muted);font-size:12px">No vendors linked.</span>'}</div>
      </div>
    </div>
    <div class="form-grid" style="margin-top:8px">
      <div class="form-group">
        <label>Add Vendor</label>
        <select id="new-vendor-select">
          <option value="">Select vendor...</option>
          ${available.map(v => `<option value="${v.id}">${v.name}${v.company?' — '+v.company:''} (${v.vendor_type.replace(/_/g,' ')})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role (optional)</label>
        <input id="new-vendor-role" placeholder="e.g. Tenant's Attorney" />
      </div>
    </div>
    <button class="btn btn-secondary btn-sm" id="link-vendor-btn" style="margin-top:8px">+ Link Vendor</button>`;
}

function attachVendorListeners(dealId) {
  const linkBtn = document.getElementById('link-vendor-btn');
  if (linkBtn) {
    linkBtn.addEventListener('click', async () => {
      const vendor_id = val('new-vendor-select');
      const role = val('new-vendor-role');
      if (!vendor_id) { toast('Select a vendor first', 'error'); return; }
      await API.post(`/api/deals/${dealId}/vendors`, { vendor_id, role });
      _loadDealVendorsPane(dealId);
    });
  }
}

window.unlinkDealVendor = async function(dealId, vendorId) {
  await API.delete(`/api/deals/${dealId}/vendors/${vendorId}`);
  _loadDealVendorsPane(dealId);
};

async function buildDealActivityTab(dealId) {
  const activities = await API.get(`/api/activities?deal_id=${dealId}`).catch(() => []);
  const timelineHtml = activities.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px 0">No activities logged for this deal.</p>'
    : `<div class="timeline">${activities.map(a => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-meta">${typeof actBadge === 'function' ? actBadge(a.activity_type) : a.activity_type} &nbsp; ${fmtDate(a.activity_date ? a.activity_date.slice(0,10) : '')}</div>
            <div class="timeline-summary">${a.summary}</div>
            ${a.notes ? `<div class="timeline-notes">${a.notes}</div>` : ''}
          </div>
        </div>`).join('')}
      </div>`;

  return dealTabsHtml('activity', dealId) + `
    <div style="margin-bottom:12px;display:flex;justify-content:flex-end">
      <button class="btn btn-secondary btn-sm" onclick="openActivityModalForDeal(${dealId})">+ Log Activity</button>
    </div>
    ${timelineHtml}`;
}

function openDealModal(d = {}) {
  const html = d.id ? `
    <div class="modal-tabs">
      <button type="button" class="modal-tab active" data-tab="details">Details</button>
      <button type="button" class="modal-tab" data-tab="documents">Documents</button>
      <button type="button" class="modal-tab" data-tab="vendors">Vendors</button>
      <button type="button" class="modal-tab" data-tab="attachments">Attachments</button>
      <button type="button" class="modal-tab" data-tab="notes">Notes</button>
      <button type="button" class="modal-tab" data-tab="activity">Activity</button>
    </div>
    <div class="modal-tab-pane" id="tab-details">${dealForm(d)}</div>
    <div class="modal-tab-pane" id="tab-documents" style="display:none"><p style="color:var(--text-muted);font-size:13px;padding:12px 0">Loading…</p></div>
    <div class="modal-tab-pane" id="tab-vendors" style="display:none"><p style="color:var(--text-muted);font-size:13px;padding:12px 0">Loading…</p></div>
    <div class="modal-tab-pane" id="tab-attachments" style="display:none">${attachmentsTabHtml()}</div>
    <div class="modal-tab-pane" id="tab-notes" style="display:none">${notesTabHtml()}</div>
    <div class="modal-tab-pane" id="tab-activity" style="display:none"><p style="color:var(--text-muted);font-size:13px;padding:12px 0">Loading…</p></div>
  ` : dealForm(d);

  modal.open(d.id ? 'Edit Deal' : 'Add Deal', html, async () => {
    if (!requireField('deal_name', 'Deal name is required')) return;
    const data = formData([
      'deal_name','deal_type','property_id','tenant_buyer_id','landlord_seller_id','status',
      'lease_rate','size_sf','term_months','ti_allowance','free_rent_months',
      'sale_price','noi','cap_rate',
      'loi_date','expected_close_date','actual_close_date',
      'total_commission','commission_status','notes'
    ]);
    try {
      if (d.id) {
        await API.put(`/api/deals/${d.id}`, data);
        toast('Deal updated');
      } else {
        await API.post('/api/deals', data);
        toast('Deal added');
      }
      modal.close();
      loadDeals();
    } catch (e) {
      toast('Error saving deal', 'error');
    }
  });

  if (d.id) {
    initModalTabs();
    _loadDealDocumentsPane(d.id);
    _loadDealVendorsPane(d.id);
    loadAttachmentsTab('deal_id', d.id);
    loadNotesTab('deal_id', d.id);
    _loadDealActivityPane(d.id);
  }
}

// ─── Pane loaders for tabs built by async functions ───────────────────────────
// Strip the old switchDealTab-style tab bar then inject into the pane element.
function _stripTabBar(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const bar = tmp.querySelector('.modal-tabs');
  if (bar) bar.remove();
  return tmp.innerHTML;
}

async function _loadDealDocumentsPane(dealId) {
  const pane = document.getElementById('tab-documents');
  if (!pane) return;
  const d = await API.get(`/api/deals/${dealId}`).catch(() => ({}));
  pane.innerHTML = _stripTabBar(await buildDocumentsTab(dealId, d));
  attachDocListeners(dealId);
}

async function _loadDealVendorsPane(dealId) {
  const pane = document.getElementById('tab-vendors');
  if (!pane) return;
  pane.innerHTML = _stripTabBar(await buildVendorsTab(dealId));
  attachVendorListeners(dealId);
}

async function _loadDealActivityPane(dealId) {
  const pane = document.getElementById('tab-activity');
  if (!pane) return;
  pane.innerHTML = _stripTabBar(await buildDealActivityTab(dealId));
}

async function editDeal(id) {
  const [d, props, contacts] = await Promise.all([
    API.get(`/api/deals/${id}`),
    API.get('/api/properties').catch(() => []),
    API.get('/api/contacts').catch(() => [])
  ]);
  propertiesList = props;
  contactsList = contacts;
  openDealModal(d);
}

async function deleteDeal(id) {
  if (!confirm('Delete this deal? This cannot be undone.')) return;
  await API.delete(`/api/deals/${id}`);
  toast('Deal deleted');
  loadDeals();
}

window.openDealProfile = async function(id) {
  const [d, activities] = await Promise.all([
    API.get(`/api/deals/${id}`),
    API.get(`/api/activities?deal_id=${id}`).catch(() => [])
  ]);

  const isLease = d.deal_type === 'lease';
  const isSale = d.deal_type === 'sale';

  const leaseSection = isLease ? `
    <div class="profile-section">
      <div class="profile-section-title">Lease Details</div>
      <div class="profile-grid">
        <div class="profile-field"><span class="profile-label">Rate</span>${d.lease_rate ? fmt$(d.lease_rate) + '/SF/yr' : '—'}</div>
        <div class="profile-field"><span class="profile-label">Size</span>${d.size_sf ? fmtSF(d.size_sf) : '—'}</div>
        <div class="profile-field"><span class="profile-label">Term</span>${d.term_months ? d.term_months + ' months' : '—'}</div>
        <div class="profile-field"><span class="profile-label">TI Allowance</span>${d.ti_allowance ? fmt$(d.ti_allowance) + '/SF' : '—'}</div>
        <div class="profile-field"><span class="profile-label">Free Rent</span>${d.free_rent_months ? d.free_rent_months + ' months' : '—'}</div>
      </div>
    </div>` : '';

  const saleSection = isSale ? `
    <div class="profile-section">
      <div class="profile-section-title">Sale Details</div>
      <div class="profile-grid">
        <div class="profile-field"><span class="profile-label">Sale Price</span>${d.sale_price ? fmt$(d.sale_price) : '—'}</div>
        <div class="profile-field"><span class="profile-label">NOI</span>${d.noi ? fmt$(d.noi) : '—'}</div>
        <div class="profile-field"><span class="profile-label">Cap Rate</span>${d.cap_rate ? Number(d.cap_rate).toFixed(2) + '%' : '—'}</div>
      </div>
    </div>` : '';

  const recentActs = activities.slice(0, 5);
  const timelineHtml = recentActs.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:12px 0">No recent activities.</p>'
    : `<div class="timeline">${recentActs.map(a => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-meta">${typeof actBadge === 'function' ? actBadge(a.activity_type) : a.activity_type} &nbsp; ${fmtDate(a.activity_date ? a.activity_date.slice(0,10) : '')}</div>
            <div class="timeline-summary">${escapeHtml(a.summary || '')}</div>
            ${a.notes ? `<div class="timeline-notes">${escapeHtml(a.notes)}</div>` : ''}
          </div>
        </div>`).join('')}
      </div>`;

  const html = `
    <div class="profile-header">
      <div>
        <div style="font-size:20px;font-weight:700">${escapeHtml(d.deal_name)}</div>
        ${badge(d.status, STATUS_MAP)}
      </div>
    </div>
    <div class="profile-grid">
      <div class="profile-field"><span class="profile-label">Type</span>${escapeHtml(d.deal_type || '—')}</div>
      <div class="profile-field"><span class="profile-label">Property Address</span>${escapeHtml(d.property_address || '—')}</div>
      <div class="profile-field"><span class="profile-label">Tenant / Buyer</span>${escapeHtml(d.tenant_buyer_name || '—')}</div>
      <div class="profile-field"><span class="profile-label">Landlord / Seller</span>${escapeHtml(d.landlord_seller_name || '—')}</div>
    </div>
    ${leaseSection}
    ${saleSection}
    <div class="profile-section">
      <div class="profile-section-title">Key Dates</div>
      <div class="profile-grid">
        <div class="profile-field"><span class="profile-label">LOI Date</span>${fmtDate(d.loi_date)}</div>
        <div class="profile-field"><span class="profile-label">Expected Close</span>${fmtDate(d.expected_close_date)}</div>
        <div class="profile-field"><span class="profile-label">Actual Close</span>${fmtDate(d.actual_close_date)}</div>
      </div>
    </div>
    <div class="profile-section">
      <div class="profile-section-title">Commission</div>
      <div class="profile-grid">
        <div class="profile-field"><span class="profile-label">Amount</span>${d.total_commission ? fmt$(d.total_commission) : '—'}</div>
        <div class="profile-field"><span class="profile-label">Status</span>${badge(d.commission_status, STATUS_MAP)}</div>
      </div>
    </div>
    ${d.notes ? `<div class="profile-section"><div class="profile-section-title">Notes</div><div style="font-size:13px;color:var(--text-muted);white-space:pre-wrap">${escapeHtml(d.notes)}</div></div>` : ''}
    <div class="profile-section">
      <div class="profile-section-title">Recent Activities</div>
      ${timelineHtml}
    </div>
    <div style="margin-top:16px">
      <button class="btn btn-secondary" onclick="modal.close();editDeal(${id})">Edit Deal</button>
    </div>
  `;

  modal.open('Deal Profile', html, null);
  document.getElementById('modal-save').style.display = 'none';
};
