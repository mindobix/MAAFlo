// LinkedIn Marketing API integration
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/

const REST_BASE  = 'https://api.linkedin.com/rest'
const OAUTH_BASE = 'https://www.linkedin.com/oauth/v2'
const LI_VERSION = '202501'   // LinkedIn-Version header (YYYYMM)

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(`${OAUTH_BASE}/authorization`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('redirect_uri',  redirectUri)
  url.searchParams.set('state',         state)
  // r_ads_reporting: read reporting
  // r_ads: read campaign data
  // rw_ads: manage campaigns / ad accounts
  url.searchParams.set('scope', 'r_ads r_ads_reporting rw_ads')
  return url.toString()
}

export interface LinkedInTokenResponse {
  access_token:  string
  expires_in:    number
  scope?:        string
}

export async function exchangeAuthCode(
  code:         string,
  redirectUri:  string,
  clientId:     string,
  clientSecret: string
): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res  = await fetch(`${OAUTH_BASE}/accessToken`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`LinkedIn token exchange non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || data.error) {
    const msg = (data.error_description ?? data.error ?? text.slice(0, 200)) as string
    throw new Error(String(msg))
  }
  return {
    access_token: String(data.access_token ?? ''),
    expires_in:   Number(data.expires_in ?? 0),
    scope:        data.scope ? String(data.scope) : undefined,
  }
}

// ─── HTTP WRAPPER ─────────────────────────────────────────────────────────────

async function linkedinRequest(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  params?: Record<string, unknown>,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(`${REST_BASE}${path}`)
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  console.log(`[LinkedIn Ads] ${method} ${url.pathname}`)

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization':            `Bearer ${accessToken}`,
      'LinkedIn-Version':         LI_VERSION,
      'X-Restli-Protocol-Version':'2.0.0',
      'Content-Type':             'application/json',
    },
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`[LinkedIn Ads] HTTP ${res.status}: ${text.slice(0, 300)}`)
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(text) as Record<string, unknown> } catch { /* ignore */ }
    const msg = data?.message ?? text.slice(0, 200)
    throw new Error(`LinkedIn API error (HTTP ${res.status}): ${msg}`)
  }

  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ─── AD ACCOUNTS ──────────────────────────────────────────────────────────────

export interface LinkedInAdAccount {
  id:       string   // numeric id (urn: urn:li:sponsoredAccount:<id>)
  name:     string
  currency: string
  status?:  string
}

export async function listAdAccounts(accessToken: string): Promise<LinkedInAdAccount[]> {
  // Find ad accounts the current member has access to via role-based ACL.
  const data = await linkedinRequest('/adAccountUsers', 'GET', accessToken, {
    q:    'authenticatedUser',
  })
  const elements = (data.elements ?? []) as Record<string, unknown>[]
  if (elements.length === 0) return []

  const accountIds = elements.map(el => {
    const accountUrn = String(el.account ?? '')
    // "urn:li:sponsoredAccount:1234567" → "1234567"
    return accountUrn.split(':').pop() ?? ''
  }).filter(Boolean)

  if (accountIds.length === 0) return []

  // Batch fetch account details
  const ids = accountIds.map(id => `(id:${id})`).join(',')
  const accountsData = await linkedinRequest(
    `/adAccounts?ids=List(${encodeURIComponent(ids)})`,
    'GET',
    accessToken
  ).catch(async () => {
    // Fallback: fetch one-by-one if batch fails
    const results: Record<string, unknown> = { results: {} }
    for (const id of accountIds) {
      try {
        const one = await linkedinRequest(`/adAccounts/${id}`, 'GET', accessToken)
        ;(results.results as Record<string, unknown>)[id] = one
      } catch { /* skip */ }
    }
    return results
  })

  const results = (accountsData.results ?? {}) as Record<string, Record<string, unknown>>
  return Object.entries(results).map(([id, acc]) => ({
    id,
    name:     String(acc.name ?? `Account ${id}`),
    currency: String(acc.currency ?? ''),
    status:   acc.status ? String(acc.status) : undefined,
  }))
}

// ─── CAMPAIGN CREATION ────────────────────────────────────────────────────────

// LinkedIn objectiveType values
const OBJECTIVE_MAP: Record<string, string> = {
  awareness:   'BRAND_AWARENESS',
  traffic:     'WEBSITE_VISIT',
  leads:       'LEAD_GENERATION',
  conversions: 'WEBSITE_CONVERSION',
  sales:       'WEBSITE_CONVERSION',
}

export interface LinkedInCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
  end_date?:    string | null
}

export async function createLinkedInCampaign(
  adAccountId:  string,
  accessToken:  string,
  input:        LinkedInCampaignInput
): Promise<{ campaignGroupId: string; campaignId: string }> {
  const objective   = OBJECTIVE_MAP[input.goal] ?? 'WEBSITE_VISIT'
  const dailyBudget = Math.max(input.budget_daily || 10, 10)
  const startMs     = input.start_date ? new Date(input.start_date).getTime() : Date.now()
  const endMs       = input.end_date   ? new Date(input.end_date).getTime()   : undefined

  // 1 — Campaign Group (container)
  const groupData = await linkedinRequest(
    `/adAccounts/${adAccountId}/adCampaignGroups`,
    'POST',
    accessToken,
    undefined,
    {
      name:         input.name,
      status:       'DRAFT',
      totalBudget:  { amount: String(dailyBudget * 30), currencyCode: 'USD' },
      runSchedule:  endMs ? { start: startMs, end: endMs } : { start: startMs },
    }
  )
  // LinkedIn returns the created entity id in the x-linkedin-id response header normally;
  // the REST rewrite also puts it in the body `id` field.
  const campaignGroupId = String(groupData.id ?? '')
  if (!campaignGroupId) throw new Error('LinkedIn did not return a campaign group id')

  // 2 — Campaign (actual ad group in LinkedIn terminology)
  const campaignData = await linkedinRequest(
    `/adAccounts/${adAccountId}/adCampaigns`,
    'POST',
    accessToken,
    undefined,
    {
      name:             input.name,
      campaignGroup:    `urn:li:sponsoredCampaignGroup:${campaignGroupId}`,
      type:             'SPONSORED_UPDATES',
      costType:         'CPC',
      dailyBudget:      { amount: String(dailyBudget), currencyCode: 'USD' },
      objectiveType:    objective,
      status:           'DRAFT',
      runSchedule:      endMs ? { start: startMs, end: endMs } : { start: startMs },
      locale:           { country: 'US', language: 'en' },
      targetingCriteria:{
        include: {
          and: [
            { or: { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:103644278'] } },  // United States
          ],
        },
      },
    }
  )
  const campaignId = String(campaignData.id ?? '')

  return { campaignGroupId, campaignId }
}

// ─── REPORTING / INSIGHTS ─────────────────────────────────────────────────────

export interface LinkedInInsightDay {
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
): Promise<LinkedInInsightDay[]> {
  const end   = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60_000)

  const dateRange = {
    start: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, day: start.getUTCDate() },
    end:   { year: end.getUTCFullYear(),   month: end.getUTCMonth() + 1,   day: end.getUTCDate()   },
  }

  const data = await linkedinRequest('/adAnalytics', 'GET', accessToken, {
    q:             'analytics',
    pivot:         'ACCOUNT',
    timeGranularity:'DAILY',
    dateRange,
    accounts:      `List(urn:li:sponsoredAccount:${adAccountId})`,
    fields:        'impressions,clicks,costInUsd,externalWebsiteConversions,dateRange',
  })

  const elements = (data.elements ?? []) as Record<string, unknown>[]
  return elements.map(el => {
    const dr    = (el.dateRange as Record<string, unknown>) ?? {}
    const startD = (dr.start as Record<string, number>) ?? { year: 1970, month: 1, day: 1 }
    const date  = `${startD.year}-${String(startD.month).padStart(2, '0')}-${String(startD.day).padStart(2, '0')}`
    return {
      date,
      impressions: Number(el.impressions ?? 0),
      clicks:      Number(el.clicks      ?? 0),
      spend:       parseFloat(String(el.costInUsd ?? '0')) || 0,
      conversions: Number(el.externalWebsiteConversions ?? 0),
    }
  })
}
