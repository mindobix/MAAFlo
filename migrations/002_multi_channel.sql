-- campaign_channels: one row per platform a campaign is running on
CREATE TABLE IF NOT EXISTS campaign_channels (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id      INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  channel_slug     TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'draft',
  budget_daily     REAL    DEFAULT 0,
  ext_campaign_id  TEXT,
  ext_adset_id     TEXT,
  pushed_at        TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, channel_slug)
);

-- campaign_ads: individual creatives per channel
CREATE TABLE IF NOT EXISTS campaign_ads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  channel_slug TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  headline     TEXT    NOT NULL DEFAULT '',
  description  TEXT    NOT NULL DEFAULT '',
  cta          TEXT    NOT NULL DEFAULT 'Learn More',
  target_url   TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'draft',
  ext_id       TEXT,
  pushed_at    TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- migrate primary channel entries — only carry ext_campaign_id when it actually belongs to that channel
INSERT OR IGNORE INTO campaign_channels (campaign_id, channel_slug, status, budget_daily, ext_campaign_id)
SELECT id, channel, status, budget_daily,
  CASE WHEN ext_id LIKE 'meta:%' THEN NULL ELSE ext_id END
FROM campaigns
WHERE channel IS NOT NULL AND channel != '' AND channel != 'multi';

-- for campaigns that were pushed to Meta (ext_id = 'meta:...'), also create a meta channel row
INSERT OR IGNORE INTO campaign_channels (campaign_id, channel_slug, budget_daily, ext_campaign_id)
SELECT id, 'meta', budget_daily, substr(ext_id, 6)
FROM campaigns
WHERE ext_id LIKE 'meta:%';
