import type { Client, Campaign, CampaignDetail, CampaignChannel, CampaignAd, Channel, AnalyticsSummary, TrendPoint, CampaignBreakdown, Settings, GoogleCustomer, MetaAdAccount, ChannelAnalytics } from './types'

const BASE = '/api'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? res.statusText)
  }
  return res.json()
}

export const api = {
  // clients
  clients: {
    list:   ()                          => req<Client[]>('/clients'),
    create: (body: Partial<Client>)     => req<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Client>) => req<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },

  // campaigns (all scoped to client)
  campaigns: {
    list:       (clientId: number, archived = false) => req<Campaign[]>(`/campaigns?client_id=${clientId}&archived=${archived}`),
    get:        (id: number)                    => req<CampaignDetail>(`/campaigns/${id}`),
    create:     (body: Partial<Campaign> & { client_id: number }) => req<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
    update:     (id: number, body: Partial<Campaign>) => req<Campaign>(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete:     (id: number)                    => req<{ ok: boolean }>(`/campaigns/${id}`, { method: 'DELETE' }),
    analytics:  (id: number, days?: number)     => req<ChannelAnalytics[]>(`/campaigns/${id}/analytics?days=${days ?? 30}`),
  },

  // campaign channels
  campaignChannels: {
    list:   (cid: number)                                         => req<CampaignChannel[]>(`/campaigns/${cid}/channels`),
    add:    (cid: number, body: Partial<CampaignChannel>)         => req<CampaignChannel>(`/campaigns/${cid}/channels`, { method: 'POST', body: JSON.stringify(body) }),
    update: (cid: number, slug: string, body: Partial<CampaignChannel>) => req<CampaignChannel>(`/campaigns/${cid}/channels/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (cid: number, slug: string)                           => req<{ ok: boolean }>(`/campaigns/${cid}/channels/${slug}`, { method: 'DELETE' }),
    push:   (cid: number, slug: string)                           => req<{ ok: boolean; campaignId: string; adSetId?: string }>(`/campaigns/${cid}/channels/${slug}/push`, { method: 'POST' }),
  },

  // campaign ads
  campaignAds: {
    list:   (cid: number, channel?: string)     => req<CampaignAd[]>(`/campaigns/${cid}/ads${channel ? `?channel=${channel}` : ''}`),
    create: (cid: number, body: Partial<CampaignAd>) => req<CampaignAd>(`/campaigns/${cid}/ads`, { method: 'POST', body: JSON.stringify(body) }),
    update: (cid: number, adId: number, body: Partial<CampaignAd>) => req<CampaignAd>(`/campaigns/${cid}/ads/${adId}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (cid: number, adId: number)         => req<{ ok: boolean }>(`/campaigns/${cid}/ads/${adId}`, { method: 'DELETE' }),
  },

  // analytics (scoped to client)
  analytics: {
    summary:    (clientId: number)                  => req<AnalyticsSummary>(`/analytics/summary?client_id=${clientId}`),
    trend:      (clientId: number, days = 30, campaignId?: number) => req<TrendPoint[]>(`/analytics/trend?client_id=${clientId}&days=${days}${campaignId ? `&campaign_id=${campaignId}` : ''}`),
    byCampaign: (clientId: number)                  => req<CampaignBreakdown[]>(`/analytics/by-campaign?client_id=${clientId}`),
  },

  // channels (scoped to client)
  channels: {
    list:            (clientId: number) => req<Channel[]>(`/channels?client_id=${clientId}`),
    connectUrl:      (clientId: number) => req<{ url: string }>(`/channels/google/connect?client_id=${clientId}`),
    disconnect:      (slug: string, clientId: number) => req<{ ok: boolean }>(`/channels/${slug}/disconnect`, { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
    sync:            (clientId: number) => req<{ ok: boolean; synced_at: string }>('/channels/google/sync', { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
    googleConfig:    (clientId: number) => req<{ has_credentials: boolean; customer_id: string | null; customers: GoogleCustomer[]; login_customer_id: string | null }>(`/channels/google/config?client_id=${clientId}`),
    saveGoogleCreds: (clientId: number, creds: { google_client_id: string; google_client_secret: string; google_developer_token: string }) =>
      req<{ ok: boolean }>('/channels/google/credentials', { method: 'POST', body: JSON.stringify({ ...creds, client_id: clientId }) }),
    refreshCustomers:(clientId: number) => req<{ customer_id: string | null; customers: GoogleCustomer[] }>('/channels/google/refresh-customers', { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
    selectCustomer:  (customer_id: string, clientId: number) => req<{ ok: boolean }>('/channels/google/select-customer', { method: 'POST', body: JSON.stringify({ customer_id, client_id: clientId }) }),
    pushCampaign:    (campaignId: number) => req<{ ok: boolean; campaignId: string }>(`/channels/google/push-campaign/${campaignId}`, { method: 'POST' }),
  },

  // meta (scoped to client)
  meta: {
    connectUrl:      (clientId: number) => req<{ url: string }>(`/channels/meta/connect?client_id=${clientId}`),
    connectToken:    (token: string, clientId: number) => req<{ ok: boolean; ad_accounts: MetaAdAccount[]; account_id: string | null }>('/channels/meta/connect-token', { method: 'POST', body: JSON.stringify({ token, client_id: clientId }) }),
    config:          (clientId: number) => req<{ has_credentials: boolean; account_id: string | null; ad_accounts: MetaAdAccount[] }>(`/channels/meta/config?client_id=${clientId}`),
    saveMetaCreds:   (clientId: number, creds: { meta_app_id: string; meta_app_secret: string }) =>
      req<{ ok: boolean }>('/channels/meta/credentials', { method: 'POST', body: JSON.stringify({ ...creds, client_id: clientId }) }),
    refreshAccounts: (clientId: number) => req<{ account_id: string | null; ad_accounts: MetaAdAccount[] }>('/channels/meta/refresh-accounts', { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
    selectAccount:   (account_id: string, clientId: number) => req<{ ok: boolean }>('/channels/meta/select-account', { method: 'POST', body: JSON.stringify({ account_id, client_id: clientId }) }),
    pushCampaign:    (campaignId: number) => req<{ ok: boolean; campaignId: string; adSetId: string }>(`/channels/meta/push-campaign/${campaignId}`, { method: 'POST' }),
    sync:            (clientId: number) => req<{ ok: boolean; days: number; synced_at: string }>('/channels/meta/sync', { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
  },

  // backup
  backup: {
    exportUrl: () => `${BASE}/backup/export`,
    import: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return req<{ ok: boolean; imported_at: string }>('/backup/import', { method: 'POST', headers: {}, body: form })
    },
  },

  // settings
  settings: {
    get:    () => req<Settings>('/settings'),
    update: (body: Partial<Settings>) => req<{ ok: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  },
}
