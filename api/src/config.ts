import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  apiMachineSecret: process.env.API_MACHINE_SECRET || '',
  n8nMachineSecret: process.env.N8N_MACHINE_SECRET || '',
  n8nOutboundWebhookUrl: process.env.N8N_OUTBOUND_WEBHOOK_URL || '',
  n8nSummarizeWebhookUrl: process.env.N8N_SUMMARIZE_WEBHOOK_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  mediaSignedUrlTtlSeconds: parseInt(process.env.MEDIA_SIGNED_URL_TTL_SECONDS || '300', 10),
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
