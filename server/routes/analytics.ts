import { Router } from 'express'
import { subDays, format } from 'date-fns'
import db from '../db'

const router = Router()

// seed random daily data for demo campaigns if missing
function seedDailyIfEmpty(campaignId: number) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM analytics_daily WHERE campaign_id = ?').get(campaignId) as { c: number }
  if (existing.c > 0) return

  const insert = db.prepare(`
    INSERT OR IGNORE INTO analytics_daily (campaign_id, date, impressions, clicks, conversions, spend, revenue)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMany = db.transaction(() => {
    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const impr = Math.floor(Math.random() * 3000) + 800
      const clicks = Math.floor(impr * (0.03 + Math.random() * 0.04))
      const conv = Math.floor(clicks * (0.04 + Math.random() * 0.06))
      const spend = parseFloat((Math.random() * 120 + 40).toFixed(2))
      const revenue = parseFloat((conv * (15 + Math.random() * 25)).toFixed(2))
      insert.run(campaignId, date, impr, clicks, conv, spend, revenue)
    }
  })
  insertMany()
}

// summary totals across all campaigns
router.get('/summary', (_req, res) => {
  const campaigns = db.prepare('SELECT id FROM campaigns').all() as { id: number }[]
  campaigns.forEach(c => seedDailyIfEmpty(c.id))

  const row = db.prepare(`
    SELECT
      SUM(impressions) as impressions,
      SUM(clicks)      as clicks,
      SUM(conversions) as conversions,
      SUM(spend)       as spend,
      SUM(revenue)     as revenue
    FROM analytics_daily
    WHERE date >= date('now', '-30 days')
  `).get() as Record<string, number>

  const ctr = row.impressions > 0 ? (row.clicks / row.impressions * 100) : 0
  const roas = row.spend > 0 ? (row.revenue / row.spend) : 0

  res.json({ ...row, ctr: parseFloat(ctr.toFixed(2)), roas: parseFloat(roas.toFixed(2)) })
})

// trend data for chart (last N days, grouped by date)
router.get('/trend', (req, res) => {
  const days = parseInt(String(req.query.days ?? '30'))
  const campaignId = req.query.campaign_id

  const campaigns = db.prepare('SELECT id FROM campaigns').all() as { id: number }[]
  campaigns.forEach(c => seedDailyIfEmpty(c.id))

  let rows
  if (campaignId) {
    rows = db.prepare(`
      SELECT date, SUM(impressions) as impressions, SUM(clicks) as clicks,
             SUM(conversions) as conversions, SUM(spend) as spend, SUM(revenue) as revenue
      FROM analytics_daily
      WHERE campaign_id = ? AND date >= date('now', '-' || ? || ' days')
      GROUP BY date ORDER BY date
    `).all(campaignId, days)
  } else {
    rows = db.prepare(`
      SELECT date, SUM(impressions) as impressions, SUM(clicks) as clicks,
             SUM(conversions) as conversions, SUM(spend) as spend, SUM(revenue) as revenue
      FROM analytics_daily
      WHERE date >= date('now', '-' || ? || ' days')
      GROUP BY date ORDER BY date
    `).all(days)
  }

  res.json(rows)
})

// per-campaign breakdown
router.get('/by-campaign', (_req, res) => {
  const campaigns = db.prepare('SELECT id FROM campaigns').all() as { id: number }[]
  campaigns.forEach(c => seedDailyIfEmpty(c.id))

  const rows = db.prepare(`
    SELECT c.id, c.name, c.channel, c.status,
           SUM(a.impressions) as impressions, SUM(a.clicks) as clicks,
           SUM(a.conversions) as conversions, SUM(a.spend) as spend, SUM(a.revenue) as revenue
    FROM campaigns c
    LEFT JOIN analytics_daily a ON a.campaign_id = c.id AND a.date >= date('now', '-30 days')
    GROUP BY c.id
    ORDER BY spend DESC
  `).all()

  res.json(rows)
})

export default router
