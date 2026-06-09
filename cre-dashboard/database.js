const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cre_dashboard.db');
const _db = new DatabaseSync(DB_PATH);

_db.exec('PRAGMA journal_mode = WAL');
_db.exec('PRAGMA foreign_keys = ON');

_db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    city TEXT,
    state TEXT DEFAULT 'TX',
    property_type TEXT CHECK(property_type IN ('retail','office','industrial','land','mixed-use')),
    size_sf REAL,
    asking_rate REAL,
    asking_price REAL,
    rep_type TEXT CHECK(rep_type IN ('landlord_rep','tenant_rep','investment_sale')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active','under_contract','leased','sold','withdrawn')),
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    year_built INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    contact_type TEXT CHECK(contact_type IN ('landlord','tenant','buyer','seller','broker','other')),
    pipeline_stage TEXT DEFAULT 'prospect' CHECK(pipeline_stage IN ('prospect','active','loi','under_contract','closed','dead')),
    req_size_min REAL,
    req_size_max REAL,
    req_budget REAL,
    req_location TEXT,
    req_property_type TEXT,
    next_followup_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_name TEXT NOT NULL,
    deal_type TEXT CHECK(deal_type IN ('lease','sale')),
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    tenant_buyer_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    landlord_seller_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'prospect' CHECK(status IN ('prospect','loi','under_contract','closed','dead')),
    lease_rate REAL,
    size_sf REAL,
    term_months INTEGER,
    ti_allowance REAL,
    free_rent_months INTEGER,
    sale_price REAL,
    noi REAL,
    cap_rate REAL,
    loi_date DATE,
    expected_close_date DATE,
    actual_close_date DATE,
    total_commission REAL,
    commission_status TEXT DEFAULT 'pending' CHECK(commission_status IN ('pending','invoiced','received')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due_date DATE NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    notes TEXT,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// node:sqlite rejects undefined params — coerce to null
function sanitize(params) {
  return params.map(p => (p === undefined ? null : p));
}

// Thin wrapper to match better-sqlite3 API (get returns null instead of undefined)
const db = {
  exec(sql) { return _db.exec(sql); },
  prepare(sql) {
    const stmt = _db.prepare(sql);
    return {
      get(...params) { return stmt.get(...sanitize(params)) ?? null; },
      all(...params) { return stmt.all(...sanitize(params)); },
      run(...params) {
        const r = stmt.run(...sanitize(params));
        return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
      }
    };
  }
};

module.exports = db;
