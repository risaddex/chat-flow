# n8n handoff

The active workflow `yNHoIWuYbywConGI` was intentionally left unchanged at
version `3e47869b-f71d-4a68-8448-51b51d6bafde`.

Prepared drafts:

- `mfIFDkQs3GTAK2yL` — persists the existing generic inbound contract through
  `chat-flow-api.ivaisoft.svc.cluster.local`, stores inbound media privately,
  records `sent` / `delivered` / `read` / `failed` events, and returns
  `ai_active` / `human_active` to the caller for message events.
- `p4jYR70qX9hI9c1a` — protected operator outbound and handoff summary. It uses
  the existing `IvaiSoft WhatsApp API` and `OpenRouter account` credentials.
- `DRB47tGV1HfNkOIA` remains the RAG implementation (OpenRouter + Milvus).

## Credentials before smoke

Do not publish either draft until these credentials are created from BWS and
explicitly attached:

1. Both gateway Webhook nodes: HTTP Header Auth with header
   `X-Machine-Secret` and the same value as API `N8N_MACHINE_SECRET`.
   The draft is inactive and its webhook authentication is deliberately unset;
   do not publish it before attaching this credential.
2. Every HTTP request to Chat Flow API: templated custom auth that adds
   `X-Machine-Secret` with the same value as API `API_MACHINE_SECRET`.
3. Keep `IvaiSoft WhatsApp API` and `OpenRouter account`; do not create a new
   WhatsApp Trigger, Pinecone, or Gemini credential.

## Cutover after smoke

1. Deploy API and UI, apply migrations, bootstrap the business and agent.
2. Test both gateway webhooks using their test URLs and the machine header.
3. In `yNHoIWuYbywConGI`, route raw `statuses[]` events from `Webhook do Worker`
   to `mfIFDkQs3GTAK2yL` with `input=$json`; message events keep going to
   `Normalizar canal WhatsApp`.
4. Add another Execute Sub-workflow after `Montar contrato genérico`, calling
   the same bridge with `input=$json`.
5. Route the message response: `ai_active=true` continues through the current
   contacts/identity/utility/RAG path; `ai_active=false` stops AI output after
   persistence. Printing and other utilities remain in the current path.
6. Publish `p4jYR70qX9hI9c1a`, update the API webhook URLs if needed, then
   publish the single reviewed change to `yNHoIWuYbywConGI`.
7. Send one real inbound message, take it over, send one operator reply, resolve
   it, and confirm AI resumes on the next inbound message.
