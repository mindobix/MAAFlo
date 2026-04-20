import { useEffect, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import type { TrendPoint, CampaignBreakdown } from '../lib/types'
import { fmtCurrency, fmtNumber, fmtPct, fmtRoas, fmtDateShort, channelLabel } from '../lib/format'
import Badge from '../components/ui/Badge'

const RANGES = [7, 14, 30, 60, 90] as const

interface Props { clientId: number }

export default function AnalyticsPage({ clientId }: Props) {
  const [days,     setDays]     = useState<typeof RANGES[number]>(30)
  const [trend,    setTrend]    = useState<TrendPoint[]>([])
  const [rows,     setRows]     = useState<CampaignBreakdown[]>([])
  const [loading,  setLoading]  = useState(true)
  const [metric,   setMetric]   = useState<'spend' | 'clicks' | 'conversions' | 'revenue'>('spend')

  async function load() {
    setLoading(true)
    try {
      const [t, r] = await Promise.all([
        api.analytics.trend(clientId, days),
        api.analytics.byCampaign(clientId),
      ])
      setTrend(t)
      setRows(r)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId, days])

  const trendFmt = trend.map(d => ({ ...d, date: fmtDateShort(d.date) }))

  const METRICS = [
    { key: 'spend',       label: 'Spend',       color: '#0a1628', fmt: fmtCurrency },
    { key: 'clicks',      label: 'Clicks',      color: '#00c896', fmt: fmtNumber },
    { key: 'conversions', label: 'Conversions',  color: '#6366f1', fmt: fmtNumber },
    { key: 'revenue',     label: 'Revenue',      color: '#22c55e', fmt: fmtCurrency },
  ] as const

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-sub">Performance breakdown across all campaigns</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-2 rounded border border-rule p-0.5">
              {RANGES.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${days === d ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button className="btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="page-body space-y-6">
        {/* metric selector */}
        <div className="flex items-center gap-3">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${metric === m.key
                ? 'border-accent bg-accent-dim text-accent'
                : 'border-rule bg-white text-ink-2 hover:border-accent/30'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* main trend chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {METRICS.find(m => m.key === metric)?.label} — last {days} days
            </span>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendFmt}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={METRICS.find(m => m.key === metric)?.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={METRICS.find(m => m.key === metric)?.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => metric === 'spend' || metric === 'revenue' ? `$${v}` : String(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #dde2ec', fontSize: 12 }}
                  formatter={(v: number) => METRICS.find(m => m.key === metric)?.fmt(v) ?? v}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke={METRICS.find(m => m.key === metric)?.color}
                  strokeWidth={2}
                  fill="url(#grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* multi-line comparison */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clicks vs Conversions</span>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendFmt}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dde2ec', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="clicks"      name="Clicks"      stroke="#00c896" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="conversions" name="Conversions" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* per-campaign table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">By Campaign</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th className="text-right">Impressions</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">Conv.</th>
                  <th className="text-right">CVR</th>
                  <th className="text-right">Spend</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const ctr  = r.impressions > 0 ? r.clicks / r.impressions * 100 : 0
                  const cvr  = r.clicks > 0 ? r.conversions / r.clicks * 100 : 0
                  const roas = r.spend > 0 ? (r.revenue ?? 0) / r.spend : 0
                  return (
                    <tr key={r.id}>
                      <td className="font-medium text-ink">{r.name}</td>
                      <td>{channelLabel(r.channel)}</td>
                      <td><Badge status={r.status} /></td>
                      <td className="text-right font-mono text-xs">{fmtNumber(r.impressions ?? 0)}</td>
                      <td className="text-right font-mono text-xs">{fmtNumber(r.clicks ?? 0)}</td>
                      <td className="text-right font-mono text-xs">{fmtPct(ctr)}</td>
                      <td className="text-right font-mono text-xs">{fmtNumber(r.conversions ?? 0)}</td>
                      <td className="text-right font-mono text-xs">{fmtPct(cvr)}</td>
                      <td className="text-right font-mono text-xs">{fmtCurrency(r.spend ?? 0)}</td>
                      <td className="text-right font-mono text-xs">{fmtCurrency(r.revenue ?? 0)}</td>
                      <td className="text-right font-mono text-xs text-accent font-semibold">{fmtRoas(roas)}</td>
                    </tr>
                  )
                })}
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={11} className="text-center py-8 text-ink-muted">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
