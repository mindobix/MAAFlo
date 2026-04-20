-- Change channels unique constraint from (slug) to (slug, client_id)
-- so each client can have their own row per channel.

CREATE TABLE IF NOT EXISTS channels_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  icon           TEXT    NOT NULL DEFAULT 'globe',
  status         TEXT    NOT NULL DEFAULT 'disconnected',
  config_json    TEXT    NOT NULL DEFAULT '{}',
  connected_at   TEXT,
  last_sync_at   TEXT,
  client_id      INTEGER DEFAULT 1,
  UNIQUE(slug, client_id)
);

INSERT OR IGNORE INTO channels_new
  (id, slug, name, icon, status, config_json, connected_at, last_sync_at, client_id)
SELECT id, slug, name, icon, status, config_json, connected_at, last_sync_at, client_id
FROM channels;

DROP TABLE channels;
ALTER TABLE channels_new RENAME TO channels;
