import Database from 'better-sqlite3'
import { readFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const DB_PATH  = join(DATA_DIR, 'maaflo.db')

mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// run migrations in order
for (const file of ['001_init.sql', '002_multi_channel.sql', '003_clients.sql', '004_channels_unique_per_client.sql']) {
  db.exec(readFileSync(join(process.cwd(), 'migrations', file), 'utf8'))
}

// enable channels that are now integrated
db.prepare("UPDATE channels SET status = 'disconnected' WHERE slug = 'meta' AND status = 'coming_soon'").run()
db.prepare("UPDATE channels SET status = 'disconnected' WHERE slug = 'tiktok' AND status = 'coming_soon'").run()
db.prepare("UPDATE channels SET status = 'disconnected' WHERE slug = 'linkedin' AND status = 'coming_soon'").run()

// safe column additions — idempotent
function addCol(table: string, col: string, def: string) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
}

addCol('campaigns',      'headline',     "TEXT NOT NULL DEFAULT ''")
addCol('campaigns',      'description',  "TEXT NOT NULL DEFAULT ''")
addCol('campaigns',      'cta',          "TEXT NOT NULL DEFAULT 'Learn More'")
addCol('campaigns',      'client_id',    'INTEGER DEFAULT 1')
addCol('channels',       'client_id',    'INTEGER DEFAULT 1')
addCol('analytics_daily','channel_slug', "TEXT NOT NULL DEFAULT ''")

// backfill client_id = 1 for existing rows
db.prepare("UPDATE campaigns SET client_id = 1 WHERE client_id IS NULL").run()
db.prepare("UPDATE channels  SET client_id = 1 WHERE client_id IS NULL").run()

// seed channel rows for ALL clients that are missing any channel (idempotent)
const allClients = (db.prepare('SELECT id FROM clients').all() as { id: number }[])
const seedChannels = db.prepare(`INSERT OR IGNORE INTO channels (slug, name, icon, status, client_id) VALUES (?, ?, ?, ?, ?)`)
const CHANNEL_DEFS: [string, string, string, string][] = [
  ['google_ads', 'Google Ads',   'search',   'disconnected'],
  ['meta',       'Meta Ads',     'facebook', 'disconnected'],
  ['tiktok',     'TikTok Ads',   'video',    'disconnected'],
  ['linkedin',   'LinkedIn Ads', 'linkedin', 'disconnected'],
  ['x_ads',      'X Ads',        'x',        'disconnected'],
  ['snapchat',   'Snapchat Ads', 'ghost',    'disconnected'],
  ['amazon',     'Amazon Ads',   'shopping', 'disconnected'],
  ['pinterest',  'Pinterest Ads','pin',      'disconnected'],
  ['mailchimp',  'Mailchimp',    'mail',     'disconnected'],
]
for (const { id } of allClients) {
  for (const [slug, name, icon, status] of CHANNEL_DEFS) {
    seedChannels.run(slug, name, icon, status, id)
  }
}

// fix: google_ads channel rows that got a meta ext_campaign_id — clear it
db.prepare(`
  UPDATE campaign_channels SET ext_campaign_id = NULL
  WHERE channel_slug = 'google_ads' AND ext_campaign_id IS NOT NULL
    AND campaign_id IN (SELECT id FROM campaigns WHERE ext_id LIKE 'meta:%')
`).run()

// fix: create proper meta channel rows for campaigns pushed to meta
db.prepare(`
  INSERT OR IGNORE INTO campaign_channels (campaign_id, channel_slug, budget_daily, ext_campaign_id)
  SELECT id, 'meta', budget_daily, substr(ext_id, 6) FROM campaigns WHERE ext_id LIKE 'meta:%'
`).run()

// clean any remaining "meta:" prefix
db.prepare("UPDATE campaign_channels SET ext_campaign_id = substr(ext_campaign_id, 6) WHERE ext_campaign_id LIKE 'meta:%'").run()

export default db
