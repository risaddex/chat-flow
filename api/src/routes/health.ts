import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export { app as healthRouter };
