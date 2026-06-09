PAGE_LOADERS.comps = loadComps;

const PROP_TYPES = ['retail','office','industrial','land','mixed-use'];
let compsActiveTab = 'leases';

async function loadComps() {
  const el = document.getElementById('page-comps');
  const typeFilter = el._typeFilter || '';
  const subFilter = el._subFilter || '';
  const fromFilter = el._fromFilter || '';
  const toFilter = el._toFilter || '';

  const [leases, sales, summary] = await Promise.all([
    API.get('/api/comps/leases' + buildCompsQS(typeFilter, subFilter)).catch(() => []),
    API.get('/api/comps/sales' + buildCompsQS(typeFilter, subFilter)).catch(() => []),
    API.get('/api/comps/summary').catch(() => ({ avg_lease_rate_by_type: [], avg_sale_price_psf_by_type: [] }))
  ]);

  const filteredLeases = applyDateFilter(leases, 'date_signed', fromFilter, toFilter);
  const filteredSales = applyDateFilter(sales, 'close_date', fromFilter, toFilter);

  const summaryChips = [
    ...summary.avg_lease_rate_by_type.map(r =>
      `<span class="stat-chip"><strong>${cap(r.property_type)}</strong> Avg Rate: ${r.avg_rate ? '$' + Number(r.avg_rate).toFixed(2) + '/SF' : '—'} <em>(${r.count} lease${r.count!==1?'s':''})</em></span>`),
    ...summary.avg_sale_price_psf_by_type.map(r =>
      `<span class="stat-chip"><strong>${cap(r.property_type)}</strong> Avg $/SF: ${r.avg_price_psf ? '$' + Number(r.avg_price_psf).toFixed(0) : '—'} <em>(${r.count} sale${r.count!==1?'s':''})</em></span>`)
  ].join('') || '<span style="color:var(--text-muted);font-size:13px">No comp data yet.</span>';

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Comps Database</h1>
      <button class="btn btn-primary" id="add-comp-btn">+ Add Comp</button>
    </div>
    <div class="stats-chips-bar">${summaryChips}</div>
    <div class="filter-bar" style="margin-top:12px">
      <select id="filter-comp-type">
        <option value="">All Types</option>
        ${PROP_TYPES.map(t => `<option value="${t}" ${typeFilter===t?'selected':''}>${cap(t)}</option>`).join('')}
      </select>
      <input type="text" id="filter-comp-sub" value="${subFilter}" placeholder="Submarket search..." style="min-width:160px" />
      <input type="date" id="filter-comp-from" value="${fromFilter}" title="From date" />
      <input type="date" id="filter-comp-to" value="${toFilter}" title="To date" />
      <button class="btn btn-secondary btn-sm" id="export-comp-btn">&#8595; Export CSV</button>
    </div>
    <div class="view-toggle" style="margin-bottom:12px">
      <button id="tab-leases" class="${compsActiveTab==='leases'?'active':''}">Lease Comps</button>
      <button id="tab-sales" class="${compsActiveTab==='sales'?'active':''}">Sale Comps</button>
    </div>
    <div id="comps-table-area"></div>
  `;

  renderCompsTable(compsActiveTab === 'leases' ? filteredLeases : filteredSales, compsActiveTab);

  el.querySelector('#tab-leases').addEventListener('click', () => { compsActiveTab = 'leases'; renderCompsTable(filteredLeases, 'leases'); document.getElementById('tab-leases').classList.add('active'); document.getElementById('tab-sales').classList.remove('active'); });
  el.querySelector('#tab-sales').addEventListener('click', () => { compsActiveTab = 'sales'; renderCompsTable(filteredSales, 'sales'); document.getElementById('tab-sales').classList.add('active'); document.getElementById('tab-leases').classList.remove('active'); });
  el.querySelector('#filter-comp-type').addEventListener('change', e => { el._typeFilter = e.target.value; loadComps(); });
  el.querySelector('#filter-comp-sub').addEventListener('input', e => { el._subFilter = e.target.value; loadComps(); });
  el.querySelector('#filter-comp-from').addEventListener('change', e => { el._fromFilter = e.target.value; loadComps(); });
  el.querySelector('#filter-comp-to').addEventListener('change', e => { el._toFilter = e.target.value; loadComps(); });
  el.querySelector('#add-comp-btn').addEventListener('click', () => {
    if (compsActiveTab === 'leases') openLeaseCompModal();
    else openSaleCompModal();
  });
  el.querySelector('#export-comp-btn').addEventListener('click', () => {
    if (compsActiveTab === 'leases') exportCSV(filteredLeases, 'lease_comps');
    else exportCSV(filteredSales, 'sale_comps');
  });
}

function buildCompsQS(type, sub) {
  const qs = [];
  if (type) qs.push(`property_type=${encodeURIComponent(type)}`);
  if (sub) qs.push(`submarket=${encodeURIComponent(sub)}`);
  return qs.length ? '?' + qs.join('&') : '';
}

function applyDateFilter(rows, field, from, to) {
  let r = rows;
  if (from) r = r.filter(x => x[field] && x[field] >= from);
  if (to) r = r.filter(x => x[field] && x[field] <= to);
  return r;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function renderCompsTable(rows, tab) {
  const area = document.getElementById('comps-table-area');
  if (!area) return;
  if (tab === 'leases') {
    area.innerHTML = `
      <div class="table-card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Address</th><th>Submarket</th><th>Type</th><th>Tenant</th>
              <th>SF</th><th>Rate $/SF/yr</th><th>Structure</th><th>Term</th>
              <th>TI</th><th>Free Rent</th><th>Date Signed</th><th>Source</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${rows.length === 0
                ? `<tr><td colspan="13"><div class="empty-state"><div class="empty-state-icon">&#128202;</div><div class="empty-state-text">No lease comps yet.</div></div></td></tr>`
                : rows.map(r => `<tr>
                    <td><strong>${r.address}</strong>${r.city?'<br><small style="color:var(--text-muted)">'+r.city+'</small>':''}</td>
                    <td>${r.submarket || '—'}</td>
                    <td>${r.property_type || '—'}</td>
                    <td>${r.tenant_name || '—'}</td>
                    <td>${r.size_sf ? Number(r.size_sf).toLocaleString() : '—'}</td>
                    <td>${r.lease_rate ? '$' + Number(r.lease_rate).toFixed(2) : '—'}</td>
                    <td>${r.lease_structure || '—'}</td>
                    <td>${r.term_months ? r.term_months + ' mo' : '—'}</td>
                    <td>${r.ti_allowance ? '$' + Number(r.ti_allowance).toFixed(2) : '—'}</td>
                    <td>${r.free_rent_months ? r.free_rent_months + ' mo' : '—'}</td>
                    <td>${fmtDate(r.date_signed)}</td>
                    <td>${r.source || '—'}</td>
                    <td class="actions-cell">
                      <button class="btn btn-sm btn-secondary" onclick="editLeaseComp(${r.id})">Edit</button>
                      <button class="btn btn-sm btn-danger" onclick="deleteLeaseComp(${r.id})">Del</button>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } else {
    area.innerHTML = `
      <div class="table-card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Address</th><th>Submarket</th><th>Type</th><th>Buyer</th>
              <th>SF</th><th>Sale Price</th><th>$/SF</th><th>Cap Rate</th>
              <th>NOI</th><th>Close Date</th><th>Source</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${rows.length === 0
                ? `<tr><td colspan="12"><div class="empty-state"><div class="empty-state-icon">&#128202;</div><div class="empty-state-text">No sale comps yet.</div></div></td></tr>`
                : rows.map(r => `<tr>
                    <td><strong>${r.address}</strong>${r.city?'<br><small style="color:var(--text-muted)">'+r.city+'</small>':''}</td>
                    <td>${r.submarket || '—'}</td>
                    <td>${r.property_type || '—'}</td>
                    <td>${r.buyer_name || '—'}</td>
                    <td>${r.size_sf ? Number(r.size_sf).toLocaleString() : '—'}</td>
                    <td>${r.sale_price ? fmt$(r.sale_price) : '—'}</td>
                    <td>${r.price_per_sf ? '$' + Number(r.price_per_sf).toFixed(0) : '—'}</td>
                    <td>${r.cap_rate ? Number(r.cap_rate).toFixed(2) + '%' : '—'}</td>
                    <td>${r.noi ? fmt$(r.noi) : '—'}</td>
                    <td>${fmtDate(r.close_date)}</td>
                    <td>${r.source || '—'}</td>
                    <td class="actions-cell">
                      <button class="btn btn-sm btn-secondary" onclick="editSaleComp(${r.id})">Edit</button>
                      <button class="btn btn-sm btn-danger" onclick="deleteSaleComp(${r.id})">Del</button>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }
}

function leaseCompForm(r = {}) {
  return `
    <div class="form-grid">
      <div class="form-group full"><label>Address *</label><input id="lc_address" value="${r.address||''}" /></div>
      <div class="form-group"><label>City</label><input id="lc_city" value="${r.city||''}" /></div>
      <div class="form-group"><label>Submarket</label><input id="lc_submarket" value="${r.submarket||''}" /></div>
      <div class="form-group"><label>Property Type</label>
        <select id="lc_property_type">
          <option value="">Select...</option>
          ${PROP_TYPES.map(t => `<option value="${t}" ${r.property_type===t?'selected':''}>${cap(t)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Tenant Name</label><input id="lc_tenant_name" value="${r.tenant_name||''}" /></div>
      <div class="form-group"><label>Landlord Name</label><input id="lc_landlord_name" value="${r.landlord_name||''}" /></div>
      <div class="form-group"><label>Size (SF)</label><input id="lc_size_sf" type="number" value="${r.size_sf||''}" /></div>
      <div class="form-group"><label>Lease Rate ($/SF/yr)</label><input id="lc_lease_rate" type="number" step="0.01" value="${r.lease_rate||''}" /></div>
      <div class="form-group"><label>Lease Structure</label>
        <select id="lc_lease_structure">
          <option value="">Select...</option>
          ${['NNN','Modified Gross','Full Gross','Other'].map(s => `<option value="${s}" ${r.lease_structure===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Term (months)</label><input id="lc_term_months" type="number" value="${r.term_months||''}" /></div>
      <div class="form-group"><label>TI Allowance ($/SF)</label><input id="lc_ti_allowance" type="number" step="0.01" value="${r.ti_allowance||''}" /></div>
      <div class="form-group"><label>Free Rent (months)</label><input id="lc_free_rent_months" type="number" value="${r.free_rent_months||''}" /></div>
      <div class="form-group"><label>Lease Start</label><input id="lc_lease_start_date" type="date" value="${r.lease_start_date||''}" /></div>
      <div class="form-group"><label>Lease End</label><input id="lc_lease_end_date" type="date" value="${r.lease_end_date||''}" /></div>
      <div class="form-group"><label>Date Signed</label><input id="lc_date_signed" type="date" value="${r.date_signed||''}" /></div>
      <div class="form-group"><label>Source</label><input id="lc_source" value="${r.source||''}" placeholder="CoStar, direct, etc." /></div>
      <div class="form-group full"><label>Notes</label><textarea id="lc_notes">${r.notes||''}</textarea></div>
    </div>`;
}

function saleCompForm(r = {}) {
  return `
    <div class="form-grid">
      <div class="form-group full"><label>Address *</label><input id="sc_address" value="${r.address||''}" /></div>
      <div class="form-group"><label>City</label><input id="sc_city" value="${r.city||''}" /></div>
      <div class="form-group"><label>Submarket</label><input id="sc_submarket" value="${r.submarket||''}" /></div>
      <div class="form-group"><label>Property Type</label>
        <select id="sc_property_type" onchange="toggleLandAcres()">
          <option value="">Select...</option>
          ${PROP_TYPES.map(t => `<option value="${t}" ${r.property_type===t?'selected':''}>${cap(t)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Buyer Name</label><input id="sc_buyer_name" value="${r.buyer_name||''}" /></div>
      <div class="form-group"><label>Seller Name</label><input id="sc_seller_name" value="${r.seller_name||''}" /></div>
      <div class="form-group"><label>Size (SF)</label><input id="sc_size_sf" type="number" value="${r.size_sf||''}" oninput="calcPSF()" /></div>
      <div class="form-group" id="land-acres-group" style="${r.property_type==='land'?'':'display:none'}">
        <label>Land (acres)</label><input id="sc_land_acres" type="number" step="0.01" value="${r.land_acres||''}" />
      </div>
      <div class="form-group">
        <label>Sale Price ($)</label>
        <input id="sc_sale_price" type="number" value="${r.sale_price||''}" oninput="calcPSF()" />
        <span id="psf-calc" style="font-size:11px;color:var(--teal);margin-top:2px">${r.price_per_sf?'$'+Number(r.price_per_sf).toFixed(0)+'/SF':''}</span>
      </div>
      <div class="form-group"><label>NOI ($)</label><input id="sc_noi" type="number" value="${r.noi||''}" /></div>
      <div class="form-group"><label>Cap Rate (%)</label><input id="sc_cap_rate" type="number" step="0.01" value="${r.cap_rate||''}" /></div>
      <div class="form-group"><label>Year Built</label><input id="sc_year_built" type="number" value="${r.year_built||''}" /></div>
      <div class="form-group"><label>Occupancy % at Sale</label><input id="sc_occupancy_pct" type="number" step="0.1" value="${r.occupancy_pct||''}" /></div>
      <div class="form-group"><label>Close Date</label><input id="sc_close_date" type="date" value="${r.close_date||''}" /></div>
      <div class="form-group"><label>Source</label><input id="sc_source" value="${r.source||''}" placeholder="CoStar, direct, etc." /></div>
      <div class="form-group full"><label>Notes</label><textarea id="sc_notes">${r.notes||''}</textarea></div>
    </div>`;
}

window.toggleLandAcres = function() {
  const pt = document.getElementById('sc_property_type')?.value;
  const g = document.getElementById('land-acres-group');
  if (g) g.style.display = pt === 'land' ? '' : 'none';
};

window.calcPSF = function() {
  const price = parseFloat(document.getElementById('sc_sale_price')?.value);
  const sf = parseFloat(document.getElementById('sc_size_sf')?.value);
  const el = document.getElementById('psf-calc');
  if (el) el.textContent = (price && sf && sf > 0) ? '$' + (price/sf).toFixed(0) + '/SF' : '';
};

function openLeaseCompModal(r = {}) {
  modal.open(r.id ? 'Edit Lease Comp' : 'Add Lease Comp', leaseCompForm(r), async () => {
    if (!requireField('lc_address', 'Address is required')) return;
    const data = {
      address: val('lc_address'), city: val('lc_city'), submarket: val('lc_submarket'),
      property_type: val('lc_property_type'), tenant_name: val('lc_tenant_name'),
      landlord_name: val('lc_landlord_name'), size_sf: val('lc_size_sf') || null,
      lease_rate: val('lc_lease_rate') || null, lease_structure: val('lc_lease_structure'),
      term_months: val('lc_term_months') || null, ti_allowance: val('lc_ti_allowance') || null,
      free_rent_months: val('lc_free_rent_months') || null,
      lease_start_date: val('lc_lease_start_date') || null, lease_end_date: val('lc_lease_end_date') || null,
      date_signed: val('lc_date_signed') || null, source: val('lc_source'), notes: val('lc_notes')
    };
    try {
      if (r.id) { await API.put(`/api/comps/leases/${r.id}`, data); toast('Lease comp updated'); }
      else { await API.post('/api/comps/leases', data); toast('Lease comp added'); }
      modal.close(); loadComps();
    } catch (e) { toast('Error saving comp', 'error'); }
  });
}

function openSaleCompModal(r = {}) {
  modal.open(r.id ? 'Edit Sale Comp' : 'Add Sale Comp', saleCompForm(r), async () => {
    if (!requireField('sc_address', 'Address is required')) return;
    const data = {
      address: val('sc_address'), city: val('sc_city'), submarket: val('sc_submarket'),
      property_type: val('sc_property_type'), buyer_name: val('sc_buyer_name'),
      seller_name: val('sc_seller_name'), size_sf: val('sc_size_sf') || null,
      land_acres: val('sc_land_acres') || null, sale_price: val('sc_sale_price') || null,
      noi: val('sc_noi') || null, cap_rate: val('sc_cap_rate') || null,
      year_built: val('sc_year_built') || null, occupancy_pct: val('sc_occupancy_pct') || null,
      close_date: val('sc_close_date') || null, source: val('sc_source'), notes: val('sc_notes')
    };
    try {
      if (r.id) { await API.put(`/api/comps/sales/${r.id}`, data); toast('Sale comp updated'); }
      else { await API.post('/api/comps/sales', data); toast('Sale comp added'); }
      modal.close(); loadComps();
    } catch (e) { toast('Error saving comp', 'error'); }
  });
}

async function editLeaseComp(id) {
  const r = await API.get(`/api/comps/leases/${id}`);
  openLeaseCompModal(r);
}
async function deleteLeaseComp(id) {
  if (!confirm('Delete this lease comp?')) return;
  await API.delete(`/api/comps/leases/${id}`);
  toast('Lease comp deleted'); loadComps();
}
async function editSaleComp(id) {
  const r = await API.get(`/api/comps/sales/${id}`);
  openSaleCompModal(r);
}
async function deleteSaleComp(id) {
  if (!confirm('Delete this sale comp?')) return;
  await API.delete(`/api/comps/sales/${id}`);
  toast('Sale comp deleted'); loadComps();
}

function exportCSV(rows, name) {
  if (!rows.length) { toast('No data to export', 'error'); return; }
  const headers = Object.keys(rows[0]);
  const csvContent = [headers.join(','), ...rows.map(r => headers.map(h => {
    const v = r[h] == null ? '' : String(r[h]);
    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}_${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
}
