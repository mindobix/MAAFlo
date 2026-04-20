import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import db from '../db'
import type { GoogleCreds } from '../integrations/google-ads'
import {
  listAccessibleCustomers,
  getCustomerDetails,
  createCampaign,
} from '../integrations/google-ads'
import {
  exchangeToken,
  listAdAccounts,
  createMetaCampaign,
  getInsights,
} from '../integrations/meta-ads'

const router = Router()

const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
]

const REDIRECT = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/channels/google/callback'
const META_REDIRECT = process.env.META_REDIRECT_URI ?? 'http://localhost:3001/api/channels/meta/callback'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getGoogleConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'google_ads' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('Google Ads channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getMetaConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'meta' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('Meta channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function requireGoogleCreds(cfg: Record<string, unknown>): GoogleCreds {
  const clientId      = cfg.google_client_id     as string | undefined
  const clientSecret  = cfg.google_client_secret as string | undefined
  const developerToken = cfg.google_developer_token as string | undefined
  if (!clientId || !clientSecret || !developerToken) {
    throw new Error('Google Ads credentials not configured. Enter your OAuth Client ID, Client Secret, and Developer Token first.')
  }
  return { clientId, clientSecret, developerToken }
}

function getOAuth2Client(cfg: Record<string, unknown>) {
  const creds = requireGoogleCreds(cfg)
  return new OAuth2Client(creds.clientId, creds.clientSecret, REDIRECT)
}

// ─── CHANNEL LIST ─────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const clientId = req.query.client_id ?? 1
  const rows = db.prepare('SELECT id, slug, name, icon, status, connected_at, last_sync_at FROM channels WHERE client_id = ? ORDER BY id').all(clientId)
  res.json(rows)
})

// ─── GOOGLE ADS CREDENTIALS ──────────────────────────────────────────────────

router.post('/google/credentials', (req, res) => {
  const { google_client_id, google_client_secret, google_developer_token } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!google_client_id || !google_client_secret || !google_developer_token) {
    return res.status(400).json({ error: 'client_id, client_secret, and developer_token are all required' })
  }
  const cfg = getGoogleConfig(clientId)
  cfg.google_client_id      = google_client_id.trim()
  cfg.google_client_secret  = google_client_secret.trim()
  cfg.google_developer_token = google_developer_token.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'google_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

// get full Google config (includes cred setup state)
router.get('/google/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getGoogleConfig(clientId)
    res.json({
      has_credentials:   !!(cfg.google_client_id && cfg.google_client_secret && cfg.google_developer_token),
      customer_id:       cfg.customer_id ?? null,
      login_customer_id: cfg.login_customer_id ?? null,
      customers:         cfg.customers ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// ─── GOOGLE OAUTH CONNECT ────────────────────────────────────────────────────

router.get('/google/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getGoogleConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  try {
    const oauthClient = getOAuth2Client(cfg)
    const url = oauthClient.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent', state: String(clientId) })
    res.json({ url })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

router.get('/google/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg         = getGoogleConfig(clientId)
    const oauthClient = getOAuth2Client(cfg)
    const creds       = requireGoogleCreds(cfg)
    const { tokens }  = await oauthClient.getToken(code)
    const refreshToken = tokens.refresh_token!

    cfg.refresh_token    = refreshToken
    cfg.customers        = []
    cfg.customer_id      = cfg.customer_id ?? null
    cfg.login_customer_id = null

    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'google_ads' AND client_id = ?`)
      .run(JSON.stringify(cfg), clientId)

    try {
      const { accessToken, customerIds } = await listAccessibleCustomers(refreshToken, creds)
      const customers = await Promise.all(customerIds.map(id => getCustomerDetails(id, accessToken, creds.developerToken)))
      const defaultCustomer = customers.find(c => !c.manager) ?? customers[0]
      cfg.customers         = customers
      cfg.customer_id       = defaultCustomer?.id ?? null
      cfg.login_customer_id = customers.find(c => c.manager)?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'google_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    } catch (custErr: unknown) {
      console.warn('Could not fetch Google Ads customers:', custErr instanceof Error ? custErr.message : custErr)
    }

    res.send('<html><body><script>window.close()</script><p>Google Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/google/refresh-customers', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getGoogleConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Config error' })
  }
  const refreshToken = cfg.refresh_token as string | undefined
  if (!refreshToken) return res.status(400).json({ error: 'Google Ads not connected — please reconnect' })

  try {
    const creds = requireGoogleCreds(cfg)
    const { accessToken, customerIds } = await listAccessibleCustomers(refreshToken, creds)
    const customers = await Promise.all(customerIds.map(id => getCustomerDetails(id, accessToken, creds.developerToken)))
    const defaultCustomer = customers.find(c => !c.manager) ?? customers[0]
    cfg.customers         = customers
    cfg.customer_id       = cfg.customer_id ?? defaultCustomer?.id ?? null
    cfg.login_customer_id = customers.find(c => c.manager)?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'google_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ customers, customer_id: cfg.customer_id, login_customer_id: cfg.login_customer_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/google/select-customer', (req, res) => {
  const { customer_id } = req.body as { customer_id: string }
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getGoogleConfig(clientId)
  cfg.customer_id = customer_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'google_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/google/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getGoogleConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Config error' })
  }

  const refreshToken    = cfg.refresh_token as string
  const customerId      = (req.body?.customer_id as string | undefined) ?? cfg.customer_id as string
  const loginCustomerId = cfg.login_customer_id as string | undefined
  if (!refreshToken) return res.status(400).json({ error: 'Google Ads not connected' })
  if (!customerId)   return res.status(400).json({ error: 'No Google Ads account selected' })

  try {
    const creds  = requireGoogleCreds(cfg)
    const result = await createCampaign(customerId, refreshToken, {
      name: campaign.name as string, goal: campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 10, status: campaign.status as string,
      headline: campaign.headline as string | undefined,
      description: campaign.description as string | undefined,
      target_url: campaign.target_url as string | undefined,
    }, creds, loginCustomerId)

    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(result.campaignId, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'google_ads' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: result.campaignId, resourceName: result.resourceName })
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err)
    const isPermission = raw.includes('PERMISSION_DENIED') || raw.includes('DEVELOPER_TOKEN_PROHIBITED') || raw.includes('caller does not have permission')
    const msg = isPermission
      ? 'Developer token lacks Basic Access. Go to your Google Ads Manager Account → Tools & Settings → API Center → Apply for Basic Access. Approval takes 1–2 business days.'
      : raw
    res.status(isPermission ? 403 : 500).json({ error: msg })
  }
})

// ─── DISCONNECT ───────────────────────────────────────────────────────────────

router.post('/:slug/disconnect', (req, res) => {
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  // preserve app credentials when disconnecting — only clear tokens
  if (req.params.slug === 'google_ads') {
    const cfg = getGoogleConfig(clientId)
    const preserved = {
      google_client_id:       cfg.google_client_id,
      google_client_secret:   cfg.google_client_secret,
      google_developer_token: cfg.google_developer_token,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'google_ads' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'meta') {
    const cfg = getMetaConfig(clientId)
    const preserved = {
      meta_app_id:     cfg.meta_app_id,
      meta_app_secret: cfg.meta_app_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'meta' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else {
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = '{}', connected_at = NULL WHERE slug = ? AND client_id = ?").run(req.params.slug, clientId)
  }
  res.json({ ok: true })
})

// manual sync
router.post('/google/sync', (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'google_ads' AND client_id = ?").run(clientId)
  res.json({ ok: true, synced_at: new Date().toISOString() })
})

// ─── META ADS CREDENTIALS ────────────────────────────────────────────────────

router.post('/meta/credentials', (req, res) => {
  const { meta_app_id, meta_app_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!meta_app_id || !meta_app_secret) {
    return res.status(400).json({ error: 'meta_app_id and meta_app_secret are required' })
  }
  const cfg = getMetaConfig(clientId)
  cfg.meta_app_id     = meta_app_id.trim()
  cfg.meta_app_secret = meta_app_secret.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'meta' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

// ─── META TOKEN CONNECT ──────────────────────────────────────────────────────

router.post('/meta/connect-token', async (req, res) => {
  const { token } = req.body as { token?: string }
  const clientId = (req.body as Record<string, unknown>).client_id ?? 1
  if (!token?.trim()) return res.status(400).json({ error: 'Token required' })

  try {
    const accounts   = await listAdAccounts(token)
    const defaultAcc = accounts.find(a => a.status === 1) ?? accounts[0]
    const existing   = getMetaConfig(clientId)
    const config = {
      meta_app_id:     existing.meta_app_id,
      meta_app_secret: existing.meta_app_secret,
      access_token: token, ad_accounts: accounts, account_id: defaultAcc?.id ?? null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'meta' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)
    res.json({ ok: true, ad_accounts: accounts, account_id: config.account_id })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── META OAUTH CONNECT ──────────────────────────────────────────────────────

router.get('/meta/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  const cfg = getMetaConfig(clientId)
  const appId     = cfg.meta_app_id     as string | undefined
  const appSecret = cfg.meta_app_secret as string | undefined
  if (!appId || !appSecret) {
    return res.status(400).json({ error: 'Meta credentials not configured. Enter your App ID and App Secret first.' })
  }
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  url.searchParams.set('client_id',     appId)
  url.searchParams.set('redirect_uri',  META_REDIRECT)
  url.searchParams.set('scope',         'ads_management,ads_read,business_management')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state',         String(clientId))
  res.json({ url: url.toString() })
})

router.get('/meta/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg       = getMetaConfig(clientId)
    const appId     = cfg.meta_app_id     as string | undefined
    const appSecret = cfg.meta_app_secret as string | undefined
    if (!appId || !appSecret) return res.status(400).send('Meta credentials not configured')

    const accessToken = await exchangeToken(code, META_REDIRECT, appId, appSecret)
    const config: Record<string, unknown> = {
      meta_app_id: appId, meta_app_secret: appSecret,
      access_token: accessToken, ad_accounts: [], account_id: null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'meta' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const accounts = await listAdAccounts(accessToken)
      const defaultAcc = accounts.find(a => a.status === 1) ?? accounts[0]
      config.ad_accounts = accounts
      config.account_id  = defaultAcc?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'meta' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[Meta] Could not fetch ad accounts:', e instanceof Error ? e.message : e)
    }
    res.send('<html><body><script>window.close()</script><p>Meta Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`Meta OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.get('/meta/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getMetaConfig(clientId)
    res.json({
      has_credentials: !!(cfg.meta_app_id && cfg.meta_app_secret),
      account_id:  cfg.account_id  ?? null,
      ad_accounts: cfg.ad_accounts ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

router.post('/meta/refresh-accounts', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getMetaConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  if (!token) return res.status(400).json({ error: 'Meta not connected' })

  try {
    const accounts   = await listAdAccounts(token)
    const defaultAcc = accounts.find(a => a.status === 1) ?? accounts[0]
    cfg.ad_accounts  = accounts
    cfg.account_id   = cfg.account_id ?? defaultAcc?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'meta' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ad_accounts: accounts, account_id: cfg.account_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/meta/select-account', (req, res) => {
  const { account_id } = req.body as { account_id: string }
  if (!account_id) return res.status(400).json({ error: 'account_id required' })
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  const cfg = getMetaConfig(clientId)
  cfg.account_id = account_id.startsWith('act_') ? account_id : `act_${account_id}`
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'meta' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/meta/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getMetaConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token     = cfg.access_token as string
  const accountId = (req.body?.account_id as string | undefined) ?? cfg.account_id as string
  if (!token)     return res.status(400).json({ error: 'Meta Ads not connected' })
  if (!accountId) return res.status(400).json({ error: 'No Meta ad account selected' })

  try {
    const result = await createMetaCampaign(accountId, token, {
      name: campaign.name as string, goal: campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 10, start_date: campaign.start_date as string | null,
      headline: campaign.headline as string | undefined, description: campaign.description as string | undefined,
      target_url: campaign.target_url as string | undefined, cta: campaign.cta as string | undefined,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`meta:${result.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'meta' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: result.campaignId, adSetId: result.adSetId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── PUSH ALL ─────────────────────────────────────────────────────────────────

router.post('/push-all/:id', async (req, res) => {
  const { platforms } = req.body as { platforms: string[] }
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const results: Record<string, unknown> = {}

  if (platforms.includes('google_ads')) {
    try {
      const cfg = getGoogleConfig(campaign.client_id ?? 1)
      const creds = requireGoogleCreds(cfg)
      const refreshToken    = cfg.refresh_token as string
      const customerId      = cfg.customer_id as string
      const loginCustomerId = cfg.login_customer_id as string | undefined
      if (!refreshToken || !customerId) throw new Error('Google Ads not configured')
      const r = await createCampaign(customerId, refreshToken, {
        name: campaign.name as string, goal: campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 10, status: campaign.status as string,
        headline: campaign.headline as string, description: campaign.description as string, target_url: campaign.target_url as string,
      }, creds, loginCustomerId)
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(r.campaignId, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'google_ads' AND client_id = ?").run(campaign.client_id ?? 1)
      results.google_ads = { ok: true, campaignId: r.campaignId }
    } catch (e: unknown) {
      results.google_ads = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('meta')) {
    try {
      const cfg = getMetaConfig(campaign.client_id ?? 1)
      const token = cfg.access_token as string
      const accountId = cfg.account_id as string
      if (!token || !accountId) throw new Error('Meta Ads not configured')
      const r = await createMetaCampaign(accountId, token, {
        name: campaign.name as string, goal: campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 10, start_date: campaign.start_date as string | null,
        headline: campaign.headline as string, description: campaign.description as string,
        target_url: campaign.target_url as string, cta: campaign.cta as string,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`meta:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'meta' AND client_id = ?").run(campaign.client_id ?? 1)
      results.meta = { ok: true, campaignId: r.campaignId, adSetId: r.adSetId }
    } catch (e: unknown) {
      results.meta = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  res.json({ ok: true, results })
})

// ─── META SYNC ────────────────────────────────────────────────────────────────

router.post('/meta/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getMetaConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token as string
  const accountId = cfg.account_id as string
  if (!token || !accountId) return res.status(400).json({ error: 'Meta not connected or no account selected' })

  try {
    const insights      = await getInsights(accountId, token, 30)
    const metaCampaigns = db.prepare("SELECT id FROM campaigns WHERE channel = 'meta' AND client_id = ?").all(clientId) as { id: number }[]

    if (metaCampaigns.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO analytics_daily (campaign_id, date, impressions, clicks, spend)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, date) DO UPDATE SET
          impressions = impressions + excluded.impressions,
          clicks      = clicks + excluded.clicks,
          spend       = spend + excluded.spend
      `)
      db.transaction(() => {
        for (const day of insights) {
          for (const c of metaCampaigns) {
            upsert.run(c.id, day.date_start, parseInt(day.impressions) || 0, parseInt(day.clicks) || 0, parseFloat(day.spend) || 0)
          }
        }
      })()
    }

    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'meta' AND client_id = ?").run(clientId)
    res.json({ ok: true, days: insights.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

export default router
