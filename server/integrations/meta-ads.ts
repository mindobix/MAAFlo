const VERSIONS = ['v22.0', 'v21.0', 'v20.0', 'v19.0', 'v18.0']
let _version: string | null = null

async function detectVersion(): Promise<string> {
  if (_version) return _version
  for (const v of VERSIONS) {
    const res = await fetch(`https://graph.facebook.com/${v}/me?access_token=test`)
    // any response other than a network error means this version exists
    if (res.status !== 0) {
      const text = await res.text()
      // version exists if we get JSON (even an error JSON)
      try { JSON.parse(text); _version = v; return v } catch { /* try next */ }
    }
  }
  _version = 'v21.0'
  return _version
}

async function metaRequest(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  params?: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const version = await detectVersion()
  const url     = new URL(`https://graph.facebook.com/${version}${path}`)

  let body: URLSearchParams | undefined

  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  }

  if (method === 'POST') {
    body = new URLSearchParams()
    body.set('access_token', accessToken)
    if (params) Object.entries(params).forEach(([k, v]) => body!.set(k, String(v)))
  } else {
    url.searchParams.set('access_token', accessToken)
  }

  console.log(`[Meta Ads] ${method} ${url.pathname}`)

  const res = await fetch(url.toString(), {
    method,
    body,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
  })

  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Meta API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }

  if (data.error) {
    const e = data.error as Record<string, unknown>
    console.error(`[Meta Ads] Error:`, JSON.stringify(data.error))
    throw new Error(String(e.message ?? JSON.stringify(e)))
  }

  console.log(`[Meta Ads] → ${res.status} OK`)
  return data
}

// exchange short-lived code for long-lived token (valid 60 days)
export async function exchangeToken(code: string, redirectUri: string, appId: string, appSecret: string): Promise<string> {
  const version = await detectVersion()
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  url.searchParams.set('client_id',     appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('redirect_uri',  redirectUri)
  url.searchParams.set('code',          code)

  const res  = await fetch(url.toString())
  const data = await res.json() as Record<string, unknown>
  if (data.error) throw new Error(String((data.error as Record<string, unknown>).message))

  const shortToken = data.access_token as string

  // exchange for long-lived token
  const longUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  longUrl.searchParams.set('grant_type',    'fb_exchange_token')
  longUrl.searchParams.set('client_id',     appId)
  longUrl.searchParams.set('client_secret', appSecret)
  longUrl.searchParams.set('fb_exchange_token', shortToken)

  const longRes  = await fetch(longUrl.toString())
  const longData = await longRes.json() as Record<string, unknown>
  if (longData.error) throw new Error(String((longData.error as Record<string, unknown>).message))

  return longData.access_token as string
}

export interface MetaAdAccount {
  id:       string   // includes "act_" prefix
  name:     string
  currency: string
  status:   number
}

export async function listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  // verify token is valid first
  const me = await metaRequest('/me', 'GET', accessToken, { fields: 'id,name' }).catch(() => null)
  if (!me) throw new Error('Invalid token — could not verify identity with Meta')

  const fields = 'id,name,currency,account_status'

  // try personal ad accounts
  const direct = await metaRequest('/me/adaccounts', 'GET', accessToken, { fields, limit: 50 })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Unsupported') || msg.includes('#100')) {
        throw new Error('Token is missing ads_read permission. In Graph API Explorer, enable ads_read + ads_management before generating the token.')
      }
      throw err
    })

  const accounts = (direct.data ?? []) as MetaAdAccount[]
  if (accounts.length > 0) return accounts

  // fallback: fetch via Business Manager
  console.log('[Meta Ads] No personal ad accounts — trying business accounts')
  const bizData = await metaRequest('/me/businesses', 'GET', accessToken, { fields: 'id,name', limit: 10 }).catch(() => ({ data: [] }))
  const businesses = (bizData.data ?? []) as { id: string; name: string }[]

  const bizAccounts: MetaAdAccount[] = []
  for (const biz of businesses) {
    const r = await metaRequest(`/${biz.id}/owned_ad_accounts`, 'GET', accessToken, { fields, limit: 50 }).catch(() => ({ data: [] }))
    bizAccounts.push(...((r.data ?? []) as MetaAdAccount[]))
    // also check client ad accounts
    const r2 = await metaRequest(`/${biz.id}/client_ad_accounts`, 'GET', accessToken, { fields, limit: 50 }).catch(() => ({ data: [] }))
    bizAccounts.push(...((r2.data ?? []) as MetaAdAccount[]))
  }

  // deduplicate by id
  const seen = new Set<string>()
  return bizAccounts.filter(a => seen.has(a.id) ? false : (seen.add(a.id), true))
}

const OBJECTIVE_MAP: Record<string, string> = {
  awareness:   'OUTCOME_AWARENESS',
  traffic:     'OUTCOME_TRAFFIC',
  leads:       'OUTCOME_LEADS',
  conversions: 'OUTCOME_SALES',
  sales:       'OUTCOME_SALES',
}

const OPT_GOAL_MAP: Record<string, string> = {
  awareness:   'REACH',
  traffic:     'LINK_CLICKS',
  leads:       'LEAD_GENERATION',
  conversions: 'OFFSITE_CONVERSIONS',
  sales:       'OFFSITE_CONVERSIONS',
}

export interface MetaCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
  headline?:    string
  description?: string
  target_url?:  string
  cta?:         string
}

export async function createMetaCampaign(
  adAccountId: string,   // with or without "act_" prefix
  accessToken: string,
  input: MetaCampaignInput
): Promise<{ campaignId: string; adSetId: string }> {
  const actId    = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const objective = OBJECTIVE_MAP[input.goal] ?? 'OUTCOME_TRAFFIC'
  const optGoal   = OPT_GOAL_MAP[input.goal]  ?? 'LINK_CLICKS'

  // 1 — campaign
  // special_ad_categories must be sent as a JSON array string via URLSearchParams
  const version = await detectVersion()
  const campUrl = `https://graph.facebook.com/${version}/${actId}/campaigns`
  const campBody = new URLSearchParams({
    access_token:                    accessToken,
    name:                            input.name,
    objective,
    status:                          'PAUSED',
    special_ad_categories:           '[]',
    is_adset_budget_sharing_enabled: 'false',
  })
  console.log(`[Meta Ads] POST /${version}/${actId}/campaigns`)
  const campRes  = await fetch(campUrl, { method: 'POST', body: campBody, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  const campJson = await campRes.json() as Record<string, unknown>
  if (campJson.error) {
    const e = campJson.error as Record<string, unknown>
    console.error(`[Meta Ads] Campaign create error:`, JSON.stringify(campJson.error))
    throw new Error(String(e.message ?? JSON.stringify(e)))
  }
  const campData = campJson
  const campaignId = campData.id as string

  // 2 — ad set (budget in cents)
  const dailyCents = Math.round((input.budget_daily || 10) * 100)
  const startTime  = input.start_date
    ? new Date(input.start_date).toISOString()
    : new Date().toISOString()

  const adSetData = await metaRequest(`/${actId}/adsets`, 'POST', accessToken, {
    name:              `${input.name} — Ad Set`,
    campaign_id:       campaignId,
    daily_budget:      dailyCents,
    billing_event:     'IMPRESSIONS',
    optimization_goal: optGoal,
    bid_strategy:      'LOWEST_COST_WITHOUT_CAP',
    status:            'PAUSED',
    start_time:        startTime,
    targeting:         JSON.stringify({ geo_locations: { countries: ['US'] } }),
  })
  const adSetId = adSetData.id as string

  return { campaignId, adSetId }
}

export interface MetaInsightDay {
  date_start:  string
  impressions: string
  clicks:      string
  spend:       string
  reach:       string
  actions?:    { action_type: string; value: string }[]
}

export async function getInsights(
  adAccountId: string,
  accessToken: string,
  days = 30
): Promise<MetaInsightDay[]> {
  const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const data  = await metaRequest(`/${actId}/insights`, 'GET', accessToken, {
    fields:         'impressions,clicks,spend,reach,actions,date_start',
    date_preset:    days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : days <= 30 ? 'last_30d' : 'last_90d',
    time_increment: '1',
    level:          'account',
  })
  return (data.data ?? []) as MetaInsightDay[]
}
