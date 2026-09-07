alter table public.messages drop constraint messages_type_check;
alter table public.messages add constraint messages_type_check check (
  type in ('text', 'image', 'voice', 'audio', 'sticker', 'location', 'video', 'document', 'contact', 'unknown', 'template', 'reaction')
);
