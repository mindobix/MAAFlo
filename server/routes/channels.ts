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
import {
  getAuthUrl       as getTiktokAuthUrl,
  exchangeAuthCode as tiktokExchange,
  listAdvertisers  as tiktokListAdvertisers,
  getAdvertiserInfo as tiktokAdvertiserInfo,
  createTiktokCampaign,
  getInsights      as tiktokInsights,
} from '../integrations/tiktok-ads'
import {
  getAuthUrl       as getLinkedInAuthUrl,
  exchangeAuthCode as linkedinExchange,
  listAdAccounts   as linkedinListAdAccounts,
  createLinkedInCampaign,
  getInsights      as linkedinInsights,
} from '../integrations/linkedin-ads'
import {
  generatePkce     as generateXPkce,
  getAuthUrl       as getXAuthUrl,
  exchangeAuthCode as xExchange,
  listAdAccounts   as xListAdAccounts,
  createXCampaign,
  getInsights      as xInsights,
} from '../integrations/x-ads'
import {
  getAuthUrl       as getSnapAuthUrl,
  exchangeAuthCode as snapExchange,
  listAdAccounts   as snapListAdAccounts,
  createSnapCampaign,
  getInsights      as snapInsights,
} from '../integrations/snapchat-ads'
import {
  getAuthUrl       as getAmazonAuthUrl,
  exchangeAuthCode as amazonExchange,
  listProfiles     as amazonListProfiles,
  createAmazonCampaign,
  requestSpReport  as amazonRequestReport,
} from '../integrations/amazon-ads'
import {
  getAuthUrl       as getPinAuthUrl,
  exchangeAuthCode as pinExchange,
  listAdAccounts   as pinListAdAccounts,
  createPinterestCampaign,
  getInsights      as pinInsights,
} from '../integrations/pinterest-ads'
import {
  getAuthUrl       as getMcAuthUrl,
  exchangeAuthCode as mcExchange,
  fetchMetadata    as mcFetchMetadata,
  listAudiences    as mcListAudiences,
  createMailchimpCampaign,
  getReport        as mcGetReport,
} from '../integrations/mailchimp'

const router = Router()

const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
]

const REDIRECT = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/channels/google/callback'
const META_REDIRECT = process.env.META_REDIRECT_URI ?? 'http://localhost:3001/api/channels/meta/callback'
const TIKTOK_REDIRECT   = process.env.TIKTOK_REDIRECT_URI   ?? 'http://localhost:3001/api/channels/tiktok/callback'
const LINKEDIN_REDIRECT = process.env.LINKEDIN_REDIRECT_URI ?? 'http://localhost:3001/api/channels/linkedin/callback'
const X_REDIRECT        = process.env.X_REDIRECT_URI        ?? 'http://localhost:3001/api/channels/x_ads/callback'
const SNAP_REDIRECT     = process.env.SNAPCHAT_REDIRECT_URI ?? 'http://localhost:3001/api/channels/snapchat/callback'
const AMAZON_REDIRECT   = process.env.AMAZON_REDIRECT_URI   ?? 'http://localhost:3001/api/channels/amazon/callback'
const PIN_REDIRECT      = process.env.PINTEREST_REDIRECT_URI ?? 'http://localhost:3001/api/channels/pinterest/callback'
const MC_REDIRECT       = process.env.MAILCHIMP_REDIRECT_URI ?? 'http://localhost:3001/api/channels/mailchimp/callback'

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

function getTiktokConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'tiktok' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('TikTok channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getLinkedInConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'linkedin' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('LinkedIn channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getXConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'x_ads' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('X Ads channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getSnapConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'snapchat' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('Snapchat channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getAmazonConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'amazon' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('Amazon channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getPinterestConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'pinterest' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('Pinterest channel not found for this client')
  return JSON.parse(ch.config_json) as Record<string, unknown>
}

function getMailchimpConfig(clientId: unknown = 1): Record<string, unknown> {
  const ch = db.prepare("SELECT config_json FROM channels WHERE slug = 'mailchimp' AND client_id = ?").get(clientId) as { config_json: string } | undefined
  if (!ch) throw new Error('Mailchimp channel not found for this client')
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
  } else if (req.params.slug === 'tiktok') {
    const cfg = getTiktokConfig(clientId)
    const preserved = {
      tiktok_app_id:     cfg.tiktok_app_id,
      tiktok_app_secret: cfg.tiktok_app_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'tiktok' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'linkedin') {
    const cfg = getLinkedInConfig(clientId)
    const preserved = {
      linkedin_client_id:     cfg.linkedin_client_id,
      linkedin_client_secret: cfg.linkedin_client_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'linkedin' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'x_ads') {
    const cfg = getXConfig(clientId)
    const preserved = {
      x_client_id:     cfg.x_client_id,
      x_client_secret: cfg.x_client_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'x_ads' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'snapchat') {
    const cfg = getSnapConfig(clientId)
    const preserved = {
      snapchat_client_id:     cfg.snapchat_client_id,
      snapchat_client_secret: cfg.snapchat_client_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'snapchat' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'amazon') {
    const cfg = getAmazonConfig(clientId)
    const preserved = {
      amazon_client_id:     cfg.amazon_client_id,
      amazon_client_secret: cfg.amazon_client_secret,
      region:               cfg.region ?? 'NA',
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'amazon' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'pinterest') {
    const cfg = getPinterestConfig(clientId)
    const preserved = {
      pinterest_client_id:     cfg.pinterest_client_id,
      pinterest_client_secret: cfg.pinterest_client_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'pinterest' AND client_id = ?")
      .run(JSON.stringify(preserved), clientId)
  } else if (req.params.slug === 'mailchimp') {
    const cfg = getMailchimpConfig(clientId)
    const preserved = {
      mailchimp_client_id:     cfg.mailchimp_client_id,
      mailchimp_client_secret: cfg.mailchimp_client_secret,
    }
    db.prepare("UPDATE channels SET status = 'disconnected', config_json = ?, connected_at = NULL WHERE slug = 'mailchimp' AND client_id = ?")
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

  if (platforms.includes('tiktok')) {
    try {
      const cfg = getTiktokConfig(campaign.client_id ?? 1)
      const token        = cfg.access_token  as string
      const advertiserId = cfg.advertiser_id as string
      if (!token || !advertiserId) throw new Error('TikTok Ads not configured')
      const r = await createTiktokCampaign(advertiserId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 20,
        start_date:   campaign.start_date as string | null,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`tiktok:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'tiktok' AND client_id = ?").run(campaign.client_id ?? 1)
      results.tiktok = { ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId }
    } catch (e: unknown) {
      results.tiktok = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('linkedin')) {
    try {
      const cfg = getLinkedInConfig(campaign.client_id ?? 1)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) throw new Error('LinkedIn Ads not configured')
      const r = await createLinkedInCampaign(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 10,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`linkedin:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'linkedin' AND client_id = ?").run(campaign.client_id ?? 1)
      results.linkedin = { ok: true, campaignGroupId: r.campaignGroupId, campaignId: r.campaignId }
    } catch (e: unknown) {
      results.linkedin = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('x_ads')) {
    try {
      const cfg = getXConfig(campaign.client_id ?? 1)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) throw new Error('X Ads not configured')
      const r = await createXCampaign(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 10,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`x_ads:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'x_ads' AND client_id = ?").run(campaign.client_id ?? 1)
      results.x_ads = { ok: true, campaignId: r.campaignId, lineItemId: r.lineItemId }
    } catch (e: unknown) {
      results.x_ads = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('snapchat')) {
    try {
      const cfg = getSnapConfig(campaign.client_id ?? 1)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) throw new Error('Snapchat Ads not configured')
      const r = await createSnapCampaign(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 20,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`snapchat:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'snapchat' AND client_id = ?").run(campaign.client_id ?? 1)
      results.snapchat = { ok: true, campaignId: r.campaignId, adSquadId: r.adSquadId }
    } catch (e: unknown) {
      results.snapchat = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('amazon')) {
    try {
      const cfg = getAmazonConfig(campaign.client_id ?? 1)
      const token      = cfg.access_token     as string
      const amazonCid  = cfg.amazon_client_id as string
      const profileId  = cfg.profile_id       as string
      const region     = (cfg.region as string) ?? 'NA'
      if (!token || !profileId || !amazonCid) throw new Error('Amazon Ads not configured')
      const r = await createAmazonCampaign(token, amazonCid, profileId, region, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 5,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`amazon:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'amazon' AND client_id = ?").run(campaign.client_id ?? 1)
      results.amazon = { ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId }
    } catch (e: unknown) {
      results.amazon = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('pinterest')) {
    try {
      const cfg = getPinterestConfig(campaign.client_id ?? 1)
      const token     = cfg.access_token as string
      const accountId = cfg.account_id   as string
      if (!token || !accountId) throw new Error('Pinterest Ads not configured')
      const r = await createPinterestCampaign(accountId, token, {
        name:         campaign.name as string,
        goal:         campaign.goal as string,
        budget_daily: (campaign.budget_daily as number) || 5,
        start_date:   campaign.start_date as string | null,
        end_date:     campaign.end_date   as string | null,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`pinterest:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'pinterest' AND client_id = ?").run(campaign.client_id ?? 1)
      results.pinterest = { ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId }
    } catch (e: unknown) {
      results.pinterest = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (platforms.includes('mailchimp')) {
    try {
      const cfg = getMailchimpConfig(campaign.client_id ?? 1)
      const token      = cfg.access_token as string
      const dc         = cfg.dc           as string
      const audienceId = cfg.audience_id  as string
      const fromEmail  = cfg.from_email   as string
      if (!token || !dc || !audienceId || !fromEmail) throw new Error('Mailchimp not configured (audience + from email required)')
      const r = await createMailchimpCampaign(dc, token, audienceId, fromEmail, {
        name:    campaign.name        as string,
        subject: campaign.headline    as string | undefined,
        html:    campaign.description as string | undefined,
      })
      db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`mailchimp:${r.campaignId}`, req.params.id)
      db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'mailchimp' AND client_id = ?").run(campaign.client_id ?? 1)
      results.mailchimp = { ok: true, campaignId: r.campaignId, webId: r.webId }
    } catch (e: unknown) {
      results.mailchimp = { ok: false, error: e instanceof Error ? e.message : String(e) }
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

// ─── TIKTOK ADS CREDENTIALS ──────────────────────────────────────────────────

router.post('/tiktok/credentials', (req, res) => {
  const { tiktok_app_id, tiktok_app_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!tiktok_app_id || !tiktok_app_secret) {
    return res.status(400).json({ error: 'tiktok_app_id and tiktok_app_secret are required' })
  }
  const cfg = getTiktokConfig(clientId)
  cfg.tiktok_app_id     = tiktok_app_id.trim()
  cfg.tiktok_app_secret = tiktok_app_secret.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'tiktok' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.get('/tiktok/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getTiktokConfig(clientId)
    res.json({
      has_credentials: !!(cfg.tiktok_app_id && cfg.tiktok_app_secret),
      advertiser_id:   cfg.advertiser_id ?? null,
      advertisers:     cfg.advertisers   ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// ─── TIKTOK OAUTH ─────────────────────────────────────────────────────────────

router.get('/tiktok/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getTiktokConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const appId = cfg.tiktok_app_id as string | undefined
  if (!appId) {
    return res.status(400).json({ error: 'TikTok credentials not configured. Enter your App ID and Secret first.' })
  }
  const url = getTiktokAuthUrl(appId, TIKTOK_REDIRECT, String(clientId))
  res.json({ url })
})

router.get('/tiktok/callback', async (req, res) => {
  const authCode = String(req.query.auth_code ?? req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!authCode) return res.status(400).send('Missing auth_code')

  try {
    const cfg       = getTiktokConfig(clientId)
    const appId     = cfg.tiktok_app_id     as string | undefined
    const appSecret = cfg.tiktok_app_secret as string | undefined
    if (!appId || !appSecret) return res.status(400).send('TikTok credentials not configured')

    const tok = await tiktokExchange(authCode, appId, appSecret)
    const config: Record<string, unknown> = {
      tiktok_app_id:     appId,
      tiktok_app_secret: appSecret,
      access_token:      tok.access_token,
      advertisers:       [],
      advertiser_id:     null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'tiktok' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const basic    = await tiktokListAdvertisers(tok.access_token, appId, appSecret)
      const enriched = await tiktokAdvertiserInfo(basic.map(a => a.advertiser_id), tok.access_token).catch(() => basic)
      config.advertisers   = enriched.length ? enriched : basic
      config.advertiser_id = (enriched[0] ?? basic[0])?.advertiser_id ?? tok.advertiser_ids[0] ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'tiktok' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[TikTok] Could not fetch advertisers:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>TikTok Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`TikTok OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/tiktok/refresh-advertisers', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getTiktokConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token      as string | undefined
  const appId     = cfg.tiktok_app_id     as string | undefined
  const appSecret = cfg.tiktok_app_secret as string | undefined
  if (!token) return res.status(400).json({ error: 'TikTok not connected' })
  if (!appId || !appSecret) return res.status(400).json({ error: 'TikTok credentials missing' })

  try {
    const basic    = await tiktokListAdvertisers(token, appId, appSecret)
    const enriched = await tiktokAdvertiserInfo(basic.map(a => a.advertiser_id), token).catch(() => basic)
    const list     = enriched.length ? enriched : basic
    cfg.advertisers   = list
    cfg.advertiser_id = cfg.advertiser_id ?? list[0]?.advertiser_id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'tiktok' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ advertisers: list, advertiser_id: cfg.advertiser_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/tiktok/select-advertiser', (req, res) => {
  const { advertiser_id } = req.body as { advertiser_id: string }
  if (!advertiser_id) return res.status(400).json({ error: 'advertiser_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getTiktokConfig(clientId)
  cfg.advertiser_id = advertiser_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'tiktok' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/tiktok/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getTiktokConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token        = cfg.access_token  as string
  const advertiserId = (req.body?.advertiser_id as string | undefined) ?? cfg.advertiser_id as string
  if (!token)        return res.status(400).json({ error: 'TikTok not connected' })
  if (!advertiserId) return res.status(400).json({ error: 'No TikTok advertiser selected' })

  try {
    const r = await createTiktokCampaign(advertiserId, token, {
      name:         campaign.name as string,
      goal:         campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 20,
      start_date:   campaign.start_date as string | null,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`tiktok:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'tiktok' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/tiktok/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getTiktokConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token        = cfg.access_token  as string | undefined
  const advertiserId = cfg.advertiser_id as string | undefined
  if (!token || !advertiserId) return res.status(400).json({ error: 'TikTok not connected or no advertiser selected' })

  try {
    const days       = await tiktokInsights(advertiserId, token, 30)
    const tiktokCampaignsRows = db.prepare(`
      SELECT DISTINCT cc.campaign_id as id
      FROM campaign_channels cc
      JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.channel_slug = 'tiktok' AND c.client_id = ?
    `).all(clientId) as { id: number }[]

    if (tiktokCampaignsRows.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO analytics_daily (campaign_id, channel_slug, date, impressions, clicks, conversions, spend)
        VALUES (?, 'tiktok', ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, date) DO UPDATE SET
          impressions = impressions + excluded.impressions,
          clicks      = clicks + excluded.clicks,
          conversions = conversions + excluded.conversions,
          spend       = spend + excluded.spend
      `)
      db.transaction(() => {
        for (const day of days) {
          for (const c of tiktokCampaignsRows) {
            upsert.run(
              c.id, day.stat_time_day,
              parseInt(day.impressions) || 0,
              parseInt(day.clicks)      || 0,
              parseInt(day.conversions ?? '0') || 0,
              parseFloat(day.spend)     || 0,
            )
          }
        }
      })()
    }

    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'tiktok' AND client_id = ?").run(clientId)
    res.json({ ok: true, days: days.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── LINKEDIN ADS CREDENTIALS ────────────────────────────────────────────────

router.post('/linkedin/credentials', (req, res) => {
  const { linkedin_client_id, linkedin_client_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!linkedin_client_id || !linkedin_client_secret) {
    return res.status(400).json({ error: 'linkedin_client_id and linkedin_client_secret are required' })
  }
  const cfg = getLinkedInConfig(clientId)
  cfg.linkedin_client_id     = linkedin_client_id.trim()
  cfg.linkedin_client_secret = linkedin_client_secret.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'linkedin' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

// POST /linkedin/manual-token — save a developer-portal token directly
router.post('/linkedin/manual-token', async (req, res) => {
  const { access_token } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!access_token?.trim()) return res.status(400).json({ error: 'access_token required' })

  const cfg = getLinkedInConfig(clientId)
  cfg.access_token = access_token.trim()
  cfg.ad_accounts  = []
  cfg.account_id   = null

  db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'linkedin' AND client_id = ?`)
    .run(JSON.stringify(cfg), clientId)

  try {
    const accounts  = await linkedinListAdAccounts(access_token.trim())
    cfg.ad_accounts = accounts
    cfg.account_id  = accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'linkedin' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ok: true, ad_accounts: accounts, account_id: cfg.account_id })
  } catch (e) {
    console.warn('[LinkedIn] manual token — could not fetch accounts:', e instanceof Error ? e.message : e)
    res.json({ ok: true, ad_accounts: [], account_id: null })
  }
})

router.get('/linkedin/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getLinkedInConfig(clientId)
    res.json({
      has_credentials: !!(cfg.linkedin_client_id && cfg.linkedin_client_secret),
      account_id:      cfg.account_id  ?? null,
      ad_accounts:     cfg.ad_accounts ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// ─── LINKEDIN OAUTH ───────────────────────────────────────────────────────────

router.get('/linkedin/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getLinkedInConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const liClientId = cfg.linkedin_client_id as string | undefined
  if (!liClientId) {
    return res.status(400).json({ error: 'LinkedIn credentials not configured. Enter your Client ID and Secret first.' })
  }
  const url = getLinkedInAuthUrl(liClientId, LINKEDIN_REDIRECT, String(clientId))
  res.json({ url })
})

router.get('/linkedin/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) {
    const errDesc = req.query.error_description ? decodeURIComponent(String(req.query.error_description)) : String(req.query.error ?? 'Unknown error')
    return res.status(400).send(`<html><body>
      <h3>LinkedIn OAuth Error</h3>
      <p>${errDesc}</p>
      ${errDesc.includes('not authorized') ? `
      <p><strong>Fix — two steps required:</strong></p>
      <ol>
        <li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank">linkedin.com/developers/apps</a> → select your app</li>
        <li>Under <strong>App settings</strong>, make sure a <strong>LinkedIn Company Page</strong> is linked — the Products tab is hidden without this</li>
        <li>Click the <strong>Products</strong> tab → Request access to <strong>Marketing Developer Platform</strong></li>
        <li>Wait for LinkedIn approval (1–3 business days) then try connecting again</li>
      </ol>` : ''}
      <p><a href="javascript:window.close()">Close this window</a></p>
    </body></html>`)
  }

  try {
    const cfg          = getLinkedInConfig(clientId)
    const liClientId   = cfg.linkedin_client_id     as string | undefined
    const liClientSecret = cfg.linkedin_client_secret as string | undefined
    if (!liClientId || !liClientSecret) return res.status(400).send('LinkedIn credentials not configured')

    const tok = await linkedinExchange(code, LINKEDIN_REDIRECT, liClientId, liClientSecret)
    const config: Record<string, unknown> = {
      linkedin_client_id:     liClientId,
      linkedin_client_secret: liClientSecret,
      access_token:           tok.access_token,
      expires_at:             Date.now() + (tok.expires_in ?? 0) * 1000,
      ad_accounts:            [],
      account_id:             null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'linkedin' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const accounts = await linkedinListAdAccounts(tok.access_token)
      config.ad_accounts = accounts
      config.account_id  = accounts[0]?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'linkedin' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[LinkedIn] Could not fetch ad accounts:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>LinkedIn Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`LinkedIn OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/linkedin/refresh-accounts', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getLinkedInConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  if (!token) return res.status(400).json({ error: 'LinkedIn not connected' })

  try {
    const accounts   = await linkedinListAdAccounts(token)
    cfg.ad_accounts  = accounts
    cfg.account_id   = cfg.account_id ?? accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'linkedin' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ad_accounts: accounts, account_id: cfg.account_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/linkedin/select-account', (req, res) => {
  const { account_id } = req.body as { account_id: string }
  if (!account_id) return res.status(400).json({ error: 'account_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getLinkedInConfig(clientId)
  cfg.account_id = account_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'linkedin' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/linkedin/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getLinkedInConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token     = cfg.access_token as string
  const accountId = (req.body?.account_id as string | undefined) ?? cfg.account_id as string
  if (!token)     return res.status(400).json({ error: 'LinkedIn not connected' })
  if (!accountId) return res.status(400).json({ error: 'No LinkedIn ad account selected' })

  try {
    const r = await createLinkedInCampaign(accountId, token, {
      name:         campaign.name as string,
      goal:         campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 10,
      start_date:   campaign.start_date as string | null,
      end_date:     campaign.end_date   as string | null,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`linkedin:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'linkedin' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, campaignGroupId: r.campaignGroupId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/linkedin/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getLinkedInConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token as string | undefined
  const accountId = cfg.account_id   as string | undefined
  if (!token || !accountId) return res.status(400).json({ error: 'LinkedIn not connected or no account selected' })

  try {
    const days = await linkedinInsights(accountId, token, 30)
    const liCampaigns = db.prepare(`
      SELECT DISTINCT cc.campaign_id as id
      FROM campaign_channels cc
      JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.channel_slug = 'linkedin' AND c.client_id = ?
    `).all(clientId) as { id: number }[]

    if (liCampaigns.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO analytics_daily (campaign_id, channel_slug, date, impressions, clicks, conversions, spend)
        VALUES (?, 'linkedin', ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, date) DO UPDATE SET
          impressions = impressions + excluded.impressions,
          clicks      = clicks + excluded.clicks,
          conversions = conversions + excluded.conversions,
          spend       = spend + excluded.spend
      `)
      db.transaction(() => {
        for (const day of days) {
          for (const c of liCampaigns) {
            upsert.run(c.id, day.date, day.impressions, day.clicks, day.conversions, day.spend)
          }
        }
      })()
    }

    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'linkedin' AND client_id = ?").run(clientId)
    res.json({ ok: true, days: days.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── X ADS CREDENTIALS ────────────────────────────────────────────────────────

router.post('/x_ads/credentials', (req, res) => {
  const { x_client_id, x_client_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!x_client_id || !x_client_secret) {
    return res.status(400).json({ error: 'x_client_id and x_client_secret are required' })
  }
  const cfg = getXConfig(clientId)
  cfg.x_client_id     = x_client_id.trim()
  cfg.x_client_secret = x_client_secret.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'x_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.get('/x_ads/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getXConfig(clientId)
    res.json({
      has_credentials: !!(cfg.x_client_id && cfg.x_client_secret),
      account_id:      cfg.account_id  ?? null,
      ad_accounts:     cfg.ad_accounts ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// POST /x_ads/manual-token — save OAuth 1.0a credentials from the Developer Portal
router.post('/x_ads/manual-token', async (req, res) => {
  const { consumer_key, consumer_secret, access_token, access_token_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!consumer_key?.trim() || !consumer_secret?.trim() || !access_token?.trim() || !access_token_secret?.trim()) {
    return res.status(400).json({ error: 'consumer_key, consumer_secret, access_token, and access_token_secret are all required' })
  }

  const cfg = getXConfig(clientId)
  cfg.access_token         = access_token.trim()
  cfg.oauth1_consumer_key  = consumer_key.trim()
  cfg.oauth1_consumer_secret = consumer_secret.trim()
  cfg.oauth1_access_secret = access_token_secret.trim()
  cfg.refresh_token        = null
  cfg.ad_accounts          = []
  cfg.account_id           = null

  db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'x_ads' AND client_id = ?`)
    .run(JSON.stringify(cfg), clientId)

  const oauth1 = { consumerKey: consumer_key.trim(), consumerSecret: consumer_secret.trim(), accessToken: access_token.trim(), accessSecret: access_token_secret.trim() }
  try {
    const accounts  = await xListAdAccounts(access_token.trim(), oauth1)
    cfg.ad_accounts = accounts
    cfg.account_id  = accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'x_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ok: true, ad_accounts: accounts, account_id: cfg.account_id })
  } catch (e) {
    console.warn('[X Ads] manual token — could not fetch accounts:', e instanceof Error ? e.message : e)
    res.json({ ok: true, ad_accounts: [], account_id: null })
  }
})

// ─── X OAUTH ──────────────────────────────────────────────────────────────────

router.get('/x_ads/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getXConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const xClientId = cfg.x_client_id as string | undefined
  if (!xClientId) {
    return res.status(400).json({ error: 'X credentials not configured. Enter your Client ID and Secret first.' })
  }
  const { verifier, challenge } = generateXPkce()
  // Stash the verifier so /callback can complete the exchange. We also stash the
  // state token for CSRF sanity.
  cfg.pkce_verifier = verifier
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'x_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)

  const url = getXAuthUrl(xClientId, X_REDIRECT, String(clientId), challenge)
  res.json({ url })
})

router.get('/x_ads/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg            = getXConfig(clientId)
    const xClientId      = cfg.x_client_id     as string | undefined
    const xClientSecret  = cfg.x_client_secret as string | undefined
    const verifier       = cfg.pkce_verifier   as string | undefined
    if (!xClientId || !xClientSecret) return res.status(400).send('X credentials not configured')
    if (!verifier) return res.status(400).send('Missing PKCE verifier — restart the connect flow')

    const tok = await xExchange(code, X_REDIRECT, xClientId, xClientSecret, verifier)
    const config: Record<string, unknown> = {
      x_client_id:     xClientId,
      x_client_secret: xClientSecret,
      access_token:    tok.access_token,
      refresh_token:   tok.refresh_token ?? null,
      expires_at:      Date.now() + (tok.expires_in ?? 0) * 1000,
      ad_accounts:     [],
      account_id:      null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'x_ads' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const accounts = await xListAdAccounts(tok.access_token)
      config.ad_accounts = accounts
      config.account_id  = accounts[0]?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'x_ads' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[X Ads] Could not fetch ad accounts:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>X Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`X OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/x_ads/refresh-accounts', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getXConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  if (!token) return res.status(400).json({ error: 'X not connected' })

  const oauth1 = cfg.oauth1_consumer_key ? {
    consumerKey:    cfg.oauth1_consumer_key    as string,
    consumerSecret: cfg.oauth1_consumer_secret as string,
    accessToken:    token,
    accessSecret:   cfg.oauth1_access_secret   as string,
  } : undefined

  try {
    const accounts   = await xListAdAccounts(token, oauth1)
    cfg.ad_accounts  = accounts
    cfg.account_id   = cfg.account_id ?? accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'x_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ad_accounts: accounts, account_id: cfg.account_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/x_ads/select-account', (req, res) => {
  const { account_id } = req.body as { account_id: string }
  if (!account_id) return res.status(400).json({ error: 'account_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getXConfig(clientId)
  cfg.account_id = account_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'x_ads' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/x_ads/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getXConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token     = cfg.access_token as string
  const accountId = (req.body?.account_id as string | undefined) ?? cfg.account_id as string
  if (!token)     return res.status(400).json({ error: 'X not connected' })
  if (!accountId) return res.status(400).json({ error: 'No X ad account selected' })

  try {
    const r = await createXCampaign(accountId, token, {
      name:         campaign.name as string,
      goal:         campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 10,
      start_date:   campaign.start_date as string | null,
      end_date:     campaign.end_date   as string | null,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`x_ads:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'x_ads' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, lineItemId: r.lineItemId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/x_ads/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getXConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token as string | undefined
  const accountId = cfg.account_id   as string | undefined
  if (!token || !accountId) return res.status(400).json({ error: 'X not connected or no account selected' })

  try {
    const days = await xInsights(accountId, token, 30)
    const xCampaigns = db.prepare(`
      SELECT DISTINCT cc.campaign_id as id
      FROM campaign_channels cc
      JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.channel_slug = 'x_ads' AND c.client_id = ?
    `).all(clientId) as { id: number }[]

    if (xCampaigns.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO analytics_daily (campaign_id, channel_slug, date, impressions, clicks, conversions, spend)
        VALUES (?, 'x_ads', ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, date) DO UPDATE SET
          impressions = impressions + excluded.impressions,
          clicks      = clicks + excluded.clicks,
          conversions = conversions + excluded.conversions,
          spend       = spend + excluded.spend
      `)
      db.transaction(() => {
        for (const day of days) {
          for (const c of xCampaigns) {
            upsert.run(c.id, day.date, day.impressions, day.clicks, day.conversions, day.spend)
          }
        }
      })()
    }

    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'x_ads' AND client_id = ?").run(clientId)
    res.json({ ok: true, days: days.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── SNAPCHAT ADS CREDENTIALS ────────────────────────────────────────────────

router.post('/snapchat/credentials', (req, res) => {
  const { snapchat_client_id, snapchat_client_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!snapchat_client_id || !snapchat_client_secret) {
    return res.status(400).json({ error: 'snapchat_client_id and snapchat_client_secret are required' })
  }
  const cfg = getSnapConfig(clientId)
  cfg.snapchat_client_id     = snapchat_client_id.trim()
  cfg.snapchat_client_secret = snapchat_client_secret.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'snapchat' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.get('/snapchat/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getSnapConfig(clientId)
    res.json({
      has_credentials: !!(cfg.snapchat_client_id && cfg.snapchat_client_secret),
      account_id:      cfg.account_id  ?? null,
      ad_accounts:     cfg.ad_accounts ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// POST /snapchat/manual-token
router.post('/snapchat/manual-token', async (req, res) => {
  const { access_token } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!access_token?.trim()) return res.status(400).json({ error: 'access_token required' })

  const cfg = getSnapConfig(clientId)
  cfg.access_token = access_token.trim()
  cfg.ad_accounts  = []
  cfg.account_id   = null

  db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'snapchat' AND client_id = ?`)
    .run(JSON.stringify(cfg), clientId)

  try {
    const accounts  = await snapListAdAccounts(access_token.trim())
    cfg.ad_accounts = accounts
    cfg.account_id  = accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'snapchat' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ok: true, ad_accounts: accounts, account_id: cfg.account_id })
  } catch (e) {
    console.warn('[Snapchat] manual token — could not fetch accounts:', e instanceof Error ? e.message : e)
    res.json({ ok: true, ad_accounts: [], account_id: null })
  }
})

// ─── SNAPCHAT OAUTH ──────────────────────────────────────────────────────────

router.get('/snapchat/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getSnapConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const snapClientId = cfg.snapchat_client_id as string | undefined
  if (!snapClientId) {
    return res.status(400).json({ error: 'Snapchat credentials not configured. Enter your Client ID and Secret first.' })
  }
  const url = getSnapAuthUrl(snapClientId, SNAP_REDIRECT, String(clientId))
  res.json({ url })
})

router.get('/snapchat/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg                  = getSnapConfig(clientId)
    const snapClientId         = cfg.snapchat_client_id     as string | undefined
    const snapClientSecret     = cfg.snapchat_client_secret as string | undefined
    if (!snapClientId || !snapClientSecret) return res.status(400).send('Snapchat credentials not configured')

    const tok = await snapExchange(code, SNAP_REDIRECT, snapClientId, snapClientSecret)
    const config: Record<string, unknown> = {
      snapchat_client_id:     snapClientId,
      snapchat_client_secret: snapClientSecret,
      access_token:           tok.access_token,
      refresh_token:          tok.refresh_token ?? null,
      expires_at:             Date.now() + (tok.expires_in ?? 0) * 1000,
      ad_accounts:            [],
      account_id:             null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'snapchat' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const accounts = await snapListAdAccounts(tok.access_token)
      config.ad_accounts = accounts
      config.account_id  = accounts[0]?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'snapchat' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[Snapchat] Could not fetch ad accounts:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>Snapchat Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`Snapchat OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/snapchat/refresh-accounts', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getSnapConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  if (!token) return res.status(400).json({ error: 'Snapchat not connected' })

  try {
    const accounts   = await snapListAdAccounts(token)
    cfg.ad_accounts  = accounts
    cfg.account_id   = cfg.account_id ?? accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'snapchat' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ad_accounts: accounts, account_id: cfg.account_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/snapchat/select-account', (req, res) => {
  const { account_id } = req.body as { account_id: string }
  if (!account_id) return res.status(400).json({ error: 'account_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getSnapConfig(clientId)
  cfg.account_id = account_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'snapchat' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/snapchat/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getSnapConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token     = cfg.access_token as string
  const accountId = (req.body?.account_id as string | undefined) ?? cfg.account_id as string
  if (!token)     return res.status(400).json({ error: 'Snapchat not connected' })
  if (!accountId) return res.status(400).json({ error: 'No Snapchat ad account selected' })

  try {
    const r = await createSnapCampaign(accountId, token, {
      name:         campaign.name as string,
      goal:         campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 20,
      start_date:   campaign.start_date as string | null,
      end_date:     campaign.end_date   as string | null,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`snapchat:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'snapchat' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, adSquadId: r.adSquadId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/snapchat/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getSnapConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token as string | undefined
  const accountId = cfg.account_id   as string | undefined
  if (!token || !accountId) return res.status(400).json({ error: 'Snapchat not connected or no account selected' })

  try {
    const days = await snapInsights(accountId, token, 30)
    const snapCampaigns = db.prepare(`
      SELECT DISTINCT cc.campaign_id as id
      FROM campaign_channels cc
      JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.channel_slug = 'snapchat' AND c.client_id = ?
    `).all(clientId) as { id: number }[]

    if (snapCampaigns.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO analytics_daily (campaign_id, channel_slug, date, impressions, clicks, conversions, spend)
        VALUES (?, 'snapchat', ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, date) DO UPDATE SET
          impressions = impressions + excluded.impressions,
          clicks      = clicks + excluded.clicks,
          conversions = conversions + excluded.conversions,
          spend       = spend + excluded.spend
      `)
      db.transaction(() => {
        for (const day of days) {
          for (const c of snapCampaigns) {
            // Snapchat "swipes" are the platform equivalent of clicks for non-Snap placements.
            upsert.run(c.id, day.date, day.impressions, day.swipes, day.conversions, day.spend)
          }
        }
      })()
    }

    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'snapchat' AND client_id = ?").run(clientId)
    res.json({ ok: true, days: days.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── AMAZON ADS CREDENTIALS ──────────────────────────────────────────────────

router.post('/amazon/credentials', (req, res) => {
  const { amazon_client_id, amazon_client_secret, region } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!amazon_client_id || !amazon_client_secret) {
    return res.status(400).json({ error: 'amazon_client_id and amazon_client_secret are required' })
  }
  const cfg = getAmazonConfig(clientId)
  cfg.amazon_client_id     = amazon_client_id.trim()
  cfg.amazon_client_secret = amazon_client_secret.trim()
  cfg.region               = (region ?? 'NA').toUpperCase()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'amazon' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.get('/amazon/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getAmazonConfig(clientId)
    res.json({
      has_credentials: !!(cfg.amazon_client_id && cfg.amazon_client_secret),
      region:          cfg.region     ?? 'NA',
      profile_id:      cfg.profile_id ?? null,
      profiles:        cfg.profiles   ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// ─── AMAZON OAUTH ─────────────────────────────────────────────────────────────

router.get('/amazon/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getAmazonConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const amazonCid = cfg.amazon_client_id as string | undefined
  if (!amazonCid) {
    return res.status(400).json({ error: 'Amazon credentials not configured. Enter your LWA Client ID and Secret first.' })
  }
  const url = getAmazonAuthUrl(amazonCid, AMAZON_REDIRECT, String(clientId))
  res.json({ url })
})

router.get('/amazon/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg              = getAmazonConfig(clientId)
    const amazonCid        = cfg.amazon_client_id     as string | undefined
    const amazonSecret     = cfg.amazon_client_secret as string | undefined
    const region           = (cfg.region as string) ?? 'NA'
    if (!amazonCid || !amazonSecret) return res.status(400).send('Amazon credentials not configured')

    const tok = await amazonExchange(code, AMAZON_REDIRECT, amazonCid, amazonSecret)
    const config: Record<string, unknown> = {
      amazon_client_id:     amazonCid,
      amazon_client_secret: amazonSecret,
      region,
      access_token:         tok.access_token,
      refresh_token:        tok.refresh_token ?? null,
      expires_at:           Date.now() + (tok.expires_in ?? 0) * 1000,
      profiles:             [],
      profile_id:           null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'amazon' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const profiles = await amazonListProfiles(tok.access_token, amazonCid, region)
      config.profiles   = profiles
      config.profile_id = profiles[0]?.profileId ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'amazon' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[Amazon Ads] Could not fetch profiles:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>Amazon Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`Amazon OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/amazon/refresh-profiles', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getAmazonConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token     as string | undefined
  const amazonCid = cfg.amazon_client_id as string | undefined
  const region    = (cfg.region as string) ?? 'NA'
  if (!token || !amazonCid) return res.status(400).json({ error: 'Amazon not connected' })

  try {
    const profiles    = await amazonListProfiles(token, amazonCid, region)
    cfg.profiles      = profiles
    cfg.profile_id    = cfg.profile_id ?? profiles[0]?.profileId ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'amazon' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ profiles, profile_id: cfg.profile_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/amazon/select-profile', (req, res) => {
  const { profile_id } = req.body as { profile_id: string }
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getAmazonConfig(clientId)
  cfg.profile_id = profile_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'amazon' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/amazon/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getAmazonConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token     = cfg.access_token     as string
  const amazonCid = cfg.amazon_client_id as string
  const profileId = (req.body?.profile_id as string | undefined) ?? cfg.profile_id as string
  const region    = (cfg.region as string) ?? 'NA'
  if (!token || !amazonCid) return res.status(400).json({ error: 'Amazon not connected' })
  if (!profileId)           return res.status(400).json({ error: 'No Amazon profile selected' })

  try {
    const r = await createAmazonCampaign(token, amazonCid, profileId, region, {
      name:         campaign.name as string,
      goal:         campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 5,
      start_date:   campaign.start_date as string | null,
      end_date:     campaign.end_date   as string | null,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`amazon:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'amazon' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Amazon reports are async (v3) — this kicks off a report request and returns
// the pending reportId. A background worker would poll + ingest later.
router.post('/amazon/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getAmazonConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token     as string | undefined
  const amazonCid = cfg.amazon_client_id as string | undefined
  const profileId = cfg.profile_id       as string | undefined
  const region    = (cfg.region as string) ?? 'NA'
  if (!token || !amazonCid || !profileId) return res.status(400).json({ error: 'Amazon not connected or no profile selected' })

  try {
    const r = await amazonRequestReport(token, amazonCid, profileId, region, 30)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'amazon' AND client_id = ?").run(clientId)
    res.json({ ok: true, report_id: r.reportId, pending: true, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── PINTEREST ADS CREDENTIALS ───────────────────────────────────────────────

router.post('/pinterest/credentials', (req, res) => {
  const { pinterest_client_id, pinterest_client_secret } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!pinterest_client_id || !pinterest_client_secret) {
    return res.status(400).json({ error: 'pinterest_client_id and pinterest_client_secret are required' })
  }
  const cfg = getPinterestConfig(clientId)
  cfg.pinterest_client_id     = pinterest_client_id.trim()
  cfg.pinterest_client_secret = pinterest_client_secret.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'pinterest' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.get('/pinterest/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getPinterestConfig(clientId)
    res.json({
      has_credentials: !!(cfg.pinterest_client_id && cfg.pinterest_client_secret),
      account_id:      cfg.account_id  ?? null,
      ad_accounts:     cfg.ad_accounts ?? [],
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// ─── PINTEREST OAUTH ──────────────────────────────────────────────────────────

router.get('/pinterest/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getPinterestConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const pinClientId = cfg.pinterest_client_id as string | undefined
  if (!pinClientId) {
    return res.status(400).json({ error: 'Pinterest credentials not configured. Enter your App ID and Secret first.' })
  }
  const url = getPinAuthUrl(pinClientId, PIN_REDIRECT, String(clientId))
  res.json({ url })
})

router.get('/pinterest/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg               = getPinterestConfig(clientId)
    const pinClientId       = cfg.pinterest_client_id     as string | undefined
    const pinClientSecret   = cfg.pinterest_client_secret as string | undefined
    if (!pinClientId || !pinClientSecret) return res.status(400).send('Pinterest credentials not configured')

    const tok = await pinExchange(code, PIN_REDIRECT, pinClientId, pinClientSecret)
    const config: Record<string, unknown> = {
      pinterest_client_id:     pinClientId,
      pinterest_client_secret: pinClientSecret,
      access_token:            tok.access_token,
      refresh_token:           tok.refresh_token ?? null,
      expires_at:              Date.now() + (tok.expires_in ?? 0) * 1000,
      ad_accounts:             [],
      account_id:              null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'pinterest' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const accounts = await pinListAdAccounts(tok.access_token)
      config.ad_accounts = accounts
      config.account_id  = accounts[0]?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'pinterest' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[Pinterest Ads] Could not fetch ad accounts:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>Pinterest Ads connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`Pinterest OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/pinterest/refresh-accounts', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getPinterestConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  if (!token) return res.status(400).json({ error: 'Pinterest not connected' })

  try {
    const accounts   = await pinListAdAccounts(token)
    cfg.ad_accounts  = accounts
    cfg.account_id   = cfg.account_id ?? accounts[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'pinterest' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ ad_accounts: accounts, account_id: cfg.account_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/pinterest/select-account', (req, res) => {
  const { account_id } = req.body as { account_id: string }
  if (!account_id) return res.status(400).json({ error: 'account_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getPinterestConfig(clientId)
  cfg.account_id = account_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'pinterest' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/pinterest/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getPinterestConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token     = cfg.access_token as string
  const accountId = (req.body?.account_id as string | undefined) ?? cfg.account_id as string
  if (!token)     return res.status(400).json({ error: 'Pinterest not connected' })
  if (!accountId) return res.status(400).json({ error: 'No Pinterest ad account selected' })

  try {
    const r = await createPinterestCampaign(accountId, token, {
      name:         campaign.name as string,
      goal:         campaign.goal as string,
      budget_daily: (campaign.budget_daily as number) || 5,
      start_date:   campaign.start_date as string | null,
      end_date:     campaign.end_date   as string | null,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`pinterest:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'pinterest' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, adGroupId: r.adGroupId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/pinterest/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getPinterestConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token     = cfg.access_token as string | undefined
  const accountId = cfg.account_id   as string | undefined
  if (!token || !accountId) return res.status(400).json({ error: 'Pinterest not connected or no account selected' })

  try {
    const days = await pinInsights(accountId, token, 30)
    const pinCampaigns = db.prepare(`
      SELECT DISTINCT cc.campaign_id as id
      FROM campaign_channels cc
      JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.channel_slug = 'pinterest' AND c.client_id = ?
    `).all(clientId) as { id: number }[]

    if (pinCampaigns.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO analytics_daily (campaign_id, channel_slug, date, impressions, clicks, conversions, spend)
        VALUES (?, 'pinterest', ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, date) DO UPDATE SET
          impressions = impressions + excluded.impressions,
          clicks      = clicks + excluded.clicks,
          conversions = conversions + excluded.conversions,
          spend       = spend + excluded.spend
      `)
      db.transaction(() => {
        for (const day of days) {
          for (const c of pinCampaigns) {
            upsert.run(c.id, day.date, day.impressions, day.clicks, day.conversions, day.spend)
          }
        }
      })()
    }

    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'pinterest' AND client_id = ?").run(clientId)
    res.json({ ok: true, days: days.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── MAILCHIMP CREDENTIALS ───────────────────────────────────────────────────

router.post('/mailchimp/credentials', (req, res) => {
  const { mailchimp_client_id, mailchimp_client_secret, from_email } = req.body as Record<string, string>
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  if (!mailchimp_client_id || !mailchimp_client_secret) {
    return res.status(400).json({ error: 'mailchimp_client_id and mailchimp_client_secret are required' })
  }
  const cfg = getMailchimpConfig(clientId)
  cfg.mailchimp_client_id     = mailchimp_client_id.trim()
  cfg.mailchimp_client_secret = mailchimp_client_secret.trim()
  if (from_email) cfg.from_email = from_email.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'mailchimp' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.get('/mailchimp/config', (req, res) => {
  try {
    const clientId = req.query.client_id ?? 1
    const cfg = getMailchimpConfig(clientId)
    res.json({
      has_credentials: !!(cfg.mailchimp_client_id && cfg.mailchimp_client_secret),
      dc:              cfg.dc           ?? null,
      audience_id:     cfg.audience_id  ?? null,
      audiences:       cfg.audiences    ?? [],
      from_email:      cfg.from_email   ?? null,
      login_email:     cfg.login_email  ?? null,
      account_name:    cfg.account_name ?? null,
    })
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
})

// ─── MAILCHIMP OAUTH ──────────────────────────────────────────────────────────

router.get('/mailchimp/connect', (req, res) => {
  const clientId = req.query.client_id ?? '1'
  let cfg: Record<string, unknown>
  try { cfg = getMailchimpConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const mcClientId = cfg.mailchimp_client_id as string | undefined
  if (!mcClientId) {
    return res.status(400).json({ error: 'Mailchimp credentials not configured. Enter your OAuth Client ID and Secret first.' })
  }
  const url = getMcAuthUrl(mcClientId, MC_REDIRECT, String(clientId))
  res.json({ url })
})

router.get('/mailchimp/callback', async (req, res) => {
  const code     = String(req.query.code ?? '')
  const clientId = req.query.state ?? '1'
  if (!code) return res.status(400).send('Missing code')

  try {
    const cfg              = getMailchimpConfig(clientId)
    const mcClientId       = cfg.mailchimp_client_id     as string | undefined
    const mcClientSecret   = cfg.mailchimp_client_secret as string | undefined
    if (!mcClientId || !mcClientSecret) return res.status(400).send('Mailchimp credentials not configured')

    const tok      = await mcExchange(code, MC_REDIRECT, mcClientId, mcClientSecret)
    const metadata = await mcFetchMetadata(tok.access_token)

    const config: Record<string, unknown> = {
      mailchimp_client_id:     mcClientId,
      mailchimp_client_secret: mcClientSecret,
      access_token:            tok.access_token,
      expires_at:              tok.expires_in > 0 ? Date.now() + tok.expires_in * 1000 : null,
      dc:                      metadata.dc,
      api_endpoint:            metadata.api_endpoint,
      login_email:             metadata.login_email ?? null,
      account_name:            metadata.account_name ?? null,
      from_email:              cfg.from_email ?? metadata.login_email ?? null,
      audiences:               [],
      audience_id:             null,
    }
    db.prepare(`UPDATE channels SET status = 'connected', config_json = ?, connected_at = datetime('now') WHERE slug = 'mailchimp' AND client_id = ?`)
      .run(JSON.stringify(config), clientId)

    try {
      const audiences = await mcListAudiences(metadata.dc, tok.access_token)
      config.audiences    = audiences
      config.audience_id  = audiences[0]?.id ?? null
      db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'mailchimp' AND client_id = ?").run(JSON.stringify(config), clientId)
    } catch (e) {
      console.warn('[Mailchimp] Could not fetch audiences:', e instanceof Error ? e.message : e)
    }

    res.send('<html><body><script>window.close()</script><p>Mailchimp connected! You can close this window.</p></body></html>')
  } catch (err: unknown) {
    res.status(500).send(`Mailchimp OAuth error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

router.post('/mailchimp/refresh-audiences', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getMailchimpConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  const dc    = cfg.dc           as string | undefined
  if (!token || !dc) return res.status(400).json({ error: 'Mailchimp not connected' })

  try {
    const audiences   = await mcListAudiences(dc, token)
    cfg.audiences     = audiences
    cfg.audience_id   = cfg.audience_id ?? audiences[0]?.id ?? null
    db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'mailchimp' AND client_id = ?").run(JSON.stringify(cfg), clientId)
    res.json({ audiences, audience_id: cfg.audience_id })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/mailchimp/select-audience', (req, res) => {
  const { audience_id } = req.body as { audience_id: string }
  if (!audience_id) return res.status(400).json({ error: 'audience_id required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getMailchimpConfig(clientId)
  cfg.audience_id = audience_id
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'mailchimp' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/mailchimp/set-from-email', (req, res) => {
  const { from_email } = req.body as { from_email: string }
  if (!from_email) return res.status(400).json({ error: 'from_email required' })
  const clientId = req.body.client_id ?? req.query.client_id ?? 1
  const cfg = getMailchimpConfig(clientId)
  cfg.from_email = from_email.trim()
  db.prepare("UPDATE channels SET config_json = ? WHERE slug = 'mailchimp' AND client_id = ?").run(JSON.stringify(cfg), clientId)
  res.json({ ok: true })
})

router.post('/mailchimp/push-campaign/:id', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  let cfg: Record<string, unknown>
  try { cfg = getMailchimpConfig(campaign.client_id ?? 1) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }

  const token      = cfg.access_token as string
  const dc         = cfg.dc           as string
  const audienceId = (req.body?.audience_id as string | undefined) ?? cfg.audience_id as string
  const fromEmail  = (req.body?.from_email  as string | undefined) ?? cfg.from_email  as string
  if (!token || !dc) return res.status(400).json({ error: 'Mailchimp not connected' })
  if (!audienceId)   return res.status(400).json({ error: 'No Mailchimp audience selected' })
  if (!fromEmail)    return res.status(400).json({ error: 'Set a From email in Channels first' })

  try {
    const r = await createMailchimpCampaign(dc, token, audienceId, fromEmail, {
      name:    campaign.name        as string,
      subject: campaign.headline    as string | undefined,
      html:    campaign.description as string | undefined,
    })
    db.prepare("UPDATE campaigns SET ext_id = ?, updated_at = datetime('now') WHERE id = ?").run(`mailchimp:${r.campaignId}`, req.params.id)
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'mailchimp' AND client_id = ?").run(campaign.client_id ?? 1)
    res.json({ ok: true, campaignId: r.campaignId, webId: r.webId })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Sync: fetch per-campaign reports for MAAFlo campaigns that were pushed to
// Mailchimp. One row per campaign keyed by the Mailchimp send_date.
router.post('/mailchimp/sync', async (req, res) => {
  const clientId = req.body?.client_id ?? req.query.client_id ?? 1
  let cfg: Record<string, unknown>
  try { cfg = getMailchimpConfig(clientId) } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  const token = cfg.access_token as string | undefined
  const dc    = cfg.dc           as string | undefined
  if (!token || !dc) return res.status(400).json({ error: 'Mailchimp not connected' })

  const rows = db.prepare(`
    SELECT cc.campaign_id as id, cc.ext_campaign_id as ext
    FROM campaign_channels cc
    JOIN campaigns c ON c.id = cc.campaign_id
    WHERE cc.channel_slug = 'mailchimp' AND c.client_id = ? AND cc.ext_campaign_id IS NOT NULL
  `).all(clientId) as { id: number; ext: string }[]

  let synced = 0
  const upsert = db.prepare(`
    INSERT INTO analytics_daily (campaign_id, channel_slug, date, impressions, clicks, conversions, spend)
    VALUES (?, 'mailchimp', ?, ?, ?, ?, 0)
    ON CONFLICT(campaign_id, date) DO UPDATE SET
      impressions = excluded.impressions,
      clicks      = excluded.clicks,
      conversions = excluded.conversions
  `)

  try {
    for (const row of rows) {
      const report = await mcGetReport(dc, token, row.ext)
      if (!report) continue
      // impressions ≈ emails_sent, clicks = clicks_total, conversions = unique_opens
      upsert.run(row.id, report.send_date, report.emails_sent, report.clicks, report.unique_opens)
      synced++
    }
    db.prepare("UPDATE channels SET last_sync_at = datetime('now') WHERE slug = 'mailchimp' AND client_id = ?").run(clientId)
    res.json({ ok: true, campaigns_synced: synced, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

export default router
