create index agents_business_id_idx on public.agents (business_id);
create index cases_assigned_agent_id_idx on public.cases (assigned_agent_id);
create index conversations_assigned_agent_id_idx on public.conversations (assigned_agent_id);
create index internal_notes_agent_id_idx on public.internal_notes (agent_id);
create index internal_notes_conversation_id_idx on public.internal_notes (conversation_id);
create index message_status_events_message_id_idx on public.message_status_events (message_id);
create index messages_agent_id_idx on public.messages (agent_id);
