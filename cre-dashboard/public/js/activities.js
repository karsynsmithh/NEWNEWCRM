PAGE_LOADERS.activities = loadActivities;

const ACTIVITY_TYPES = ['call','email','meeting','site_tour','loi_sent','loi_countered','lease_sent','lease_executed','voicemail','text','other'];

const ACTIVITY_BADGE = {
  call: 'act-call', email: 'act-email', meeting: 'act-meeting',
  site_tour: 'act-site_tour', loi_sent: 'act-loi', loi_countered: 'act-loi',
  lease_sent: 'act-lease', lease_executed: 'act-lease',
  voicemail: 'act-gray', text: 'act-gray', other: 'act-gray'
};

function actBadge(type) {
  const cls = ACTIVITY_BADGE[type] || 'act-gray';
  return `<span class="act-badge ${cls}">${(type || '').replace(/_/g, ' ')}</span>`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  if (diff < 30) return `${diff} days ago`;
  const months = Math.floor(diff / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

async function loadActivities() {
  const el = document.getElementById('page-activities');
  const typeFilter = el._typeFilter || '';
  const fromFilter = el._fromFilter || '';
  const toFilter = el._toFilter || '';
  const contactSearch = el._contactSearch || '';

  const [activities, contacts, deals, properties] = await Promise.all([
    API.get('/api/activities').catch(() => []),
    API.get('/api/contacts').catch(() => []),
    API.get('/api/deals').catch(() => []),
    API.get('/api/properties').catch(() => [])
  ]);

  let filtered = activities;
  if (typeFilter) filtered = filtered.filter(a => a.activity_type === typeFilter);
  if (fromFilter) filtered = filtered.filter(a => a.activity_date >= fromFilter);
  if (toFilter) filtered = filtered.filter(a => a.activity_date <= toFilter + 'T23:59:59');
  if (contactSearch) {
    const s = contactSearch.toLowerCase();
    filtered = filtered.filter(a => a.contact_name && a.contact_name.toLowerCase().includes(s));
  }

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Activity Log</h1>
      <button class="btn btn-primary" id="add-activity-btn">+ Log Activity</button>
    </div>
    <div class="filter-bar">
      <select id="filter-act-type">
        <option value="">All Types</option>
        ${ACTIVITY_TYPES.map(t => `<option value="${t}" ${typeFilter===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}
      </select>
      <input type="date" id="filter-act-from" value="${fromFilter}" placeholder="From date" title="From date" />
      <input type="date" id="filter-act-to" value="${toFilter}" placeholder="To date" title="To date" />
      <input type="text" id="filter-act-contact" value="${contactSearch}" placeholder="Search contact..." style="min-width:160px" />
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date &amp; Time</th><th>Type</th><th>Summary</th><th>Contact</th>
              <th>Deal / Property</th><th>Duration</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">&#128203;</div><div class="empty-state-text">No activities logged yet.</div></div></td></tr>`
              : filtered.map(a => `
                <tr>
                  <td style="white-space:nowrap">${fmtDateTime(a.activity_date)}</td>
                  <td>${actBadge(a.activity_type)}</td>
                  <td>${a.summary}</td>
                  <td>${a.contact_id
                    ? `<a href="#" class="teal-link" onclick="editContact(${a.contact_id});return false">${a.contact_name || '—'}</a>`
                    : '—'}</td>
                  <td>${a.deal_name || a.property_address || '—'}</td>
                  <td>${a.duration_minutes ? a.duration_minutes + ' min' : '—'}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="editActivity(${a.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteActivity(${a.id})">Del</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('add-activity-btn').addEventListener('click', () => openActivityModal({}, contacts, deals, properties));
  document.getElementById('filter-act-type').addEventListener('change', e => { el._typeFilter = e.target.value; loadActivities(); });
  document.getElementById('filter-act-from').addEventListener('change', e => { el._fromFilter = e.target.value; loadActivities(); });
  document.getElementById('filter-act-to').addEventListener('change', e => { el._toFilter = e.target.value; loadActivities(); });
  document.getElementById('filter-act-contact').addEventListener('input', e => { el._contactSearch = e.target.value; loadActivities(); });
}

function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function activityForm(a = {}, contacts = [], deals = [], properties = []) {
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return `
    <div class="form-grid">
      <div class="form-group">
        <label>Activity Type *</label>
        <select id="activity_type">
          <option value="">Select...</option>
          ${ACTIVITY_TYPES.map(t => `<option value="${t}" ${a.activity_type===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Date &amp; Time *</label>
        <input id="activity_date" type="datetime-local" value="${a.activity_date ? a.activity_date.slice(0,16) : nowLocal}" />
      </div>
      <div class="form-group full">
        <label>Summary *</label>
        <input id="summary" value="${a.summary || ''}" placeholder="Brief description of the activity..." />
      </div>
      <div class="form-group">
        <label>Duration (minutes)</label>
        <input id="duration_minutes" type="number" min="0" value="${a.duration_minutes || ''}" />
      </div>
      <div class="form-group">
        <label>Linked Contact</label>
        <select id="contact_id">
          <option value="">None</option>
          ${contacts.map(c => `<option value="${c.id}" ${a.contact_id==c.id?'selected':''}>${c.name}${c.company?' — '+c.company:''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Linked Deal</label>
        <select id="deal_id">
          <option value="">None</option>
          ${deals.map(d => `<option value="${d.id}" ${a.deal_id==d.id?'selected':''}>${d.deal_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Linked Property</label>
        <select id="property_id">
          <option value="">None</option>
          ${properties.map(p => `<option value="${p.id}" ${a.property_id==p.id?'selected':''}>${p.address}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea id="notes">${a.notes || ''}</textarea>
      </div>
    </div>
  `;
}

function openActivityModal(a = {}, contacts = [], deals = [], properties = [], prefillContactId = null) {
  if (prefillContactId && !a.contact_id) a = { ...a, contact_id: prefillContactId };
  modal.open(a.id ? 'Edit Activity' : 'Log Activity', activityForm(a, contacts, deals, properties), async () => {
    if (!requireField('activity_type', 'Activity type is required')) return;
    if (!requireField('summary', 'Summary is required')) return;
    if (!requireField('activity_date', 'Date & Time is required')) return;
    const data = formData(['activity_type','summary','notes','activity_date','duration_minutes','contact_id','deal_id','property_id']);
    try {
      if (a.id) {
        await API.put(`/api/activities/${a.id}`, data);
        toast('Activity updated');
      } else {
        await API.post('/api/activities', data);
        toast('Activity logged');
      }
      modal.close();
      if (PAGE_LOADERS.activities) loadActivities();
    } catch (e) {
      toast('Error saving activity', 'error');
    }
  });
}

async function editActivity(id) {
  const [a, contacts, deals, properties] = await Promise.all([
    API.get(`/api/activities/${id}`),
    API.get('/api/contacts').catch(() => []),
    API.get('/api/deals').catch(() => []),
    API.get('/api/properties').catch(() => [])
  ]);
  openActivityModal(a, contacts, deals, properties);
}

async function deleteActivity(id) {
  if (!confirm('Delete this activity? This cannot be undone.')) return;
  await API.delete(`/api/activities/${id}`);
  toast('Activity deleted');
  loadActivities();
}

window.openActivityModalForContact = async function(contactId) {
  const [contacts, deals, properties] = await Promise.all([
    API.get('/api/contacts').catch(() => []),
    API.get('/api/deals').catch(() => []),
    API.get('/api/properties').catch(() => [])
  ]);
  openActivityModal({}, contacts, deals, properties, contactId);
};

window.openActivityModalForDeal = async function(dealId) {
  const [contacts, deals, properties] = await Promise.all([
    API.get('/api/contacts').catch(() => []),
    API.get('/api/deals').catch(() => []),
    API.get('/api/properties').catch(() => [])
  ]);
  openActivityModal({ deal_id: dealId }, contacts, deals, properties);
};
