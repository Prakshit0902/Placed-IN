import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import dotenv from 'dotenv'

dotenv.config()

import { templatesRouter } from './routes/templates.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000'], // Next.js web app
}))

// Routes
app.route('/api/templates', templatesRouter)

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000
console.log(`API Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})