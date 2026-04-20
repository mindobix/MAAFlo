import { Router } from 'express'
import db from '../db'

const router = Router({ mergeParams: true })

// GET /api/campaigns/:id/ads
router.get('/', (req, res) => {
  const { channel } = req.query
  const rows = channel
    ? db.prepare('SELECT * FROM campaign_ads WHERE campaign_id = ? AND channel_slug = ? ORDER BY created_at').all(req.params.id, channel)
    : db.prepare('SELECT * FROM campaign_ads WHERE campaign_id = ? ORDER BY channel_slug, created_at').all(req.params.id)
  res.json(rows)
})

// POST /api/campaigns/:id/ads
router.post('/', (req, res) => {
  const {
    channel_slug, name, headline = '', description = '',
    cta = 'Learn More', target_url = '', status = 'draft',
  } = req.body
  if (!channel_slug) return res.status(400).json({ error: 'channel_slug required' })
  if (!name)         return res.status(400).json({ error: 'name required' })

  const r = db.prepare(`
    INSERT INTO campaign_ads (campaign_id, channel_slug, name, headline, description, cta, target_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, channel_slug, name, headline, description, cta, target_url, status)

  res.status(201).json(db.prepare('SELECT * FROM campaign_ads WHERE id = ?').get(r.lastInsertRowid))
})

// PUT /api/campaigns/:id/ads/:adId
router.put('/:adId', (req, res) => {
  const fields = ['name', 'headline', 'description', 'cta', 'target_url', 'status']
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of fields) {
    if (f in req.body) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' })
  updates.push("updated_at = datetime('now')")
  values.push(req.params.adId)
  db.prepare(`UPDATE campaign_ads SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  res.json(db.prepare('SELECT * FROM campaign_ads WHERE id = ?').get(req.params.adId))
})

// DELETE /api/campaigns/:id/ads/:adId
router.delete('/:adId', (req, res) => {
  db.prepare('DELETE FROM campaign_ads WHERE id = ? AND campaign_id = ?').run(req.params.adId, req.params.id)
  res.json({ ok: true })
})

export default router
