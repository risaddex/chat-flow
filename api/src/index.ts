import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { messagesRouter } from './routes/messages.js';
import { statusRouter } from './routes/status.js';
import { contactsRouter } from './routes/contacts.js';
import { casesRouter } from './routes/cases.js';
import { conversationsRouter } from './routes/conversations.js';
import { mediaRouter } from './routes/media.js';
import { retentionRouter } from './routes/retention.js';

const app = new Hono();

app.use('/api/*', cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.route('/health', healthRouter);
app.route('/api/messages', messagesRouter);
app.route('/api/status', statusRouter);
app.route('/api/contacts', contactsRouter);
app.route('/api/cases', casesRouter);
app.route('/api/conversations', conversationsRouter);
app.route('/api/media', mediaRouter);
app.route('/api/retention', retentionRouter);

console.log(`API starting on port ${config.port}`);
serve({ fetch: app.fetch, port: config.port });
