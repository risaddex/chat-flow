# Supabase schema

The database contract lives in versioned migrations under `supabase/migrations/`.
Apply migrations with the Supabase CLI or the official Supabase MCP; do not copy
ad-hoc SQL from this file.

The schema intentionally keeps WhatsApp and n8n secrets outside Postgres. The
browser receives only the publishable key, all public tables use RLS, and the
`whatsapp-media` bucket is private.
