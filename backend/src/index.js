import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { pricingRouter } from './routes/pricing.js'
import { ordersRouter } from './routes/orders.js'
import { statusRouter } from './routes/status.js'
import { paymentsRouter } from './routes/payments.js'
import { usersRouter } from './routes/users.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

// Routes
app.use('/api/pricing', pricingRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/orders', statusRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/users', usersRouter)

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }))

// Global error handler — never expose stack traces to client
app.use((err, req, res, next) => {
  console.error('[PAOTS Error]', err)
  const status = err.status || 500
  const message = status < 500 ? err.message : 'An unexpected server error occurred.'
  res.status(status).json({ error: message })
})

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`PAOTS API running on http://localhost:${PORT}`))
}

export default app
