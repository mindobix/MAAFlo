import { Router } from 'express'
import db from '../db'

const router = Router()

router.get('/', (req, res) => {
  const clientId = req.query.client_id ?? 1
  const archived = req.query.archived === 'true'
  const rows = db.prepare(`
    SELECT c.*,
      COALESCE(SUM(a.spend),0)       as spend,
      COALESCE(SUM(a.impressions),0) as impressions,
      COALESCE(SUM(a.clicks),0)      as clicks,
      COALESCE(SUM(a.conversions),0) as conversions
    FROM campaigns c
    LEFT JOIN analytics_daily a ON a.campaign_id = c.id
    WHERE c.client_id = ? AND ${archived ? "c.status = 'archived'" : "c.status != 'archived'"}
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(clientId)
  res.json(rows)
})

router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Not found' })

  const channels = db.prepare(`
    SELECT cc.*,
      COALESCE(SUM(a.spend),0)       as spend,
      COALESCE(SUM(a.impressions),0) as impressions,
      COALESCE(SUM(a.clicks),0)      as clicks,
      COALESCE(SUM(a.conversions),0) as conversions,
      COALESCE(SUM(a.revenue),0)     as revenue
    FROM campaign_channels cc
    LEFT JOIN analytics_daily a ON a.campaign_id = cc.campaign_id AND a.channel_slug = cc.channel_slug
    WHERE cc.campaign_id = ?
    GROUP BY cc.id ORDER BY cc.created_at
  `).all(req.params.id)

  const ads = db.prepare('SELECT * FROM campaign_ads WHERE campaign_id = ? ORDER BY channel_slug, created_at').all(req.params.id)

  const analytics = db.prepare(`
    SELECT channel_slug, date,
      SUM(impressions) as impressions, SUM(clicks) as clicks,
      SUM(conversions) as conversions, SUM(spend) as spend, SUM(revenue) as revenue
    FROM analytics_daily
    WHERE campaign_id = ? AND date >= date('now', '-30 days')
    GROUP BY channel_slug, date ORDER BY date
  `).all(req.params.id)

  res.json({ ...campaign, channels, ads, analytics })
})

router.post('/', (req, res) => {
  const {
    name, status = 'draft', goal = 'traffic',
    budget_total = 0, start_date, end_date, notes = '',
    // legacy compat
    channel = 'google_ads', budget_daily = 0,
  } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })

  const clientId = req.body.client_id ?? 1
  const result = db.prepare(`
    INSERT INTO campaigns (name, channel, status, goal, budget_daily, budget_total, start_date, end_date, notes, client_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, channel, status, goal, budget_daily, budget_total, start_date ?? null, end_date ?? null, notes, clientId)

  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(row)
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const fields = ['name', 'status', 'goal', 'budget_daily', 'budget_total', 'target_url', 'start_date', 'end_date', 'notes', 'headline', 'description', 'cta']
  const updates: string[] = []
  const values: unknown[] = []

  for (const f of fields) {
    if (f in req.body) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' })
  updates.push("updated_at = datetime('now')")
  values.push(req.params.id)

  db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// per-campaign channel analytics (last N days)
router.get('/:id/analytics', (req, res) => {
  const days = parseInt(String(req.query.days ?? '30'))
  const rows = db.prepare(`
    SELECT channel_slug, date,
      SUM(impressions) as impressions, SUM(clicks) as clicks,
      SUM(conversions) as conversions, SUM(spend) as spend, SUM(revenue) as revenue
    FROM analytics_daily
    WHERE campaign_id = ? AND date >= date('now', '-' || ? || ' days')
    GROUP BY channel_slug, date ORDER BY date
  `).all(req.params.id, days)
  res.json(rows)
})

export default router
