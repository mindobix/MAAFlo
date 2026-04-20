import { Router } from 'express'
import db from '../db'
import { createCampaign as pushGoogle } from '../integrations/google-ads'
import { createMetaCampaign as pushMeta } from '../integrations/meta-ads'

const router = Router({ mergeParams: true })

function getGoogleCfg() {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'google_ads'").get() as { config_json: string }
  return JSON.parse(ch?.config_json ?? '{}') as Record<string, unknown>
}
function getMetaCfg() {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'meta'").get() as { config_json: string }
  return JSON.parse(ch?.config_json ?? '{}') as Record<string, unknown>
}

// GET /api/campaigns/:id/channels
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT cc.*,
      COALESCE(SUM(a.spend),0)       as spend,
      COALESCE(SUM(a.impressions),0) as impressions,
      COALESCE(SUM(a.clicks),0)      as clicks,
      COALESCE(SUM(a.conversions),0) as conversions,
      COALESCE(SUM(a.revenue),0)     as revenue
    FROM campaign_channels cc
    LEFT JOIN analytics_daily a
      ON a.campaign_id = cc.campaign_id AND a.channel_slug = cc.channel_slug
    WHERE cc.campaign_id = ?
    GROUP BY cc.id
    ORDER BY cc.created_at
  `).all(req.params.id)
  res.json(rows)
})

// POST /api/campaigns/:id/channels  — add a channel to a campaign
router.post('/', (req, res) => {
  const { channel_slug, budget_daily = 0, status = 'draft' } = req.body
  if (!channel_slug) return res.status(400).json({ error: 'channel_slug required' })
  try {
    const r = db.prepare(`
      INSERT INTO campaign_channels (campaign_id, channel_slug, budget_daily, status)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, channel_slug, budget_daily, status)
    res.status(201).json(db.prepare('SELECT * FROM campaign_channels WHERE id = ?').get(r.lastInsertRowid))
  } catch {
    res.status(409).json({ error: `${channel_slug} is already added to this campaign` })
  }
})

// PUT /api/campaigns/:id/channels/:slug
router.put('/:slug', (req, res) => {
  const fields = ['status', 'budget_daily']
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of fields) {
    if (f in req.body) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' })
  values.push(req.params.id, req.params.slug)
  db.prepare(`UPDATE campaign_channels SET ${updates.join(', ')} WHERE campaign_id = ? AND channel_slug = ?`).run(...values)
  res.json(db.prepare('SELECT * FROM campaign_channels WHERE campaign_id = ? AND channel_slug = ?').get(req.params.id, req.params.slug))
})

// DELETE /api/campaigns/:id/channels/:slug
router.delete('/:slug', (req, res) => {
  db.prepare('DELETE FROM campaign_channels WHERE campaign_id = ? AND channel_slug = ?').run(req.params.id, req.params.slug)
  res.json({ ok: true })
})

// POST /api/campaigns/:id/channels/:slug/push — push campaign to platform
router.post('/:slug/push', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown>
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const cc = db.prepare('SELECT * FROM campaign_channels WHERE campaign_id = ? AND channel_slug = ?')
    .get(req.params.id, req.params.slug) as Record<string, unknown> | undefined
  if (!cc) return res.status(404).json({ error: 'Channel not added to this campaign' })

  try {
    if (req.params.slug === 'google_ads') {
      const cfg = getGoogleCfg()
      const refreshToken    = cfg.refresh_token as string
      const customerId      = cfg.customer_id as string
      const loginCustomerId = cfg.login_customer_id as string | undefined
      if (!refreshToken || !customerId) return res.status(400).json({ error: 'Google Ads not configured — connect it in Channels and set a Customer ID' })

      const r = await pushGoogle(customerId, refreshToken, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 10,
        status:       cc.status as string,
      }, loginCustomerId)

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, req.params.id, 'google_ads')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'google_ads'").run()
      res.json({ ok: true, campaignId: r.campaignId })
    }
    else if (req.params.slug === 'meta') {
      const cfg = getMetaCfg()
      const token     = cfg.access_token as string
      const accountId = cfg.account_id as string
      if (!token || !accountId) return res.status(400).json({ error: 'Meta Ads not configured — connect it in Channels and select an account' })

      const r = await pushMeta(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 10,
        start_date:   campaign.start_date as string | null,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.adSetId, req.params.id, 'meta')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'meta'").run()
      res.json({ ok: true, campaignId: r.campaignId, adSetId: r.adSetId })
    }
    else {
      res.status(400).json({ error: `Push not supported for ${req.params.slug}` })
    }
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err)
    const isPermission = raw.includes('PERMISSION_DENIED') || raw.includes('DEVELOPER_TOKEN_PROHIBITED')
    res.status(isPermission ? 403 : 500).json({
      error: isPermission
        ? 'Google Ads developer token lacks Basic Access. Apply at Google Ads Manager → Tools → API Center.'
        : raw
    })
  }
})

export default router
