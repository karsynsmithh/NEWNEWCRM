// ─── Attachments (shared by Properties and Deals modals) ─────────────────────

let _attachField = null;   // 'property_id' | 'deal_id'
let _attachRecordId = null;
let _attachCache = [];

function attachmentsTabHtml() {
  return `
    <div class="upload-drop-zone" id="upload-drop-zone" onclick="document.getElementById('attach-file-input').click()">
      <input type="file" id="attach-file-input" multiple style="display:none"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx" />
      <div class="upload-icon">&#128206;</div>
      <div class="upload-text">Click to upload or drag &amp; drop</div>
      <div class="upload-hint">PDF, images, Word, Excel &mdash; up to 25 MB each</div>
    </div>
    <div id="upload-progress-bar" style="display:none" class="upload-progress-bar"></div>
    <div class="attachments-list" id="attachments-list">
      <p class="attachments-loading">Loading&hellip;</p>
    </div>
  `;
}

function _attachIcon(mimeType) {
  if (!mimeType) return '&#128196;';
  if (mimeType.includes('pdf')) return '&#128209;';
  if (mimeType.startsWith('image/')) return '&#128444;&#65039;';
  if (mimeType.includes('word') || mimeType.includes('document')) return '&#128196;';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '&#128202;';
  return '&#128196;';
}

function _fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function _renderAttachments() {
  const el = document.getElementById('attachments-list');
  if (!el) return;
  if (_attachCache.length === 0) {
    el.innerHTML = '<p class="attachments-empty">No attachments yet.</p>';
    return;
  }
  el.innerHTML = _attachCache.map(a => `
    <div class="attachment-item">
      <span class="attach-icon">${_attachIcon(a.mime_type)}</span>
      <div class="attach-info">
        <a class="attach-name" href="/uploads/${encodeURIComponent(a.stored_name)}"
          target="_blank" download="${escapeHtml(a.original_name)}">${escapeHtml(a.original_name)}</a>
        <span class="attach-meta">${_fmtBytes(a.size_bytes)}</span>
      </div>
      <button type="button" class="note-icon-btn" title="Delete" onclick="deleteAttachment(${a.id})">&#128465;&#65039;</button>
    </div>
  `).join('');
}

async function loadAttachmentsTab(field, recordId) {
  _attachField = field;
  _attachRecordId = recordId;
  _attachCache = await API.get(`/api/attachments?${field}=${recordId}`).catch(() => []);
  _renderAttachments();

  const fileInput = document.getElementById('attach-file-input');
  if (fileInput) fileInput.addEventListener('change', e => _uploadFiles(e.target.files));

  const zone = document.getElementById('upload-drop-zone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      _uploadFiles(e.dataTransfer.files);
    });
  }
}

async function _uploadFiles(files) {
  if (!files || !files.length) return;
  const bar = document.getElementById('upload-progress-bar');
  if (bar) { bar.style.display = ''; bar.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`; }

  let ok = 0, fail = 0;
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append(_attachField, _attachRecordId);
    try {
      const r = await fetch('/api/attachments', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      ok++;
    } catch (e) { fail++; }
  }

  if (bar) bar.style.display = 'none';
  if (ok > 0) toast(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
  if (fail > 0) toast(`${fail} upload${fail > 1 ? 's' : ''} failed`, 'error');

  const fi = document.getElementById('attach-file-input');
  if (fi) fi.value = '';

  _attachCache = await API.get(`/api/attachments?${_attachField}=${_attachRecordId}`).catch(() => []);
  _renderAttachments();
}

async function deleteAttachment(id) {
  if (!confirm('Delete this attachment? This cannot be undone.')) return;
  try {
    await API.delete(`/api/attachments/${id}`);
    toast('Attachment deleted');
    _attachCache = _attachCache.filter(a => a.id !== id);
    _renderAttachments();
  } catch (e) {
    toast('Error deleting attachment', 'error');
  }
}
