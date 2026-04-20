import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import campaignsRouter        from './routes/campaigns'
import analyticsRouter        from './routes/analytics'
import channelsRouter         from './routes/channels'
import backupRouter           from './routes/backup'
import settingsRouter         from './routes/settings'
import campaignChannelsRouter from './routes/campaign-channels'
import campaignAdsRouter      from './routes/campaign-ads'
import clientsRouter          from './routes/clients'

const app  = express()
const PORT = parseInt(process.env.PORT ?? '3001')

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/clients',   clientsRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/campaigns/:id/channels', campaignChannelsRouter)
app.use('/api/campaigns/:id/ads',      campaignAdsRouter)
app.use('/api/analytics',  analyticsRouter)
app.use('/api/channels',   channelsRouter)
app.use('/api/backup',     backupRouter)
app.use('/api/settings',   settingsRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`\n  MAAFlo API  →  http://localhost:${PORT}/api/health`)
  console.log(`  UI           →  http://localhost:5173\n`)
})
