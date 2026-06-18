// ─── Notes / Update Log (shared by Properties, Contacts, Deals modals) ────────

let _notesField = null;     // 'property_id' | 'contact_id' | 'deal_id'
let _notesRecordId = null;
let _notesCache = [];

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Refresh the list view behind the modal so note count chips stay current
function _notesRefreshList() {
  if (_notesField === 'property_id' && typeof loadProperties === 'function') loadProperties();
  if (_notesField === 'contact_id' && typeof loadContacts === 'function') loadContacts();
  if (_notesField === 'deal_id' && typeof loadDeals === 'function') loadDeals();
}

function notesTabLabel(count) {
  return count > 0 ? `Notes (${count})` : 'Notes';
}

function notesTabHtml() {
  return `
    <div class="notes-input-card">
      <textarea id="note_text_input" placeholder="Add an update…"></textarea>
      <div class="notes-input-meta">
        <input type="datetime-local" id="note_date_input" value="${nowLocal()}" />
        <button type="button" class="btn btn-primary" onclick="saveNewNote()">Save Note</button>
      </div>
    </div>
    <div class="notes-feed" id="notes-feed">
      <p class="notes-loading">Loading notes…</p>
    </div>
  `;
}

function _noteCardHtml(n) {
  return `
    <div class="note-card" id="note-card-${n.id}">
      <div class="note-card-header">
        <span class="note-date">${fmtDateTime(n.note_date)}</span>
        <span class="note-actions">
          <button type="button" class="note-icon-btn" title="Edit" onclick="startEditNote(${n.id})">&#9999;&#65039;</button>
          <button type="button" class="note-icon-btn" title="Delete" onclick="deleteNoteEntry(${n.id})">&#128465;&#65039;</button>
        </span>
      </div>
      <div class="note-text" id="note-text-${n.id}">${escapeHtml(n.note_text)}</div>
    </div>
  `;
}

function _renderNotesFeed() {
  const feed = document.getElementById('notes-feed');
  if (!feed) return;
  feed.innerHTML = _notesCache.length === 0
    ? '<p class="notes-empty">No notes yet. Add the first update above.</p>'
    : _notesCache.map(_noteCardHtml).join('');

  const tab = document.querySelector('#modal-body .modal-tab[data-tab="notes"]');
  if (tab) tab.textContent = notesTabLabel(_notesCache.length);
}

async function loadNotesTab(field, recordId) {
  _notesField = field;
  _notesRecordId = recordId;
  _notesCache = await API.get(`/api/notes?${field}=${recordId}`).catch(() => []);
  _renderNotesFeed();
}

async function saveNewNote() {
  const textEl = document.getElementById('note_text_input');
  const dateEl = document.getElementById('note_date_input');
  if (!textEl.value.trim()) {
    toast('Note text is required', 'error');
    textEl.focus();
    return;
  }
  try {
    await API.post('/api/notes', {
      note_text: textEl.value.trim(),
      note_date: dateEl.value ? dateEl.value.replace('T', ' ') : null,
      [_notesField]: _notesRecordId
    });
    textEl.value = '';
    dateEl.value = nowLocal();
    toast('Note added');
    await loadNotesTab(_notesField, _notesRecordId);
    _notesRefreshList();
  } catch (e) {
    toast('Error saving note', 'error');
  }
}

function startEditNote(noteId) {
  const n = _notesCache.find(x => x.id === noteId);
  const textDiv = document.getElementById(`note-text-${noteId}`);
  if (!n || !textDiv) return;
  textDiv.innerHTML = `
    <textarea class="note-edit-input" id="note-edit-${noteId}">${escapeHtml(n.note_text)}</textarea>
    <div class="note-edit-actions">
      <button type="button" class="btn btn-sm btn-primary" onclick="saveEditNote(${noteId})">Save</button>
      <button type="button" class="btn btn-sm btn-secondary" onclick="_renderNotesFeed()">Cancel</button>
    </div>
  `;
  document.getElementById(`note-edit-${noteId}`).focus();
}

async function saveEditNote(noteId) {
  const input = document.getElementById(`note-edit-${noteId}`);
  if (!input.value.trim()) {
    toast('Note text is required', 'error');
    return;
  }
  try {
    await API.put(`/api/notes/${noteId}`, { note_text: input.value.trim() });
    toast('Note updated');
    await loadNotesTab(_notesField, _notesRecordId);
  } catch (e) {
    toast('Error updating note', 'error');
  }
}

async function deleteNoteEntry(noteId) {
  if (!confirm('Delete this note? This cannot be undone.')) return;
  try {
    await API.delete(`/api/notes/${noteId}`);
    toast('Note deleted');
    await loadNotesTab(_notesField, _notesRecordId);
    _notesRefreshList();
  } catch (e) {
    toast('Error deleting note', 'error');
  }
}
