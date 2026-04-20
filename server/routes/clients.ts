import { Router } from 'express'
import db from '../db'

const router = Router()

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY name').all())
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(row)
})

router.post('/', (req, res) => {
  const { name, notes = '' } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  const r = db.prepare(`INSERT INTO clients (name, notes) VALUES (?, ?)`).run(name.trim(), notes)
  // seed disconnected channels for this new client
  const seedCh = db.prepare(`INSERT OR IGNORE INTO channels (slug, name, icon, status, client_id) VALUES (?, ?, ?, ?, ?)`)
  for (const [slug, chName, icon, status] of [
    ['google_ads', 'Google Ads',   'search',   'disconnected'],
    ['meta',       'Meta Ads',     'facebook', 'disconnected'],
    ['tiktok',     'TikTok Ads',   'video',    'coming_soon'],
    ['linkedin',   'LinkedIn Ads', 'linkedin', 'coming_soon'],
  ]) seedCh.run(slug, chName, icon, status, r.lastInsertRowid)
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid))
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const fields = ['name', 'notes', 'status']
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of fields) {
    if (f in req.body) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' })
  updates.push("updated_at = datetime('now')")
  values.push(req.params.id)
  db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id))
})

export default router
