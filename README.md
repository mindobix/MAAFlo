# MAAFlo - Marketing Analytics Automation Flow

Local-first marketing automation and analytics platform. Manage multiple clients, connect Google Ads and Meta Ads, track campaigns, and analyse cross-channel performance — all from a single self-hosted web app backed by SQLite.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3, WAL mode) |
| Charts | Recharts |
| Styling | Tailwind CSS |

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

The SQLite database is created automatically at `data/maaflo.db` on first run. No `.env` file is required — all credentials are stored in the database per client.

---

## Multi-client Architecture

Every piece of data (channels, campaigns, analytics) is scoped to a **Client**. You can manage multiple advertisers from one installation.

- Create clients via **System → Clients**
- Switch the active portal using the client switcher in the left sidebar
- Each client has its own channel connections and campaign history

---

## Connecting Channels

Credentials are entered once per client inside **Channels** and stored in the database — no `.env` editing required.

### Google Ads

**Step 1 — Create an OAuth App**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create or select a project
2. APIs & Services → Library → enable **Google Ads API**
3. APIs & Services → Credentials → **Create OAuth 2.0 Client ID** (Application type: Web application)
4. Add `http://localhost:3001/api/channels/google/callback` as an **Authorised Redirect URI**
5. Copy the **Client ID** and **Client Secret**

**Step 2 — Get a Developer Token**

1. Sign in to your **Google Ads Manager Account** (MCC)
2. Tools & Settings → API Center → copy the **Developer Token**
3. If the token shows "Test Account" access, apply for **Basic Access** (required to push live campaigns; approval takes 1–2 business days)

**Step 3 — Enter credentials in MAAFlo**

Open Channels for your client → Google Ads → Step 1 form → paste Client ID, Client Secret, Developer Token → **Save Credentials**

**Step 4 — Authorise**

Click **Connect Google Ads** → approve in the popup → the channel status will change to Connected.

**Step 5 — Set Customer ID**

After connecting, enter your Google Ads Customer ID (the 10-digit number shown top-right in Google Ads) and click Save.

---

### Meta Ads (System User Token — recommended)

System User tokens never expire and don't require HTTPS, making them ideal for local installs.

1. Go to [business.facebook.com](https://business.facebook.com) → Business Settings → **System Users**
2. Add a System User with **Admin** role
3. Click **Generate New Token** → select your Meta app (or create one at developers.facebook.com)
4. Enable permissions: `ads_read`, `ads_management`, `business_management`
5. Copy the token
6. Open Channels → Meta Ads → paste the token → **Connect**

The app will automatically discover ad accounts linked to your Business Manager. If none are found automatically, enter the Ad Account ID manually (format: `act_123456789`).

### Meta Ads (OAuth — production only)

OAuth requires an HTTPS redirect URI. For local development use the System User Token method above. To configure OAuth for a production deployment:

1. Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → Business
2. Add the **Marketing API** product
3. Settings → Basic → copy **App ID** and **App Secret**
4. Facebook Login → Settings → add your production callback URL as a Valid OAuth Redirect URI
5. Open Channels → Meta Ads → OAuth Connect → Configure App → enter App ID and App Secret

---

## Campaigns

- Create campaigns with goal, budget, start/end dates
- Each campaign can run on multiple channels (Google Ads, Meta Ads)
- Push campaigns to connected platforms directly from the campaign detail view
- Archive campaigns when complete; restore them from the Archived tab

---

## Analytics

- **Dashboard**: 30-day KPI summary — spend, impressions, clicks, conversions, CTR, ROAS, revenue
- **Analytics**: Date-range trend charts (7 / 14 / 30 / 60 / 90 days) and per-campaign breakdown
- **Campaign Detail**: Per-channel area charts and side-by-side bar comparisons

---

## Data & Backup

All data lives in `data/maaflo.db`. Use **System → Backup** to:

- Export a full database snapshot (`.db` file)
- Import a previous backup to restore state

---

## Project Structure

```
MAAFlo/
├── migrations/          # SQL schema migrations (run in order at startup)
├── server/
│   ├── integrations/    # Google Ads and Meta Ads API clients
│   ├── routes/          # Express route handlers (campaigns, channels, clients, …)
│   ├── db.ts            # Database init, migrations, seed
│   └── index.ts         # Express app entry point
├── src/
│   ├── components/      # Shared UI components (Badge, Modal, StatCard, Sidebar)
│   ├── lib/             # API client (api.ts), types, formatters
│   └── pages/           # Page components (Dashboard, Campaigns, Analytics, …)
├── data/                # SQLite database (auto-created, git-ignored)
└── package.json
```

---

## Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both server (port 3001) and client (port 5173) with hot reload |
| `npm run dev:server` | Server only |
| `npm run dev:client` | Vite client only |
| `npm run build` | Production build |
| `npm start` | Run production server |
