import { Router } from 'express'
import db from '../db'
import { createCampaign as pushGoogle } from '../integrations/google-ads'
import { createMetaCampaign as pushMeta } from '../integrations/meta-ads'
import { createTiktokCampaign as pushTiktok } from '../integrations/tiktok-ads'
import { createLinkedInCampaign as pushLinkedIn } from '../integrations/linkedin-ads'
import { createXCampaign as pushX } from '../integrations/x-ads'
import { createSnapCampaign as pushSnap } from '../integrations/snapchat-ads'
import { createAmazonCampaign as pushAmazon } from '../integrations/amazon-ads'
import { createPinterestCampaign as pushPinterest } from '../integrations/pinterest-ads'
import { createMailchimpCampaign as pushMailchimp } from '../integrations/mailchimp'

const router = Router({ mergeParams: true })

function getCfg(slug: string, clientId: unknown) {
  const ch = db.prepare('SELECT config_json FROM channels WHERE slug = ? AND client_id = ?').get(slug, clientId) as { config_json: string } | undefined
  return JSON.parse(ch?.config_json ?? '{}') as Record<string, unknown>
}

function requireGoogleCreds(cfg: Record<string, unknown>) {
  const clientId      = cfg.google_client_id      as string | undefined
  const clientSecret  = cfg.google_client_secret  as string | undefined
  const developerToken = cfg.google_developer_token as string | undefined
  if (!clientId || !clientSecret || !developerToken) {
    throw new Error('Google Ads app credentials not configured — go to Channels and enter your OAuth Client ID, Client Secret, and Developer Token.')
  }
  return { clientId, clientSecret, developerToken }
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
    const clientId = campaign.client_id ?? 1

    if (req.params.slug === 'google_ads') {
      const cfg             = getCfg('google_ads', clientId)
      const creds           = requireGoogleCreds(cfg)
      const refreshToken    = cfg.refresh_token as string
      const customerId      = cfg.customer_id as string
      const loginCustomerId = cfg.login_customer_id as string | undefined
      if (!refreshToken || !customerId) return res.status(400).json({ error: 'Google Ads not configured — connect it in Channels and set a Customer ID' })

      const r = await pushGoogle(customerId, refreshToken, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 10,
        status:       cc.status as string,
      }, creds, loginCustomerId)

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, req.params.id, 'google_ads')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'google_ads' AND client_id = ?").run(clientId)
      res.json({ ok: true, campaignId: r.campaignId })
    }
    else if (req.params.slug === 'meta') {
      const cfg       = getCfg('meta', clientId)
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
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'meta' AND client_id = ?").run(clientId)
      res.json({ ok: true, campaignId: r.campaignId, adSetId: r.adSetId })
    }
    else if (req.params.slug === 'tiktok') {
      const cfg = getCfg('tiktok', clientId)
      const token        = cfg.access_token  as string
      const advertiserId = cfg.advertiser_id as string
      if (!token || !advertiserId) return res.status(400).json({ error: 'TikTok Ads not configured — connect it in Channels and select an advertiser' })

      const r = await pushTiktok(advertiserId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 20,
        start_date:   campaign.start_date as string | null,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.adGroupId, req.params.id, 'tiktok')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'tiktok'").run()
      res.json({ ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId })
    }
    else if (req.params.slug === 'linkedin') {
      const cfg = getCfg('linkedin', clientId)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) return res.status(400).json({ error: 'LinkedIn Ads not configured — connect it in Channels and select an ad account' })

      const r = await pushLinkedIn(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 10,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.campaignGroupId, req.params.id, 'linkedin')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'linkedin'").run()
      res.json({ ok: true, campaignId: r.campaignId, campaignGroupId: r.campaignGroupId })
    }
    else if (req.params.slug === 'x_ads') {
      const cfg = getCfg('x_ads', clientId)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) return res.status(400).json({ error: 'X Ads not configured — connect it in Channels and select an ad account' })

      const oauth1 = cfg.oauth1_consumer_key ? {
        consumerKey:    cfg.oauth1_consumer_key    as string,
        consumerSecret: cfg.oauth1_consumer_secret as string,
        accessToken:    token,
        accessSecret:   cfg.oauth1_access_secret   as string,
      } : undefined

      const r = await pushX(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 10,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      }, oauth1)

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.lineItemId, req.params.id, 'x_ads')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'x_ads'").run()
      res.json({ ok: true, campaignId: r.campaignId, lineItemId: r.lineItemId })
    }
    else if (req.params.slug === 'snapchat') {
      const cfg = getCfg('snapchat', clientId)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) return res.status(400).json({ error: 'Snapchat Ads not configured — connect it in Channels and select an ad account' })

      const r = await pushSnap(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 20,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.adSquadId, req.params.id, 'snapchat')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'snapchat'").run()
      res.json({ ok: true, campaignId: r.campaignId, adSquadId: r.adSquadId })
    }
    else if (req.params.slug === 'amazon') {
      const cfg = getCfg('amazon', clientId)
      const token     = cfg.access_token     as string
      const amazonCid = cfg.amazon_client_id as string
      const profileId = cfg.profile_id       as string
      const region    = (cfg.region as string) ?? 'NA'
      if (!token || !amazonCid || !profileId) return res.status(400).json({ error: 'Amazon Ads not configured — connect it in Channels and select a profile' })

      const r = await pushAmazon(token, amazonCid, profileId, region, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 5,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.adGroupId, req.params.id, 'amazon')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'amazon'").run()
      res.json({ ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId })
    }
    else if (req.params.slug === 'pinterest') {
      const cfg = getCfg('pinterest', clientId)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) return res.status(400).json({ error: 'Pinterest Ads not configured — connect it in Channels and select an ad account' })

      const r = await pushPinterest(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (cc.budget_daily as number) || (campaign.budget_daily as number) || 5,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, ext_adset_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, r.adGroupId, req.params.id, 'pinterest')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'pinterest'").run()
      res.json({ ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId })
    }
    else if (req.params.slug === 'mailchimp') {
      const cfg = getCfg('mailchimp', clientId)
      const token      = cfg.access_token as string
      const dc         = cfg.dc           as string
      const audienceId = cfg.audience_id  as string
      const fromEmail  = cfg.from_email   as string
      if (!token || !dc) return res.status(400).json({ error: 'Mailchimp not configured — connect it in Channels' })
      if (!audienceId)   return res.status(400).json({ error: 'Select a Mailchimp audience in Channels' })
      if (!fromEmail)    return res.status(400).json({ error: 'Set a From email for Mailchimp in Channels' })

      const r = await pushMailchimp(dc, token, audienceId, fromEmail, {
        name:    campaign.name        as string,
        subject: campaign.headline    as string | undefined,
        html:    campaign.description as string | undefined,
      })

      db.prepare(`UPDATE campaign_channels SET ext_campaign_id = ?, pushed_at = datetime('now') WHERE campaign_id = ? AND channel_slug = ?`)
        .run(r.campaignId, req.params.id, 'mailchimp')
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'mailchimp'").run()
      res.json({ ok: true, campaignId: r.campaignId, webId: r.webId })
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
