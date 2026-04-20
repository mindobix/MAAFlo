import { Router } from 'express'
import multer from 'multer'
import db from '../db'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

function dumpAll() {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    campaigns:       db.prepare('SELECT * FROM campaigns').all(),
    analytics_daily: db.prepare('SELECT * FROM analytics_daily').all(),
    channels:        db.prepare('SELECT id, slug, name, icon, status, connected_at, last_sync_at FROM channels').all(),
    settings:        db.prepare('SELECT * FROM settings').all(),
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
    db.prepare('DELETE FROM analytics_daily').run()
    db.prepare('DELETE FROM campaigns').run()
    db.prepare('DELETE FROM settings').run()

    const insCamp = db.prepare(`
      INSERT OR REPLACE INTO campaigns
        (id, name, channel, status, goal, budget_daily, budget_total, spend, impressions, clicks, conversions, target_url, start_date, end_date, ext_id, notes, created_at, updated_at)
      VALUES
        (@id, @name, @channel, @status, @goal, @budget_daily, @budget_total, @spend, @impressions, @clicks, @conversions, @target_url, @start_date, @end_date, @ext_id, @notes, @created_at, @updated_at)
    `)
    for (const c of data.campaigns as Record<string, unknown>[]) insCamp.run(c)

    const insDay = db.prepare(`
      INSERT OR REPLACE INTO analytics_daily
        (id, campaign_id, date, impressions, clicks, conversions, spend, revenue)
      VALUES (@id, @campaign_id, @date, @impressions, @clicks, @conversions, @spend, @revenue)
    `)
    for (const d of data.analytics_daily as Record<string, unknown>[]) insDay.run(d)

    const insSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)')
    for (const s of data.settings as Record<string, unknown>[]) insSetting.run(s)
  })()

  res.json({ ok: true, imported_at: new Date().toISOString() })
})

export default router
