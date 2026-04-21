// Amazon Advertising API integration
// Docs: https://advertising.amazon.com/API/docs
// Auth: Login with Amazon (LWA) — https://developer.amazon.com/docs/login-with-amazon/

const REGION_BASES: Record<string, string> = {
  NA: 'https://advertising-api.amazon.com',
  EU: 'https://advertising-api-eu.amazon.com',
  FE: 'https://advertising-api-fe.amazon.com',
}
const LWA_AUTH  = 'https://www.amazon.com/ap/oa'
const LWA_TOKEN = 'https://api.amazon.com/auth/o2/token'

function adsBase(region = 'NA'): string {
  return REGION_BASES[region] ?? REGION_BASES.NA
}

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(LWA_AUTH)
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('scope',         'advertising::campaign_management')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri',  redirectUri)
  url.searchParams.set('state',         state)
  return url.toString()
}

export interface AmazonTokenResponse {
  access_token:   string
  refresh_token?: string
  expires_in:     number
  token_type?:    string
}

export async function exchangeAuthCode(
  code:         string,
  redirectUri:  string,
  clientId:     string,
  clientSecret: string
): Promise<AmazonTokenResponse> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res  = await fetch(LWA_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`Amazon token exchange non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || data.error) {
    throw new Error(String(data.error_description ?? data.error ?? text.slice(0, 200)))
  }
  return {
    access_token:  String(data.access_token ?? ''),
    refresh_token: data.refresh_token ? String(data.refresh_token) : undefined,
    expires_in:    Number(data.expires_in ?? 0),
    token_type:    data.token_type ? String(data.token_type) : undefined,
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId:     string,
  clientSecret: string
): Promise<AmazonTokenResponse> {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(LWA_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  const data = JSON.parse(text) as Record<string, unknown>
  if (!res.ok || data.error) {
    throw new Error(String(data.error_description ?? data.error ?? text.slice(0, 200)))
  }
  return {
    access_token:  String(data.access_token ?? ''),
    refresh_token: data.refresh_token ? String(data.refresh_token) : refreshToken,
    expires_in:    Number(data.expires_in ?? 0),
  }
}

// ─── HTTP WRAPPER ─────────────────────────────────────────────────────────────

async function amazonRequest(
  path:        string,
  method:      'GET' | 'POST',
  accessToken: string,
  clientId:    string,
  profileId:   string | null,
  region:      string,
  params?:     Record<string, unknown>,
  body?:       unknown
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const url = new URL(`${adsBase(region)}${path}`)
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  const headers: Record<string, string> = {
    'Authorization':                   `Bearer ${accessToken}`,
    'Amazon-Advertising-API-ClientId': clientId,
    'Content-Type':                    'application/json',
  }
  if (profileId) headers['Amazon-Advertising-API-Scope'] = profileId

  console.log(`[Amazon Ads] ${method} ${url.pathname}`)

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`[Amazon Ads] HTTP ${res.status}: ${text.slice(0, 300)}`)
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(text) as Record<string, unknown> } catch { /* ignore */ }
    const msg = data?.details ?? data?.message ?? data?.error ?? text.slice(0, 200)
    throw new Error(`Amazon API error (HTTP ${res.status}): ${msg}`)
  }

  if (!text) return {}
  try { return JSON.parse(text) as Record<string, unknown> | Record<string, unknown>[] }
  catch { return {} }
}

// ─── PROFILES ─────────────────────────────────────────────────────────────────

export interface AmazonProfile {
  profileId:       string
  countryCode:     string
  currencyCode:    string
  accountType?:    string   // seller | vendor | agency
  accountName?:    string
  accountId?:      string
  marketplaceId?:  string
}

export async function listProfiles(accessToken: string, clientId: string, region = 'NA'): Promise<AmazonProfile[]> {
  const data = await amazonRequest('/v2/profiles', 'GET', accessToken, clientId, null, region)
  const list = Array.isArray(data) ? data : []
  return list.map(p => {
    const acc = (p.accountInfo ?? {}) as Record<string, unknown>
    return {
      profileId:     String(p.profileId ?? ''),
      countryCode:   String(p.countryCode ?? ''),
      currencyCode:  String(p.currencyCode ?? ''),
      accountType:   acc.type   ? String(acc.type)   : undefined,
      accountName:   acc.name   ? String(acc.name)   : undefined,
      accountId:     acc.id     ? String(acc.id)     : undefined,
      marketplaceId: acc.marketplaceStringId ? String(acc.marketplaceStringId) : undefined,
    }
  })
}

// ─── CAMPAIGN CREATION (Sponsored Products v2) ────────────────────────────────

export interface AmazonCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  start_date:   string | null
  end_date?:    string | null
}

function toAmazonDate(d: Date): string {
  // Amazon SP v2 expects YYYYMMDD
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function createAmazonCampaign(
  accessToken: string,
  clientId:    string,
  profileId:   string,
  region:      string,
  input:       AmazonCampaignInput
): Promise<{ campaignId: string; adGroupId: string }> {
  const startD     = input.start_date ? new Date(input.start_date) : new Date()
  const dailyBudget = Math.max(input.budget_daily || 5, 1)

  // 1 — Campaign (Sponsored Products, Manual targeting)
  const campBody = [{
    name:              input.name,
    campaignType:      'sponsoredProducts',
    targetingType:     'manual',
    state:             'paused',
    dailyBudget,
    startDate:         toAmazonDate(startD),
    ...(input.end_date ? { endDate: toAmazonDate(new Date(input.end_date)) } : {}),
    bidding: {
      strategy: 'legacyForSales',
    },
  }]
  const campResp = await amazonRequest('/v2/sp/campaigns', 'POST', accessToken, clientId, profileId, region, undefined, campBody)
  const campArr  = Array.isArray(campResp) ? campResp : []
  const first    = campArr[0] ?? {}
  if (first.code && first.code !== 'SUCCESS') {
    throw new Error(`Amazon campaign creation failed: ${first.description ?? first.code}`)
  }
  const campaignId = String(first.campaignId ?? '')
  if (!campaignId) throw new Error('Amazon did not return a campaignId')

  // 2 — Ad Group
  const agBody = [{
    name:       `${input.name} — Ad Group`,
    campaignId: Number(campaignId),
    state:      'paused',
    defaultBid: Math.max(Math.min(dailyBudget / 10, 5), 0.02),  // rough starting bid
  }]
  const agResp = await amazonRequest('/v2/sp/adGroups', 'POST', accessToken, clientId, profileId, region, undefined, agBody)
  const agArr  = Array.isArray(agResp) ? agResp : []
  const agFirst = agArr[0] ?? {}
  const adGroupId = String(agFirst.adGroupId ?? '')

  return { campaignId, adGroupId }
}

// ─── REPORTING (v3, async) ────────────────────────────────────────────────────

// Amazon reports v3 is async — you POST a report request, poll status, then
// download the CSV. For a synchronous sync endpoint we kick off a report and
// return pending=true. A background worker (not yet built) would finalize it.
export async function requestSpReport(
  accessToken: string,
  clientId:    string,
  profileId:   string,
  region:      string,
  days = 30
): Promise<{ reportId: string }> {
  const end   = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60_000)
  const fmt   = (d: Date) => d.toISOString().slice(0, 10)

  const body = {
    name:          `MAAFlo SP daily ${fmt(start)} to ${fmt(end)}`,
    startDate:     fmt(start),
    endDate:       fmt(end),
    configuration: {
      adProduct:    'SPONSORED_PRODUCTS',
      columns:      ['date', 'impressions', 'clicks', 'cost', 'purchases7d'],
      groupBy:      ['campaign'],
      reportTypeId: 'spCampaigns',
      timeUnit:     'DAILY',
      format:       'GZIP_JSON',
    },
  }
  const resp = await amazonRequest('/reporting/reports', 'POST', accessToken, clientId, profileId, region, undefined, body) as Record<string, unknown>
  return { reportId: String(resp.reportId ?? '') }
}
