import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import dotenv from 'dotenv';

dotenv.config();

import { authRouter } from './routes/auth.js';
import { companiesRouter } from './routes/companies.js';
import { sheetsRouter } from './routes/sheets.js';
import { usersRouter } from './routes/users.js';
import codeforcesRouter from './routes/codeforces.js';
import cpSheetsRouter from './routes/cp_sheets.js';
import { billingRouter } from './routes/billing.js';
import { progressRouter } from './routes/progress.js';
import { problemsRouter } from './routes/problems.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000'],
  credentials: true,
}));

// Routes
app.route('/api/auth', authRouter);
app.route('/api/companies', companiesRouter);
app.route('/api/sheets', sheetsRouter);
app.route('/api/users', usersRouter);
app.route('/api/user/codeforces', codeforcesRouter);
app.route('/api/user/cp-sheets', cpSheetsRouter);
app.route('/api/billing', billingRouter);
app.route('/api/progress', progressRouter);
app.route('/api/problems', problemsRouter);

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;
console.log(`API Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});