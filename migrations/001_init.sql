-- MAAFlo initial schema

CREATE TABLE IF NOT EXISTS campaigns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  channel         TEXT    NOT NULL DEFAULT 'google_ads',
  status          TEXT    NOT NULL DEFAULT 'draft',
  goal            TEXT    NOT NULL DEFAULT 'traffic',
  budget_daily    REAL    DEFAULT 0,
  budget_total    REAL    DEFAULT 0,
  spend           REAL    DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  conversions     INTEGER DEFAULT 0,
  target_url      TEXT,
  start_date      TEXT,
  end_date        TEXT,
  ext_id          TEXT,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date         TEXT    NOT NULL,
  impressions  INTEGER DEFAULT 0,
  clicks       INTEGER DEFAULT 0,
  conversions  INTEGER DEFAULT 0,
  spend        REAL    DEFAULT 0,
  revenue      REAL    DEFAULT 0,
  UNIQUE(campaign_id, date)
);

CREATE TABLE IF NOT EXISTS channels (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  icon           TEXT    NOT NULL DEFAULT 'globe',
  status         TEXT    NOT NULL DEFAULT 'disconnected',
  config_json    TEXT    NOT NULL DEFAULT '{}',
  connected_at   TEXT,
  last_sync_at   TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- seed channels
INSERT OR IGNORE INTO channels (slug, name, icon, status) VALUES
  ('google_ads', 'Google Ads',   'search',     'disconnected'),
  ('meta',       'Meta Ads',     'facebook',   'coming_soon'),
  ('tiktok',     'TikTok Ads',   'video',      'coming_soon'),
  ('linkedin',   'LinkedIn Ads', 'linkedin',   'coming_soon');

-- seed default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('app_name',       'MAAFlo'),
  ('currency',       'USD'),
  ('timezone',       'UTC'),
  ('default_goal',   'traffic');

-- seed demo campaign
INSERT OR IGNORE INTO campaigns (id, name, channel, status, goal, budget_daily, budget_total, spend, impressions, clicks, conversions, target_url, start_date, end_date)
VALUES (1, 'Brand Awareness Q2', 'google_ads', 'active', 'awareness',
        150, 4500, 1240, 84200, 3180, 96,
        'https://example.com', '2026-04-01', '2026-06-30');

INSERT OR IGNORE INTO campaigns (id, name, channel, status, goal, budget_daily, budget_total, spend, impressions, clicks, conversions, target_url, start_date, end_date)
VALUES (2, 'Lead Gen — Spring', 'google_ads', 'active', 'leads',
        200, 6000, 2800, 120500, 5620, 214,
        'https://example.com/contact', '2026-03-15', '2026-05-31');

INSERT OR IGNORE INTO campaigns (id, name, channel, status, goal, budget_daily, budget_total, spend, impressions, clicks, conversions, target_url, start_date, end_date)
VALUES (3, 'Retargeting — Checkout', 'google_ads', 'paused', 'conversions',
        80, 2400, 760, 32100, 1840, 72,
        'https://example.com/checkout', '2026-04-10', '2026-05-10');
