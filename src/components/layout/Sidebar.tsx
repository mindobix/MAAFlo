import {
  LayoutDashboard, Megaphone, BarChart2, Plug, Archive, Settings, Zap,
  Building2, ChevronRight, Users,
} from 'lucide-react'
import type { NavKey, Client } from '../../lib/types'

const NAV: { key: NavKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
  { key: 'channels',  label: 'Channels',  icon: Plug },
]

const BOTTOM: { key: NavKey; label: string; icon: React.ElementType }[] = [
  { key: 'clients',  label: 'Clients',  icon: Users },
  { key: 'backup',   label: 'Backup',   icon: Archive },
  { key: 'settings', label: 'Settings', icon: Settings },
]

interface Props {
  active:          NavKey
  onChange:        (k: NavKey) => void
  currentClient:   Client | null
  onClientClick:   () => void
}

export default function Sidebar({ active, onChange, currentClient, onClientClick }: Props) {
  return (
    <aside className="sidebar">
      {/* logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <Zap size={14} />
        </div>
        <span className="sidebar-logo-text">MAA<span>Flo</span></span>
      </div>

      {/* client switcher */}
      <button
        className="mx-3 mt-3 mb-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/10 hover:border-accent/40 hover:bg-white/5 transition-all text-left w-[calc(100%-1.5rem)] group"
        onClick={onClientClick}
      >
        <div className="w-7 h-7 rounded-lg bg-accent/20 text-accent flex items-center justify-center flex-shrink-0">
          <Building2 size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider leading-none mb-0.5">Client</p>
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {currentClient?.name ?? 'Loading…'}
          </p>
        </div>
        <ChevronRight size={13} className="text-white/30 group-hover:text-accent transition-colors flex-shrink-0" />
      </button>

      {/* main nav */}
      <nav className="nav-group">
        <div className="nav-label">Portal</div>
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${active === key ? 'active' : ''}`}
            onClick={() => onChange(key)}
          >
            <Icon className="nav-icon" />
            {label}
          </button>
        ))}
      </nav>

      {/* bottom nav */}
      <div className="px-3 pb-5 border-t border-white/10 pt-4">
        <div className="nav-label">System</div>
        {BOTTOM.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${active === key ? 'active' : ''}`}
            onClick={() => onChange(key)}
          >
            <Icon className="nav-icon" />
            {label}
          </button>
        ))}
      </div>
    </aside>
  )
}
