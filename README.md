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
├── SUPABASE_SCHEMA.md  # Full database schema (all CREATE TABLE queries)
└── index.html
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- WhatsApp Cloud API credentials (for live messaging)

### 1. Install dependencies

```bash
npm install
npm --prefix api install
```

### 2. Set up the database

Open the Supabase **SQL Editor** and run the queries in
[`SUPABASE_SCHEMA.md`](SUPABASE_SCHEMA.md) in order. This creates all tables,
constraints, indexes, and enables Row Level Security.

### 3. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_URL` | URL of the API server (e.g. `http://localhost:3001`) |
| `VITE_API_TOKEN` | Bearer token the front end sends to the API |
| `SUPABASE_URL` | Supabase project URL (API side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (**server only**) |
| `API_BEARER_TOKEN` | Token the API requires on incoming requests |
| `PORT` | API server port (default `3001`) |

> ⚠️ **Never commit your `.env`.** It contains secrets and is gitignored.
> The service-role key must stay on the server only.

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
