import { useEffect, useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import type { Settings } from '../lib/types'

const blank: Settings = { app_name: 'MAAFlo', currency: 'USD', timezone: 'UTC', default_goal: 'traffic' }

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']
const TIMEZONES  = ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']

export default function SettingsPage() {
  const [form,    setForm]    = useState<Settings>(blank)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.settings.get()
      .then(s => setForm({ ...blank, ...s }))
      .finally(() => setLoading(false))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false)
    try {
      await api.settings.update(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-ink-muted text-sm">Loading…</div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Configure your MAAFlo workspace</p>
      </div>

      <div className="page-body max-w-xl">
        <form onSubmit={save} className="space-y-5">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-ink border-b border-rule pb-3">General</h3>

            <div>
              <label className="label">App Name</label>
              <input
                className="input"
                value={form.app_name}
                onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Currency</label>
              <select
                className="select"
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Timezone</label>
              <select
                className="select"
                value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Default Campaign Goal</label>
              <select
                className="select"
                value={form.default_goal}
                onChange={e => setForm(f => ({ ...f, default_goal: e.target.value as Settings['default_goal'] }))}
              >
                {(['awareness', 'traffic', 'leads', 'conversions', 'sales'] as const).map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-primary" type="submit" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-ok font-medium">
                <CheckCircle size={14} />
                Saved
              </span>
            )}
          </div>
        </form>

        {/* app info */}
        <div className="card p-5 mt-6 border-rule bg-surface">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">About MAAFlo</h3>
          <dl className="text-sm space-y-1.5">
            {[
              ['Version',  '0.1.0'],
              ['Stack',    'React + Express + SQLite'],
              ['Data dir', 'data/maaflo.db (local)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-mono text-xs text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  )
}
