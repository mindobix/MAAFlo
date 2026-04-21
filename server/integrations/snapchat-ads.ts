// Snapchat Marketing API integration
// Docs: https://marketingapi.snapchat.com/docs/
// Auth: https://accounts.snapchat.com/login/oauth2 (authorization_code flow)

const ADS_BASE    = 'https://adsapi.snapchat.com/v1'
const OAUTH_AUTH  = 'https://accounts.snapchat.com/login/oauth2/authorize'
const OAUTH_TOKEN = 'https://accounts.snapchat.com/login/oauth2/access_token'

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(OAUTH_AUTH)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('redirect_uri',  redirectUri)
  url.searchParams.set('state',         state)
  url.searchParams.set('scope',         'snapchat-marketing-api')
  return url.toString()
}

export interface SnapTokenResponse {
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
): Promise<SnapTokenResponse> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res  = await fetch(OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`Snapchat token exchange non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
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

// ─── HTTP WRAPPER ─────────────────────────────────────────────────────────────

async function snapRequest(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  params?: Record<string, unknown>,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(`${ADS_BASE}${path}`)
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  console.log(`[Snapchat Ads] ${method} ${url.pathname}`)

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
    console.error(`[Snapchat Ads] HTTP ${res.status}: ${text.slice(0, 300)}`)
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(text) as Record<string, unknown> } catch { /* ignore */ }
    const msg = data?.debug_message ?? data?.error_description ?? data?.message ?? text.slice(0, 200)
    throw new Error(`Snapchat API error (HTTP ${res.status}): ${msg}`)
  }

  if (!text) return {}
  try { return JSON.parse(text) as Record<string, unknown> }
  catch { return {} }
}

// ─── AD ACCOUNTS ──────────────────────────────────────────────────────────────

export interface SnapAdAccount {
  id:       string
  name:     string
  currency?: string
  timezone?: string
  status?:   string
}

export async function listAdAccounts(accessToken: string): Promise<SnapAdAccount[]> {
  // 1 — me → organization ids
  const meData = await snapRequest('/me', 'GET', accessToken)
  const meInner = (meData.me ?? {}) as Record<string, unknown>
  const userId  = String(meInner.id ?? '')

  // 2 — organizations for this user
  const orgData = await snapRequest(`/users/${userId}/organizations`, 'GET', accessToken)
  const orgs    = ((orgData.organizations ?? []) as Record<string, unknown>[])
    .map(o => (o.organization ?? {}) as Record<string, unknown>)

  if (orgs.length === 0) return []

  // 3 — ad accounts per org
  const accounts: SnapAdAccount[] = []
  for (const org of orgs) {
    const orgId = String(org.id ?? '')
    if (!orgId) continue
    const accData = await snapRequest(`/organizations/${orgId}/adaccounts`, 'GET', accessToken).catch(() => ({ adaccounts: [] }))
    const list    = ((accData.adaccounts ?? []) as Record<string, unknown>[])
      .map(a => (a.adaccount ?? {}) as Record<string, unknown>)

    for (const a of list) {
      accounts.push({
        id:       String(a.id ?? ''),
        name:     String(a.name ?? ''),
        currency: a.currency ? String(a.currency) : undefined,
        timezone: a.timezone ? String(a.timezone) : undefined,
        status:   a.status   ? String(a.status)   : undefined,
      })
    }
  }
  return accounts
}

// ─── CAMPAIGN CREATION ────────────────────────────────────────────────────────

// Snapchat ad squad optimization goal
const OPT_GOAL_MAP: Record<string, string> = {
  awareness:   'IMPRESSIONS',
  traffic:     'SWIPES',
  leads:       'PIXEL_SIGNUP',
  conversions: 'PIXEL_PURCHASE',
  sales:       'PIXEL_PURCHASE',
}

export interface SnapCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
  end_date?:    string | null
}

// Snapchat wants micro-currency for budgets
function toMicros(amount: number): string {
  return String(Math.round(amount * 1_000_000))
}

export async function createSnapCampaign(
  adAccountId: string,
  accessToken: string,
  input:       SnapCampaignInput
): Promise<{ campaignId: string; adSquadId: string }> {
  const optGoal = OPT_GOAL_MAP[input.goal] ?? 'SWIPES'
  const daily   = Math.max(input.budget_daily || 20, 20)
  const startT  = input.start_date ? new Date(input.start_date).toISOString() : new Date(Date.now() + 10 * 60_000).toISOString()
  const endT    = input.end_date   ? new Date(input.end_date).toISOString()   : undefined

  // 1 — Campaign
  const campBody = {
    campaigns: [{
      name:        input.name,
      ad_account_id: adAccountId,
      status:      'PAUSED',
      objective:   'WEBSITE_VISITS',
      start_time:  startT,
      ...(endT ? { end_time: endT } : {}),
    }],
  }
  const campData = await snapRequest(`/adaccounts/${adAccountId}/campaigns`, 'POST', accessToken, undefined, campBody)
  const campList = (campData.campaigns ?? []) as Record<string, unknown>[]
  const first    = (campList[0]?.campaign ?? {}) as Record<string, unknown>
  const campaignId = String(first.id ?? '')
  if (!campaignId) throw new Error('Snapchat did not return a campaign id')

  // 2 — Ad Squad (Snapchat's ad-group concept)
  const adSquadBody = {
    adsquads: [{
      campaign_id:        campaignId,
      name:               `${input.name} — Ad Squad`,
      type:               'SNAP_ADS',
      status:             'PAUSED',
      billing_event:      'IMPRESSION',
      optimization_goal:  optGoal,
      bid_strategy:       'AUTO_BID',
      daily_budget_micro: toMicros(daily),
      start_time:         startT,
      ...(endT ? { end_time: endT } : {}),
      targeting:          { geos: [{ country_code: 'us' }] },
      placement_v2:       { config: 'AUTOMATIC' },
    }],
  }
  const squadData = await snapRequest(`/campaigns/${campaignId}/adsquads`, 'POST', accessToken, undefined, adSquadBody)
  const squadList = (squadData.adsquads ?? []) as Record<string, unknown>[]
  const sq        = (squadList[0]?.adsquad ?? {}) as Record<string, unknown>
  const adSquadId = String(sq.id ?? '')

  return { campaignId, adSquadId }
}

// ─── REPORTING / INSIGHTS ─────────────────────────────────────────────────────

export interface SnapInsightDay {
  date:        string
  impressions: number
  swipes:      number
  spend:       number
  conversions: number
}

export async function getInsights(
  adAccountId: string,
  accessToken: string,
  days = 30
): Promise<SnapInsightDay[]> {
  const end   = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60_000)

  const data = await snapRequest(`/adaccounts/${adAccountId}/stats`, 'GET', accessToken, {
    granularity: 'DAY',
    start_time:  start.toISOString(),
    end_time:    end.toISOString(),
    fields:      'impressions,swipes,spend,conversion_purchases',
  })

  // Response shape: { total_stats: [{ total_stat: { timeseries_stats: [ ... ] } }] }
  const totals      = (data.total_stats ?? []) as Record<string, unknown>[]
  const totalInner  = (totals[0]?.total_stat ?? {}) as Record<string, unknown>
  const series      = (totalInner.timeseries_stats ?? []) as Record<string, unknown>[]
  const flat        = series.map(s => (s.timeseries_stat ?? {}) as Record<string, unknown>)

  if (flat.length === 0) return []

  const points = (flat[0]?.timeseries ?? []) as Record<string, unknown>[]
  return points.map(p => {
    const stats = (p.stats ?? {}) as Record<string, unknown>
    const spendMicro = Number(stats.spend ?? 0)
    return {
      date:        String(p.start_time ?? '').slice(0, 10),
      impressions: Number(stats.impressions ?? 0),
      swipes:      Number(stats.swipes      ?? 0),
      spend:       spendMicro / 1_000_000,
      conversions: Number(stats.conversion_purchases ?? 0),
    }
  })
}
