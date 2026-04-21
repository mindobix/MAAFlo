import { Router } from 'express'
import multer from 'multer'
import db from '../db'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

function dumpAll() {
  return {
    version: 2,
    exported_at: new Date().toISOString(),
    clients:           db.prepare('SELECT * FROM clients').all(),
    campaigns:         db.prepare('SELECT * FROM campaigns').all(),
    campaign_channels: db.prepare('SELECT * FROM campaign_channels').all(),
    campaign_ads:      db.prepare('SELECT * FROM campaign_ads').all(),
    analytics_daily:   db.prepare('SELECT * FROM analytics_daily').all(),
    channels:          db.prepare('SELECT * FROM channels').all(),
    settings:          db.prepare('SELECT * FROM settings').all(),
  }
}

router.get('/export', (_req, res) => {
  const data     = dumpAll()
  const filename = `maaflo-backup-${new Date().toISOString().slice(0, 10)}.json`
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/json')
  res.json(data)
})

router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  let data: ReturnType<typeof dumpAll>
  try {
    data = JSON.parse(req.file.buffer.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid JSON file' })
  }

  if (!data.version || !data.campaigns) {
    return res.status(400).json({ error: 'Invalid backup format' })
  }

  db.transaction(() => {
    // clear in dependency order (children before parents)
    db.prepare('DELETE FROM campaign_ads').run()
    db.prepare('DELETE FROM campaign_channels').run()
    db.prepare('DELETE FROM analytics_daily').run()
    db.prepare('DELETE FROM campaigns').run()
    db.prepare('DELETE FROM channels').run()
    db.prepare('DELETE FROM clients').run()
    db.prepare('DELETE FROM settings').run()

    const insClient = db.prepare(`
      INSERT OR REPLACE INTO clients (id, name, status, notes, created_at, updated_at)
      VALUES (@id, @name, @status, @notes, @created_at, @updated_at)
    `)
    for (const c of (data.clients ?? []) as Record<string, unknown>[]) insClient.run(c)

    const insCamp = db.prepare(`
      INSERT OR REPLACE INTO campaigns
        (id, name, channel, status, goal, budget_daily, budget_total, spend, impressions, clicks, conversions,
         target_url, start_date, end_date, ext_id, notes, headline, description, cta, client_id, created_at, updated_at)
      VALUES
        (@id, @name, @channel, @status, @goal, @budget_daily, @budget_total, @spend, @impressions, @clicks, @conversions,
         @target_url, @start_date, @end_date, @ext_id, @notes, @headline, @description, @cta, @client_id, @created_at, @updated_at)
    `)
    for (const c of data.campaigns as Record<string, unknown>[]) insCamp.run(c)

    const insCampChan = db.prepare(`
      INSERT OR REPLACE INTO campaign_channels
        (id, campaign_id, channel_slug, status, budget_daily, ext_campaign_id, ext_adset_id, pushed_at, created_at)
      VALUES (@id, @campaign_id, @channel_slug, @status, @budget_daily, @ext_campaign_id, @ext_adset_id, @pushed_at, @created_at)
    `)
    for (const c of (data.campaign_channels ?? []) as Record<string, unknown>[]) insCampChan.run(c)

    const insCampAd = db.prepare(`
      INSERT OR REPLACE INTO campaign_ads
        (id, campaign_id, channel_slug, name, headline, description, cta, target_url, status, ext_id, pushed_at, created_at, updated_at)
      VALUES (@id, @campaign_id, @channel_slug, @name, @headline, @description, @cta, @target_url, @status, @ext_id, @pushed_at, @created_at, @updated_at)
    `)
    for (const a of (data.campaign_ads ?? []) as Record<string, unknown>[]) insCampAd.run(a)

    const insDay = db.prepare(`
      INSERT OR REPLACE INTO analytics_daily
        (id, campaign_id, date, impressions, clicks, conversions, spend, revenue, channel_slug)
      VALUES (@id, @campaign_id, @date, @impressions, @clicks, @conversions, @spend, @revenue, @channel_slug)
    `)
    for (const d of data.analytics_daily as Record<string, unknown>[]) insDay.run(d)

    const insChan = db.prepare(`
      INSERT OR REPLACE INTO channels
        (id, slug, name, icon, status, config_json, connected_at, last_sync_at, client_id)
      VALUES (@id, @slug, @name, @icon, @status, @config_json, @connected_at, @last_sync_at, @client_id)
    `)
    for (const c of data.channels as Record<string, unknown>[]) insChan.run(c)

    const insSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)')
    for (const s of data.settings as Record<string, unknown>[]) insSetting.run(s)
  })()

  res.json({ ok: true, imported_at: new Date().toISOString() })
})

export default router
