import { useRef, useState } from 'react'
import { Download, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function exportBackup() {
    const a = document.createElement('a')
    a.href = api.backup.exportUrl()
    a.download = `maaflo-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm(`Restore from "${file.name}"? This will overwrite all current data.`)) {
      e.target.value = ''
      return
    }
    setImporting(true); setResult(null)
    try {
      const r = await api.backup.import(file)
      setResult({ ok: true, msg: `Restored successfully at ${new Date(r.imported_at).toLocaleString()}` })
      // reload page to reflect new data
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: unknown) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Import failed' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Backup & Restore</h1>
        <p className="page-sub">Export your data or restore from a previous backup</p>
      </div>

      <div className="page-body max-w-2xl space-y-5">
        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
            result.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {result.ok
              ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
            {result.msg}
          </div>
        )}

        {/* export */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-dark/8 flex items-center justify-center flex-shrink-0">
              <Download size={18} className="text-ink" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink mb-1">Export Backup</h3>
              <p className="text-sm text-ink-muted mb-4">
                Downloads a <code className="bg-surface-2 px-1 rounded text-xs font-mono">.json</code> file
                containing all clients, campaigns, channel assignments, ads, analytics, and settings.
                Store it somewhere safe — it can fully restore your MAAFlo instance.
              </p>
              <button className="btn-primary" onClick={exportBackup}>
                <Download size={14} />
                Export Backup
              </button>
            </div>
          </div>
        </div>

        {/* import */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-warn/10 flex items-center justify-center flex-shrink-0">
              <Upload size={18} className="text-warn" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink mb-1">Restore from Backup</h3>
              <p className="text-sm text-ink-muted mb-1">
                Upload a previously exported <code className="bg-surface-2 px-1 rounded text-xs font-mono">.json</code> backup file.
              </p>
              <p className="text-xs text-danger mb-4 font-medium">
                Warning: this will overwrite all existing campaigns and analytics data.
              </p>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
              <button
                className="btn-ghost border-warn/50 text-warn hover:bg-amber-50"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
              >
                <Upload size={14} />
                {importing ? 'Restoring…' : 'Choose Backup File'}
              </button>
            </div>
          </div>
        </div>

        {/* info */}
        <div className="card p-5 border-rule bg-surface">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">What's included in a backup</h3>
          <ul className="text-sm text-ink-2 space-y-1">
            {[
              'Clients',
              'All campaigns and their metadata (headlines, descriptions, CTAs)',
              'Campaign channel assignments and push status',
              'Campaign ads (creatives per channel)',
              'Daily analytics data (impressions, clicks, conversions, spend, revenue)',
              'Channel connection status per client (not OAuth tokens for security)',
              'App settings (currency, timezone, defaults)',
            ].map(item => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
