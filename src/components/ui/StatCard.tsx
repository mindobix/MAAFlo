import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  label:   string
  value:   string
  delta?:  string
  trend?:  'up' | 'down' | 'flat'
  accent?: boolean
}

export default function StatCard({ label, value, delta, trend, accent }: Props) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <div className={`stat-card ${accent ? 'border-accent/30 bg-accent-dim' : ''}`}>
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${accent ? 'text-accent' : ''}`}>{value}</p>
      {delta && (
        <p className={`stat-delta flex items-center gap-1 ${trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'text-ink-muted'}`}>
          <TrendIcon size={12} />
          {delta} vs last period
        </p>
      )}
    </div>
  )
}
