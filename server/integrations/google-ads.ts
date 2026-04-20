export interface GoogleCreds {
  clientId:     string
  clientSecret: string
  developerToken: string
}

const VERSIONS = ['v20', 'v19', 'v18', 'v17', 'v16']
let _detectedVersion: string | null = null

async function detectVersion(accessToken: string, devToken: string): Promise<string> {
  if (_detectedVersion) return _detectedVersion
  for (const v of VERSIONS) {
    const res = await fetch(`https://googleads.googleapis.com/${v}/customers:listAccessibleCustomers`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': devToken },
    })
    if (res.status !== 404) {
      console.log(`[Google Ads] Using API version ${v}`)
      _detectedVersion = v
      return v
    }
  }
  throw new Error('Could not find a supported Google Ads API version. Check developer-token is valid.')
}

function base(version: string) {
  return `https://googleads.googleapis.com/${version}`
}

async function getAccessToken(refreshToken: string, creds: GoogleCreds): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json() as Record<string, string>
  if (!data.access_token) throw new Error(data.error_description ?? 'Failed to refresh access token')
  return data.access_token
}

async function adsRequest(
  path: string,
  method: string,
  accessToken: string,
  devToken: string,
  body?: unknown,
  loginCustomerId?: string
): Promise<Record<string, unknown>> {
  const version = await detectVersion(accessToken, devToken)
  const headers: Record<string, string> = {
    'Authorization':   `Bearer ${accessToken}`,
    'developer-token': devToken,
    'Content-Type':    'application/json',
  }
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId

  const url = `${base(version)}${path}`
  console.log(`[Google Ads] ${method} ${url}`)

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  console.log(`[Google Ads] → ${res.status} ${res.statusText} | ${text.slice(0, 300)}`)
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Google Ads API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? JSON.stringify(data)
    throw new Error(msg)
  }
  return data
}

export async function listAccessibleCustomers(refreshToken: string, creds: GoogleCreds) {
  const accessToken = await getAccessToken(refreshToken, creds)
  const version = await detectVersion(accessToken, creds.developerToken)
  const data = await adsRequest('/customers:listAccessibleCustomers', 'GET', accessToken, creds.developerToken)
  const ids: string[] = ((data.resourceNames ?? []) as string[]).map(r => r.replace('customers/', ''))
  return { accessToken, version, customerIds: ids }
}

export async function getCustomerDetails(customerId: string, accessToken: string, devToken: string, loginCustomerId?: string) {
  try {
    const data = await adsRequest(`/customers/${customerId}`, 'GET', accessToken, devToken, undefined, loginCustomerId)
    return {
      id:       customerId,
      name:     (data.descriptiveName as string | undefined) ?? customerId,
      currency: (data.currencyCode as string | undefined) ?? 'USD',
      manager:  (data.manager as boolean | undefined) ?? false,
    }
  } catch {
    return { id: customerId, name: customerId, currency: 'USD', manager: false }
  }
}

export interface GAdsCampaignInput {
  name:         string
  goal:         string
  budget_daily: number
  status:       string
  headline?:    string
  description?: string
  target_url?:  string
}

export async function createCampaign(
  customerId: string,
  refreshToken: string,
  input: GAdsCampaignInput,
  creds: GoogleCreds,
  loginCustomerId?: string
) {
  const accessToken = await getAccessToken(refreshToken, creds)
  const budgetMicros = String(Math.round((input.budget_daily || 10) * 1_000_000))

  const budgetRes = await adsRequest(
    `/customers/${customerId}/campaignBudgets:mutate`, 'POST', accessToken, creds.developerToken,
    { operations: [{ create: { name: `Budget — ${input.name}`, amountMicros: budgetMicros, deliveryMethod: 'STANDARD', explicitlyShared: false } }] },
    loginCustomerId
  )
  const budgetName = ((budgetRes.results as { resourceName: string }[])[0]).resourceName

  const isDisplay = input.goal === 'awareness'
  const campaignPayload: Record<string, unknown> = {
    name: input.name, status: 'PAUSED',
    advertisingChannelType: isDisplay ? 'DISPLAY' : 'SEARCH',
    campaignBudget: budgetName,
  }
  if (isDisplay) {
    campaignPayload.manualCpm = {}
  } else {
    campaignPayload.manualCpc = { enhancedCpcEnabled: false }
    campaignPayload.networkSettings = { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false }
  }

  const campRes = await adsRequest(
    `/customers/${customerId}/campaigns:mutate`, 'POST', accessToken, creds.developerToken,
    { operations: [{ create: campaignPayload }] },
    loginCustomerId
  )

  const resourceName = ((campRes.results as { resourceName: string }[])[0]).resourceName
  const campaignId   = resourceName.split('/').pop()!
  return { resourceName, campaignId }
}
