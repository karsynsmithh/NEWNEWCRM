PAGE_LOADERS.deals = loadDeals;

let propertiesList = [];
let contactsList = [];

async function loadDeals() {
  const el = document.getElementById('page-deals');
  const statusFilter = el._statusFilter || '';
  const typeFilter = el._typeFilter || '';

  let url = '/api/deals';
  const qs = [];
  if (statusFilter) qs.push(`status=${statusFilter}`);
  if (typeFilter) qs.push(`deal_type=${typeFilter}`);
  if (qs.length) url += '?' + qs.join('&');

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
      <button class="btn btn-primary" id="add-deal-btn">+ Add Deal</button>
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
              <th>Commission</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${deals.length === 0
              ? `<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">&#129309;</div><div class="empty-state-text">No deals yet. Add your first deal.</div></div></td></tr>`
              : deals.map(d => `
                <tr>
                  <td><strong>${d.deal_name}</strong></td>
                  <td>${d.deal_type || '—'}</td>
                  <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.property_address || '—'}</td>
                  <td>${d.tenant_buyer_name || '—'}</td>
                  <td>${badge(d.status, STATUS_MAP)}</td>
                  <td>${fmtSF(d.size_sf)}</td>
                  <td>${d.deal_type === 'lease' ? (d.lease_rate ? fmt$(d.lease_rate) + '/SF' : '—') : fmt$(d.sale_price)}</td>
                  <td>${fmtDate(d.expected_close_date)}</td>
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

function openDealModal(d = {}) {
  modal.open(d.id ? 'Edit Deal' : 'Add Deal', dealForm(d), async () => {
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
