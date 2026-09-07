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

## Configured credentials

Both drafts have their dedicated credentials attached (2026-09-07):

- `G6SS690xFzgckStV` — `IvaiSoft Chat Flow — n8n para API`: templated custom
  auth adds `X-Machine-Secret` using BWS `API_MACHINE_SECRET`. Attached to
  all four HTTP requests to the Chat Flow API.
- `RZFuWd3ZZCZTPpBx` — `IvaiSoft Chat Flow — API para n8n`: HTTP Header Auth
  using BWS `N8N_MACHINE_SECRET`. Both gateway webhooks require this header.

Kubernetes synchronizes both values into `ivaisoft/chat-flow-machine-secrets`
using `deploy/bitwarden-secrets.yaml`. n8n stores encrypted credential copies;
when rotating BWS values, update the corresponding n8n credential too.
No secret values belong in workflow parameters or Git.

Keep `IvaiSoft WhatsApp API` and `OpenRouter account`. The drafts remain
inactive pending application deployment, operator bootstrap and smoke.

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
