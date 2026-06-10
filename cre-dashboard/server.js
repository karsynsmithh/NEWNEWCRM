const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Properties ───────────────────────────────────────────────────────────────

app.get('/api/properties', (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM property_suites s WHERE s.property_id = p.id) AS suite_count,
      (SELECT COUNT(*) FROM property_suites s WHERE s.property_id = p.id AND s.status = 'available') AS available_suite_count,
      (SELECT COUNT(*) FROM notes n WHERE n.property_id = p.id) AS note_count
    FROM properties p`;
  const params = [];
  if (status) { sql += ' WHERE p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/properties/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/properties', (req, res) => {
  const {
    address, city, state, property_type, size_sf, asking_rate, asking_price,
    rep_type, status, owner_name, owner_phone, owner_email, year_built, notes
  } = req.body;
  if (!address) return res.status(400).json({ error: 'Address is required' });
  const result = db.prepare(`
    INSERT INTO properties (address, city, state, property_type, size_sf, asking_rate, asking_price,
      rep_type, status, owner_name, owner_phone, owner_email, year_built, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(address, city, state, property_type, size_sf, asking_rate, asking_price,
    rep_type, status || 'active', owner_name, owner_phone, owner_email, year_built, notes);
  res.status(201).json(db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/properties/:id', (req, res) => {
  const {
    address, city, state, property_type, size_sf, asking_rate, asking_price,
    rep_type, status, owner_name, owner_phone, owner_email, year_built, notes
  } = req.body;
  const result = db.prepare(`
    UPDATE properties SET address=?, city=?, state=?, property_type=?, size_sf=?, asking_rate=?,
      asking_price=?, rep_type=?, status=?, owner_name=?, owner_phone=?, owner_email=?,
      year_built=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(address, city, state, property_type, size_sf, asking_rate, asking_price,
    rep_type, status, owner_name, owner_phone, owner_email, year_built, notes, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id));
});

app.delete('/api/properties/:id', (req, res) => {
  const result = db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Property Suites ──────────────────────────────────────────────────────────

app.get('/api/properties/:id/suites', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM property_suites WHERE property_id = ? ORDER BY suite_name ASC'
  ).all(req.params.id);
  res.json(rows);
});

app.post('/api/properties/:id/suites', (req, res) => {
  const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const { suite_name, size_sf, asking_rate, asking_price, status, floor, notes } = req.body;
  if (!suite_name) return res.status(400).json({ error: 'Suite name is required' });

  const result = db.prepare(`
    INSERT INTO property_suites (property_id, suite_name, size_sf, asking_rate, asking_price, status, floor, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, suite_name, size_sf, asking_rate, asking_price, status || 'available', floor, notes);

  res.status(201).json(db.prepare('SELECT * FROM property_suites WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/properties/:id/suites/:sid', (req, res) => {
  const { suite_name, size_sf, asking_rate, asking_price, status, floor, notes } = req.body;
  if (!suite_name) return res.status(400).json({ error: 'Suite name is required' });

  const result = db.prepare(`
    UPDATE property_suites SET suite_name=?, size_sf=?, asking_rate=?, asking_price=?,
      status=?, floor=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND property_id=?
  `).run(suite_name, size_sf, asking_rate, asking_price, status || 'available', floor, notes,
    req.params.sid, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM property_suites WHERE id = ?').get(req.params.sid));
});

app.delete('/api/properties/:id/suites/:sid', (req, res) => {
  const result = db.prepare('DELETE FROM property_suites WHERE id = ? AND property_id = ?')
    .run(req.params.sid, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

app.get('/api/contacts', (req, res) => {
  const { stage, type } = req.query;
  const conditions = [];
  const params = [];
  if (stage) { conditions.push('pipeline_stage = ?'); params.push(stage); }
  if (type) { conditions.push('contact_type = ?'); params.push(type); }
  let sql = `
    SELECT contacts.*,
      (SELECT COUNT(*) FROM notes n WHERE n.contact_id = contacts.id) AS note_count
    FROM contacts`;
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/contacts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/contacts', (req, res) => {
  const {
    name, company, email, phone, contact_type, pipeline_stage,
    req_size_min, req_size_max, req_budget, req_location, req_property_type,
    next_followup_date, notes
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO contacts (name, company, email, phone, contact_type, pipeline_stage,
      req_size_min, req_size_max, req_budget, req_location, req_property_type,
      next_followup_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, company, email, phone, contact_type, pipeline_stage || 'prospect',
    req_size_min, req_size_max, req_budget, req_location, req_property_type,
    next_followup_date, notes);

  const contactId = result.lastInsertRowid;

  if (next_followup_date) {
    db.prepare(`
      INSERT INTO followups (title, due_date, contact_id) VALUES (?, ?, ?)
    `).run(`Follow up with ${name}`, next_followup_date, contactId);
  }

  res.status(201).json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId));
});

app.put('/api/contacts/:id', (req, res) => {
  const {
    name, company, email, phone, contact_type, pipeline_stage,
    req_size_min, req_size_max, req_budget, req_location, req_property_type,
    next_followup_date, notes
  } = req.body;

  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE contacts SET name=?, company=?, email=?, phone=?, contact_type=?, pipeline_stage=?,
      req_size_min=?, req_size_max=?, req_budget=?, req_location=?, req_property_type=?,
      next_followup_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, company, email, phone, contact_type, pipeline_stage,
    req_size_min, req_size_max, req_budget, req_location, req_property_type,
    next_followup_date, notes, req.params.id);

  if (next_followup_date && next_followup_date !== existing.next_followup_date) {
    const existingFollowup = db.prepare(
      'SELECT id FROM followups WHERE contact_id = ? AND completed = 0 AND title = ?'
    ).get(req.params.id, `Follow up with ${existing.name}`);
    if (existingFollowup) {
      db.prepare('UPDATE followups SET due_date = ?, title = ? WHERE id = ?')
        .run(next_followup_date, `Follow up with ${name}`, existingFollowup.id);
    } else {
      db.prepare('INSERT INTO followups (title, due_date, contact_id) VALUES (?, ?, ?)')
        .run(`Follow up with ${name}`, next_followup_date, req.params.id);
    }
  }

  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id));
});

app.delete('/api/contacts/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Deals ────────────────────────────────────────────────────────────────────

app.get('/api/deals', (req, res) => {
  const { status, deal_type } = req.query;
  const conditions = [];
  const params = [];
  if (status) { conditions.push('d.status = ?'); params.push(status); }
  if (deal_type) { conditions.push('d.deal_type = ?'); params.push(deal_type); }
  let sql = `
    SELECT d.*,
      p.address as property_address,
      c1.name as tenant_buyer_name,
      c2.name as landlord_seller_name,
      (SELECT COUNT(*) FROM notes n WHERE n.deal_id = d.id) AS note_count
    FROM deals d
    LEFT JOIN properties p ON d.property_id = p.id
    LEFT JOIN contacts c1 ON d.tenant_buyer_id = c1.id
    LEFT JOIN contacts c2 ON d.landlord_seller_id = c2.id
  `;
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY d.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/deals/:id', (req, res) => {
  const row = db.prepare(`
    SELECT d.*,
      p.address as property_address,
      c1.name as tenant_buyer_name,
      c2.name as landlord_seller_name
    FROM deals d
    LEFT JOIN properties p ON d.property_id = p.id
    LEFT JOIN contacts c1 ON d.tenant_buyer_id = c1.id
    LEFT JOIN contacts c2 ON d.landlord_seller_id = c2.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/deals', (req, res) => {
  const {
    deal_name, deal_type, property_id, tenant_buyer_id, landlord_seller_id, status,
    lease_rate, size_sf, term_months, ti_allowance, free_rent_months,
    sale_price, noi, cap_rate,
    loi_date, expected_close_date, actual_close_date,
    total_commission, commission_status, notes
  } = req.body;
  if (!deal_name) return res.status(400).json({ error: 'Deal name is required' });

  const result = db.prepare(`
    INSERT INTO deals (deal_name, deal_type, property_id, tenant_buyer_id, landlord_seller_id, status,
      lease_rate, size_sf, term_months, ti_allowance, free_rent_months,
      sale_price, noi, cap_rate,
      loi_date, expected_close_date, actual_close_date,
      total_commission, commission_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(deal_name, deal_type, property_id || null, tenant_buyer_id || null, landlord_seller_id || null,
    status || 'prospect',
    lease_rate, size_sf, term_months, ti_allowance, free_rent_months,
    sale_price, noi, cap_rate,
    loi_date, expected_close_date, actual_close_date,
    total_commission, commission_status || 'pending', notes);

  res.status(201).json(db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/deals/:id', (req, res) => {
  const {
    deal_name, deal_type, property_id, tenant_buyer_id, landlord_seller_id, status,
    lease_rate, size_sf, term_months, ti_allowance, free_rent_months,
    sale_price, noi, cap_rate,
    loi_date, expected_close_date, actual_close_date,
    total_commission, commission_status, notes
  } = req.body;

  const result = db.prepare(`
    UPDATE deals SET deal_name=?, deal_type=?, property_id=?, tenant_buyer_id=?, landlord_seller_id=?,
      status=?, lease_rate=?, size_sf=?, term_months=?, ti_allowance=?, free_rent_months=?,
      sale_price=?, noi=?, cap_rate=?,
      loi_date=?, expected_close_date=?, actual_close_date=?,
      total_commission=?, commission_status=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(deal_name, deal_type, property_id || null, tenant_buyer_id || null, landlord_seller_id || null,
    status, lease_rate, size_sf, term_months, ti_allowance, free_rent_months,
    sale_price, noi, cap_rate,
    loi_date, expected_close_date, actual_close_date,
    total_commission, commission_status, notes, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
});

app.delete('/api/deals/:id', (req, res) => {
  const result = db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Follow-ups ───────────────────────────────────────────────────────────────

app.get('/api/followups/upcoming', (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, c.name as contact_name, d.deal_name
    FROM followups f
    LEFT JOIN contacts c ON f.contact_id = c.id
    LEFT JOIN deals d ON f.deal_id = d.id
    WHERE f.completed = 0
      AND f.due_date <= date('now', '+30 days')
    ORDER BY f.due_date ASC
  `).all();
  res.json(rows);
});

app.get('/api/followups', (req, res) => {
  const { completed } = req.query;
  let sql = `
    SELECT f.*, c.name as contact_name, d.deal_name
    FROM followups f
    LEFT JOIN contacts c ON f.contact_id = c.id
    LEFT JOIN deals d ON f.deal_id = d.id
  `;
  const params = [];
  if (completed !== undefined) {
    sql += ' WHERE f.completed = ?';
    params.push(completed === '1' ? 1 : 0);
  }
  sql += ' ORDER BY f.completed ASC, f.due_date ASC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/followups', (req, res) => {
  const { title, due_date, contact_id, deal_id, property_id, notes, completed } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!due_date) return res.status(400).json({ error: 'Due date is required' });

  const result = db.prepare(`
    INSERT INTO followups (title, due_date, contact_id, deal_id, property_id, notes, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, due_date, contact_id || null, deal_id || null, property_id || null, notes, completed ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM followups WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/followups/:id', (req, res) => {
  const { title, due_date, contact_id, deal_id, property_id, notes, completed } = req.body;

  const result = db.prepare(`
    UPDATE followups SET title=?, due_date=?, contact_id=?, deal_id=?, property_id=?, notes=?, completed=?
    WHERE id=?
  `).run(title, due_date, contact_id || null, deal_id || null, property_id || null, notes,
    completed ? 1 : 0, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM followups WHERE id = ?').get(req.params.id));
});

app.delete('/api/followups/:id', (req, res) => {
  const result = db.prepare('DELETE FROM followups WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Notes ────────────────────────────────────────────────────────────────────

app.get('/api/notes', (req, res) => {
  const { property_id, contact_id, deal_id } = req.query;
  let field, value;
  if (property_id) { field = 'property_id'; value = property_id; }
  else if (contact_id) { field = 'contact_id'; value = contact_id; }
  else if (deal_id) { field = 'deal_id'; value = deal_id; }
  else return res.status(400).json({ error: 'property_id, contact_id, or deal_id is required' });

  const rows = db.prepare(
    `SELECT * FROM notes WHERE ${field} = ? ORDER BY note_date DESC, id DESC`
  ).all(value);
  res.json(rows);
});

app.post('/api/notes', (req, res) => {
  const { note_text, note_date, property_id, contact_id, deal_id } = req.body;
  if (!note_text || !note_text.trim()) return res.status(400).json({ error: 'Note text is required' });

  const linked = [property_id, contact_id, deal_id].filter(v => v != null && v !== '');
  if (linked.length !== 1) {
    return res.status(400).json({ error: 'Exactly one of property_id, contact_id, or deal_id is required' });
  }

  const result = db.prepare(`
    INSERT INTO notes (note_text, note_date, property_id, contact_id, deal_id)
    VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?)
  `).run(note_text.trim(), note_date || null, property_id || null, contact_id || null, deal_id || null);

  res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/notes/:id', (req, res) => {
  const { note_text, note_date } = req.body;
  if (!note_text || !note_text.trim()) return res.status(400).json({ error: 'Note text is required' });

  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE notes SET note_text = ?, note_date = COALESCE(?, note_date) WHERE id = ?')
    .run(note_text.trim(), note_date || null, req.params.id);
  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id));
});

app.delete('/api/notes/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Dashboard Summary ────────────────────────────────────────────────────────

app.get('/api/dashboard/summary', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const yearStart = today.slice(0, 4) + '-01-01';
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const in14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const active_listings = db.prepare(
    "SELECT COUNT(*) as c FROM properties WHERE status = 'active'"
  ).get().c;

  const available_suites = db.prepare(
    "SELECT COUNT(*) as c FROM property_suites WHERE status = 'available'"
  ).get().c;

  const pipeline_value = db.prepare(
    "SELECT COALESCE(SUM(total_commission), 0) as v FROM deals WHERE status NOT IN ('closed','dead')"
  ).get().v;

  const deals_closing_soon = db.prepare(
    "SELECT COUNT(*) as c FROM deals WHERE expected_close_date <= ? AND expected_close_date >= ? AND status NOT IN ('closed','dead')"
  ).get(in30Days, today).c;

  const followups_due_today = db.prepare(
    "SELECT COUNT(*) as c FROM followups WHERE due_date = ? AND completed = 0"
  ).get(today).c;

  const followups_due_this_week = db.prepare(
    "SELECT COUNT(*) as c FROM followups WHERE due_date <= ? AND due_date >= ? AND completed = 0"
  ).get(in7Days, today).c;

  const commission_ytd = db.prepare(
    "SELECT COALESCE(SUM(total_commission), 0) as v FROM deals WHERE status = 'closed' AND actual_close_date >= ?"
  ).get(yearStart).v;

  const commission_expected = db.prepare(
    "SELECT COALESCE(SUM(total_commission), 0) as v FROM deals WHERE commission_status IN ('pending','invoiced')"
  ).get().v;

  const pipeline_by_stage = db.prepare(`
    SELECT status as stage, COUNT(*) as count, COALESCE(SUM(total_commission), 0) as value
    FROM deals
    WHERE status NOT IN ('closed','dead')
    GROUP BY status
  `).all();

  const followup_events = db.prepare(`
    SELECT f.due_date as date, 'followup' as type, f.title, f.id,
      c.name as contact_name
    FROM followups f
    LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.completed = 0 AND f.due_date >= ? AND f.due_date <= ?
  `).all(today, in14Days);

  const deal_events = db.prepare(`
    SELECT loi_date as date, 'loi' as type, deal_name as title, id
    FROM deals WHERE loi_date >= ? AND loi_date <= ? AND status NOT IN ('dead')
    UNION ALL
    SELECT expected_close_date as date, 'close' as type, deal_name as title, id
    FROM deals WHERE expected_close_date >= ? AND expected_close_date <= ? AND status NOT IN ('closed','dead')
  `).all(today, in14Days, today, in14Days);

  const upcoming_events = [...followup_events, ...deal_events]
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    active_listings,
    available_suites,
    pipeline_value,
    deals_closing_soon,
    followups_due_today,
    followups_due_this_week,
    commission_ytd,
    commission_expected,
    pipeline_by_stage,
    upcoming_events
  });
});

// ─── Fallback SPA ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        localIP = alias.address;
        break;
      }
    }
  }
  console.log(`\n  CRE Dashboard running:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}\n`);
});
