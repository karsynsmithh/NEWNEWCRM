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
  let sql = 'SELECT * FROM properties';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
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

// ─── Contacts ─────────────────────────────────────────────────────────────────

app.get('/api/contacts', (req, res) => {
  const { stage, type } = req.query;
  const conditions = [];
  const params = [];
  if (stage) { conditions.push('pipeline_stage = ?'); params.push(stage); }
  if (type) { conditions.push('contact_type = ?'); params.push(type); }
  let sql = 'SELECT * FROM contacts';
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
      c2.name as landlord_seller_name
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

  const dealId = result.lastInsertRowid;

  const leaseDocs = [
    'NDA / Confidentiality Agreement',
    'Letter of Intent (LOI) — Draft',
    'Letter of Intent (LOI) — Executed',
    'Lease Draft — Landlord Version',
    'Lease Draft — Tenant Redlines',
    'Lease — Final Executed',
    'Certificate of Insurance',
    'Personal Guarantee (if applicable)',
    'Commission Agreement',
    'Commission Invoice Sent',
    'Commission — Received'
  ];
  const saleDocs = [
    'NDA / Confidentiality Agreement',
    'Letter of Intent (LOI) — Draft',
    'Letter of Intent (LOI) — Executed',
    'Purchase & Sale Agreement — Draft',
    'Purchase & Sale Agreement — Executed',
    'Due Diligence Checklist Sent',
    'Inspection Reports Received',
    'Title Commitment Received',
    'Loan Commitment (if applicable)',
    'Closing Statement',
    'Commission Agreement',
    'Commission Invoice Sent',
    'Commission — Received'
  ];

  const docList = deal_type === 'sale' ? saleDocs : leaseDocs;
  const insertDoc = db.prepare('INSERT INTO deal_documents (deal_id, doc_name, sort_order) VALUES (?, ?, ?)');
  docList.forEach((name, i) => insertDoc.run(dealId, name, i));

  res.status(201).json(db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId));
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

// ─── Activities ──────────────────────────────────────────────────────────────

app.get('/api/activities/recent', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, c.name as contact_name, d.deal_name, p.address as property_address
    FROM activities a
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN properties p ON a.property_id = p.id
    ORDER BY a.activity_date DESC LIMIT 20
  `).all();
  res.json(rows);
});

app.get('/api/activities', (req, res) => {
  const { contact_id, deal_id, property_id } = req.query;
  const conditions = [];
  const params = [];
  if (contact_id) { conditions.push('a.contact_id = ?'); params.push(contact_id); }
  if (deal_id) { conditions.push('a.deal_id = ?'); params.push(deal_id); }
  if (property_id) { conditions.push('a.property_id = ?'); params.push(property_id); }
  let sql = `
    SELECT a.*, c.name as contact_name, d.deal_name, p.address as property_address
    FROM activities a
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN properties p ON a.property_id = p.id
  `;
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY a.activity_date DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/activities/:id', (req, res) => {
  const row = db.prepare(`
    SELECT a.*, c.name as contact_name, d.deal_name, p.address as property_address
    FROM activities a
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN properties p ON a.property_id = p.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/activities', (req, res) => {
  const { activity_type, summary, notes, activity_date, duration_minutes, contact_id, deal_id, property_id } = req.body;
  if (!activity_type) return res.status(400).json({ error: 'Activity type is required' });
  if (!summary) return res.status(400).json({ error: 'Summary is required' });
  if (!activity_date) return res.status(400).json({ error: 'Activity date is required' });
  const result = db.prepare(`
    INSERT INTO activities (activity_type, summary, notes, activity_date, duration_minutes, contact_id, deal_id, property_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(activity_type, summary, notes, activity_date, duration_minutes, contact_id || null, deal_id || null, property_id || null);
  res.status(201).json(db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/activities/:id', (req, res) => {
  const { activity_type, summary, notes, activity_date, duration_minutes, contact_id, deal_id, property_id } = req.body;
  const result = db.prepare(`
    UPDATE activities SET activity_type=?, summary=?, notes=?, activity_date=?, duration_minutes=?,
      contact_id=?, deal_id=?, property_id=?
    WHERE id=?
  `).run(activity_type, summary, notes, activity_date, duration_minutes,
    contact_id || null, deal_id || null, property_id || null, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id));
});

app.delete('/api/activities/:id', (req, res) => {
  const result = db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Comps ────────────────────────────────────────────────────────────────────

app.get('/api/comps/summary', (req, res) => {
  const avg_lease_rate_by_type = db.prepare(`
    SELECT property_type, AVG(lease_rate) as avg_rate, COUNT(*) as count
    FROM lease_comps WHERE lease_rate IS NOT NULL GROUP BY property_type
  `).all();
  const avg_sale_price_psf_by_type = db.prepare(`
    SELECT property_type, AVG(price_per_sf) as avg_price_psf, AVG(cap_rate) as avg_cap_rate, COUNT(*) as count
    FROM sale_comps WHERE price_per_sf IS NOT NULL GROUP BY property_type
  `).all();
  const recent_leases = db.prepare(`SELECT * FROM lease_comps ORDER BY date_signed DESC LIMIT 5`).all();
  const recent_sales = db.prepare(`SELECT * FROM sale_comps ORDER BY close_date DESC LIMIT 5`).all();
  res.json({ avg_lease_rate_by_type, avg_sale_price_psf_by_type, recent_leases, recent_sales });
});

app.get('/api/comps/leases', (req, res) => {
  const { property_type, submarket } = req.query;
  const conditions = [];
  const params = [];
  if (property_type) { conditions.push('property_type = ?'); params.push(property_type); }
  if (submarket) { conditions.push('submarket LIKE ?'); params.push(`%${submarket}%`); }
  let sql = 'SELECT * FROM lease_comps';
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY date_signed DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/comps/leases/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM lease_comps WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/comps/leases', (req, res) => {
  const { address, city, submarket, property_type, tenant_name, landlord_name, size_sf,
    lease_rate, lease_structure, term_months, ti_allowance, free_rent_months,
    lease_start_date, lease_end_date, date_signed, source, notes } = req.body;
  if (!address) return res.status(400).json({ error: 'Address is required' });
  const result = db.prepare(`
    INSERT INTO lease_comps (address, city, submarket, property_type, tenant_name, landlord_name,
      size_sf, lease_rate, lease_structure, term_months, ti_allowance, free_rent_months,
      lease_start_date, lease_end_date, date_signed, source, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(address, city, submarket, property_type, tenant_name, landlord_name,
    size_sf, lease_rate, lease_structure, term_months, ti_allowance, free_rent_months,
    lease_start_date, lease_end_date, date_signed, source, notes);
  res.status(201).json(db.prepare('SELECT * FROM lease_comps WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/comps/leases/:id', (req, res) => {
  const { address, city, submarket, property_type, tenant_name, landlord_name, size_sf,
    lease_rate, lease_structure, term_months, ti_allowance, free_rent_months,
    lease_start_date, lease_end_date, date_signed, source, notes } = req.body;
  const result = db.prepare(`
    UPDATE lease_comps SET address=?, city=?, submarket=?, property_type=?, tenant_name=?, landlord_name=?,
      size_sf=?, lease_rate=?, lease_structure=?, term_months=?, ti_allowance=?, free_rent_months=?,
      lease_start_date=?, lease_end_date=?, date_signed=?, source=?, notes=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(address, city, submarket, property_type, tenant_name, landlord_name,
    size_sf, lease_rate, lease_structure, term_months, ti_allowance, free_rent_months,
    lease_start_date, lease_end_date, date_signed, source, notes, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM lease_comps WHERE id = ?').get(req.params.id));
});

app.delete('/api/comps/leases/:id', (req, res) => {
  const result = db.prepare('DELETE FROM lease_comps WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.get('/api/comps/sales', (req, res) => {
  const { property_type, submarket } = req.query;
  const conditions = [];
  const params = [];
  if (property_type) { conditions.push('property_type = ?'); params.push(property_type); }
  if (submarket) { conditions.push('submarket LIKE ?'); params.push(`%${submarket}%`); }
  let sql = 'SELECT * FROM sale_comps';
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY close_date DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/comps/sales/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sale_comps WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/comps/sales', (req, res) => {
  const { address, city, submarket, property_type, buyer_name, seller_name,
    size_sf, land_acres, sale_price, noi, cap_rate, year_built, occupancy_pct,
    close_date, source, notes } = req.body;
  if (!address) return res.status(400).json({ error: 'Address is required' });
  const price_per_sf = (sale_price && size_sf && size_sf > 0) ? sale_price / size_sf : null;
  const result = db.prepare(`
    INSERT INTO sale_comps (address, city, submarket, property_type, buyer_name, seller_name,
      size_sf, land_acres, sale_price, price_per_sf, noi, cap_rate, year_built, occupancy_pct,
      close_date, source, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(address, city, submarket, property_type, buyer_name, seller_name,
    size_sf, land_acres, sale_price, price_per_sf, noi, cap_rate, year_built, occupancy_pct,
    close_date, source, notes);
  res.status(201).json(db.prepare('SELECT * FROM sale_comps WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/comps/sales/:id', (req, res) => {
  const { address, city, submarket, property_type, buyer_name, seller_name,
    size_sf, land_acres, sale_price, noi, cap_rate, year_built, occupancy_pct,
    close_date, source, notes } = req.body;
  const price_per_sf = (sale_price && size_sf && size_sf > 0) ? sale_price / size_sf : null;
  const result = db.prepare(`
    UPDATE sale_comps SET address=?, city=?, submarket=?, property_type=?, buyer_name=?, seller_name=?,
      size_sf=?, land_acres=?, sale_price=?, price_per_sf=?, noi=?, cap_rate=?, year_built=?,
      occupancy_pct=?, close_date=?, source=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(address, city, submarket, property_type, buyer_name, seller_name,
    size_sf, land_acres, sale_price, price_per_sf, noi, cap_rate, year_built, occupancy_pct,
    close_date, source, notes, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM sale_comps WHERE id = ?').get(req.params.id));
});

app.delete('/api/comps/sales/:id', (req, res) => {
  const result = db.prepare('DELETE FROM sale_comps WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Deal Documents ────────────────────────────────────────────────────────────

app.get('/api/deals/:id/documents', (req, res) => {
  const rows = db.prepare('SELECT * FROM deal_documents WHERE deal_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
  res.json(rows);
});

app.post('/api/deals/:id/documents', (req, res) => {
  const { doc_name, status, due_date, notes } = req.body;
  if (!doc_name) return res.status(400).json({ error: 'Document name is required' });
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM deal_documents WHERE deal_id = ?').get(req.params.id);
  const sort_order = (maxOrder.m || 0) + 1;
  const result = db.prepare(`
    INSERT INTO deal_documents (deal_id, doc_name, status, due_date, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, doc_name, status || 'pending', due_date, notes, sort_order);
  res.status(201).json(db.prepare('SELECT * FROM deal_documents WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/deals/:id/documents/reorder', (req, res) => {
  const { items } = req.body;
  const update = db.prepare('UPDATE deal_documents SET sort_order = ? WHERE id = ? AND deal_id = ?');
  items.forEach(({ id, sort_order }) => update.run(sort_order, id, req.params.id));
  res.json({ success: true });
});

app.put('/api/deals/:id/documents/:docId', (req, res) => {
  const { status, due_date, completed_date, notes } = req.body;
  const result = db.prepare(`
    UPDATE deal_documents SET status=?, due_date=?, completed_date=?, notes=?
    WHERE id=? AND deal_id=?
  `).run(status, due_date, completed_date, notes, req.params.docId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM deal_documents WHERE id = ?').get(req.params.docId));
});

app.delete('/api/deals/:id/documents/:docId', (req, res) => {
  const result = db.prepare('DELETE FROM deal_documents WHERE id = ? AND deal_id = ?').run(req.params.docId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Vendors ──────────────────────────────────────────────────────────────────

app.get('/api/vendors', (req, res) => {
  const { vendor_type, preferred } = req.query;
  const conditions = [];
  const params = [];
  if (vendor_type) { conditions.push('vendor_type = ?'); params.push(vendor_type); }
  if (preferred === '1') { conditions.push('preferred = 1'); }
  let sql = 'SELECT * FROM vendors';
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY preferred DESC, name ASC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/vendors/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/vendors', (req, res) => {
  const { name, company, vendor_type, specialty, email, phone, address, city, preferred, rating, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!vendor_type) return res.status(400).json({ error: 'Vendor type is required' });
  const result = db.prepare(`
    INSERT INTO vendors (name, company, vendor_type, specialty, email, phone, address, city, preferred, rating, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, company, vendor_type, specialty, email, phone, address, city, preferred ? 1 : 0, rating, notes);
  res.status(201).json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/vendors/:id', (req, res) => {
  const { name, company, vendor_type, specialty, email, phone, address, city, preferred, rating, notes } = req.body;
  const result = db.prepare(`
    UPDATE vendors SET name=?, company=?, vendor_type=?, specialty=?, email=?, phone=?,
      address=?, city=?, preferred=?, rating=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, company, vendor_type, specialty, email, phone, address, city, preferred ? 1 : 0, rating, notes, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id));
});

app.delete('/api/vendors/:id', (req, res) => {
  const result = db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── Deal Vendors ─────────────────────────────────────────────────────────────

app.get('/api/deals/:id/vendors', (req, res) => {
  const rows = db.prepare(`
    SELECT dv.*, v.name, v.company, v.vendor_type, v.specialty, v.phone, v.email, v.preferred
    FROM deal_vendors dv
    JOIN vendors v ON dv.vendor_id = v.id
    WHERE dv.deal_id = ?
    ORDER BY v.name ASC
  `).all(req.params.id);
  res.json(rows);
});

app.post('/api/deals/:id/vendors', (req, res) => {
  const { vendor_id, role } = req.body;
  if (!vendor_id) return res.status(400).json({ error: 'Vendor ID is required' });
  try {
    db.prepare('INSERT INTO deal_vendors (deal_id, vendor_id, role) VALUES (?, ?, ?)').run(req.params.id, vendor_id, role);
    const row = db.prepare(`
      SELECT dv.*, v.name, v.company, v.vendor_type, v.specialty, v.phone, v.email
      FROM deal_vendors dv JOIN vendors v ON dv.vendor_id = v.id
      WHERE dv.deal_id = ? AND dv.vendor_id = ?
    `).get(req.params.id, vendor_id);
    res.status(201).json(row);
  } catch (e) {
    res.status(409).json({ error: 'Vendor already linked to this deal' });
  }
});

app.delete('/api/deals/:id/vendors/:vid', (req, res) => {
  const result = db.prepare('DELETE FROM deal_vendors WHERE deal_id = ? AND vendor_id = ?').run(req.params.id, req.params.vid);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
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
