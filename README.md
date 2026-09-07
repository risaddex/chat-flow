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
`chat.ivaisoft.com`, plus the daily 30-day retention job. Replace image names
and create the `chat-flow-secrets` Secret from BWS before applying it. Never put
secret values in the manifest.

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
