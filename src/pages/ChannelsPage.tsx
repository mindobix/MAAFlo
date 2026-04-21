import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Unplug, Search, Facebook, Linkedin, Video, Globe, Save, ChevronDown, KeyRound, CheckCircle2, Twitter, Ghost, ShoppingBag, Pin, Mail } from 'lucide-react'
import { api } from '../lib/api'
import type { Channel, MetaAdAccount, TiktokAdvertiser, LinkedInAdAccount, XAdAccount, SnapAdAccount, AmazonProfile, PinterestAdAccount, MailchimpAudience } from '../lib/types'
import Badge from '../components/ui/Badge'
import { fmtDate } from '../lib/format'

const ICONS: Record<string, React.ElementType> = {
  search: Search, facebook: Facebook, linkedin: Linkedin, video: Video, globe: Globe, x: Twitter, ghost: Ghost, shopping: ShoppingBag, pin: Pin, mail: Mail,
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

  // TikTok state
  const [tkAdvertisers,   setTkAdvertisers]   = useState<TiktokAdvertiser[]>([])
  const [tkAdvertiserId,  setTkAdvertiserId]  = useState<string | null>(null)
  const [tkHasCreds,      setTkHasCreds]      = useState(false)
  const [tkCredsForm,     setTkCredsForm]     = useState({ tiktok_app_id: '', tiktok_app_secret: '' })
  const [savingTkCreds,   setSavingTkCreds]   = useState(false)
  const [showTkCredsForm, setShowTkCredsForm] = useState(false)

  // LinkedIn state
  const [liAccounts,      setLiAccounts]      = useState<LinkedInAdAccount[]>([])
  const [liAccountId,     setLiAccountId]     = useState<string | null>(null)
  const [liHasCreds,      setLiHasCreds]      = useState(false)
  const [liCredsForm,     setLiCredsForm]     = useState({ linkedin_client_id: '', linkedin_client_secret: '' })
  const [savingLiCreds,   setSavingLiCreds]   = useState(false)
  const [showLiCredsForm, setShowLiCredsForm] = useState(false)
  const [showLiTokenForm, setShowLiTokenForm] = useState(false)
  const [liManualToken,   setLiManualToken]   = useState('')
  const [savingLiToken,   setSavingLiToken]   = useState(false)

  // X (Twitter) Ads state
  const [xAccounts,       setXAccounts]       = useState<XAdAccount[]>([])
  const [xAccountId,      setXAccountId]      = useState<string | null>(null)
  const [xHasCreds,       setXHasCreds]       = useState(false)
  const [xCredsForm,      setXCredsForm]      = useState({ x_client_id: '', x_client_secret: '' })
  const [savingXCreds,    setSavingXCreds]    = useState(false)
  const [showXCredsForm,  setShowXCredsForm]  = useState(false)
  const [showXTokenForm,  setShowXTokenForm]  = useState(false)
  const [xOAuth1Form,     setXOAuth1Form]     = useState({ consumer_key: '', consumer_secret: '', access_token: '', access_token_secret: '' })
  const [savingXToken,    setSavingXToken]    = useState(false)

  // Snapchat state
  const [snapAccounts,    setSnapAccounts]    = useState<SnapAdAccount[]>([])
  const [snapAccountId,   setSnapAccountId]   = useState<string | null>(null)
  const [snapHasCreds,    setSnapHasCreds]    = useState(false)
  const [snapCredsForm,   setSnapCredsForm]   = useState({ snapchat_client_id: '', snapchat_client_secret: '' })
  const [savingSnapCreds, setSavingSnapCreds] = useState(false)
  const [showSnapCredsForm, setShowSnapCredsForm] = useState(false)
  const [showSnapTokenForm, setShowSnapTokenForm] = useState(false)
  const [snapManualToken,   setSnapManualToken]   = useState('')
  const [savingSnapToken,   setSavingSnapToken]   = useState(false)

  // Amazon state
  const [amzProfiles,      setAmzProfiles]      = useState<AmazonProfile[]>([])
  const [amzProfileId,     setAmzProfileId]     = useState<string | null>(null)
  const [amzHasCreds,      setAmzHasCreds]      = useState(false)
  const [amzCredsForm,     setAmzCredsForm]     = useState({ amazon_client_id: '', amazon_client_secret: '', region: 'NA' })
  const [savingAmzCreds,   setSavingAmzCreds]   = useState(false)
  const [showAmzCredsForm, setShowAmzCredsForm] = useState(false)

  // Pinterest state
  const [pinAccounts,      setPinAccounts]      = useState<PinterestAdAccount[]>([])
  const [pinAccountId,     setPinAccountId]     = useState<string | null>(null)
  const [pinHasCreds,      setPinHasCreds]      = useState(false)
  const [pinCredsForm,     setPinCredsForm]     = useState({ pinterest_client_id: '', pinterest_client_secret: '' })
  const [savingPinCreds,   setSavingPinCreds]   = useState(false)
  const [showPinCredsForm, setShowPinCredsForm] = useState(false)

  // Mailchimp state
  const [mcAudiences,      setMcAudiences]      = useState<MailchimpAudience[]>([])
  const [mcAudienceId,     setMcAudienceId]     = useState<string | null>(null)
  const [mcFromEmail,      setMcFromEmail]      = useState('')
  const [mcDc,             setMcDc]             = useState<string | null>(null)
  const [mcAccountName,    setMcAccountName]    = useState<string | null>(null)
  const [mcHasCreds,       setMcHasCreds]       = useState(false)
  const [mcCredsForm,      setMcCredsForm]      = useState({ mailchimp_client_id: '', mailchimp_client_secret: '', from_email: '' })
  const [savingMcCreds,    setSavingMcCreds]    = useState(false)
  const [showMcCredsForm,  setShowMcCredsForm]  = useState(false)

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

      if (list.find(c => c.slug === 'tiktok')) {
        try {
          const cfg = await api.tiktok.config(clientId)
          setTkHasCreds(cfg.has_credentials)
          setTkAdvertisers((cfg.advertisers ?? []) as TiktokAdvertiser[])
          setTkAdvertiserId(cfg.advertiser_id)
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'linkedin')) {
        try {
          const cfg = await api.linkedin.config(clientId)
          setLiHasCreds(cfg.has_credentials)
          setLiAccounts((cfg.ad_accounts ?? []) as LinkedInAdAccount[])
          setLiAccountId(cfg.account_id)
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'x_ads')) {
        try {
          const cfg = await api.x.config(clientId)
          setXHasCreds(cfg.has_credentials)
          setXAccounts((cfg.ad_accounts ?? []) as XAdAccount[])
          setXAccountId(cfg.account_id)
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'snapchat')) {
        try {
          const cfg = await api.snapchat.config(clientId)
          setSnapHasCreds(cfg.has_credentials)
          setSnapAccounts((cfg.ad_accounts ?? []) as SnapAdAccount[])
          setSnapAccountId(cfg.account_id)
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'amazon')) {
        try {
          const cfg = await api.amazon.config(clientId)
          setAmzHasCreds(cfg.has_credentials)
          setAmzProfiles((cfg.profiles ?? []) as AmazonProfile[])
          setAmzProfileId(cfg.profile_id)
          setAmzCredsForm(f => ({ ...f, region: cfg.region ?? 'NA' }))
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'pinterest')) {
        try {
          const cfg = await api.pinterest.config(clientId)
          setPinHasCreds(cfg.has_credentials)
          setPinAccounts((cfg.ad_accounts ?? []) as PinterestAdAccount[])
          setPinAccountId(cfg.account_id)
        } catch { /* ignore */ }
      }

      if (list.find(c => c.slug === 'mailchimp')) {
        try {
          const cfg = await api.mailchimp.config(clientId)
          setMcHasCreds(cfg.has_credentials)
          setMcAudiences((cfg.audiences ?? []) as MailchimpAudience[])
          setMcAudienceId(cfg.audience_id)
          setMcDc(cfg.dc)
          setMcAccountName(cfg.account_name)
          setMcFromEmail(cfg.from_email ?? '')
        } catch { /* ignore */ }
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId])

  function openOAuth(url: string, slug: string) {
    const label = slug === 'google_ads' ? 'Google Ads' : slug === 'meta' ? 'Meta Ads' : slug === 'tiktok' ? 'TikTok Ads' : slug === 'linkedin' ? 'LinkedIn Ads' : slug === 'x_ads' ? 'X Ads' : slug === 'snapchat' ? 'Snapchat Ads' : slug === 'amazon' ? 'Amazon Ads' : slug === 'pinterest' ? 'Pinterest Ads' : slug === 'mailchimp' ? 'Mailchimp' : slug
    const popup = window.open(url, '_blank', 'width=600,height=700')
    const check = setInterval(async () => {
      if (popup?.closed) clearInterval(check)
      const list = await api.channels.list(clientId)
      if (list.find(c => c.slug === slug)?.status === 'connected') {
        clearInterval(check); await load()
        setMsg({ text: `${label} connected!`, ok: true })
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
    if (ch.slug === 'tiktok')     { setTkAdvertisers([]); setTkAdvertiserId(null) }
    if (ch.slug === 'linkedin')   { setLiAccounts([]); setLiAccountId(null) }
    if (ch.slug === 'x_ads')      { setXAccounts([]); setXAccountId(null) }
    if (ch.slug === 'snapchat')   { setSnapAccounts([]); setSnapAccountId(null) }
    if (ch.slug === 'amazon')     { setAmzProfiles([]); setAmzProfileId(null) }
    if (ch.slug === 'pinterest')  { setPinAccounts([]); setPinAccountId(null) }
    if (ch.slug === 'mailchimp')  { setMcAudiences([]); setMcAudienceId(null); setMcDc(null) }
    await load()
  }

  async function saveMailchimpCreds() {
    if (!mcCredsForm.mailchimp_client_id || !mcCredsForm.mailchimp_client_secret) return
    setSavingMcCreds(true); setMsg(null)
    try {
      await api.mailchimp.saveCreds(clientId, mcCredsForm)
      setMcHasCreds(true)
      setShowMcCredsForm(false)
      if (mcCredsForm.from_email) setMcFromEmail(mcCredsForm.from_email)
      setMsg({ text: 'Mailchimp credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingMcCreds(false) }
  }

  async function connectMailchimp() {
    try { const { url } = await api.mailchimp.connectUrl(clientId); openOAuth(url, 'mailchimp') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function selectMcAudience(id: string) {
    await api.mailchimp.selectAudience(id, clientId)
    setMcAudienceId(id)
    setMsg({ text: `Mailchimp audience ${id} selected.`, ok: true })
  }

  async function saveMcFromEmail() {
    const email = mcFromEmail.trim()
    if (!email) return
    await api.mailchimp.setFromEmail(email, clientId)
    setMsg({ text: `From email set to ${email}.`, ok: true })
  }

  async function refreshMcAudiences() {
    setSyncing('mailchimp_load'); setMsg(null)
    try {
      const cfg = await api.mailchimp.refreshAudiences(clientId)
      setMcAudiences((cfg.audiences ?? []) as MailchimpAudience[])
      setMcAudienceId(cfg.audience_id)
      setMsg({ text: `Loaded ${cfg.audiences.length} audience(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load audiences', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncMailchimp() {
    setSyncing('mailchimp'); setMsg(null)
    try {
      const r = await api.mailchimp.sync(clientId)
      setMsg({ text: `Mailchimp synced — ${r.campaigns_synced} campaign(s).`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function savePinterestCreds() {
    if (!pinCredsForm.pinterest_client_id || !pinCredsForm.pinterest_client_secret) return
    setSavingPinCreds(true); setMsg(null)
    try {
      await api.pinterest.saveCreds(clientId, pinCredsForm)
      setPinHasCreds(true)
      setShowPinCredsForm(false)
      setMsg({ text: 'Pinterest credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingPinCreds(false) }
  }

  async function connectPinterest() {
    try { const { url } = await api.pinterest.connectUrl(clientId); openOAuth(url, 'pinterest') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function selectPinAccount(id: string) {
    await api.pinterest.selectAccount(id, clientId)
    setPinAccountId(id)
    setMsg({ text: `Pinterest ad account ${id} selected.`, ok: true })
  }

  async function refreshPinAccounts() {
    setSyncing('pinterest_load'); setMsg(null)
    try {
      const cfg = await api.pinterest.refreshAccounts(clientId)
      setPinAccounts((cfg.ad_accounts ?? []) as PinterestAdAccount[])
      setPinAccountId(cfg.account_id)
      setMsg({ text: `Loaded ${cfg.ad_accounts.length} ad account(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load accounts', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncPinterest() {
    setSyncing('pinterest'); setMsg(null)
    try {
      const r = await api.pinterest.sync(clientId)
      setMsg({ text: `Pinterest synced — ${r.days} day(s) of data imported.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function saveAmazonCreds() {
    if (!amzCredsForm.amazon_client_id || !amzCredsForm.amazon_client_secret) return
    setSavingAmzCreds(true); setMsg(null)
    try {
      await api.amazon.saveCreds(clientId, amzCredsForm)
      setAmzHasCreds(true)
      setShowAmzCredsForm(false)
      setMsg({ text: 'Amazon credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingAmzCreds(false) }
  }

  async function connectAmazon() {
    try { const { url } = await api.amazon.connectUrl(clientId); openOAuth(url, 'amazon') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function selectAmzProfile(id: string) {
    await api.amazon.selectProfile(id, clientId)
    setAmzProfileId(id)
    setMsg({ text: `Amazon profile ${id} selected.`, ok: true })
  }

  async function refreshAmzProfiles() {
    setSyncing('amazon_load'); setMsg(null)
    try {
      const cfg = await api.amazon.refreshProfiles(clientId)
      setAmzProfiles((cfg.profiles ?? []) as AmazonProfile[])
      setAmzProfileId(cfg.profile_id)
      setMsg({ text: `Loaded ${cfg.profiles.length} profile(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load profiles', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncAmazon() {
    setSyncing('amazon'); setMsg(null)
    try {
      const r = await api.amazon.sync(clientId)
      setMsg({ text: `Amazon report requested (id: ${r.report_id}) — ingest happens asynchronously.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function saveSnapCreds() {
    if (!snapCredsForm.snapchat_client_id || !snapCredsForm.snapchat_client_secret) return
    setSavingSnapCreds(true); setMsg(null)
    try {
      await api.snapchat.saveCreds(clientId, snapCredsForm)
      setSnapHasCreds(true)
      setShowSnapCredsForm(false)
      setMsg({ text: 'Snapchat credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingSnapCreds(false) }
  }

  async function connectSnap() {
    try { const { url } = await api.snapchat.connectUrl(clientId); openOAuth(url, 'snapchat') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function saveSnapManualToken() {
    if (!snapManualToken.trim()) return
    setSavingSnapToken(true); setMsg(null)
    try {
      const r = await api.snapchat.saveManualToken(clientId, snapManualToken.trim())
      setSnapAccounts(r.ad_accounts)
      setSnapAccountId(r.account_id)
      setShowSnapTokenForm(false)
      setSnapManualToken('')
      setMsg({ text: `Snapchat connected. Loaded ${r.ad_accounts.length} ad account(s).`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingSnapToken(false) }
  }

  async function selectSnapAccount(id: string) {
    await api.snapchat.selectAccount(id, clientId)
    setSnapAccountId(id)
    setMsg({ text: `Snapchat ad account ${id} selected.`, ok: true })
  }

  async function refreshSnapAccounts() {
    setSyncing('snapchat_load'); setMsg(null)
    try {
      const cfg = await api.snapchat.refreshAccounts(clientId)
      setSnapAccounts((cfg.ad_accounts ?? []) as SnapAdAccount[])
      setSnapAccountId(cfg.account_id)
      setMsg({ text: `Loaded ${cfg.ad_accounts.length} ad account(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load accounts', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncSnap() {
    setSyncing('snapchat'); setMsg(null)
    try {
      const r = await api.snapchat.sync(clientId)
      setMsg({ text: `Snapchat synced — ${r.days} day(s) of data imported.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function saveXCreds() {
    if (!xCredsForm.x_client_id || !xCredsForm.x_client_secret) return
    setSavingXCreds(true); setMsg(null)
    try {
      await api.x.saveCreds(clientId, xCredsForm)
      setXHasCreds(true)
      setShowXCredsForm(false)
      setMsg({ text: 'X credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingXCreds(false) }
  }

  async function connectX() {
    try { const { url } = await api.x.connectUrl(clientId); openOAuth(url, 'x_ads') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function saveXManualToken() {
    const { consumer_key, consumer_secret, access_token, access_token_secret } = xOAuth1Form
    if (!consumer_key || !consumer_secret || !access_token || !access_token_secret) return
    setSavingXToken(true); setMsg(null)
    try {
      const r = await api.x.saveManualToken(clientId, xOAuth1Form)
      setXAccounts(r.ad_accounts)
      setXAccountId(r.account_id)
      setShowXTokenForm(false)
      setXOAuth1Form({ consumer_key: '', consumer_secret: '', access_token: '', access_token_secret: '' })
      setMsg({ text: `X Ads connected. Loaded ${r.ad_accounts.length} ad account(s).`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingXToken(false) }
  }

  async function selectXAccount(id: string) {
    await api.x.selectAccount(id, clientId)
    setXAccountId(id)
    setMsg({ text: `X ad account ${id} selected.`, ok: true })
  }

  async function refreshXAccounts() {
    setSyncing('x_load'); setMsg(null)
    try {
      const cfg = await api.x.refreshAccounts(clientId)
      setXAccounts((cfg.ad_accounts ?? []) as XAdAccount[])
      setXAccountId(cfg.account_id)
      setMsg({ text: `Loaded ${cfg.ad_accounts.length} ad account(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load accounts', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncX() {
    setSyncing('x'); setMsg(null)
    try {
      const r = await api.x.sync(clientId)
      setMsg({ text: `X synced — ${r.days} day(s) of data imported.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function saveLinkedInCreds() {
    if (!liCredsForm.linkedin_client_id || !liCredsForm.linkedin_client_secret) return
    setSavingLiCreds(true); setMsg(null)
    try {
      await api.linkedin.saveCreds(clientId, liCredsForm)
      setLiHasCreds(true)
      setShowLiCredsForm(false)
      setMsg({ text: 'LinkedIn credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingLiCreds(false) }
  }

  async function saveLinkedInManualToken() {
    if (!liManualToken.trim()) return
    setSavingLiToken(true); setMsg(null)
    try {
      const r = await api.linkedin.saveManualToken(clientId, liManualToken.trim())
      setLiAccounts(r.ad_accounts)
      setLiAccountId(r.account_id)
      setShowLiTokenForm(false)
      setLiManualToken('')
      setMsg({ text: `LinkedIn connected. Loaded ${r.ad_accounts.length} ad account(s).`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingLiToken(false) }
  }

  async function connectLinkedIn() {
    try { const { url } = await api.linkedin.connectUrl(clientId); openOAuth(url, 'linkedin') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function selectLiAccount(id: string) {
    await api.linkedin.selectAccount(id, clientId)
    setLiAccountId(id)
    setMsg({ text: `LinkedIn ad account ${id} selected.`, ok: true })
  }

  async function refreshLiAccounts() {
    setSyncing('linkedin_load'); setMsg(null)
    try {
      const cfg = await api.linkedin.refreshAccounts(clientId)
      setLiAccounts((cfg.ad_accounts ?? []) as LinkedInAdAccount[])
      setLiAccountId(cfg.account_id)
      setMsg({ text: `Loaded ${cfg.ad_accounts.length} ad account(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load accounts', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncLinkedIn() {
    setSyncing('linkedin'); setMsg(null)
    try {
      const r = await api.linkedin.sync(clientId)
      setMsg({ text: `LinkedIn synced — ${r.days} day(s) of data imported.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
  }

  async function saveTiktokCreds() {
    if (!tkCredsForm.tiktok_app_id || !tkCredsForm.tiktok_app_secret) return
    setSavingTkCreds(true); setMsg(null)
    try {
      await api.tiktok.saveCreds(clientId, tkCredsForm)
      setTkHasCreds(true)
      setShowTkCredsForm(false)
      setMsg({ text: 'TikTok credentials saved. Click Connect to authorize.', ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setSavingTkCreds(false) }
  }

  async function connectTiktok() {
    try { const { url } = await api.tiktok.connectUrl(clientId); openOAuth(url, 'tiktok') }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false }) }
  }

  async function selectTkAdvertiser(id: string) {
    await api.tiktok.selectAdvertiser(id, clientId)
    setTkAdvertiserId(id)
    setMsg({ text: `TikTok advertiser ${id} selected.`, ok: true })
  }

  async function refreshTkAdvertisers() {
    setSyncing('tiktok_load'); setMsg(null)
    try {
      const cfg = await api.tiktok.refreshAdvertisers(clientId)
      setTkAdvertisers((cfg.advertisers ?? []) as TiktokAdvertiser[])
      setTkAdvertiserId(cfg.advertiser_id)
      setMsg({ text: `Loaded ${cfg.advertisers.length} advertiser(s).`, ok: true })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to load advertisers', ok: false })
    } finally { setSyncing(null) }
  }

  async function syncTiktok() {
    setSyncing('tiktok'); setMsg(null)
    try {
      const r = await api.tiktok.sync(clientId)
      setMsg({ text: `TikTok synced — ${r.days} day(s) of data imported.`, ok: true })
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed', ok: false })
    } finally { setSyncing(null) }
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
            const isGads     = ch.slug === 'google_ads'
            const isMeta     = ch.slug === 'meta'
            const isTiktok   = ch.slug === 'tiktok'
            const isLinkedIn = ch.slug === 'linkedin'
            const isX        = ch.slug === 'x_ads'
            const isSnap     = ch.slug === 'snapchat'
            const isAmazon   = ch.slug === 'amazon'
            const isPin      = ch.slug === 'pinterest'
            const isMc       = ch.slug === 'mailchimp'

            return (
              <div key={ch.id} className={`channel-card ${soon ? 'opacity-50' : ''}`}>
                <div className={`channel-icon ${conn
                  ? isGads ? 'bg-blue-50 text-blue-600'
                    : isMeta ? 'bg-indigo-50 text-indigo-600'
                    : isTiktok ? 'bg-pink-50 text-pink-600'
                    : isLinkedIn ? 'bg-sky-50 text-sky-700'
                    : isX ? 'bg-slate-900 text-white'
                    : isSnap ? 'bg-yellow-50 text-yellow-600'
                    : isAmazon ? 'bg-orange-50 text-orange-600'
                    : isPin ? 'bg-red-50 text-red-600'
                    : isMc ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-600'
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
                      {/* Graph API Explorer — easiest path */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <KeyRound size={13} className="text-accent" /> Quickest: Graph API Explorer Token
                        </p>
                        <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                          <li>Go to <strong>developers.facebook.com/tools/explorer</strong></li>
                          <li>Top-right: select your app (or use <em>Meta App</em> default)</li>
                          <li>Click <strong>Generate Access Token</strong></li>
                          <li>Tick permissions: <code className="bg-surface-2 px-1 rounded font-mono">ads_read</code>, <code className="bg-surface-2 px-1 rounded font-mono">ads_management</code>, <code className="bg-surface-2 px-1 rounded font-mono">business_management</code></li>
                          <li>Copy the token and paste it below</li>
                        </ol>
                        <div className="flex gap-2">
                          <input className="input flex-1 font-mono text-xs" placeholder="Paste access token…"
                            value={metaToken}
                            onChange={e => setMetaToken(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveMetaToken()} />
                          <button className="btn-primary px-3 py-2 text-xs" onClick={saveMetaToken} disabled={savingToken || !metaToken.trim()}>
                            {savingToken ? 'Saving…' : <><Save size={13} /> Connect</>}
                          </button>
                        </div>
                        <p className="text-xs text-ink-muted">Note: Graph API Explorer tokens expire in ~1 hour. For a permanent token use a System User (below).</p>
                      </div>

                      {/* System User Token — permanent, requires Business Portfolio */}
                      <div className="rounded-lg border border-rule/60 bg-surface/60 p-3 space-y-2">
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <KeyRound size={13} className="text-ink-muted" /> Permanent: System User Token
                        </p>
                        <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                          <li>You need a <strong>Meta Business Portfolio</strong> — if you don't have one, create it at <strong>business.facebook.com</strong> first</li>
                          <li>Inside Business Manager go to <strong>Settings → System Users</strong> (direct URL: <code className="bg-surface-2 px-1 rounded font-mono text-[10px]">business.facebook.com/settings/system-users</code>)</li>
                          <li>Click <strong>Add</strong> → give it a name → set role to <strong>Admin</strong></li>
                          <li>Click <strong>Generate New Token</strong> → select your Meta app → tick <code className="bg-surface-2 px-1 rounded font-mono">ads_read</code>, <code className="bg-surface-2 px-1 rounded font-mono">ads_management</code>, <code className="bg-surface-2 px-1 rounded font-mono">business_management</code></li>
                          <li>Copy the token and paste it in the field above</li>
                        </ol>
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

                  {/* ── TikTok Ads onboarding ─────────────────────────────── */}
                  {!conn && !soon && isTiktok && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {tkHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter TikTok App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowTkCredsForm(v => !v)}>
                            {showTkCredsForm ? 'Hide' : tkHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!tkHasCreds || showTkCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>business-api.tiktok.com</strong> → Become a Developer</li>
                              <li>My Apps → Create App → fill in basic info</li>
                              <li>Add <strong>Marketing API</strong> to your app</li>
                              <li>Add <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/tiktok/callback</code> as Advertiser Redirect URL</li>
                              <li>Copy <strong>App ID</strong> and <strong>App Secret</strong></li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="App ID"
                              value={tkCredsForm.tiktok_app_id}
                              onChange={e => setTkCredsForm(f => ({ ...f, tiktok_app_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="App Secret" type="password"
                              value={tkCredsForm.tiktok_app_secret}
                              onChange={e => setTkCredsForm(f => ({ ...f, tiktok_app_secret: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveTiktokCreds} disabled={savingTkCreds || !tkCredsForm.tiktok_app_id || !tkCredsForm.tiktok_app_secret}>
                              <Save size={12} /> {savingTkCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${tkHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize TikTok Advertiser
                        </p>
                        <p className="text-xs text-ink-muted">Authorizes MAAFlo to manage your TikTok Ads Manager account.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectTiktok} disabled={!tkHasCreds}>
                          <ExternalLink size={12} /> Connect TikTok Ads
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TikTok connected — advertiser selector */}
                  {conn && isTiktok && (
                    <div className="space-y-1">
                      {tkAdvertisers.length > 0 ? (
                        <>
                          <label className="label">Advertiser</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={tkAdvertiserId ?? ''}
                              onChange={e => selectTkAdvertiser(e.target.value)}>
                              <option value="" disabled>Select advertiser…</option>
                              {tkAdvertisers.map(a => (
                                <option key={a.advertiser_id} value={a.advertiser_id}>
                                  {a.advertiser_name || a.advertiser_id} ({a.advertiser_id})
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {tkAdvertiserId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {tkAdvertiserId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an advertiser above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No advertisers loaded — click Load Advertisers below</p>
                      )}
                    </div>
                  )}

                  {/* ── LinkedIn Ads onboarding ───────────────────────────── */}
                  {!conn && !soon && isLinkedIn && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {liHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter LinkedIn App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowLiCredsForm(v => !v)}>
                            {showLiCredsForm ? 'Hide' : liHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!liHasCreds || showLiCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 space-y-1">
                              <p><strong>⚠ Products tab not visible?</strong> Your app must be linked to a LinkedIn Company Page before the Products tab appears.</p>
                              <p><strong>⚠ Marketing API approval required</strong> — once the Products tab is visible, you must request <strong>Marketing Developer Platform</strong> access and wait for LinkedIn approval (1–3 business days).</p>
                            </div>
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>linkedin.com/developers/apps</strong> → Create App</li>
                              <li>Under <strong>App settings</strong>, set <strong>LinkedIn Page</strong> to your Company Page — <em>the Products tab will not appear without this</em></li>
                              <li>Click the <strong>Products</strong> tab (now visible) → find <strong>Marketing Developer Platform</strong> → click <strong>Request access</strong></li>
                              <li>Wait for LinkedIn approval email (1–3 business days) — <em>Connect returns a scope error until approved</em></li>
                              <li>After approval: <strong>Auth</strong> tab → OAuth 2.0 settings → add <code className="bg-surface-2 px-1 rounded font-mono text-[10px]">http://localhost:3001/api/channels/linkedin/callback</code> as Authorized Redirect URL</li>
                              <li>Copy <strong>Client ID</strong> and <strong>Client Secret</strong> from the Auth tab and enter below</li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="Client ID"
                              value={liCredsForm.linkedin_client_id}
                              onChange={e => setLiCredsForm(f => ({ ...f, linkedin_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Client Secret" type="password"
                              value={liCredsForm.linkedin_client_secret}
                              onChange={e => setLiCredsForm(f => ({ ...f, linkedin_client_secret: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveLinkedInCreds} disabled={savingLiCreds || !liCredsForm.linkedin_client_id || !liCredsForm.linkedin_client_secret}>
                              <Save size={12} /> {savingLiCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${liHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize (requires Marketing API approval)
                        </p>
                        <p className="text-xs text-ink-muted">Only works after LinkedIn approves your Marketing Developer Platform request.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectLinkedIn} disabled={!liHasCreds}>
                          <ExternalLink size={12} /> Connect LinkedIn Ads
                        </button>
                      </div>

                      {/* Alternative — paste token from Developer Portal */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink">Alternative — Paste token from Developer Portal</p>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowLiTokenForm(v => !v)}>
                            {showLiTokenForm ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        {showLiTokenForm && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-ink-muted">Go to <strong>linkedin.com/developers/apps</strong> → your app → <strong>Auth</strong> tab → <strong>OAuth token tools</strong> → generate a 3-legged token with <code className="bg-surface-2 px-1 rounded font-mono text-[10px]">r_ads r_ads_reporting rw_ads</code> scopes.</p>
                            <textarea
                              className="input text-xs font-mono resize-none h-20 w-full"
                              placeholder="Paste access token here…"
                              value={liManualToken}
                              onChange={e => setLiManualToken(e.target.value)}
                            />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveLinkedInManualToken} disabled={savingLiToken || !liManualToken.trim()}>
                              <Save size={12} /> {savingLiToken ? 'Saving…' : 'Save Token & Connect'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* LinkedIn connected — account selector */}
                  {conn && isLinkedIn && (
                    <div className="space-y-1">
                      {liAccounts.length > 0 ? (
                        <>
                          <label className="label">Ad Account</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={liAccountId ?? ''}
                              onChange={e => selectLiAccount(e.target.value)}>
                              <option value="" disabled>Select ad account…</option>
                              {liAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {liAccountId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {liAccountId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an ad account above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No ad accounts loaded — click Load Accounts below</p>
                      )}
                    </div>
                  )}

                  {/* ── X (Twitter) Ads onboarding ────────────────────────── */}
                  {!conn && !soon && isX && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 space-y-1">
                        <p><strong>⚠ X Ads API approval required.</strong> Your X app must be separately approved for Ads API access — the standard developer plan does not include it.</p>
                        <p>Apply at <strong>developer.x.com → Products → X Ads API</strong> and wait for approval before connecting will work.</p>
                      </div>
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {xHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter X App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowXCredsForm(v => !v)}>
                            {showXCredsForm ? 'Hide' : xHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!xHasCreds || showXCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>developer.x.com</strong> → create a project + app</li>
                              <li>Apply for <strong>X Ads API</strong> access for the app</li>
                              <li>User authentication settings → enable <strong>OAuth 2.0</strong>, type <em>Confidential client</em></li>
                              <li>Add <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/x_ads/callback</code> as Callback URI</li>
                              <li>Copy <strong>OAuth 2.0 Client ID</strong> and <strong>Client Secret</strong></li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="Client ID"
                              value={xCredsForm.x_client_id}
                              onChange={e => setXCredsForm(f => ({ ...f, x_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Client Secret" type="password"
                              value={xCredsForm.x_client_secret}
                              onChange={e => setXCredsForm(f => ({ ...f, x_client_secret: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveXCreds} disabled={savingXCreds || !xCredsForm.x_client_id || !xCredsForm.x_client_secret}>
                              <Save size={12} /> {savingXCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${xHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize X Ads Account
                        </p>
                        <p className="text-xs text-ink-muted">Uses OAuth 2.0 with PKCE. Authorizes MAAFlo to manage your X Ads accounts.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectX} disabled={!xHasCreds}>
                          <ExternalLink size={12} /> Connect X Ads
                        </button>
                      </div>

                      {/* Alternative — paste token from Developer Portal */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink">Alternative — Paste token from Developer Portal</p>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowXTokenForm(v => !v)}>
                            {showXTokenForm ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        {showXTokenForm && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-ink-muted">
                              Go to <strong>developer.x.com</strong> → your app → <strong>Keys and Tokens</strong>.
                              Copy all four values below. Make sure the Access Token has <em>Read and Write</em> permissions.
                            </p>
                            <input className="input text-xs font-mono" placeholder="API Key (Consumer Key)"
                              value={xOAuth1Form.consumer_key}
                              onChange={e => setXOAuth1Form(f => ({ ...f, consumer_key: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="API Key Secret (Consumer Secret)" type="password"
                              value={xOAuth1Form.consumer_secret}
                              onChange={e => setXOAuth1Form(f => ({ ...f, consumer_secret: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Access Token"
                              value={xOAuth1Form.access_token}
                              onChange={e => setXOAuth1Form(f => ({ ...f, access_token: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Access Token Secret" type="password"
                              value={xOAuth1Form.access_token_secret}
                              onChange={e => setXOAuth1Form(f => ({ ...f, access_token_secret: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveXManualToken}
                              disabled={savingXToken || !xOAuth1Form.consumer_key || !xOAuth1Form.consumer_secret || !xOAuth1Form.access_token || !xOAuth1Form.access_token_secret}>
                              <Save size={12} /> {savingXToken ? 'Saving…' : 'Save & Connect'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* X connected — account selector */}
                  {conn && isX && (
                    <div className="space-y-1">
                      {xAccounts.length > 0 ? (
                        <>
                          <label className="label">Ad Account</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={xAccountId ?? ''}
                              onChange={e => selectXAccount(e.target.value)}>
                              <option value="" disabled>Select ad account…</option>
                              {xAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {xAccountId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {xAccountId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an ad account above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No ad accounts loaded — click Load Accounts below</p>
                      )}
                    </div>
                  )}

                  {/* ── Snapchat Ads onboarding ───────────────────────────── */}
                  {!conn && !soon && isSnap && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {snapHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter Snapchat App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowSnapCredsForm(v => !v)}>
                            {showSnapCredsForm ? 'Hide' : snapHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!snapHasCreds || showSnapCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>business.snapchat.com</strong> → Business Details → Manage OAuth 2.0 Apps</li>
                              <li>Create a new OAuth app → set redirect to <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/snapchat/callback</code></li>
                              <li>Confirm the app has access to <strong>Marketing API</strong> (snapchat-marketing-api scope)</li>
                              <li>Copy <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="Client ID"
                              value={snapCredsForm.snapchat_client_id}
                              onChange={e => setSnapCredsForm(f => ({ ...f, snapchat_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Client Secret" type="password"
                              value={snapCredsForm.snapchat_client_secret}
                              onChange={e => setSnapCredsForm(f => ({ ...f, snapchat_client_secret: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveSnapCreds} disabled={savingSnapCreds || !snapCredsForm.snapchat_client_id || !snapCredsForm.snapchat_client_secret}>
                              <Save size={12} /> {savingSnapCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${snapHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize Snapchat Ad Account
                        </p>
                        <p className="text-xs text-ink-muted">Requires HTTPS redirect URL — use ngrok: <code className="bg-surface-2 px-1 rounded font-mono text-[10px]">ngrok http 3001</code> then update the redirect URL in your Snapchat app.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectSnap} disabled={!snapHasCreds}>
                          <ExternalLink size={12} /> Connect Snapchat Ads
                        </button>
                      </div>

                      {/* Alternative — paste token */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink">Alternative — Paste access token directly</p>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowSnapTokenForm(v => !v)}>
                            {showSnapTokenForm ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        {showSnapTokenForm && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-ink-muted font-semibold">Run this in your terminal (replace with your App credentials):</p>
                            <pre className="text-[10px] font-mono bg-surface-2 border border-rule rounded p-2 whitespace-pre-wrap break-all select-all">{`curl -X POST https://accounts.snapchat.com/login/oauth2/access_token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}</pre>
                            <p className="text-xs text-ink-muted">Copy the <code className="bg-surface-2 px-1 rounded font-mono">access_token</code> value from the JSON response and paste it below.</p>
                            <textarea
                              className="input text-xs font-mono resize-none h-20 w-full"
                              placeholder="Paste access_token here…"
                              value={snapManualToken}
                              onChange={e => setSnapManualToken(e.target.value)}
                            />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveSnapManualToken} disabled={savingSnapToken || !snapManualToken.trim()}>
                              <Save size={12} /> {savingSnapToken ? 'Saving…' : 'Save Token & Connect'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Snapchat connected — account selector */}
                  {conn && isSnap && (
                    <div className="space-y-1">
                      {snapAccounts.length > 0 ? (
                        <>
                          <label className="label">Ad Account</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={snapAccountId ?? ''}
                              onChange={e => selectSnapAccount(e.target.value)}>
                              <option value="" disabled>Select ad account…</option>
                              {snapAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {snapAccountId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {snapAccountId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an ad account above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No ad accounts loaded — click Load Accounts below</p>
                      )}
                    </div>
                  )}

                  {/* ── Amazon Ads onboarding ─────────────────────────────── */}
                  {!conn && !soon && isAmazon && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {amzHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter Login-with-Amazon Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowAmzCredsForm(v => !v)}>
                            {showAmzCredsForm ? 'Hide' : amzHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!amzHasCreds || showAmzCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>developer.amazon.com</strong> → Login with Amazon → Create a new Security Profile</li>
                              <li>Apply for <strong>Amazon Advertising API</strong> access for the profile</li>
                              <li>Under Web Settings → add <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/amazon/callback</code> as Allowed Return URL</li>
                              <li>Copy <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                              <li>Pick your region: <strong>NA</strong> (US/CA/MX/BR), <strong>EU</strong> (UK/DE/FR/IT/ES/IN/AE), or <strong>FE</strong> (JP/AU/SG)</li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="Client ID"
                              value={amzCredsForm.amazon_client_id}
                              onChange={e => setAmzCredsForm(f => ({ ...f, amazon_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Client Secret" type="password"
                              value={amzCredsForm.amazon_client_secret}
                              onChange={e => setAmzCredsForm(f => ({ ...f, amazon_client_secret: e.target.value }))} />
                            <div className="relative">
                              <select className="select pr-8 text-xs"
                                value={amzCredsForm.region}
                                onChange={e => setAmzCredsForm(f => ({ ...f, region: e.target.value }))}>
                                <option value="NA">NA — North America</option>
                                <option value="EU">EU — Europe</option>
                                <option value="FE">FE — Far East</option>
                              </select>
                              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                            </div>
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveAmazonCreds} disabled={savingAmzCreds || !amzCredsForm.amazon_client_id || !amzCredsForm.amazon_client_secret}>
                              <Save size={12} /> {savingAmzCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${amzHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize Amazon Advertising Profile
                        </p>
                        <p className="text-xs text-ink-muted">Opens Login-with-Amazon consent for your Advertising account.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectAmazon} disabled={!amzHasCreds}>
                          <ExternalLink size={12} /> Connect Amazon Ads
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Amazon connected — profile selector */}
                  {conn && isAmazon && (
                    <div className="space-y-1">
                      {amzProfiles.length > 0 ? (
                        <>
                          <label className="label">Advertising Profile</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={amzProfileId ?? ''}
                              onChange={e => selectAmzProfile(e.target.value)}>
                              <option value="" disabled>Select profile…</option>
                              {amzProfiles.map(p => (
                                <option key={p.profileId} value={p.profileId}>
                                  {p.accountName ?? p.profileId} ({p.countryCode} · {p.currencyCode})
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {amzProfileId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {amzProfileId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select a profile above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No profiles loaded — click Load Profiles below</p>
                      )}
                    </div>
                  )}

                  {/* ── Pinterest Ads onboarding ──────────────────────────── */}
                  {!conn && !soon && isPin && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {pinHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter Pinterest App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowPinCredsForm(v => !v)}>
                            {showPinCredsForm ? 'Hide' : pinHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!pinHasCreds || showPinCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>developers.pinterest.com</strong> → My Apps → Create App</li>
                              <li>Under Configure → add <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/pinterest/callback</code> as Redirect URI</li>
                              <li>Enable scopes: <code className="bg-surface-2 px-1 rounded font-mono">ads:read</code>, <code className="bg-surface-2 px-1 rounded font-mono">ads:write</code>, <code className="bg-surface-2 px-1 rounded font-mono">user_accounts:read</code></li>
                              <li>Copy <strong>App ID</strong> and <strong>App Secret Key</strong></li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="App ID"
                              value={pinCredsForm.pinterest_client_id}
                              onChange={e => setPinCredsForm(f => ({ ...f, pinterest_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="App Secret Key" type="password"
                              value={pinCredsForm.pinterest_client_secret}
                              onChange={e => setPinCredsForm(f => ({ ...f, pinterest_client_secret: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={savePinterestCreds} disabled={savingPinCreds || !pinCredsForm.pinterest_client_id || !pinCredsForm.pinterest_client_secret}>
                              <Save size={12} /> {savingPinCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${pinHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize Pinterest Ad Account
                        </p>
                        <p className="text-xs text-ink-muted">Authorizes MAAFlo to manage your Pinterest Ads Manager accounts.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectPinterest} disabled={!pinHasCreds}>
                          <ExternalLink size={12} /> Connect Pinterest Ads
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pinterest connected — account selector */}
                  {conn && isPin && (
                    <div className="space-y-1">
                      {pinAccounts.length > 0 ? (
                        <>
                          <label className="label">Ad Account</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={pinAccountId ?? ''}
                              onChange={e => selectPinAccount(e.target.value)}>
                              <option value="" disabled>Select ad account…</option>
                              {pinAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {pinAccountId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {pinAccountId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an ad account above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No ad accounts loaded — click Load Accounts below</p>
                      )}
                    </div>
                  )}

                  {/* ── Mailchimp onboarding ──────────────────────────────── */}
                  {!conn && !soon && isMc && (
                    <div className="space-y-3">
                      {/* Step 1 — Credentials */}
                      <div className="rounded-lg border border-rule bg-surface p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                            {mcHasCreds
                              ? <><CheckCircle2 size={13} className="text-ok" /> Step 1 — Credentials saved</>
                              : <><KeyRound size={13} className="text-accent" /> Step 1 — Enter Mailchimp OAuth App Credentials</>}
                          </div>
                          <button className="text-xs text-accent hover:underline" onClick={() => setShowMcCredsForm(v => !v)}>
                            {showMcCredsForm ? 'Hide' : mcHasCreds ? 'Edit' : 'Enter'}
                          </button>
                        </div>

                        {(!mcHasCreds || showMcCredsForm) && (
                          <div className="space-y-2 pt-1">
                            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside bg-white/50 rounded p-2 border border-rule">
                              <li>Go to <strong>admin.mailchimp.com</strong> → Account &amp; Billing → Extras → Registered Apps → Register an app</li>
                              <li>Set redirect URI to <code className="bg-surface-2 px-1 rounded font-mono">http://localhost:3001/api/channels/mailchimp/callback</code></li>
                              <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                              <li>Optional: set a default <strong>From email</strong> for campaigns (must be a verified sender in Mailchimp)</li>
                            </ol>
                            <input className="input text-xs font-mono" placeholder="Client ID"
                              value={mcCredsForm.mailchimp_client_id}
                              onChange={e => setMcCredsForm(f => ({ ...f, mailchimp_client_id: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Client Secret" type="password"
                              value={mcCredsForm.mailchimp_client_secret}
                              onChange={e => setMcCredsForm(f => ({ ...f, mailchimp_client_secret: e.target.value }))} />
                            <input className="input text-xs font-mono" placeholder="Default From email (optional — can set later)"
                              value={mcCredsForm.from_email}
                              onChange={e => setMcCredsForm(f => ({ ...f, from_email: e.target.value }))} />
                            <button className="btn-primary text-xs px-3 py-1.5 w-full" onClick={saveMailchimpCreds} disabled={savingMcCreds || !mcCredsForm.mailchimp_client_id || !mcCredsForm.mailchimp_client_secret}>
                              <Save size={12} /> {savingMcCreds ? 'Saving…' : 'Save Credentials'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Step 2 — Connect */}
                      <div className={`rounded-lg border p-3 space-y-2 ${mcHasCreds ? 'border-rule bg-surface' : 'border-rule/50 bg-surface/50 opacity-60'}`}>
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <ExternalLink size={13} className="text-accent" /> Step 2 — Authorize Mailchimp Account
                        </p>
                        <p className="text-xs text-ink-muted">Mailchimp will issue a long-lived token and identify your datacenter automatically.</p>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={connectMailchimp} disabled={!mcHasCreds}>
                          <ExternalLink size={12} /> Connect Mailchimp
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mailchimp connected — audience + from email selector */}
                  {conn && isMc && (
                    <div className="space-y-2">
                      {mcAccountName && <p className="text-xs text-ink-muted">Account: <strong>{mcAccountName}</strong>{mcDc ? ` · ${mcDc}` : ''}</p>}

                      {mcAudiences.length > 0 ? (
                        <>
                          <label className="label">Audience</label>
                          <div className="relative">
                            <select className="select pr-8"
                              value={mcAudienceId ?? ''}
                              onChange={e => selectMcAudience(e.target.value)}>
                              <option value="" disabled>Select audience…</option>
                              {mcAudiences.map(a => (
                                <option key={a.id} value={a.id}>{a.name}{a.member_count != null ? ` (${a.member_count.toLocaleString()} members)` : ''}</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                          </div>
                          {mcAudienceId
                            ? <p className="text-xs text-accent font-semibold">✓ Active: {mcAudienceId}</p>
                            : <p className="text-xs text-warn font-medium">⚠ Select an audience above</p>}
                        </>
                      ) : (
                        <p className="text-xs text-warn font-medium">⚠ No audiences loaded — click Load Audiences below</p>
                      )}

                      <label className="label">From email (verified sender)</label>
                      <div className="flex gap-2">
                        <input className="input flex-1 text-xs font-mono" placeholder="hello@yourdomain.com"
                          value={mcFromEmail}
                          onChange={e => setMcFromEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveMcFromEmail()} />
                        <button className="btn-primary px-3 py-2" onClick={saveMcFromEmail} disabled={!mcFromEmail.trim()}><Save size={13} /></button>
                      </div>
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
                    {conn && isTiktok && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshTkAdvertisers} disabled={syncing === 'tiktok_load'}>
                          <RefreshCw size={12} className={syncing === 'tiktok_load' ? 'animate-spin' : ''} /> Load Advertisers
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncTiktok} disabled={syncing === 'tiktok'}>
                          <RefreshCw size={12} className={syncing === 'tiktok' ? 'animate-spin' : ''} /> Sync Insights
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isLinkedIn && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshLiAccounts} disabled={syncing === 'linkedin_load'}>
                          <RefreshCw size={12} className={syncing === 'linkedin_load' ? 'animate-spin' : ''} /> Load Accounts
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncLinkedIn} disabled={syncing === 'linkedin'}>
                          <RefreshCw size={12} className={syncing === 'linkedin' ? 'animate-spin' : ''} /> Sync Insights
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isX && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshXAccounts} disabled={syncing === 'x_load'}>
                          <RefreshCw size={12} className={syncing === 'x_load' ? 'animate-spin' : ''} /> Load Accounts
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncX} disabled={syncing === 'x'}>
                          <RefreshCw size={12} className={syncing === 'x' ? 'animate-spin' : ''} /> Sync Insights
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isSnap && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshSnapAccounts} disabled={syncing === 'snapchat_load'}>
                          <RefreshCw size={12} className={syncing === 'snapchat_load' ? 'animate-spin' : ''} /> Load Accounts
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncSnap} disabled={syncing === 'snapchat'}>
                          <RefreshCw size={12} className={syncing === 'snapchat' ? 'animate-spin' : ''} /> Sync Insights
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isAmazon && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshAmzProfiles} disabled={syncing === 'amazon_load'}>
                          <RefreshCw size={12} className={syncing === 'amazon_load' ? 'animate-spin' : ''} /> Load Profiles
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncAmazon} disabled={syncing === 'amazon'}>
                          <RefreshCw size={12} className={syncing === 'amazon' ? 'animate-spin' : ''} /> Request Report
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isPin && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshPinAccounts} disabled={syncing === 'pinterest_load'}>
                          <RefreshCw size={12} className={syncing === 'pinterest_load' ? 'animate-spin' : ''} /> Load Accounts
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncPinterest} disabled={syncing === 'pinterest'}>
                          <RefreshCw size={12} className={syncing === 'pinterest' ? 'animate-spin' : ''} /> Sync Insights
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-danger border-danger/30" onClick={() => disconnect(ch)}>
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                    {conn && isMc && (
                      <>
                        <button className="btn-ghost text-xs px-3 py-1.5" onClick={refreshMcAudiences} disabled={syncing === 'mailchimp_load'}>
                          <RefreshCw size={12} className={syncing === 'mailchimp_load' ? 'animate-spin' : ''} /> Load Audiences
                        </button>
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={syncMailchimp} disabled={syncing === 'mailchimp'}>
                          <RefreshCw size={12} className={syncing === 'mailchimp' ? 'animate-spin' : ''} /> Sync Reports
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
