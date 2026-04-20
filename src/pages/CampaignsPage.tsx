import { useEffect, useState } from 'react'
import { Plus, Edit2, Search, ChevronRight, Archive } from 'lucide-react'
import { api } from '../lib/api'
import type { Campaign, CampaignStatus, CampaignGoal } from '../lib/types'
import { fmtCurrency, fmtNumber, fmtDate, goalLabel } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import CampaignDetailPage from './CampaignDetailPage'

const STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'completed']
const GOALS:    CampaignGoal[]   = ['awareness', 'traffic', 'leads', 'conversions', 'sales']

const blank: Partial<Campaign> = {
  name: '', status: 'draft', goal: 'traffic',
  budget_total: 0, start_date: '', end_date: '', notes: '',
}

interface Props { clientId: number }

export default function CampaignsPage({ clientId }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState<'current' | 'archived'>('current')
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null)
  const [form,      setForm]      = useState<Partial<Campaign>>(blank)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [detailId,  setDetailId]  = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try { setCampaigns(await api.campaigns.list(clientId, tab === 'archived')) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId, tab])

  // drill into detail view
  if (detailId !== null) {
    return <CampaignDetailPage campaignId={detailId} clientId={clientId} onBack={() => { setDetailId(null); load() }} />
  }

  function openCreate() { setForm(blank); setError(''); setModal('create') }
  function openEdit(c: Campaign, e: React.MouseEvent) {
    e.stopPropagation()
    setForm({ ...c }); setError(''); setModal('edit')
  }

  async function save() {
    if (!form.name?.trim()) { setError('Campaign name is required'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'create') await api.campaigns.create({ ...form, client_id: clientId })
      else if (form.id)       await api.campaigns.update(form.id, form)
      setModal(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function archive(c: Campaign, e: React.MouseEvent) {
    e.stopPropagation()
    await api.campaigns.update(c.id, { status: 'archived' })
    await load()
  }

  async function unarchive(c: Campaign, e: React.MouseEvent) {
    e.stopPropagation()
    await api.campaigns.update(c.id, { status: 'paused' })
    await load()
  }

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Campaigns</h1>
            <p className="page-sub">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input className="input pl-8 w-52" placeholder="Search campaigns…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {tab === 'current' && <button className="btn-primary" onClick={openCreate}><Plus size={14} />New Campaign</button>}
          </div>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-1 mt-3">
          {(['current', 'archived'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === t ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body space-y-3">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Goal</th>
                  <th>Status</th>
                  <th>Channels</th>
                  <th className="text-right">Spend</th>
                  <th className="text-right">Impressions</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">Conv.</th>
                  <th>Start</th>
                  <th>End</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="cursor-pointer hover:bg-surface/60 transition-colors" onClick={() => setDetailId(c.id)}>
                    <td className="font-medium text-ink max-w-[200px] truncate">{c.name}</td>
                    <td className="text-xs text-ink-muted">{goalLabel(c.goal)}</td>
                    <td><Badge status={c.status} /></td>
                    <td className="text-xs text-ink-muted">
                      {/* channel count shown from legacy field for now */}
                      <span className="text-accent font-medium">View →</span>
                    </td>
                    <td className="text-right font-mono text-xs">{fmtCurrency(c.spend ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtNumber(c.impressions ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtNumber(c.clicks ?? 0)}</td>
                    <td className="text-right font-mono text-xs">{fmtNumber(c.conversions ?? 0)}</td>
                    <td className="text-xs">{fmtDate(c.start_date)}</td>
                    <td className="text-xs">{fmtDate(c.end_date)}</td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {tab === 'current' && <>
                          <button className="btn-icon" onClick={e => openEdit(c, e)} title="Edit"><Edit2 size={13} /></button>
                          <button className="btn-icon text-ink-muted hover:text-warn hover:bg-yellow-50" onClick={e => archive(c, e)} title="Archive"><Archive size={13} /></button>
                        </>}
                        {tab === 'archived' && (
                          <button className="btn-ghost text-xs px-2 py-1 text-accent" onClick={e => unarchive(c, e)}>Restore</button>
                        )}
                        <ChevronRight size={14} className="text-ink-muted" />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11}>
                      <div className="empty-state">
                        <p className="text-ink-muted">No campaigns found</p>
                        <button className="btn-primary mt-4" onClick={openCreate}><Plus size={14} />Create your first campaign</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'create' ? 'New Campaign' : 'Edit Campaign'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Campaign'}
            </button>
          </>}
        >
          {error && <p className="text-danger text-sm bg-red-50 px-3 py-2 rounded border border-red-200">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Campaign Name *</label>
              <input className="input" value={form.name ?? ''} placeholder="e.g. Spring Lead Gen"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Goal</label>
              <select className="select" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value as CampaignGoal }))}>
                {GOALS.map(g => <option key={g} value={g}>{goalLabel(g)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CampaignStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total Budget ($)</label>
              <input className="input" type="number" min="0" step="1"
                value={form.budget_total ?? 0}
                onChange={e => setForm(f => ({ ...f, budget_total: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div></div>
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.start_date ?? ''}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={form.end_date ?? ''}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none h-16" value={form.notes ?? ''}
                placeholder="Optional notes…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
