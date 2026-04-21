// X (Twitter) Ads API integration — OAuth 2.0 with PKCE
// Docs: https://developer.x.com/en/docs/x-ads-api
// Auth: https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code

import { randomBytes, createHash, createHmac } from 'crypto'

const ADS_BASE    = 'https://ads-api.x.com/12'
const OAUTH_AUTH  = 'https://x.com/i/oauth2/authorize'
const OAUTH_TOKEN = 'https://api.x.com/2/oauth2/token'

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier  = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, state: string, challenge: string): string {
  const url = new URL(OAUTH_AUTH)
  url.searchParams.set('response_type',         'code')
  url.searchParams.set('client_id',             clientId)
  url.searchParams.set('redirect_uri',          redirectUri)
  url.searchParams.set('state',                 state)
  url.searchParams.set('code_challenge',        challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // offline.access → gives refresh_token. Ads-specific scopes are granted when
  // the app is approved for X Ads API access.
  url.searchParams.set('scope', 'tweet.read users.read offline.access')
  return url.toString()
}

export interface XTokenResponse {
  access_token:   string
  refresh_token?: string
  expires_in:     number
  scope?:         string
  token_type?:    string
}

export async function exchangeAuthCode(
  code:         string,
  redirectUri:  string,
  clientId:     string,
  clientSecret: string,
  verifier:     string
): Promise<XTokenResponse> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    code_verifier: verifier,
  })
  // X accepts either Basic auth (for confidential clients) or client_id in body (public clients)
  const auth = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res  = await fetch(OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': auth },
    body,
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`X token exchange non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || data.error) {
    throw new Error(String(data.error_description ?? data.error ?? text.slice(0, 200)))
  }
  return {
    access_token:  String(data.access_token ?? ''),
    refresh_token: data.refresh_token ? String(data.refresh_token) : undefined,
    expires_in:    Number(data.expires_in ?? 0),
    scope:         data.scope ? String(data.scope) : undefined,
    token_type:    data.token_type ? String(data.token_type) : undefined,
  }
}

// ─── OAUTH 1.0a SIGNING ───────────────────────────────────────────────────────

export interface XOAuth1Creds {
  consumerKey:    string
  consumerSecret: string
  accessToken:    string
  accessSecret:   string
}

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function oauth1Header(method: string, baseUrl: string, queryParams: Record<string, string>, creds: XOAuth1Creds): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     creds.consumerKey,
    oauth_nonce:            randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_token:            creds.accessToken,
    oauth_version:          '1.0',
  }
  const allParams: Record<string, string> = { ...queryParams, ...oauthParams }
  const paramStr = Object.keys(allParams).sort()
    .map(k => `${pct(k)}=${pct(allParams[k])}`)
    .join('&')
  const baseStr  = `${method.toUpperCase()}&${pct(baseUrl)}&${pct(paramStr)}`
  const sigKey   = `${pct(creds.consumerSecret)}&${pct(creds.accessSecret)}`
  const sig      = createHmac('sha1', sigKey).update(baseStr).digest('base64')
  oauthParams.oauth_signature = sig
  const header = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${pct(k)}="${pct(oauthParams[k])}"`)
    .join(', ')
  return header
}

// ─── HTTP WRAPPER ─────────────────────────────────────────────────────────────

async function xRequest(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  params?: Record<string, unknown>,
  body?: Record<string, unknown>,
  oauth1?: XOAuth1Creds
): Promise<Record<string, unknown>> {
  const url = new URL(`${ADS_BASE}${path}`)
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  console.log(`[X Ads] ${method} ${url.pathname}`)

  let authHeader: string
  if (oauth1) {
    const qp: Record<string, string> = {}
    url.searchParams.forEach((v, k) => { qp[k] = v })
    authHeader = oauth1Header(method, `${ADS_BASE}${path}`, qp, oauth1)
  } else {
    authHeader = `Bearer ${accessToken}`
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type':  'application/json',
    },
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`[X Ads] HTTP ${res.status}: ${text.slice(0, 300)}`)
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(text) as Record<string, unknown> } catch { /* ignore */ }
    const errs = (data?.errors ?? []) as Record<string, unknown>[]
    const msg  = errs[0]?.message ?? data?.message ?? text.slice(0, 200)
    throw new Error(`X Ads API error (HTTP ${res.status}): ${msg}`)
  }

  if (!text) return {}
  try { return JSON.parse(text) as Record<string, unknown> }
  catch { return {} }
}

// ─── AD ACCOUNTS ──────────────────────────────────────────────────────────────

export interface XAdAccount {
  id:            string
  name:          string
  business_name?:string
  currency?:     string
  timezone?:     string
  approval_status?: string
}

export async function listAdAccounts(accessToken: string, oauth1?: XOAuth1Creds): Promise<XAdAccount[]> {
  const data = await xRequest('/accounts', 'GET', accessToken, { count: 200 }, undefined, oauth1)
  const list = (data.data ?? []) as Record<string, unknown>[]
  return list.map(a => ({
    id:               String(a.id ?? ''),
    name:             String(a.name ?? ''),
    business_name:    a.business_name ? String(a.business_name) : undefined,
    currency:         a.currency ? String(a.currency) : undefined,
    timezone:         a.timezone ? String(a.timezone) : undefined,
    approval_status:  a.approval_status ? String(a.approval_status) : undefined,
  }))
}

// ─── CAMPAIGN CREATION ────────────────────────────────────────────────────────

// X Ads objective values (used on line_items)
const OBJECTIVE_MAP: Record<string, string> = {
  awareness:   'REACH',
  traffic:     'WEBSITE_CLICKS',
  leads:       'WEBSITE_CONVERSIONS',
  conversions: 'WEBSITE_CONVERSIONS',
  sales:       'WEBSITE_CONVERSIONS',
}

export interface XCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
  end_date?:    string | null
}

// X Ads API expects currency amounts as micro-units (multiply by 1,000,000)
function toMicros(amount: number): string {
  return String(Math.round(amount * 1_000_000))
}

export async function createXCampaign(
  accountId:    string,
  accessToken:  string,
  input:        XCampaignInput,
  oauth1?:      XOAuth1Creds
): Promise<{ campaignId: string; lineItemId: string; fundingInstrumentId: string | null }> {
  const objective   = OBJECTIVE_MAP[input.goal] ?? 'WEBSITE_CLICKS'
  const dailyBudget = Math.max(input.budget_daily || 10, 1)

  // 1 — Get funding instrument (campaigns need one)
  const fiData = await xRequest(`/accounts/${accountId}/funding_instruments`, 'GET', accessToken, { count: 50 }, undefined, oauth1)
  const fis    = (fiData.data ?? []) as Record<string, unknown>[]
  const fi     = fis.find(f => !f.cancelled) ?? fis[0]
  const fundingInstrumentId = fi ? String(fi.id ?? '') : null
  if (!fundingInstrumentId) {
    throw new Error('X Ads account has no active funding instrument — add a payment method in the Ads Manager first')
  }

  // 2 — Campaign
  const campBody: Record<string, unknown> = {
    name:                     input.name,
    funding_instrument_id:    fundingInstrumentId,
    daily_budget_amount_local_micro: toMicros(dailyBudget),
    entity_status:            'PAUSED',
  }
  if (input.start_date) campBody.start_time = new Date(input.start_date).toISOString()
  if (input.end_date)   campBody.end_time   = new Date(input.end_date).toISOString()

  const campData = await xRequest(`/accounts/${accountId}/campaigns`, 'POST', accessToken, undefined, campBody, oauth1)
  const campInner = (campData.data ?? {}) as Record<string, unknown>
  const campaignId = String(campInner.id ?? '')
  if (!campaignId) throw new Error('X Ads did not return a campaign id')

  // 3 — Line Item (ad group equivalent)
  const lineBody: Record<string, unknown> = {
    campaign_id:              campaignId,
    name:                     `${input.name} — Line Item`,
    product_type:             'PROMOTED_TWEETS',
    placements:               ['ALL_ON_TWITTER'],
    objective,
    bid_strategy:             'AUTO',
    pay_by:                   objective === 'REACH' ? 'IMPRESSION' : 'ENGAGEMENT',
    entity_status:            'PAUSED',
    total_budget_amount_local_micro: toMicros(dailyBudget * 30),
  }
  const lineData   = await xRequest(`/accounts/${accountId}/line_items`, 'POST', accessToken, undefined, lineBody, oauth1)
  const lineInner  = (lineData.data ?? {}) as Record<string, unknown>
  const lineItemId = String(lineInner.id ?? '')

  return { campaignId, lineItemId, fundingInstrumentId }
}

// ─── REPORTING ────────────────────────────────────────────────────────────────

export interface XInsightDay {
  date:        string
  impressions: number
  clicks:      number
  spend:       number
  conversions: number
}

// X Ads analytics: synchronous /stats/accounts/:id
export async function getInsights(
  accountId:   string,
  accessToken: string,
  days = 30
): Promise<XInsightDay[]> {
  const end   = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60_000)

  const data = await xRequest(`/stats/accounts/${accountId}`, 'GET', accessToken, {
    entity:            'ACCOUNT',
    entity_ids:        accountId,
    start_time:        start.toISOString(),
    end_time:          end.toISOString(),
    granularity:       'DAY',
    metric_groups:     'ENGAGEMENT,BILLING',
    placement:         'ALL_ON_TWITTER',
  })
  const list = (data.data ?? []) as Record<string, unknown>[]
  if (list.length === 0) return []

  // X returns one entry per entity; each has arrays of metrics keyed by metric name.
  const first = list[0] ?? {}
  const metrics = ((first.id_data ?? []) as Record<string, unknown>[])[0]?.metrics as Record<string, number[] | null> | undefined
  if (!metrics) return []

  const impressions = metrics.impressions ?? []
  const clicks      = metrics.clicks      ?? []
  const spend       = metrics.billed_charge_local_micro ?? []
  const conversions = metrics.conversions ?? []

  // Build day-by-day rows. X returns a parallel array per requested day.
  const n = Math.max(impressions.length, clicks.length, spend.length, conversions.length)
  const out: XInsightDay[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60_000)
    out.push({
      date:        d.toISOString().slice(0, 10),
      impressions: impressions[i] ?? 0,
      clicks:      clicks[i]      ?? 0,
      spend:       (spend[i] ?? 0) / 1_000_000,   // micros → currency
      conversions: conversions[i] ?? 0,
    })
  }
  return out
}
