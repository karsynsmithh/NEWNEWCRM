PAGE_LOADERS.contacts = loadContacts;

const STAGES = ['prospect', 'active', 'loi', 'under_contract', 'closed', 'dead'];
const STAGE_LABELS = {
  prospect: 'Prospect', active: 'Active', loi: 'LOI',
  under_contract: 'Under Contract', closed: 'Closed', dead: 'Dead'
};

let contactsViewMode = 'kanban';

async function loadContacts() {
  const el = document.getElementById('page-contacts');
  const contacts = await API.get('/api/contacts').catch(() => []);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Contacts</h1>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="view-toggle">
          <button id="view-kanban" class="${contactsViewMode === 'kanban' ? 'active' : ''}">&#9640; Board</button>
          <button id="view-list" class="${contactsViewMode === 'list' ? 'active' : ''}">&#9776; List</button>
        </div>
        <a href="/api/contacts/export.csv" class="btn btn-secondary" download>&#8595; Export CSV</a>
        <button class="btn btn-primary" id="add-contact-btn">+ Add Contact</button>
      </div>
    </div>
    <div id="contacts-view"></div>
  `;

  document.getElementById('add-contact-btn').addEventListener('click', () => openContactModal());
  document.getElementById('view-kanban').addEventListener('click', () => { contactsViewMode = 'kanban'; loadContacts(); });
  document.getElementById('view-list').addEventListener('click', () => { contactsViewMode = 'list'; loadContacts(); });

  if (contactsViewMode === 'kanban') {
    renderKanban(contacts);
  } else {
    renderContactList(contacts);
  }
}

function renderKanban(contacts) {
  const view = document.getElementById('contacts-view');
  const byStage = {};
  STAGES.forEach(s => byStage[s] = []);
  contacts.forEach(c => { if (byStage[c.pipeline_stage]) byStage[c.pipeline_stage].push(c); });

  view.innerHTML = `<div class="kanban-board">
    ${STAGES.map(stage => `
      <div class="kanban-col ${stage === 'dead' ? 'dead-col' : ''}">
        <div class="kanban-col-header">
          <span>${STAGE_LABELS[stage]}</span>
          <span class="col-count">${byStage[stage].length}</span>
        </div>
        <div class="kanban-cards">
          ${byStage[stage].length === 0
            ? '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px 0">Empty</p>'
            : byStage[stage].map(c => `
              <div class="kanban-card" onclick="editContact(${c.id})">
                <div class="kanban-card-name">${c.name}${noteCountChip(c.note_count)}</div>
                <div class="kanban-card-company">${c.company || '—'}</div>
                <div class="kanban-card-meta">
                  ${c.phone ? `<span>&#128222; ${c.phone}</span>` : ''}
                  ${c.req_property_type ? `<span>&#127968; ${c.req_property_type}</span>` : ''}
                  ${c.next_followup_date ? `<span>&#128197; ${fmtDate(c.next_followup_date)}</span>` : ''}
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function renderContactList(contacts) {
  const view = document.getElementById('contacts-view');
  view.innerHTML = `
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th>Type</th><th>Stage</th>
              <th>Phone</th><th>Req Type</th><th>Next Follow-up</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${contacts.length === 0
              ? `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">&#128101;</div><div class="empty-state-text">No contacts yet.</div></div></td></tr>`
              : contacts.map(c => `
                <tr>
                  <td><strong>${c.name}</strong>${noteCountChip(c.note_count)}</td>
                  <td>${c.company || '—'}</td>
                  <td>${c.contact_type || '—'}</td>
                  <td>${badge(c.pipeline_stage, STATUS_MAP)}</td>
                  <td>${c.phone || '—'}</td>
                  <td>${c.req_property_type || '—'}</td>
                  <td>${fmtDate(c.next_followup_date)}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="editContact(${c.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteContact(${c.id})">Del</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function contactForm(c = {}) {
  return `
    <div class="form-grid">
      <div class="form-group full">
        <label>Name *</label>
        <input id="name" value="${c.name || ''}" placeholder="Jane Smith" />
      </div>
      <div class="form-group">
        <label>Company</label>
        <input id="company" value="${c.company || ''}" />
      </div>
      <div class="form-group">
        <label>Contact Type</label>
        <select id="contact_type">
          <option value="">Select...</option>
          ${['landlord','tenant','buyer','seller','broker','other'].map(t => `<option value="${t}" ${c.contact_type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="email" type="email" value="${c.email || ''}" />
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input id="phone" value="${c.phone || ''}" />
      </div>
      <div class="form-group">
        <label>Pipeline Stage</label>
        <select id="pipeline_stage">
          ${STAGES.map(s => `<option value="${s}" ${c.pipeline_stage===s?'selected':''}>${STAGE_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="form-section-title">Requirements</div>
      <div class="form-group">
        <label>Min Size (SF)</label>
        <input id="req_size_min" type="number" value="${c.req_size_min || ''}" />
      </div>
      <div class="form-group">
        <label>Max Size (SF)</label>
        <input id="req_size_max" type="number" value="${c.req_size_max || ''}" />
      </div>
      <div class="form-group">
        <label>Max Budget ($)</label>
        <input id="req_budget" type="number" value="${c.req_budget || ''}" />
      </div>
      <div class="form-group">
        <label>Preferred Location</label>
        <input id="req_location" value="${c.req_location || ''}" placeholder="Houston Heights, Midtown..." />
      </div>
      <div class="form-group full">
        <label>Property Type Preference</label>
        <input id="req_property_type" value="${c.req_property_type || ''}" placeholder="retail, office..." />
      </div>
      <div class="form-group">
        <label>Next Follow-up Date</label>
        <input id="next_followup_date" type="date" value="${c.next_followup_date || ''}" />
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea id="notes">${c.notes || ''}</textarea>
      </div>
    </div>
  `;
}

function openContactModal(c = {}) {
  const html = c.id ? `
    <div class="modal-tabs">
      <button type="button" class="modal-tab active" data-tab="details">Details</button>
      <button type="button" class="modal-tab" data-tab="notes">Notes</button>
    </div>
    <div class="modal-tab-pane" id="tab-details">${contactForm(c)}</div>
    <div class="modal-tab-pane" id="tab-notes" style="display:none">${notesTabHtml()}</div>
  ` : contactForm(c);

  modal.open(c.id ? 'Edit Contact' : 'Add Contact', html, async () => {
    if (!requireField('name', 'Name is required')) return;
    const data = formData(['name','company','email','phone','contact_type','pipeline_stage',
      'req_size_min','req_size_max','req_budget','req_location','req_property_type',
      'next_followup_date','notes']);
    try {
      if (c.id) {
        await API.put(`/api/contacts/${c.id}`, data);
        toast('Contact updated');
      } else {
        await API.post('/api/contacts', data);
        toast('Contact added');
      }
      modal.close();
      loadContacts();
    } catch (e) {
      toast('Error saving contact', 'error');
    }
  });

  if (c.id) {
    initModalTabs();
    loadNotesTab('contact_id', c.id);
  }
}

async function editContact(id) {
  const c = await API.get(`/api/contacts/${id}`);
  openContactModal(c);
}

async function deleteContact(id) {
  if (!confirm('Delete this contact? This cannot be undone.')) return;
  await API.delete(`/api/contacts/${id}`);
  toast('Contact deleted');
  loadContacts();
}
