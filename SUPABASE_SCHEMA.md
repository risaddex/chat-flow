# Supabase Database Schema

All SQL required to recreate this project's database in a fresh Supabase project.
Run the statements **in order** (they are ordered to satisfy foreign-key
dependencies) in the Supabase **SQL Editor**, or save them as a migration.

## Tables

| Table | Purpose |
| --- | --- |
| `businesses` | Tenant / business account (WhatsApp + AI config) |
| `agents` | Human support agents (linked to `auth.users`) |
| `conversations` | WhatsApp conversation threads |
| `contacts` | Customer contact records |
| `messages` | Individual inbound/outbound messages |
| `message_status_events` | Delivery / read / reaction events per message |
| `internal_notes` | Private agent notes on a conversation |
| `cases` | Support cases raised from conversations |

---

## 1. Extensions

```sql
-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";
```

## 2. `businesses`

```sql
create table public.businesses (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  whatsapp_phone_number_id  text not null,
  whatsapp_access_token     text,
  ai_config                 jsonb default '{
    "enabled": true,
    "persona_name": "Support",
    "system_prompt": "You are a helpful customer support agent.",
    "context_window": 20,
    "fallback_message": "Sorry, I could not understand that. A human agent will assist you shortly.",
    "handoff_keywords": ["human", "agent", "speak to someone", "refund", "complaint"]
  }'::jsonb,
  pinecone_namespace        text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

alter table public.businesses enable row level security;
```

## 3. `agents`

```sql
create table public.agents (
  id            uuid primary key references auth.users (id) on delete cascade,
  business_id   uuid references public.businesses (id) on delete cascade,
  name          text not null,
  email         text not null,
  role          text default 'agent' check (role in ('admin', 'agent', 'viewer')),
  is_online     boolean default false,
  last_seen_at  timestamptz,
  created_at    timestamptz default now()
);

alter table public.agents enable row level security;
```

## 4. `conversations`

```sql
create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  wa_id                 text not null,
  customer_name         text,
  status                text default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved')),
  ai_active             boolean default true,
  human_active          boolean default false,
  assigned_agent_id     uuid references public.agents (id) on delete set null,
  last_message_at       timestamptz,
  last_human_reply_at   timestamptz,
  unread_count          integer default 0,
  last_message_text     text,
  last_message_type     text default 'text',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.conversations enable row level security;
```

## 5. `contacts`

```sql
create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  wa_id            text not null,
  name             text,
  title            text,
  phone            text,
  email            text,
  avatar_url       text,
  notes            text,
  tags             jsonb default '[]'::jsonb,
  last_message_at  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.contacts enable row level security;
```

## 6. `messages`

```sql
create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  business_id       uuid not null references public.businesses (id) on delete cascade,
  wa_message_id     text unique,
  direction         text not null check (direction in ('inbound', 'outbound')),
  type              text default 'text' check (type in (
                      'text', 'image', 'audio', 'sticker', 'location',
                      'video', 'document', 'unknown', 'template', 'reaction')),
  content           text,
  media_url         text,
  media_mime_type   text,
  media_size_bytes  integer,
  transcript        text,
  ai_context        text,
  status            text default 'received' check (status in (
                      'received', 'processing', 'sent', 'delivered', 'read', 'failed')),
  sent_by           text check (sent_by in ('ai', 'human', 'system')),
  agent_id          uuid references public.agents (id) on delete set null,
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.messages enable row level security;
```

## 7. `message_status_events`

```sql
create table public.message_status_events (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.messages (id) on delete cascade,
  event_type      text not null check (event_type in ('sent', 'delivered', 'read', 'failed', 'reaction')),
  reaction_emoji  text,
  occurred_at     timestamptz not null,
  raw_payload     jsonb
);

alter table public.message_status_events enable row level security;
```

## 8. `internal_notes`

```sql
create table public.internal_notes (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  agent_id         uuid not null references public.agents (id) on delete cascade,
  content          text not null,
  created_at       timestamptz default now()
);

alter table public.internal_notes enable row level security;
```

## 9. `cases`

```sql
create table public.cases (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.conversations (id) on delete cascade,
  business_id        uuid not null references public.businesses (id) on delete cascade,
  subject            text not null default '',
  description        text,
  status             text default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority           text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_agent_id  uuid references public.agents (id) on delete set null,
  source             text not null default 'manual' check (source in ('ai', 'manual')),
  ai_suggestion_1    text,
  ai_suggestion_2    text,
  ai_suggestion_3    text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  resolved_at        timestamptz
);

alter table public.cases enable row level security;
```

---

## 10. Recommended indexes

```sql
create index idx_conversations_business    on public.conversations (business_id);
create index idx_conversations_status      on public.conversations (status);
create index idx_conversations_last_msg    on public.conversations (last_message_at desc);

create index idx_messages_conversation     on public.messages (conversation_id);
create index idx_messages_business         on public.messages (business_id);
create index idx_messages_created          on public.messages (created_at desc);

create index idx_contacts_business         on public.contacts (business_id);
create index idx_cases_business            on public.cases (business_id);
create index idx_cases_conversation        on public.cases (conversation_id);
create index idx_status_events_message     on public.message_status_events (message_id);
create index idx_internal_notes_conversation on public.internal_notes (conversation_id);
```

---

## Notes

- **Row Level Security** is enabled on every table. Add policies that match your
  auth model before exposing the anon key to clients (this project uses a
  service-role key on the API layer). Example starter policy:

  ```sql
  create policy "agents read own business"
    on public.conversations for select
    using (business_id in (
      select business_id from public.agents where id = auth.uid()
    ));
  ```

- `agents.id` references `auth.users(id)` — create the Supabase Auth user first,
  then insert the matching `agents` row.
- Configure the environment variables in `.env` (see `.env.example`) with your
  project URL and keys.
