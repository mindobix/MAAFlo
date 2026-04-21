// Mailchimp Marketing API integration
// Docs: https://mailchimp.com/developer/marketing/
// Auth: OAuth 2.0 — https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
//
// NOTE: Mailchimp is email, not paid media. We map its concepts onto the
// channel structure as follows:
//   - Ad account  → Mailchimp "audience" (list)
//   - Campaign    → email campaign (created as PAUSED "regular" draft)
//   - Analytics   → campaign report snapshots (emails_sent, opens, clicks)

const OAUTH_AUTH     = 'https://login.mailchimp.com/oauth2/authorize'
const OAUTH_TOKEN    = 'https://login.mailchimp.com/oauth2/token'
const OAUTH_METADATA = 'https://login.mailchimp.com/oauth2/metadata'

function apiBase(dc: string): string {
  return `https://${dc}.api.mailchimp.com/3.0`
}

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(OAUTH_AUTH)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id',     clientId)
  url.searchParams.set('redirect_uri',  redirectUri)
  url.searchParams.set('state',         state)
  return url.toString()
}

export interface MailchimpTokenResponse {
  access_token: string
  expires_in:   number
  scope?:       string
  token_type?:  string
}

export async function exchangeAuthCode(
  code:         string,
  redirectUri:  string,
  clientId:     string,
  clientSecret: string
): Promise<MailchimpTokenResponse> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
    code,
  })
  const res  = await fetch(OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) as Record<string, unknown> } catch {
    throw new Error(`Mailchimp token exchange non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || data.error) {
    throw new Error(String(data.error_description ?? data.error ?? text.slice(0, 200)))
  }
  return {
    access_token: String(data.access_token ?? ''),
    expires_in:   Number(data.expires_in ?? 0),
    scope:        data.scope ? String(data.scope) : undefined,
    token_type:   data.token_type ? String(data.token_type) : undefined,
  }
}

// After OAuth, fetch the datacenter + login info. Mailchimp issues tokens
// with no embedded server; you must call the metadata endpoint once.
export interface MailchimpMetadata {
  dc:           string     // e.g. "us14"
  api_endpoint: string
  login_email?: string
  account_name?:string
}

export async function fetchMetadata(accessToken: string): Promise<MailchimpMetadata> {
  const res = await fetch(OAUTH_METADATA, {
    headers: { 'Authorization': `OAuth ${accessToken}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Mailchimp metadata error (HTTP ${res.status}): ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as Record<string, unknown>
  const login = (data.login ?? {}) as Record<string, unknown>
  return {
    dc:           String(data.dc ?? ''),
    api_endpoint: String(data.api_endpoint ?? ''),
    login_email:  login.email       ? String(login.email)       : undefined,
    account_name: login.account_name ? String(login.account_name) : undefined,
  }
}

// ─── HTTP WRAPPER ─────────────────────────────────────────────────────────────

async function mcRequest(
  dc:          string,
  path:        string,
  method:      'GET' | 'POST',
  accessToken: string,
  params?:     Record<string, unknown>,
  body?:       unknown
): Promise<Record<string, unknown>> {
  const url = new URL(`${apiBase(dc)}${path}`)
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      url.searchParams.set(k, val)
    })
  }

  console.log(`[Mailchimp] ${method} ${url.pathname}`)

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
    console.error(`[Mailchimp] HTTP ${res.status}: ${text.slice(0, 300)}`)
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(text) as Record<string, unknown> } catch { /* ignore */ }
    const detail = (data?.detail ?? data?.title ?? text.slice(0, 200)) as string
    throw new Error(`Mailchimp API error (HTTP ${res.status}): ${detail}`)
  }

  if (!text) return {}
  try { return JSON.parse(text) as Record<string, unknown> }
  catch { return {} }
}

// ─── AUDIENCES (lists) — mapped into the "ad account" slot ───────────────────

export interface MailchimpAudience {
  id:            string
  name:          string
  member_count?: number
  date_created?: string
}

export async function listAudiences(dc: string, accessToken: string): Promise<MailchimpAudience[]> {
  const data  = await mcRequest(dc, '/lists', 'GET', accessToken, { count: 100 })
  const lists = (data.lists ?? []) as Record<string, unknown>[]
  return lists.map(l => {
    const stats = (l.stats ?? {}) as Record<string, unknown>
    return {
      id:            String(l.id ?? ''),
      name:          String(l.name ?? ''),
      member_count:  stats.member_count ? Number(stats.member_count) : undefined,
      date_created:  l.date_created ? String(l.date_created) : undefined,
    }
  })
}

// ─── CAMPAIGN (email) CREATION ────────────────────────────────────────────────

export interface MailchimpCampaignInput {
  name:        string
  subject?:    string
  from_name?:  string
  reply_to?:   string
  html?:       string
}

export async function createMailchimpCampaign(
  dc:          string,
  accessToken: string,
  audienceId:  string,
  fromEmail:   string,
  input:       MailchimpCampaignInput
): Promise<{ campaignId: string; webId: number | null }> {
  const fromName = input.from_name ?? input.name.slice(0, 50)
  const replyTo  = input.reply_to ?? fromEmail

  // 1 — Create a "regular" campaign against the audience.
  const campBody = {
    type:       'regular',
    recipients: { list_id: audienceId },
    settings: {
      subject_line: input.subject ?? input.name,
      title:        input.name,
      from_name:    fromName,
      reply_to:     replyTo,
    },
  }
  const camp = await mcRequest(dc, '/campaigns', 'POST', accessToken, undefined, campBody)
  const campaignId = String(camp.id ?? '')
  const webId      = camp.web_id != null ? Number(camp.web_id) : null
  if (!campaignId) throw new Error('Mailchimp did not return a campaign id')

  // 2 — Attach basic HTML content so the draft is complete. Users still need
  //     to review + send/schedule from Mailchimp's UI.
  const html = input.html && input.html.trim().length > 0
    ? input.html
    : `<!DOCTYPE html><html><body style="font-family:sans-serif">
         <h1>${escapeHtml(input.subject ?? input.name)}</h1>
         <p>Draft created by MAAFlo. Edit and send from Mailchimp.</p>
       </body></html>`

  try {
    await mcRequest(dc, `/campaigns/${campaignId}/content`, 'POST', accessToken, undefined, { html })
  } catch (e) {
    console.warn('[Mailchimp] Could not set campaign content:', e instanceof Error ? e.message : e)
  }

  return { campaignId, webId }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] ?? c))
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export interface MailchimpReport {
  campaign_id:   string
  send_date:     string   // YYYY-MM-DD
  emails_sent:   number
  opens:         number
  unique_opens:  number
  clicks:        number
  unique_clicks: number
  unsubscribed:  number
  bounces:       number
}

export async function getReport(
  dc:          string,
  accessToken: string,
  campaignId:  string
): Promise<MailchimpReport | null> {
  try {
    const r = await mcRequest(dc, `/reports/${campaignId}`, 'GET', accessToken)
    const opens   = (r.opens   ?? {}) as Record<string, unknown>
    const clicks  = (r.clicks  ?? {}) as Record<string, unknown>
    const bounces = (r.bounces ?? {}) as Record<string, unknown>
    const sendRaw = r.send_time ? String(r.send_time) : null
    return {
      campaign_id:   String(r.id ?? campaignId),
      send_date:     sendRaw ? sendRaw.slice(0, 10) : new Date().toISOString().slice(0, 10),
      emails_sent:   Number(r.emails_sent ?? 0),
      opens:         Number(opens.opens_total ?? 0),
      unique_opens:  Number(opens.unique_opens ?? 0),
      clicks:        Number(clicks.clicks_total ?? 0),
      unique_clicks: Number(clicks.unique_clicks ?? 0),
      unsubscribed:  Number(r.unsubscribed ?? 0),
      bounces:       Number((bounces.hard_bounces ?? 0) as number) + Number((bounces.soft_bounces ?? 0) as number),
    }
  } catch (e) {
    console.warn(`[Mailchimp] No report for campaign ${campaignId}:`, e instanceof Error ? e.message : e)
    return null
  }
}
