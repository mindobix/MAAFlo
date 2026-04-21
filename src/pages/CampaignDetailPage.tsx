import { useEffect, useState } from 'react'
import {
  ArrowLeft, Plus, Upload, Trash2, Edit2, CheckCircle,
  ExternalLink, RefreshCw, Facebook, Search as SearchIcon, Globe,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { api } from '../lib/api'
import type { CampaignDetail, CampaignAd, Channel, ChannelSlug, CampaignStatus } from '../lib/types'
import { fmtCurrency, fmtNumber, fmtDate, goalLabel } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'

const CHANNEL_COLORS: Record<string, string> = {
  google_ads: '#4285f4',
  meta:       '#1877f2',
  tiktok:     '#010101',
  linkedin:   '#0077b5',
}

const CHANNEL_NAMES: Record<string, string> = {
  google_ads: 'Google Ads',
  meta:       'Meta Ads',
  tiktok:     'TikTok Ads',
  linkedin:   'LinkedIn Ads',
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  google_ads: SearchIcon,
  meta:       Facebook,
  linkedin:   Globe,
  tiktok:     Globe,
}

const CTAS = ['Learn More', 'Shop Now', 'Sign Up', 'Get Quote', 'Contact Us', 'Download', 'Book Now', 'Subscribe']

interface Props {
  campaignId: number
  clientId: number
  onBack: () => void
}

const blankAd = (slug: string): Partial<CampaignAd> => ({
  channel_slug: slug as ChannelSlug,
  name: '', headline: '', description: '', cta: 'Learn More', target_url: '', status: 'draft',
})

export default function CampaignDetailPage({ campaignId, clientId, onBack }: Props) {
  const [campaign,      setCampaign]      = useState<CampaignDetail | null>(null)
  const [allChans, setAllChans] = useState<Channel[]>([])
  const [loading,       setLoading]       = useState(true)
  const [chartMetric,   setChartMetric]   = useState<'spend' | 'impressions' | 'clicks' | 'conversions'>('spend')
  const [chartDays,     setChartDays]     = useState(30)

  // push state
  const [pushing,  setPushing]  = useState<string | null>(null)
  const [pushMsg,  setPushMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  // ad modal
  const [adModal,  setAdModal]  = useState<{ mode: 'create' | 'edit'; slug: string } | null>(null)
  const [adForm,   setAdForm]   = useState<Partial<CampaignAd>>({})
  const [adSaving, setAdSaving] = useState(false)
  const [adError,  setAdError]  = useState('')

  // add channel modal
  const [addChanModal, setAddChanModal] = useState(false)
  const [addChanSlug,  setAddChanSlug]  = useState('')
  const [addChanBudget, setAddChanBudget] = useState(50)

  async function load() {
    setLoading(true)
    try {
      const [det, chans] = await Promise.all([api.campaigns.get(campaignId), api.channels.list(clientId)])
      setCampaign(det)
      setAllChans(chans)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [campaignId])

  async function pushChannel(slug: string) {
    setPushing(slug); setPushMsg(null)
    try {
      const r = await api.campaignChannels.push(campaignId, slug)
      setPushMsg({ ok: true, text: `Pushed to ${CHANNEL_NAMES[slug]} — ID: ${r.campaignId}${r.adSetId ? ` · Ad Set: ${r.adSetId}` : ''}` })
      await load()
    } catch (e: unknown) {
      setPushMsg({ ok: false, text: e instanceof Error ? e.message : 'Push failed' })
    } finally { setPushing(null) }
  }

  async function removeChannel(slug: string) {
    if (!confirm(`Remove ${CHANNEL_NAMES[slug]} from this campaign?`)) return
    await api.campaignChannels.remove(campaignId, slug)
    await load()
  }

  async function updateChannelBudget(slug: string, budget_daily: number) {
    await api.campaignChannels.update(campaignId, slug, { budget_daily })
    await load()
  }

  async function addChannel() {
    if (!addChanSlug) return
    await api.campaignChannels.add(campaignId, { channel_slug: addChanSlug as ChannelSlug, budget_daily: addChanBudget })
    setAddChanModal(false); setAddChanSlug('')
    await load()
  }

  function openCreateAd(slug: string) {
    setAdForm(blankAd(slug)); setAdError(''); setAdModal({ mode: 'create', slug })
  }
  function openEditAd(ad: CampaignAd) {
    setAdForm({ ...ad }); setAdError(''); setAdModal({ mode: 'edit', slug: ad.channel_slug })
  }

  async function saveAd() {
    if (!adForm.name?.trim()) { setAdError('Ad name required'); return }
    setAdSaving(true); setAdError('')
    try {
      if (adModal?.mode === 'create') await api.campaignAds.create(campaignId, adForm)
      else if (adForm.id)            await api.campaignAds.update(campaignId, adForm.id, adForm)
      setAdModal(null)
      await load()
    } catch (e: unknown) {
      setAdError(e instanceof Error ? e.message : 'Save failed')
    } finally { setAdSaving(false) }
  }

  async function deleteAd(ad: CampaignAd) {
    if (!confirm(`Delete ad "${ad.name}"?`)) return
    await api.campaignAds.delete(campaignId, ad.id)
    await load()
  }

  if (loading || !campaign) {
    return (
      <div className="page-body flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-ink-muted" />
      </div>
    )
  }

  // aggregate totals across all channels
  const totSpend       = campaign.channels.reduce((s, c) => s + (c.spend ?? 0), 0)
  const totImpressions = campaign.channels.reduce((s, c) => s + (c.impressions ?? 0), 0)
  const totClicks      = campaign.channels.reduce((s, c) => s + (c.clicks ?? 0), 0)
  const totRevenue     = campaign.channels.reduce((s, c) => s + (c.revenue ?? 0), 0)
  const ctr  = totImpressions > 0 ? (totClicks / totImpressions * 100) : 0
  const roas = totSpend > 0 ? (totRevenue / totSpend) : 0

  // build chart data: date → { google_ads: X, meta: Y, ... }
  const chartMap: Record<string, Record<string, string | number>> = {}
  for (const row of campaign.analytics) {
    if (!chartMap[row.date]) chartMap[row.date] = { date: row.date }
    chartMap[row.date][row.channel_slug] = row[chartMetric]
  }
  const chartData = Object.values(chartMap).sort((a, b) => String(a.date).localeCompare(String(b.date)))

  // channels on this campaign
  const campaignChannelSlugs = new Set(campaign.channels.map(c => c.channel_slug))
  // all channels not yet added to this campaign
  const availableToAdd = allChans.filter(c => !campaignChannelSlugs.has(c.slug as ChannelSlug))

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn-icon" onClick={onBack}><ArrowLeft size={16} /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="page-title">{campaign.name}</h1>
              <Badge status={campaign.status} />
              <span className="text-xs bg-surface-2 text-ink-muted px-2 py-0.5 rounded-full">{goalLabel(campaign.goal)}</span>
            </div>
            <p className="page-sub">
              {campaign.start_date ? fmtDate(campaign.start_date) : '—'} → {campaign.end_date ? fmtDate(campaign.end_date) : 'Ongoing'}
              {' · '}{campaign.channels.length} channel{campaign.channels.length !== 1 ? 's' : ''}
              {' · '}{campaign.ads.length} ad{campaign.ads.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="page-body space-y-6">

        {pushMsg && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${pushMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {pushMsg.ok && <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />}
            <span>{pushMsg.text}</span>
          </div>
        )}

        {/* ── KPI Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Spend',        value: fmtCurrency(totSpend) },
            { label: 'Revenue',      value: fmtCurrency(totRevenue) },
            { label: 'ROAS',         value: `${roas.toFixed(2)}x` },
            { label: 'Impressions',  value: fmtNumber(totImpressions) },
            { label: 'Clicks',       value: fmtNumber(totClicks) },
            { label: 'CTR',          value: `${ctr.toFixed(2)}%` },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <p className="stat-label">{s.label}</p>
              <p className="stat-value text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Channels ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Channels</h2>
            {availableToAdd.length > 0 && (
              <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setAddChanModal(true)}>
                <Plus size={12} /> Add Channel
              </button>
            )}
          </div>

          {campaign.channels.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-muted">
              No channels yet.{availableToAdd.length > 0 && ' Click "Add Channel" to connect a platform.'}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaign.channels.map(cc => {
              const Icon      = CHANNEL_ICONS[cc.channel_slug] ?? Globe
              const color     = CHANNEL_COLORS[cc.channel_slug] ?? '#888'
              const chName    = CHANNEL_NAMES[cc.channel_slug] ?? cc.channel_slug
              const chCtr     = (cc.impressions ?? 0) > 0 ? ((cc.clicks ?? 0) / (cc.impressions ?? 1) * 100).toFixed(2) : '0.00'
              const isPushing = pushing === cc.channel_slug
              const adsForCh  = campaign.ads.filter(a => a.channel_slug === cc.channel_slug)

              return (
                <div key={cc.channel_slug} className="card p-4 space-y-4">
                  {/* channel header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, color }}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{chName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {cc.ext_campaign_id
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">✓ Live · #{cc.ext_campaign_id}</span>
                            : <span className="text-xs text-ink-muted bg-surface-2 border border-border rounded px-1.5 py-0.5">Not pushed</span>}
                          {cc.pushed_at && <span className="text-xs text-ink-muted">· {fmtDate(cc.pushed_at)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className={`btn-ghost text-xs px-2.5 py-1.5 ${isPushing ? 'opacity-50' : ''}`}
                        onClick={() => pushChannel(cc.channel_slug)}
                        disabled={isPushing}
                        title={`Push to ${chName}`}
                      >
                        {isPushing
                          ? <RefreshCw size={12} className="animate-spin" />
                          : <><Upload size={12} /> {cc.ext_campaign_id ? 'Re-push' : 'Push'}</>}
                      </button>
                      <button className="btn-icon text-danger hover:bg-red-50" onClick={() => removeChannel(cc.channel_slug)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* channel metrics */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Spend',       value: fmtCurrency(cc.spend ?? 0) },
                      { label: 'Impressions', value: fmtNumber(cc.impressions ?? 0) },
                      { label: 'Clicks',      value: fmtNumber(cc.clicks ?? 0) },
                      { label: 'CTR',         value: `${chCtr}%` },
                    ].map(m => (
                      <div key={m.label} className="bg-surface-2 rounded-lg px-2.5 py-2 text-center">
                        <p className="text-xs text-ink-muted">{m.label}</p>
                        <p className="text-sm font-semibold text-ink mt-0.5">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* daily budget */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-ink-muted shrink-0">Daily budget</label>
                    <input
                      className="input text-xs py-1 flex-1 max-w-[100px]"
                      type="number" min="0" step="1"
                      defaultValue={cc.budget_daily}
                      onBlur={e => updateChannelBudget(cc.channel_slug, parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* ads for this channel */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Ads ({adsForCh.length})</p>
                      <button className="btn-ghost text-xs px-2 py-1" onClick={() => openCreateAd(cc.channel_slug)}>
                        <Plus size={11} /> New Ad
                      </button>
                    </div>

                    {adsForCh.length === 0 && (
                      <p className="text-xs text-ink-muted text-center py-2">No ads yet — create your first ad for this channel</p>
                    )}

                    <div className="space-y-1.5">
                      {adsForCh.map(ad => (
                        <div key={ad.id} className="flex items-start gap-2 bg-surface-2 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-ink truncate">{ad.name}</span>
                              <Badge status={ad.status} />
                              {ad.ext_id && <span className="font-mono text-xs text-accent">#{ad.ext_id}</span>}
                            </div>
                            {ad.headline && <p className="text-xs text-ink-muted mt-0.5 truncate">{ad.headline}</p>}
                            {ad.description && <p className="text-xs text-ink-muted/70 truncate">{ad.description}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-ink-muted">
                              {ad.target_url && <a href={ad.target_url} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-0.5"><ExternalLink size={10} />{ad.target_url}</a>}
                              <span className="bg-border/60 rounded px-1.5 py-0.5">{ad.cta}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button className="btn-icon" onClick={() => openEditAd(ad)}><Edit2 size={12} /></button>
                            <button className="btn-icon text-danger hover:bg-red-50" onClick={() => deleteAd(ad)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Analytics Chart ── */}
        {chartData.length > 0 && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-ink">Performance by Channel</h2>
              <div className="flex items-center gap-2">
                {(['spend', 'impressions', 'clicks', 'conversions'] as const).map(m => (
                  <button key={m} onClick={() => setChartMetric(m)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${chartMetric === m ? 'bg-accent text-white border-accent' : 'border-border text-ink-muted hover:border-accent/40'}`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
                <select className="select text-xs py-1 ml-2" value={chartDays} onChange={e => setChartDays(Number(e.target.value))}>
                  <option value={7}>7d</option>
                  <option value={14}>14d</option>
                  <option value={30}>30d</option>
                  <option value={90}>90d</option>
                </select>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  {campaign.channels.map(cc => (
                    <linearGradient key={cc.channel_slug} id={`grad-${cc.channel_slug}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CHANNEL_COLORS[cc.channel_slug] ?? '#888'} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHANNEL_COLORS[cc.channel_slug] ?? '#888'} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => chartMetric === 'spend' ? `$${v}` : String(v)} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    chartMetric === 'spend' ? fmtCurrency(v) : fmtNumber(v),
                    CHANNEL_NAMES[name] ?? name,
                  ]}
                  labelFormatter={l => `Date: ${l}`}
                />
                <Legend formatter={name => CHANNEL_NAMES[name] ?? name} />
                {campaign.channels.map(cc => (
                  <Area
                    key={cc.channel_slug}
                    type="monotone"
                    dataKey={cc.channel_slug}
                    stroke={CHANNEL_COLORS[cc.channel_slug] ?? '#888'}
                    fill={`url(#grad-${cc.channel_slug})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Channel Comparison Bar ── */}
        {campaign.channels.length > 1 && (
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-ink">Channel Comparison</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={campaign.channels.map(cc => ({
                name:        CHANNEL_NAMES[cc.channel_slug] ?? cc.channel_slug,
                spend:       cc.spend ?? 0,
                impressions: cc.impressions ?? 0,
                clicks:      cc.clicks ?? 0,
                conversions: cc.conversions ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey={chartMetric} fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>

      {/* ── Add Channel Modal ── */}
      {addChanModal && (
        <Modal title="Add Channel" onClose={() => setAddChanModal(false)}
          footer={<>
            <button className="btn-ghost" onClick={() => setAddChanModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={addChannel} disabled={!addChanSlug}>Add</button>
          </>}>
          <div className="space-y-3">
            <div>
              <label className="label">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {availableToAdd.map(ch => {
                  const Icon = CHANNEL_ICONS[ch.slug] ?? Globe
                  const connected = ch.status === 'connected'
                  return (
                    <button key={ch.slug} type="button"
                      onClick={() => setAddChanSlug(ch.slug)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all ${addChanSlug === ch.slug ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-border hover:border-accent/40 text-ink'}`}>
                      <Icon size={15} />
                      <span className="flex-1 text-left">{ch.name}</span>
                      {!connected && <span className="text-xs text-ink-muted bg-surface-2 border border-border rounded px-1.5 py-0.5 leading-none">not connected</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="label">Daily Budget ($)</label>
              <input className="input" type="number" min="0" step="1" value={addChanBudget}
                onChange={e => setAddChanBudget(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Ad Create/Edit Modal ── */}
      {adModal && (
        <Modal
          title={adModal.mode === 'create' ? `New Ad — ${CHANNEL_NAMES[adModal.slug]}` : 'Edit Ad'}
          onClose={() => setAdModal(null)}
          footer={<>
            <button className="btn-ghost" onClick={() => setAdModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveAd} disabled={adSaving}>{adSaving ? 'Saving…' : 'Save Ad'}</button>
          </>}
        >
          {adError && <p className="text-danger text-sm bg-red-50 px-3 py-2 rounded border border-red-200 mb-3">{adError}</p>}
          <div className="space-y-3">
            <div>
              <label className="label">Ad Name *</label>
              <input className="input" value={adForm.name ?? ''} placeholder="e.g. Homepage Hero — Variant A"
                onChange={e => setAdForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="label mb-0">Headline</label>
                <span className={`text-xs ${(adForm.headline?.length ?? 0) > 30 ? 'text-warn' : 'text-ink-muted'}`}>
                  {adForm.headline?.length ?? 0}/30 G · 40 M
                </span>
              </div>
              <input className="input" value={adForm.headline ?? ''} maxLength={40}
                placeholder="e.g. Grow Your Business Today"
                onChange={e => setAdForm(f => ({ ...f, headline: e.target.value }))} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="label mb-0">Description</label>
                <span className={`text-xs ${(adForm.description?.length ?? 0) > 90 ? 'text-warn' : 'text-ink-muted'}`}>
                  {adForm.description?.length ?? 0}/90 G · 125 M
                </span>
              </div>
              <textarea className="input resize-none h-16" value={adForm.description ?? ''} maxLength={125}
                placeholder="e.g. Reach more customers with targeted ads that convert."
                onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Call to Action</label>
                <select className="select" value={adForm.cta ?? 'Learn More'} onChange={e => setAdForm(f => ({ ...f, cta: e.target.value }))}>
                  {CTAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={adForm.status ?? 'draft'} onChange={e => setAdForm(f => ({ ...f, status: e.target.value as CampaignStatus }))}>
                  {(['draft', 'active', 'paused'] as CampaignStatus[]).map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Target URL</label>
              <input className="input" type="url" value={adForm.target_url ?? ''} placeholder="https://…"
                onChange={e => setAdForm(f => ({ ...f, target_url: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
