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
      <button class="btn btn-primary" id="add-property-btn">+ Add Property</button>
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
                  <td><strong>${p.address}</strong>${p.city ? `<br><small style="color:var(--text-muted)">${p.city}, ${p.state || 'TX'}</small>` : ''}</td>
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
  modal.open(p.id ? 'Edit Property' : 'Add Property', propertyForm(p), async () => {
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
