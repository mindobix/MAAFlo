import { useEffect, useState } from 'react'
import { Plus, Edit2, Building2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Client } from '../lib/types'
import { fmtDate } from '../lib/format'
import Modal from '../components/ui/Modal'

interface Props {
  currentClientId: number
  onSwitch: (client: Client) => void
  onCreated?: (client: Client) => void
}

export default function ClientsPage({ currentClientId, onSwitch, onCreated }: Props) {
  const [clients,  setClients]  = useState<Client[]>([])
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null)
  const [form,     setForm]     = useState<Partial<Client>>({ name: '', notes: '' })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function load() {
    setClients(await api.clients.list())
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm({ name: '', notes: '' }); setError(''); setModal('create') }
  function openEdit(c: Client) { setForm({ ...c }); setError(''); setModal('edit') }

  async function save() {
    if (!form.name?.trim()) { setError('Client name is required'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        const newClient = await api.clients.create(form)
        setModal(null)
        onCreated?.(newClient)
        return
      } else if (form.id) {
        await api.clients.update(form.id, form)
      }
      setModal(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function toggleStatus(c: Client) {
    const next = c.status === 'active' ? 'inactive' : 'active'
    await api.clients.update(c.id, { status: next })
    await load()
  }

  const active   = clients.filter(c => c.status === 'active')
  const inactive = clients.filter(c => c.status === 'inactive')

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Clients</h1>
            <p className="page-sub">{active.length} active · {inactive.length} inactive</p>
          </div>
          <button className="btn-primary" onClick={openCreate}><Plus size={14} />New Client</button>
        </div>
      </div>

      <div className="page-body space-y-6">
        {/* Active */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Active</p>
          {active.length === 0 && <p className="text-sm text-ink-muted">No active clients.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map(c => (
              <div key={c.id}
                className={`card p-4 cursor-pointer transition-all border-2 ${c.id === currentClientId ? 'border-accent shadow-[0_0_0_3px_rgba(0,200,150,0.15)]' : 'border-transparent hover:border-accent/30'}`}
                onClick={() => onSwitch(c)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.id === currentClientId ? 'bg-accent text-white' : 'bg-surface-2 text-ink-muted'}`}>
                      <Building2 size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted">Since {fmtDate(c.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.id === currentClientId && (
                      <span className="text-xs bg-accent/10 text-accent border border-accent/20 rounded-full px-2 py-0.5 font-semibold">Active</span>
                    )}
                    <button className="btn-icon" onClick={e => { e.stopPropagation(); openEdit(c) }}><Edit2 size={13} /></button>
                  </div>
                </div>
                {c.notes && <p className="text-xs text-ink-muted mt-2 line-clamp-2">{c.notes}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-ink-muted">Click to switch portal</span>
                  <button
                    className="text-xs text-warn hover:text-red-600 transition-colors"
                    onClick={e => { e.stopPropagation(); toggleStatus(c) }}
                  >
                    Set Inactive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inactive */}
        {inactive.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Inactive</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {inactive.map(c => (
                <div key={c.id} className="card p-4 opacity-60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-surface-2 text-ink-muted flex items-center justify-center">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{c.name}</p>
                        <p className="text-xs text-ink-muted">Since {fmtDate(c.created_at)}</p>
                      </div>
                    </div>
                    <button className="btn-icon" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-ink-muted">Inactive</span>
                    <button className="text-xs text-accent hover:underline" onClick={() => toggleStatus(c)}>
                      Reactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'create' ? 'New Client' : 'Edit Client'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Client'}</button>
          </>}
        >
          {error && <p className="text-danger text-sm bg-red-50 px-3 py-2 rounded border border-red-200">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="label">Client Name *</label>
              <input className="input" value={form.name ?? ''} placeholder="e.g. Acme Corp"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            {modal === 'edit' && (
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status ?? 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none h-20" value={form.notes ?? ''} placeholder="Optional notes about this client…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
