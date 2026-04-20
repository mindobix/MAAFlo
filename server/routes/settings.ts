import { Router } from 'express'
import db from '../db'

const router = Router()

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const obj: Record<string, string> = {}
  for (const r of rows) obj[r.key] = r.value
  res.json(obj)
})

router.put('/', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  db.transaction(() => {
    for (const [k, v] of Object.entries(req.body as Record<string, string>)) {
      upsert.run(k, String(v))
    }
  })()
  res.json({ ok: true })
})

export default router
