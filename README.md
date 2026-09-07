# Chat Flow

A WhatsApp customer-support dashboard. Chat Flow gives support teams a single
inbox for WhatsApp conversations, with contact management, support cases,
AI-assisted replies, and analytics — backed by Supabase.

## Features

- **Inbox** — real-time WhatsApp conversation threads with reply support
- **Contacts** — customer records with notes, tags, and history
- **Cases** — track support tickets raised from conversations (status, priority, AI suggestions)
- **Analytics** — conversation volume, response metrics, and agent activity
- **AI + human handoff** — per-conversation AI toggle with human takeover
- **Media** — images, audio, documents, and transcripts inline in the thread

## Tech Stack

| Layer | Stack |
| --- | --- |
| Front end | React 19, Vite, React Router, Tailwind CSS, Recharts |
| API | Hono (Node), Zod validation |
| Database / Auth | Supabase (Postgres + Auth) |
| Integration | WhatsApp Cloud API, n8n webhooks |

## Project Structure

```
.
├── src/            # React front end (pages, components, hooks, context)
├── api/            # Hono API server (routes, middleware, lib)
├── supabase/       # Versioned database migrations
├── n8n/            # Draft workflow ids and cutover runbook
├── deploy/         # Container and k3s configuration
└── index.html
```

## Getting Started

### Prerequisites

- Node.js 22+
- A [Supabase](https://supabase.com) project
- WhatsApp Cloud API credentials (for live messaging)

### 1. Install dependencies

```bash
npm install
npm --prefix api install
```

### 2. Set up the database

Apply the versioned files in `supabase/migrations/`. They create tenant-scoped
RLS policies and the private `whatsapp-media` bucket. Bootstrap the first
business and agent only after creating the agent with Supabase Auth:

```sql
insert into public.businesses (name, whatsapp_phone_number_id)
values ('IvaiSoft', '<META_PHONE_NUMBER_ID>') returning id;

insert into public.agents (id, business_id, name, email, role)
values ('<AUTH_USER_UUID>', '<BUSINESS_UUID>', 'Operator', '<EMAIL>', 'admin');
```

### 3. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VITE_API_URL` | API URL; blank uses the current origin |
| `SUPABASE_URL` | Supabase project URL (API side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (**server only**) |
| `API_MACHINE_SECRET` | Secret accepted only by n8n-to-API endpoints |
| `N8N_MACHINE_SECRET` | Secret sent only by the API to protected n8n webhooks |
| `N8N_OUTBOUND_WEBHOOK_URL` | Internal `.svc` URL for operator sends |
| `N8N_SUMMARIZE_WEBHOOK_URL` | Internal `.svc` URL for handoff summaries |
| `CORS_ORIGIN` | Exact dashboard origin |
| `PORT` | API server port (default `3001`) |

> ⚠️ **Never commit your `.env`.** It contains secrets and is gitignored.
> The service-role key must stay on the server only.

The dashboard authenticates with Supabase Auth and sends that JWT to the API.
It never calls n8n directly. n8n machine endpoints use separate secrets, and
WhatsApp media is read through short-lived signed URLs.

### 4. Run in development

```bash
npm run dev
```

This starts both the Vite front end and the API server concurrently.

- Front end: <http://localhost:5173>
- API: <http://localhost:3001>

### 5. Build for production

```bash
npm run build          # builds the front end
npm --prefix api run build
```

## k3s

`deploy/k8s.yaml` contains separate frontend and API workloads for
`chat.ivaisoft.com`, plus the daily 30-day retention job. Images are pinned by
digest in the existing LAN registry. `deploy/bitwarden-secrets.yaml` maps the
Supabase server key to `chat-flow-secrets` and the machine keys to
`chat-flow-machine-secrets`, automatically synchronized by the existing
Bitwarden operator. The namespace must contain its `bw-auth-token`
authentication Secret. Never put secret values in the manifest.

```bash
kubectl --context default apply -f deploy/bitwarden-secrets.yaml
kubectl --context default -n ivaisoft wait --for=condition=SuccessfulSync bitwardensecret/chat-flow-secrets --timeout=60s
kubectl --context default apply --dry-run=server -f deploy/k8s.yaml
kubectl --context default apply -f deploy/k8s.yaml
```

### Deployment evidence — 2026-09-07

API and frontend are deployed at <https://chat.ivaisoft.com>, with both pods
ready and BWS synchronization successful. The public live smoke passed:
password login, tenant RLS, API tenant/viewer guards, duplicate ingestion
(one message and one unread increment), takeover/resolve, status deduplication,
2 MiB upload, private signed media (300-second TTL), and 30-day retention
removing the expired message/media while preserving recent content.
The deletion check allows up to 65 seconds for
[Supabase CDN invalidation](https://supabase.com/docs/guides/storage/cdn/smart-cdn);
the configured signed-token TTL is not a guarantee of immediate cache revocation.

```bash
SMOKE_API_URL=https://chat.ivaisoft.com node api/smoke.mjs
```

The script reads the deployed secrets in memory, creates temporary tenants
and Auth users, then signs out and deletes only its fixtures. It never sends
WhatsApp messages. It refuses the retention check if unrelated expired messages,
notes, cases or conversation previews exist. Because the retention endpoint is
global, run this smoke only before cutover, without concurrent traffic, against
this authorized project with `kubectl` access.

Production business/operator bootstrap and WhatsApp cutover are still pending.
n8n bridge persistence passed; the summary smoke failed because the existing
OpenRouter API key expired. Both n8n drafts remain unpublished and the active
inbound flow is unchanged. See `n8n/README.md` before activating messaging.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run front end + API together |
| `npm run dev:ui` | Front end only |
| `npm run dev:api` | API only |
| `npm run build` | Type-check and build the front end |
| `npm run lint` | Lint with oxlint |

## License

This project is provided as-is for demonstration purposes.
