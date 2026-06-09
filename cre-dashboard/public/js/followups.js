PAGE_LOADERS.followups = loadFollowups;

async function loadFollowups() {
  const el = document.getElementById('page-followups');
  const showCompleted = el._showCompleted || false;

  const [followups, contacts, deals] = await Promise.all([
    API.get('/api/followups').catch(() => []),
    API.get('/api/contacts').catch(() => []),
    API.get('/api/deals').catch(() => [])
  ]);

  const todayStr = today();
  const filtered = showCompleted ? followups : followups.filter(f => !f.completed);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Follow-ups</h1>
      <div style="display:flex;gap:10px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted)">
          <input type="checkbox" id="show-completed" ${showCompleted ? 'checked' : ''} />
          Show completed
        </label>
        <button class="btn btn-primary" id="add-followup-btn">+ Add Follow-up</button>
      </div>
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Done</th><th>Due Date</th><th>Title</th><th>Contact</th>
              <th>Deal</th><th>Notes</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">&#9989;</div><div class="empty-state-text">No follow-ups. You're all caught up!</div></div></td></tr>`
              : filtered.map(f => {
                  const over = !f.completed && isOverdue(f.due_date);
                  const tod = !f.completed && isToday(f.due_date);
                  const rowCls = f.completed ? 'completed-row' : over ? 'overdue-row' : tod ? 'today-row' : '';
                  return `<tr class="${rowCls}">
                    <td>
                      <input type="checkbox" class="check-btn" ${f.completed ? 'checked' : ''}
                        onchange="toggleComplete(${f.id}, this.checked, event)" />
                    </td>
                    <td style="white-space:nowrap">${fmtDate(f.due_date)}</td>
                    <td>${f.title}</td>
                    <td>${f.contact_name || '—'}</td>
                    <td>${f.deal_name || '—'}</td>
                    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.notes || '—'}</td>
                    <td class="actions-cell">
                      <button class="btn btn-sm btn-secondary" onclick="editFollowup(${f.id})">Edit</button>
                      <button class="btn btn-sm btn-danger" onclick="deleteFollowup(${f.id})">Del</button>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('show-completed').addEventListener('change', e => {
    el._showCompleted = e.target.checked;
    loadFollowups();
  });

  document.getElementById('add-followup-btn').addEventListener('click', () => openFollowupModal({}, contacts, deals));
}

async function toggleComplete(id, checked, event) {
  event.stopPropagation();
  const f = await API.get(`/api/followups/${id}`).catch(() => null);
  if (!f) return;
  await API.put(`/api/followups/${id}`, { ...f, completed: checked });
  toast(checked ? 'Marked complete' : 'Marked incomplete');
  loadFollowups();
}

function followupForm(f = {}, contacts = [], deals = []) {
  return `
    <div class="form-grid">
      <div class="form-group full">
        <label>Title *</label>
        <input id="title" value="${f.title || ''}" placeholder="Call John about renewal..." />
      </div>
      <div class="form-group">
        <label>Due Date *</label>
        <input id="due_date" type="date" value="${f.due_date || ''}" />
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="completed">
          <option value="false" ${!f.completed?'selected':''}>Pending</option>
          <option value="true" ${f.completed?'selected':''}>Completed</option>
        </select>
      </div>
      <div class="form-group">
        <label>Linked Contact</label>
        <select id="contact_id">
          <option value="">None</option>
          ${contacts.map(c => `<option value="${c.id}" ${f.contact_id==c.id?'selected':''}>${c.name}${c.company?' — '+c.company:''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Linked Deal</label>
        <select id="deal_id">
          <option value="">None</option>
          ${deals.map(d => `<option value="${d.id}" ${f.deal_id==d.id?'selected':''}>${d.deal_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea id="notes">${f.notes || ''}</textarea>
      </div>
    </div>
  `;
}

function openFollowupModal(f = {}, contacts = [], deals = []) {
  modal.open(f.id ? 'Edit Follow-up' : 'Add Follow-up', followupForm(f, contacts, deals), async () => {
    if (!requireField('title', 'Title is required')) return;
    if (!requireField('due_date', 'Due date is required')) return;
    const completedEl = document.getElementById('completed');
    const data = {
      title: val('title'),
      due_date: val('due_date'),
      contact_id: val('contact_id') || null,
      deal_id: val('deal_id') || null,
      notes: val('notes') || null,
      completed: completedEl && completedEl.value === 'true'
    };
    try {
      if (f.id) {
        await API.put(`/api/followups/${f.id}`, data);
        toast('Follow-up updated');
      } else {
        await API.post('/api/followups', data);
        toast('Follow-up added');
      }
      modal.close();
      loadFollowups();
    } catch (e) {
      toast('Error saving follow-up', 'error');
    }
  });
}

async function editFollowup(id) {
  const [f, contacts, deals] = await Promise.all([
    API.get(`/api/followups/${id}`),
    API.get('/api/contacts').catch(() => []),
    API.get('/api/deals').catch(() => [])
  ]);
  openFollowupModal(f, contacts, deals);
}

async function deleteFollowup(id) {
  if (!confirm('Delete this follow-up? This cannot be undone.')) return;
  await API.delete(`/api/followups/${id}`);
  toast('Follow-up deleted');
  loadFollowups();
}
