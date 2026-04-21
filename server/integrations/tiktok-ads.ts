// TikTok Marketing API integration
// Docs: https://business-api.tiktok.com/portal/docs

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3'

async function tiktokRequest(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE_URL}${path}`)
  let body: string | undefined

  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  if (method === 'POST' && params) {
    body = JSON.stringify(params)
  }

  console.log(`[TikTok Ads] ${method} ${url.pathname}`)

  const res = await fetch(url.toString(), {
    method,
    body,
    headers: {
      'Access-Token':  accessToken,
      'Content-Type':  'application/json',
    },
  })

  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`TikTok API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }

  // TikTok wraps responses in { code, message, data, request_id }. code === 0 means success.
  if (typeof data.code === 'number' && data.code !== 0) {
    console.error(`[TikTok Ads] Error:`, JSON.stringify({ code: data.code, message: data.message }))
    throw new Error(String(data.message ?? `TikTok error code ${data.code}`))
  }

  console.log(`[TikTok Ads] → ${res.status} OK`)
  return data
}

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(appId: string, redirectUri: string, state: string): string {
  const url = new URL('https://business-api.tiktok.com/portal/auth')
  url.searchParams.set('app_id',       appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state',        state)
  return url.toString()
}

export interface TiktokTokenResponse {
  access_token:   string
  advertiser_ids: string[]
  scope?:         number[]
}

// Exchange auth_code for a long-lived access token.
// POST /oauth2/access_token/  — returns { access_token, advertiser_ids, scope }
export async function exchangeAuthCode(authCode: string, appId: string, appSecret: string): Promise<TiktokTokenResponse> {
  const res = await fetch(`${BASE_URL}/oauth2/access_token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ app_id: appId, secret: appSecret, auth_code: authCode }),
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`TikTok token exchange returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (typeof data.code === 'number' && data.code !== 0) {
    throw new Error(String(data.message ?? `TikTok error code ${data.code}`))
  }
  const inner = (data.data ?? {}) as Record<string, unknown>
  return {
    access_token:   String(inner.access_token ?? ''),
    advertiser_ids: (inner.advertiser_ids ?? []) as string[],
    scope:          (inner.scope ?? []) as number[],
  }
}

// ─── ADVERTISERS ──────────────────────────────────────────────────────────────

export interface TiktokAdvertiser {
  advertiser_id:   string
  advertiser_name: string
  currency?:       string
  status?:         string
}

// GET /oauth2/advertiser/get/  — returns advertisers authorized for this token
export async function listAdvertisers(accessToken: string, appId: string, appSecret: string): Promise<TiktokAdvertiser[]> {
  const data = await tiktokRequest('/oauth2/advertiser/get/', 'GET', accessToken, {
    app_id: appId,
    secret: appSecret,
  })
  const inner = (data.data ?? {}) as Record<string, unknown>
  const list  = (inner.list ?? []) as Record<string, unknown>[]
  return list.map(a => ({
    advertiser_id:   String(a.advertiser_id ?? ''),
    advertiser_name: String(a.advertiser_name ?? ''),
  }))
}

// Enrich a set of advertisers with currency/status info.
// GET /advertiser/info/  — fields: id, name, currency, status, ...
export async function getAdvertiserInfo(advertiserIds: string[], accessToken: string): Promise<TiktokAdvertiser[]> {
  if (advertiserIds.length === 0) return []
  const data = await tiktokRequest('/advertiser/info/', 'GET', accessToken, {
    advertiser_ids: advertiserIds,
    fields:         ['id', 'name', 'currency', 'status'],
  })
  const list = (data.data ?? []) as Record<string, unknown>[]
  return list.map(a => ({
    advertiser_id:   String(a.id ?? ''),
    advertiser_name: String(a.name ?? ''),
    currency:        a.currency ? String(a.currency) : undefined,
    status:          a.status   ? String(a.status)   : undefined,
  }))
}

// ─── CAMPAIGN CREATION ────────────────────────────────────────────────────────

// TikTok "objective_type" values
const OBJECTIVE_MAP: Record<string, string> = {
  awareness:   'REACH',
  traffic:     'TRAFFIC',
  leads:       'LEAD_GENERATION',
  conversions: 'CONVERSIONS',
  sales:       'PRODUCT_SALES',
}

// Ad group optimization goal (used for REACH/TRAFFIC objectives)
const OPT_GOAL_MAP: Record<string, string> = {
  awareness:   'REACH',
  traffic:     'CLICK',
  leads:       'LEAD_GENERATION',
  conversions: 'CONVERT',
  sales:       'CONVERT',
}

// Billing event per optimization goal
const BILLING_EVENT_MAP: Record<string, string> = {
  REACH:           'CPM',
  CLICK:           'CPC',
  LEAD_GENERATION: 'OCPM',
  CONVERT:         'OCPM',
}

export interface TiktokCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
}

function toTiktokDate(d: Date): string {
  // TikTok expects "YYYY-MM-DD HH:mm:ss"
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export async function createTiktokCampaign(
  advertiserId: string,
  accessToken:  string,
  input:        TiktokCampaignInput
): Promise<{ campaignId: string; adGroupId: string }> {
  const objective = OBJECTIVE_MAP[input.goal] ?? 'TRAFFIC'
  const optGoal   = OPT_GOAL_MAP[input.goal]  ?? 'CLICK'
  const billing   = BILLING_EVENT_MAP[optGoal] ?? 'CPC'

  // TikTok enforces a minimum daily budget per ad group (usually $20 USD).
  const dailyBudget = Math.max(input.budget_daily || 20, 20)

  // 1 — Campaign
  const campData = await tiktokRequest('/campaign/create/', 'POST', accessToken, {
    advertiser_id:   advertiserId,
    campaign_name:   input.name,
    objective_type:  objective,
    budget_mode:     'BUDGET_MODE_INFINITE',
    operation_status: 'DISABLE',   // created paused — matches Meta/Google behavior
  })
  const campInner  = (campData.data ?? {}) as Record<string, unknown>
  const campaignId = String(campInner.campaign_id ?? '')
  if (!campaignId) throw new Error('TikTok did not return a campaign_id')

  // 2 — Ad Group
  const startTime = input.start_date
    ? toTiktokDate(new Date(input.start_date))
    : toTiktokDate(new Date(Date.now() + 5 * 60_000))  // start in 5 min if no date

  const adGroupData = await tiktokRequest('/adgroup/create/', 'POST', accessToken, {
    advertiser_id:       advertiserId,
    campaign_id:         campaignId,
    adgroup_name:        `${input.name} — Ad Group`,
    placement_type:      'PLACEMENT_TYPE_AUTOMATIC',
    promotion_type:      'WEBSITE',
    budget_mode:         'BUDGET_MODE_DAY',
    budget:              dailyBudget,
    schedule_type:       'SCHEDULE_FROM_NOW',
    schedule_start_time: startTime,
    optimization_goal:   optGoal,
    billing_event:       billing,
    bid_type:            'BID_TYPE_NO_BID',
    pacing:              'PACING_MODE_SMOOTH',
    operation_status:    'DISABLE',
    location_ids:        ['6252001'],  // United States (geoname id)
  })
  const agInner   = (adGroupData.data ?? {}) as Record<string, unknown>
  const adGroupId = String(agInner.adgroup_id ?? '')

  return { campaignId, adGroupId }
}

// ─── REPORTING / INSIGHTS ─────────────────────────────────────────────────────

export interface TiktokInsightDay {
  stat_time_day: string
  impressions:   string
  clicks:        string
  spend:         string
  conversions?:  string
}

// GET /report/integrated/get/ — daily account-level metrics
export async function getInsights(
  advertiserId: string,
  accessToken:  string,
  days = 30
): Promise<TiktokInsightDay[]> {
  const end   = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60_000)
  const fmt   = (d: Date) => d.toISOString().slice(0, 10)

  const data = await tiktokRequest('/report/integrated/get/', 'GET', accessToken, {
    advertiser_id:    advertiserId,
    report_type:      'BASIC',
    data_level:       'AUCTION_ADVERTISER',
    dimensions:       ['stat_time_day'],
    metrics:          ['impressions', 'clicks', 'spend', 'conversion'],
    start_date:       fmt(start),
    end_date:         fmt(end),
    page:             1,
    page_size:        1000,
  })
  const inner = (data.data ?? {}) as Record<string, unknown>
  const list  = (inner.list ?? []) as Record<string, unknown>[]

  return list.map(row => {
    const dims    = (row.dimensions ?? {}) as Record<string, unknown>
    const metrics = (row.metrics    ?? {}) as Record<string, unknown>
    return {
      stat_time_day: String(dims.stat_time_day ?? '').slice(0, 10),
      impressions:   String(metrics.impressions ?? '0'),
      clicks:        String(metrics.clicks      ?? '0'),
      spend:         String(metrics.spend       ?? '0'),
      conversions:   String(metrics.conversion  ?? '0'),
    }
  })
}
