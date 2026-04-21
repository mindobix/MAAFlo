// Pinterest Ads API integration (v5)
// Docs: https://developers.pinterest.com/docs/api/v5/
// Auth: OAuth 2.0 — https://developers.pinterest.com/docs/getting-started/authentication/

const API_BASE    = 'https://api.pinterest.com/v5'
const OAUTH_AUTH  = 'https://www.pinterest.com/oauth/'
const OAUTH_TOKEN = 'https://api.pinterest.com/v5/oauth/token'

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(OAUTH_AUTH)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('redirect_uri',  redirectUri)
  url.searchParams.set('state',         state)
  url.searchParams.set('scope',         'ads:read,ads:write,user_accounts:read')
  return url.toString()
}

export interface PinterestTokenResponse {
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
  clientSecret: string
): Promise<PinterestTokenResponse> {
  const auth = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  const res  = await fetch(OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': auth },
    body,
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`Pinterest token exchange non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || data.error) {
    throw new Error(String(data.error_description ?? data.error ?? data.message ?? text.slice(0, 200)))
  }
  return {
    access_token:  String(data.access_token ?? ''),
    refresh_token: data.refresh_token ? String(data.refresh_token) : undefined,
    expires_in:    Number(data.expires_in ?? 0),
    scope:         data.scope ? String(data.scope) : undefined,
    token_type:    data.token_type ? String(data.token_type) : undefined,
  }
}

// ─── HTTP WRAPPER ─────────────────────────────────────────────────────────────

async function pinRequest(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  params?: Record<string, unknown>,
  body?: unknown
): Promise<Record<string, unknown>> {
  const url = new URL(`${API_BASE}${path}`)
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  console.log(`[Pinterest Ads] ${method} ${url.pathname}`)

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`[Pinterest Ads] HTTP ${res.status}: ${text.slice(0, 300)}`)
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(text) as Record<string, unknown> } catch { /* ignore */ }
    const msg = data?.message ?? data?.error_description ?? data?.error ?? text.slice(0, 200)
    throw new Error(`Pinterest API error (HTTP ${res.status}): ${msg}`)
  }

  if (!text) return {}
  try { return JSON.parse(text) as Record<string, unknown> }
  catch { return {} }
}

// ─── AD ACCOUNTS ──────────────────────────────────────────────────────────────

export interface PinterestAdAccount {
  id:       string
  name:     string
  currency?: string
  country?:  string
  owner?:    string
}

export async function listAdAccounts(accessToken: string): Promise<PinterestAdAccount[]> {
  const data  = await pinRequest('/ad_accounts', 'GET', accessToken, { page_size: 100, include_shared_accounts: 'true' })
  const items = (data.items ?? []) as Record<string, unknown>[]
  return items.map(a => ({
    id:       String(a.id ?? ''),
    name:     String(a.name ?? ''),
    currency: a.currency ? String(a.currency) : undefined,
    country:  a.country  ? String(a.country)  : undefined,
    owner:    a.owner    ? String(a.owner)    : undefined,
  }))
}

// ─── CAMPAIGN CREATION ────────────────────────────────────────────────────────

// Pinterest objective_type values
const OBJECTIVE_MAP: Record<string, string> = {
  awareness:   'AWARENESS',
  traffic:     'WEB_SESSIONS',
  leads:       'CONSIDERATION',
  conversions: 'WEB_CONVERSION',
  sales:       'WEB_CONVERSION',
}

// Billable events vary by objective — CLICKTHROUGH for traffic/conversions, IMPRESSION for awareness.
const BILLABLE_MAP: Record<string, string> = {
  AWARENESS:      'IMPRESSION',
  CONSIDERATION:  'CLICKTHROUGH',
  VIDEO_VIEW:     'VIDEO_V_50_MRC',
  WEB_CONVERSION: 'CLICKTHROUGH',
  WEB_SESSIONS:   'CLICKTHROUGH',
  CATALOG_SALES:  'CLICKTHROUGH',
}

export interface PinterestCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
  end_date?:    string | null
}

function toMicros(amount: number): number {
  return Math.round(amount * 1_000_000)
}

function toEpochSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000)
}

export async function createPinterestCampaign(
  adAccountId: string,
  accessToken: string,
  input:       PinterestCampaignInput
): Promise<{ campaignId: string; adGroupId: string }> {
  const objective   = OBJECTIVE_MAP[input.goal] ?? 'WEB_SESSIONS'
  const billable    = BILLABLE_MAP[objective]   ?? 'CLICKTHROUGH'
  const daily       = Math.max(input.budget_daily || 5, 1)
  const startD      = input.start_date ? new Date(input.start_date) : new Date(Date.now() + 5 * 60_000)
  const endD        = input.end_date   ? new Date(input.end_date)   : undefined

  // 1 — Campaign
  const campBody = [{
    name:                        input.name,
    status:                      'PAUSED',
    objective_type:              objective,
    daily_spend_cap:             toMicros(daily),
    ...(endD ? { end_time: toEpochSeconds(endD) } : {}),
    start_time:                  toEpochSeconds(startD),
  }]
  const campResp  = await pinRequest(`/ad_accounts/${adAccountId}/campaigns`, 'POST', accessToken, undefined, campBody)
  const campItems = (campResp.items ?? []) as Record<string, unknown>[]
  const campFirst = (campItems[0]?.data ?? {}) as Record<string, unknown>
  const exc       = campItems[0]?.exceptions as Record<string, unknown>[] | undefined
  if (exc && exc.length > 0) throw new Error(`Pinterest campaign exception: ${JSON.stringify(exc[0])}`)
  const campaignId = String(campFirst.id ?? '')
  if (!campaignId) throw new Error('Pinterest did not return a campaign id')

  // 2 — Ad Group
  const adGroupBody = [{
    name:                     `${input.name} — Ad Group`,
    status:                   'PAUSED',
    campaign_id:              campaignId,
    billable_event:           billable,
    budget_in_micro_currency: toMicros(daily),
    bid_in_micro_currency:    toMicros(Math.max(daily / 20, 0.25)),
    budget_type:              'DAILY',
    start_time:               toEpochSeconds(startD),
    ...(endD ? { end_time: toEpochSeconds(endD) } : {}),
    targeting_spec:           { GEO: ['US'] },
  }]
  const agResp  = await pinRequest(`/ad_accounts/${adAccountId}/ad_groups`, 'POST', accessToken, undefined, adGroupBody)
  const agItems = (agResp.items ?? []) as Record<string, unknown>[]
  const agFirst = (agItems[0]?.data ?? {}) as Record<string, unknown>
  const agExc   = agItems[0]?.exceptions as Record<string, unknown>[] | undefined
  if (agExc && agExc.length > 0) throw new Error(`Pinterest ad group exception: ${JSON.stringify(agExc[0])}`)
  const adGroupId = String(agFirst.id ?? '')

  return { campaignId, adGroupId }
}

// ─── REPORTING / INSIGHTS ─────────────────────────────────────────────────────

export interface PinterestInsightDay {
  date:        string
  impressions: number
  clicks:      number
  spend:       number
  conversions: number
}

export async function getInsights(
  adAccountId: string,
  accessToken: string,
  days = 30
): Promise<PinterestInsightDay[]> {
  const end   = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60_000)
  const fmt   = (d: Date) => d.toISOString().slice(0, 10)

  const data = await pinRequest(`/ad_accounts/${adAccountId}/analytics`, 'GET', accessToken, {
    start_date:  fmt(start),
    end_date:    fmt(end),
    granularity: 'DAY',
    columns:     ['IMPRESSION_1', 'CLICKTHROUGH_1', 'SPEND_IN_DOLLAR', 'TOTAL_CONVERSIONS'].join(','),
  })

  // Response shape: either `{ daily_metrics: [...] }` or a top-level array per
  // ad-account. Handle both defensively.
  const rows = ((data.daily_metrics ?? data.data ?? data.metrics ?? []) as Record<string, unknown>[])
  return rows.map(r => ({
    date:        String(r.DATE ?? r.date ?? '').slice(0, 10),
    impressions: Number(r.IMPRESSION_1       ?? 0),
    clicks:      Number(r.CLICKTHROUGH_1     ?? 0),
    spend:       parseFloat(String(r.SPEND_IN_DOLLAR ?? 0)) || 0,
    conversions: Number(r.TOTAL_CONVERSIONS  ?? 0),
  }))
}
