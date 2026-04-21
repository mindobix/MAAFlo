# MAAFlo — Marketing Analytics Automation Flow

Local-first marketing automation and analytics platform. Manage multiple clients, connect 9 advertising & email channels, push campaigns to real platforms, and analyse cross-channel performance — all from a single self-hosted web app backed by SQLite.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3, WAL mode) |
| Charts | Recharts |
| Styling | Tailwind CSS |

---

## Supported channels

| Channel | Auth | Scaffolding |
|---|---|---|
| Google Ads | OAuth 2.0 + developer token | Campaign create, sync |
| Meta Ads | System User token · OAuth 2.0 | Campaign + ad set create, insights sync |
| TikTok Ads | OAuth 2.0 | Campaign + ad group create, daily reports |
| LinkedIn Ads | OAuth 2.0 | Campaign group + campaign create, analytics |
| X (Twitter) Ads | OAuth 2.0 with PKCE | Campaign + line item create, stats |
| Snapchat Ads | OAuth 2.0 | Campaign + ad squad create, daily stats |
| Amazon Ads | Login with Amazon (OAuth 2.0, multi-region NA/EU/FE) | Sponsored Products campaign + ad group, async v3 reports |
| Pinterest Ads | OAuth 2.0 | Campaign + ad group create, daily analytics |
| Mailchimp | OAuth 2.0 | Email campaign draft create, per-campaign reports |

All channels share a uniform data model: top-level `campaigns` are channel-agnostic and map onto per-platform `campaign_channels` rows. Push creates real entities on each platform (kept PAUSED/DRAFT so nothing goes live unreviewed). Sync upserts daily metrics into `analytics_daily` keyed by `(campaign_id, date)` with a `channel_slug`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & run

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

The SQLite database is created automatically at `data/maaflo.db` on first run. Channel-specific credentials (client IDs, secrets, tokens, selected accounts) are entered once per client in the **Channels** page and stored in the database — no `.env` editing required. A `.env.example` is provided if you prefer environment-driven redirect URIs for a deployed setup.

---

## Multi-client Architecture

Every piece of data (channels, campaigns, analytics) is scoped to a **Client**. You can manage multiple advertisers from one installation.

- Create clients via **System → Clients**
- Switch the active portal using the client switcher in the left sidebar
- Each client has its own channel connections, campaign history, and metrics

---

## Connecting Channels

Credentials are entered once per client inside **Channels** and stored in the database. Each channel uses the same two-step onboarding:

1. **Save OAuth app credentials** (client ID / secret, plus developer token / region where required).
2. **Authorise** via the platform's OAuth consent flow — a popup returns a token stored per-client.

After connecting, pick an ad account (or audience for Mailchimp, advertising profile for Amazon, advertiser for TikTok).

### Local OAuth redirect URIs

Each channel expects a callback at `http://localhost:3001/api/channels/<slug>/callback`:

| Channel | Callback URI |
|---|---|
| Google Ads | `/api/channels/google/callback` |
| Meta Ads | `/api/channels/meta/callback` |
| TikTok Ads | `/api/channels/tiktok/callback` |
| LinkedIn Ads | `/api/channels/linkedin/callback` |
| X Ads | `/api/channels/x_ads/callback` |
| Snapchat Ads | `/api/channels/snapchat/callback` |
| Amazon Ads | `/api/channels/amazon/callback` |
| Pinterest Ads | `/api/channels/pinterest/callback` |
| Mailchimp | `/api/channels/mailchimp/callback` |

### Channel-specific notes

- **Google Ads** — needs a Developer Token from your Google Ads Manager Account (Tools & Settings → API Center). Fresh tokens start with Test Account access; apply for **Basic Access** (1–2 business days) before pushing live campaigns.
- **Meta Ads** — for local installs use a **System User token** (Business Settings → System Users → Generate New Token with `ads_read`, `ads_management`, `business_management`). The OAuth flow requires HTTPS and is intended for production deployments.
- **TikTok Ads / LinkedIn Ads / X Ads / Snapchat Ads / Pinterest Ads** — each requires Marketing API access to be approved for your developer app. Calls will 401/403 until the app is whitelisted for ads scopes.
- **X Ads** — uses OAuth 2.0 with PKCE; requires a Confidential Client OAuth app configured in the X developer portal. Historically X Ads required OAuth 1.0a — tokens under the legacy flow need to be re-issued via OAuth 2.0 consent.
- **Amazon Ads** — pick a region (NA / EU / FE) when saving credentials; profiles and all Sponsored Products endpoints are region-scoped. Only Sponsored Products is scaffolded (not Sponsored Brands / Display). Reports are asynchronous v3 — sync fires a report request and returns a `report_id`; ingest happens via a background worker (not yet wired).
- **Mailchimp** — email, not paid media. Audience replaces "ad account". Pushing a campaign creates a **regular** email in draft mode against the selected audience, using the MAAFlo campaign's name as title, `headline` as subject, and `description` as HTML body. A verified **From email** must be set in Channels before pushing. Sync pulls per-campaign reports (emails_sent → impressions, clicks → clicks, unique_opens → conversions) and upserts them into `analytics_daily` keyed by each campaign's send date.

All channels initialise created entities in a **paused / draft** state — nothing goes live until you review it in the platform's native UI.

---

## Campaigns

- Create campaigns with name, goal (awareness / traffic / leads / conversions / sales), budget, start/end dates, headline, description, CTA, target URL
- Each campaign can run on multiple channels simultaneously — add a channel from the campaign detail page, set per-channel budget, and push
- `campaigns.ext_id` tracks the top-level remote id (prefixed by slug: `google_ads:...`, `meta:...`, `tiktok:...`, …)
- Per-channel `ext_campaign_id` and `ext_adset_id` (or ad-group / line-item / campaign-group id, depending on platform) are stored on `campaign_channels`
- Archive campaigns when complete; restore them from the Archived tab

---

## Analytics

- **Dashboard**: 30-day KPI summary — spend, impressions, clicks, conversions, CTR, ROAS, revenue
- **Analytics**: Date-range trend charts (7 / 14 / 30 / 60 / 90 days) and per-campaign breakdown
- **Campaign Detail**: Per-channel area charts and side-by-side bar comparisons
- Aggregation is channel-agnostic — as soon as a channel is synced, its rows flow into the same dashboards

---

## Data & Backup

All data lives in `data/maaflo.db`. Use **System → Backup** to:

- Export a full database snapshot (`.db` file)
- Import a previous backup to restore state

---

## Project Structure

```
MAAFlo/
├── migrations/                   # SQL schema migrations (run in order at startup)
├── server/
│   ├── integrations/             # One module per channel — all follow the same shape
│   │   ├── google-ads.ts
│   │   ├── meta-ads.ts
│   │   ├── tiktok-ads.ts
│   │   ├── linkedin-ads.ts
│   │   ├── x-ads.ts
│   │   ├── snapchat-ads.ts
│   │   ├── amazon-ads.ts
│   │   ├── pinterest-ads.ts
│   │   └── mailchimp.ts
│   ├── routes/                   # Express route handlers (campaigns, channels, clients, …)
│   ├── db.ts                     # Database init, migrations, channel seeding
│   └── index.ts                  # Express app entry point
├── src/
│   ├── components/               # Shared UI (Badge, Modal, StatCard, Sidebar)
│   ├── lib/                      # API client (api.ts), types, formatters
│   └── pages/                    # Page components (Dashboard, Campaigns, Analytics, Channels, …)
├── data/                         # SQLite database (auto-created, git-ignored)
└── package.json
```

Each integration module exports the same surface: OAuth (`getAuthUrl`, `exchangeAuthCode`), account/profile discovery (`listAdAccounts` or equivalent), `create<Channel>Campaign`, and an insights fetcher. Adding a new channel is a matter of mirroring this shape plus one dispatcher branch each in [server/routes/channels.ts](server/routes/channels.ts) and [server/routes/campaign-channels.ts](server/routes/campaign-channels.ts).

---

## Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both server (port 3001) and client (port 5173) with hot reload |
| `npm run dev:server` | Server only |
| `npm run dev:client` | Vite client only |
| `npm run build` | Production build (tsc + vite build) |
| `npm start` | Run production server |

---

## Known limitations

- Creatives (Pins, Snap Ads, TikTok videos, LinkedIn sponsored content, Meta ad creative) are **not** pushed — only campaigns and ad groups. `campaign_ads` records exist in the schema but aren't uploaded to platforms yet.
- Token refresh is **not** automated. Access tokens with finite lifetimes (Meta, LinkedIn, X, Snapchat, Amazon) require reconnecting when they expire. Refresh-token helpers exist for several channels; they just aren't invoked on 401s.
- Amazon Sync requests a report but does not poll/ingest — a background worker for v3 report downloads is a follow-up.
- Mailchimp pushed campaigns stay in draft — scheduling/sending happens in Mailchimp.
- No production auth/authz on the Express API — the app assumes a trusted local/internal deployment.
