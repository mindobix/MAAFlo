export function fmtCurrency(v: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function fmtNumber(v: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(v))
}

export function fmtPct(v: number) {
  return `${v.toFixed(2)}%`
}

export function fmtRoas(v: number) {
  return `${v.toFixed(2)}x`
}

export function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active':      return 'badge-green'
    case 'paused':      return 'badge-yellow'
    case 'completed':   return 'badge-blue'
    case 'draft':       return 'badge-gray'
    case 'connected':   return 'badge-green'
    case 'disconnected':return 'badge-gray'
    case 'error':       return 'badge-red'
    case 'coming_soon': return 'badge-purple'
    default:            return 'badge-gray'
  }
}

export function channelLabel(slug: string) {
  const map: Record<string, string> = {
    google_ads: 'Google Ads',
    meta:       'Meta',
    tiktok:     'TikTok',
    linkedin:   'LinkedIn',
  }
  return map[slug] ?? slug
}

export function goalLabel(goal: string) {
  const map: Record<string, string> = {
    awareness:   'Awareness',
    traffic:     'Traffic',
    leads:       'Lead Gen',
    conversions: 'Conversions',
    sales:       'Sales',
  }
  return map[goal] ?? goal
}
