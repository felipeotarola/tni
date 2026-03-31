CREATE TABLE IF NOT EXISTS lookups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  operator TEXT NOT NULL,
  brand_guess TEXT NOT NULL,
  network TEXT NOT NULL,
  is_ported INTEGER NOT NULL,
  binding_status TEXT NOT NULL,
  binding_risk TEXT NOT NULL,
  operator_confidence REAL NOT NULL,
  brand_confidence REAL NOT NULL,
  binding_confidence REAL NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lookups_phone_number ON lookups(phone_number);
CREATE INDEX IF NOT EXISTS idx_lookups_created_at ON lookups(created_at);

CREATE TABLE IF NOT EXISTS operator_mapping (
  operator_name TEXT PRIMARY KEY,
  brands_json TEXT NOT NULL,
  network TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS number_ranges (
  prefix TEXT PRIMARY KEY,
  original_operator TEXT NOT NULL
);

