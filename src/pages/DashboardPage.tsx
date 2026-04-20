import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import type { AnalyticsSummary, TrendPoint, CampaignBreakdown } from '../lib/types'
import { fmtCurrency, fmtNumber, fmtPct, fmtRoas, fmtDateShort, channelLabel } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'

interface Props { clientId: number }

export default function DashboardPage({ clientId }: Props) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [trend,   setTrend]   = useState<TrendPoint[]>([])
  const [rows,    setRows]    = useState<CampaignBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [s, t, r] = await Promise.all([
        api.analytics.summary(clientId),
        api.analytics.trend(clientId, 30),
        api.analytics.byCampaign(clientId),
      ])
      setSummary(s)
      setTrend(t)
      setRows(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  const trendFormatted = trend.map(d => ({ ...d, date: fmtDateShort(d.date) }))

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">Overview of your marketing performance (last 30 days)</p>
          </div>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-body space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Spend"    value={summary ? fmtCurrency(summary.spend)       : '—'} />
          <StatCard label="Impressions"    value={summary ? fmtNumber(summary.impressions)   : '—'} />
          <StatCard label="Clicks"         value={summary ? fmtNumber(summary.clicks)        : '—'} />
          <StatCard label="Conversions"    value={summary ? fmtNumber(summary.conversions)   : '—'} />
          <StatCard label="CTR"            value={summary ? fmtPct(summary.ctr)              : '—'} />
          <StatCard label="ROAS"           value={summary ? fmtRoas(summary.roas)            : '—'} accent />
          <StatCard label="Revenue"        value={summary ? fmtCurrency(summary.revenue)     : '—'} />
          <StatCard label="Cost / Conv."   value={summary && summary.conversions > 0
            ? fmtCurrency(summary.spend / summary.conversions) : '—'} />
        </div>

        {/* Trend charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Spend & Revenue — 30 days</span>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #dde2ec', fontSize: 12 }}
                    formatter={(v: number) => fmtCurrency(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="spend"   name="Spend"   stroke="#0a1628" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#00c896" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Clicks & Conversions — 30 days</span>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dde2ec', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="clicks"      name="Clicks"      fill="#0a1628" radius={[3,3,0,0]} />
                  <Bar dataKey="conversions" name="Conversions" fill="#00c896" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Campaign breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Campaign Performance</span>
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
                  <th className="text-right">Conv.</th>
                  <th className="text-right">Spend</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.name}</td>
                    <td>{channelLabel(r.channel)}</td>
                    <td><Badge status={r.status} /></td>
                    <td className="text-right font-mono text-xs">{fmtNumber(r.impressions ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtNumber(r.clicks ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtNumber(r.conversions ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtCurrency(r.spend ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtCurrency(r.revenue ?? 0)}</td>
                    <td className="text-right font-mono text-xs text-accent font-semibold">
                      {r.spend > 0 ? fmtRoas((r.revenue ?? 0) / r.spend) : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={9} className="text-center py-8 text-ink-muted">No campaigns yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
