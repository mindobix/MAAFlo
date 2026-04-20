export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type CampaignGoal   = 'awareness' | 'traffic' | 'leads' | 'conversions' | 'sales'
export type ChannelSlug    = 'google_ads' | 'meta' | 'tiktok' | 'linkedin'
export type ChannelStatus  = 'disconnected' | 'connected' | 'error' | 'coming_soon'

// Top-level campaign — channel-agnostic
export interface Campaign {
  id:           number
  name:         string
  status:       CampaignStatus
  goal:         CampaignGoal
  budget_total: number
  start_date:   string | null
  end_date:     string | null
  notes:        string
  // legacy columns kept for backward compat
  channel:      ChannelSlug
  budget_daily: number
  ext_id:       string | null
  spend:        number
  impressions:  number
  clicks:       number
  conversions:  number
  created_at:   string
  updated_at:   string
}

// A campaign's presence on one platform
export interface CampaignChannel {
  id:              number
  campaign_id:     number
  channel_slug:    ChannelSlug
  status:          CampaignStatus
  budget_daily:    number
  ext_campaign_id: string | null
  ext_adset_id:    string | null
  pushed_at:       string | null
  created_at:      string
  // aggregated analytics (populated by GET /campaigns/:id)
  spend?:       number
  impressions?: number
  clicks?:      number
  conversions?: number
  revenue?:     number
}

// Individual ad creative within a channel
export interface CampaignAd {
  id:          number
  campaign_id: number
  channel_slug: ChannelSlug
  name:        string
  headline:    string
  description: string
  cta:         string
  target_url:  string
  status:      CampaignStatus
  ext_id:      string | null
  pushed_at:   string | null
  created_at:  string
  updated_at:  string
  // analytics
  spend?:       number
  impressions?: number
  clicks?:      number
  conversions?: number
}

// Full campaign detail (campaign + channels + ads + analytics)
export interface CampaignDetail extends Campaign {
  channels: CampaignChannel[]
  ads:      CampaignAd[]
  analytics: ChannelAnalytics[]
}

export interface ChannelAnalytics {
  channel_slug: ChannelSlug
  date:         string
  impressions:  number
  clicks:       number
  conversions:  number
  spend:        number
  revenue:      number
}

export interface Channel {
  id:            number
  slug:          ChannelSlug
  name:          string
  icon:          string
  status:        ChannelStatus
  connected_at:  string | null
  last_sync_at:  string | null
}

export interface AnalyticsSummary {
  impressions: number
  clicks:      number
  conversions: number
  spend:       number
  revenue:     number
  ctr:         number
  roas:        number
}

export interface TrendPoint {
  date:        string
  impressions: number
  clicks:      number
  conversions: number
  spend:       number
  revenue:     number
}

export interface CampaignBreakdown extends TrendPoint {
  id:      number
  name:    string
  channel: ChannelSlug
  status:  CampaignStatus
}

export interface Settings {
  app_name:     string
  currency:     string
  timezone:     string
  default_goal: CampaignGoal
}

export interface MetaAdAccount {
  id:       string
  name:     string
  currency: string
  status:   number
}

export interface GoogleCustomer {
  id:       string
  name:     string
  currency: string
  manager:  boolean
}

export interface Client {
  id:         number
  name:       string
  status:     'active' | 'inactive'
  notes:      string
  created_at: string
  updated_at: string
}

export type NavKey = 'dashboard' | 'campaigns' | 'analytics' | 'channels' | 'clients' | 'backup' | 'settings'
