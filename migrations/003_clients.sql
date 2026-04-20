-- clients table
CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active',
  notes      TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- seed a default client so existing data stays valid
INSERT OR IGNORE INTO clients (id, name, status) VALUES (1, 'Default', 'active');
