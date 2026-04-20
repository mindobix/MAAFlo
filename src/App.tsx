import { useEffect, useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import DashboardPage  from './pages/DashboardPage'
import CampaignsPage  from './pages/CampaignsPage'
import AnalyticsPage  from './pages/AnalyticsPage'
import ChannelsPage   from './pages/ChannelsPage'
import ClientsPage    from './pages/ClientsPage'
import BackupPage     from './pages/BackupPage'
import SettingsPage   from './pages/SettingsPage'
import { api } from './lib/api'
import type { Client, NavKey } from './lib/types'

export default function App() {
  const [nav, setNav] = useState<NavKey>('dashboard')
  const [currentClient, setCurrentClient] = useState<Client | null>(null)

  useEffect(() => {
    api.clients.list().then(list => {
      const saved = list.find(c => c.id === Number(localStorage.getItem('maaflo_client_id')))
      setCurrentClient(saved ?? list.find(c => c.status === 'active') ?? list[0] ?? null)
    })
  }, [])

  function switchClient(client: Client) {
    setCurrentClient(client)
    localStorage.setItem('maaflo_client_id', String(client.id))
    setNav('dashboard')
  }

  const clientId = currentClient?.id ?? 1

  const page = {
    dashboard: <DashboardPage clientId={clientId} />,
    campaigns: <CampaignsPage clientId={clientId} />,
    analytics: <AnalyticsPage clientId={clientId} />,
    channels:  <ChannelsPage  clientId={clientId} />,
    clients:   <ClientsPage   currentClientId={clientId} onSwitch={c => switchClient(c)} onCreated={c => { switchClient(c); setNav('channels') }} />,
    backup:    <BackupPage />,
    settings:  <SettingsPage />,
  }[nav]

  return (
    <div className="app-shell">
      <Sidebar
        active={nav}
        onChange={setNav}
        currentClient={currentClient}
        onClientClick={() => setNav('clients')}
      />
      <main className="main-content">{page}</main>
    </div>
  )
}
