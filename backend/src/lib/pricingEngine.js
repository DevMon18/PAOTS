import { supabase } from '../lib/supabase.js'

/**
 * Calculate total order cost using pricing_rules table.
 * Formula: price_per_sqm × (width × height) × quantity
 */
export async function calculatePrice({ jobType, materialType, width, height, quantity, needsLayout }) {
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

  const parsedWidth = parseFloat(width)
  const parsedHeight = parseFloat(height)
  let area = parsedWidth * parsedHeight

  if (jobType === 'UV Print') {
    area = Math.max(4, area)
  }

  let rawTotal = rule.price_per_sqm * area * parseInt(quantity)

  if (needsLayout === true || needsLayout === 'true') {
    rawTotal += 180.00
  }

  const total = Math.round(rawTotal * 100) / 100 // 2 decimal places
  return total
}
