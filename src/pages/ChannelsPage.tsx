import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Unplug, Search, Facebook, Linkedin, Video, Globe, Save, ChevronDown, KeyRound, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Channel, MetaAdAccount } from '../lib/types'
import Badge from '../components/ui/Badge'
import { fmtDate } from '../lib/format'

const ICONS: Record<string, React.ElementType> = {
  search: Search, facebook: Facebook, linkedin: Linkedin, video: Video, globe: Globe,
}

interface Props { clientId: number }

export default function ChannelsPage({ clientId }: Props) {
  const [channels,   setChannels]   = useState<Channel[]>([])
  const [,           setLoading]    = useState(true)
  const [syncing,    setSyncing]    = useState<string | null>(null)
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)

  // Google Ads state
  const [gadsId,          setGadsId]          = useState<string | null>(null)
  const [gadsInput,       setGadsInput]        = useState('')
  const [gHasCreds,       setGHasCreds]        = useState(false)
  const [gCredsForm,      setGCredsForm]       = useState({ google_client_id: '', google_client_secret: '', google_developer_token: '' })
  const [savingGCreds,    setSavingGCreds]     = useState(false)
  const [showGCredsForm,  setShowGCredsForm]   = useState(false)

  // Meta state
  const [metaAccounts,    setMetaAccounts]    = useState<MetaAdAccount[]>([])
  const [metaAccountId,   setMetaAccountId]   = useState<string | null>(null)
  const [metaToken,       setMetaToken]       = useState('')
  const [savingToken,     setSavingToken]     = useState(false)
  const [metaManualInput, setMetaManualInput] = useState('')
  const [mHasCreds,       setMHasCreds]       = useState(false)
  const [mCredsForm,      setMCredsForm]      = useState({ meta_app_id: '', meta_app_secret: '' })
  const [savingMCreds,    setSavingMCreds]    = useState(false)
  const [showMCredsForm,  setShowMCredsForm]  = useState(false)

  async function load() {
    setLoading(true)
    try {
      const list = await api.channels.list(clientId)
      setChannels(list)

      if (list.find(c => c.slug === 'google_ads')) {
        try {
          const cfg = await api.channels.googleConfig(clientId)
          setGHasCreds(cfg.has_credentials)
          if (cfg.customer_id) { setGadsId(cfg.customer_id); setGadsInput(cfg.customer_id) }
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'meta')) {
        try {
          const cfg = await api.meta.config(clientId)
          setMHasCreds(cfg.has_credentials)
          setMetaAccounts((cfg.ad_accounts ?? []) as MetaAdAccount[])
          setMetaAccountId(cfg.account_id)
        } catch { /* ignore */ }
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId])

  function openOAuth(url: string, slug: string) {
    const popup = window.open(url, '_blank', 'width=600,height=700')
    const check = setInterval(async () => {
      if (popup?.closed) clearInterval(check)
      const list = await api.channels.list(clientId)
      if (list.find(c => c.slug === slug)?.status === 'connected') {
        clearInterval(check); await load()
        setMsg({ text: `${slug === 'google_ads' ? 'Google Ads' : 'Meta Ads'} connected!`, ok: true })
      }
    }, 2000)
    setTimeout(() => clearInterval(check), 120_000)
  }

  async function saveGoogleCreds() {
    if (!gCredsForm.google_client_id || !gCredsForm.google_client_secret || !gCredsForm.google_developer_token) return
    setSavingGCreds(true); setMsg(null)
    try {
      await api.channels.saveGoogleCreds(clientId, gCredsForm)
      setGHasCreds(true)
      setShowGCredsForm(false)
      setMsg({ text: 'Google Ads credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingGCreds(false) }
  }

  async function connectGoogle() {
    try { const { url } = await api.channels.connectUrl(clientId); openOAuth(url, 'google_ads') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function saveGadsId() {
    const id = gadsInput.replace(/-/g, '').trim()
    if (!id) return
    await api.channels.selectCustomer(id, clientId)
    setGadsId(id)
    setMsg({ text: `Google Ads account ${id} saved.`, ok: true })
  }

  async function saveMetaCreds() {
    if (!mCredsForm.meta_app_id || !mCredsForm.meta_app_secret) return
    setSavingMCreds(true); setMsg(null)
    try {
      await api.meta.saveMetaCreds(clientId, mCredsForm)
      setMHasCreds(true)
      setShowMCredsForm(false)
      setMsg({ text: 'Meta app credentials saved.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingMCreds(false) }
  }

  async function selectMetaAccount(id: string) {
    await api.meta.selectAccount(id, clientId)
    setMetaAccountId(id)
    setMsg({ text: `Meta account ${id} selected.`, ok: true })
  }

  async function saveMetaManual() {
    const raw = metaManualInput.trim()
    if (!raw) return
    const id = raw.startsWith('act_') ? raw : `act_${raw}`
    await api.meta.selectAccount(id, clientId)
    setMetaAccountId(id)
    setMetaAccounts([{ id, name: id, currency: '', status: 1 }])
    setMetaManualInput('')
    setMsg({ text: `Meta account ${id} saved.`, ok: true })
  }

  async function loadMetaAccounts() {
    setSyncing('meta_load'); setMsg(null)
    try {
      const cfg = await api.meta.refreshAccounts(clientId)
      setMetaAccounts((cfg.ad_accounts ?? []) as MetaAdAccount[])
      setMetaAccountId(cfg.account_id)
      setMsg({ text: `Loaded ${cfg.ad_accounts.length} ad account(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load accounts', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncMeta() {
    setSyncing('meta'); setMsg(null)
    try {
      const r = await api.meta.sync(clientId)
      setMsg({ text: `Meta synced — ${r.days} day(s) of data imported.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncGoogle() {
    setSyncing('google'); setMsg(null)
    try {
      await api.channels.sync(clientId)
      setMsg({ text: 'Google Ads synced.', ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function saveMetaToken() {
    const tok = metaToken.trim()
    if (!tok) return
    setSavingToken(true); setMsg(null)
    try {
      const r = await api.meta.connectToken(tok, clientId)
      setMetaAccounts((r.ad_accounts ?? []) as MetaAdAccount[])
      setMetaAccountId(r.account_id)
      setMetaToken('')
      setMsg({ text: `Meta connected — ${r.ad_accounts.length} ad account(s) found.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to connect', ok: false })
    } finally { setSavingToken(false) }
  }

  async function disconnect(ch: Channel) {
    if (!confirm(`Disconnect ${ch.name}?`)) return
    await api.channels.disconnect(ch.slug, clientId)
    if (ch.slug === 'google_ads') { setGadsId(null); setGadsInput('') }
    if (ch.slug === 'meta')       { setMetaAccounts([]); setMetaAccountId(null) }
    await load()
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Channels</h1>
        <p className="page-sub">Connect your advertising platforms</p>
      </div>

      <div className="page-body space-y-4">
        {msg && (
          <div className={`px-4 py-3 rounded-lg text-sm border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map(ch => {
            const Icon   = ICONS[ch.icon] ?? Globe
            const conn   = ch.status === 'connected'
            const soon   = ch.status === 'coming_soon'
            const isGads = ch.slug === 'google_ads'
            const isMeta = ch.slug === 'meta'

            return (
              <div key={ch.id} className={`channel-card ${soon ? 'opacity-50' : ''}`}>
                <div className={`channel-icon ${conn
                  ? isGads ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
                  : 'bg-surface-2 text-ink-muted'}`}>
                  <Icon size={20} />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{ch.name}</h3>
                    <Badge status={ch.status} label={soon ? 'Coming Soon' : undefined} />
                    {conn && <span className="pulse-dot" />}
                  </div>

                  {conn  && <p className="text-xs text-ink-muted">Connected {fmtDate(ch.connected_at)}{ch.last_sync_at ? ` · Last sync ${fmtDate(ch.last_sync_at)}` : ''}</p>}
                  {!conn && !soon && <p className="text-xs text-ink-muted">Set up credentials, then connect your account</p>}
                  {soon  && <p className="text-xs text-ink-muted">Planned for a future release</p>}

                  {/* ── Google Ads onboarding ─────────────────────────────── */}
                  {!conn && !soon && isGads && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {gHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter Google OAuth App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowGCredsForm(v => !v)}>
                            {showGCredsForm ? 'Hide' : gHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!gHasCreds || showGCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>console.cloud.google.com</strong> → Create Project</li>
                              <li>APIs &amp; Services → Enable <strong>Google Ads API</strong></li>
                              <li>Credentials → Create <strong>OAuth 2.0 Client ID</strong> (Web app)</li>
                              <li>Add <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/google/callback</code> as Authorized Redirect URI</li>
                              <li>Copy <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                              <li><strong>Developer Token</strong>: Google Ads Manager Account → Tools &amp; Settings → API Center</li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="Client ID  (e.g. 123456.apps.googleusercontent.com)"
                              value={gCredsForm.google_client_id}
                              onChange={e => setGCredsForm(f => ({ ...f, google_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Client Secret" type="password"
                              value={gCredsForm.google_client_secret}
                              onChange={e => setGCredsForm(f => ({ ...f, google_client_secret: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Developer Token" type="password"
                              value={gCredsForm.google_developer_token}
                              onChange={e => setGCredsForm(f => ({ ...f, google_developer_token: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveGoogleCreds} disabled={savingGCreds || !gCredsForm.google_client_id || !gCredsForm.google_client_secret || !gCredsForm.google_developer_token}>
                              <Save size={12} /> {savingGCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${gHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Connect via Google OAuth
                        </p>
                        <p className="text-xs text-ink-muted">Authorizes MAAFlo to access your Google Ads account.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectGoogle} disabled={!gHasCreds}>
                          <ExternalLink size={12} /> Connect Google Ads
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Google Ads — connected: customer ID picker */}
                  {conn && isGads && (
                    <div className="space-y-1">
                      <label className="label">Customer ID</label>
                      <div className="flex gap-2">
                        <input className="input flex-1" placeholder="e.g. 4540834448"
                          value={gadsInput}
                          onChange={e => setGadsInput(e.target.value.replace(/-/g, '').trim())}
                          onKeyDown={e => e.key === 'Enter' && saveGadsId()} />
                        <button className="btn-primary px-3 py-2" onClick={saveGadsId}><Save size={13} /></button>
                      </div>
                      <p className="text-xs text-ink-muted">Google Ads → account name top-right → copy the number</p>
                      {gadsId
                        ? <p className="text-xs text-accent font-semibold">✓ Active: {gadsId}</p>
                        : <p className="text-xs text-warn font-medium">⚠ No account set</p>}
                    </div>
                  )}

                  {/* ── Meta Ads onboarding ───────────────────────────────── */}
                  {!conn && !soon && isMeta && (
                    <div className="space-y-3">
                      {/* System User Token — primary path */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <KeyRound size={13} className="text-accent" /> Connect via System User Token <span className="text-ok font-medium">(Recommended)</span>
                        </p>
                        <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                          <li>Go to <strong>business.facebook.com</strong> → Business Settings</li>
                          <li>System Users → Add → create a <strong>System User</strong> (Admin role)</li>
                          <li>Click <strong>Generate New Token</strong> → select your app</li>
                          <li>Enable permissions: <code className="bg-surface-2 px-1 rounded font-mono">ads_read</code>, <code className="bg-surface-2 px-1 rounded font-mono">ads_management</code>, <code className="bg-surface-2 px-1 rounded font-mono">business_management</code></li>
                          <li>Copy the token and paste it below</li>
                        </ol>
                        <div className="flex gap-2">
                          <input className="input flex-1 font-mono text-xs" placeholder="Paste System User access token…"
                            value={metaToken}
                            onChange={e => setMetaToken(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveMetaToken()} />
                          <button className="btn-primary px-3 py-2 text-xs" onClick={saveMetaToken} disabled={savingToken || !metaToken.trim()}>
                            {savingToken ? 'Saving…' : <><Save size={13} /> Connect</>}
                          </button>
                        </div>
                      </div>

                      {/* OAuth path — optional, requires HTTPS in production */}
                      <div className="rounded-lg border border-rule/50 bg-surface/50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                            <ExternalLink size={13} /> OAuth Connect <span className="text-xs font-normal">(requires production HTTPS)</span>
                          </p>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowMCredsForm(v => !v)}>
                            {showMCredsForm ? 'Hide' : mHasCreds ? 'Edit App' : 'Configure App'}
                          </button>
                        </div>
                        {showMCredsForm && (
                          <div className="space-y-2">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>developers.facebook.com</strong> → My Apps → Create App → Business</li>
                              <li>Add <strong>Marketing API</strong> product</li>
                              <li>Settings → Basic → copy <strong>App ID</strong> and <strong>App Secret</strong></li>
                              <li>Facebook Login → Settings → add <code className="bg-surface-2 px-1 rounded font-mono text-xs">http://localhost:3001/api/channels/meta/callback</code> as redirect URI</li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="App ID"
                              value={mCredsForm.meta_app_id}
                              onChange={e => setMCredsForm(f => ({ ...f, meta_app_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="App Secret" type="password"
                              value={mCredsForm.meta_app_secret}
                              onChange={e => setMCredsForm(f => ({ ...f, meta_app_secret: e.target.value }))} />
                            <button className="btn-ghost text-xs px-3 py-1.5 w-full" onClick={saveMetaCreds} disabled={savingMCreds || !mCredsForm.meta_app_id || !mCredsForm.meta_app_secret}>
                              <Save size={12} /> {savingMCreds ? 'Saving…' : 'Save App Credentials'}
                            </button>
                          </div>
                        )}
                        {mHasCreds && !showMCredsForm && (
                          <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => openOAuth('', 'meta')} disabled>
                            <ExternalLink size={12} /> Connect via OAuth (HTTPS required)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Meta connected — ad account selector */}
                  {conn && isMeta && (
                    <div className="space-y-1">
                      {metaAccounts.length > 0 ? (
                        <>
                          <label className="label">Ad Account</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={metaAccountId ?? ''}
                              onChange={e => selectMetaAccount(e.target.value)}>
                              <option value="" disabled>Select account…</option>
                              {metaAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {metaAccountId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {metaAccountId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an account above</p>}
                        </>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-warn font-medium">⚠ No accounts found — enter Ad Account ID manually</p>
                          <div className="flex gap-2">
                            <input className="input flex-1 font-mono text-xs" placeholder="e.g. act_123456789 or 123456789"
                              value={metaManualInput}
                              onChange={e => setMetaManualInput(e.target.value.trim())}
                              onKeyDown={e => e.key === 'Enter' && saveMetaManual()} />
                            <button className="btn-primary px-3 py-2" onClick={saveMetaManual}><Save size={13} /></button>
                          </div>
                          <p className="text-xs text-ink-muted">Meta Ads Manager → top-left account switcher → copy the number after "act_"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* action buttons */}
                  <div className="flex items-center flex-wrap gap-2 pt-1">
                    {conn && isGads && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={syncGoogle} disabled={syncing === 'google'}>
                          <RefreshCw size={12} className={syncing === 'google' ? 'animate-spin' : ''} /> Sync
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isMeta && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={loadMetaAccounts} disabled={syncing === 'meta_load'}>
                          <RefreshCw size={12} className={syncing === 'meta_load' ? 'animate-spin' : ''} /> Load Accounts
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncMeta} disabled={syncing === 'meta'}>
                          <RefreshCw size={12} className={syncing === 'meta' ? 'animate-spin' : ''} /> Sync Insights
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
