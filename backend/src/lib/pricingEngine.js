import { supabase } from '../lib/supabase.js'

/**
 * Calculate total order cost using pricing_rules table.
 * Formula: price_per_sqm × (width × height) × quantity
 */
export async function calculatePrice({ jobType, materialType, width, height, quantity }) {
  if (!jobType || !materialType || !width || !height || !quantity) {
    const err = new Error('Cannot calculate — please enter all specifications (job type, material, dimensions, quantity).')
    err.status = 422
    throw err
  }

  const { data: rule, error } = await supabase
    .from('pricing_rules')
    .select('price_per_sqm')
    .eq('job_type', jobType)
    .eq('material_type', materialType)
    .maybeSingle()

  if (error || !rule) {
    const err = new Error(`No pricing rule found for ${jobType} / ${materialType}. Please contact the manager to configure pricing.`)
    err.status = 422
    throw err
  }

  const area = parseFloat(width) * parseFloat(height)
  const rawTotal = rule.price_per_sqm * area * parseInt(quantity)
  const total = Math.round(rawTotal * 100) / 100 // 2 decimal places
  return total
}
