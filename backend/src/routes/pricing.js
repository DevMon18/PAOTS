import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { calculatePrice } from '../lib/pricingEngine.js'

export const pricingRouter = Router()

// POST /api/pricing/calculate
// Computes order price from job specs — server-side to prevent client-side manipulation
pricingRouter.post('/calculate', requireAuth, async (req, res, next) => {
  try {
    const { jobType, materialType, width, height, quantity } = req.body
    const total_cost = await calculatePrice({ jobType, materialType, width, height, quantity })
    res.json({ total_cost })
  } catch (err) {
    next(err)
  }
})
