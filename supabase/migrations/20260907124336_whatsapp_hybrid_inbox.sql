create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_phone_number_id text not null unique,
  ai_config jsonb not null default '{"enabled":true,"persona_name":"IvaiSoft","system_prompt":"","context_window":20,"fallback_message":"Um atendente continuará o atendimento.","handoff_keywords":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent', 'viewer')),
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  wa_id text not null,
  customer_name text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved')),
  ai_active boolean not null default true,
  human_active boolean not null default false,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  last_message_at timestamptz,
  last_human_reply_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_text text,
  last_message_type text not null default 'text',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, wa_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  wa_id text not null,
  name text,
  title text,
  phone text,
  email text,
  avatar_url text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, wa_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  wa_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  type text not null default 'text' check (type in ('text', 'image', 'voice', 'audio', 'sticker', 'location', 'video', 'document', 'unknown', 'template', 'reaction')),
  content text,
  media_path text,
  media_mime_type text,
  media_size_bytes integer check (media_size_bytes is null or media_size_bytes >= 0),
  transcript text,
  ai_context text,
  status text not null default 'received' check (status in ('received', 'processing', 'sent', 'delivered', 'read', 'failed')),
  sent_by text check (sent_by in ('ai', 'human', 'system')),
  agent_id uuid references public.agents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_status_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  message_id uuid not null references public.messages(id) on delete cascade,
  event_type text not null check (event_type in ('sent', 'delivered', 'read', 'failed', 'reaction')),
  reaction_emoji text,
  occurred_at timestamptz not null,
  raw_payload jsonb
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  subject text not null default '',
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  source text not null default 'manual' check (source in ('ai', 'manual')),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  ai_suggestion_1 text,
  ai_suggestion_2 text,
  ai_suggestion_3 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index one_open_case_per_conversation
  on public.cases (conversation_id) where status = 'open';

create index conversations_business_last_message on public.conversations (business_id, last_message_at desc);
create index messages_conversation_created on public.messages (conversation_id, created_at desc);
create index messages_business_created on public.messages (business_id, created_at desc);
create index contacts_business_last_message on public.contacts (business_id, last_message_at desc);
create index cases_business_created on public.cases (business_id, created_at desc);

create function private.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select business_id from public.agents where id = auth.uid()
$$;

create function public.increment_conversation_unread(conv_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversations
  set unread_count = unread_count + 1, updated_at = now()
  where id = conv_id
$$;

revoke all on function public.increment_conversation_unread(uuid) from public, anon, authenticated;
grant execute on function public.increment_conversation_unread(uuid) to service_role;
grant usage on schema private to authenticated;
grant execute on function private.current_business_id() to authenticated;

alter table public.businesses enable row level security;
alter table public.agents enable row level security;
alter table public.conversations enable row level security;
alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.message_status_events enable row level security;
alter table public.internal_notes enable row level security;
alter table public.cases enable row level security;

create policy businesses_read_own on public.businesses for select to authenticated
  using (id = private.current_business_id());
create policy agents_read_own_business on public.agents for select to authenticated
  using (business_id = private.current_business_id());
create policy conversations_read_own_business on public.conversations for select to authenticated
  using (business_id = private.current_business_id());
create policy contacts_read_own_business on public.contacts for select to authenticated
  using (business_id = private.current_business_id());
create policy messages_read_own_business on public.messages for select to authenticated
  using (business_id = private.current_business_id());
create policy message_status_events_read_own_business on public.message_status_events for select to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_id and m.business_id = private.current_business_id()
  ));
create policy internal_notes_read_own_business on public.internal_notes for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.business_id = private.current_business_id()
  ));
create policy cases_read_own_business on public.cases for select to authenticated
  using (business_id = private.current_business_id());

grant select on public.businesses, public.agents, public.conversations, public.contacts,
  public.messages, public.message_status_events, public.internal_notes, public.cases to authenticated;

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do update set public = false;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['conversations', 'messages', 'cases', 'contacts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
